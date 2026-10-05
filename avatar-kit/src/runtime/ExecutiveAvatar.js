/*
 * ExecutiveAvatar: the AVATAR_RUNTIME_CONTRACT.
 *
 *   TEMPORARY_ASSET  ->  AVATAR_RUNTIME_CONTRACT (this file)  ->  PRODUCTION_VERA_ASSET
 *
 * The application talks only to the object returned by createExecutiveAvatar(). It never touches a mesh, a morph target, a bone
 * or a file name. What the character is made of lives in the asset (a GLB through RigMap, or the built-in procedural character);
 * swapping the asset is a change of `options.asset` and nothing else.
 *
 * It adds, on top of the existing AvatarAPI (reused, not replaced):
 *   - a real conversation state model (ConversationState): IDLE LISTENING THINKING SPEAKING INTERRUPTED TRANSITION ERROR
 *   - executive presence per state (what the face, gaze and body do in each)
 *   - the speech pipeline: Text -> SpeechProvider -> audio -> LipSyncController -> avatar, with stop and interruption
 *   - an asset-independent expression and viseme vocabulary
 *   - a deterministic demo sequence
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit;

  var DEMO_TEXT = "Let's separate the problem from the noise. The issue is not what happened. The issue is what is preventing the next move.";

  /* The public expression vocabulary. Each name maps to an engine expression plus an intensity; the engine blends between them. */
  var EXPRESSIONS = { neutral: ['neutral', 1], warm: ['empathetic', 0.75], focused: ['analyzing', 0.65], skeptical: ['skeptical', 1], concerned: ['concerned', 1], confident: ['confident', 1], surprised: ['surprised', 0.8], firm: ['firm', 1] };
  /* The public viseme vocabulary -> engine viseme names (Oculus 15) */
  var VISEMES = { AA: 'viseme_aa', E: 'viseme_E', O: 'viseme_O', M: 'viseme_PP', F: 'viseme_FF', TH: 'viseme_TH', S: 'viseme_SS', REST: 'viseme_sil' };
  var ANIMATIONS = ['nod', 'acknowledge', 'blink', 'lookAway', 'idle'];

  /* What each conversation state does to the character */
  var PRESENCE = {
    IDLE: { cog: null, expr: 'neutral', gaze: 'camera', idle: 1, attention: 0.7 },
    LISTENING: { cog: 'LISTENING', gaze: 'camera', idle: 0.55, attention: 0.95 },
    THINKING: { cog: 'THINKING', idle: 0.7, attention: 0.8 },
    SPEAKING: { cog: 'SPEAKING', gaze: 'camera', idle: 0.9, attention: 0.85 },
    INTERRUPTED: { cog: 'LISTENING', expr: ['concerned', 0.3], gaze: 'camera', idle: 0.5, attention: 1 },
    ERROR: { cog: null, expr: ['concerned', 0.5], gaze: 'camera', idle: 0.8, attention: 0.7 }
  };

  /* What an asset must provide, and how the runtime degrades when it does not. Documented here, enforced by the rig report. */
  var CONTRACT = {
    required: ['a loadable model (GLB through RigMap, or the procedural character)', 'a head with a jaw that opens (bone or blendshape)'],
    expected: ['52 ARKit blendshapes', '15 Oculus visemes', 'eye bones or look-blendshapes', 'head and neck bones', 'spine and shoulders for body presence'],
    degrades: { 'no visemes': 'jaw and mouth shapes from the audio level (amplitude fallback)', 'no blendshapes': 'bones only', 'no eye controls': 'head turns carry the gaze', 'no body': 'head and neck only', 'missing file or bad GLB': 'the procedural character, with a warning' },
    textures: 'PNG/JPEG today. KTX2 is required for production and is NOT supported by the current loader.',
    swap: 'options.asset = { url: "vera-production.glb", rigMap?: {...}, role: "PRODUCTION" }'
  };

  function createExecutiveAvatar(container, options) {
    options = options || {};
    var asset = options.asset || { source: 'procedural' };
    var role = asset.role || (asset.url || asset.data ? 'ASSET' : 'DEVELOPMENT_PLACEHOLDER');
    var spec = asset.url || asset.data ? { source: 'auto', url: asset.url, data: asset.data, rigMap: asset.rigMap || (asset.profile && asset.profile.rigMap) } : { source: 'procedural' };
    var avatar = WA.createAvatar(container, { shot: options.shot || 'MEDIUM_CLOSE', style: options.style || 'executive', quality: options.quality || 'medium', paused: options.paused, adaptive: options.adaptive,
      pixelRatio: options.pixelRatio, autoState: true, avatar: spec });
    var convo = new WA.ConversationState(options.state), handlers = {}, timers = [], clock = 0, token = 0, demoToken = 0, pending = null, destroyed = false;
    var provider = WA.createSpeechProvider(options.speech || 'auto', options.speechOptions), fallbackVoice = new WA.SyntheticSpeechProvider(options.speechOptions);
    var lastAnimation = 'idle', lastError = null, assetInfo = { profiled: 0, requested: asset.url || (asset.data ? '(data)' : 'procedural'), role: role, label: asset.label || null, loaded: null, fallback: false, error: null };

    function emit(n, d) { (handlers[n] || []).slice().forEach(function (f) { try { f(d); } catch (e) {} }); }
    function later(sec, fn) { timers.push({ at: clock + sec, fn: fn }); }
    function wait(sec) { return new Promise(function (res) { later(sec, res); }); }

    /* ---------- presence: what the character does in each state ---------- */
    function applyPresence(state) {
      var p = PRESENCE[state]; if (!p) return;
      avatar.setCognitiveState(p.cog);
      var e = p.expr; if (e) { if (typeof e === 'string') avatar.setExpression(e); else avatar.setExpression(e[0], { intensity: e[1] }); }
      if (p.gaze) avatar.lookAt(p.gaze);
      avatar.idle({ intensity: p.idle }); avatar.setAttention(p.attention);
      if (state === 'LISTENING' && convo.previous === 'INTERRUPTED') avatar.gesture('nod');
    }
    convo.on('change', function (c) { applyPresence(c.to); emit('state', { state: c.to, from: c.from, event: c.event }); });
    convo.on('invalid', function (d) { emit('warning', WA.AvatarError('INVALID_TRANSITION', 'Event "' + d.event + '" is not valid in state ' + d.state)); });
    avatar.on('warning', function (w) { emit('warning', w); }); avatar.on('error', function (e) { emit('error', e); });
    avatar.on('tick', function (dt) {
      clock += dt; convo.tick(dt);
      for (var i = timers.length - 1; i >= 0; i--) if (timers[i].at <= clock) { var t = timers.splice(i, 1)[0]; try { t.fn(); } catch (e) {} }
    });

    /* ---------- speech: Text -> SpeechProvider -> audio -> lip-sync -> avatar ---------- */
    function play(result, mine) {
      var phon = { phonemes: result.phonemes, provider: 'phonemes' };
      if (result.playback === 'engine' && result.audio) {
        return avatar.speak(result.audio, { phonemes: result.phonemes, provider: 'phonemes', sampleRate: result.sampleRate }).catch(function (e) {
          if (e && e.code === 'PLAY_BLOCKED' && mine()) { emit('warning', WA.AvatarError('AUDIO_BLOCKED', 'The browser blocked audio until the page is clicked; lips run silently')); return avatar.speak(null, phon); }
          throw e;
        });
      }
      return avatar.speak(null, phon);
    }
    function stopAudio() { try { provider.stop(); } catch (e) {} try { fallbackVoice.stop(); } catch (e) {} avatar.stopSpeaking(); }

    function speak(text, opts) {
      text = String(text == null ? '' : text).trim();
      if (!text) return Promise.reject(WA.AvatarError('EMPTY_TEXT', 'There is nothing to say'));
      var c = convo.current();
      if (c === 'INTERRUPTED' || (c === 'ERROR' && false)) return Promise.resolve({ ok: false, reason: 'user is speaking' });
      var my = ++token, mine = function () { return my === token && !destroyed; };
      if (pending) { stopAudio(); pending.resolve({ ok: false, reason: 'replaced' }); pending = null; }
      if (c !== 'SPEAKING') convo.dispatch('responseStart'); else applyPresence('SPEAKING');
      emit('speechstart', { text: text });
      return new Promise(function (resolve) {
        var done = false, prov = provider;
        function finish(res) { if (done) return; done = true; if (pending && pending.my === my) pending = null; resolve(res); }
        pending = { my: my, resolve: finish };
        var started = false;
        function run(p) {
          return p.speak(text, { onStart: function (r) { if (!mine()) return; started = true; play(r, mine).then(function () { if (mine()) end({ ok: true, provider: p.name, duration: r.duration }); }, fail); } })
            .then(function (r) {
              if (!mine()) return;
              if (r.playback === 'provider') { if (!started) { started = true; play(r, mine); } end({ ok: true, provider: p.name, duration: r.duration }); }
              else if (!started) { started = true; play(r, mine).then(function () { if (mine()) end({ ok: true, provider: p.name, duration: r.duration }); }, fail); }
            }, function (e) { if (mine() && p !== fallbackVoice) { emit('warning', WA.AvatarError('SPEECH_FALLBACK', 'Speech provider "' + p.name + '" failed (' + (e && e.message) + '); using the synthetic voice', e)); prov = fallbackVoice; return run(fallbackVoice); } fail(e); });
        }
        function end(res) { if (!mine()) return finish({ ok: false, reason: 'stopped' }); avatar.stopSpeaking(); if (convo.isIn('SPEAKING')) convo.dispatch('responseEnd'); emit('speechend', res); finish(res); }
        function fail(e) { if (!mine()) return finish({ ok: false, reason: 'stopped' }); lastError = e; stopAudio(); convo.dispatch('error'); emit('error', e); finish({ ok: false, reason: 'error', error: e }); }
        run(provider);
      });
    }
    function stopSpeaking() {
      var had = !!pending || avatar.isSpeaking(); token++; stopAudio();
      if (pending) { var p = pending; pending = null; p.resolve({ ok: false, reason: 'stopped' }); }
      if (convo.isIn('SPEAKING')) convo.dispatch('cancel');
      if (had) emit('speechend', { ok: false, reason: 'stopped' });
    }
    function interrupt() { if (convo.isIn('SPEAKING')) { token++; stopAudio(); if (pending) { var p = pending; pending = null; p.resolve({ ok: false, reason: 'interrupted' }); } emit('speechend', { ok: false, reason: 'interrupted' }); return convo.dispatch('interrupt'); } return false; }

    /* ---------- the conversation: what the application reports ---------- */
    function userStartedSpeaking() { if (convo.isIn('SPEAKING')) return interrupt(); return convo.dispatch('userStart'); }
    function userStoppedSpeaking() { return convo.dispatch('userEnd'); }

    function setState(name) {
      name = String(name || '').toUpperCase();
      if (name === 'SPEAKING' && !avatar.isSpeaking()) return convo.force('SPEAKING');
      if (name === 'IDLE' && convo.isIn('SPEAKING')) { stopSpeaking(); return true; }
      if (name === 'LISTENING') { if (convo.isIn('SPEAKING')) return interrupt(); if (convo.canDispatch('userStart')) return convo.dispatch('userStart'); }
      if (name === 'THINKING' && convo.canDispatch('userEnd')) return convo.dispatch('userEnd');
      return convo.force(name);
    }

    function setExpression(name, opts) {
      var key = String(name == null ? '' : name).toLowerCase(), m = EXPRESSIONS[key];
      if (!m) { var known = Object.keys(EXPRESSIONS); emit('warning', WA.AvatarError('UNKNOWN_EXPRESSION', 'Unknown expression "' + name + '". Known: ' + known.join(', '))); return false; }
      var o = {}; for (var k in (opts || {})) o[k] = opts[k];
      o.intensity = o.intensity != null ? o.intensity : m[1];
      var ok = avatar.setExpression(m[0], o); if (ok) emit('expression', key); return ok;
    }
    function setViseme(name, w) {
      var n = String(name == null ? '' : name).toUpperCase(), v = VISEMES[n];
      if (!v) { emit('warning', WA.AvatarError('UNKNOWN_VISEME', 'Unknown viseme "' + name + '". Known: ' + Object.keys(VISEMES).join(', '))); return false; }
      avatar.setViseme(n === 'REST' ? null : v, w == null ? 1 : w); return true;
    }
    function playAnimation(name) {
      var n = String(name || ''), ok = false;
      if (n === 'nod' || n === 'acknowledge') ok = avatar.gesture('nod');
      else if (n === 'lookAway') { ok = avatar.lookAt('right'); later(1.1, function () { avatar.lookAt('camera'); }); }
      else if (n === 'blink') ok = avatar.gesture('blink');
      else if (n === 'idle') { avatar.idle({ intensity: 1 }); ok = true; }
      if (ok) { lastAnimation = n; emit('animation', n); } else emit('warning', WA.AvatarError('UNKNOWN_ANIMATION', 'Unknown animation "' + name + '". Known: ' + ANIMATIONS.join(', ')));
      return ok;
    }
    function idle(o) { stopDemo(); if (convo.isIn('SPEAKING')) stopSpeaking(); if (!convo.isIn('IDLE')) convo.dispatch('reset'); avatar.idle(o == null ? { intensity: 1 } : o); lastAnimation = 'idle'; return true; }

    /* ---------- the demo: IDLE, look, LISTENING, THINKING, focused, SPEAKING, firm, IDLE ---------- */
    function stopDemo() { demoToken++; }
    function runDemo(text) {
      var d = ++demoToken, alive = function () { return d === demoToken && !destroyed; };
      function step(name) { emit('demostep', name); }
      stopSpeaking(); convo.dispatch('reset'); setExpression('neutral');
      return (async function () {
        step('IDLE'); avatar.lookAt('left'); await wait(1.4); if (!alive()) return { ok: false };
        step('LOOK'); avatar.lookAt('camera'); await wait(1.3); if (!alive()) return { ok: false };
        step('LISTENING'); userStartedSpeaking(); await wait(1.0); if (!alive()) return { ok: false }; playAnimation('nod'); await wait(1.8); if (!alive()) return { ok: false };
        step('THINKING'); userStoppedSpeaking(); await wait(0.7); if (!alive()) return { ok: false };
        step('FOCUSED'); setExpression('focused'); await wait(1.5); if (!alive()) return { ok: false };
        step('SPEAKING'); var r = await speak(text || DEMO_TEXT); if (!alive() || !r.ok) return { ok: false, speech: r };
        step('FIRM'); setExpression('firm'); await wait(1.8); if (!alive()) return { ok: false };
        step('IDLE'); convo.dispatch('reset'); step('DONE'); return { ok: true };
      })();
    }

    /* ---------- the 1.5 second presence test: neutral, looks to the camera, a subtle blink, holds the gaze ---------- */
    function runPresenceTest() {
      stopSpeaking(); if (!convo.isIn('IDLE')) convo.dispatch('reset'); setExpression('neutral'); var log = [{ t: 0, what: 'neutral' }];
      avatar.lookAt(0.32, -0.04);
      return new Promise(function (resolve) {
        later(0.5, function () { avatar.lookAt('camera'); log.push({ t: 0.5, what: 'looks toward camera' }); });
        later(1.0, function () { avatar.gesture('blink'); log.push({ t: 1.0, what: 'subtle blink' }); });
        later(1.5, function () { log.push({ t: 1.5, what: 'holds gaze' }); emit('presencetest', log); resolve(log); });
      });
    }

    /* ---------- introspection ---------- */
    function morphInfo() {
      var caps = avatar.capabilities() || {}, rep = avatar.getRigReport() || {}, inf = avatar.getModelInfo() || {};
      return { kind: inf.kind || null, grade: rep.grade || null, morphTargets: !!caps.morphTargets, visemes: !!caps.visemes, eyes: !!(caps.eyeBones || caps.eyeMorphs), jaw: !!caps.jaw, body: !!caps.body, animations: !!caps.animations,
        channels: rep.channels ? { resolved: rep.channels.resolved, total: rep.channels.total } : (caps.channels ? { resolved: caps.channels.length } : null), notes: rep.notes || [] };
    }
    function info() {
      var s = avatar.stats(), d = avatar.debug(), m = morphInfo();
      return { fps: s.fps, state: convo.state, target: convo.current(), expression: avatar.getExpression(), cognitive: avatar.getCognitiveState(), animation: lastAnimation, speaking: avatar.isSpeaking(), shot: avatar.getShot(),
        asset: { role: role, profiled: assetInfo.profiled, requested: assetInfo.requested, loaded: assetInfo.loaded, fallback: assetInfo.fallback, error: assetInfo.error, label: assetInfo.label }, rig: m, provider: provider.name, triangles: s.triangles, drawCalls: s.drawCalls, time: d.time };
    }

    /* An asset profile is DATA about one asset (material overrides, hidden meshes), never logic: { materials: { name: { color, map: null, roughness, metalness, envMapIntensity } }, hide: [mesh names] } */
    function applyProfile(p) {
      var m = avatar.model; if (!p || !m || !m.object3D) return 0; var n = 0;
      m.object3D.traverse(function (o) {
        if (p.hide && p.hide.indexOf(o.name) >= 0) { o.visible = false; n++; }
        [].concat(o.material || []).forEach(function (mat) { var c = p.materials && p.materials[mat.name]; if (!c || mat.__profiled) return; mat.__profiled = true; n++;
          if (c.type === 'lambert' && o.material === mat && root.THREE) { var nm = new root.THREE.MeshLambertMaterial({ color: c.color || '#000000', name: mat.name }); nm.__profiled = true; nm.side = mat.side; if (mat.normalMap && c.normal !== false) nm.normalMap = null; o.material = nm; n++; return; }
          if (c.color != null && mat.color) mat.color.set(c.color); if (c.map === null) mat.map = null; if (c.roughness != null) mat.roughness = c.roughness; if (c.metalness != null) mat.metalness = c.metalness;
          if (c.envMapIntensity != null) mat.envMapIntensity = c.envMapIntensity; if (c.emissive != null && mat.emissive) mat.emissive.set(c.emissive); mat.needsUpdate = true; });
      });
      return n;
    }
    var ready = avatar.ready.then(function (r) {
      if (asset.profile) assetInfo.profiled = applyProfile(asset.profile);
      assetInfo.loaded = (r.info && (r.info.name || r.info.kind)) || r.source; assetInfo.fallback = !!r.fallback || (r.source === 'procedural' && !!asset.url); assetInfo.error = r.error ? (r.error.code || 'ERROR') + ': ' + r.error.message : null;
      if (assetInfo.fallback && assetInfo.error) emit('warning', WA.AvatarError('ASSET_FALLBACK', 'The asset could not be used (' + assetInfo.error + '); showing the built-in placeholder'));
      applyPresence('IDLE'); emit('ready', info()); return info();
    });

    var api = {
      ready: ready, version: WA.VERSION, role: role,
      /* conversation */
      setState: setState, getState: function () { return convo.state; }, getTargetState: function () { return convo.current(); }, states: WA.ConversationState.STATES.slice(), stateHistory: function () { return convo.history.slice(); },
      userStartedSpeaking: userStartedSpeaking, userStoppedSpeaking: userStoppedSpeaking, interrupt: interrupt,
      /* the character */
      setExpression: setExpression, getExpression: function () { return avatar.getExpression(); }, expressions: Object.keys(EXPRESSIONS),
      speak: speak, stopSpeaking: stopSpeaking, isSpeaking: function () { return avatar.isSpeaking(); },
      setViseme: setViseme, visemes: Object.keys(VISEMES), setLevel: function (v) { avatar.setLevel(v); },
      lookAt: function (x, y) { return avatar.lookAt(x, y); }, setShot: function (n, o) { return avatar.setShot(n, o); }, getShot: function () { return avatar.getShot(); }, shots: ['CLOSE', 'MEDIUM_CLOSE', 'MEDIUM', 'FULL'],
      playAnimation: playAnimation, animations: ANIMATIONS.slice(), idle: idle,
      /* demo and tools */
      runDemo: runDemo, stopDemo: stopDemo, demoText: DEMO_TEXT, runPresenceTest: runPresenceTest,
      info: info, contract: function () { return CONTRACT; }, rigInfo: morphInfo, stats: function () { return avatar.stats(); },
      setSpeechProvider: function (p, o) { provider = WA.createSpeechProvider(p, o); return provider.name; }, speechProvider: function () { return provider.name; },
      on: function (n, f) { (handlers[n] = handlers[n] || []).push(f); return f; }, off: function (n, f) { handlers[n] = (handlers[n] || []).filter(function (x) { return x !== f; }); },
      advance: function (s, nr) { avatar.advance(s, nr); }, pause: function () { avatar.pause(); }, resume: function () { avatar.resume(); },
      capture: function (t) { return avatar.capture(t); }, avatar: avatar,
      destroy: function () { destroyed = true; token++; demoToken++; try { provider.stop(); } catch (e) {} avatar.destroy(); }
    };
    return api;
  }

  WA.createExecutiveAvatar = createExecutiveAvatar;
  WA.ExecutiveContract = { EXPRESSIONS: EXPRESSIONS, VISEMES: VISEMES, ANIMATIONS: ANIMATIONS, PRESENCE: PRESENCE, CONTRACT: CONTRACT, DEMO_TEXT: DEMO_TEXT };
})(typeof window !== 'undefined' ? window : globalThis);
