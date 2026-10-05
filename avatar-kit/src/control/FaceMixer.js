/*
 * FaceMixer: the last step before a model. It takes what the controllers produced and makes the final set
 * of channels, including everything that makes speech look like a person talking rather than a mouth opening:
 *
 *   - blink on top of the lid baseline (lids combine as 1-(1-a)(1-b), never add past closed)
 *   - lids follow vertical gaze (look down: the upper lid comes down with the eye)
 *   - visemes become channels when the model has no native visemes (via the ARKit recipes, or the model's own)
 *   - speech extras: cheeks lift on wide sounds, puff on plosives, the jaw wanders a little off-centre, the lips
 *     are not perfectly symmetrical
 *   - pauses: when the voice stops mid-speech the lips settle together; after a longer pause she takes a breath
 *     (mouth parts slightly, nostrils flare) and the chest follows
 * All of this is small. It only has to read as "alive" when it is moving and disappear when it is not.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, clamp = WA.clamp, C = WA.Channels, noise = WA.noise;

  function FaceMixer() {
    this.out = {}; this.tmp = {};
    C.ALL.forEach(function (c) { this.out[c] = 0; }, this);
    this.breath = 0; this._breathAt = -9; this._silentSince = 0; this._breathed = true; this.pauseK = 0; this.visOut = null;
  }

  /*
   * in: { channels (composer), blink 0..1, gazePitch, visemes (15), level, speaking, silence (s), t, dt,
   *       nativeVisemes (bool), recipes (model-specific viseme->channel map or null) }
   * Returns the channels object (reused); this.breath is a 0..1 pulse for the chest; this.visOut is the viseme map to pass to the model or null.
   */
  FaceMixer.prototype.mix = function (inp) {
    var o = this.out, ch = inp.channels, k, dt = inp.dt || 1 / 60, t = inp.t || 0, lvl = inp.level || 0;
    for (k in o) o[k] = ch[k] || 0;

    // blink + lid follow
    var follow = inp.gazePitch < 0 ? Math.min(0.28, -inp.gazePitch * 0.8) : 0, bl = inp.blink || 0;
    o.eyeBlinkLeft = 1 - (1 - o.eyeBlinkLeft) * (1 - bl) * (1 - follow);
    o.eyeBlinkRight = 1 - (1 - o.eyeBlinkRight) * (1 - bl) * (1 - follow);
    if (bl > 0.5) { o.eyeWideLeft *= 1 - bl; o.eyeWideRight *= 1 - bl; }

    // pauses and breathing
    var speaking = !!inp.speaking, sil = inp.silence == null ? 0 : inp.silence;
    var wantPause = speaking && sil > 0.3 && lvl < 0.06;
    this.pauseK += ((wantPause ? 1 : 0) - this.pauseK) * (1 - Math.exp(-(wantPause ? 9 : 16) * dt));
    if (wantPause && sil > 0.62 && !this._breathed) { this._breathed = true; this._breathAt = t; }
    if (!wantPause) this._breathed = sil <= 0.62 ? false : this._breathed;
    var bp = (t - this._breathAt) / 0.7, breath = bp >= 0 && bp < 1 ? Math.sin(bp * Math.PI) : 0;
    this.breath = breath;
    o.mouthClose = Math.max(o.mouthClose, this.pauseK * 0.18);
    o.mouthPressLeft = Math.max(o.mouthPressLeft, this.pauseK * 0.12); o.mouthPressRight = Math.max(o.mouthPressRight, this.pauseK * 0.12);
    o.jawOpen += breath * 0.07; o.mouthFunnel += breath * 0.05; o.noseSneerLeft += breath * 0.06; o.noseSneerRight += breath * 0.05;

    // speech
    this.visOut = null;
    if (inp.visemes && (speaking || lvl > 0.02)) {
      var vis = inp.visemes;
      if (inp.nativeVisemes) this.visOut = vis;
      var t2 = this.tmp; for (k in t2) t2[k] = 0;
      C.visemesToChannels(vis, t2, inp.recipes || null);
      for (k in t2) {
        if (inp.nativeVisemes && k !== 'jawOpen') continue;        // native visemes already carry their own mouth; keep only the jaw so it opens with them
        if (k === 'jawOpen') o.jawOpen = clamp(o.jawOpen + t2[k] * (inp.nativeVisemes ? 0.6 : 1), 0, 1);
        else o[k] = clamp(Math.max(o[k], t2[k]) + Math.min(o[k], t2[k]) * 0.2, 0, 1);
      }
      var pp = vis.viseme_PP + vis.viseme_FF * 0.5, wide = vis.viseme_E + vis.viseme_I + vis.viseme_SS;
      o.cheekPuff = Math.max(o.cheekPuff, pp * 0.1);
      o.cheekSquintLeft = clamp(o.cheekSquintLeft + wide * 0.12, 0, 1); o.cheekSquintRight = clamp(o.cheekSquintRight + wide * 0.12, 0, 1);
      var a = Math.min(1, lvl * 1.5);                                          // secondary motion, only while the mouth is moving
      var jw = noise(t * 1.3, 41) * 0.05 * a, mw = noise(t * 1.1, 42) * 0.04 * a;
      if (jw > 0) o.jawRight += jw; else o.jawLeft -= jw;
      if (mw > 0) o.mouthRight += mw; else o.mouthLeft -= mw;
      o.mouthSmileLeft = clamp(o.mouthSmileLeft + noise(t * 0.9, 43) * 0.03 * a, 0, 1); o.mouthSmileRight = clamp(o.mouthSmileRight + noise(t * 0.8, 44) * 0.03 * a, 0, 1);
    }
    for (k in o) o[k] = clamp(o[k], 0, 1);
    return o;
  };

  WA.FaceMixer = FaceMixer;
})(typeof window !== 'undefined' ? window : globalThis);
