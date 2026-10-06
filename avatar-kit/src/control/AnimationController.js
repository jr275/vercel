/*
 * AnimationController: the idle life of the body and head. Less motion, more presence.
 *
 *  - breathing at its own slow pace, shoulders rising a hair with the chest
 *  - blinks with natural spacing, the occasional double, and one on large gaze shifts
 *  - a head that settles: it follows the eyes only part of the way, with a lag, plus a very small drift
 *  - listening nods, small head beats on speech emphasis (no constant bobbing while talking)
 *  - rare posture shifts: a weight change every 8 to 16 seconds
 * Nothing repeats on a fixed period. All amplitudes are small on purpose: a still, attentive person
 * is more convincing than a moving one.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, clamp = WA.clamp, noise = WA.noise, sd = WA.smoothDamp;

  function AnimationController(seed) {
    this.rand = WA.rng(seed || 9001);
    this.intensity = 1; this.blinkEnabled = true;
    this.blink = 0; this._b = { start: -1, next: 2.4, dbl: false, second: false };
    this.breath = { v: 0 }; this.nod = { start: -10, next: 4, amp: 0 };
    this.post = { x: 0, tx: 0, roll: 0, troll: 0, lean: 0, tlean: 0, sh: 0, tsh: 0, next: 7 };
    this.hs = { yaw: { v: 0, s: 0 }, pitch: { v: 0, s: 0 }, roll: { v: 0, s: 0 } };
    this.beat = { v: 0, s: 0 }; this.beatYaw = { v: 0, s: 0 }; this.lean = { v: 0, s: 0 };
    this.pose = { headYaw: 0, headPitch: 0, headRoll: 0, breath: 0, chest: 0, sway: 0, bodyRoll: 0, bodyYaw: 0, shoulderL: 0, shoulderR: 0, lean: 0, armSwing: 0 };
    this.out = { pose: this.pose, blink: 0 };
  }

  /*
   * in: { head {yaw,pitch,roll} (from the composer), motion, nods, blinkScale, gaze {yaw,pitch,blink}, speaking, activity, emphasis, attention }
   */
  AnimationController.prototype.update = function (dt, t, inp) {
    var R = this.rand, I = this.intensity, motion = (inp.motion == null ? 1 : inp.motion) * I, pz = this.pose;
    var speaking = !!inp.speaking, act = inp.activity || 0, emph = inp.emphasis || 0, gz = inp.gaze || { yaw: 0, pitch: 0 }, hb = inp.head || { yaw: 0, pitch: 0, roll: 0 };

    /* breathing: faster inhale than exhale, deeper while speaking */
    var ph = (t / 4.6) % 1;
    var b = ph < 0.4 ? Math.sin((ph / 0.4) * Math.PI / 2) : Math.cos(((ph - 0.4) / 0.6) * Math.PI / 2);
    this.breath.v += (b - this.breath.v) * (1 - Math.exp(-6 * dt));

    /* blinks */
    var B = this._b, scale = Math.max(0.2, inp.blinkScale == null ? 1 : inp.blinkScale);
    if (this.blinkEnabled && B.start < 0 && (t > B.next || (inp.gaze && inp.gaze.blink && t > B.next - 1.6))) { B.start = t; B.dbl = R() < 0.12; B.second = false; }
    var bl = 0;
    if (B.start >= 0) {
      var p = (t - B.start) / 0.2;
      if (p >= 1) {
        if (B.dbl && !B.second) { B.start = t + 0.05; B.second = true; }
        else { B.start = -1; B.next = t + (2.6 + R() * 4) / scale; }
      } else if (p >= 0) bl = p < 0.35 ? Math.sin((p / 0.35) * Math.PI / 2) : Math.cos(((p - 0.35) / 0.65) * Math.PI / 2);
    }
    this.blink = bl;

    /* posture: rare, slow, small */
    var Q = this.post;
    if (t > Q.next) { Q.tx = (R() - 0.5) * 0.04 * motion; Q.troll = (R() - 0.5) * 0.01 * motion; Q.tsh = (R() - 0.5) * 0.4 * motion; Q.next = t + 8 + R() * 8; }
    Q.x += (Q.tx - Q.x) * (1 - Math.exp(-0.7 * dt)); Q.roll += (Q.troll - Q.roll) * (1 - Math.exp(-0.7 * dt)); Q.sh += (Q.tsh - Q.sh) * (1 - Math.exp(-0.8 * dt));
    var leanT = clamp((inp.attention == null ? 0.9 : inp.attention) - 0.85, 0, 0.15) * 1.2;     // leans in a hair when fully attentive
    sd(this.lean, leanT, 1.2, dt);

    /* nods: while listening, a slow small nod every 4 to 8 seconds */
    if (inp.nods > 0.05 && !speaking && t > this.nod.next) { this.nod.start = t; this.nod.amp = 0.03 * inp.nods * (0.7 + R() * 0.6); this.nod.next = t + 4 + R() * 4.5; }
    var np = (t - this.nod.start) / 0.9, nod = np >= 0 && np < 1 ? Math.sin(np * Math.PI) * this.nod.amp : 0;

    /* head beats on emphasis: a small dip of the chin and a trace of yaw, only on louder syllables */
    var bt = sd(this.beat, speaking ? emph * 0.016 : 0, 0.07, dt), byw = sd(this.beatYaw, speaking ? emph * 0.008 * Math.sign(noise(t * 0.3, 31) || 1) : 0, 0.12, dt);

    /* head: follows the eyes part of the way (beyond a dead zone), lagged, plus a very small drift */
    var dead = function (v) { var a = Math.abs(v) - 0.08; return a > 0 ? Math.sign(v) * a : 0; };
    var drift = motion * (speaking ? 0.7 : 1);
    var hy = dead(gz.yaw) * 0.55 + noise(t * 0.4, 1) * 0.011 * drift + hb.yaw + byw;
    var hp = dead(gz.pitch) * 0.5 + noise(t * 0.35, 2) * 0.005 * drift + hb.pitch + nod + bt;
    var hr = hb.roll + noise(t * 0.33, 3) * 0.006 * drift + Q.roll;
    pz.headYaw = sd(this.hs.yaw, hy, 0.24, dt); pz.headPitch = sd(this.hs.pitch, hp, 0.2, dt); pz.headRoll = sd(this.hs.roll, hr, 0.3, dt);

    pz.breath = this.breath.v; pz.chest = this.breath.v * (1 + (speaking ? 0.35 * act : 0));
    pz.sway = Q.x; pz.bodyRoll = Q.roll * 0.6; pz.bodyYaw = noise(t * 0.28, 8) * 0.006 * motion;
    pz.shoulderL = this.breath.v * 0.25 + Q.sh * 0.5; pz.shoulderR = this.breath.v * 0.25 - Q.sh * 0.5;
    pz.lean = this.lean.v; pz.armSwing = noise(t * 0.45, 9) * motion * 0.6;
    this.out.blink = this.blink;
    return this.out;
  };

  WA.AnimationController = AnimationController;
})(typeof window !== 'undefined' ? window : globalThis);
