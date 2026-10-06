/*
 * AvatarAdapter: the seam between the animation system and whichever model is active.
 *
 *   AvatarAPI -> controllers -> AvatarAdapter -> ProceduralAvatar | GLBAvatar | your own AvatarModel
 *
 * The controllers talk to the adapter and never to a model. The adapter:
 *   - checks a model against the AvatarModel contract before accepting it
 *   - swaps models at runtime (the new one is attached, the old one disposed) and replays the last
 *     face, gaze, head and body state so the new model appears already "in the moment"
 *   - isolates failures: a model that throws is counted, reported once, and after repeated failures
 *     the adapter reports 'failed' so the caller can fall back, instead of freezing the render loop
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit;

  function AvatarAdapter(scene, renderer, opts) {
    WA.Emitter.call(this);
    this.scene = scene; this.renderer = renderer; this.o = WA.assign({ maxErrors: 3 }, opts || {});
    this.model = null; this.errors = 0; this.caps = {}; this.last = { channels: null, eye: null, head: [0, 0, 0], pose: null, mouth: 0, idle: 1, speaking: false };
    this.updateMs = 0;
  }
  AvatarAdapter.prototype = Object.create(WA.Emitter.prototype);
  AvatarAdapter.prototype.constructor = AvatarAdapter;

  /* Attaches a loaded model. Throws AvatarError('BAD_MODEL') listing missing methods if it does not conform. */
  AvatarAdapter.prototype.use = function (model) {
    var missing = WA.AvatarModel.check(model);
    if (missing.length) throw WA.AvatarError('BAD_MODEL', 'Model does not implement the AvatarModel contract. Missing: ' + missing.join(', '));
    var old = this.model;
    model.onAttach(this.scene, this.renderer);
    if (old) { try { old.dispose(); } catch (e) { this.emit('warning', WA.AvatarError('DISPOSE_FAILED', 'Previous model did not dispose cleanly', e)); } }
    this.model = model; this.errors = 0; this.caps = model.capabilities() || {};
    var L = this.last;
    this._g(function () {
      if (L.channels) model.setExpression(L.channels);
      if (L.eye) model.setEyeTarget(L.eye[0], L.eye[1], L.eye[2]);
      model.setHeadRotation(L.head[0], L.head[1], L.head[2]);
      if (L.pose) model.setBodyPose(L.pose);
      model.setIdle(L.idle); model.setSpeaking(L.speaking);
    });
    this.emit('model', { landmarks: model.getLandmarks(), info: model.getInfo(), caps: this.caps });
    return model;
  };

  AvatarAdapter.prototype._g = function (fn) {
    if (!this.model) return;
    try { fn(); } catch (e) {
      this.errors++;
      if (this.errors === 1) this.emit('error', WA.AvatarError('MODEL_ERROR', 'The model threw while being driven: ' + (e && e.message), e));
      if (this.errors >= this.o.maxErrors) this.emit('failed', e);
    }
  };

  AvatarAdapter.prototype.hasNativeVisemes = function () { return !!(this.caps && this.caps.visemes); };
  AvatarAdapter.prototype.setExpression = function (ch) { this.last.channels = ch; var m = this.model; this._g(function () { m.setExpression(ch); }); };
  AvatarAdapter.prototype.setViseme = function (w) { if (!this.hasNativeVisemes()) return; var m = this.model; this._g(function () { m.setViseme(w); }); };
  AvatarAdapter.prototype.setMouthLevel = function (v) { this.last.mouth = v; var m = this.model; this._g(function () { m.setMouthLevel(v); }); };
  AvatarAdapter.prototype.setEyeTarget = function (yaw, pitch, per) { this.last.eye = [yaw, pitch, per]; var m = this.model; this._g(function () { m.setEyeTarget(yaw, pitch, per); }); };
  AvatarAdapter.prototype.setHeadRotation = function (y, p, r) { this.last.head = [y, p, r]; var m = this.model; this._g(function () { m.setHeadRotation(y, p, r); }); };
  AvatarAdapter.prototype.setBodyPose = function (p) { this.last.pose = p; var m = this.model; this._g(function () { m.setBodyPose(p); }); };
  AvatarAdapter.prototype.setIdle = function (k) { this.last.idle = k; var m = this.model; this._g(function () { m.setIdle(k); }); };
  AvatarAdapter.prototype.setSpeaking = function (on) { this.last.speaking = on; var m = this.model; this._g(function () { m.setSpeaking(on); }); };
  AvatarAdapter.prototype.update = function (dt) {
    var m = this.model; if (!m) return; var t0 = root.performance ? performance.now() : 0;
    this._g(function () { m.update(dt); });
    this.updateMs += ((root.performance ? performance.now() : 0) - t0 - this.updateMs) * 0.1;
  };
  AvatarAdapter.prototype.getLandmarks = function () { return this.model ? this.model.getLandmarks() : null; };
  AvatarAdapter.prototype.getInfo = function () { return this.model ? this.model.getInfo() : null; };
  AvatarAdapter.prototype.getRigReport = function () { return this.model ? this.model.getRigReport() : null; };
  AvatarAdapter.prototype.dispose = function () { if (this.model) { try { this.model.dispose(); } catch (e) {} this.model = null; } };

  WA.AvatarAdapter = AvatarAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
