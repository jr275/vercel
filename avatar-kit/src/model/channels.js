/*
 * Canonical face channels: the one vocabulary shared by every controller and every model.
 *
 * Controllers (expression, speech, blink, micro-expression) write these names.
 * Models (procedural or GLB) read them. Nothing else crosses the boundary.
 *
 * The names are Apple's ARKit blendshape set (52), a de facto standard that most
 * professional character pipelines can export. Speech uses the 15 Oculus visemes.
 * "Left" and "Right" are the SUBJECT's left and right, as in ARKit.
 * One extension channel, jawClench, is not part of ARKit; models without it ignore it.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit;

  var ARKIT = [
    'eyeBlinkLeft', 'eyeLookDownLeft', 'eyeLookInLeft', 'eyeLookOutLeft', 'eyeLookUpLeft', 'eyeSquintLeft', 'eyeWideLeft',
    'eyeBlinkRight', 'eyeLookDownRight', 'eyeLookInRight', 'eyeLookOutRight', 'eyeLookUpRight', 'eyeSquintRight', 'eyeWideRight',
    'jawForward', 'jawLeft', 'jawRight', 'jawOpen',
    'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight',
    'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight', 'mouthDimpleLeft', 'mouthDimpleRight',
    'mouthStretchLeft', 'mouthStretchRight', 'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
    'mouthPressLeft', 'mouthPressRight', 'mouthLowerDownLeft', 'mouthLowerDownRight', 'mouthUpperUpLeft', 'mouthUpperUpRight',
    'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
    'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight', 'noseSneerLeft', 'noseSneerRight', 'tongueOut'
  ];
  var EXTENSION = ['jawClench'];
  var VISEMES = ['viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD', 'viseme_kk', 'viseme_CH', 'viseme_SS',
    'viseme_nn', 'viseme_RR', 'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U'];

  /* The channels a model needs before it can carry a conversation convincingly. */
  var ESSENTIAL = ['jawOpen', 'eyeBlinkLeft', 'eyeBlinkRight', 'mouthSmileLeft', 'mouthSmileRight', 'browInnerUp',
    'browDownLeft', 'browDownRight', 'mouthFunnel', 'mouthPucker'];

  /*
   * How each viseme looks in ARKit channels. Used when a model has ARKit blendshapes but no
   * viseme blendshapes, which is the common case. These are starting values, tuned by eye on
   * a neutral rig. A model can override any of them in its RigMap (visemeRecipes).
   */
  var VISEME_TO_ARKIT = {
    viseme_sil: {},
    viseme_PP: { mouthPressLeft: 0.55, mouthPressRight: 0.55, mouthClose: 0.35, mouthRollUpper: 0.2, mouthRollLower: 0.2 },
    viseme_FF: { mouthRollLower: 0.55, mouthUpperUpLeft: 0.25, mouthUpperUpRight: 0.25, jawOpen: 0.06 },
    viseme_TH: { jawOpen: 0.12, mouthLowerDownLeft: 0.15, mouthLowerDownRight: 0.15, tongueOut: 0.35, mouthUpperUpLeft: 0.1, mouthUpperUpRight: 0.1 },
    viseme_DD: { jawOpen: 0.2, mouthLowerDownLeft: 0.12, mouthLowerDownRight: 0.12, mouthUpperUpLeft: 0.1, mouthUpperUpRight: 0.1 },
    viseme_kk: { jawOpen: 0.25, mouthLowerDownLeft: 0.1, mouthLowerDownRight: 0.1, mouthStretchLeft: 0.06, mouthStretchRight: 0.06 },
    viseme_CH: { mouthFunnel: 0.45, mouthPucker: 0.25, jawOpen: 0.15, mouthShrugUpper: 0.1 },
    viseme_SS: { mouthStretchLeft: 0.35, mouthStretchRight: 0.35, jawOpen: 0.08, mouthSmileLeft: 0.2, mouthSmileRight: 0.2, mouthUpperUpLeft: 0.1, mouthUpperUpRight: 0.1 },
    viseme_nn: { jawOpen: 0.12, mouthLowerDownLeft: 0.08, mouthLowerDownRight: 0.08, tongueOut: 0.1 },
    viseme_RR: { mouthFunnel: 0.35, mouthPucker: 0.2, jawOpen: 0.18 },
    viseme_aa: { jawOpen: 0.65, mouthLowerDownLeft: 0.3, mouthLowerDownRight: 0.3, mouthUpperUpLeft: 0.15, mouthUpperUpRight: 0.15 },
    viseme_E: { jawOpen: 0.3, mouthStretchLeft: 0.4, mouthStretchRight: 0.4, mouthSmileLeft: 0.25, mouthSmileRight: 0.25, mouthLowerDownLeft: 0.15, mouthLowerDownRight: 0.15 },
    viseme_I: { jawOpen: 0.2, mouthStretchLeft: 0.45, mouthStretchRight: 0.45, mouthSmileLeft: 0.2, mouthSmileRight: 0.2 },
    viseme_O: { jawOpen: 0.4, mouthFunnel: 0.75, mouthPucker: 0.15 },
    viseme_U: { jawOpen: 0.15, mouthPucker: 0.8, mouthFunnel: 0.45 }
  };

  var SET = {}; ARKIT.concat(EXTENSION).forEach(function (n) { SET[n] = true; });
  var VSET = {}; VISEMES.forEach(function (n) { VSET[n] = true; });

  WA.Channels = {
    ARKIT: ARKIT, EXTENSION: EXTENSION, ALL: ARKIT.concat(EXTENSION), VISEMES: VISEMES, ESSENTIAL: ESSENTIAL,
    VISEME_TO_ARKIT: VISEME_TO_ARKIT,
    isChannel: function (n) { return !!SET[n]; },
    isViseme: function (n) { return !!VSET[n]; },
    /* swap subject-left and subject-right */
    mirror: function (n) {
      if (/Left$/.test(n)) return n.replace(/Left$/, 'Right');
      if (/Right$/.test(n)) return n.replace(/Right$/, 'Left');
      return n;
    },
    /* converts viseme weights (0..1 each) to ARKit channels; the strongest viseme wins when they overlap */
    visemesToChannels: function (weights, out, recipes) {
      out = out || {}; recipes = recipes || VISEME_TO_ARKIT;
      for (var v in weights) {
        var w = weights[v]; if (!(w > 0.001)) continue;
        var rec = recipes[v]; if (!rec) continue;
        for (var ch in rec) {
          var val = rec[ch] * w;
          out[ch] = Math.min(1, Math.max(out[ch] || 0, val) + Math.min(out[ch] || 0, val) * 0.25);   // overlap adds a little, never past 1
        }
      }
      return out;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
