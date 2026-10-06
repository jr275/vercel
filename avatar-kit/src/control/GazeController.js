/*
 * GazeController: where the eyes go, and why.
 *
 * A stare that never moves reads as a doll, and eyes that move constantly read as nervous. A real gaze is:
 *   - mostly on the person, with short glances away (so that eye contact feels chosen, not fixed)
 *   - a hold of 1 to 3 seconds when thinking, usually down or to one side, then a return to direct
 *   - fixational micro-saccades (0.1 to 0.5 degrees, several per second) and a slow drift, even when "locked on"
 *   - big jumps (saccades) that are fast, and often paired with a blink
 *   - not perfectly symmetrical: the eyes converge slightly, one is a hair slower, one jitters a bit more
 *
 * Modes (from the composer): attend | think | scan | glance | speak | direct | hold.
 * Aim (from the application): camera | cursor | center | left | right | { x, y }.
 * "left" and "right" are screen directions, as the viewer sees them.
 * Output angles are radians: yaw > 0 toward screen right, pitch > 0 up.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, clamp = WA.clamp, sd = WA.smoothDamp;

  var MAX_YAW = 0.52, MAX_PITCH = 0.36;

  function GazeController(seed) {
    this.rand = WA.rng(seed || 7331);
    this.aim = { kind: 'camera', x: 0, y: 0 };
    this.off = { yaw: 0, pitch: 0 };            // behavioural offset (glance, think, scan)
    this.offT = { yaw: 0, pitch: 0 };
    this.phase = 'direct'; this.until = 0; this.next = 2.5; this.side = 1;
    this.directTime = 0; this.speakPrev = false; this.speakStart = -9;
    this.micro = { x: 0, y: 0, tx: 0, ty: 0, next: 0.3 };
    this.sc = { yaw: { v: 0, s: 0 }, pitch: { v: 0, s: 0 }, yawR: { v: 0, s: 0 }, pitchR: { v: 0, s: 0 }, ox: { v: 0, s: 0 }, oy: { v: 0, s: 0 } };
    this.verg = 0.012; this.blinkReq = 0; this.lastTarget = { yaw: 0, pitch: 0 };
    this.out = { yaw: 0, pitch: 0, eyes: { yawL: 0, yawR: 0, pitchL: 0, pitchR: 0 }, blink: false, away: false, phase: 'direct', directTime: 0 };
  }

  /* aim: 'camera' | 'cursor' | 'center' | 'left' | 'right' | 'down' | { x, y } */
  GazeController.prototype.setAim = function (a, y) {
    if (typeof a === 'number') this.aim = { kind: 'point', x: clamp(a, -1, 1), y: clamp(y || 0, -1, 1) };
    else if (a && typeof a === 'object') this.aim = { kind: 'point', x: clamp(a.x || 0, -1, 1), y: clamp(a.y || 0, -1, 1) };
    else if (/^(camera|cursor|center|left|right|down|up)$/.test(a)) this.aim = { kind: a, x: 0, y: 0 };
    else return false;
    return true;
  };
  GazeController.prototype.getAim = function () { return this.aim.kind; };

  function aimAngles(g, cursor, viewYaw) {
    var a = g.aim;
    switch (a.kind) {
      case 'camera': return [viewYaw * 0.9, 0];
      case 'cursor': return [cursor.x * 0.42 + viewYaw * 0.9, cursor.y * 0.26];
      case 'center': return [0, 0];
      case 'left': return [-0.4, 0.02];
      case 'right': return [0.4, 0.02];
      case 'down': return [0, -0.3];
      case 'up': return [0, 0.25];
      default: return [a.x * 0.42 + viewYaw * 0.9, a.y * 0.26];
    }
  }

  GazeController.prototype._glance = function (t, dur, yaw, pitch) { this.phase = 'away'; this.until = t + dur; this.offT.yaw = yaw; this.offT.pitch = pitch; this.directTime = 0; this._shift = true; };
  GazeController.prototype._return = function (t, gap) { this.phase = 'direct'; this.offT.yaw = 0; this.offT.pitch = 0; this.next = t + gap; this._shift = true; };

  /*
   * in: { mode, saccade (0..2), attention, speaking, activity (0..1), emphasis (0..1), viewYaw, cursor {x,y}, silence (s) }
   */
  GazeController.prototype.update = function (dt, t, inp) {
    var R = this.rand, mode = inp.mode || 'attend', S = inp.saccade == null ? 1 : inp.saccade, att = inp.attention == null ? 0.9 : inp.attention;
    var side = this.side, ph = this.phase;
    this._shift = false;

    /* ---- behaviour: decide glances, holds and returns ---- */
    if (this.aim.kind !== 'camera' && this.aim.kind !== 'cursor' && this.aim.kind !== 'point') { this.offT.yaw = this.offT.pitch = 0; this.phase = 'direct'; }
    else switch (mode) {
      case 'think':
        if (ph === 'direct' && t > this.next) { this.side = R() < 0.5 ? -1 : 1; this._glance(t, 1.2 + R() * 1.6, this.side * (0.16 + R() * 0.12), -0.14 - R() * 0.1); }
        else if (ph === 'away' && t > this.until) this._return(t, 0.5 + R() * 1.1);
        break;
      case 'scan':
        if (ph === 'direct' && t > this.next) { this.side = R() < 0.5 ? -1 : 1; this._glance(t, 0.7 + R() * 0.9, this.side * (0.12 + R() * 0.12), 0.06 + R() * 0.07); }
        else if (ph === 'away') { if (t > this.until) this._return(t, 0.35 + R() * 0.8); else if (R() < dt * 1.5) { this.offT.yaw = this.side * (0.08 + R() * 0.2); this._shift = true; } }
        break;
      case 'glance':
        if (ph === 'direct' && t > this.next) { this.side = R() < 0.5 ? -1 : 1; this._glance(t, 0.6 + R() * 0.6, this.side * 0.1, -0.02); }
        else if (ph === 'away' && t > this.until) this._return(t, 4 + R() * 4);
        break;
      case 'speak':
        // look away as an utterance begins, come back to the listener on emphasis and at phrase ends
        if (inp.speaking && !this.speakPrev) { this.speakStart = t; this.side = R() < 0.5 ? -1 : 1; this._glance(t + 0.15, 0.9 + R() * 0.8, this.side * (0.12 + R() * 0.1), 0.05 + R() * 0.08); }
        if (ph === 'away' && (t > this.until || inp.emphasis > 0.45)) this._return(t, 2.2 + R() * 2.4);
        else if (ph === 'direct' && inp.speaking && t > this.next && inp.silence > 0.2) { this.side = -this.side; this._glance(t, 0.5 + R() * 0.7, this.side * 0.1, 0.02 + R() * 0.05); }
        break;
      case 'hold': case 'direct':
        if (ph === 'direct' && this.directTime > (mode === 'hold' ? 11 : 8) && t > this.next) { this.side = R() < 0.5 ? -1 : 1; this._glance(t, 0.35 + R() * 0.3, this.side * 0.07, -0.05); }
        else if (ph === 'away' && t > this.until) this._return(t, 3 + R() * 3);
        break;
      default:          // attend
        if (ph === 'direct' && t > this.next) { this.side = R() < 0.5 ? -1 : 1; this._glance(t, 0.4 + R() * 0.7, this.side * (0.1 + R() * 0.1), -0.04 - R() * 0.06); }
        else if (ph === 'away' && t > this.until) this._return(t, (3 + R() * 4.5) * (att > 0.9 ? 1.2 : 1));
    }
    this.speakPrev = mode === 'speak' && !!inp.speaking;
    if (this.phase === 'direct') this.directTime += dt;
    this.out.phase = this.phase; this.out.directTime = this.directTime;

    /* ---- micro-saccades and drift: always on, scaled by the mode ---- */
    var M = this.micro;
    if (t > M.next) {
      var a = (0.0018 + R() * 0.006) * (0.5 + 0.5 * Math.min(1.4, S));
      var ang = R() * Math.PI * 2; M.tx = Math.cos(ang) * a; M.ty = Math.sin(ang) * a * 0.7;
      if (R() < 0.3) { M.tx *= 0.2; M.ty *= 0.2; }                    // some are almost nothing, some pull back to the center
      M.next = t + 0.14 + R() * 0.5;
    }
    M.x += (M.tx - M.x) * (1 - Math.exp(-70 * dt)); M.y += (M.ty - M.y) * (1 - Math.exp(-70 * dt));
    var drift = WA.noise(t * 0.7, 21) * 0.0025, driftY = WA.noise(t * 0.6, 22) * 0.002;

    /* ---- target ---- */
    var base = aimAngles(this, inp.cursor || { x: 0, y: 0 }, inp.viewYaw || 0);
    var o = this.off; var koff = 1 - Math.exp(-9 * dt);
    o.yaw += (this.offT.yaw - o.yaw) * koff; o.pitch += (this.offT.pitch - o.pitch) * koff;       // the offset itself eases a little; the eyes then jump quickly
    var ty = clamp(base[0] + this.offT.yaw, -MAX_YAW, MAX_YAW), tp = clamp(base[1] + this.offT.pitch, -MAX_PITCH, MAX_PITCH);
    var big = Math.hypot(ty - this.lastTarget.yaw, tp - this.lastTarget.pitch);
    if (big > 0.11 && R() < 0.55) this.out.blink = true;
    else this.out.blink = false;
    this.lastTarget.yaw = ty; this.lastTarget.pitch = tp;

    /* ---- eyes: fast critically damped jumps, per eye slightly different ---- */
    var yawL = sd(this.sc.yaw, ty + M.x * 1.15 + drift, 0.045, dt), pitchL = sd(this.sc.pitch, tp + M.y * 1.15 + driftY, 0.048, dt);
    var yawR = sd(this.sc.yawR, ty + M.x * 0.9 + drift * 0.8, 0.052, dt), pitchR = sd(this.sc.pitchR, tp + M.y * 0.9 + driftY * 0.85 + 0.002, 0.05, dt);
    var verg = 0.012 + WA.noise(t * 0.25, 23) * 0.004 + (tp < -0.1 ? 0.012 : 0);    // reading distance converges more
    var eyes = this.out.eyes; eyes.yawL = yawL + verg; eyes.yawR = yawR - verg; eyes.pitchL = pitchL; eyes.pitchR = pitchR;
    this.out.yaw = (yawL + yawR) / 2; this.out.pitch = (pitchL + pitchR) / 2; this.out.away = this.phase === 'away';
    this.out.shift = this._shift;
    return this.out;
  };

  GazeController.MAX_YAW = MAX_YAW; GazeController.MAX_PITCH = MAX_PITCH;
  WA.GazeController = GazeController;
})(typeof window !== 'undefined' ? window : globalThis);
