/*
 * ProceduralAvatar: the built-in fallback character, adapted to the AvatarModel contract.
 *
 * It exists so the kit always works with no assets: it is the fallback when a GLB fails to load, and the
 * model the test suite can exercise anywhere. It is NOT the visual target. Its geometry is sculpted in
 * code and it has a small set of face controls, so it supports a subset of the ARKit channels (see
 * SUPPORTED). Everything it cannot express it ignores and says so in capabilities() and getRigReport().
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, clamp = WA.clamp, C = WA.Channels;

  // The procedural face is driven by 17 legacy parameters. These are the ARKit channels that feed them.
  var SUPPORTED = ['eyeBlinkLeft', 'eyeBlinkRight', 'eyeWideLeft', 'eyeWideRight', 'eyeSquintLeft', 'eyeSquintRight', 'browInnerUp', 'browDownLeft', 'browDownRight',
    'browOuterUpLeft', 'browOuterUpRight', 'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight', 'cheekSquintLeft', 'cheekSquintRight', 'mouthPressLeft',
    'mouthPressRight', 'mouthClose', 'mouthStretchLeft', 'mouthStretchRight', 'mouthFunnel', 'mouthPucker', 'jawOpen', 'jawClench'];

  function ProceduralAvatar(opts) {
    WA.AvatarModel.call(this);
    this.o = opts || {}; this.renderer = null; this.api = null; this.ch = {}; this.face = null; this.head = { yaw: 0, pitch: 0, roll: 0 }; this.pose = null;
    this.eye = { yaw: 0, pitch: 0, per: null }; this.dirty = true; this.frameNo = 0; this.mouth = 0;
  }
  ProceduralAvatar.prototype = Object.create(WA.AvatarModel.prototype);
  ProceduralAvatar.prototype.constructor = ProceduralAvatar;
  ProceduralAvatar.SUPPORTED = SUPPORTED;

  ProceduralAvatar.prototype.onAttach = function (scene, renderer) {
    this.renderer = renderer; this.api = WA.createAvatar3D(renderer); this.api.attachTo(scene); this.object3D = this.api.group; this.loaded = true;
    this.face = this._face(); this.api.setFace(this.face);
  };
  /* The procedural materials were tuned for a dimmer environment: scale their reflection to the studio's. */
  ProceduralAvatar.prototype.setEnvIntensity = function (k) {
    var M = this.api && this.api.materials; if (!M) return;
    if (!this._env0) { this._env0 = {}; for (var n in M) if ('envMapIntensity' in M[n]) this._env0[n] = M[n].envMapIntensity; }
    for (var n2 in this._env0) M[n2].envMapIntensity = this._env0[n2] * k * 0.45;
  };
  ProceduralAvatar.prototype.load = function () { return Promise.resolve(this.getInfo()); };

  /* ARKit channels (subject's left/right) -> the legacy face parameters. Legacy "L" is the figure's screen-left, which is the subject's right. */
  ProceduralAvatar.prototype._face = function () {
    var c = this.ch, g = function (n) { return c[n] || 0; }, f = {};
    function side(S, A) {                               // S = legacy suffix, A = ARKit side
      f['browUp' + S] = clamp(g('browOuterUp' + A) * 0.85 + g('browInnerUp') * 0.2 - g('browDown' + A) * 0.4, -1, 1);
      f['browInner' + S] = clamp(g('browInnerUp') * 0.95 - g('browDown' + A) * 1.3, -1, 1);
      f['browOuter' + S] = clamp(g('browOuterUp' + A) * 0.35 - g('browDown' + A) * 0.2, -1, 1);
      f['lid' + S] = clamp(0.75 * (1 - g('eyeBlink' + A)) + g('eyeWide' + A) * 0.45, 0, 1.15);
      f['smile' + S] = clamp(g('mouthSmile' + A) - g('mouthFrown' + A) * 0.3, 0, 1);
    }
    side('L', 'Right'); side('R', 'Left');
    f.squint = clamp((g('eyeSquintLeft') + g('eyeSquintRight')) / 2, 0, 1);
    f.cheek = clamp((g('cheekSquintLeft') + g('cheekSquintRight')) / 2, 0, 1);
    f.lipPress = clamp(Math.max(g('mouthPressLeft'), g('mouthPressRight'), g('mouthClose') * 0.8), 0, 1);
    f.mouthWide = clamp((g('mouthStretchLeft') + g('mouthStretchRight')) * 0.65 - (g('mouthFunnel') + g('mouthPucker')) * 0.8, -1, 1);
    f.clench = g('jawClench'); f.jaw = clamp(g('jawOpen'), 0, 1.2); f.cornerDown = 0; f.blink = 0;
    return f;
  };

  ProceduralAvatar.prototype.setExpression = function (channels) {
    for (var k in channels) { if (Math.abs((this.ch[k] || 0) - channels[k]) > 0.004) this.dirty = true; this.ch[k] = channels[k]; }
  };
  ProceduralAvatar.prototype.setViseme = function () {};                  // no native visemes: the FaceMixer converts them
  ProceduralAvatar.prototype.setMouthLevel = function (v) { this.mouth = v; };
  ProceduralAvatar.prototype.setEyeTarget = function (yaw, pitch, per) { this.eye.yaw = yaw; this.eye.pitch = pitch; this.eye.per = per || null; };
  ProceduralAvatar.prototype.setHeadRotation = function (yaw, pitch, roll) { this.head.yaw = yaw; this.head.pitch = pitch; this.head.roll = roll; };
  ProceduralAvatar.prototype.setBodyPose = function (p) { this.pose = p; };
  ProceduralAvatar.prototype.setIdle = function () {};
  ProceduralAvatar.prototype.setSpeaking = function () {};

  ProceduralAvatar.prototype.update = function () {
    if (!this.api) return;
    var p = this.pose || {}, h = this.head;
    this.api.setPose({ headYaw: h.yaw, headPitch: h.pitch, headRoll: h.roll, breath: p.breath, chest: p.chest, sway: p.sway, bodyRoll: p.bodyRoll, bodyYaw: p.bodyYaw, armSwing: p.armSwing });
    this.api.setGaze(this.eye.yaw, this.eye.pitch, this.eye.per);
    // the face mesh is rebuilt on the CPU, so it is only rebuilt when a channel changed noticeably
    if (this.dirty) { this.face = this._face(); this.api.setFace(this.face); this.dirty = false; }
  };

  ProceduralAvatar.prototype.getLandmarks = function () {
    var L = this.api ? this.api.landmarks : { headCenterY: 6.55, eyeY: 6.585 };
    return { height: 7.05, headHeight: 1.0, headTopY: 7.05, headCenterY: L.headCenterY, chinY: 6.07, eyeY: L.eyeY, shoulderY: 5.55, chestY: 4.9, hipsY: 3.5 };
  };
  ProceduralAvatar.prototype.capabilities = function () { return { morphTargets: false, visemes: false, eyeBones: false, eyeMorphs: false, jaw: true, body: true, tongue: false, animations: false, channels: SUPPORTED.slice() }; };
  ProceduralAvatar.prototype.getInfo = function () {
    var tri = 0; if (this.object3D) this.object3D.traverse(function (o) { if (o.isMesh && o.geometry) tri += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
    return { kind: 'procedural', name: 'Procedural fallback', triangles: Math.round(tri), supportedChannels: SUPPORTED.length, of: C.ALL.length };
  };
  ProceduralAvatar.prototype.getRigReport = function () {
    var miss = C.ALL.filter(function (c) { return SUPPORTED.indexOf(c) < 0; });
    return { kind: 'procedural', grade: 'fallback', channels: { resolved: SUPPORTED.length, total: C.ALL.length, missing: miss }, notes: ['Fallback model: a subset of the ARKit channels, no native visemes. Use a rigged GLB for production.'] };
  };
  ProceduralAvatar.prototype.dispose = function () {
    if (!this.object3D) return;
    var seen = [];
    this.object3D.traverse(function (o) { if (o.geometry) o.geometry.dispose(); var m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(function (x) { if (seen.indexOf(x) < 0) { seen.push(x); ['map', 'emissiveMap', 'bumpMap', 'normalMap'].forEach(function (k) { if (x[k]) x[k].dispose(); }); x.dispose(); } }); });
    if (this.object3D.parent) this.object3D.parent.remove(this.object3D);
    this.object3D = null; this.api = null; this.loaded = false;
  };

  WA.ProceduralAvatar = ProceduralAvatar;
})(typeof window !== 'undefined' ? window : globalThis);
