/*
 * ExpressionController: the emotion vocabulary, expressed in canonical face channels.
 *
 * Each emotion is a small set of ARKit channels plus a head/gaze bias. Differences between emotions
 * live in brows, lids, mouth corners and head angle, never in big movements. A "mix" of several
 * emotions is a weighted sum, so WARNING can be firm with a trace of concern.
 *
 * This class holds the CURRENT emotion and its micro-expressions. It does not smooth anything:
 * ExpressionComposer owns the time behaviour, so every transition passes through one place.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, clamp = WA.clamp;

  // relaxed baseline: lids slightly lowered, lips almost together, a trace of a smile
  var BASE = { eyeBlinkLeft: 0.12, eyeBlinkRight: 0.12, mouthSmileLeft: 0.06, mouthSmileRight: 0.06, mouthPressLeft: 0.1, mouthPressRight: 0.1 };

  // head: yaw, pitch (+ chin down), roll (+ toward screen right), in radians. motion/saccade scale idle life.
  // gaze: direct | attend | think | scan | glance | speak | hold
  var EMOTIONS = {
    neutral: { face: {}, head: {}, motion: 1, saccade: 1, gaze: 'attend' },
    listening: { face: { browInnerUp: 0.25, browOuterUpLeft: 0.06, browOuterUpRight: 0.06, eyeBlinkLeft: 0.06, eyeBlinkRight: 0.06, mouthSmileLeft: 0.12, mouthSmileRight: 0.12, mouthPressLeft: 0.04, mouthPressRight: 0.04, eyeWideLeft: 0.06, eyeWideRight: 0.06 },
      head: { roll: 0.075, pitch: -0.01 }, motion: 1, saccade: 0.7, gaze: 'attend', nods: 1 },
    thinking: { face: { browInnerUp: 0.12, browOuterUpLeft: 0.22, browDownRight: 0.08, eyeBlinkLeft: 0.1, eyeBlinkRight: 0.14, eyeSquintRight: 0.08, mouthSmileLeft: 0, mouthSmileRight: 0.02, mouthPressLeft: 0.18, mouthPressRight: 0.12, mouthShrugLower: 0.12, mouthLeft: 0.12 },
      head: { pitch: 0.035, roll: 0.035, yaw: 0.05 }, motion: 0.75, saccade: 0.9, gaze: 'think' },
    analyzing: { face: { browDownLeft: 0.38, browDownRight: 0.38, browOuterUpLeft: 0.1, browOuterUpRight: 0.1, eyeBlinkLeft: 0.08, eyeBlinkRight: 0.08, eyeSquintLeft: 0.24, eyeSquintRight: 0.24, mouthSmileLeft: 0, mouthSmileRight: 0, mouthPressLeft: 0.4, mouthPressRight: 0.4, jawClench: 0.15 },
      head: { pitch: 0.03, roll: 0.01 }, motion: 0.7, saccade: 1.1, gaze: 'scan' },
    confident: { face: { browOuterUpLeft: 0.06, browOuterUpRight: 0.06, eyeBlinkLeft: 0.1, eyeBlinkRight: 0.1, mouthSmileLeft: 0.4, mouthSmileRight: 0.4, cheekSquintLeft: 0.2, cheekSquintRight: 0.2, mouthPressLeft: 0, mouthPressRight: 0, mouthStretchLeft: 0.06, mouthStretchRight: 0.06 },
      head: { pitch: -0.02 }, motion: 0.6, saccade: 0.4, gaze: 'direct' },
    firm: { face: { browDownLeft: 0.3, browDownRight: 0.3, browInnerUp: 0, eyeBlinkLeft: 0.1, eyeBlinkRight: 0.1, eyeSquintLeft: 0.12, eyeSquintRight: 0.12, mouthSmileLeft: 0, mouthSmileRight: 0, mouthPressLeft: 0.6, mouthPressRight: 0.6, mouthRollLower: 0.1, jawClench: 0.65 },
      head: { pitch: 0.045 }, motion: 0.3, saccade: 0.25, gaze: 'hold' },
    skeptical: { face: { browOuterUpLeft: 0.78, browInnerUp: 0.05, browDownRight: 0.24, eyeBlinkLeft: 0.06, eyeBlinkRight: 0.18, eyeSquintRight: 0.3, mouthSmileLeft: 0, mouthSmileRight: 0.24, mouthPressLeft: 0.3, mouthPressRight: 0.3, mouthLeft: 0.1, cheekSquintRight: 0.12 },
      head: { roll: -0.05, yaw: 0.025 }, motion: 0.7, saccade: 0.6, gaze: 'glance' },
    empathetic: { face: { browInnerUp: 0.55, browDownLeft: 0.04, browDownRight: 0.04, browOuterUpLeft: 0.1, browOuterUpRight: 0.1, eyeBlinkLeft: 0.08, eyeBlinkRight: 0.08, mouthSmileLeft: 0.3, mouthSmileRight: 0.3, cheekSquintLeft: 0.15, cheekSquintRight: 0.15, mouthPressLeft: 0, mouthPressRight: 0 },
      head: { roll: 0.06, pitch: -0.012 }, motion: 0.85, saccade: 0.6, gaze: 'attend', nods: 0.6 },
    surprised: { face: { browInnerUp: 0.55, browOuterUpLeft: 0.5, browOuterUpRight: 0.5, eyeWideLeft: 0.8, eyeWideRight: 0.8, eyeBlinkLeft: 0, eyeBlinkRight: 0, jawOpen: 0.1, mouthPressLeft: 0, mouthPressRight: 0, mouthSmileLeft: 0, mouthSmileRight: 0 },
      head: { pitch: -0.025 }, motion: 0.8, saccade: 0.5, gaze: 'direct' },
    concerned: { face: { browInnerUp: 0.6, browDownLeft: 0.12, browDownRight: 0.12, eyeSquintLeft: 0.1, eyeSquintRight: 0.1, eyeBlinkLeft: 0.1, eyeBlinkRight: 0.1, mouthFrownLeft: 0.22, mouthFrownRight: 0.22, mouthPressLeft: 0.15, mouthPressRight: 0.15, mouthSmileLeft: 0, mouthSmileRight: 0 },
      head: { roll: 0.04, pitch: 0.02 }, motion: 0.7, saccade: 0.6, gaze: 'attend', nods: 0.4 },
    decisive: { face: { browDownLeft: 0.16, browDownRight: 0.16, eyeBlinkLeft: 0.1, eyeBlinkRight: 0.1, eyeSquintLeft: 0.08, eyeSquintRight: 0.08, mouthPressLeft: 0.35, mouthPressRight: 0.35, mouthSmileLeft: 0, mouthSmileRight: 0, jawClench: 0.3, mouthShrugLower: 0.08 },
      head: { pitch: 0.035 }, motion: 0.25, saccade: 0.15, gaze: 'hold' }
  };
  var NAMES = Object.keys(EMOTIONS);

  function ExpressionController(seed) {
    this.name = 'neutral'; this.intensity = 1;
    this.mix = [{ name: 'neutral', w: 1 }];
    this.rand = WA.rng(seed || 404); this.nextMicro = 4; this.micro = null;
  }
  ExpressionController.names = NAMES;
  ExpressionController.EMOTIONS = EMOTIONS;
  ExpressionController.BASE = BASE;

  /* opts.intensity 0..1.2. Returns false for an unknown emotion (nothing changes). */
  ExpressionController.prototype.set = function (name, opts) {
    name = String(name).toLowerCase();
    if (!EMOTIONS[name]) return false;
    opts = opts || {};
    this.name = name; this.intensity = opts.intensity == null ? 1 : clamp(opts.intensity, 0, 1.2);
    this.mix = [{ name: name, w: this.intensity }];
    return true;
  };
  /* Several emotions at once: [{ name, w }]. The first is reported as the current emotion. */
  ExpressionController.prototype.setMix = function (list) {
    var ok = (list || []).filter(function (m) { return EMOTIONS[m.name]; });
    if (!ok.length) return false;
    this.mix = ok.map(function (m) { return { name: m.name, w: clamp(m.w == null ? 1 : m.w, 0, 1.2) }; });
    this.name = ok[0].name; this.intensity = this.mix[0].w; return true;
  };

  /* Sums the active emotions on top of the baseline. Writes into `face`, returns { motion, saccade, gaze, nods, head }. */
  ExpressionController.prototype.target = function (face, head) {
    var k, i, m, E, w, tw = 0, motion = 0, sacc = 0, nods = 0;
    for (k in face) face[k] = 0;
    for (k in BASE) face[k] = BASE[k];
    head.yaw = head.pitch = head.roll = 0;
    for (i = 0; i < this.mix.length; i++) {
      m = this.mix[i]; E = EMOTIONS[m.name]; w = m.w; tw += Math.min(1, w);
      for (k in E.face) face[k] = (face[k] || 0) + (E.face[k] - (BASE[k] || 0)) * w;
      head.yaw += (E.head.yaw || 0) * w; head.pitch += (E.head.pitch || 0) * w; head.roll += (E.head.roll || 0) * w;
      motion += E.motion * w; sacc += E.saccade * w; nods += (E.nods || 0) * w;
    }
    var n = Math.max(1e-6, tw), lead = EMOTIONS[this.mix[0].name];
    for (k in face) face[k] = clamp(face[k], 0, 1);
    return { motion: motion / n, saccade: sacc / n, gaze: lead.gaze, nods: nods, lead: this.mix[0].name };
  };

  /* An occasional micro-expression: a brow flash, a corner twitch, a brief squint. Adds into `face`; scale 0..1. */
  ExpressionController.prototype.micro_ = function (t, scale, face) {
    if (t > this.nextMicro && !this.micro) {
      var r = this.rand(), type = r < 0.38 ? 'brow' : r < 0.7 ? 'corner' : r < 0.88 ? 'squint' : 'press';
      this.micro = { type: type, start: t, dur: 0.5 + this.rand() * 0.5, side: this.rand() > 0.5 ? 1 : -1 };
    }
    if (!this.micro) return;
    var mi = this.micro, p = (t - mi.start) / mi.dur;
    if (p >= 1) { this.micro = null; this.nextMicro = t + 5 + this.rand() * 8; return; }
    var e = Math.sin(Math.PI * p) * scale;
    if (mi.type === 'brow') { face.browInnerUp += 0.1 * e; face.browOuterUpLeft += 0.1 * e; face.browOuterUpRight += 0.1 * e; }
    else if (mi.type === 'corner') { if (mi.side > 0) face.mouthSmileRight += 0.1 * e; else face.mouthSmileLeft += 0.1 * e; }
    else if (mi.type === 'squint') { face.eyeSquintLeft += 0.14 * e; face.eyeSquintRight += 0.14 * e; }
    else { face.mouthPressLeft += 0.18 * e; face.mouthPressRight += 0.18 * e; }
  };

  WA.ExpressionController = ExpressionController;
})(typeof window !== 'undefined' ? window : globalThis);
