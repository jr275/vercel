/*
 * ExpressionComposer: one place where everything that shapes the face is combined, and the only place
 * where face channels change over time.
 *
 *   inputs:  emotion (+ intensity or mix)        what the face shows
 *            cognitive state                      what the agent is doing (gaze, posture, blink rate, implied emotion)
 *            context                              conversation | executive | intimate (how much she shows)
 *            speech                               speaking, level: the mouth is busy, brows add emphasis
 *            attention 0..1                       lids, eye openness, how locked the gaze is
 *   output:  smoothed ARKit channels, a head bias, and behaviour hints for gaze and animation
 *
 * Time behaviour: every channel goes through a critically damped smoother with its own speed, so a
 * change of emotion is never an instant jump and never overshoots. A transition can be slowed with
 * set({ transition: 1.5 }) but never made instant (the floor is 50 ms).
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, clamp = WA.clamp, C = WA.Channels, EC = WA.ExpressionController, CS = WA.CognitiveState;

  var CONTEXTS = {
    conversation: { show: 1, motion: 1, smile: 1, blink: 1 },
    executive: { show: 0.8, motion: 0.75, smile: 0.8, blink: 0.85 },       // composed: less shown, less movement
    intimate: { show: 1.08, motion: 0.9, smile: 1.1, blink: 1.1 }
  };
  // seconds for a channel to settle (critically damped), by group
  function smoothTimeFor(ch) {
    if (ch.indexOf('brow') === 0) return 0.2;
    if (ch.indexOf('eyeBlink') === 0) return 0.12;
    if (ch.indexOf('eyeSquint') === 0 || ch.indexOf('eyeWide') === 0) return 0.17;
    if (ch.indexOf('mouthSmile') === 0 || ch.indexOf('cheek') === 0 || ch.indexOf('mouthFrown') === 0) return 0.26;
    if (ch.indexOf('jaw') === 0) return 0.14;
    return 0.2;
  }
  // channels that speech takes over while she talks
  var SPEECH_YIELD = { mouthPressLeft: 0.9, mouthPressRight: 0.9, mouthClose: 1, mouthRollLower: 0.8, mouthRollUpper: 0.8, jawClench: 0.95, mouthShrugLower: 0.7, mouthLeft: 0.5, mouthRight: 0.5 };

  function ExpressionComposer(opts) {
    this.o = WA.assign({ context: 'conversation' }, opts || {});
    this.expr = new EC(); this.cog = new CS();
    this.context = CONTEXTS[this.o.context] ? this.o.context : 'conversation';
    this.attention = 0.9; this.transition = 1; this.override = false;     // override: explicit emotion set after a cognitive state
    this.st = {}; this.headSt = { yaw: { v: 0, s: 0 }, pitch: { v: 0, s: 0 }, roll: { v: 0, s: 0 } };
    this.motionSt = { v: 1, s: 0 }; this.attSt = { v: 0.9, s: 0 };
    this.tgt = {}; this.headT = { yaw: 0, pitch: 0, roll: 0 };
    this.out = { channels: {}, head: { yaw: 0, pitch: 0, roll: 0 }, motion: 1, saccade: 1, gaze: 'attend', nods: 0, blinkScale: 1, attention: 0.9, lead: 'neutral', state: null, beat: 0 };
    this.act = 0; this.lvlPrev = 0; this.emph = 0; this._beat = { v: 0, s: 0 }; this._beatT = -9;
    C.ALL.forEach(function (c) { this.st[c] = { v: 0, s: 0 }; }, this);
    var b = EC.BASE; for (var k in b) this.st[k].v = b[k];
  }

  /* Explicit emotion. Wins over the emotion implied by the cognitive state, which keeps its gaze and posture. */
  ExpressionComposer.prototype.setEmotion = function (name, o) {
    o = o || {};
    var ok = EC.EMOTIONS[String(name).toLowerCase()] ? this.expr.set(name, o) : false;
    if (!ok) return false;
    this.override = this.cog.name != null; this.transition = o.transition == null ? 1 : clamp(o.transition, 0.05, 6);
    return true;
  };
  ExpressionComposer.prototype.setCognitive = function (name, t, o) {
    if (!this.cog.set(name, t)) return false;
    var p = this.cog.profile(); this.override = false; this.transition = o && o.transition != null ? clamp(o.transition, 0.05, 6) : 1;
    this.expr.setMix(p.mix); this.attention = p.attention;
    if (p.beat === 'decide') this._beatT = t || 0;
    return true;
  };
  ExpressionComposer.prototype.setContext = function (name) { if (!CONTEXTS[name]) return false; this.context = name; return true; };
  ExpressionComposer.prototype.setAttention = function (a) { this.attention = clamp(+a, 0, 1); };
  ExpressionComposer.prototype.getEmotion = function () { return this.expr.name; };
  ExpressionComposer.prototype.getCognitive = function () { return this.cog.name; };

  /* speech: { speaking, level 0..1 } (from LipSyncController). Returns the composed, smoothed result (reused object). */
  ExpressionComposer.prototype.update = function (dt, t, speech) {
    speech = speech || { speaking: false, level: 0 };
    var C_ = CONTEXTS[this.context], tg = this.tgt, ht = this.headT, o = this.out, k, i;
    var meta = this.expr.target(tg, ht), prof = this.cog.profile();

    /* context: how much she shows. Scales the departure from the relaxed baseline, not the baseline. */
    var base = EC.BASE, show = C_.show;
    for (k in tg) { var b0 = base[k] || 0; tg[k] = b0 + (tg[k] - b0) * (k.indexOf('mouthSmile') === 0 || k.indexOf('cheek') === 0 ? show * C_.smile : show); }
    this.expr.micro_(t, C_.motion * meta.motion, tg);

    /* cognitive profile: head bias on top of the emotion's, gaze mode, blink rate */
    var gaze = meta.gaze, blinkScale = C_.blink, nods = meta.nods, motion = meta.motion * C_.motion;
    if (prof) {
      gaze = prof.gaze; blinkScale *= prof.blink; nods = Math.max(nods, prof.nods); motion = prof.motion * C_.motion * (this.override ? 1 : 1);
      if (prof.head) { ht.pitch += prof.head.pitch || 0; ht.yaw += prof.head.yaw || 0; ht.roll += prof.head.roll || 0; }
    }

    /* attention: low attention lowers the lids slightly; high attention opens them a touch */
    var att = this.attention;
    if (att < 0.75) { var lid = (0.75 - att) * 0.35; tg.eyeBlinkLeft += lid; tg.eyeBlinkRight += lid; }
    else if (att > 0.9) { var wide = (att - 0.9) * 0.5; tg.eyeWideLeft = (tg.eyeWideLeft || 0) + wide; tg.eyeWideRight = (tg.eyeWideRight || 0) + wide; }

    /* speech: the mouth is busy, so held mouth shapes yield; brows punctuate louder syllables */
    var lvl = speech.speaking ? speech.level : 0;
    this.act += (Math.min(1, lvl * 1.6 + (speech.speaking ? 0.35 : 0)) - this.act) * (1 - Math.exp(-(speech.speaking ? 8 : 4) * dt));
    var rise = Math.max(0, lvl - this.lvlPrev) / Math.max(dt, 1e-3); this.lvlPrev += (lvl - this.lvlPrev) * (1 - Math.exp(-14 * dt));
    this.emph += (Math.min(1, rise * 0.12) - this.emph) * (1 - Math.exp(-(rise * 0.12 > this.emph ? 22 : 5) * dt));
    var yieldK = this.act;
    for (k in SPEECH_YIELD) if (tg[k]) tg[k] *= 1 - SPEECH_YIELD[k] * yieldK;
    tg.mouthSmileLeft *= 1 - 0.25 * yieldK; tg.mouthSmileRight *= 1 - 0.25 * yieldK;
    if (this.emph > 0.02) {
      tg.browInnerUp += this.emph * 0.1; tg.browOuterUpLeft += this.emph * 0.08; tg.browOuterUpRight += this.emph * 0.05;   // slightly asymmetric
    }

    /* decision beat: a brief lowering of the brows and a small nod when she arrives at DECIDING */
    var bp = (t - this._beatT) / 0.9, beat = 0;
    if (bp >= 0 && bp < 1) beat = Math.sin(Math.PI * bp);
    if (beat > 0) { tg.browDownLeft += 0.12 * beat; tg.browDownRight += 0.12 * beat; ht.pitch += 0.03 * beat; }

    /* smoothing: the only place channels change over time */
    var sp = 1 / this.transition, sm = WA.smoothDamp;
    for (k in tg) { var s = this.st[k]; if (s) o.channels[k] = clamp(sm(s, clamp(tg[k], 0, 1), Math.max(0.05, smoothTimeFor(k) * sp), dt), 0, 1); }
    for (k in this.st) if (tg[k] === undefined) o.channels[k] = clamp(sm(this.st[k], 0, Math.max(0.05, smoothTimeFor(k) * sp), dt), 0, 1);
    o.head.yaw = sm(this.headSt.yaw, ht.yaw, 0.5 * sp, dt); o.head.pitch = sm(this.headSt.pitch, ht.pitch, 0.5 * sp, dt); o.head.roll = sm(this.headSt.roll, ht.roll, 0.5 * sp, dt);
    o.motion = sm(this.motionSt, motion, 0.6, dt); o.saccade = meta.saccade; o.gaze = gaze; o.nods = nods; o.blinkScale = blinkScale;
    o.attention = sm(this.attSt, att, 0.4, dt); o.lead = meta.lead; o.state = this.cog.name; o.beat = beat; o.act = this.act; o.emphasis = this.emph;
    return o;
  };

  WA.ExpressionComposer = ExpressionComposer;
  WA.Contexts = CONTEXTS;
})(typeof window !== 'undefined' ? window : globalThis);
