/* Avatar kit: shared helpers. Everything lives under window.AvatarKit. */
(function (root) {
  'use strict';
  var WA = root.AvatarKit = root.AvatarKit || {};
  WA.VERSION = '2.0.0';

  WA.clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  WA.clamp01 = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  WA.lerp = function (a, b, t) { return a + (b - a) * t; };
  WA.smooth = function (e0, e1, x) {
    var t = WA.clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  WA.gauss = function (d2, sigma) { return Math.exp(-d2 / (2 * sigma * sigma)); };

  // frame-rate independent exponential smoothing
  WA.damp = function (cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); };

  /*
   * Critically damped smoothing with velocity (the "smooth damp" used in animation systems).
   * It never overshoots and it has no jump: speed ramps up and down, which is what makes
   * a change of expression read as a person changing, not a switch flipping.
   * state = { v: value, s: velocity }; returns the new value.
   */
  WA.smoothDamp = function (state, target, smoothTime, dt, maxSpeed) {
    smoothTime = Math.max(0.0001, smoothTime);
    var omega = 2 / smoothTime, x = omega * dt;
    var exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    var change = state.v - target, maxChange = (maxSpeed || Infinity) * smoothTime;
    change = WA.clamp(change, -maxChange, maxChange);
    var tgt = state.v - change, temp = (state.s + omega * change) * dt;
    state.s = (state.s - omega * temp) * exp;
    var out = tgt + (change + temp) * exp;
    if ((target - state.v > 0) === (out > target)) { out = target; state.s = (out - target) / Math.max(dt, 1e-6); }
    state.v = out;
    return out;
  };

  // deterministic random numbers, so anything procedural is the same on every load
  WA.rng = function (seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // slow organic wandering value in [-1, 1], built from incommensurate sines
  WA.noise = function (t, seed) {
    var s = seed || 0;
    return (Math.sin(t * 0.71 + s) * 0.5 + Math.sin(t * 1.27 + s * 2.3) * 0.3 + Math.sin(t * 2.11 + s * 4.1) * 0.2);
  };

  WA.hex = function (h) { var n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  WA.rgba = function (h, a) { var c = WA.hex(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };

  /* Tiny event emitter, used by the API and the models. */
  WA.Emitter = function () { this._l = {}; };
  WA.Emitter.prototype.on = function (n, fn) { (this._l[n] = this._l[n] || []).push(fn); var self = this; return function () { self.off(n, fn); }; };
  WA.Emitter.prototype.off = function (n, fn) { this._l[n] = (this._l[n] || []).filter(function (f) { return f !== fn; }); };
  WA.Emitter.prototype.emit = function (n, d) {
    (this._l[n] || []).slice().forEach(function (fn) { try { fn(d); } catch (e) { if (root.console) console.error(e); } });
  };

  /* Typed errors, so callers can react to a failure instead of parsing a message. */
  WA.AvatarError = function (code, message, cause) {
    var e = new Error(message); e.name = 'AvatarError'; e.code = code; if (cause) e.cause = cause; return e;
  };

  /* Short-lived cache of channel objects, so the hot path does not allocate. */
  WA.assign = function (dst, src) { for (var k in src) dst[k] = src[k]; return dst; };
})(typeof window !== 'undefined' ? window : globalThis);
