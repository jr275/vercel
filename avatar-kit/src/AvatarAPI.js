/*
 * AvatarAPI: the only surface the rest of the application needs.
 *
 *   const avatar = AvatarKit.createAvatar(container, { avatar: { source: 'glb', url: 'wendy.glb', rigMap }, shot: 'CLOSE' });
 *   avatar.setExpression('firm');                  // what the face shows
 *   avatar.setCognitiveState('CHALLENGE');          // what the agent is doing: face, gaze, posture follow
 *   avatar.speak(audio, { visemes, provider });     // mouth follows phonetic data if given, the audio if not
 *   avatar.setShot('CLOSE', { style: 'executive' });
 *   avatar.lookAt('camera');                        // camera | cursor | center | left | right | x, y
 *
 * Everything from v1 still works: setExpression, speak, stopSpeaking, setLevel, setViseme, setSpeaking,
 * isSpeaking, lookAt, idle, setShot, getShot, shots, on/off, pause/resume, advance, renderNow, debug, destroy.
 * Nothing outside this file touches meshes, morphs or materials.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, T = root.THREE, clamp = WA.clamp;

  WA.createAvatar = function (container, options) {
    options = options || {};
    if (!container || !container.appendChild) throw WA.AvatarError('BAD_CONTAINER', 'createAvatar needs a DOM element');
    if (!T) throw WA.AvatarError('NO_THREE', 'three.js is not loaded');
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;';
    container.appendChild(canvas);

    var renderer;
    try { renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
    catch (e) { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); throw WA.AvatarError('NO_WEBGL', 'WebGL is not available', e); }
    var quality = options.quality || 'high', fixedPR = options.pixelRatio > 0 ? +options.pixelRatio : 0, basePR = fixedPR || Math.min(root.devicePixelRatio || 1, quality === 'low' ? 1 : 2), prScale = 1;
    renderer.setPixelRatio(basePR);
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = quality !== 'low'; renderer.shadowMap.type = T.PCFSoftShadowMap;

    var scene = new T.Scene(), camera = new T.PerspectiveCamera(24, 1, 0.1, 200);
    var em = new WA.Emitter();
    var lighting = new WA.StudioLighting(renderer, scene, { style: options.style || 'conversation', quality: quality, backdrop: options.backdrop !== false });
    var adapter = new WA.AvatarAdapter(scene, renderer);
    var composer = new WA.ExpressionComposer({ context: options.context || 'conversation' });
    var anim = new WA.AnimationController(), gaze = new WA.GazeController(), lip = new WA.LipSyncController(), mixer = new WA.FaceMixer();
    var cam = new WA.CameraController(camera, canvas);
    var shotStyle = options.style || 'conversation';
    cam.setStyle(shotStyle, 0.01); cam.setShot(options.shot || 'CLOSE', { duration: 0.01, style: shotStyle });
    if (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) { anim.intensity = 0.4; cam.drift = 0.3; }

    function emit(name, data) { em.emit(name, data); }
    adapter.on('error', function (e) { emit('error', e); });
    adapter.on('warning', function (e) { emit('warning', e); });
    lip.on('warning', function (e) { emit('warning', e); });
    adapter.on('model', function (d) { cam.setLandmarks(d.landmarks, false); lighting.setLandmarks(d.landmarks); });
    adapter.on('failed', function () { if (adapter.model && adapter.model.getInfo().kind !== 'procedural') { emit('warning', WA.AvatarError('MODEL_FAILED', 'The model kept failing; switching to the procedural fallback')); api.loadAvatar({ source: 'procedural' }); } });

    var look = options.look === 'pointer' ? 'cursor' : (options.look || 'cursor'), pointer = { x: 0, y: 0 };
    gaze.setAim(look === 'manual' ? 'camera' : look);
    function onPointer(e) {
      var r = container.getBoundingClientRect();
      pointer.x = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1);
      pointer.y = clamp(-(e.clientY - (r.top + r.height * 0.35)) / (r.height / 2), -1, 1);
    }
    root.addEventListener('pointermove', onPointer);

    function resize() {
      var w = container.clientWidth, h = container.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); cam.setAspect(w / h);
    }
    var ro = root.ResizeObserver ? new root.ResizeObserver(resize) : null;
    if (ro) ro.observe(container); else root.addEventListener('resize', resize);
    resize();

    var running = !options.paused, visible = true, last = performance.now() / 1000, time = 0, raf = 0, destroyed = false, stepErrors = 0;
    var io = root.IntersectionObserver ? new root.IntersectionObserver(function (en) { visible = en[0].isIntersecting; }) : null;
    if (io) io.observe(container);
    var frameMs = 16, slowFor = 0, fastFor = 0, fps = 60, lastMixed = null, lastGaze = null, lipOut = null, comp = null, stepMs = 0;
    var autoState = options.autoState !== false, saved = null;

    /* ---------- one simulation step (separate from drawing, so tests and tools can advance time deterministically) ---------- */
    function step(dt) {
      var t0 = performance.now();
      time += dt;
      lipOut = lip.update(dt, time);
      comp = composer.update(dt, time, { speaking: lipOut.speaking, level: lipOut.level });
      var orbit = cam.update(dt, time), frame = cam.getFrame();
      var g = gaze.update(dt, time, { mode: comp.gaze, saccade: comp.saccade, attention: comp.attention, speaking: lipOut.speaking, emphasis: comp.emphasis, viewYaw: orbit, cursor: pointer, silence: lipOut.silence });
      var a = anim.update(dt, time, { head: comp.head, motion: comp.motion, nods: comp.nods, blinkScale: comp.blinkScale, gaze: { yaw: g.yaw, pitch: g.pitch, blink: g.blink },
        speaking: lipOut.speaking, activity: comp.act, emphasis: comp.emphasis, attention: comp.attention });
      var mixed = mixer.mix({ channels: comp.channels, blink: a.blink, gazePitch: g.pitch, visemes: lipOut.visemes, level: lipOut.level, speaking: lipOut.speaking, silence: lipOut.silence,
        t: time, dt: dt, nativeVisemes: adapter.hasNativeVisemes(), recipes: adapter.model && adapter.model.visemeRecipes || null });
      var pose = a.pose; pose.chest = clamp(pose.chest + mixer.breath * 0.6, 0, 1.4); pose.breath = clamp(pose.breath + mixer.breath * 0.3, 0, 1.4);
      adapter.setExpression(mixed); if (mixer.visOut) adapter.setViseme(mixer.visOut);
      adapter.setMouthLevel(lipOut.level); adapter.setEyeTarget(g.yaw, g.pitch, g.eyes);
      adapter.setHeadRotation(pose.headYaw, pose.headPitch, pose.headRoll); adapter.setBodyPose(pose);
      adapter.update(dt);
      lighting.setFocus(frame.y, Math.max(1.5, frame.vis * 0.62)); lighting.setBackdropYaw(orbit + frame.az); lighting.update(dt);
      if (adapter.model && adapter.model.setEnvIntensity) adapter.model.setEnvIntensity(lighting.envIntensity);
      lastMixed = mixed; lastGaze = g; stepMs += (performance.now() - t0 - stepMs) * 0.1;
      emit('tick', dt);
    }
    function draw() { renderer.render(scene, camera); }
    function frame() {
      if (destroyed) return;
      raf = root.requestAnimationFrame(frame);
      if (!running || !visible || document.hidden) { last = performance.now() / 1000; return; }
      var now = performance.now() / 1000, raw = now - last, dt = Math.min(0.05, raw); last = now;
      try { step(dt); draw(); stepErrors = 0; }
      catch (e) { stepErrors++; if (stepErrors === 1) emit('error', WA.AvatarError('FRAME_ERROR', 'Render loop error: ' + e.message, e)); if (stepErrors >= 5) { running = false; emit('fatal', e); } return; }
      frameMs += (raw * 1000 - frameMs) * 0.08; fps = 1000 / Math.max(1, frameMs);
      if (options.adaptive !== false) {            // adaptive resolution: protect the frame rate on weak GPUs
        if (frameMs > 26) { slowFor += raw; fastFor = 0; } else if (frameMs < 15) { fastFor += raw; slowFor = 0; } else { slowFor = fastFor = 0; }
        if (slowFor > 2 && prScale > 0.6) { prScale = Math.max(0.6, prScale - 0.15); renderer.setPixelRatio(basePR * prScale); resize(); slowFor = 0; emit('quality', { pixelRatio: basePR * prScale }); }
        else if (fastFor > 6 && prScale < 1) { prScale = Math.min(1, prScale + 0.15); renderer.setPixelRatio(basePR * prScale); resize(); fastFor = 0; emit('quality', { pixelRatio: basePR * prScale }); }
      }
    }
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); running = false; emit('contextlost'); });
    canvas.addEventListener('webglcontextrestored', function () { running = !options.paused; last = performance.now() / 1000; emit('contextrestored'); });

    /* ---------- speech helpers ---------- */
    function snapshot() { saved = { cog: composer.cog.name, mix: composer.expr.mix.map(function (m) { return { name: m.name, w: m.w }; }), override: composer.override }; }
    function restore() {
      if (!saved) return; var s = saved; saved = null;
      if (composer.cog.name !== 'SPEAKING') return;                       // the application took over meanwhile: leave it
      if (s.cog) composer.setCognitive(s.cog, time); else { composer.cog.clear(); composer.expr.setMix(s.mix); }
      emit('cognitive', composer.getCognitive());
    }

    var api = {
      /* ---------- expression ---------- */
      /* name: neutral listening thinking analyzing confident firm skeptical empathetic surprised concerned decisive (any case). opts: { intensity 0..1.2, transition } */
      setExpression: function (name, opts) { var ok = composer.setEmotion(String(name).toLowerCase(), opts); if (ok) emit('expression', composer.getEmotion()); else emit('warning', WA.AvatarError('UNKNOWN_EXPRESSION', 'Unknown expression "' + name + '". Known: ' + WA.ExpressionController.names.join(', '))); return ok; },
      getExpression: function () { return composer.getEmotion(); },
      expressions: WA.ExpressionController.names.slice(),

      /* name: LISTENING PROCESSING THINKING SPEAKING DECIDING WARNING EMPATHY CHALLENGE CONFIDENCE */
      setCognitiveState: function (name, opts) { if (name == null || name === '') { composer.cog.clear(); composer.override = false; composer.expr.setMix([{ name: 'neutral', w: 1 }]); saved = null; emit('cognitive', composer.getCognitive()); return true; } var ok = composer.setCognitive(name == null ? '' : String(name).toUpperCase(), time, opts); if (ok) { saved = null; emit('cognitive', composer.getCognitive()); emit('expression', composer.getEmotion()); } else emit('warning', WA.AvatarError('UNKNOWN_STATE', 'Unknown cognitive state "' + name + '". Known: ' + WA.CognitiveState.names.join(', '))); return ok; },
      getCognitiveState: function () { return composer.getCognitive(); },
      cognitiveStates: WA.CognitiveState.names.slice(),
      /* conversation | executive | intimate: how much the face shows and how much it moves */
      setContext: function (c) { var ok = composer.setContext(c); if (ok) emit('context', c); return ok; },
      contexts: Object.keys(WA.Contexts),
      setAttention: function (a) { composer.setAttention(a); },

      /* ---------- speech ---------- */
      /*
       * audio: AudioBuffer, Float32Array PCM, ArrayBuffer, Blob/File, HTMLAudioElement, MediaStream, URL, or null (timeline only).
       * opts: { visemes | phonemes | characters | alignment | marks, provider: 'azure'|'polly'|'phonemes'|..., offset, sampleRate }
       * Resolves when playback ends. Rejects with AvatarError (NO_SOURCE, DECODE_FAILED, PLAY_BLOCKED, ...).
       */
      speak: function (src, opts) {
        var cn = composer.cog.name;
        if (autoState && (!cn || /^(LISTENING|PROCESSING|THINKING)$/.test(cn))) { snapshot(); composer.setCognitive('SPEAKING', time); emit('cognitive', 'SPEAKING'); }
        adapter.setSpeaking(true); emit('speakstart', src);
        return lip.speak(src, opts).then(function () { adapter.setSpeaking(false); restore(); emit('speakend'); }, function (e) { adapter.setSpeaking(false); restore(); emit('speakend'); throw e; });
      },
      stopSpeaking: function () { lip.stop(); lip.setSyntheticSpeaking(false); adapter.setSpeaking(false); restore(); emit('speakend'); },
      pauseSpeech: function () { var ok = lip.pause(); if (ok) emit('speechpause'); return ok; },
      resumeSpeech: function () { var ok = lip.resume(); if (ok) emit('speechresume'); return ok; },
      isPaused: function () { return lip.paused; },
      setLevel: function (v) { lip.setLevel(v); },
      setViseme: function (name, weight) { lip.setViseme(name, weight); },
      setSpeaking: function (on) { lip.setSyntheticSpeaking(on); adapter.setSpeaking(on); if (on) emit('speakstart'); else emit('speakend'); },
      isSpeaking: function () { return lip.isSpeaking(); },

      /* ---------- gaze ---------- */
      /* 'camera' | 'cursor' ('pointer') | 'center' | 'left' | 'right' | 'down' | 'up' | x, y in -1..1 (screen space). left/right are screen directions. */
      lookAt: function (x, y) {
        if (x === 'pointer') x = 'cursor';
        if (x == null) x = 'camera';
        var ok = gaze.setAim(x, y); if (ok) emit('gaze', gaze.getAim()); return ok;
      },
      getGazeTarget: function () { return gaze.getAim(); },

      /* a one-off body gesture: 'nod' (a small acknowledging nod), 'blink'. Returns false for an unknown name. */
      gesture: function (name) { if (name === 'nod') { anim.nod.start = time; anim.nod.amp = 0.04; anim.nod.next = time + 5; return true; } if (name === 'blink') { var b = anim._b; if (b && b.start < 0) { b.start = time; b.dbl = false; b.second = false; } return true; } return false; },

      /* ---------- idle ---------- */
      idle: function (o) {
        if (o === false) o = { intensity: 0 }; o = o || {};
        if (o.intensity != null) { anim.intensity = clamp(o.intensity, 0, 1); cam.drift = anim.intensity; adapter.setIdle(anim.intensity); }
        if (o.blink != null) anim.blinkEnabled = !!o.blink;
      },

      /* ---------- camera and light ---------- */
      /* name: CLOSE | MEDIUM | FULL (also closeup, medium, full). o: { style: conversation|executive|intimate, duration } or a duration in seconds */
      setShot: function (name, o) { var ok = cam.setShot(name, o); if (ok) { if (o && o.style) { shotStyle = o.style; lighting.setStyle(o.style); } emit('shot', cam.shot); } return ok; },
      getShot: function () { return cam.shot; },
      shots: ['CLOSE', 'MEDIUM', 'FULL'],
      setCameraStyle: function (s, d) { var ok = cam.setStyle(s, d); if (ok) { shotStyle = s; lighting.setStyle(s); emit('style', s); } return ok; },
      getCameraStyle: function () { return cam.style; },
      styles: Object.keys(WA.CameraController.STYLES),
      setLighting: function (style) { return lighting.setStyle(style); },
      /* camera azimuth in radians, held until the user drags (0 front, 0.61 three-quarter, 1.571 profile) */
      setOrbit: function (rad, instant) { cam.setOrbit(rad, instant); },
      /* renders the current frame and returns it as a PNG data URL (same pixels as the canvas) */
      capture: function (type) { draw(); return canvas.toDataURL(type || 'image/png'); },
      setQuality: function (q) { var ok = lighting.setQuality(q); if (ok) { quality = q; basePR = fixedPR || Math.min(root.devicePixelRatio || 1, q === 'low' ? 1 : 2); renderer.setPixelRatio(basePR * prScale); renderer.shadowMap.enabled = q !== 'low'; resize(); } return ok; },

      /* ---------- model ---------- */
      /*
       * spec: { source: 'glb'|'procedural'|'auto', url | data | file, rigMap, fallback } or a url string.
       * Resolves { source, fallback, error, info, rigReport }. With fallback the promise does not reject: the procedural model is used and `error` says why.
       */
      loadAvatar: function (spec) {
        emit('loading', spec);
        var sp = typeof spec === 'string' ? { source: 'auto', url: spec } : WA.assign({}, spec || {}); if (!sp.renderer) sp.renderer = renderer; if (sp.ktx2Path == null && options.ktx2Path) sp.ktx2Path = options.ktx2Path;
        return WA.loadAvatar(sp).then(function (r) {
          if (destroyed) { try { r.model.dispose(); } catch (e) {} return r; }
          adapter.use(r.model);
          var res = { source: r.source, fallback: r.fallback, error: r.error, info: r.model.getInfo(), rigReport: r.model.getRigReport(), landmarks: r.model.getLandmarks() };
          if (r.error) emit('warning', r.error);
          emit('modelchange', res); return res;
        }, function (e) { emit('error', e); throw e; });
      },
      getModelInfo: function () { return adapter.getInfo(); },
      getRigReport: function () { return adapter.getRigReport(); },
      capabilities: function () { return adapter.caps; },
      get model() { return adapter.model; },

      /* ---------- events, loop, diagnostics ---------- */
      on: function (name, fn) { return em.on(name, fn); }, off: function (name, fn) { em.off(name, fn); },
      pause: function () { running = false; }, resume: function () { running = true; last = performance.now() / 1000; },
      /* advance the simulation by `seconds` in fixed 1/30 s steps and draw once. Deterministic: used by tests and offline rendering. */
      advance: function (seconds, noRender) { var n = Math.max(1, Math.round(seconds * 30)); for (var i = 0; i < n; i++) step(1 / 30); if (!noRender) draw(); },
      renderNow: function () { draw(); },
      /* read-only snapshot of what is on screen, useful for tests and debugging */
      debug: function () {
        return { channels: lastMixed ? JSON.parse(JSON.stringify(lastMixed)) : null, gaze: lastGaze ? { yaw: lastGaze.yaw, pitch: lastGaze.pitch, away: lastGaze.away, eyes: lastGaze.eyes } : null,
          pose: JSON.parse(JSON.stringify(anim.pose)), expression: composer.getEmotion(), cognitive: composer.getCognitive(), context: composer.context, shot: cam.shot, style: cam.style, frame: cam.getFrame(),
          speaking: lip.speaking, speech: lipOut ? { source: lipOut.source, level: lipOut.level, paused: lipOut.paused, time: lip.getTime() } : null, visemes: lipOut ? JSON.parse(JSON.stringify(lipOut.visemes)) : null,
          model: adapter.model ? adapter.model.getInfo().kind : null, time: time };
      },
      stats: function () {
        var i = renderer.info;
        return { fps: +fps.toFixed(1), frameMs: +frameMs.toFixed(1), stepMs: +stepMs.toFixed(2), modelUpdateMs: +adapter.updateMs.toFixed(2), pixelRatio: +(basePR * prScale).toFixed(2),
          triangles: i.render.triangles, drawCalls: i.render.calls, geometries: i.memory.geometries, textures: i.memory.textures, model: adapter.getInfo() };
      },
      destroy: function () {
        destroyed = true; running = false; root.cancelAnimationFrame(raf); root.removeEventListener('pointermove', onPointer);
        if (ro) ro.disconnect(); else root.removeEventListener('resize', resize);
        if (io) io.disconnect();
        lip.stop(); adapter.dispose(); lighting.dispose(); renderer.dispose(); if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      },
      version: WA.VERSION
    };

    raf = root.requestAnimationFrame(frame);
    // initial model: procedural by default, otherwise what the options ask for (a GLB falls back to procedural if it fails)
    var spec = options.avatar || { source: 'procedural' };
    api.ready = api.loadAvatar(spec).then(function (r) { step(1 / 60); emit('ready', r); return r; }, function (e) {
      return api.loadAvatar({ source: 'procedural' }).then(function (r) { r.error = e; emit('ready', r); return r; });
    });
    return api;
  };
})(typeof window !== 'undefined' ? window : globalThis);
