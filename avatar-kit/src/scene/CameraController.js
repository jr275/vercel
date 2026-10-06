/*
 * CameraController: three framings (CLOSE, MEDIUM, FULL) in three styles (conversation, executive, intimate),
 * computed from the model's landmarks, so any model frames correctly.
 *
 * A shot says how much of the person is in frame, measured in head heights. A style says how it is
 * shot: lens, camera height, angle, how much it breathes. Moves between framings are slow, eased in and
 * out, and the resting frame moves only a few millimetres: the camera should be felt, not seen.
 *
 *   conversation   the main view: close, slightly warm, a little life in the frame
 *   executive      composed: longer lens, more headroom and shoulders, eye-level, nearly static
 *   intimate       closer, shorter distance and a slightly wider lens, a few degrees off-axis
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, clamp = WA.clamp, noise = WA.noise;

  // visible height in head heights, and the landmark the frame is centred on (offset in head heights)
  var SHOTS = {
    CLOSE: { vis: 2.3, centre: 'eyeY', off: -0.42 },
    MEDIUM_CLOSE: { vis: 2.85, centre: 'eyeY', off: -0.56 },      // the default of the executive runtime: head and shoulders, in the room
    MEDIUM: { vis: 4.7, centre: 'eyeY', off: -1.55 },
    FULL: { vis: 7.6, centre: 'hipsY', off: 0 }
  };
  var STYLES = {
    conversation: { fov: 24, visK: 1, offK: 1, az: 0, el: 0.012, drift: 1, dur: 1.8 },
    executive: { fov: 20, visK: 1.2, offK: 1.25, az: 0, el: 0, drift: 0.25, dur: 2.2 },
    intimate: { fov: 29, visK: 0.78, offK: 0.5, az: 0.07, el: -0.01, drift: 0.7, dur: 2.0 }
  };
  var ALIAS = { 'medium-close': 'MEDIUM_CLOSE', medium_close: 'MEDIUM_CLOSE', mediumclose: 'MEDIUM_CLOSE', closeup: 'CLOSE', close: 'CLOSE', medium: 'MEDIUM', full: 'FULL' };

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function norm(name) { var n = String(name == null ? '' : name); return ALIAS[n.toLowerCase()] || (SHOTS[n.toUpperCase()] ? n.toUpperCase() : null); }

  /* Pure: the camera frame for a shot and style. aspect < 0.75 backs the camera off to keep the subject in frame. */
  function frameFor(shot, style, lm, aspect) {
    var s = SHOTS[shot], st = STYLES[style], h = lm.headHeight;
    var vis = s.vis * (shot === 'FULL' ? 1 : st.visK) * h;
    if (shot === 'FULL') vis = Math.max(vis, lm.height * 1.08);
    var cy = (shot === 'FULL' ? lm.height * 0.5 : lm[s.centre] + s.off * h * st.offK);
    var fovRad = st.fov * Math.PI / 180, fovUse = st.fov;
    var d = (vis / 2) / Math.tan(fovRad / 2);
    if (aspect && aspect < 0.75) d *= 0.75 / aspect;
    return { y: cy, d: d, fov: fovUse, az: st.az, el: st.el, drift: st.drift, vis: vis };
  }

  function CameraController(camera, canvas) {
    this.camera = camera; this.lm = WA.AvatarModel.defaultLandmarks(7.05);
    this.shot = 'CLOSE'; this.style = 'conversation'; this.aspect = 1;
    this.cur = frameFor('CLOSE', 'conversation', this.lm, 1);
    this.from = null; this.to = this.cur; this.p = 1; this.dur = 1.8;
    this.orbit = 0; this.orbitTarget = 0; this.dragging = false; this.drift = 1; this.holdOrbit = false;
    var self = this, x0 = 0, o0 = 0;
    if (canvas) {
      canvas.addEventListener('pointerdown', function (e) { self.dragging = true; self.holdOrbit = false; x0 = e.clientX; o0 = self.orbitTarget; try { canvas.setPointerCapture(e.pointerId); } catch (err) {} });
      canvas.addEventListener('pointermove', function (e) { if (self.dragging) self.orbitTarget = clamp(o0 - (e.clientX - x0) * 0.005, -0.7, 0.7); });
      var up = function () { self.dragging = false; };
      canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    }
  }
  CameraController.SHOTS = SHOTS; CameraController.STYLES = STYLES; CameraController.frameFor = frameFor; CameraController.normalize = norm;

  CameraController.prototype.setLandmarks = function (lm, instant) { if (!lm) return; this.lm = lm; this._retarget(instant ? 0.01 : 0.8); };
  CameraController.prototype.setAspect = function (a) { if (a && a !== this.aspect) { this.aspect = a; this._retarget(0.01); } };
  CameraController.prototype._retarget = function (dur) {
    this.from = { y: this.cur.y, d: this.cur.d, fov: this.cur.fov, az: this.cur.az, el: this.cur.el, drift: this.cur.drift, vis: this.cur.vis };
    this.to = frameFor(this.shot, this.style, this.lm, this.aspect); this.p = 0; this.dur = Math.max(0.01, dur);
  };

  /* shot: CLOSE | MEDIUM | FULL (legacy: closeup, medium, full). o: { style, duration } */
  CameraController.prototype.setShot = function (name, o) {
    var n = norm(name); if (!n) return false;
    o = typeof o === 'number' ? { duration: o } : (o || '');
    if (o.style && !STYLES[o.style]) return false;
    this.shot = n; if (o.style) this.style = o.style;
    this._retarget(o.duration != null ? o.duration : STYLES[this.style].dur); return true;
  };
  CameraController.prototype.setStyle = function (style, duration) { if (!STYLES[style]) return false; this.style = style; this._retarget(duration == null ? 1.2 : duration); return true; };

  /* Moves the camera. Returns the current orbit angle (radians) and the frame. */
  CameraController.prototype.update = function (dt, t) {
    var c = this.cur;
    if (this.p < 1) {
      this.p = Math.min(1, this.p + dt / this.dur);
      var e = ease(this.p), f = this.from, to = this.to;
      ['y', 'd', 'fov', 'az', 'el', 'drift', 'vis'].forEach(function (k) { c[k] = f[k] + (to[k] - f[k]) * e; });
    }
    if (!this.dragging && !this.holdOrbit) this.orbitTarget *= Math.exp(-0.5 * dt);
    this.orbit += (this.orbitTarget - this.orbit) * (1 - Math.exp(-8 * dt));
    var d = c.d, k = this.drift * c.drift * (d / 5), az = this.orbit + c.az;
    var dx = noise(t * 0.17, 11) * 0.007 * k, dy = noise(t * 0.14, 12) * 0.005 * k;
    this.camera.position.set(Math.sin(az) * d + dx, c.y + d * c.el + dy, Math.cos(az) * d);
    this.camera.lookAt(0, c.y, 0);
    if (Math.abs(this.camera.fov - c.fov) > 0.001) { this.camera.fov = c.fov; this.camera.updateProjectionMatrix(); }
    return this.orbit;
  };
  /* Fixed azimuth in radians (0 = front, about 0.61 = three-quarter, 1.571 = profile). It is held until the user drags. Used by the review scene. */
  CameraController.prototype.setOrbit = function (rad, instant) { this.orbitTarget = clamp(+rad || 0, -1.75, 1.75); this.holdOrbit = true; if (instant) this.orbit = this.orbitTarget; };
  CameraController.prototype.getFrame = function () { return this.cur; };

  WA.CameraController = CameraController;
})(typeof window !== 'undefined' ? window : globalThis);
