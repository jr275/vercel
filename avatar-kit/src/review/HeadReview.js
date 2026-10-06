/*
 * HeadReview: runs the standard review of ONE head candidate in a browser and returns a plain, serialisable result.
 *
 *   technical      the existing AssetValidator (not duplicated), phase "head"
 *   mapping        which morph targets drive the Bible expressions (HeadGate.mappingReport)
 *   shots          the 10 standard stills, under the single review configuration
 *   presence       the 1.5 second presence test: scripted cues, 6 frames, measured events
 *   speech         the standard sentence driven through the real engine, with stability metrics and viseme stills
 *   expression     the 10 review expressions: deformation, distinctness
 *   transitions    NEUTRAL>LISTENING>THINKING>FIRM>NEUTRAL and NEUTRAL>SKEPTICAL>SPEAKING>NEUTRAL
 *
 * Every part runs in its OWN fresh avatar, built from the same configuration (canvas, pixel ratio, camera, lighting, quality),
 * stepped with a fixed time step and never with the wall clock. Same file in, same pixels out.
 * Nothing here judges beauty: it produces stills and measurements, and says what only a person can decide.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, AV = WA.AssetValidator, HG = WA.HeadGate, CFG = HG.CONFIG, L = CFG.limits;

  function pct(a, p) { var s = a.slice().sort(function (x, y) { return x - y; }); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; }
  function jerk(series) {                                // p95 of the second difference, relative to the series peak (0 = perfectly smooth)
    var mx = Math.max.apply(null, series.concat([1e-9])), d = []; for (var i = 1; i < series.length - 1; i++) d.push(Math.abs(series[i + 1] - 2 * series[i] + series[i - 1]) / mx); return +pct(d, 0.95).toFixed(4);
  }
  function std(a) { if (!a.length) return 0; var m = a.reduce(function (x, y) { return x + y; }, 0) / a.length; return Math.sqrt(a.reduce(function (x, y) { return x + (y - m) * (y - m); }, 0) / a.length); }
  function isBlink(ch) { return !!ch && (ch.eyeBlinkLeft > 0.45 || ch.eyeBlinkRight > 0.45); }
  /* drops the frames of a blink (and one frame either side): a blink is the fastest legitimate motion of the face and must not read as popping or jerk */
  function noBlink(series, blinkMask) { var out = []; for (var i = 0; i < series.length; i++) if (!blinkMask[i] && !blinkMask[i - 1] && !blinkMask[i + 1]) out.push(series[i]); return out; }
  function settleNoBlink(av) { var k = 0; while (isBlink(av.debug().channels) && k++ < 30) av.advance(CFG.step, true); av.advance(0.1, true); }
  function imgHash(url) { return HG.hash(url); }

  /* a fresh avatar for one part of the review, built from the single configuration */
  function withAvatar(source, fn) {
    var box = document.createElement('div'); box.style.cssText = 'position:fixed;left:-30000px;top:0;width:' + CFG.canvas.width + 'px;height:' + CFG.canvas.height + 'px;pointer-events:none;'; document.body.appendChild(box);
    var av = WA.createAvatar(box, { paused: true, adaptive: false, quality: CFG.quality, pixelRatio: CFG.canvas.pixelRatio, shot: CFG.camera.shot, style: CFG.camera.style, look: CFG.camera.look, autoState: false,
      avatar: { source: 'glb', data: source.data.slice(0), rigMap: source.rigMap, fallback: false } });
    function done() { try { av.destroy(); } catch (e) {} if (box.parentNode) box.parentNode.removeChild(box); }
    return av.ready.then(function (r) {
      if (!av.model || av.getModelInfo().kind !== 'glb') throw (r && r.error) || WA.AvatarError('REVIEW_NEEDS_GLB', 'The candidate did not load as a GLB');
      if (source.prepare) source.prepare(av);   // test seam: lets a test damage the loaded model
      av.setLighting(CFG.lighting); av.lookAt('camera'); av.advance(3, true);
      return Promise.resolve(fn(av)).then(function (v) { done(); return v; }, function (e) { done(); throw e; });
    });
  }
  function drive(av, d) {
    if (d.state) av.setCognitiveState(d.state);
    if (d.expression) av.setExpression(d.expression, d.intensity == null ? undefined : { intensity: d.intensity });
  }
  function toBase(av, orbit, gaze) {
    av.stopSpeaking(); av.setCameraStyle(CFG.camera.style, 0.01); av.setShot(CFG.camera.shot, { style: CFG.camera.style, duration: 0.01 }); av.setLighting(CFG.lighting);
    av.setOrbit(CFG.orbit[orbit || 'front'], true); av.lookAt(gaze || 'camera');
  }
  function field(av, cache) { var f = AV.currentField(av.model, cache); return f ? { f: f, m: AV.fieldMetrics(av.model, f) } : null; }
  function eyeYaw(model) {
    var T = root.THREE, B = model.bones, v = new T.Vector3(), out = {};
    ['leftEye', 'rightEye'].forEach(function (s) { var b = B[s]; if (!b) return; b.obj.updateWorldMatrix(true, false); v.set(0, 0, 1).transformDirection(b.obj.matrixWorld); out[s] = Math.atan2(v.x, v.z); });
    return out.leftEye != null && out.rightEye != null ? out : null;
  }

  /* ---------------- shots ---------------- */
  function runShots(source, spec) {
    var info = WA.SpeechScript.info(), times = WA.SpeechScript.stillTimes();
    return withAvatar(source, function (av) {
      var out = [];
      CFG.shots.forEach(function (sh) {
        if (sh.kind === 'presence') return;
        toBase(av, sh.orbit, sh.gaze);
        if (sh.kind === 'pose') {
          drive(av, sh.pose); av.advance(CFG.settle, true);
          if (sh.waitFor === 'gazeAway') { var k = 0; while (!av.debug().gaze.away && k++ < 30 * 25) av.advance(CFG.step, true); av.advance(0.4, true); }
        } else {
          av.setCognitiveState('LISTENING'); av.advance(2, true);
          if (sh.framing) { av.setCameraStyle(sh.framing, 0.01); av.setLighting(CFG.lighting); av.advance(3, true); }
          av.speak(null, { phonemes: info.events, provider: 'phonemes' }).catch(function () {});
          var t0 = times[sh.still], n = Math.round(t0 * 30); for (var i = 0; i < n; i++) av.advance(CFG.step, true);
        }
        var url = av.capture(); out.push({ id: sh.id, width: CFG.canvas.width, height: CFG.canvas.height, hash: imgHash(url), dataUrl: spec.keepImages === false ? null : url });
        av.stopSpeaking();
      });
      return out;
    });
  }

  /* ---------------- 1.5 second presence test ---------------- */
  function runPresence(source, spec) {
    var P = CFG.presence;
    return withAvatar(source, function (av) {
      toBase(av, 'front', 'camera'); av.setExpression('neutral'); av.advance(4, true);
      // the clip starts so that the engine's breath inhale begins exactly at the 0.6 s cue (the breath cycle is deterministic)
      var T0 = Math.ceil((av.debug().time + 0.6) / P.breathPeriod) * P.breathPeriod - 0.6, k = Math.round((T0 - av.debug().time) * 30); for (var i = 0; i < k; i++) av.advance(CFG.step, true);
      var cache = {}, frames = [], series = [], cues = [0, 9, 18, 27, 36, 45], base = field(av, cache);
      for (var s = 0; s <= 45; s++) {
        if (s === 9) av.lookAt(P.microEye.x, P.microEye.y);
        if (s === 27) av.setExpression(P.microFace.expression, { intensity: P.microFace.intensity });
        if (s === 36) av.lookAt('camera');
        var d = av.debug(), fm = field(av, cache);
        series.push({ blink: isBlink(d.channels), s: s, t: +(s / 30).toFixed(3), yaw: d.gaze.yaw, pitch: d.gaze.pitch, breath: d.pose.breath, head: [d.pose.headYaw, d.pose.headPitch, d.pose.headRoll], rms: fm ? fm.m.rms : 0, max: fm ? fm.m.max : 0 });
        if (cues.indexOf(s) >= 0) { var url = av.capture(); frames.push({ t: +(s / 30).toFixed(1), cue: P.cues[cues.indexOf(s)].what, hash: imgHash(url), dataUrl: spec.keepImages === false ? null : url }); }
        if (s < 45) av.advance(CFG.step, true);
      }
      var at = function (t) { return series[Math.round(t * 30)]; }, atNB = function (t) { var i = Math.round(t * 30); for (var j = 0; j < 8; j++) { if (series[i + j] && !series[i + j].blink) return series[i + j]; if (series[i - j] && !series[i - j].blink) return series[i - j]; } return series[i]; }, eyeMove = Math.hypot(at(0.6).yaw - at(0.3).yaw, at(0.6).pitch - at(0.3).pitch) + Math.hypot(at(0.3).yaw - at(0.0).yaw, at(0.3).pitch - at(0.0).pitch);
      var breathRise = at(1.2).breath - at(0.6).breath, change = Math.abs(atNB(1.5).rms - atNB(0.9).rms), tail = series.slice(36), headMotion = Math.max.apply(null, series.map(function (x) { return Math.max(Math.abs(x.head[0] - series[0].head[0]), Math.abs(x.head[1] - series[0].head[1]), Math.abs(x.head[2] - series[0].head[2])); }));
      var m = { eyeMove: +eyeMove.toFixed(4), eyeMoveDetected: eyeMove >= L.microEyeMin, breathRise: +breathRise.toFixed(3), breathDetected: breathRise >= L.breathMin, faceChange: +change.toFixed(5), faceChangeInRange: change >= L.faceChange[0] && change <= L.faceChange[1],
        eyeStableAtEnd: std(tail.map(function (x) { return x.yaw; })) <= L.eyeStableStd && std(tail.map(function (x) { return x.pitch; })) <= L.eyeStableStd, headMotion: +headMotion.toFixed(4), fidget: headMotion > L.fidgetMax };
      return { seconds: P.seconds, cues: P.cues, frames: frames, series: series.filter(function (x) { return x.s % 3 === 0; }), metrics: m, questions: P.questions, humanReview: 'REQUIRED: the observer answers A, B and C' };
    });
  }

  /* ---------------- speech test ---------------- */
  function runSpeech(source, spec) {
    var info = WA.SpeechScript.info(), still = WA.SpeechScript.stillTimes();
    return withAvatar(source, function (av) {
      toBase(av, 'front', 'camera'); av.setCognitiveState('LISTENING'); av.advance(3, true);
      var cache = {}, fr = [], blinkMask = [], stills = [], seenV = {}, n = Math.ceil(info.seconds * 30) + 12, model = av.model, wantStill = Object.keys(still).map(function (v) { return { v: v, i: Math.round(still[v] * 30) }; });
      av.speak(null, { phonemes: info.events, provider: 'phonemes' }).catch(function () {});
      for (var i = 0; i < n; i++) {
        av.advance(CFG.step, true); var d = av.debug(), fm = field(av, cache), ey = eyeYaw(model);
        Object.keys(d.visemes || {}).forEach(function (v) { if (d.visemes[v] > 0.5) seenV[v] = (seenV[v] || 0) + 1; });
        blinkMask.push(isBlink(d.channels)); fr.push({ t: (i + 1) / 30, lower: fm ? fm.m.lower : 0, mid: fm ? fm.m.mid : 0, upper: fm ? fm.m.upper : 0, peak: fm ? fm.m.max : 0, rms: fm ? fm.m.rms : 0, jaw: d.channels.jawOpen, yawL: ey ? ey.leftEye : null, yawR: ey ? ey.rightEye : null });
        wantStill.forEach(function (w) { if (w.i === i + 1) { var url = av.capture(); stills.push({ id: w.v, t: +((i + 1) / 30).toFixed(2), hash: imgHash(url), dataUrl: spec.keepImages === false ? null : url }); } });
      }
      av.stopSpeaking();
      var lower = fr.map(function (x) { return x.lower; }), peak = Math.max.apply(null, noBlink(fr, blinkMask).map(function (x) { return x.peak; })), lowerNB = noBlink(lower, blinkMask), midNB = noBlink(fr.map(function (x) { return x.mid; }), blinkMask), jawNB = noBlink(fr.map(function (x) { return x.jaw; }), blinkMask);
      // mouth movements: peaks of the lower-face displacement that stand out from the valleys on either side (about one per syllable nucleus)
      var mx = Math.max.apply(null, lower), cycles = 0; for (var q = 3; q < lower.length - 3; q++) { var v0 = lower[q]; if (v0 >= lower[q - 1] && v0 > lower[q + 1]) { var lo1 = Math.min.apply(null, lower.slice(Math.max(0, q - 8), q)), lo2 = Math.min.apply(null, lower.slice(q, Math.min(lower.length, q + 9))); if (v0 - Math.max(lo1, lo2) >= 0.12 * mx) cycles++; } }
      var at = function (e) { return Math.min(fr.length - 1, Math.round((e.t + e.d * 0.6) * 30)); }, clos = info.events.filter(function (e) { return e.ph === 'P' || e.ph === 'B' || e.ph === 'M'; }), opn = info.events.filter(function (e) { return e.ph === 'AE' || e.ph === 'AA' || e.ph === 'AO'; });
      var avg = function (es) { return es.length ? es.reduce(function (a, e) { return a + fr[at(e)].jaw; }, 0) / es.length : 0; }, contrast = avg(opn) > 1e-6 ? avg(clos) / avg(opn) : 1;
      var align = fr.filter(function (x) { return x.yawL != null; }).map(function (x) { return Math.abs(x.yawL - x.yawR); }), eyeAlign = align.length ? Math.max.apply(null, align) : null;
      var missingV = info.requiredVisemes.filter(function (v) { return !seenV[v]; });
      var m = { frames: fr.length, seconds: info.seconds, syllables: info.syllables, cycles: cycles, cyclesPerSyllable: +(cycles / info.syllables).toFixed(2), jerkJaw: jerk(lowerNB), jerkCheeks: jerk(midNB), jerkChin: jerk(jawNB), closureContrast: +contrast.toFixed(2), eyeAlignMax: eyeAlign == null ? null : +eyeAlign.toFixed(3),
        peakDisplacement: +peak.toFixed(4), faceLife: +std(noBlink(fr, blinkMask).map(function (x) { return x.mid + x.upper; })).toExponential(2), visemesNotReached: missingV };
      var flags = [];
      if (cycles / info.syllables < L.cyclesPerSyllable[0]) flags.push('no mouth movement: ' + cycles + ' mouth cycles for ' + info.syllables + ' syllables'); else if (cycles / info.syllables > L.cyclesPerSyllable[1]) flags.push('jerk: frantic mouth (' + m.cyclesPerSyllable + ' cycles per syllable)');
      if (m.jerkJaw > L.jerkP95) flags.push('jerk: jaw/lower face (p95 ' + m.jerkJaw + ')'); if (m.jerkCheeks > L.jerkP95) flags.push('jerk: cheeks (p95 ' + m.jerkCheeks + ')'); if (m.jerkChin > L.jerkP95) flags.push('jerk: chin (p95 ' + m.jerkChin + ')');
      if (contrast > L.closureContrast) flags.push('closures do not close: jaw at p/b/m is ' + Math.round(contrast * 100) + '% of the open vowels (limit ' + L.closureContrast * 100 + '%)');
      if (eyeAlign != null && eyeAlign > L.eyeAlign) flags.push('eyes misaligned while speaking (' + eyeAlign.toFixed(3) + ' rad)');
      if (peak > L.speechPeak) flags.push('deformation: peak ' + peak.toFixed(3) + ' of head height (limit ' + L.speechPeak + ')');
      if (std(noBlink(fr, blinkMask).map(function (x) { return x.mid + x.upper; })) < 2e-5) flags.push('frozen face: no movement outside the mouth while speaking');
      if (missingV.length) flags.push('visemes never reached: ' + missingV.join(', '));
      return { script: { text: info.text, seconds: info.seconds, syllables: info.syllables, requiredVisemes: info.requiredVisemes }, metrics: m, flags: flags, stills: stills, series: fr.filter(function (x, i) { return i % 3 === 0; }).map(function (x) { return { t: +x.t.toFixed(2), lower: +x.lower.toFixed(5), jaw: +(x.jaw || 0).toFixed(3) }; }),
        checklist: HG.SPEECH_ITEMS.map(function (k) { return { id: k, label: HG.SPEECH_LABELS[k] }; }), humanReview: 'REQUIRED: the 12 speech checklist items' };
    });
  }

  /* ---------------- expressions ---------------- */
  function runExpressions(source, spec) {
    return withAvatar(source, function (av) {
      var cache = {}, rows = [], fields = {}, sc;
      toBase(av, 'front', 'camera'); av.setExpression('neutral'); av.advance(4, true); settleNoBlink(av); var n0 = field(av, cache); sc = AV.worldScale(n0.f.mesh) / av.model.landmarks.headHeight;
      HG.REVIEW_EXPRESSIONS.forEach(function (e) {
        toBase(av, 'front', 'camera'); drive(av, e.drive); av.advance(CFG.settle, true); settleNoBlink(av); var fm = field(av, cache), d = av.debug(), url = av.capture(); fields[e.id] = fm.f.field;
        rows.push({ id: e.id, rms: +fm.m.rms.toFixed(5), max: +fm.m.max.toFixed(4), upper: +fm.m.upper.toFixed(5), mid: +fm.m.mid.toFixed(5), lower: +fm.m.lower.toFixed(5), asym: +fm.m.asym.toFixed(2), fromNeutral: +(AV.fieldDistance(fm.f.field, n0.f.field) * sc).toFixed(5), channels: d.channels && Object.keys(d.channels).filter(function (k) { return d.channels[k] > 0.15; }).length,
          hash: imgHash(url), dataUrl: spec.keepImages === false ? null : url });
      });
      rows.forEach(function (r) { var best = null; Object.keys(fields).forEach(function (o) { if (o === r.id) return; var other = HG.REVIEW_EXPRESSIONS.filter(function (e) { return e.id === o; })[0], mine = HG.REVIEW_EXPRESSIONS.filter(function (e) { return e.id === r.id; })[0]; if (JSON.stringify(other.drive) === JSON.stringify(mine.drive)) return; var dist = AV.fieldDistance(fields[r.id], fields[o]) * sc; if (!best || dist < best.d) best = { to: o, d: dist }; }); r.nearest = best ? best.to : null; r.nearestDist = best ? +best.d.toFixed(5) : null; r.drive = JSON.stringify(HG.REVIEW_EXPRESSIONS.filter(function (e) { return e.id === r.id; })[0].drive); r.dead = r.fromNeutral < 0.0003; r.exploding = r.max > L.exploding; r.overBudget = r.max > L.expressionPeak; });
      var sk = rows.filter(function (r) { return r.id === 'skeptical'; })[0];
      return { rows: rows, maxPeak: Math.max.apply(null, rows.map(function (r) { return r.max; })), skepticalAsym: sk ? sk.asym : null, dead: rows.filter(function (r) { return r.dead; }).map(function (r) { return r.id; }), exploding: rows.filter(function (r) { return r.exploding; }).map(function (r) { return r.id; }),
        overBudget: rows.filter(function (r) { return r.overBudget; }).map(function (r) { return r.id; }), indistinct: rows.filter(function (r) { var o = rows.filter(function (x) { return x.id === r.nearest; })[0]; return o && o.drive !== r.drive && r.nearestDist < 0.15 * Math.min(r.fromNeutral, o.fromNeutral); }).map(function (r) { return r.id + '~' + r.nearest; }), humanReview: 'REQUIRED: legibility of each expression, X1 one face, X3 asymmetry in the render' };
    });
  }

  /* ---------------- transitions ---------------- */
  function runTransitions(source) {
    var info = WA.SpeechScript.info();
    function sequence(av, name, steps) {
      var cache = {}, series = [], marks = [], sc = null, steady = [];
      toBase(av, 'front', 'camera'); av.setExpression('neutral'); av.advance(4, true);
      steps.forEach(function (st) {
        marks.push({ at: series.length, name: st.name });
        if (st.drive) drive(av, st.drive); if (st.speak) av.speak(null, { phonemes: info.events, provider: 'phonemes' }).catch(function () {});
        var n = Math.round(st.seconds * 30);
        for (var i = 0; i < n; i++) {
          av.advance(CFG.step, true); var fm = field(av, cache), d = av.debug(), ey = eyeYaw(av.model); sc = sc || AV.worldScale(fm.f.mesh) / av.model.landmarks.headHeight;
          series.push({ blink: isBlink(d.ch || d.channels), field: fm.f.field.slice(), rms: fm.m.rms, max: fm.m.max, lower: fm.m.lower, name: st.name, jaw: d.channels.jawOpen, ch: d.channels, yawL: ey && ey.leftEye, yawR: ey && ey.rightEye });
        }
        steady.push(series[series.length - 1]);
        if (st.speak) av.stopSpeaking();
      });
      var step = 0, stepS = 0, chStep = 0, peak = 0, peakS = 0, rmsMax = 0, ok = series.filter(function (x) { return !x.blink; }), calm = ok.filter(function (x) { return x.name !== 'SPEAKING'; }), talk = ok.filter(function (x) { return x.name === 'SPEAKING'; });
      for (var i = 1; i < series.length; i++) {
        if (series[i].blink || series[i - 1].blink) continue;                       // a blink is not a transition
        var a = series[i - 1].field, b = series[i].field, mx = 0; for (var k = 0; k < a.length; k += 3) { var dx = b[k] - a[k], dy = b[k + 1] - a[k + 1], dz = b[k + 2] - a[k + 2], dd = dx * dx + dy * dy + dz * dz; if (dd > mx) mx = dd; }
        var d1 = Math.sqrt(mx) * sc; if (series[i].name === 'SPEAKING') stepS = Math.max(stepS, d1); else step = Math.max(step, d1);
        Object.keys(series[i].ch).forEach(function (c) { if (!/Blink/.test(c)) chStep = Math.max(chStep, Math.abs(series[i].ch[c] - series[i - 1].ch[c])); });
      }
      calm.forEach(function (x) { peak = Math.max(peak, x.max); }); talk.forEach(function (x) { peakS = Math.max(peakS, x.max); }); ok.forEach(function (x) { rmsMax = Math.max(rmsMax, x.rms); });
      var steadyPeak = Math.max.apply(null, steady.filter(function (x) { return !x.blink && x.name !== 'SPEAKING'; }).map(function (x) { return x.max; })), excess = steadyPeak > 1e-9 ? peak / steadyPeak : 1;
      // information only: the engine adds micro-expressions, so the end of the sequence is never bit-identical to its start
      var avgField = function (from, to) { var acc = new Float32Array(series[0].field.length), n = 0; for (var q = from; q < to; q++) if (!series[q].blink) { for (var z = 0; z < acc.length; z++) acc[z] += series[q].field[z]; n++; } for (var y = 0; y < acc.length; y++) acc[y] /= Math.max(1, n); return acc; };
      var drift = AV.fieldDistance(avgField(series.length - 15, series.length), avgField(0, 15)) * sc / Math.max(rmsMax, 1e-9);
      var al = series.filter(function (x) { return x.yawL != null; }).map(function (x) { return Math.abs(x.yawL - x.yawR); }), speakSeries = talk.map(function (x) { return x.lower; });
      var m = { frames: series.length, blinkFrames: series.length - ok.length, maxVertexStep: +step.toFixed(5), maxVertexStepSpeech: talk.length ? +stepS.toFixed(5) : null, maxChannelStep: +chStep.toFixed(4), peak: +peak.toFixed(4), peakSpeech: talk.length ? +peakS.toFixed(4) : null, combinationExcess: +excess.toFixed(2), neutralDrift: +drift.toFixed(3), eyeAlignMax: al.length ? +Math.max.apply(null, al).toFixed(3) : null, jawJerk: speakSeries.length > 5 ? jerk(speakSeries) : null };
      var flags = [];
      if (m.maxVertexStep > L.vertexStep) flags.push('popping or snapping: a vertex moves ' + m.maxVertexStep + ' of head height in one frame between expressions (limit ' + L.vertexStep + ')');
      if (m.maxVertexStepSpeech != null && m.maxVertexStepSpeech > L.speechStep) flags.push('popping or snapping while speaking: a vertex moves ' + m.maxVertexStepSpeech + ' of head height in one frame (limit ' + L.speechStep + ')');
      if (m.combinationExcess > L.combinationExcess) flags.push('overshoot: the combined targets exceed the strongest steady state by ' + Math.round((m.combinationExcess - 1) * 100) + '%');
      if (m.peak > L.expressionPeak) flags.push('deformation: peak ' + m.peak + ' of head height between expressions (limit ' + L.expressionPeak + ')');
      if (m.peakSpeech != null && m.peakSpeech > L.speechPeak) flags.push('deformation while speaking: peak ' + m.peakSpeech + ' (limit ' + L.speechPeak + ')');
      if (m.eyeAlignMax != null && m.eyeAlignMax > L.eyeAlign) flags.push('eyes misaligned (' + m.eyeAlignMax + ' rad)');
      if (m.jawJerk != null && m.jawJerk > L.jerkP95) flags.push('artificial jaw: jerky while speaking (p95 ' + m.jawJerk + ')');
      return { name: name, steps: steps.map(function (s) { return s.name + ' ' + s.seconds + 's'; }), metrics: m, flags: flags };
    }
    var A = [{ name: 'NEUTRAL', seconds: 1, drive: { expression: 'neutral' } }, { name: 'LISTENING', seconds: 2.5, drive: { state: 'LISTENING' } }, { name: 'THINKING', seconds: 2.5, drive: { state: 'THINKING' } }, { name: 'FIRM', seconds: 2.5, drive: { expression: 'firm' } }, { name: 'NEUTRAL', seconds: 3, drive: { expression: 'neutral' } }];
    var B = [{ name: 'NEUTRAL', seconds: 1, drive: { expression: 'neutral' } }, { name: 'SKEPTICAL', seconds: 2.5, drive: { expression: 'skeptical' } }, { name: 'SPEAKING', seconds: 4.5, speak: true }, { name: 'NEUTRAL', seconds: 3, drive: { expression: 'neutral' } }];
    return withAvatar(source, function (av) { return sequence(av, 'A', A); }).then(function (a) { return withAvatar(source, function (av) { return sequence(av, 'B', B); }).then(function (b) {
      var flags = a.flags.map(function (f) { return 'A: ' + f; }).concat(b.flags.map(function (f) { return 'B: ' + f; }));
      return { A: a, B: b, flags: flags, humanReview: 'REQUIRED: loss of identity, excessive change of appearance, artificial jaw (look at the stills and the video)' };
    }); });
  }

  /* ---------------- the whole review ---------------- */
  /*
   * source: { id, version, sha256, data: ArrayBuffer, rigMap }.  opts: { keepImages (default true), fps (default true), onProgress }
   * Returns the automated review, ready for HeadGate.attachReview().
   */
  function run(source, opts) {
    opts = opts || {}; var say = opts.onProgress || function () {}, out = { schema: 1, configHash: HG.configHash(), candidate: { id: source.id, version: source.version || 1, sha256: source.sha256 }, generatedAt: new Date().toISOString(), renderer: AV.gpuInfo(), software: null };
    out.software = out.renderer.software;
    say('technical validation');
    return withAvatar(source, function (av) {
      var rep = null; return AV.runAll(av, { phase: 'head', fps: opts.fps !== false, fpsSeconds: 2 }).then(function (r) { out.validator = AV.serialize({ report: r.report, result: r.result }); out.mapping = HG.mappingReport(av.model.res); var names = {}; av.model.meshes.forEach(function (m) { Object.keys(m.morphTargetDictionary || {}).forEach(function (k) { names[k] = 1; }); }); out.file = { bytes: av.model.bytes || null, loadMs: av.model.loadMs || null, morphNames: Object.keys(names).sort() }; });
    }).then(function () { say('standard shots'); return runShots(source, opts); })
      .then(function (s) { out.shots = s; say('presence test'); return runPresence(source, opts); })
      .then(function (p) { out.presence = p; say('speech test'); return runSpeech(source, opts); })
      .then(function (s) { out.speech = s; say('expressions'); return runExpressions(source, opts); })
      .then(function (e) { out.expression = e; say('transitions'); return runTransitions(source); })
      .then(function (t) { out.transitions = t; say('done'); return out; });
  }

  WA.HeadReview = { run: run, runShots: runShots, runPresence: runPresence, runSpeech: runSpeech, runExpressions: runExpressions, runTransitions: runTransitions, withAvatar: withAvatar, jerk: jerk };
})(typeof window !== 'undefined' ? window : globalThis);
