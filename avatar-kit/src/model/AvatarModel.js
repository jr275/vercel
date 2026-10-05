/*
 * AvatarModel: the contract between the animation system and a 3D character.
 *
 *   AvatarAPI -> controllers -> AvatarModel -> ProceduralAvatar | GLBAvatar
 *
 * The controllers know nothing about meshes, bones or morph targets. They hand a model:
 *   - face channels (canonical ARKit names, 0..1)
 *   - viseme weights (canonical Oculus names, 0..1), only if the model says it has native visemes
 *   - an eye target, a head rotation, a body pose
 * and call update(dt) once per frame. A model decides how to express each of those with
 * whatever it has (morph targets, bones, clips) and says what it can do in capabilities().
 *
 * To add a new model type: extend this class, implement the methods below, and register it
 * with loadAvatar(). The AvatarModel.check() helper tells you what is still missing.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit;

  /*
   * Landmarks, in scene units, feet at y = 0. The camera and the lighting are built from these
   * instead of fixed numbers, so any model that reports them frames and lights correctly.
   *   height        total height
   *   headHeight    chin to top of head
   *   headTopY, headCenterY, eyeY, chinY, shoulderY, chestY, hipsY
   */
  function AvatarModel() {
    WA.Emitter.call(this);
    this.object3D = null;          // THREE.Object3D to add to the scene
    this.loaded = false;
  }
  AvatarModel.prototype = Object.create(WA.Emitter.prototype);
  AvatarModel.prototype.constructor = AvatarModel;

  /** Build or fetch everything. Resolves with getInfo(). */
  AvatarModel.prototype.load = function () { return Promise.reject(WA.AvatarError('NOT_IMPLEMENTED', 'load() not implemented')); };
  /** Release geometry, materials, textures, mixers. Safe to call twice. */
  AvatarModel.prototype.dispose = function () {};

  /** channels: partial map of canonical ARKit names (and jawClench) to 0..1. Absent channels keep 0. */
  AvatarModel.prototype.setExpression = function (channels) {};
  /** weights: map of canonical Oculus viseme names to 0..1. Only called if capabilities().visemes is true. */
  AvatarModel.prototype.setViseme = function (weights) {};
  /** Raw mouth openness 0..1 after composition. A model with no mouth morphs can drive a jaw bone with it. */
  AvatarModel.prototype.setMouthLevel = function (level) {};
  /** yaw > 0 looks toward screen right, pitch > 0 looks up, both in radians. */
  AvatarModel.prototype.setEyeTarget = function (yaw, pitch) {};
  /** Head rotation in radians. pitch > 0 tilts the chin down; roll > 0 tilts toward screen right. */
  AvatarModel.prototype.setHeadRotation = function (yaw, pitch, roll) {};
  /**
   * pose: { breath 0..1, chest 0..1, sway, bodyRoll, bodyYaw, shoulderL, shoulderR (-1..1), lean (-1..1), armSwing }
   * sway is in head units (a fraction of a head height).
   */
  AvatarModel.prototype.setBodyPose = function (pose) {};
  /** Turn the model's own idle animation on or off, or scale it (0..1). */
  AvatarModel.prototype.setIdle = function (intensity) {};
  /** Let the model play a speaking clip or posture while audio plays. */
  AvatarModel.prototype.setSpeaking = function (on) {};

  /** Called once per frame after all setters. Models apply deferred work here. */
  AvatarModel.prototype.update = function (dt) {};

  AvatarModel.prototype.getLandmarks = function () { return null; };
  /** What this model can do: { morphTargets, visemes, eyeBones, eyeMorphs, jaw, body, tongue, animations }. */
  AvatarModel.prototype.capabilities = function () { return {}; };
  /** { kind, name, triangles, materials, textures, ... } */
  AvatarModel.prototype.getInfo = function () { return { kind: 'unknown' }; };
  /** Rig report (see RigMap.resolve) or null if the model has no rig to report on. */
  AvatarModel.prototype.getRigReport = function () { return null; };
  /** Light scene hooks a model may need: renderer settings, shadow focus. Optional. */
  AvatarModel.prototype.onAttach = function (scene, renderer) {};

  AvatarModel.REQUIRED = ['load', 'dispose', 'setExpression', 'setViseme', 'setMouthLevel', 'setEyeTarget',
    'setHeadRotation', 'setBodyPose', 'setIdle', 'setSpeaking', 'update', 'getLandmarks', 'capabilities', 'getInfo'];

  /** Returns the names of the contract methods an object does not implement as functions. Empty = conforms. */
  AvatarModel.check = function (obj) {
    return AvatarModel.REQUIRED.filter(function (m) { return !obj || typeof obj[m] !== 'function'; });
  };

  AvatarModel.defaultLandmarks = function (height) {
    height = height || 7.05;
    var h = height / 7.2;
    return { height: height, headHeight: h, headTopY: height, headCenterY: height - h / 2, chinY: height - h,
      eyeY: height - h * 0.47, shoulderY: height - h * 1.5, chestY: height - h * 2.1, hipsY: height * 0.5 };
  };

  WA.AvatarModel = AvatarModel;
})(typeof window !== 'undefined' ? window : globalThis);
