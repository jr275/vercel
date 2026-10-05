/* ===== core/util.js ===== */
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

/* ===== model/channels.js ===== */
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

/* ===== model/RigMap.js ===== */
/*
 * RigMap: how a particular 3D model's names map onto the canonical channels.
 *
 * Nothing here assumes a model's names. A RigMap is data:
 *   morphs   canonical channel  -> list of names the model might use for it
 *   visemes  canonical viseme   -> list of names
 *   bones    slot (head, neck, ...) -> list of names
 *   clips    idle / talk        -> list of animation names
 *   options  swapLeftRight, morphGain/visemeGain/gains{channel:k}, ignoreTokens (name prefixes to disregard when matching),
 *            eyeMode ('auto'|'bones'|'morphs'), landmarks (override), fitHeight
 *
 * resolve() reads what a loaded model actually contains and produces:
 *   - the concrete mapping (canonical -> names present in the model)
 *   - a report: what was found, what is missing, how complete the rig is
 *
 * Matching goes in order: explicit RigMap names, the built-in aliases, then a token match
 * that tolerates the usual naming styles (jawOpen, Jaw_Open, jaw-open, blendShape1.jawOpen,
 * Mouth_Smile_L). It never guesses on a different meaning: an unmatched channel is reported.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, C = WA.Channels;

  /* ---------- name handling ---------- */
  function strip(name) {                     // drop namespaces: "mixamorig:Head", "Armature|Head", "Wolf3D_Head.jawOpen"
    var s = String(name);
    var cut = Math.max(s.lastIndexOf(':'), s.lastIndexOf('|'), s.lastIndexOf('.'));
    return cut >= 0 && cut < s.length - 1 ? s.slice(cut + 1) : s;
  }
  function norm(name) { return strip(name).toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function tokens(name) {
    return strip(name).replace(/([a-z0-9])([A-Z])/g, '$1_$2').split(/[^A-Za-z0-9]+/).filter(Boolean).map(function (t) { return t.toLowerCase(); });
  }
  var LEFT = { left: 1, l: 1, lt: 1 }, RIGHT = { right: 1, r: 1, rt: 1 };
  function splitSide(toks) {
    var side = null, rest = [];
    toks.forEach(function (t) { if (LEFT[t]) side = 'Left'; else if (RIGHT[t]) side = 'Right'; else rest.push(t); });
    return { side: side, rest: rest };
  }
  // vocabulary differences that are really the same thing
  var SYN = { lid: 'eye', eyelid: 'eye', mouth: 'mouth', lips: 'mouth', brows: 'brow', eyebrow: 'brow', raise: 'up', lower: 'down', open: 'open', cheeks: 'cheek' };
  function canonTokens(name, ignore) {
    var sp = splitSide(tokens(name));
    var rest = ignore && ignore.length ? sp.rest.filter(function (t) { return ignore.indexOf(t) < 0; }) : sp.rest;
    return { side: sp.side, rest: rest.map(function (t) { return SYN[t] || t; }).sort().join('|') };
  }

  /* ---------- presets ---------- */
  function identity(list) { var o = {}; list.forEach(function (n) { o[n] = [n]; }); return o; }
  var ALIASES = {                              // extra names seen in common pipelines; added to every preset
    jawOpen: ['Jaw_Open', 'mouthOpen', 'Mouth_Open', 'V_Open'],
    eyeBlinkLeft: ['Eye_Blink_L', 'blinkLeft', 'Blink_L', 'eyesClosedL'],
    eyeBlinkRight: ['Eye_Blink_R', 'blinkRight', 'Blink_R', 'eyesClosedR'],
    mouthSmileLeft: ['Mouth_Smile_L', 'smileLeft'], mouthSmileRight: ['Mouth_Smile_R', 'smileRight'],
    browInnerUp: ['Brow_Raise_Inner', 'browsInnerUp', 'Brow_Raise_Inner_L'],
    mouthFunnel: ['Mouth_Funnel', 'Mouth_Pucker_Up_L'], mouthPucker: ['Mouth_Pucker'],
    mouthClose: ['Mouth_Close'], tongueOut: ['Tongue_Out', 'Tongue_Tip_Up']
  };
  var VISEME_ALIASES = {
    viseme_sil: ['sil', 'viseme_0', 'V_None', 'Mouth_Close'], viseme_PP: ['PP', 'V_Explosive', 'B_M_P'], viseme_FF: ['FF', 'V_Dental_Lip', 'F_V'],
    viseme_TH: ['TH', 'V_Tongue_out'], viseme_DD: ['DD', 'V_Tongue_up', 'T_L_D_N'], viseme_kk: ['kk', 'K_G_H_NG', 'V_Tongue_Raise'],
    viseme_CH: ['CH', 'Ch_J', 'V_Affricate', 'S_Z'], viseme_SS: ['SS', 'S_Z', 'V_Lip_Open'], viseme_nn: ['nn', 'T_L_D_N'],
    viseme_RR: ['RR', 'R', 'V_Tongue_Curl_U'], viseme_aa: ['aa', 'AE_AX_AH', 'V_Open', 'Ah'], viseme_E: ['E', 'EE', 'Er', 'Eh'],
    viseme_I: ['I', 'Ih', 'V_Wide'], viseme_O: ['O', 'Oh', 'V_Round', 'W_OO'], viseme_U: ['U', 'Oo', 'V_Round']
  };
  var BONES = {
    hips: ['Hips', 'pelvis', 'root'], spine: ['Spine'], spine1: ['Spine1', 'spine_01', 'Spine01'], spine2: ['Spine2', 'Chest', 'spine_02', 'UpperChest'],
    neck: ['Neck', 'neck_01'], head: ['Head'],
    leftShoulder: ['LeftShoulder', 'Shoulder_L', 'clavicle_l'], rightShoulder: ['RightShoulder', 'Shoulder_R', 'clavicle_r'],
    leftEye: ['LeftEye', 'Eye_L', 'eye_l', 'EyeLeft'], rightEye: ['RightEye', 'Eye_R', 'eye_r', 'EyeRight'], jaw: ['Jaw', 'jaw_01', 'CC_Base_JawRoot']
  };
  var CLIPS = { idle: ['idle', 'Idle', 'breathing', 'Breathing', 'standing'], talk: ['talk', 'Talk', 'talking', 'Talking', 'speak'] };

  function basePreset(name, extras) {
    var morphs = identity(C.ALL);
    for (var k in ALIASES) morphs[k] = morphs[k].concat(ALIASES[k]);
    var visemes = identity(C.VISEMES);
    for (var v in VISEME_ALIASES) visemes[v] = visemes[v].concat(VISEME_ALIASES[v]);
    var bones = {}; for (var b in BONES) bones[b] = BONES[b].slice();
    var clips = { idle: CLIPS.idle.slice(), talk: CLIPS.talk.slice() };
    var rm = { name: name, morphs: morphs, visemes: visemes, bones: bones, clips: clips, visemeRecipes: {},
      options: { swapLeftRight: false, morphGain: 1, visemeGain: 1, eyeMode: 'auto', fitHeight: 7.05, headsTall: 7.2, headYawLimit: 0.7, eyeYawLimit: 0.5, eyePitchLimit: 0.35 } };
    if (extras) WA.RigMap.merge(rm, extras);
    return rm;
  }

  var RigMap = {
    norm: norm, tokens: tokens,

    /* Built-in starting points. All of them are the same mapping plus a name and some options. */
    presets: {
      arkit: function () { return basePreset('arkit'); },
      /* ARKit blendshapes + Oculus visemes natively, Mixamo-style skeleton (a common export from avatar services) */
      'arkit-visemes': function () { return basePreset('arkit-visemes', { options: { visemeGain: 1 } }); },
      /* model without face morphs: only a jaw bone and eye bones */
      'bones-only': function () { return basePreset('bones-only', { options: { eyeMode: 'bones' } }); }
    },

    create: function (overrides, preset) {
      var make = RigMap.presets[preset || 'arkit'] || RigMap.presets.arkit;
      return RigMap.merge(make(), overrides || {});
    },

    /* deep-ish merge: arrays replace, objects merge, so a model only states what is different */
    merge: function (base, extra) {
      for (var k in extra) {
        var v = extra[k];
        if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) RigMap.merge(base[k], v);
        else base[k] = Array.isArray(v) ? v.slice() : v;
      }
      return base;
    },

    /*
     * inventory: { morphNames:[], boneNames:[], clipNames:[] }
     * returns { morphs: {channel: [names]}, visemes: {viseme: [names]}, bones: {slot: name}, clips: {idle,talk}, report }
     */
    resolve: function (rig, inv) {
      rig = rig || RigMap.create();
      var morphNames = inv.morphNames || [], boneNames = inv.boneNames || [], clipNames = inv.clipNames || [];
      var byNorm = {}; morphNames.forEach(function (n) { (byNorm[norm(n)] = byNorm[norm(n)] || []).push(n); });
      var byToken = {};
      var ignore = (rig.options.ignoreTokens || []).map(function (t) { return String(t).toLowerCase(); });
      morphNames.forEach(function (n) { var t = canonTokens(n, ignore); var key = t.rest + '#' + (t.side || ''); (byToken[key] = byToken[key] || []).push(n); });
      var swap = !!rig.options.swapLeftRight;

      function find(list, canonical, allowFuzzy) {
        for (var i = 0; i < list.length; i++) { var hit = byNorm[norm(list[i])]; if (hit) return { names: hit, how: i === 0 ? 'exact' : 'alias' }; }
        if (allowFuzzy) {
          var t = canonTokens(canonical), key = t.rest + '#' + (t.side || '');
          if (byToken[key]) return { names: byToken[key], how: 'tokens' };
        }
        return null;
      }

      var morphs = {}, found = [], missing = [], how = {};
      C.ALL.forEach(function (ch) {
        var target = swap ? C.mirror(ch) : ch;                         // a model authored with swapped sides: look for the mirrored name
        var list = (rig.morphs[target] || [target]).slice();
        var hit = find(list, target, true);
        if (hit) { morphs[ch] = hit.names; found.push(ch); how[ch] = hit.how; } else missing.push(ch);
      });

      var visemes = {}, vFound = [];
      C.VISEMES.forEach(function (v) {
        var hit = find(rig.visemes[v] || [v], v, false);
        if (hit) { visemes[v] = hit.names; vFound.push(v); }
      });

      var bones = {};
      var bNorm = {}; boneNames.forEach(function (n) { bNorm[norm(n)] = n; });
      for (var slot in rig.bones) {
        var cands = rig.bones[slot];
        for (var i = 0; i < cands.length; i++) { var hitB = bNorm[norm(cands[i])]; if (hitB) { bones[slot] = hitB; break; } }
      }
      var clips = {};
      ['idle', 'talk'].forEach(function (k) {
        var list = rig.clips[k] || [];
        for (var i = 0; i < list.length; i++) { var m = clipNames.filter(function (n) { return norm(n) === norm(list[i]) || norm(n).indexOf(norm(list[i])) >= 0; })[0]; if (m) { clips[k] = m; break; } }
      });

      var essentialMissing = C.ESSENTIAL.filter(function (c) { return !morphs[c]; });
      var coverage = found.length / C.ARKIT.length;
      var boneDriven = !morphNames.length && !!(bones.head || bones.jaw);       // no face morphs: a head/jaw-bone model is usable, just limited
      var grade = coverage >= 0.9 ? 'full' : coverage >= 0.7 ? 'good' : essentialMissing.length === 0 ? 'basic' : boneDriven ? 'bones-only' : 'insufficient';
      var warnings = [];
      if (!morphNames.length && !(bones.jaw || bones.head)) warnings.push('The model has no morph targets and no jaw/head bones: it can only be posed, not animated.');
      if (!morphNames.length && bones.jaw) warnings.push('No morph targets found; speech will move the jaw bone only.');
      if (morphNames.length && essentialMissing.length) warnings.push('Missing essential channels: ' + essentialMissing.join(', '));
      if (!bones.head) warnings.push('No head bone found: head rotation will be ignored.');
      if (!bones.leftEye && !bones.rightEye && !(morphs.eyeLookUpLeft || morphs.eyeLookOutLeft)) warnings.push('No eye bones or eye-look morphs found: gaze will be ignored.');
      var unmatched = morphNames.filter(function (n) {
        for (var c in morphs) if (morphs[c].indexOf(n) >= 0) return false;
        for (var v in visemes) if (visemes[v].indexOf(n) >= 0) return false;
        return true;
      });
      return {
        morphs: morphs, visemes: visemes, bones: bones, clips: clips,
        report: {
          grade: grade, coverage: +coverage.toFixed(3), found: found, missing: missing, matchedBy: how,
          visemesFound: vFound, visemesNative: vFound.length >= 8,
          essentialMissing: essentialMissing, unmatchedMorphs: unmatched, warnings: warnings,
          counts: { morphs: morphNames.length, bones: boneNames.length, clips: clipNames.length }
        }
      };
    }
  };

  WA.RigMap = RigMap;
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== model/AvatarModel.js ===== */
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

/* ===== control/VisemeEngine.js ===== */
/*
 * VisemeEngine: a timeline of speech sounds in, mouth shape weights out.
 *
 * Input is whatever a TTS provides:
 *   - phonemes with timestamps (ARPAbet), optionally durations
 *   - Azure viseme ids (0..21) with audio offsets
 *   - Amazon Polly viseme speech marks
 *   - character timings (the shape ElevenLabs-style alignment returns)
 *   - Oculus visemes directly
 * It is normalised to events { t, d, v, w } in seconds, then sampled at any time.
 *
 * Sampling is not "show the current viseme". Each sound has an anticipation, an attack and
 * a release, so neighbouring sounds overlap the way real articulation does (coarticulation),
 * and lip closures (p, b, m, f, v) take priority over open vowels while they last.
 *
 * The mappings from provider ids to Oculus visemes are documented tables: check them against
 * your voice's documentation before shipping, and override with opts.map if your voice differs.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, V = WA.Channels.VISEMES, smooth = WA.smooth;
  var P = function (n) { return 'viseme_' + n; };

  var ARPABET = {
    AA: [P('aa')], AE: [P('aa')], AH: [P('aa'), 0.8], AO: [P('O')], AW: [P('O')], AY: [P('aa')], B: [P('PP')], CH: [P('CH')], D: [P('DD')],
    DH: [P('TH')], EH: [P('E')], ER: [P('RR')], EY: [P('E')], F: [P('FF')], G: [P('kk')], HH: [P('aa'), 0.3], IH: [P('I')], IY: [P('I')],
    JH: [P('CH')], K: [P('kk')], L: [P('nn')], M: [P('PP')], N: [P('nn')], NG: [P('kk')], OW: [P('O')], OY: [P('O')], P: [P('PP')],
    R: [P('RR')], S: [P('SS')], SH: [P('CH')], T: [P('DD')], TH: [P('TH')], UH: [P('U')], UW: [P('U')], V: [P('FF')], W: [P('U')],
    Y: [P('I')], Z: [P('SS')], ZH: [P('CH')], SIL: [P('sil')], SP: [P('sil')]
  };
  // Azure speech viseme ids 0..21 (documented IPA groups, mapped to the nearest Oculus viseme)
  var AZURE = ['sil', 'aa', 'aa', 'O', 'E', 'RR', 'I', 'U', 'O', 'O', 'O', 'aa', 'aa', 'RR', 'nn', 'SS', 'CH', 'TH', 'FF', 'DD', 'kk', 'PP'].map(P);
  var AZURE_W = { 12: 0.3 };
  // Amazon Polly viseme speech mark values
  var POLLY = { p: P('PP'), t: P('DD'), S: P('CH'), T: P('TH'), f: P('FF'), k: P('kk'), i: P('I'), r: P('RR'), s: P('SS'), u: P('U'),
    '@': P('aa'), a: P('aa'), e: P('E'), E: P('E'), o: P('O'), O: P('O'), sil: P('sil') };
  // coarse letter-to-viseme fallback for providers that only give character timings
  var LETTER = { a: 'aa', e: 'E', i: 'I', o: 'O', u: 'U', y: 'I', w: 'U', b: 'PP', p: 'PP', m: 'PP', f: 'FF', v: 'FF', t: 'DD', d: 'DD',
    n: 'nn', l: 'nn', s: 'SS', z: 'SS', c: 'kk', k: 'kk', g: 'kk', q: 'kk', x: 'kk', j: 'CH', r: 'RR', h: 'aa' };
  var LETTER_W = { h: 0.3 };

  var GAIN = { viseme_sil: 0, viseme_PP: 1, viseme_FF: 0.95, viseme_TH: 0.8, viseme_DD: 0.7, viseme_kk: 0.65, viseme_CH: 0.9, viseme_SS: 0.8,
    viseme_nn: 0.6, viseme_RR: 0.8, viseme_aa: 1, viseme_E: 0.95, viseme_I: 0.9, viseme_O: 1, viseme_U: 1 };
  var VOWELS = { viseme_aa: 1, viseme_E: 1, viseme_I: 1, viseme_O: 1, viseme_U: 1 };

  /* ---------- timeline ---------- */
  function Timeline(events) {
    this.events = events.filter(function (e) { return e && V.indexOf(e.v) >= 0 && isFinite(e.t); })
      .map(function (e) { return { t: +e.t, d: e.d > 0 ? +e.d : 0, v: e.v, w: e.w == null ? 1 : e.w }; })
      .sort(function (a, b) { return a.t - b.t; });
    this.duration = this.events.length ? this.events[this.events.length - 1].t + (this.events[this.events.length - 1].d || 0.15) : 0;
  }
  function num(x, d) { return x == null || !isFinite(x) ? d : +x; }
  function secs(item, unit) {
    if (item.t != null) return +item.t * (unit === 'ms' ? 0.001 : 1);
    if (item.start != null) return +item.start * (unit === 'ms' ? 0.001 : 1);
    if (item.time != null) return +item.time * 0.001;                         // Polly: ms
    if (item.offsetMs != null) return +item.offsetMs * 0.001;
    if (item.offset != null) return +item.offset * 0.001;                      // ms
    if (item.audioOffset != null) return +item.audioOffset / 1e7;              // Azure: ticks of 100 ns
    return NaN;
  }
  Timeline.fromEvents = function (list) { return new Timeline(list.map(function (e) { return { t: e.t, d: e.d, v: e.v.indexOf('viseme_') === 0 ? e.v : P(e.v), w: e.w }; })); };
  Timeline.fromPhonemes = function (list, opts) {
    var map = (opts && opts.map) || ARPABET, unit = (opts && opts.unit) || 's';
    return new Timeline(list.map(function (p) {
      var ph = String(p.ph || p.phoneme || p.p || '').toUpperCase().replace(/[0-9]/g, ''), m = map[ph];
      if (!m) return null;
      var dur = p.d != null ? p.d : p.duration;
      return { t: secs(p, unit), d: dur != null ? dur * (unit === 'ms' ? 0.001 : 1) : 0, v: m[0], w: m[1] };
    }).filter(Boolean));
  };
  Timeline.fromAzure = function (list, opts) {
    var map = (opts && opts.map) || AZURE;
    return new Timeline(list.map(function (e) {
      var id = e.id != null ? e.id : e.visemeId, v = map[id];
      return v ? { t: secs(e, 'ms'), d: 0, v: v, w: AZURE_W[id] } : null;
    }).filter(Boolean));
  };
  Timeline.fromPolly = function (marks) {
    if (typeof marks === 'string') marks = marks.split('\n').filter(Boolean).map(function (l) { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
    return new Timeline(marks.filter(function (m) { return m.type === 'viseme' || m.value; }).map(function (m) {
      var v = POLLY[m.value]; return v ? { t: secs(m, 'ms'), d: 0, v: v } : null;
    }).filter(Boolean));
  };
  Timeline.fromCharacters = function (al) {
    var chars = al.characters || al.chars, st = al.character_start_times_seconds || al.starts, en = al.character_end_times_seconds || al.ends, ev = [];
    if (!chars) return new Timeline([]);
    for (var i = 0; i < chars.length; i++) {
      var ch = String(chars[i]).toLowerCase(), k = LETTER[ch];
      if (ch === 't' && chars[i + 1] === 'h') k = 'TH';
      if (ch === 's' && chars[i + 1] === 'h') k = 'CH';
      if (ch === 'c' && chars[i + 1] === 'h') k = 'CH';
      if (!k) continue;
      var ps = +st[i], pe = en ? +en[i] : NaN;
      ev.push({ t: ps, d: isFinite(pe) ? pe - ps : 0, v: P(k), w: LETTER_W[ch] });
    }
    return new Timeline(ev);
  };
  /* Picks the right constructor from the shape of the input or opts.provider. */
  Timeline.auto = function (input, opts) {
    opts = opts || {};
    if (input instanceof Timeline) return input;
    var p = opts.provider;
    if (input && input.characters || (input && input.chars)) return Timeline.fromCharacters(input);
    if (typeof input === 'string' || p === 'polly') return Timeline.fromPolly(input);
    if (!Array.isArray(input) || !input.length) return new Timeline([]);
    var f = input[0];
    if (p === 'azure' || f.visemeId != null || (f.id != null && f.audioOffset != null) || (f.id != null && f.offsetMs != null)) return Timeline.fromAzure(input, opts);
    if (p === 'phonemes' || p === 'arpabet' || f.ph != null || f.phoneme != null) return Timeline.fromPhonemes(input, opts);
    if (f.type === 'viseme') return Timeline.fromPolly(input);
    return Timeline.fromEvents(input);
  };

  /* ---------- engine ---------- */
  function VisemeEngine(opts) {
    this.o = WA.assign({ anticipation: 0.045, attack: 0.05, release: 0.075, defaultDur: 0.11, maxDur: 0.32, articulation: 1, gap: 0.14 }, opts || {});
    this.tl = null; this.lastActive = -1; this._seed = 0;
  }
  VisemeEngine.prototype.load = function (timeline) { this.tl = timeline; this.lastActive = -1; };
  VisemeEngine.prototype.clear = function () { this.tl = null; };
  VisemeEngine.prototype.hasTimeline = function () { return !!(this.tl && this.tl.events.length); };
  VisemeEngine.prototype.duration = function () { return this.tl ? this.tl.duration : 0; };

  /* Fills `out` (all 15 visemes) for time t in seconds. Returns { active, silence } where silence is seconds since the last sound. */
  VisemeEngine.prototype.sample = function (t, out) {
    var i, n = V.length;
    for (i = 0; i < n; i++) out[V[i]] = 0;
    if (!this.tl) return { active: false, silence: 99 };
    var E = this.tl.events, o = this.o, A = o.anticipation, active = false;
    // first event that starts after the window of interest
    var lo = 0, hi = E.length;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (E[mid].t > t + A) hi = mid; else lo = mid + 1; }
    for (i = lo - 1; i >= 0 && i > lo - 9; i--) {
      var ev = E[i], next = E[i + 1];
      var dur = ev.d || o.defaultDur, end = ev.t + Math.min(ev.d ? 1.2 : o.maxDur, dur);       // a duration given by the provider is honoured; a guessed one is capped
      if (next && next.t - end < o.gap && !ev.d) end = Math.min(end, next.t + o.release * 0.5);     // overlap into the next sound
      else if (next && !ev.d) end = Math.max(end, Math.min(next.t, ev.t + o.maxDur));            // hold until the next sound
      var rise = smooth(ev.t - A, ev.t + o.attack * 0.5, t), fall = 1 - smooth(end - o.release * 0.5, end + o.release, t);
      var w = rise * fall * ev.w * GAIN[ev.v] * o.articulation;
      if (w > out[ev.v]) out[ev.v] = w;
      if (w > 0.03) active = true;
    }
    // lip closures win over open vowels while they last
    var closure = Math.max(out.viseme_PP, out.viseme_FF * 0.6);
    if (closure > 0.05) for (var vw in VOWELS) out[vw] *= 1 - 0.75 * closure;
    var sum = 0; for (i = 0; i < n; i++) sum += out[V[i]];
    if (sum > 1.15) { var k = 1.15 / sum; for (i = 0; i < n; i++) out[V[i]] *= k; }
    if (active) this.lastActive = t;
    return { active: active, silence: this.lastActive < 0 ? (t < (E.length ? E[0].t : 0) ? 99 : t - Math.max(0, E.length ? E[0].t : 0)) : t - this.lastActive };
  };

  WA.VisemeTimeline = Timeline;
  WA.VisemeEngine = VisemeEngine;
  WA.VisemeTables = { ARPABET: ARPABET, AZURE: AZURE, POLLY: POLLY, LETTER: LETTER };
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== control/AmplitudeFallback.js ===== */
/*
 * AmplitudeFallback: when no phonetic data exists, derive a plausible mouth from the audio itself.
 *
 * It is a fallback, and it says so: amplitude alone cannot tell "b" from "o". It does two
 * things better than "mouth open = volume": it adapts to the speaker's loudness, and it
 * uses the balance of low and high frequencies to choose between round, open and wide shapes.
 * The output has the same form as VisemeEngine (weights over the 15 visemes), so everything
 * downstream is identical whichever source is active.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, clamp = WA.clamp, V = WA.Channels.VISEMES;

  function AmplitudeFallback() { this.ref = 0.05; this.level = 0; this.wide = 0; this.bias = 0; }

  /*
   * rms: RMS of the current audio block; lo/hi/all: summed spectrum energy below 800 Hz,
   * between 2.2 and 6.5 kHz, and total. Updates the smoothed level and wide.
   */
  AmplitudeFallback.prototype.update = function (dt, rms, lo, hi, all) {
    this.ref = Math.max(rms, this.ref * (1 - 0.15 * dt), 0.02);              // adaptive gain with slow release
    var lvl = rms < 0.004 ? 0 : clamp(rms / (this.ref * 0.85), 0, 1);
    var target = Math.pow(lvl, 0.85) * 0.95;
    var tw = all > 0 ? clamp((hi - lo) / all * 1.6, -0.7, 0.7) : 0;
    var up = target > this.level;
    this.level += (target - this.level) * (1 - Math.exp(-(up ? 30 : 15) * dt));
    this.wide += (tw - this.wide) * (1 - Math.exp(-14 * dt));
    return this;
  };

  /* Direct level (0..1) with an optional wide (-1..1), for callers that measure the audio themselves. */
  AmplitudeFallback.prototype.set = function (dt, level, wide) {
    var up = level > this.level;
    this.level += (level - this.level) * (1 - Math.exp(-(up ? 30 : 15) * dt));
    this.wide += ((wide || 0) - this.wide) * (1 - Math.exp(-14 * dt));
    return this;
  };

  /* Writes the 15 viseme weights for the current level and wide. */
  AmplitudeFallback.prototype.toVisemes = function (out) {
    for (var i = 0; i < V.length; i++) out[V[i]] = 0;
    var open = clamp(this.level, 0, 1), w = this.wide;
    if (open < 0.02) return out;
    var round = Math.max(0, -w), spread = Math.max(0, w);           // spectrum says: rounded (low) or spread (high) shape
    out.viseme_aa = open * (1 - 0.55 * (round + spread));
    out.viseme_E = open * spread * 0.7; out.viseme_I = open * spread * 0.3;
    out.viseme_O = open * round * 0.8; out.viseme_U = open * round * 0.35;
    return out;
  };

  AmplitudeFallback.prototype.reset = function () { this.level = 0; this.wide = 0; };

  WA.AmplitudeFallback = AmplitudeFallback;
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== control/LipSyncController.js ===== */
/*
 * LipSyncController: audio and/or phonetic data in, viseme weights out.
 *
 *   TTS -> audio (+ optional visemes/phonemes/characters) -> [ this ] -> 15 viseme weights -> model
 *
 * Source priority per frame:
 *   1. manual viseme (setViseme)            -- explicit override
 *   2. timeline (VisemeEngine)              -- when speak() received phonetic data; follows the audio clock
 *   3. external level (setLevel)            -- caller measures the audio itself
 *   4. amplitude (AmplitudeFallback)        -- audio only, no phonetic data
 *   5. synthetic                            -- demo mouth movement without audio
 * Whichever is active, the output has the same shape, so the model does not care.
 * speak() resolves when playback ends (or stop() is called); pause()/resume() freeze and continue both audio and timeline.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, clamp = WA.clamp, V = WA.Channels.VISEMES;

  // legacy names from v1 -> Oculus
  var LEGACY = { rest: 'viseme_sil', aa: 'viseme_aa', ee: 'viseme_E', ih: 'viseme_I', oh: 'viseme_O', oo: 'viseme_U', mm: 'viseme_PP', ff: 'viseme_FF', th: 'viseme_TH', ss: 'viseme_SS' };
  // how open the jaw is for each viseme, to derive a single "mouth level" for models without morphs
  var OPEN = { viseme_sil: 0, viseme_PP: 0, viseme_FF: 0.12, viseme_TH: 0.2, viseme_DD: 0.25, viseme_kk: 0.3, viseme_CH: 0.2, viseme_SS: 0.12,
    viseme_nn: 0.18, viseme_RR: 0.25, viseme_aa: 1, viseme_E: 0.45, viseme_I: 0.3, viseme_O: 0.6, viseme_U: 0.25 };

  function LipSyncController(opts) {
    WA.Emitter.call(this);
    this.o = WA.assign({ engine: null }, opts || {});
    this.ctx = null; this.analyser = null; this.time = null; this.freq = null;
    this.source = null; this.playing = false; this.paused = false; this.synthetic = false; this.ext = null;
    this.engine = new WA.VisemeEngine(this.o.engine); this.amp = new WA.AmplitudeFallback();
    this.manual = null; this._clock = 0; this._startedAt = 0; this._audioClock = null; this._done = null;
    this.visemes = {}; this.tmp = {}; V.forEach(function (v) { this.visemes[v] = 0; this.tmp[v] = 0; }, this);
    this.level = 0; this.wide = 0; this.sourceKind = 'none'; this.silence = 99;
    this.speaking = false;
  }
  LipSyncController.prototype = Object.create(WA.Emitter.prototype);
  LipSyncController.prototype.constructor = LipSyncController;

  LipSyncController.prototype._ensure = function () {
    if (!this.ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) throw WA.AvatarError('NO_WEBAUDIO', 'Web Audio is not available in this browser');
      this.ctx = new AC();
      this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 1024; this.analyser.smoothingTimeConstant = 0.35;
      this.time = new Float32Array(this.analyser.fftSize); this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    }
    if (this.ctx.state === 'suspended' && !this.paused) this.ctx.resume();
    return this.ctx;
  };

  LipSyncController.prototype.stop = function () {
    try { if (this.source && this.source.stop) this.source.stop(); } catch (e) {}
    try { if (this.source && this.source.pause) this.source.pause(); } catch (e) {}
    try { if (this.source && this.source.disconnect) this.source.disconnect(); } catch (e) {}
    this.source = null; this.playing = false; this.paused = false; this._audioClock = null;
    this.engine.clear(); this.amp.reset(); this._clock = 0;
    if (this.ctx && this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (e) {} }
    if (this._done) { var d = this._done; this._done = null; d(); }
  };

  LipSyncController.prototype.pause = function () {
    if (!this.playing || this.paused) return false;
    this.paused = true;
    try { if (this.source && this.source.pauseSource) this.source.pauseSource(); else if (this.ctx) this.ctx.suspend(); } catch (e) {}
    this.emit('pause'); return true;
  };
  LipSyncController.prototype.resume = function () {
    if (!this.playing || !this.paused) return false;
    this.paused = false;
    try { if (this.source && this.source.resumeSource) this.source.resumeSource(); else if (this.ctx) this.ctx.resume(); } catch (e) {}
    this.emit('resume'); return true;
  };

  /* Phonetic data in any supported shape -> loads the timeline. Safe with bad input (ignored with a warning event). */
  LipSyncController.prototype._loadPhonetics = function (opts) {
    var data = opts.visemes || opts.phonemes || opts.characters || opts.alignment || opts.marks;
    if (!data) { this.engine.clear(); return false; }
    try {
      var o = { provider: opts.provider || (opts.phonemes ? 'phonemes' : undefined), map: opts.map, unit: opts.unit };
      var tl = WA.VisemeTimeline.auto(data, o);
      if (opts.offset) tl = new WA.VisemeTimeline(tl.events.map(function (e) { return { t: e.t + opts.offset, d: e.d, v: e.v, w: e.w }; }));
      this.engine.load(tl); return tl.events.length > 0;
    } catch (e) { this.engine.clear(); this.emit('warning', WA.AvatarError('BAD_VISEME_DATA', 'Phonetic data ignored: ' + e.message, e)); return false; }
  };

  /*
   * Accepts: AudioBuffer, Float32Array PCM (opts.sampleRate), ArrayBuffer, Blob/File, HTMLAudioElement, MediaStream, URL string.
   * opts.visemes | phonemes | characters | alignment | marks, opts.provider ('azure'|'polly'|'phonemes'|...), opts.offset (s).
   * Without audio (src == null) and with phonetic data it runs the timeline on its own clock: used by tests and silent previews.
   */
  LipSyncController.prototype.speak = function (src, opts) {
    var self = this; opts = opts || {};
    this.stop();
    var hasPhon = this._loadPhonetics(opts);
    if (src == null) {
      if (!hasPhon) return Promise.reject(WA.AvatarError('NO_SOURCE', 'speak() needs audio or phonetic data'));
      return new Promise(function (resolve) {
        self.playing = true; self._clock = 0; self._done = function () { resolve(); };
        self.source = null; self._timed = self.engine.duration() + 0.25;
      });
    }
    var ctx;
    try { ctx = this._ensure(); } catch (e) { return Promise.reject(e); }
    return new Promise(function (resolve, reject) {
      function finish() { self.playing = false; self.paused = false; self.source = null; self._audioClock = null; self._done = null; resolve(); }
      function startBuffer(buf) {
        var node = ctx.createBufferSource(); node.buffer = buf;
        node.connect(self.analyser); self.analyser.connect(ctx.destination);
        node.onended = finish; self.source = node; self._done = finish; self.playing = true;
        var t0 = ctx.currentTime; self._audioClock = function () { return ctx.currentTime - t0; };
        node.start();
      }
      try {
        if (src && src.numberOfChannels && src.getChannelData) return startBuffer(src);
        if (typeof Float32Array !== 'undefined' && src instanceof Float32Array) {
          var pcm = ctx.createBuffer(1, src.length, opts.sampleRate || 22050); pcm.copyToChannel(src, 0); return startBuffer(pcm);
        }
        if (typeof root.MediaStream !== 'undefined' && src instanceof root.MediaStream) {
          var ms = ctx.createMediaStreamSource(src); ms.connect(self.analyser);
          self.source = ms; self.playing = true; self._done = finish; return;
        }
        if (typeof root.HTMLMediaElement !== 'undefined' && src instanceof root.HTMLMediaElement) {
          var el = src, node = el.__wa_node || (el.__wa_node = ctx.createMediaElementSource(el));
          node.connect(self.analyser); self.analyser.connect(ctx.destination);
          el.onended = finish;
          self.source = { pause: function () { el.pause(); }, pauseSource: function () { el.pause(); }, resumeSource: function () { el.play(); },
            disconnect: function () { try { node.disconnect(); } catch (e) {} } };
          self._audioClock = function () { return el.currentTime; };
          self._done = finish; self.playing = true; el.play().catch(function (e) { self.stop(); reject(WA.AvatarError('PLAY_BLOCKED', 'Audio could not start (needs a user gesture?)', e)); }); return;
        }
        if (typeof src === 'string') {
          var a = new root.Audio(); a.crossOrigin = 'anonymous'; a.src = src; return self.speak(a, opts).then(resolve, reject);
        }
        var readBuf = src instanceof ArrayBuffer ? Promise.resolve(src) : (src && src.arrayBuffer ? src.arrayBuffer() : Promise.reject(WA.AvatarError('BAD_AUDIO', 'Unsupported audio source')));
        readBuf.then(function (ab) { return new Promise(function (ok, no) { ctx.decodeAudioData(ab, ok, no); }); })
          .then(startBuffer).catch(function (e) { reject(e && e.code ? e : WA.AvatarError('DECODE_FAILED', 'Audio could not be decoded', e)); });
      } catch (e) { reject(e); }
    });
  };

  LipSyncController.prototype.setSyntheticSpeaking = function (on) { this.synthetic = !!on; };
  LipSyncController.prototype.setLevel = function (v) { this.ext = v == null ? null : clamp(+v || 0, 0, 1); };
  LipSyncController.prototype.setViseme = function (name, weight) {
    var n = name && (V.indexOf(name) >= 0 ? name : (V.indexOf('viseme_' + name) >= 0 ? 'viseme_' + name : LEGACY[name]));
    this.manual = n ? { v: n, w: clamp(weight == null ? 1 : weight, 0, 1) } : null;
  };
  LipSyncController.prototype.isSpeaking = function () { return !!(this.playing || this.synthetic || this.ext != null || this.manual); };
  LipSyncController.prototype.getTime = function () { return this._audioClock ? this._audioClock() : this._clock; };

  /* Smooths each viseme toward its target so even manual / amplitude input never snaps. */
  LipSyncController.prototype._ease = function (dt) {
    var kUp = 1 - Math.exp(-34 * dt), kDn = 1 - Math.exp(-20 * dt);
    for (var i = 0; i < V.length; i++) { var n = V[i], c = this.visemes[n], t = this.tmp[n]; this.visemes[n] = c + (t - c) * (t > c ? kUp : kDn); }
  };

  LipSyncController.prototype.update = function (dt, t) {
    var i, kind = 'none', wide = 0;
    for (i = 0; i < V.length; i++) this.tmp[V[i]] = 0;
    if (this.playing && !this.paused && !this._audioClock) this._clock += dt;
    var tl = this.engine.hasTimeline() && this.playing;
    if (this.manual) {
      this.tmp[this.manual.v] = this.manual.w; kind = 'manual';
    } else if (tl) {
      var st = this.engine.sample(this.getTime(), this.tmp); this.silence = st.silence; kind = 'timeline';
      if (!this._audioClock && this._clock > this._timed) this.stop();
    } else if (this.ext != null) {
      this.amp.set(dt, Math.pow(this.ext, 0.85) * 0.95, 0); this.amp.toVisemes(this.tmp); kind = 'external';
    } else if (this.playing && this.analyser && this._audioClock) {
      if (!this.paused) {
        this.analyser.getFloatTimeDomainData(this.time); this.analyser.getByteFrequencyData(this.freq);
        var sum = 0, n = this.time.length;
        for (i = 0; i < n; i++) sum += this.time[i] * this.time[i];
        var lo = 0, hi = 0, all = 1e-6, bw = this.ctx.sampleRate / this.analyser.fftSize;
        for (i = 2; i < this.freq.length; i++) { var f = i * bw, e = this.freq[i]; all += e; if (f < 800) lo += e; else if (f > 2200 && f < 6500) hi += e; }
        this.amp.update(dt, Math.sqrt(sum / n), lo, hi, all);
      } else this.amp.set(dt, 0, 0);
      this.amp.toVisemes(this.tmp); kind = 'amplitude';
    } else if (this.playing && this.analyser) {          // MediaStream: no clock
      this.analyser.getFloatTimeDomainData(this.time); this.analyser.getByteFrequencyData(this.freq);
      var s2 = 0; for (i = 0; i < this.time.length; i++) s2 += this.time[i] * this.time[i];
      this.amp.update(dt, Math.sqrt(s2 / this.time.length), 1, 1, 2); this.amp.toVisemes(this.tmp); kind = 'amplitude';
    } else if (this.synthetic) {
      var syll = Math.abs(Math.sin(t * 8.2 + Math.sin(t * 1.9) * 2)) * (0.55 + 0.45 * Math.sin(t * 3.1));
      this.amp.set(dt, syll * (Math.sin(t * 0.85) > -0.55 ? 1 : 0.1) * 0.8, Math.sin(t * 3.7) * 0.35); this.amp.toVisemes(this.tmp); kind = 'synthetic';
    } else if (this.amp.level > 0.01) { this.amp.set(dt, 0, 0); this.amp.toVisemes(this.tmp); }
    this._ease(dt);
    var lvl = 0, wsum = 0, wd = 0;
    for (i = 0; i < V.length; i++) { var w = this.visemes[V[i]]; lvl = Math.max(lvl, w * OPEN[V[i]]); }
    wd = (this.visemes.viseme_E + this.visemes.viseme_I + this.visemes.viseme_SS) - (this.visemes.viseme_O + this.visemes.viseme_U);
    this.level = lvl; this.wide = clamp(wd, -1, 1); this.sourceKind = kind;
    this.speaking = this.isSpeaking();
    return { visemes: this.visemes, level: this.level, wide: this.wide, speaking: this.speaking, paused: this.paused, source: kind,
      active: this.speaking || lvl > 0.03, silence: kind === 'timeline' ? this.silence : (lvl > 0.04 ? 0 : 99) };
  };

  WA.LipSyncController = LipSyncController;
  WA.VISEME_OPENNESS = OPEN;
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== control/TestVoice.js ===== */
/*
 * TestVoice: a synthetic voice with a known phonetic script, so lip-sync can be verified without a TTS.
 * makeTestVoice() returns PCM; makeTestVoiceWithVisemes() returns PCM plus the matching viseme events,
 * which is what a real TTS integration would hand to avatar.speak().
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit;
  var VOWELS = [[730, 1090, 'viseme_aa'], [270, 2290, 'viseme_I'], [570, 840, 'viseme_O'], [300, 870, 'viseme_U'], [530, 1840, 'viseme_E'], [660, 1720, 'viseme_aa']];
  var CONS = ['viseme_PP', 'viseme_DD', 'viseme_SS', 'viseme_nn', 'viseme_FF', 'viseme_kk'];

  function build(sampleRate, seed) {
    sampleRate = sampleRate || 22050;
    var dur = 7, n = Math.floor(dur * sampleRate), buf = new Float32Array(n), rnd = WA.rng(seed || 12), syl = [], events = [];
    var cursor = 0.2;
    while (cursor < dur - 0.5) {
      var words = 2 + Math.floor(rnd() * 3);
      for (var w = 0; w < words; w++) { var L = 0.13 + rnd() * 0.1; syl.push([cursor, L, Math.floor(rnd() * VOWELS.length), 170 + rnd() * 50, Math.floor(rnd() * CONS.length)]); cursor += L + 0.04; }
      cursor += 0.28 + rnd() * 0.25;
    }
    var phase = 0, lp1 = 0, lp2 = 0;
    for (var s = 0; s < syl.length; s++) {
      var st = syl[s], i0 = Math.floor(st[0] * sampleRate), len = Math.floor(st[1] * sampleRate), v = VOWELS[st[2]];
      events.push({ t: st[0] - 0.03, d: 0.05, v: CONS[st[4]] });
      events.push({ t: st[0] + 0.02, d: st[1] - 0.02, v: v[2] });
      for (var i = 0; i < len && i0 + i < n; i++) {
        var u = i / len, env = Math.sin(Math.PI * u); env *= env;
        phase += (st[3] * (1 + 0.06 * Math.sin(u * 3))) / sampleRate; if (phase > 1) phase -= 1;
        var pulse = (1 - phase) * (1 - phase) * 2 - 0.7;
        var w1 = 2 * Math.PI * v[0] / sampleRate, w2 = 2 * Math.PI * v[1] / sampleRate;
        lp1 += (pulse - lp1) * Math.min(1, w1 * 1.1); lp2 += (pulse - lp2) * Math.min(1, w2 * 0.9);
        buf[i0 + i] += (lp1 * 0.9 + (pulse - lp2) * 0.35) * env * 0.4;
      }
    }
    return { pcm: buf, sampleRate: sampleRate, events: events, duration: dur };
  }
  WA.makeTestVoice = function (sampleRate) { return build(sampleRate).pcm; };
  WA.makeTestVoiceWithVisemes = function (sampleRate) { return build(sampleRate); };
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== control/ExpressionController.js ===== */
/*
 * ExpressionController: the emotion vocabulary, expressed in canonical face channels.
 *
 * Each emotion is a small set of ARKit channels plus a head/gaze bias. Differences between emotions
 * live in brows, lids, mouth corners and head angle, never in big movements. A "mix" of several
 * emotions is a weighted sum, so WARNING can be firm with a trace of concern.
 *
 * This class holds the CURRENT emotion and its micro-expressions. It does not smooth anything:
 * ExpressionComposer owns the time behaviour, so every transition passes through one place.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, clamp = WA.clamp;

  // relaxed baseline: lids slightly lowered, lips almost together, a trace of a smile
  var BASE = { eyeBlinkLeft: 0.12, eyeBlinkRight: 0.12, mouthSmileLeft: 0.06, mouthSmileRight: 0.06, mouthPressLeft: 0.1, mouthPressRight: 0.1 };

  // head: yaw, pitch (+ chin down), roll (+ toward screen right), in radians. motion/saccade scale idle life.
  // gaze: direct | attend | think | scan | glance | speak | hold
  var EMOTIONS = {
    neutral: { face: {}, head: {}, motion: 1, saccade: 1, gaze: 'attend' },
    listening: { face: { browInnerUp: 0.25, browOuterUpLeft: 0.06, browOuterUpRight: 0.06, eyeBlinkLeft: 0.06, eyeBlinkRight: 0.06, mouthSmileLeft: 0.12, mouthSmileRight: 0.12, mouthPressLeft: 0.04, mouthPressRight: 0.04, eyeWideLeft: 0.06, eyeWideRight: 0.06 },
      head: { roll: 0.075, pitch: -0.01 }, motion: 1, saccade: 0.7, gaze: 'attend', nods: 1 },
    thinking: { face: { browInnerUp: 0.12, browOuterUpLeft: 0.22, browDownRight: 0.08, eyeBlinkLeft: 0.1, eyeBlinkRight: 0.14, eyeSquintRight: 0.08, mouthSmileLeft: 0, mouthSmileRight: 0.02, mouthPressLeft: 0.18, mouthPressRight: 0.12, mouthShrugLower: 0.12, mouthLeft: 0.12 },
      head: { pitch: 0.035, roll: 0.035, yaw: 0.05 }, motion: 0.75, saccade: 0.9, gaze: 'think' },
    analyzing: { face: { browDownLeft: 0.38, browDownRight: 0.38, browOuterUpLeft: 0.1, browOuterUpRight: 0.1, eyeBlinkLeft: 0.08, eyeBlinkRight: 0.08, eyeSquintLeft: 0.24, eyeSquintRight: 0.24, mouthSmileLeft: 0, mouthSmileRight: 0, mouthPressLeft: 0.4, mouthPressRight: 0.4, jawClench: 0.15 },
      head: { pitch: 0.03, roll: 0.01 }, motion: 0.7, saccade: 1.1, gaze: 'scan' },
    confident: { face: { browOuterUpLeft: 0.06, browOuterUpRight: 0.06, eyeBlinkLeft: 0.1, eyeBlinkRight: 0.1, mouthSmileLeft: 0.4, mouthSmileRight: 0.4, cheekSquintLeft: 0.2, cheekSquintRight: 0.2, mouthPressLeft: 0, mouthPressRight: 0, mouthStretchLeft: 0.06, mouthStretchRight: 0.06 },
      head: { pitch: -0.02 }, motion: 0.6, saccade: 0.4, gaze: 'direct' },
    firm: { face: { browDownLeft: 0.3, browDownRight: 0.3, browInnerUp: 0, eyeBlinkLeft: 0.1, eyeBlinkRight: 0.1, eyeSquintLeft: 0.12, eyeSquintRight: 0.12, mouthSmileLeft: 0, mouthSmileRight: 0, mouthPressLeft: 0.6, mouthPressRight: 0.6, mouthRollLower: 0.1, jawClench: 0.65 },
      head: { pitch: 0.045 }, motion: 0.3, saccade: 0.25, gaze: 'hold' },
    skeptical: { face: { browOuterUpLeft: 0.78, browInnerUp: 0.05, browDownRight: 0.24, eyeBlinkLeft: 0.06, eyeBlinkRight: 0.18, eyeSquintRight: 0.3, mouthSmileLeft: 0, mouthSmileRight: 0.24, mouthPressLeft: 0.3, mouthPressRight: 0.3, mouthLeft: 0.1, cheekSquintRight: 0.12 },
      head: { roll: -0.05, yaw: 0.025 }, motion: 0.7, saccade: 0.6, gaze: 'glance' },
    empathetic: { face: { browInnerUp: 0.55, browDownLeft: 0.04, browDownRight: 0.04, browOuterUpLeft: 0.1, browOuterUpRight: 0.1, eyeBlinkLeft: 0.08, eyeBlinkRight: 0.08, mouthSmileLeft: 0.3, mouthSmileRight: 0.3, cheekSquintLeft: 0.15, cheekSquintRight: 0.15, mouthPressLeft: 0, mouthPressRight: 0 },
      head: { roll: 0.06, pitch: -0.012 }, motion: 0.85, saccade: 0.6, gaze: 'attend', nods: 0.6 },
    surprised: { face: { browInnerUp: 0.55, browOuterUpLeft: 0.5, browOuterUpRight: 0.5, eyeWideLeft: 0.8, eyeWideRight: 0.8, eyeBlinkLeft: 0, eyeBlinkRight: 0, jawOpen: 0.1, mouthPressLeft: 0, mouthPressRight: 0, mouthSmileLeft: 0, mouthSmileRight: 0 },
      head: { pitch: -0.025 }, motion: 0.8, saccade: 0.5, gaze: 'direct' },
    concerned: { face: { browInnerUp: 0.6, browDownLeft: 0.12, browDownRight: 0.12, eyeSquintLeft: 0.1, eyeSquintRight: 0.1, eyeBlinkLeft: 0.1, eyeBlinkRight: 0.1, mouthFrownLeft: 0.22, mouthFrownRight: 0.22, mouthPressLeft: 0.15, mouthPressRight: 0.15, mouthSmileLeft: 0, mouthSmileRight: 0 },
      head: { roll: 0.04, pitch: 0.02 }, motion: 0.7, saccade: 0.6, gaze: 'attend', nods: 0.4 },
    decisive: { face: { browDownLeft: 0.16, browDownRight: 0.16, eyeBlinkLeft: 0.1, eyeBlinkRight: 0.1, eyeSquintLeft: 0.08, eyeSquintRight: 0.08, mouthPressLeft: 0.35, mouthPressRight: 0.35, mouthSmileLeft: 0, mouthSmileRight: 0, jawClench: 0.3, mouthShrugLower: 0.08 },
      head: { pitch: 0.035 }, motion: 0.25, saccade: 0.15, gaze: 'hold' }
  };
  var NAMES = Object.keys(EMOTIONS);

  function ExpressionController(seed) {
    this.name = 'neutral'; this.intensity = 1;
    this.mix = [{ name: 'neutral', w: 1 }];
    this.rand = WA.rng(seed || 404); this.nextMicro = 4; this.micro = null;
  }
  ExpressionController.names = NAMES;
  ExpressionController.EMOTIONS = EMOTIONS;
  ExpressionController.BASE = BASE;

  /* opts.intensity 0..1.2. Returns false for an unknown emotion (nothing changes). */
  ExpressionController.prototype.set = function (name, opts) {
    name = String(name).toLowerCase();
    if (!EMOTIONS[name]) return false;
    opts = opts || {};
    this.name = name; this.intensity = opts.intensity == null ? 1 : clamp(opts.intensity, 0, 1.2);
    this.mix = [{ name: name, w: this.intensity }];
    return true;
  };
  /* Several emotions at once: [{ name, w }]. The first is reported as the current emotion. */
  ExpressionController.prototype.setMix = function (list) {
    var ok = (list || []).filter(function (m) { return EMOTIONS[m.name]; });
    if (!ok.length) return false;
    this.mix = ok.map(function (m) { return { name: m.name, w: clamp(m.w == null ? 1 : m.w, 0, 1.2) }; });
    this.name = ok[0].name; this.intensity = this.mix[0].w; return true;
  };

  /* Sums the active emotions on top of the baseline. Writes into `face`, returns { motion, saccade, gaze, nods, head }. */
  ExpressionController.prototype.target = function (face, head) {
    var k, i, m, E, w, tw = 0, motion = 0, sacc = 0, nods = 0;
    for (k in face) face[k] = 0;
    for (k in BASE) face[k] = BASE[k];
    head.yaw = head.pitch = head.roll = 0;
    for (i = 0; i < this.mix.length; i++) {
      m = this.mix[i]; E = EMOTIONS[m.name]; w = m.w; tw += Math.min(1, w);
      for (k in E.face) face[k] = (face[k] || 0) + (E.face[k] - (BASE[k] || 0)) * w;
      head.yaw += (E.head.yaw || 0) * w; head.pitch += (E.head.pitch || 0) * w; head.roll += (E.head.roll || 0) * w;
      motion += E.motion * w; sacc += E.saccade * w; nods += (E.nods || 0) * w;
    }
    var n = Math.max(1e-6, tw), lead = EMOTIONS[this.mix[0].name];
    for (k in face) face[k] = clamp(face[k], 0, 1);
    return { motion: motion / n, saccade: sacc / n, gaze: lead.gaze, nods: nods, lead: this.mix[0].name };
  };

  /* An occasional micro-expression: a brow flash, a corner twitch, a brief squint. Adds into `face`; scale 0..1. */
  ExpressionController.prototype.micro_ = function (t, scale, face) {
    if (t > this.nextMicro && !this.micro) {
      var r = this.rand(), type = r < 0.38 ? 'brow' : r < 0.7 ? 'corner' : r < 0.88 ? 'squint' : 'press';
      this.micro = { type: type, start: t, dur: 0.5 + this.rand() * 0.5, side: this.rand() > 0.5 ? 1 : -1 };
    }
    if (!this.micro) return;
    var mi = this.micro, p = (t - mi.start) / mi.dur;
    if (p >= 1) { this.micro = null; this.nextMicro = t + 5 + this.rand() * 8; return; }
    var e = Math.sin(Math.PI * p) * scale;
    if (mi.type === 'brow') { face.browInnerUp += 0.1 * e; face.browOuterUpLeft += 0.1 * e; face.browOuterUpRight += 0.1 * e; }
    else if (mi.type === 'corner') { if (mi.side > 0) face.mouthSmileRight += 0.1 * e; else face.mouthSmileLeft += 0.1 * e; }
    else if (mi.type === 'squint') { face.eyeSquintLeft += 0.14 * e; face.eyeSquintRight += 0.14 * e; }
    else { face.mouthPressLeft += 0.18 * e; face.mouthPressRight += 0.18 * e; }
  };

  WA.ExpressionController = ExpressionController;
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== control/CognitiveState.js ===== */
/*
 * CognitiveState: what the agent is DOING, as opposed to what its face is showing.
 *
 * The executive agent reports a cognitive state ("PROCESSING", "CHALLENGE"...). Each state is a profile:
 * which emotions it implies (a mix), how the eyes behave, how much the head moves, how often she blinks.
 * An explicit setExpression() after the state wins for the face (the state keeps its gaze and posture),
 * until the next setCognitiveState().
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit;

  // gaze: attend (mostly on you, short glances), think (down/aside, returns), scan, speak (conversational pattern), direct, hold (locked on)
  var STATES = {
    LISTENING: { mix: [['listening', 1]], gaze: 'attend', motion: 1, blink: 1, nods: 1, attention: 0.95 },
    PROCESSING: { mix: [['analyzing', 0.6], ['thinking', 0.3]], gaze: 'scan', motion: 0.75, blink: 1.1, nods: 0, attention: 0.7 },
    THINKING: { mix: [['thinking', 1]], gaze: 'think', motion: 0.75, blink: 0.9, nods: 0, attention: 0.6 },
    SPEAKING: { mix: [['neutral', 0.6], ['confident', 0.35]], gaze: 'speak', motion: 0.8, blink: 1, nods: 0, attention: 0.85 },
    DECIDING: { mix: [['decisive', 1]], gaze: 'hold', motion: 0.3, blink: 0.6, nods: 0, attention: 1, beat: 'decide' },
    WARNING: { mix: [['firm', 0.85], ['concerned', 0.3]], gaze: 'hold', motion: 0.25, blink: 0.5, nods: 0, attention: 1 },
    EMPATHY: { mix: [['empathetic', 1]], gaze: 'attend', motion: 0.85, blink: 1, nods: 0.7, attention: 0.95 },
    CHALLENGE: { mix: [['skeptical', 0.8], ['firm', 0.3]], gaze: 'hold', motion: 0.4, blink: 0.6, nods: 0, attention: 1, head: { pitch: -0.02 } },
    CONFIDENCE: { mix: [['confident', 1]], gaze: 'direct', motion: 0.5, blink: 0.8, nods: 0, attention: 0.95 }
  };
  var NAMES = Object.keys(STATES);

  function CognitiveState() { this.name = null; this.since = 0; }
  CognitiveState.names = NAMES;
  CognitiveState.STATES = STATES;
  CognitiveState.normalize = function (n) { n = String(n == null ? '' : n).toUpperCase(); return STATES[n] ? n : null; };
  CognitiveState.profile = function (n) {
    n = CognitiveState.normalize(n); if (!n) return null;
    var s = STATES[n];
    return { name: n, mix: s.mix.map(function (m) { return { name: m[0], w: m[1] }; }), gaze: s.gaze, motion: s.motion, blink: s.blink, nods: s.nods, attention: s.attention, head: s.head || null, beat: s.beat || null };
  };
  CognitiveState.prototype.set = function (name, t) {
    var n = CognitiveState.normalize(name); if (!n) return false;
    this.name = n; this.since = t || 0; return true;
  };
  CognitiveState.prototype.clear = function () { this.name = null; };
  CognitiveState.prototype.profile = function () { return this.name ? CognitiveState.profile(this.name) : null; };

  WA.CognitiveState = CognitiveState;
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== control/ExpressionComposer.js ===== */
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

/* ===== control/GazeController.js ===== */
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

/* ===== control/AnimationController.js ===== */
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

/* ===== control/FaceMixer.js ===== */
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

/* ===== scene/CameraController.js ===== */
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
    MEDIUM_CLOSE: { vis: 2.65, centre: 'eyeY', off: -0.72 },      // the default of the executive runtime: head and shoulders, in the room
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

/* ===== scene/StudioLighting.js ===== */
/*
 * StudioLighting: a cinematic portrait setup built from real 3D lights and an image-based environment.
 * Nothing here is a CSS background or a baked image.
 *
 *   key      the main light, soft-shadowed, off-axis, slightly above eye line
 *   fill     low, cool, opposite the key; sets the shadow ratio
 *   rimA/B   two lights behind: separate hair and shoulders from the backdrop
 *   ambient  hemisphere, very low
 *   env      an environment of softboxes, prefiltered (PMREM): it is what gives skin sheen, eyes their
 *            catchlight and hair its highlight on any PBR model
 *   backdrop a large inverted sphere with a shader gradient and a soft light pool behind the head
 *   floor    shadow-only plane for grounding in full shots
 *
 * Everything is placed relative to the model's landmarks, in head heights, so it suits any scale.
 * Styles (conversation, executive, intimate) set angle, ratio, colour temperature and exposure, and
 * change smoothly. Quality sets shadow resolution and softness.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, T = root.THREE;

  var STYLES = {
    conversation: { key: 3.0, keyCol: 0xffeedd, az: -34, el: 24, fill: 0.14, rimA: 1.4, rimB: 1.0, amb: 0.16, exposure: 1.05, pool: 0.9, poolCol: 0x4a4540, env: 1 },
    executive: { key: 2.6, keyCol: 0xfff3e6, az: -26, el: 20, fill: 0.22, rimA: 1.2, rimB: 0.8, amb: 0.22, exposure: 1.0, pool: 0.7, poolCol: 0x3a3f4a, env: 0.9 },
    intimate: { key: 2.5, keyCol: 0xffe2c8, az: -48, el: 14, fill: 0.08, rimA: 1.7, rimB: 0.9, amb: 0.14, exposure: 1.12, pool: 1.0, poolCol: 0x5a4a40, env: 0.95 }
  };
  var QUALITY = { low: { shadow: 512, radius: 2, env: 128 }, medium: { shadow: 1024, radius: 3, env: 256 }, high: { shadow: 2048, radius: 4, env: 256 } };

  var BACKDROP_VS = 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
  var BACKDROP_FS = [
    'varying vec3 vDir; uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uPool; uniform float uPoolK; uniform vec2 uPoolAt;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }',
    'void main(){',
    '  float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);',
    '  vec3 col = mix(uBottom, uTop, smoothstep(0.15, 0.85, h));',
    '  vec2 q = vec2(vDir.x, vDir.y - uPoolAt.y) ; float pool = exp(-dot(q,q) * 16.0) * step(vDir.z, 0.0) * uPoolK;',
    '  col += uPool * pool;',
    '  col *= 1.0 - 0.35 * smoothstep(0.45, 1.0, length(vDir.xy));',                  // vignette
    '  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;',                               // dither against banding
    '  gl_FragColor = vec4(col, 1.0);',                                                // colours are authored in display (sRGB) space: no tone mapping or re-encoding
    '}'].join('\n');

  function StudioLighting(renderer, scene, opts) {
    this.o = WA.assign({ style: 'conversation', quality: 'high', backdrop: true, floor: true }, opts || {});
    this.renderer = renderer; this.scene = scene;
    this.lm = WA.AvatarModel.defaultLandmarks(7.05);
    this.group = new T.Group(); this.group.name = 'StudioLighting'; scene.add(this.group);
    this.style = STYLES[this.o.style] ? this.o.style : 'conversation';
    this.q = QUALITY[this.o.quality] || QUALITY.high;
    this.cur = WA.assign({}, STYLES[this.style]); this.curCols = {};
    var G = this.group;

    this.key = new T.DirectionalLight(0xffffff, 1); this.key.castShadow = true;
    this.key.shadow.bias = -0.0004; this.key.shadow.normalBias = 0.012; this.key.shadow.camera.near = 0.5; this.key.shadow.camera.far = 80;
    this.fill = new T.DirectionalLight(0xdfe6ff, 0.2);
    this.rimA = new T.DirectionalLight(0x8fb0ff, 1.4); this.rimB = new T.DirectionalLight(0xffcfb4, 1.0);
    this.amb = new T.HemisphereLight(0xa9a6c4, 0x7a5048, 0.3);
    G.add(this.key, this.key.target, this.fill, this.rimA, this.rimB, this.amb);
    this.setQuality(this.o.quality);

    this.env = null; this._buildEnv();
    if (this.o.backdrop) this._buildBackdrop();
    if (this.o.floor) {
      this.floor = new T.Mesh(new T.PlaneGeometry(40, 40), new T.ShadowMaterial({ opacity: 0.2 }));
      this.floor.rotation.x = -Math.PI / 2; this.floor.receiveShadow = true; G.add(this.floor);
    }
    this.focus = { y: this.lm.eyeY, extent: 2.5 };
    this._apply(1, true);
  }
  StudioLighting.STYLES = STYLES; StudioLighting.QUALITY = QUALITY;

  StudioLighting.prototype._buildEnv = function () {
    var es = new T.Scene(), sky = new T.Mesh(new T.SphereGeometry(10, 24, 16), new T.MeshBasicMaterial({ color: 0x15171d, side: T.BackSide }));
    es.add(sky);
    function box(w, h, col, k, x, y, z) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(col).multiplyScalar(k), side: T.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m);
    }
    box(5, 6, 0xfff0e0, 9, -6, 3.5, 5);          // key softbox, upper left front: its reflection is the catchlight
    box(4, 5, 0xdce6ff, 1.6, 6.5, 0.5, 4);       // fill card, right
    box(2.2, 8, 0x9db8ff, 5, -6, 3, -6);         // rim strips behind
    box(2.2, 8, 0xffd2b8, 3.5, 6, 3, -6);
    box(14, 3, 0xffffff, 0.7, 0, 9, 0);          // top bounce
    var pm = new T.PMREMGenerator(this.renderer);
    var rt = pm.fromScene(es, 0.03); this.env = rt; this.scene.environment = rt.texture; pm.dispose();
    es.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  };

  StudioLighting.prototype._buildBackdrop = function () {
    var u = { uTop: { value: new T.Color(0x15171d) }, uBottom: { value: new T.Color(0x050608) }, uPool: { value: new T.Color(0x4a4540) }, uPoolK: { value: 0.9 }, uPoolAt: { value: new T.Vector2(0, 0.0) } };
    this.backdropU = u;
    this.backdrop = new T.Mesh(new T.SphereGeometry(70, 32, 20), new T.ShaderMaterial({ uniforms: u, vertexShader: BACKDROP_VS, fragmentShader: BACKDROP_FS, side: T.BackSide, depthWrite: false, toneMapped: false }));
    this.backdrop.renderOrder = -10; this.backdrop.frustumCulled = false; this.group.add(this.backdrop);
  };

  StudioLighting.prototype.setLandmarks = function (lm) { if (lm) { this.lm = lm; this._apply(1, true); } };
  StudioLighting.prototype.setStyle = function (name) { if (!STYLES[name]) return false; this.style = name; return true; };
  StudioLighting.prototype.setQuality = function (q) {
    var Q = QUALITY[q]; if (!Q) return false; this.q = Q;
    var s = this.key.shadow; s.mapSize.set(Q.shadow, Q.shadow); s.radius = Q.radius; if (s.map) { s.map.dispose(); s.map = null; }
    return true;
  };
  /* y: height the shadow frustum is centred on; extent: half-size in scene units. The camera calls this as it moves. */
  StudioLighting.prototype.setFocus = function (y, extent) { this.focus.y = y; this.focus.extent = Math.max(1.2, extent); this._shadow(); };

  StudioLighting.prototype._shadow = function () {
    var s = this.key.shadow.camera, e = this.focus.extent;
    s.left = -e; s.right = e; s.top = e; s.bottom = -e; s.updateProjectionMatrix();
    this.key.target.position.set(0, this.focus.y, 0); this.key.target.updateMatrixWorld();
    this._place();
  };
  function dir(az, el) { var a = az * Math.PI / 180, e = el * Math.PI / 180; return new T.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)); }
  StudioLighting.prototype._place = function () {
    var h = this.lm.headHeight, c = this.cur, cy = this.focus.y, D = 6 * h;
    var k = dir(c.az, c.el).multiplyScalar(D); this.key.position.set(k.x, cy + k.y, k.z);
    var f = dir(52, 8).multiplyScalar(D); this.fill.position.set(f.x, cy + f.y, f.z);
    var ra = dir(-145, 28).multiplyScalar(D), rb = dir(150, 22).multiplyScalar(D);
    this.rimA.position.set(ra.x, cy + ra.y, ra.z); this.rimB.position.set(rb.x, cy + rb.y, rb.z);
    [this.fill, this.rimA, this.rimB].forEach(function (l) { l.target.position.set(0, cy, 0); }, this);
  };

  /* eases the current values toward the style; k is the blend (1 = snap) */
  StudioLighting.prototype._apply = function (k, snap) {
    var t = STYLES[this.style], c = this.cur, kk = snap ? 1 : k;
    ['key', 'az', 'el', 'fill', 'rimA', 'rimB', 'amb', 'exposure', 'pool', 'env'].forEach(function (n) { c[n] += (t[n] - c[n]) * kk; });
    var self = this;
    function col(name, hex) { var cc = self.curCols[name] || (self.curCols[name] = new T.Color(hex)); if (snap) cc.setHex(hex); else cc.lerp(new T.Color(hex), kk); return cc; }
    this.key.color.copy(col('key', t.keyCol)); this.key.intensity = c.key;
    this.fill.intensity = c.fill; this.rimA.intensity = c.rimA; this.rimB.intensity = c.rimB; this.amb.intensity = c.amb;
    this.renderer.toneMappingExposure = c.exposure;
    if (this.backdropU) { this.backdropU.uPool.value.copy(col('pool', t.poolCol)); this.backdropU.uPoolK.value = c.pool; }
    this.envIntensity = c.env;
    this._place();
  };

  /* The backdrop turns with the camera, so the background behind the head is the same in every view (front, three-quarter, profile). */
  StudioLighting.prototype.setBackdropYaw = function (a) { if (this.backdrop) this.backdrop.rotation.y = a; };

  StudioLighting.prototype.update = function (dt) {
    if (this.backdropU) this.backdropU.uPoolAt.value.set(0, (this.lm.headCenterY - this.lm.height * 0.5) / 40);
    this._apply(1 - Math.exp(-2.5 * dt), false);
  };

  StudioLighting.prototype.dispose = function () {
    this.scene.remove(this.group); if (this.scene.environment === (this.env && this.env.texture)) this.scene.environment = null;
    if (this.env) this.env.dispose();
    this.group.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    if (this.key.shadow.map) this.key.shadow.map.dispose();
  };

  WA.StudioLighting = StudioLighting;
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== model/procedural/Avatar3D.js ===== */
/*
 * Avatar3D: the character model. Original design, procedural (no external assets).
 * Exposes a small rig: setFace(), setGaze(), setPose(). It is the FALLBACK model of the kit:
 * ProceduralAvatar adapts it to the AvatarModel contract, and lights come from StudioLighting.
 *
 * Units: 1 unit = one head height. The head centre sits near y = 6.55, feet at y = 0.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, T = root.THREE;
  var clamp = WA.clamp, lerp = WA.lerp, smooth = WA.smooth, gauss = WA.gauss;

  var HEAD = { rx: 0.42, ry: 0.5, rz: 0.46 };
  var LM = { eyeX: 0.19, eyeY: 0.035, eyeR: 0.125, mouthY: -0.275, mouthW: 0.126 };
  var HEAD_CENTER_Y = 6.55;
  var PIVOT_Y = 6.2;

  /* ------------------------------------------------------------------ head */

  function sculpt(p) {
    var x0 = p.x, y0 = p.y, z0 = p.z;
    var wf = smooth(0.0, 0.32, z0 / HEAD.rz);
    var t = clamp(-y0 / HEAD.ry, 0, 1);
    var x = x0 * (1 - 0.07 * t * t) * (1 + 0.035 * gauss((y0 + 0.08) * (y0 + 0.08), 0.18));
    var y = y0 * (1 - 0.08 * smooth(-0.25, -0.5, y0));
    var z = z0 * (1 - 0.08 * t * t);

    z += 0.018 * gauss((y0 - 0.27) * (y0 - 0.27), 0.14) * wf;                       // forehead
    z += 0.022 * gauss(x0 * x0 * 1.5 + (y0 + 0.455) * (y0 + 0.455), 0.07) * wf;     // chin
    z += 0.02 * gauss(x0 * x0 / 1.6 + (y0 + 0.265) * (y0 + 0.265), 0.075) * wf;    // muzzle

    // nose: bridge, tip, wings
    var bridge = (0.016 + 0.082 * smooth(0.1, -0.12, y0)) * smooth(-0.2, -0.15, y0) * smooth(0.17, 0.1, y0);
    z += bridge * gauss(x0 * x0, 0.04) * wf;
    z += 0.048 * gauss(x0 * x0 + (y0 + 0.14) * (y0 + 0.14) * 1.3, 0.042) * wf;

    for (var s = -1; s <= 1; s += 2) {
      var ex = x0 - s * LM.eyeX;
      z -= 0.018 * gauss(ex * ex + (y0 - LM.eyeY) * (y0 - LM.eyeY), 0.075) * wf;    // eye socket
      z -= 0.006 * gauss(ex * ex + (y0 + 0.04) * (y0 + 0.04), 0.06) * wf;           // under-eye
      var cx = x0 - s * 0.235;
      z += 0.022 * gauss(cx * cx + (y0 + 0.03) * (y0 + 0.03), 0.075) * wf;           // cheekbone
      z += 0.014 * gauss((x0 - s * 0.2) * (x0 - s * 0.2) + (y0 + 0.11) * (y0 + 0.11), 0.07) * wf; // apple of the cheek
      x += s * 0.014 * gauss((x0 - s * 0.33) * (x0 - s * 0.33) + (y0 + 0.27) * (y0 + 0.27), 0.07) * smooth(-0.1, 0.2, z0 / HEAD.rz); // jaw angle
      var nx = x0 - s * 0.062;
      z += 0.026 * gauss(nx * nx + (y0 + 0.145) * (y0 + 0.145), 0.03) * wf;        // nostril wing
    }
    // brow ridge
    z += 0.022 * gauss((y0 - 0.13) * (y0 - 0.13), 0.04) * smooth(0.0, 0.1, Math.abs(x0)) * smooth(0.4, 0.22, Math.abs(x0)) * wf;
    p.x = x; p.y = y; p.z = z;
    return p;
  }

  function buildHeadGeometry() {
    var g = new T.SphereGeometry(1, 128, 96);
    var pos = g.attributes.position, p = { x: 0, y: 0, z: 0 };
    for (var i = 0; i < pos.count; i++) {
      p.x = pos.getX(i) * HEAD.rx; p.y = pos.getY(i) * HEAD.ry; p.z = pos.getZ(i) * HEAD.rz;
      sculpt(p);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    g.computeVertexNormals();
    return g;
  }

  // head-local (x, y) on the front of the face -> pixel on the equirect skin texture
  function facePx(x, y, W, H) {
    var cy = clamp(y / HEAD.ry, -0.999, 0.999), th = Math.acos(cy), sn = Math.sin(th);
    var d = Math.asin(clamp((x / HEAD.rx) / sn, -1, 1));
    return { x: (0.25 + d / (2 * Math.PI)) * W, y: (th / Math.PI) * H, sx: W / (2 * Math.PI * HEAD.rx * sn), sy: H / (Math.PI * HEAD.ry * sn) };
  }

  function makeSkinTexture() {
    var W = 2048, H = 1024;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d');
    var vg = g.createLinearGradient(0, 0, 0, H);
    vg.addColorStop(0, '#d29c7d'); vg.addColorStop(0.42, '#d8a687'); vg.addColorStop(0.62, '#d29c7e'); vg.addColorStop(1, '#c8937a');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);

    function blob(x, y, rx, ry, color, a) {
      var p = facePx(x, y, W, H);
      g.save(); g.translate(p.x, p.y); g.scale(p.sx * rx, p.sy * ry);
      var gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      gr.addColorStop(0, WA.rgba(color, a)); gr.addColorStop(1, WA.rgba(color, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.fill(); g.restore();
    }
    for (var s = -1; s <= 1; s += 2) {
      blob(s * 0.4, 0.0, 0.1, 0.28, '#b7826a', 0.38);       // sides of the face fall into shade
      blob(s * 0.245, -0.1, 0.1, 0.07, '#dd7f7c', 0.2);     // cheek colour, discreet
      blob(s * 0.2, 0.1, 0.1, 0.038, '#a87a70', 0.16);      // soft lid colour
      blob(s * 0.185, -0.035, 0.085, 0.03, '#b88878', 0.13); // under-eye
      blob(s * 0.05, -0.125, 0.045, 0.04, '#cc8577', 0.14);  // beside the nose
    }
    blob(0, -0.14, 0.05, 0.04, '#d98c80', 0.16);             // nose tip
    blob(-0.034, -0.163, 0.013, 0.008, '#4a201d', 0.3); blob(0.034, -0.163, 0.013, 0.008, '#4a201d', 0.3);
    blob(0, 0.3, 0.2, 0.09, '#f0c4a8', 0.1);                 // forehead light

    // brows: soft underlay plus individual hairs
    for (var si = -1; si <= 1; si += 2) {
      var P0 = { x: si * 0.075, y: 0.132 }, P1 = { x: si * 0.2, y: 0.195 }, P2 = { x: si * 0.355, y: 0.118 };
      function bz(t) {
        var u = 1 - t;
        return { x: u * u * P0.x + 2 * u * t * P1.x + t * t * P2.x, y: u * u * P0.y + 2 * u * t * P1.y + t * t * P2.y };
      }
      for (var k = 0; k < 44; k++) {
        var t = k / 44, b = bz(t);
        blob(b.x, b.y, 0.05 * (1 - t * 0.5) + 0.008, 0.026 * (1 - t * 0.45) + 0.005, '#140a06', 0.6 * (1 - t * 0.45));
      }
      var rnd = WA.rng(si > 0 ? 11 : 17);
      g.save(); g.lineCap = 'round';
      for (var h = 0; h < 190; h++) {
        var tt = rnd() * 0.96, a = bz(tt), a2 = bz(Math.min(1, tt + 0.07));
        var spread = (0.014 * (1 - tt * 0.7)) * (rnd() - 0.5) * 2;
        var p1 = facePx(a.x, a.y + spread, W, H), p2 = facePx(a2.x, a2.y + spread * 0.8 + 0.004, W, H);
        g.strokeStyle = WA.rgba('#120a06', 0.75 + rnd() * 0.25);
        g.lineWidth = 1.8 + rnd() * 1.4;
        g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke();
      }
      g.restore();
    }
    // fine skin grain so the surface does not look like plastic
    var img = g.getImageData(0, 0, W, H), d = img.data, r2 = WA.rng(5);
    for (var i = 0; i < d.length; i += 4) { var n = (r2() - 0.5) * 7; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(img, 0, 0);

    var tex = new T.CanvasTexture(c);
    tex.encoding = T.sRGBEncoding; tex.anisotropy = 8;
    return tex;
  }

  /* ------------------------------------------------------------------ eyes */

  function makeEyeTexture() {
    var W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d');
    var bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#c9b9b0'); bg.addColorStop(0.3, '#e9dfd9'); bg.addColorStop(0.7, '#e9dfd9'); bg.addColorStop(1, '#cdbdb4');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    var cx = 256, cy = 256, R = 92;
    var rg = g.createRadialGradient(cx, cy, R * 0.3, cx, cy, R);
    rg.addColorStop(0, '#c08a3f'); rg.addColorStop(0.35, '#8a5428'); rg.addColorStop(0.8, '#5a341a'); rg.addColorStop(1, '#2a170d');
    g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    var rnd = WA.rng(3);
    for (var i = 0; i < 90; i++) {
      var a = rnd() * Math.PI * 2, r1 = R * (0.32 + rnd() * 0.1), r2 = R * (0.62 + rnd() * 0.36);
      g.strokeStyle = rnd() > 0.5 ? 'rgba(240,190,110,0.28)' : 'rgba(40,20,10,0.3)'; g.lineWidth = 1 + rnd() * 1.6;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); g.stroke();
    }
    g.strokeStyle = 'rgba(20,10,6,0.9)'; g.lineWidth = 7; g.beginPath(); g.arc(cx, cy, R - 3, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#050304'; g.beginPath(); g.arc(cx, cy, R * 0.37, 0, Math.PI * 2); g.fill();
    var tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding; tex.anisotropy = 4;
    return tex;
  }

  /* --------------------------------------------------------------- ribbons */

  function Ribbon(nx, ny, material) {
    var g = new T.BufferGeometry();
    var pos = new Float32Array(nx * ny * 3), col = new Float32Array(nx * ny * 3), idx = [];
    for (var j = 0; j < ny - 1; j++) for (var i = 0; i < nx - 1; i++) {
      var a = j * nx + i; idx.push(a, a + 1, a + nx, a + 1, a + nx + 1, a + nx);
    }
    g.setIndex(idx);
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    var mesh = new T.Mesh(g, material);
    mesh.frustumCulled = false;
    return {
      mesh: mesh, pos: pos, col: col, nx: nx, ny: ny,
      commit: function () { g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.computeVertexNormals(); }
    };
  }

  /* ------------------------------------------------------------------ hair */

  function makeHairBump() {
    var c = document.createElement('canvas'); c.width = 256; c.height = 512;
    var g = c.getContext('2d'), r = WA.rng(77);
    g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 512);
    for (var i = 0; i < 150; i++) {
      var x = r() * 256, v = 90 + Math.floor(r() * 120);
      g.strokeStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (0.35 + r() * 0.5) + ')'; g.lineWidth = 2 + r() * 3;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 3, 512); g.stroke();
    }
    var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
    return t;
  }

  function buildHair() {
    var rand = WA.rng(2024);
    var RH = { x: 0.455, y: 0.54, z: 0.495, cy: 0.012, cz: -0.02 };
    function hs(th, a, off) {
      var s = 1 + (off || 0);
      return new T.Vector3(RH.x * Math.sin(a) * Math.sin(th) * s, RH.y * Math.cos(th) * s + RH.cy, RH.z * Math.cos(a) * Math.sin(th) * s + RH.cz);
    }
    var locks = [];
    function hang(pts, back, len, wave) {
      var P = pts[pts.length - 1], sx = P.x >= 0 ? 1 : -1, ax = Math.abs(P.x), j = function () { return (rand() - 0.5) * 0.03; };
      function behind(x, z) { return Math.min(z, -0.26 + 0.22 * smooth(0.3, 0.5, Math.abs(x))); }
      var q1 = new T.Vector3(sx * ax * 1.04 + j(), P.y - 0.2 * len, 0), q2 = new T.Vector3(sx * ax * 1.02 + j() + wave, P.y - 0.5 * len, 0),
          q3 = new T.Vector3(sx * ax * 0.94 + j() - wave, P.y - 0.82 * len, 0), q4 = new T.Vector3(sx * ax * 0.82 + j() - wave * 1.8, P.y - 1.0 * len, 0);
      q1.z = behind(q1.x, Math.min(P.z, -0.02) - 0.05 * back);
      q2.z = behind(q2.x, -0.12 - 0.1 * back + j());
      q3.z = behind(q3.x, -0.22 - 0.08 * back + j());
      q4.z = behind(q4.x, -0.26 - 0.06 * back + j());
      pts.push(q1, q2, q3, q4);
    }
    function add(pts, width, tone) { locks.push({ pts: pts, w: width, tone: tone }); }

    // back and crown mass
    for (var i = 0; i < 46; i++) {
      var sg = i % 2 ? 1 : -1, a = sg * (1.45 + rand() * (Math.PI - 1.45));
      var th0 = 0.18 + rand() * 0.9, o = 0.014 + rand() * 0.02;
      var pts = [hs(th0, a, o), hs(th0 + 0.5, a, o + 0.004), hs(1.6 + rand() * 0.16, a, o + 0.014)];
      hang(pts, rand(), 0.8 + rand() * 0.3, (rand() - 0.5) * 0.05);
      add(pts, 0.15 + rand() * 0.09, 0.8 + rand() * 0.4);
    }
    // side parting: the larger sweep falls to screen-left
    function sweep(dir, n, a0, aEnd, e0, wBase) {
      for (var k = 0; k < n; k++) {
        var u = (k + 0.5) / n, th0 = 0.28 + 0.6 * u, te = 1.06 + e0 * u;
        var wps = [0, 0.3, 0.62, 0.84, 1], pts = [];
        for (var q = 0; q < wps.length; q++) {
          var f = wps[q], th = th0 + (te - th0) * f, a = a0 + (aEnd - a0) * f + (rand() - 0.5) * 0.03;
          pts.push(hs(th, a, 0.016 + 0.014 * Math.sin(f * Math.PI) + 0.01 * u + q * 0.003));
        }
        hang(pts, rand() * 0.8, 0.82 + rand() * 0.22, dir * 0.03);
        add(pts, wBase * (0.8 + 0.5 * rand()), 0.85 + rand() * 0.3);
      }
    }
    sweep(-1, 16, 0.2, -1.95, 0.42, 0.115);
    sweep(1, 13, 0.18, 1.95, 0.4, 0.13);

    var P = [], N = [], C = [], UV = [], I = [], base = 0, seg = 36, ring = 10;
    for (var s = 0; s < locks.length; s++) {
      var L = locks[s], curve = new T.CatmullRomCurve3(L.pts, false, 'catmullrom', 0.5), len = curve.getLength();
      var prevS = null;
      for (var r = 0; r <= seg; r++) {
        var t = r / seg, ctr = curve.getPointAt(t), tan = curve.getTangentAt(t);
        var ref = new T.Vector3(ctr.x, Math.max(0, ctr.y) * 0.5, ctr.z + 0.02).normalize();
        var S = new T.Vector3().crossVectors(tan, ref).normalize();
        if (prevS && S.dot(prevS) < 0) S.negate(); prevS = S.clone();
        var Nn = new T.Vector3().crossVectors(S, tan).normalize(); if (Nn.dot(ref) < 0) Nn.negate();
        var prof = (0.5 + 0.5 * smooth(0, 0.14, t)) * (1 - 0.88 * smooth(0.55, 1, t));
        var w = L.w * 0.5 * prof, th = 0.016 * (0.55 + 0.45 * prof);
        for (var m = 0; m <= ring; m++) {
          var ph = (m / ring) * Math.PI * 2, cp = Math.cos(ph), sp = Math.sin(ph);
          P.push(ctr.x + S.x * cp * w + Nn.x * sp * th, ctr.y + S.y * cp * w + Nn.y * sp * th, ctr.z + S.z * cp * w + Nn.z * sp * th);
          var nx = S.x * cp * th + Nn.x * sp * w, ny = S.y * cp * th + Nn.y * sp * w, nz = S.z * cp * th + Nn.z * sp * w, nl = Math.hypot(nx, ny, nz) || 1;
          N.push(nx / nl, ny / nl, nz / nl);
          UV.push(m / ring * 2, t * len * 1.4);
          var shade = L.tone * (0.92 + 0.08 * Math.sin(t * 7 + s));
          C.push(0.034 * shade + 0.004, 0.02 * shade + 0.002, 0.015 * shade + 0.002);
        }
      }
      for (var rr = 0; rr < seg; rr++) for (var mm = 0; mm < ring; mm++) {
        var a1 = base + rr * (ring + 1) + mm, b1 = a1 + 1, c1 = a1 + ring + 1, d1 = c1 + 1;
        I.push(a1, b1, c1, b1, d1, c1);
      }
      base += (seg + 1) * (ring + 1);
    }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(N, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(C, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2));
    g.setIndex(I);
    return g;
  }

  WA.createAvatar3D = function (renderer) {
    var group = new T.Group();
    var M = {};
    var skinTex = makeSkinTexture();
    M.skin = new T.MeshPhysicalMaterial({ map: skinTex, roughness: 0.58, metalness: 0, clearcoat: 0.1, clearcoatRoughness: 0.45, emissive: 0xffffff, emissiveMap: skinTex, emissiveIntensity: 0.09, envMapIntensity: 0.28 });
    M.bodySkin = new T.MeshPhysicalMaterial({ color: 0xa4684f, roughness: 0.6, clearcoat: 0.08, clearcoatRoughness: 0.5, emissive: 0x5a3026, emissiveIntensity: 0.03, envMapIntensity: 0.4 });
    M.lid = new T.MeshPhysicalMaterial({ color: 0xc58f74, roughness: 0.55, emissive: 0x8a4a3e, emissiveIntensity: 0.05, envMapIntensity: 0.3 });
    M.eye = new T.MeshPhysicalMaterial({ map: makeEyeTexture(), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.1 });
    M.lash = new T.MeshStandardMaterial({ color: 0x0c0706, roughness: 0.5 });
    M.lip = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, clearcoat: 0.55, clearcoatRoughness: 0.35, side: T.DoubleSide, envMapIntensity: 0.8 });
    M.mouth = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: T.DoubleSide });
    M.hair = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05, clearcoat: 0.0, clearcoatRoughness: 0.5, envMapIntensity: 0.65, side: T.DoubleSide });
    M.hairCap = new T.MeshStandardMaterial({ color: 0x070404, roughness: 0.5, metalness: 0.1, side: T.DoubleSide });
    M.dress = new T.MeshPhysicalMaterial({ color: 0x030304, roughness: 0.82, metalness: 0.0, side: T.DoubleSide, envMapIntensity: 0.14 });
    if ('sheenColor' in M.dress) { M.dress.sheen = 1; M.dress.sheenColor = new T.Color(0x0c0c11); M.dress.sheenRoughness = 0.6; }
    M.hosiery = new T.MeshPhysicalMaterial({ color: 0x050507, roughness: 0.4, envMapIntensity: 0.25 });
    M.shoe = new T.MeshPhysicalMaterial({ color: 0x08080a, roughness: 0.28, clearcoat: 0.6 });
    M.gold = new T.MeshStandardMaterial({ color: 0xd9b35f, roughness: 0.25, metalness: 0.9 });

    function mesh(geo, mat, shadow) {
      var m = new T.Mesh(geo, mat);
      if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
      return m;
    }
    function ell(rx, ry, rz, mat, seg) {
      var m = mesh(new T.SphereGeometry(1, seg || 32, Math.round((seg || 32) * 0.75)), mat);
      m.scale.set(rx, ry, rz); return m;
    }

    /* ---- head ---- */
    var headPivot = new T.Group(); headPivot.position.set(0, PIVOT_Y, 0);
    var head = new T.Group(); head.position.set(0, HEAD_CENTER_Y - PIVOT_Y, 0);
    headPivot.add(head);
    var headGeo = buildHeadGeometry();
    var headMesh = mesh(headGeo, M.skin); headMesh.receiveShadow = false;
    head.add(headMesh);
    var basePos = new Float32Array(headGeo.attributes.position.array);

    var ray = new T.Raycaster();
    function surface(x, y) {
      ray.set(new T.Vector3(x, y, 2), new T.Vector3(0, 0, -1));
      headMesh.updateMatrixWorld(true);
      var hit = ray.intersectObject(headMesh, false)[0];
      return hit ? { p: hit.point.clone(), n: hit.face.normal.clone() } : { p: new T.Vector3(x, y, 0.4), n: new T.Vector3(0, 0, 1) };
    }

    // ears
    [-1, 1].forEach(function (s) {
      var ear = ell(0.034, 0.075, 0.05, M.bodySkin); ear.position.set(s * 0.395, -0.03, -0.07); ear.rotation.y = s * 0.3; head.add(ear);
    });

    /* ---- influences (sparse morph targets applied on the CPU) ---- */
    function influence(fn) {
      var idx = [], dx = [], dy = [], dz = [], n = basePos.length / 3, out = [0, 0, 0, 0];
      for (var i = 0; i < n; i++) {
        out[0] = 0;
        fn(basePos[3 * i], basePos[3 * i + 1], basePos[3 * i + 2], out);
        if (out[0] > 0.002) { idx.push(i); dx.push(out[0] * out[1]); dy.push(out[0] * out[2]); dz.push(out[0] * out[3]); }
      }
      return { idx: Int32Array.from(idx), dx: Float32Array.from(dx), dy: Float32Array.from(dy), dz: Float32Array.from(dz) };
    }
    function front(z) { return smooth(0.05, 0.3, z / HEAD.rz); }
    var INF = {};
    [-1, 1].forEach(function (s) {
      var k = s < 0 ? 'L' : 'R';
      INF['browUp' + k] = influence(function (x, y, z, o) {
        var w = gauss((x - s * 0.2) * (x - s * 0.2), 0.11) * gauss((y - 0.15) * (y - 0.15), 0.06) * front(z);
        var w2 = gauss((x - s * 0.15) * (x - s * 0.15) + (y - 0.3) * (y - 0.3), 0.14) * 0.3 * front(z);
        o[0] = w + w2; o[1] = 0; o[2] = (0.05 * w + 0.03 * w2) / Math.max(o[0], 1e-6); o[3] = 0.012;
      });
      INF['browInner' + k] = influence(function (x, y, z, o) {
        o[0] = gauss((x - s * 0.09) * (x - s * 0.09), 0.05) * gauss((y - 0.15) * (y - 0.15), 0.045) * front(z);
        o[1] = s * 0.005; o[2] = 0.045; o[3] = 0.004;
      });
      INF['browOuter' + k] = influence(function (x, y, z, o) {
        o[0] = gauss((x - s * 0.3) * (x - s * 0.3), 0.07) * gauss((y - 0.14) * (y - 0.14), 0.05) * front(z);
        o[1] = 0; o[2] = 0.04; o[3] = 0;
      });
      INF['cheek' + k] = influence(function (x, y, z, o) {
        o[0] = gauss((x - s * 0.235) * (x - s * 0.235) + (y + 0.1) * (y + 0.1), 0.09) * front(z);
        o[1] = s * 0.006; o[2] = 0.032; o[3] = 0.014;
      });
      INF['corner' + k] = influence(function (x, y, z, o) {
        o[0] = gauss((x - s * 0.105) * (x - s * 0.105) + (y - LM.mouthY) * (y - LM.mouthY), 0.055) * front(z);
        o[1] = s * 0.02; o[2] = 0.034; o[3] = 0.004;
      });
      INF['clench' + k] = influence(function (x, y, z, o) {
        o[0] = gauss((x - s * 0.3) * (x - s * 0.3) + (y + 0.3) * (y + 0.3), 0.08) * smooth(-0.05, 0.2, z / HEAD.rz);
        o[1] = s * 0.014; o[2] = 0; o[3] = 0.006;
      });
    });
    INF.jaw = influence(function (x, y, z, o) {
      o[0] = smooth(-0.335, -0.46, y) * smooth(-0.05, 0.22, z / HEAD.rz);
      o[1] = 0; o[2] = -0.095; o[3] = -0.012;
    }); /* ---- eyes ---- */
    var eyes = [];
    var R = LM.eyeR;
    [-1, 1].forEach(function (s) {
      var hit = surface(s * LM.eyeX, LM.eyeY);
      var g = new T.Group();
      g.position.copy(hit.p).addScaledVector(hit.n, -R * 0.74);
      head.add(g);
      var ball = mesh(new T.SphereGeometry(R, 48, 36), M.eye, false);
      g.add(ball);

      function lidDome(top) {
        var geo = new T.SphereGeometry(R * 1.045, 36, 18, 0, Math.PI * 2, top ? 0 : Math.PI / 2, Math.PI / 2);
        var lg = new T.Group(), m = mesh(geo, M.lid); lg.add(m);
        if (top) { var ring = new T.Mesh(new T.TorusGeometry(R * 1.045, 0.0062, 6, 48), M.lash); ring.rotation.x = Math.PI / 2; lg.add(ring); }
        if (top) {
          for (var i = 0; i < 10; i++) {
            var psi = Math.PI / 2 - 0.85 + (1.7 * i) / 9, outer = clamp(s * Math.cos(psi) * 1.1 + 0.35, 0, 1);
            var len = 0.016 + 0.024 * outer, dir = new T.Vector3(Math.cos(psi) * 0.62 + s * 0.2 * outer, 0.6, Math.sin(psi) * 0.7 + 0.35).normalize();
            var lash = new T.Mesh(new T.CylinderGeometry(0.0004, 0.0034, len, 4), M.lash);
            lash.position.set(Math.cos(psi) * R * 1.045, 0, Math.sin(psi) * R * 1.045).addScaledVector(dir, len / 2);
            lash.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir);
            lg.add(lash);
          }
        }
        g.add(lg);
        return lg;
      }
      var cl = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
      var c1 = new T.Mesh(new T.CircleGeometry(R * 0.2, 20), cl), c2 = new T.Mesh(new T.CircleGeometry(R * 0.085, 14), cl);
      function place(m, dx, dy) {
        var v = new T.Vector3(dx, dy, 0); v.z = Math.sqrt(Math.max(0.05, 1 - dx * dx - dy * dy));
        m.position.copy(v).multiplyScalar(R * 1.012); m.lookAt(v.clone().multiplyScalar(5)); g.add(m);
      }
      place(c1, -0.2, 0.22); place(c2, 0.2, -0.2);
      eyes.push({ s: s, g: g, ball: ball, upper: lidDome(true), lower: lidDome(false) });
    }); /* ---- mouth ---- */
    var mHit = surface(0, LM.mouthY), mHi = surface(0, LM.mouthY + 0.05), mLo = surface(0, LM.mouthY - 0.05), mSide = surface(0.1, LM.mouthY);
    var Z0 = mHit.p.z, ZSLOPE = (mHi.p.z - mLo.p.z) / 0.1, ZCURVE = Math.max(0.2, (Z0 - mSide.p.z) / 0.01);
    function zAt(x, y) { return Z0 - ZCURVE * x * x + ZSLOPE * (y - LM.mouthY) + 0.004; }
    var NX = 30;
    var upperLip = Ribbon(NX, 6, M.lip), lowerLip = Ribbon(NX, 6, M.lip), cavity = Ribbon(NX, 10, M.mouth);
    [upperLip, lowerLip].forEach(function (r) { r.mesh.castShadow = true; r.mesh.receiveShadow = true; });
    head.add(upperLip.mesh); head.add(lowerLip.mesh); head.add(cavity.mesh);

    var LIP_EDGE = [0.16, 0.03, 0.035], LIP_BODY = [0.4, 0.09, 0.1], LIP_LIGHT = [0.5, 0.14, 0.14];
    function setLipColor(r, j, ny, edgeAtJ0) {
      var t = j / (ny - 1), e = edgeAtJ0 ? 1 - t : t;       // e = 1 at the closing line
      var k = smooth(0.0, 0.9, e), c = [0, 0, 0];
      for (var q = 0; q < 3; q++) c[q] = lerp(LIP_BODY[q], LIP_EDGE[q], Math.pow(k, 2.2)) * (1 - 0.0) + (LIP_LIGHT[q] - LIP_BODY[q]) * 0.5 * Math.sin(Math.PI * (1 - e)) * 0.4;
      return c;
    }

    var mouthState = { cornerL: 0, cornerR: 0, press: 0, wide: 0, open: 0 };
    function updateMouth(f) {
      var open = clamp(f.jaw, 0, 1.2), press = clamp(f.lipPress, 0, 1), wide = f.mouthWide || 0;
      var w = LM.mouthW * (1 + 0.1 * (f.smileL + f.smileR) / 2 + 0.1 * wide - 0.07 * press - 0.0);
      var drop = open * 0.1;
      for (var j = 0; j < 6; j++) for (var i = 0; i < NX; i++) {
        var u = i / (NX - 1), s = u * 2 - 1, x = s * w, as = Math.abs(s);
        var corner = (s < 0 ? f.smileL : f.smileR) * 0.03 - press * 0.002 + (f.cornerDown || 0) * 0.014;
        var line = corner * as * as * (0.4 + 0.6 * as);
        var env = 1 - Math.pow(as, 2.4);
        var thU = (0.031 * (0.35 + 0.65 * env) + 0.004 * Math.cos(s * 9) * (1 - as)) * (1 - 0.35 * press) * (1 + 0.1 * open);
        var thL = (0.042 * (0.3 + 0.7 * env)) * (1 - 0.3 * press);
        var bowDip = (1 - as) < 0.12 ? 0 : 0;
        // upper lip, rows go from the closing line (j = 0) up to the vermilion border
        var tU = j / 5, yU0 = line + open * 0.006 * env, yU1 = yU0 + thU + bowDip;
        var yu = LM.mouthY + lerp(yU0, yU1, tU);
        var bu = Math.pow(Math.sin(Math.PI * tU * 0.92 + 0.12), 0.9) * 0.016 * env;
        var o = (j * NX + i) * 3;
        upperLip.pos[o] = x; upperLip.pos[o + 1] = yu; upperLip.pos[o + 2] = zAt(x, yu) + bu + open * 0.004 * env;
        var cu = setLipColor(upperLip, j, 6, true);
        upperLip.col[o] = cu[0]; upperLip.col[o + 1] = cu[1]; upperLip.col[o + 2] = cu[2];
        // lower lip, rows go from the bottom border (j = 0) up to the closing line
        var tL = j / 5, yL1 = line - drop * env - 0.0, yL0 = yL1 - thL;
        var yl = LM.mouthY + lerp(yL0, yL1, tL) - (1 - env) * 0.0;
        var bl = Math.pow(Math.sin(Math.PI * (1 - tL) * 0.92 + 0.12), 0.9) * 0.021 * env;
        lowerLip.pos[o] = x; lowerLip.pos[o + 1] = yl; lowerLip.pos[o + 2] = zAt(x, yl) + bl + open * 0.014 * env;
        var cl = setLipColor(lowerLip, j, 6, false);
        lowerLip.col[o] = cl[0]; lowerLip.col[o + 1] = cl[1]; lowerLip.col[o + 2] = cl[2];
      }
      // cavity between the lips: teeth, then dark, then tongue
      for (var jj = 0; jj < 10; jj++) for (var ii = 0; ii < NX; ii++) {
        var u2 = ii / (NX - 1), s2 = u2 * 2 - 1, as2 = Math.abs(s2), x2 = s2 * w * 0.93;
        var env2 = 1 - Math.pow(as2, 2.4);
        var cornerY = (s2 < 0 ? f.smileL : f.smileR) * 0.03 * as2 * as2 * (0.4 + 0.6 * as2);
        var top = cornerY + open * 0.006 * env2, bot = cornerY - drop * env2;
        var tt = jj / 9, y2 = LM.mouthY + lerp(bot, top, tt);
        var o2 = (jj * NX + ii) * 3;
        cavity.pos[o2] = x2; cavity.pos[o2 + 1] = y2; cavity.pos[o2 + 2] = zAt(x2, y2) + 0.002;
        var teeth = tt > 0.7 && open > 0.06 ? 1 : 0, tongue = tt < 0.35 ? 1 : 0;
        var cc = teeth ? [0.65, 0.58, 0.52] : tongue ? [0.32, 0.06, 0.07] : [0.03, 0.005, 0.008];
        cavity.col[o2] = cc[0]; cavity.col[o2 + 1] = cc[1]; cavity.col[o2 + 2] = cc[2];
      }
      upperLip.commit(); lowerLip.commit(); cavity.commit();
    } /* ---- hair ---- */
    var hairGroup = new T.Group(); headPivot.add(hairGroup);
    hairGroup.position.set(0, HEAD_CENTER_Y - PIVOT_Y, 0);
    var strands = new T.Mesh(buildHair(), M.hair); strands.castShadow = true; strands.receiveShadow = true;
    hairGroup.add(strands);
    var capTop = new T.Mesh(new T.SphereGeometry(1, 64, 48, 0, Math.PI * 2, 0, 1.0), M.hairCap);
    capTop.scale.set(0.46, 0.545, 0.5); capTop.position.set(0, 0.012, -0.02); capTop.castShadow = true; hairGroup.add(capTop);
    var capBack = new T.Mesh(new T.SphereGeometry(1, 64, 48, Math.PI, Math.PI, 0, 2.05), M.hairCap);
    capBack.scale.set(0.46, 0.545, 0.5); capBack.position.set(0, 0.012, -0.02); capBack.castShadow = true; hairGroup.add(capBack); /* ---- body ---- */
    var body = new T.Group();
    var neckGeo = new T.CylinderGeometry(0.2, 0.245, 0.95, 48, 6, true), neckCol = [];
    for (var ni = 0; ni < neckGeo.attributes.position.count; ni++) {      // shade under the jaw: darker near the chin, open towards the collar
      var wy = 5.92 + neckGeo.attributes.position.getY(ni), sh = lerp(0.4, 1.0, smooth(6.07, 5.86, wy));
      neckCol.push(sh, sh, sh);
    }
    neckGeo.setAttribute('color', new T.Float32BufferAttribute(neckCol, 3));
    var neckMat = M.bodySkin.clone(); neckMat.vertexColors = true; neckMat.color.set(0x9c6049);
    var neck = mesh(neckGeo, neckMat);
    neck.position.set(0, 5.92, -0.015); body.add(neck);
    var prof = [[0.5, 2.0], [0.54, 2.6], [0.62, 3.3], [0.58, 3.75], [0.42, 4.2], [0.48, 4.7], [0.6, 5.0], [0.72, 5.22], [0.77, 5.36], [0.72, 5.5], [0.58, 5.63], [0.42, 5.75], [0.3, 5.84], [0.248, 5.9]]
      .map(function (p) { return new T.Vector2(p[0], p[1]); });
    var dress = mesh(new T.LatheGeometry(prof, 72), M.dress);
    dress.scale.z = 0.55; body.add(dress);
    var collar = mesh(new T.TorusGeometry(0.25, 0.028, 16, 48), M.dress);
    collar.rotation.x = Math.PI / 2; collar.position.y = 5.895; collar.scale.set(1, 0.9, 1); body.add(collar);

    var arms = [];
    [-1, 1].forEach(function (s) {
      var sh = new T.Group(); sh.position.set(s * 0.8, 5.3, 0);
      sh.add(ell(0.185, 0.2, 0.18, M.dress));
      var up = mesh(new T.CylinderGeometry(0.175, 0.14, 0.9, 32), M.dress); up.position.y = -0.45; sh.add(up);
      var el = new T.Group(); el.position.y = -0.9; sh.add(el);
      el.add(ell(0.142, 0.145, 0.14, M.dress));
      var fo = mesh(new T.CylinderGeometry(0.138, 0.092, 0.85, 32), M.dress); fo.position.y = -0.425; el.add(fo);
      var hand = new T.Group(); hand.position.y = -0.86; el.add(hand);
      var palm = ell(0.085, 0.17, 0.055, M.bodySkin); palm.position.y = -0.14; hand.add(palm);
      for (var f = 0; f < 4; f++) {
        var fin = ell(0.018, 0.1 - Math.abs(f - 1.4) * 0.008, 0.017, M.bodySkin, 12); fin.position.set((f - 1.5) * 0.04, -0.3, 0.012); fin.rotation.x = -0.18; hand.add(fin);
      }
      var th = ell(0.02, 0.07, 0.02, M.bodySkin, 12); th.position.set(-s * 0.075, -0.15, 0.03); th.rotation.z = s * 0.4; hand.add(th);
      sh.rotation.z = s * 0.1; el.rotation.x = -0.5; hand.rotation.x = -0.15; hand.scale.setScalar(0.88);
      body.add(sh); arms.push({ s: s, sh: sh, el: el });
    });
    [-1, 1].forEach(function (s) {
      var legPts = [[0.07, 0.15], [0.085, 0.3], [0.115, 0.9], [0.12, 1.1], [0.105, 1.5], [0.13, 1.9], [0.14, 2.05]].map(function (p) { return new T.Vector2(p[0], p[1]); });
      var leg = mesh(new T.LatheGeometry(legPts, 28), M.hosiery); leg.position.set(s * 0.2, 0, 0); body.add(leg);
      var shoe = ell(0.1, 0.075, 0.26, M.shoe); shoe.position.set(s * 0.2, 0.09, 0.1); body.add(shoe);
    });

    var upperBody = new T.Group();      // everything that breathes together
    group.add(body); group.add(headPivot);
    var api = {
      group: group,
      attachTo: function (scene) { scene.add(group); },
      /* gaze in radians, + yaw looks to the right of the screen, + pitch looks up */
      setGaze: function (yaw, pitch, per) {
        for (var i = 0; i < eyes.length; i++) {
          // eyes[i].s < 0 is the eye on the screen's left, which is the subject's RIGHT eye
          if (per) { var right = eyes[i].s < 0; eyes[i].ball.rotation.set(-(right ? per.pitchR : per.pitchL), right ? per.yawR : per.yawL, 0); }
          else eyes[i].ball.rotation.set(-pitch, yaw, 0);
        }
      },

      /* face params: see ExpressionController for the meaning of each key */
      setFace: function (f) {
        var pos = headGeo.attributes.position.array;
        pos.set(basePos);
        function apply(inf, v) {
          if (!v) return;
          var idx = inf.idx, dx = inf.dx, dy = inf.dy, dz = inf.dz;
          for (var q = 0; q < idx.length; q++) { var i3 = idx[q] * 3; pos[i3] += v * dx[q]; pos[i3 + 1] += v * dy[q]; pos[i3 + 2] += v * dz[q]; }
        }
        apply(INF.browUpL, f.browUpL); apply(INF.browUpR, f.browUpR);
        apply(INF.browInnerL, f.browInnerL); apply(INF.browInnerR, f.browInnerR);
        apply(INF.browOuterL, f.browOuterL); apply(INF.browOuterR, f.browOuterR);
        apply(INF.cheekL, f.cheek * (0.5 + f.smileL * 0.5)); apply(INF.cheekR, f.cheek * (0.5 + f.smileR * 0.5));
        apply(INF.cornerL, f.smileL); apply(INF.cornerR, f.smileR);
        apply(INF.clenchL, f.clench); apply(INF.clenchR, f.clench);
        apply(INF.jaw, clamp(f.jaw, 0, 1.2));
        headGeo.attributes.position.needsUpdate = true;
        headGeo.computeVertexNormals();

        for (var i = 0; i < eyes.length; i++) {
          var e = eyes[i], open = e.s < 0 ? f.lidL : f.lidR;
          open = clamp(open * (1 - f.blink), 0, 1.15);
          var eUp = lerp(-0.5, 0.78, open) - 0.04;                       // edge elevation of the upper lid, radians
          var eLow = lerp(-0.3, -0.12, clamp(f.squint + f.blink * 0.8, 0, 1));
          e.upper.rotation.x = -eUp;
          e.lower.rotation.x = -eLow;
        }
        updateMouth(f);
      },

      /* pose in radians; breath 0..1; sway in head units */
      setPose: function (p) {
        headPivot.rotation.set(p.headPitch, p.headYaw, p.headRoll, 'YXZ');
        hairGroup.rotation.set(0, 0, 0);
        var lift = (p.breath || 0) * 0.016;
        headPivot.position.y = PIVOT_Y + lift + (p.chest || 0) * 0.02;
        body.position.set(p.sway || 0, 0, 0);
        body.rotation.set(0, p.bodyYaw || 0, p.bodyRoll || 0, 'YXZ');
        dress.scale.y = 1 + (p.breath || 0) * 0.004;
        headPivot.position.x = (p.sway || 0);
        arms.forEach(function (a) {
          a.sh.rotation.z = a.s * (0.1 + (p.breath || 0) * 0.008);
          a.el.rotation.x = -0.5 + (p.armSwing || 0) * a.s * 0.02;
        });
        hairGroup.rotation.x = -(p.headPitch || 0) * 0.15;
      },

      materials: M,
      landmarks: { headCenterY: HEAD_CENTER_Y, eyeY: HEAD_CENTER_Y + LM.eyeY, mouthY: HEAD_CENTER_Y + LM.mouthY }
    };
    return api;
  };
})(window);

/* ===== model/procedural/ProceduralAvatar.js ===== */
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

/* ===== vendor/KTX2Loader.js ===== */
/* GENERATED by tools/make-ktx2-loader.js from three.js r147 examples/jsm (MIT). Do not edit. */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, cache = null;
  /* WA.makeKTX2Loader(THREE) -> the KTX2Loader class for that THREE build (created once) */
  WA.makeKTX2Loader = function (THREE) {
    if (cache && cache.T === THREE) return cache.K;
    const { CompressedTexture, CompressedArrayTexture, Data3DTexture, DataTexture, FileLoader, FloatType, HalfFloatType, LinearEncoding, LinearFilter, LinearMipmapLinearFilter, Loader, RedFormat, RGB_ETC1_Format, RGB_ETC2_Format, RGB_PVRTC_4BPPV1_Format, RGB_S3TC_DXT1_Format, RGBA_ASTC_4x4_Format, RGBA_BPTC_Format, RGBA_ETC2_EAC_Format, RGBA_PVRTC_4BPPV1_Format, RGBA_S3TC_DXT5_Format, RGBAFormat, RGFormat, sRGBEncoding, UnsignedByteType } = THREE;
    /**
     * @author Deepkolos / https://github.com/deepkolos
     */
    
    class WorkerPool {
    
    	constructor( pool = 4 ) {
    
    		this.pool = pool;
    		this.queue = [];
    		this.workers = [];
    		this.workersResolve = [];
    		this.workerStatus = 0;
    
    	}
    
    	_initWorker( workerId ) {
    
    		if ( ! this.workers[ workerId ] ) {
    
    			const worker = this.workerCreator();
    			worker.addEventListener( 'message', this._onMessage.bind( this, workerId ) );
    			this.workers[ workerId ] = worker;
    
    		}
    
    	}
    
    	_getIdleWorker() {
    
    		for ( let i = 0; i < this.pool; i ++ )
    			if ( ! ( this.workerStatus & ( 1 << i ) ) ) return i;
    
    		return - 1;
    
    	}
    
    	_onMessage( workerId, msg ) {
    
    		const resolve = this.workersResolve[ workerId ];
    		resolve && resolve( msg );
    
    		if ( this.queue.length ) {
    
    			const { resolve, msg, transfer } = this.queue.shift();
    			this.workersResolve[ workerId ] = resolve;
    			this.workers[ workerId ].postMessage( msg, transfer );
    
    		} else {
    
    			this.workerStatus ^= 1 << workerId;
    
    		}
    
    	}
    
    	setWorkerCreator( workerCreator ) {
    
    		this.workerCreator = workerCreator;
    
    	}
    
    	setWorkerLimit( pool ) {
    
    		this.pool = pool;
    
    	}
    
    	postMessage( msg, transfer ) {
    
    		return new Promise( ( resolve ) => {
    
    			const workerId = this._getIdleWorker();
    
    			if ( workerId !== - 1 ) {
    
    				this._initWorker( workerId );
    				this.workerStatus |= 1 << workerId;
    				this.workersResolve[ workerId ] = resolve;
    				this.workers[ workerId ].postMessage( msg, transfer );
    
    			} else {
    
    				this.queue.push( { resolve, msg, transfer } );
    
    			}
    
    		} );
    
    	}
    
    	dispose() {
    
    		this.workers.forEach( ( worker ) => worker.terminate() );
    		this.workersResolve.length = 0;
    		this.workers.length = 0;
    		this.queue.length = 0;
    		this.workerStatus = 0;
    
    	}
    
    }
    
    const { read, KHR_DF_FLAG_ALPHA_PREMULTIPLIED, KHR_DF_TRANSFER_SRGB, KHR_SUPERCOMPRESSION_NONE, KHR_SUPERCOMPRESSION_ZSTD, VK_FORMAT_UNDEFINED, VK_FORMAT_R16_SFLOAT, VK_FORMAT_R16G16_SFLOAT, VK_FORMAT_R16G16B16A16_SFLOAT, VK_FORMAT_R32_SFLOAT, VK_FORMAT_R32G32_SFLOAT, VK_FORMAT_R32G32B32A32_SFLOAT, VK_FORMAT_R8_SRGB, VK_FORMAT_R8_UNORM, VK_FORMAT_R8G8_SRGB, VK_FORMAT_R8G8_UNORM, VK_FORMAT_R8G8B8A8_SRGB, VK_FORMAT_R8G8B8A8_UNORM } = (function () {
    const t=0,e=1,n=2,i=3,s=0,a=0,r=2,o=0,l=1,f=160,U=161,c=162,h=163,_=0,p=1,g=0,y=1,x=2,u=3,b=4,d=5,m=6,w=7,D=8,B=9,L=10,A=11,k=12,v=13,S=14,I=15,O=16,T=17,V=18,E=0,F=1,P=2,C=3,z=4,M=5,W=6,N=7,H=8,K=9,X=10,j=11,R=0,Y=1,q=2,G=13,J=14,Q=15,Z=128,$=64,tt=32,et=16,nt=0,it=1,st=2,at=3,rt=4,ot=5,lt=6,ft=7,Ut=8,ct=9,ht=10,_t=13,pt=14,gt=15,yt=16,xt=17,ut=20,bt=21,dt=22,mt=23,wt=24,Dt=27,Bt=28,Lt=29,At=30,kt=31,vt=34,St=35,It=36,Ot=37,Tt=38,Vt=41,Et=42,Ft=43,Pt=44,Ct=45,zt=48,Mt=49,Wt=50,Nt=58,Ht=59,Kt=62,Xt=63,jt=64,Rt=65,Yt=68,qt=69,Gt=70,Jt=71,Qt=74,Zt=75,$t=76,te=77,ee=78,ne=81,ie=82,se=83,ae=84,re=85,oe=88,le=89,fe=90,Ue=91,ce=92,he=95,_e=96,pe=97,ge=98,ye=99,xe=100,ue=101,be=102,de=103,me=104,we=105,De=106,Be=107,Le=108,Ae=109,ke=110,ve=111,Se=112,Ie=113,Oe=114,Te=115,Ve=116,Ee=117,Fe=118,Pe=119,Ce=120,ze=121,Me=122,We=123,Ne=124,He=125,Ke=126,Xe=127,je=128,Re=129,Ye=130,qe=131,Ge=132,Je=133,Qe=134,Ze=135,$e=136,tn=137,en=138,nn=139,sn=140,an=141,rn=142,on=143,ln=144,fn=145,Un=146,cn=147,hn=148,_n=149,pn=150,gn=151,yn=152,xn=153,un=154,bn=155,dn=156,mn=157,wn=158,Dn=159,Bn=160,Ln=161,An=162,kn=163,vn=164,Sn=165,In=166,On=167,Tn=168,Vn=169,En=170,Fn=171,Pn=172,Cn=173,zn=174,Mn=175,Wn=176,Nn=177,Hn=178,Kn=179,Xn=180,jn=181,Rn=182,Yn=183,qn=184,Gn=1000156007,Jn=1000156008,Qn=1000156009,Zn=1000156010,$n=1000156011,ti=1000156017,ei=1000156018,ni=1000156019,ii=1000156020,si=1000156021,ai=1000054e3,ri=1000054001,oi=1000054002,li=1000054003,fi=1000054004,Ui=1000054005,ci=1000054006,hi=1000054007,_i=1000066e3,pi=1000066001,gi=1000066002,yi=1000066003,xi=1000066004,ui=1000066005,bi=1000066006,di=1000066007,mi=1000066008,wi=1000066009,Di=1000066010,Bi=1000066011,Li=1000066012,Ai=1000066013,ki=100034e4,vi=1000340001;class Si{constructor(){this.vkFormat=0,this.typeSize=1,this.pixelWidth=0,this.pixelHeight=0,this.pixelDepth=0,this.layerCount=0,this.faceCount=1,this.supercompressionScheme=0,this.levels=[],this.dataFormatDescriptor=[{vendorId:0,descriptorType:0,descriptorBlockSize:0,versionNumber:2,colorModel:0,colorPrimaries:1,transferFunction:2,flags:0,texelBlockDimension:[0,0,0,0],bytesPlane:[0,0,0,0,0,0,0,0],samples:[]}],this.keyValue={},this.globalData=null}}class Ii{constructor(t,e,n,i){this._dataView=new DataView(t.buffer,t.byteOffset+e,n),this._littleEndian=i,this._offset=0}_nextUint8(){const t=this._dataView.getUint8(this._offset);return this._offset+=1,t}_nextUint16(){const t=this._dataView.getUint16(this._offset,this._littleEndian);return this._offset+=2,t}_nextUint32(){const t=this._dataView.getUint32(this._offset,this._littleEndian);return this._offset+=4,t}_nextUint64(){const t=this._dataView.getUint32(this._offset,this._littleEndian)+2**32*this._dataView.getUint32(this._offset+4,this._littleEndian);return this._offset+=8,t}_nextInt32(){const t=this._dataView.getInt32(this._offset,this._littleEndian);return this._offset+=4,t}_skip(t){return this._offset+=t,this}_scan(t,e=0){const n=this._offset;let i=0;for(;this._dataView.getUint8(this._offset)!==e&&i<t;)i++,this._offset++;return i<t&&this._offset++,new Uint8Array(this._dataView.buffer,this._dataView.byteOffset+n,i)}}const Oi=new Uint8Array([0]),Ti=[171,75,84,88,32,50,48,187,13,10,26,10];function Vi(t){return"undefined"!=typeof TextEncoder?(new TextEncoder).encode(t):Buffer.from(t)}function Ei(t){return"undefined"!=typeof TextDecoder?(new TextDecoder).decode(t):Buffer.from(t).toString("utf8")}function Fi(t){let e=0;for(const n of t)e+=n.byteLength;const n=new Uint8Array(e);let i=0;for(const e of t)n.set(new Uint8Array(e),i),i+=e.byteLength;return n}function Pi(t){const e=new Uint8Array(t.buffer,t.byteOffset,Ti.length);if(e[0]!==Ti[0]||e[1]!==Ti[1]||e[2]!==Ti[2]||e[3]!==Ti[3]||e[4]!==Ti[4]||e[5]!==Ti[5]||e[6]!==Ti[6]||e[7]!==Ti[7]||e[8]!==Ti[8]||e[9]!==Ti[9]||e[10]!==Ti[10]||e[11]!==Ti[11])throw new Error("Missing KTX 2.0 identifier.");const n=new Si,i=17*Uint32Array.BYTES_PER_ELEMENT,s=new Ii(t,Ti.length,i,!0);n.vkFormat=s._nextUint32(),n.typeSize=s._nextUint32(),n.pixelWidth=s._nextUint32(),n.pixelHeight=s._nextUint32(),n.pixelDepth=s._nextUint32(),n.layerCount=s._nextUint32(),n.faceCount=s._nextUint32();const a=s._nextUint32();n.supercompressionScheme=s._nextUint32();const r=s._nextUint32(),o=s._nextUint32(),l=s._nextUint32(),f=s._nextUint32(),U=s._nextUint64(),c=s._nextUint64(),h=new Ii(t,Ti.length+i,3*a*8,!0);for(let e=0;e<a;e++)n.levels.push({levelData:new Uint8Array(t.buffer,t.byteOffset+h._nextUint64(),h._nextUint64()),uncompressedByteLength:h._nextUint64()});const _=new Ii(t,r,o,!0),p={vendorId:_._skip(4)._nextUint16(),descriptorType:_._nextUint16(),versionNumber:_._nextUint16(),descriptorBlockSize:_._nextUint16(),colorModel:_._nextUint8(),colorPrimaries:_._nextUint8(),transferFunction:_._nextUint8(),flags:_._nextUint8(),texelBlockDimension:[_._nextUint8(),_._nextUint8(),_._nextUint8(),_._nextUint8()],bytesPlane:[_._nextUint8(),_._nextUint8(),_._nextUint8(),_._nextUint8(),_._nextUint8(),_._nextUint8(),_._nextUint8(),_._nextUint8()],samples:[]},g=(p.descriptorBlockSize/4-6)/4;for(let t=0;t<g;t++){const e={bitOffset:_._nextUint16(),bitLength:_._nextUint8(),channelType:_._nextUint8(),samplePosition:[_._nextUint8(),_._nextUint8(),_._nextUint8(),_._nextUint8()],sampleLower:-Infinity,sampleUpper:Infinity};64&e.channelType?(e.sampleLower=_._nextInt32(),e.sampleUpper=_._nextInt32()):(e.sampleLower=_._nextUint32(),e.sampleUpper=_._nextUint32()),p.samples[t]=e}n.dataFormatDescriptor.length=0,n.dataFormatDescriptor.push(p);const y=new Ii(t,l,f,!0);for(;y._offset<f;){const t=y._nextUint32(),e=y._scan(t),i=Ei(e),s=y._scan(t-e.byteLength);n.keyValue[i]=i.match(/^ktx/i)?Ei(s):s,y._offset%4&&y._skip(4-y._offset%4)}if(c<=0)return n;const x=new Ii(t,U,c,!0),u=x._nextUint16(),b=x._nextUint16(),d=x._nextUint32(),m=x._nextUint32(),w=x._nextUint32(),D=x._nextUint32(),B=[];for(let t=0;t<a;t++)B.push({imageFlags:x._nextUint32(),rgbSliceByteOffset:x._nextUint32(),rgbSliceByteLength:x._nextUint32(),alphaSliceByteOffset:x._nextUint32(),alphaSliceByteLength:x._nextUint32()});const L=U+x._offset,A=L+d,k=A+m,v=k+w,S=new Uint8Array(t.buffer,t.byteOffset+L,d),I=new Uint8Array(t.buffer,t.byteOffset+A,m),O=new Uint8Array(t.buffer,t.byteOffset+k,w),T=new Uint8Array(t.buffer,t.byteOffset+v,D);return n.globalData={endpointCount:u,selectorCount:b,imageDescs:B,endpointsData:S,selectorsData:I,tablesData:O,extendedData:T},n}function Ci(){return(Ci=Object.assign||function(t){for(var e=1;e<arguments.length;e++){var n=arguments[e];for(var i in n)Object.prototype.hasOwnProperty.call(n,i)&&(t[i]=n[i])}return t}).apply(this,arguments)}const zi={keepWriter:!1};function Mi(t,e={}){e=Ci({},zi,e);let n=new ArrayBuffer(0);if(t.globalData){const e=new ArrayBuffer(20+5*t.globalData.imageDescs.length*4),i=new DataView(e);i.setUint16(0,t.globalData.endpointCount,!0),i.setUint16(2,t.globalData.selectorCount,!0),i.setUint32(4,t.globalData.endpointsData.byteLength,!0),i.setUint32(8,t.globalData.selectorsData.byteLength,!0),i.setUint32(12,t.globalData.tablesData.byteLength,!0),i.setUint32(16,t.globalData.extendedData.byteLength,!0);for(let e=0;e<t.globalData.imageDescs.length;e++){const n=t.globalData.imageDescs[e];i.setUint32(20+5*e*4+0,n.imageFlags,!0),i.setUint32(20+5*e*4+4,n.rgbSliceByteOffset,!0),i.setUint32(20+5*e*4+8,n.rgbSliceByteLength,!0),i.setUint32(20+5*e*4+12,n.alphaSliceByteOffset,!0),i.setUint32(20+5*e*4+16,n.alphaSliceByteLength,!0)}n=Fi([e,t.globalData.endpointsData,t.globalData.selectorsData,t.globalData.tablesData,t.globalData.extendedData])}const i=[];let s=t.keyValue;e.keepWriter||(s=Ci({},t.keyValue,{KTXwriter:"KTX-Parse v0.3.1"}));for(const t in s){const e=s[t],n=Vi(t),a="string"==typeof e?Vi(e):e,r=n.byteLength+1+a.byteLength+1,o=r%4?4-r%4:0;i.push(Fi([new Uint32Array([r]),n,Oi,a,Oi,new Uint8Array(o).fill(0)]))}const a=Fi(i);if(1!==t.dataFormatDescriptor.length||0!==t.dataFormatDescriptor[0].descriptorType)throw new Error("Only BASICFORMAT Data Format Descriptor output supported.");const r=t.dataFormatDescriptor[0],o=new ArrayBuffer(28+16*r.samples.length),l=new DataView(o),f=24+16*r.samples.length;if(l.setUint32(0,o.byteLength,!0),l.setUint16(4,r.vendorId,!0),l.setUint16(6,r.descriptorType,!0),l.setUint16(8,r.versionNumber,!0),l.setUint16(10,f,!0),l.setUint8(12,r.colorModel),l.setUint8(13,r.colorPrimaries),l.setUint8(14,r.transferFunction),l.setUint8(15,r.flags),!Array.isArray(r.texelBlockDimension))throw new Error("texelBlockDimension is now an array. For dimensionality `d`, set `d - 1`.");l.setUint8(16,r.texelBlockDimension[0]),l.setUint8(17,r.texelBlockDimension[1]),l.setUint8(18,r.texelBlockDimension[2]),l.setUint8(19,r.texelBlockDimension[3]);for(let t=0;t<8;t++)l.setUint8(20+t,r.bytesPlane[t]);for(let t=0;t<r.samples.length;t++){const e=r.samples[t],n=28+16*t;if(e.channelID)throw new Error("channelID has been renamed to channelType.");l.setUint16(n+0,e.bitOffset,!0),l.setUint8(n+2,e.bitLength),l.setUint8(n+3,e.channelType),l.setUint8(n+4,e.samplePosition[0]),l.setUint8(n+5,e.samplePosition[1]),l.setUint8(n+6,e.samplePosition[2]),l.setUint8(n+7,e.samplePosition[3]),64&e.channelType?(l.setInt32(n+8,e.sampleLower,!0),l.setInt32(n+12,e.sampleUpper,!0)):(l.setUint32(n+8,e.sampleLower,!0),l.setUint32(n+12,e.sampleUpper,!0))}const U=Ti.length+68+3*t.levels.length*8,c=U+o.byteLength;let h=n.byteLength>0?c+a.byteLength:0;h%8&&(h+=8-h%8);const _=[],p=new DataView(new ArrayBuffer(3*t.levels.length*8));let g=(h||c+a.byteLength)+n.byteLength;for(let e=0;e<t.levels.length;e++){const n=t.levels[e];_.push(n.levelData),p.setBigUint64(24*e+0,BigInt(g),!0),p.setBigUint64(24*e+8,BigInt(n.levelData.byteLength),!0),p.setBigUint64(24*e+16,BigInt(n.uncompressedByteLength),!0),g+=n.levelData.byteLength}const y=new ArrayBuffer(68),x=new DataView(y);return x.setUint32(0,t.vkFormat,!0),x.setUint32(4,t.typeSize,!0),x.setUint32(8,t.pixelWidth,!0),x.setUint32(12,t.pixelHeight,!0),x.setUint32(16,t.pixelDepth,!0),x.setUint32(20,t.layerCount,!0),x.setUint32(24,t.faceCount,!0),x.setUint32(28,t.levels.length,!0),x.setUint32(32,t.supercompressionScheme,!0),x.setUint32(36,U,!0),x.setUint32(40,o.byteLength,!0),x.setUint32(44,c,!0),x.setUint32(48,a.byteLength,!0),x.setBigUint64(52,BigInt(n.byteLength>0?h:0),!0),x.setBigUint64(60,BigInt(n.byteLength),!0),new Uint8Array(Fi([new Uint8Array(Ti).buffer,y,p.buffer,o,a,h>0?new ArrayBuffer(h-(c+a.byteLength)):new ArrayBuffer(0),n,..._]))}return { KHR_DF_CHANNEL_RGBSDA_ALPHA: Q, KHR_DF_CHANNEL_RGBSDA_BLUE: q, KHR_DF_CHANNEL_RGBSDA_DEPTH: J, KHR_DF_CHANNEL_RGBSDA_GREEN: Y, KHR_DF_CHANNEL_RGBSDA_RED: R, KHR_DF_CHANNEL_RGBSDA_STENCIL: G, KHR_DF_FLAG_ALPHA_PREMULTIPLIED: p, KHR_DF_FLAG_ALPHA_STRAIGHT: _, KHR_DF_KHR_DESCRIPTORTYPE_BASICFORMAT: s, KHR_DF_MODEL_ASTC: c, KHR_DF_MODEL_ETC1: f, KHR_DF_MODEL_ETC1S: h, KHR_DF_MODEL_ETC2: U, KHR_DF_MODEL_RGBSDA: l, KHR_DF_MODEL_UNSPECIFIED: o, KHR_DF_PRIMARIES_ACES: W, KHR_DF_PRIMARIES_ACESCC: N, KHR_DF_PRIMARIES_ADOBERGB: j, KHR_DF_PRIMARIES_BT2020: z, KHR_DF_PRIMARIES_BT601_EBU: P, KHR_DF_PRIMARIES_BT601_SMPTE: C, KHR_DF_PRIMARIES_BT709: F, KHR_DF_PRIMARIES_CIEXYZ: M, KHR_DF_PRIMARIES_DISPLAYP3: X, KHR_DF_PRIMARIES_NTSC1953: H, KHR_DF_PRIMARIES_PAL525: K, KHR_DF_PRIMARIES_UNSPECIFIED: E, KHR_DF_SAMPLE_DATATYPE_EXPONENT: tt, KHR_DF_SAMPLE_DATATYPE_FLOAT: Z, KHR_DF_SAMPLE_DATATYPE_LINEAR: et, KHR_DF_SAMPLE_DATATYPE_SIGNED: $, KHR_DF_TRANSFER_ACESCC: O, KHR_DF_TRANSFER_ACESCCT: T, KHR_DF_TRANSFER_ADOBERGB: V, KHR_DF_TRANSFER_BT1886: w, KHR_DF_TRANSFER_DCIP3: k, KHR_DF_TRANSFER_HLG_EOTF: B, KHR_DF_TRANSFER_HLG_OETF: D, KHR_DF_TRANSFER_ITU: u, KHR_DF_TRANSFER_LINEAR: y, KHR_DF_TRANSFER_NTSC: b, KHR_DF_TRANSFER_PAL625_EOTF: S, KHR_DF_TRANSFER_PAL_OETF: v, KHR_DF_TRANSFER_PQ_EOTF: L, KHR_DF_TRANSFER_PQ_OETF: A, KHR_DF_TRANSFER_SLOG: d, KHR_DF_TRANSFER_SLOG2: m, KHR_DF_TRANSFER_SRGB: x, KHR_DF_TRANSFER_ST240: I, KHR_DF_TRANSFER_UNSPECIFIED: g, KHR_DF_VENDORID_KHRONOS: a, KHR_DF_VERSION: r, KHR_SUPERCOMPRESSION_BASISLZ: e, KHR_SUPERCOMPRESSION_NONE: t, KHR_SUPERCOMPRESSION_ZLIB: i, KHR_SUPERCOMPRESSION_ZSTD: n, KTX2Container: Si, VK_FORMAT_A1R5G5B5_UNORM_PACK16: Ut, VK_FORMAT_A2B10G10R10_SINT_PACK32: qt, VK_FORMAT_A2B10G10R10_SNORM_PACK32: Rt, VK_FORMAT_A2B10G10R10_UINT_PACK32: Yt, VK_FORMAT_A2B10G10R10_UNORM_PACK32: jt, VK_FORMAT_A2R10G10B10_SINT_PACK32: Xt, VK_FORMAT_A2R10G10B10_SNORM_PACK32: Ht, VK_FORMAT_A2R10G10B10_UINT_PACK32: Kt, VK_FORMAT_A2R10G10B10_UNORM_PACK32: Nt, VK_FORMAT_A4B4G4R4_UNORM_PACK16_EXT: vi, VK_FORMAT_A4R4G4B4_UNORM_PACK16_EXT: ki, VK_FORMAT_ASTC_10x10_SFLOAT_BLOCK_EXT: Bi, VK_FORMAT_ASTC_10x10_SRGB_BLOCK: Xn, VK_FORMAT_ASTC_10x10_UNORM_BLOCK: Kn, VK_FORMAT_ASTC_10x5_SFLOAT_BLOCK_EXT: mi, VK_FORMAT_ASTC_10x5_SRGB_BLOCK: zn, VK_FORMAT_ASTC_10x5_UNORM_BLOCK: Cn, VK_FORMAT_ASTC_10x6_SFLOAT_BLOCK_EXT: wi, VK_FORMAT_ASTC_10x6_SRGB_BLOCK: Wn, VK_FORMAT_ASTC_10x6_UNORM_BLOCK: Mn, VK_FORMAT_ASTC_10x8_SFLOAT_BLOCK_EXT: Di, VK_FORMAT_ASTC_10x8_SRGB_BLOCK: Hn, VK_FORMAT_ASTC_10x8_UNORM_BLOCK: Nn, VK_FORMAT_ASTC_12x10_SFLOAT_BLOCK_EXT: Li, VK_FORMAT_ASTC_12x10_SRGB_BLOCK: Rn, VK_FORMAT_ASTC_12x10_UNORM_BLOCK: jn, VK_FORMAT_ASTC_12x12_SFLOAT_BLOCK_EXT: Ai, VK_FORMAT_ASTC_12x12_SRGB_BLOCK: qn, VK_FORMAT_ASTC_12x12_UNORM_BLOCK: Yn, VK_FORMAT_ASTC_4x4_SFLOAT_BLOCK_EXT: _i, VK_FORMAT_ASTC_4x4_SRGB_BLOCK: wn, VK_FORMAT_ASTC_4x4_UNORM_BLOCK: mn, VK_FORMAT_ASTC_5x4_SFLOAT_BLOCK_EXT: pi, VK_FORMAT_ASTC_5x4_SRGB_BLOCK: Bn, VK_FORMAT_ASTC_5x4_UNORM_BLOCK: Dn, VK_FORMAT_ASTC_5x5_SFLOAT_BLOCK_EXT: gi, VK_FORMAT_ASTC_5x5_SRGB_BLOCK: An, VK_FORMAT_ASTC_5x5_UNORM_BLOCK: Ln, VK_FORMAT_ASTC_6x5_SFLOAT_BLOCK_EXT: yi, VK_FORMAT_ASTC_6x5_SRGB_BLOCK: vn, VK_FORMAT_ASTC_6x5_UNORM_BLOCK: kn, VK_FORMAT_ASTC_6x6_SFLOAT_BLOCK_EXT: xi, VK_FORMAT_ASTC_6x6_SRGB_BLOCK: In, VK_FORMAT_ASTC_6x6_UNORM_BLOCK: Sn, VK_FORMAT_ASTC_8x5_SFLOAT_BLOCK_EXT: ui, VK_FORMAT_ASTC_8x5_SRGB_BLOCK: Tn, VK_FORMAT_ASTC_8x5_UNORM_BLOCK: On, VK_FORMAT_ASTC_8x6_SFLOAT_BLOCK_EXT: bi, VK_FORMAT_ASTC_8x6_SRGB_BLOCK: En, VK_FORMAT_ASTC_8x6_UNORM_BLOCK: Vn, VK_FORMAT_ASTC_8x8_SFLOAT_BLOCK_EXT: di, VK_FORMAT_ASTC_8x8_SRGB_BLOCK: Pn, VK_FORMAT_ASTC_8x8_UNORM_BLOCK: Fn, VK_FORMAT_B10G11R11_UFLOAT_PACK32: Me, VK_FORMAT_B10X6G10X6R10X6G10X6_422_UNORM_4PACK16: $n, VK_FORMAT_B12X4G12X4R12X4G12X4_422_UNORM_4PACK16: si, VK_FORMAT_B4G4R4A4_UNORM_PACK16: at, VK_FORMAT_B5G5R5A1_UNORM_PACK16: ft, VK_FORMAT_B5G6R5_UNORM_PACK16: ot, VK_FORMAT_B8G8R8A8_SINT: Mt, VK_FORMAT_B8G8R8A8_SNORM: Ct, VK_FORMAT_B8G8R8A8_SRGB: Wt, VK_FORMAT_B8G8R8A8_UINT: zt, VK_FORMAT_B8G8R8A8_UNORM: Pt, VK_FORMAT_B8G8R8_SINT: St, VK_FORMAT_B8G8R8_SNORM: kt, VK_FORMAT_B8G8R8_SRGB: It, VK_FORMAT_B8G8R8_UINT: vt, VK_FORMAT_B8G8R8_UNORM: At, VK_FORMAT_BC1_RGBA_SRGB_BLOCK: Qe, VK_FORMAT_BC1_RGBA_UNORM_BLOCK: Je, VK_FORMAT_BC1_RGB_SRGB_BLOCK: Ge, VK_FORMAT_BC1_RGB_UNORM_BLOCK: qe, VK_FORMAT_BC2_SRGB_BLOCK: $e, VK_FORMAT_BC2_UNORM_BLOCK: Ze, VK_FORMAT_BC3_SRGB_BLOCK: en, VK_FORMAT_BC3_UNORM_BLOCK: tn, VK_FORMAT_BC4_SNORM_BLOCK: sn, VK_FORMAT_BC4_UNORM_BLOCK: nn, VK_FORMAT_BC5_SNORM_BLOCK: rn, VK_FORMAT_BC5_UNORM_BLOCK: an, VK_FORMAT_BC6H_SFLOAT_BLOCK: ln, VK_FORMAT_BC6H_UFLOAT_BLOCK: on, VK_FORMAT_BC7_SRGB_BLOCK: Un, VK_FORMAT_BC7_UNORM_BLOCK: fn, VK_FORMAT_D16_UNORM: Ne, VK_FORMAT_D16_UNORM_S8_UINT: je, VK_FORMAT_D24_UNORM_S8_UINT: Re, VK_FORMAT_D32_SFLOAT: Ke, VK_FORMAT_D32_SFLOAT_S8_UINT: Ye, VK_FORMAT_E5B9G9R9_UFLOAT_PACK32: We, VK_FORMAT_EAC_R11G11_SNORM_BLOCK: dn, VK_FORMAT_EAC_R11G11_UNORM_BLOCK: bn, VK_FORMAT_EAC_R11_SNORM_BLOCK: un, VK_FORMAT_EAC_R11_UNORM_BLOCK: xn, VK_FORMAT_ETC2_R8G8B8A1_SRGB_BLOCK: pn, VK_FORMAT_ETC2_R8G8B8A1_UNORM_BLOCK: _n, VK_FORMAT_ETC2_R8G8B8A8_SRGB_BLOCK: yn, VK_FORMAT_ETC2_R8G8B8A8_UNORM_BLOCK: gn, VK_FORMAT_ETC2_R8G8B8_SRGB_BLOCK: hn, VK_FORMAT_ETC2_R8G8B8_UNORM_BLOCK: cn, VK_FORMAT_G10X6B10X6G10X6R10X6_422_UNORM_4PACK16: Zn, VK_FORMAT_G12X4B12X4G12X4R12X4_422_UNORM_4PACK16: ii, VK_FORMAT_PVRTC1_2BPP_SRGB_BLOCK_IMG: fi, VK_FORMAT_PVRTC1_2BPP_UNORM_BLOCK_IMG: ai, VK_FORMAT_PVRTC1_4BPP_SRGB_BLOCK_IMG: Ui, VK_FORMAT_PVRTC1_4BPP_UNORM_BLOCK_IMG: ri, VK_FORMAT_PVRTC2_2BPP_SRGB_BLOCK_IMG: ci, VK_FORMAT_PVRTC2_2BPP_UNORM_BLOCK_IMG: oi, VK_FORMAT_PVRTC2_4BPP_SRGB_BLOCK_IMG: hi, VK_FORMAT_PVRTC2_4BPP_UNORM_BLOCK_IMG: li, VK_FORMAT_R10X6G10X6B10X6A10X6_UNORM_4PACK16: Qn, VK_FORMAT_R10X6G10X6_UNORM_2PACK16: Jn, VK_FORMAT_R10X6_UNORM_PACK16: Gn, VK_FORMAT_R12X4G12X4B12X4A12X4_UNORM_4PACK16: ni, VK_FORMAT_R12X4G12X4_UNORM_2PACK16: ei, VK_FORMAT_R12X4_UNORM_PACK16: ti, VK_FORMAT_R16G16B16A16_SFLOAT: pe, VK_FORMAT_R16G16B16A16_SINT: _e, VK_FORMAT_R16G16B16A16_SNORM: ce, VK_FORMAT_R16G16B16A16_UINT: he, VK_FORMAT_R16G16B16A16_UNORM: Ue, VK_FORMAT_R16G16B16_SFLOAT: fe, VK_FORMAT_R16G16B16_SINT: le, VK_FORMAT_R16G16B16_SNORM: re, VK_FORMAT_R16G16B16_UINT: oe, VK_FORMAT_R16G16B16_UNORM: ae, VK_FORMAT_R16G16_SFLOAT: se, VK_FORMAT_R16G16_SINT: ie, VK_FORMAT_R16G16_SNORM: ee, VK_FORMAT_R16G16_UINT: ne, VK_FORMAT_R16G16_UNORM: te, VK_FORMAT_R16_SFLOAT: $t, VK_FORMAT_R16_SINT: Zt, VK_FORMAT_R16_SNORM: Jt, VK_FORMAT_R16_UINT: Qt, VK_FORMAT_R16_UNORM: Gt, VK_FORMAT_R32G32B32A32_SFLOAT: Ae, VK_FORMAT_R32G32B32A32_SINT: Le, VK_FORMAT_R32G32B32A32_UINT: Be, VK_FORMAT_R32G32B32_SFLOAT: De, VK_FORMAT_R32G32B32_SINT: we, VK_FORMAT_R32G32B32_UINT: me, VK_FORMAT_R32G32_SFLOAT: de, VK_FORMAT_R32G32_SINT: be, VK_FORMAT_R32G32_UINT: ue, VK_FORMAT_R32_SFLOAT: xe, VK_FORMAT_R32_SINT: ye, VK_FORMAT_R32_UINT: ge, VK_FORMAT_R4G4B4A4_UNORM_PACK16: st, VK_FORMAT_R4G4_UNORM_PACK8: it, VK_FORMAT_R5G5B5A1_UNORM_PACK16: lt, VK_FORMAT_R5G6B5_UNORM_PACK16: rt, VK_FORMAT_R64G64B64A64_SFLOAT: ze, VK_FORMAT_R64G64B64A64_SINT: Ce, VK_FORMAT_R64G64B64A64_UINT: Pe, VK_FORMAT_R64G64B64_SFLOAT: Fe, VK_FORMAT_R64G64B64_SINT: Ee, VK_FORMAT_R64G64B64_UINT: Ve, VK_FORMAT_R64G64_SFLOAT: Te, VK_FORMAT_R64G64_SINT: Oe, VK_FORMAT_R64G64_UINT: Ie, VK_FORMAT_R64_SFLOAT: Se, VK_FORMAT_R64_SINT: ve, VK_FORMAT_R64_UINT: ke, VK_FORMAT_R8G8B8A8_SINT: Et, VK_FORMAT_R8G8B8A8_SNORM: Tt, VK_FORMAT_R8G8B8A8_SRGB: Ft, VK_FORMAT_R8G8B8A8_UINT: Vt, VK_FORMAT_R8G8B8A8_UNORM: Ot, VK_FORMAT_R8G8B8_SINT: Bt, VK_FORMAT_R8G8B8_SNORM: wt, VK_FORMAT_R8G8B8_SRGB: Lt, VK_FORMAT_R8G8B8_UINT: Dt, VK_FORMAT_R8G8B8_UNORM: mt, VK_FORMAT_R8G8_SINT: bt, VK_FORMAT_R8G8_SNORM: xt, VK_FORMAT_R8G8_SRGB: dt, VK_FORMAT_R8G8_UINT: ut, VK_FORMAT_R8G8_UNORM: yt, VK_FORMAT_R8_SINT: pt, VK_FORMAT_R8_SNORM: ht, VK_FORMAT_R8_SRGB: gt, VK_FORMAT_R8_UINT: _t, VK_FORMAT_R8_UNORM: ct, VK_FORMAT_S8_UINT: Xe, VK_FORMAT_UNDEFINED: nt, VK_FORMAT_X8_D24_UNORM_PACK32: He, read: Pi, write: Mi };
    })();
    const { ZSTDDecoder } = (function () {
    let A,I,B;const g={env:{emscripten_notify_memory_growth:function(A){B=new Uint8Array(I.exports.memory.buffer)}}};class Q{init(){return A||(A="undefined"!=typeof fetch?fetch("data:application/wasm;base64,"+C).then(A=>A.arrayBuffer()).then(A=>WebAssembly.instantiate(A,g)).then(this._init):WebAssembly.instantiate(Buffer.from(C,"base64"),g).then(this._init),A)}_init(A){I=A.instance,g.env.emscripten_notify_memory_growth(0)}decode(A,g=0){if(!I)throw new Error("ZSTDDecoder: Await .init() before decoding.");const Q=A.byteLength,C=I.exports.malloc(Q);B.set(A,C),g=g||Number(I.exports.ZSTD_findDecompressedSize(C,Q));const E=I.exports.malloc(g),i=I.exports.ZSTD_decompress(E,g,C,Q),D=B.slice(E,E+i);return I.exports.free(C),I.exports.free(E),D}}const C="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IAMNACAEQQNxBEADQCACRQ0FIAAgAkF/aiICaiIDIAEgAmotAAA6AAAgA0EDcQ0ACwsgAkEDTQ0AA0AgACACQXxqIgJqIAEgAmooAgA2AgAgAkEDSw0ACwsgAkUNAgNAIAAgAkF/aiICaiABIAJqLQAAOgAAIAINAAsMAgsgAkEDTQ0AIAIhBANAIAMgASgCADYCACABQQRqIQEgA0EEaiEDIARBfGoiBEEDSw0ACyACQQNxIQILIAJFDQADQCADIAEtAAA6AAAgA0EBaiEDIAFBAWohASACQX9qIgINAAsLIAAL8wICAn8BfgJAIAJFDQAgACACaiIDQX9qIAE6AAAgACABOgAAIAJBA0kNACADQX5qIAE6AAAgACABOgABIANBfWogAToAACAAIAE6AAIgAkEHSQ0AIANBfGogAToAACAAIAE6AAMgAkEJSQ0AIABBACAAa0EDcSIEaiIDIAFB/wFxQYGChAhsIgE2AgAgAyACIARrQXxxIgRqIgJBfGogATYCACAEQQlJDQAgAyABNgIIIAMgATYCBCACQXhqIAE2AgAgAkF0aiABNgIAIARBGUkNACADIAE2AhggAyABNgIUIAMgATYCECADIAE2AgwgAkFwaiABNgIAIAJBbGogATYCACACQWhqIAE2AgAgAkFkaiABNgIAIAQgA0EEcUEYciIEayICQSBJDQAgAa0iBUIghiAFhCEFIAMgBGohAQNAIAEgBTcDGCABIAU3AxAgASAFNwMIIAEgBTcDACABQSBqIQEgAkFgaiICQR9LDQALCyAACy8BAn8gACgCBCAAKAIAQQJ0aiICLQACIQMgACACLwEAIAEgAi0AAxAIajYCACADCy8BAn8gACgCBCAAKAIAQQJ0aiICLQACIQMgACACLwEAIAEgAi0AAxAFajYCACADCx8AIAAgASACKAIEEAg2AgAgARAEGiAAIAJBCGo2AgQLCAAgAGdBH3MLugUBDX8jAEEQayIKJAACfyAEQQNNBEAgCkEANgIMIApBDGogAyAEEAsaIAAgASACIApBDGpBBBAVIgBBbCAAEAMbIAAgACAESxsMAQsgAEEAIAEoAgBBAXRBAmoQECENQVQgAygAACIGQQ9xIgBBCksNABogAiAAQQVqNgIAIAMgBGoiAkF8aiEMIAJBeWohDiACQXtqIRAgAEEGaiELQQQh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ASIDNgLE4AEgACgCvOABIQQgACABNgK84AEgACABIAJqNgK44AEgACABIAQgA2tqNgLA4AELpgEBAX8gACAAKALs4QEQFjYCyOABIABCADcD+OABIABCADcDuOABIABBwOABakIANwMAIABBqNAAaiIBQYyAgOAANgIAIABBADYCmOIBIABCADcDiOEBIABCAzcDgOEBIABBrNABakHgEikCADcCACAAQbTQAWpB6BIoAgA2AgAgACABNgIMIAAgAEGYIGo2AgggACAAQaAwajYCBCAAIABBEGo2AgALYQEBf0G4fyEDAkAgAUEDSQ0AIAIgABAhIgFBA3YiADYCCCACIAFBAXE2AgQgAiABQQF2QQNxIgM2AgACQCADQX9qIgFBAksNAAJAIAFBAWsOAgEAAgtBbA8LIAAhAwsgAwsMACAAIAEgAkEAEC4LiAQCA38CfiADEBYhBCAAQQBBKBAQIQAgBCACSwRAIAQPCyABRQRAQX8PCwJAAkAgA0EBRg0AIAEoAAAiBkGo6r5pRg0AQXYhAyAGQXBxQdDUtMIBRw0BQQghAyACQQhJDQEgAEEAQSgQECEAIAEoAAQhASAAQQE2AhQgACABrTcDAEEADwsgASACIAMQLyIDIAJLDQAgACADNgIYQXIhAyABIARqIgVBf2otAAAiAkEIcQ0AIAJBIHEiBkUEQEFwIQMgBS0AACIFQacBSw0BIAVBB3GtQgEgBUEDdkEKaq2GIgdCA4h+IAd8IQggBEEBaiEECyACQQZ2IQMgAkECdiEFAkAgAkEDcUF/aiICQQJLBEBBACECDAELAkACQAJAIAJBAWsOAgECAAsgASAEai0AACECIARBAWohBAwCCyABIARqLwAAIQIgBEECaiEEDAELIAEgBGooAAAhAiAEQQRqIQQLIAVBAXEhBQJ+AkACQAJAIANBf2oiA0ECTQRAIANBAWsOAgIDAQtCfyAGRQ0DGiABIARqMQAADAMLIAEgBGovAACtQoACfAwCCyABIARqKAAArQwBCyABIARqKQAACyEHIAAgBTYCICAAIAI2AhwgACAHNwMAQQAhAyAAQQA2AhQgACAHIAggBhsiBzcDCCAAIAdCgIAIIAdCgIAIVBs+AhALIAMLWwEBf0G4fyEDIAIQFiICIAFNBH8gACACakF/ai0AACIAQQNxQQJ0QaAeaigC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C0Egak8NAQsgByAHKQNoNwMQIAcgBykDYDcDCCAEIA0gB0EIaiAHQdwAaiAPIA4gESAQEB4hCwwBCyACIARqIQggBCAKEAcgAkERTwRAIARBEGohAgNAIAIgCkEQaiIKEAcgAkEQaiICIAhJDQALCyAIIAlrIQIgByATNgJcIAkgCCAOa0sEQCAJIAggEWtLBEBBbCELDAILIBAgAiAOayICaiIKIANqIBBNBEAgCCAKIAMQDxoMAgsgCCAKQQAgAmsQDyEIIAcgAiADaiIDNgJkIAggAmshCCAOIQILIAlBEE8EQCADIAhqIQMDQCAIIAIQByACQRBqIQIgCEEQaiIIIANJDQALDAELAkAgCUEHTQRAIAggAi0AADoAACAIIAItAAE6AAEgCCACLQACOgACIAggAi0AAzoAAyAIQQRqIAIgCUECdCIDQcAeaigCAGoiAhAXIAIgA0HgHmooAgBrIQIgBygCZCEDDAELIAggAhAMCyADQQlJDQAgAyAIaiEDIAhBCGoiCCACQQhqIgJrQQ9MBEADQCAIIAIQDCACQQhqIQIgCEEIaiIIIANJDQAMAgALAAsDQCAIIAIQByACQRBqIQIgCEEQaiIIIANJDQALCyAHQRhqEAQaIAsgDCALEAMiAhshDCAEIAQgC2ogAhshBCAFQX9qIgUNAAsgDBADDQFBbCEMIAdBGGoQBEECSQ0BQQAhCANAIAhBA0cEQCAAIAhBAnQiAmpBrNABaiACIAdqKAJENgIAIAhBAWohCAwBCwsgBygCXCEIC0G6fyEMIA8gCGsiACANIARrSw0AIAQEfyAEIAggABALIABqBUEACyABayEMCyAHQfAAaiQAIAwLkRcCFn8FfiMAQdABayIHJAAgByAAKALw4QEiCDYCvAEgASACaiESIAggACgCgOIBaiETAkACQCAFRQRAIAEhAwwBCyAAKALE4AEhESAAKALA4AEhFSAAKAK84AEhDyAAQQE2AozhAUEAIQgDQCAIQQNHBEAgByAIQQJ0IgJqIAAgAmpBrNABaigCADYCVCAIQQFqIQgMAQsLIAcgETYCZCAHIA82AmAgByABIA9rNgJoQWwhECAHQShqIAMgBBAGEAMNASAFQQQgBUEESBshFyAHQTxqIAdBKGogACgCABATIAdBxABqIAdBKGogACgCCBATIAdBzABqIAdBKGogACgCBBATQQAhBCAHQeAAaiEMIAdB5ABqIQoDQCAHQShqEARBAksgBCAXTnJFBEAgBygCQCAHKAI8QQN0aikCACIdQhCIp0H/AXEhCyAHKAJQIAcoAkxBA3RqKQIAIh5CEIinQf8BcSEJIAcoAkggBygCREEDdGopAgAiH0IgiKchCCAeQiCIISAgHUIgiKchAgJAIB9CEIinQf8BcSIDQQJPBEACQCAGRSADQRlJckUEQCAIIAdBKGogA0EgIAcoAixrIg0gDSADSxsiDRAFIAMgDWsiA3RqIQggB0EoahAEGiADRQ0BIAdBKGogAxAFIAhqIQgMAQsgB0EoaiADEAUgCGohCCAHQShqEAQaCyAHKQJUISEgByAINgJUIAcgITcDWAwBCwJAIANFBEAgAgRAIAcoAlQhCAwDCyAHKAJYIQgMAQsCQAJAIAdBKGpBARAFIAggAkVqaiIDQQNGBEAgBygCVEF/aiIDIANFaiEIDAELIANBAnQgB2ooAlQiCCAIRWohCCADQQFGDQELIAcgBygCWDYCXAsLIAcgBygCVDYCWCAHIAg2AlQLICCnIQMgCQRAIAdBKGogCRAFIANqIQMLIAkgC2pBFE8EQCAHQShqEAQaCyALBEAgB0EoaiALEAUgAmohAgsgB0EoahAEGiAHIAcoAmggAmoiCSADajYCaCAKIAwgCCAJSxsoAgAhDSAHIAdBKGogHUIYiKdB/wFxEAggHadB//8DcWo2AjwgByAHQShqIB5CGIinQf8BcRAIIB6nQf//A3FqNgJMIAdBKGoQBBogB0EoaiAfQhiIp0H/AXEQCCEOIAdB8ABqIARBBHRqIgsgCSANaiAIazYCDCALIAg2AgggCyADNgIEIAsgAjYCACAHIA4gH6dB//8DcWo2AkQgBEEBaiEEDAELCyAEIBdIDQEgEkFgaiEYIAdB4ABqIRogB0HkAGohGyABIQMDQCAHQShqEARBAksgBCAFTnJFBEAgBygCQCAHKAI8QQN0aikCACIdQhCIp0H/AXEhCyAHKAJQIAcoAkxBA3RqKQIAIh5CEIinQf8BcSEIIAcoAkggBygCREEDdGopAgAiH0IgiKchCSAeQiCIISAgHUIgiKchDAJAIB9CEIinQf8BcSICQQJPBEACQCAGRSACQRlJckUEQCAJIAdBKGogAkEgIAcoAixrIgogCiACSxsiChAFIAIgCmsiAnRqIQkgB0EoahAEGiACRQ0BIAdBKGogAhAFIAlqIQkMAQsgB0EoaiACEAUgCWohCSAHQShqEAQaCyAHKQJUISEgByAJNgJUIAcgITcDWAwBCwJAIAJFBEAgDARAIAcoAlQhCQwDCyAHKAJYIQkMAQsCQAJAIAdBKGpBARAFIAkgDEVqaiICQQNGBEAgBygCVEF/aiICIAJFaiEJDAELIAJBAnQgB2ooAlQiCSAJRWohCSACQQFGDQELIAcgBygCWDYCXAsLIAcgBygCVDYCWCAHIAk2AlQLICCnIRQgCARAIAdBKGogCBAFIBRqIRQLIAggC2pBFE8EQCAHQShqEAQaCyALBEAgB0EoaiALEAUgDGohDAsgB0EoahAEGiAHIAcoAmggDGoiGSAUajYCaCAbIBogCSAZSxsoAgAhHCAHIAdBKGogHUIYiKdB/wFxEAggHadB//8DcWo2AjwgByAHQShqIB5CGIinQf8BcRAIIB6nQf//A3FqNgJMIAdBKGoQBBogByAHQShqIB9CGIinQf8BcRAIIB+nQf//A3FqNgJEIAcgB0HwAGogBEEDcUEEdGoiDSkDCCIdNwPIASAHIA0pAwAiHjcDwAECQAJAAkAgBygCvAEiDiAepyICaiIWIBNLDQAgAyAHKALEASIKIAJqIgtqIBhLDQAgEiADayALQSBqTw0BCyAHIAcpA8gBNwMQIAcgBykDwAE3AwggAyASIAdBCGogB0G8AWogEyAPIBUgERAeIQsMAQsgAiADaiEIIAMgDhAHIAJBEU8EQCADQRBqIQIDQCACIA5BEGoiDhAHIAJBEGoiAiAISQ0ACwsgCCAdpyIOayECIAcgFjYCvAEgDiAIIA9rSwRAIA4gCCAVa0sEQEFsIQsMAgsgESACIA9rIgJqIhYgCmogEU0EQCAIIBYgChAPGgwCCyAIIBZBACACaxAPIQggByACIApqIgo2AsQBIAggAmshCCAPIQILIA5BEE8EQCAIIApqIQoDQCAIIAIQByACQRBqIQIgCEEQaiIIIApJDQALDAELAkAgDkEHTQRAIAggAi0AADoAACAIIAItAAE6AAEgCCACLQACOgACIAggAi0AAzoAAyAIQQRqIAIgDkECdCIKQcAeaigCAGoiAhAXIAIgCkHgHmooAgBrIQIgBygCxAEhCgwBCyAIIAIQDAsgCkEJSQ0AIAggCmohCiAIQQhqIgggAkEIaiICa0EPTARAA0AgCCACEAwgAkEIaiECIAhBCGoiCCAKSQ0ADAIACwALA0AgCCACEAcgAkEQaiECIAhBEGoiCCAKSQ0ACwsgCxADBEAgCyEQDAQFIA0gDDYCACANIBkgHGogCWs2AgwgDSAJNgIIIA0gFDYCBCAEQQFqIQQgAyALaiEDDAILAAsLIAQgBUgNASAEIBdrIQtBACEEA0AgCyAFSARAIAcgB0HwAGogC0EDcUEEdGoiAikDCCIdNwPIASAHIAIpAwAiHjcDwAECQAJAAkAgBygCvAEiDCAepyICaiIKIBNLDQAgAyAHKALEASIJIAJqIhBqIBhLDQAgEiADayAQQSBqTw0BCyAHIAcpA8gBNwMgIAcgBykDwAE3AxggAyASIAdBGGogB0G8AWogEyAPIBUgERAeIRAMAQsgAiADaiEIIAMgDBAHIAJBEU8EQCADQRBqIQIDQCACIAxBEGoiDBAHIAJBEGoiAiAISQ0ACwsgCCAdpyIGayECIAcgCjYCvAEgBiAIIA9rSwRAIAYgCCAVa0sEQEFsIRAMAgsgESACIA9rIgJqIgwgCWogEU0EQCAIIAwgCRAPGgwCCyAIIAxBACACaxAPIQggByACIAlqIgk2AsQBIAggAmshCCAPIQILIAZBEE8EQCAIIAlqIQYDQCAIIAIQByACQRBqIQIgCEEQaiIIIAZJDQALDAELAkAgBkEHTQRAIAggAi0AADoAACAIIAItAAE6AAEgCCACLQACOgACIAggAi0AAzoAAyAIQQRqIAIgBkECdCIGQcAeaigCAGoiAhAXIAIgBkHgHmooAgBrIQIgBygCxAEhCQwBCyAIIAIQDAsgCUEJSQ0AIAggCWohBiAIQQhqIgggAkEIaiICa0EPTARAA0AgCCACEAwgAkEIaiECIAhBCGoiCCAGSQ0ADAIACwALA0AgCCACEAcgAkEQaiECIAhBEGoiCCAGSQ0ACwsgEBADDQMgC0EBaiELIAMgEGohAwwBCwsDQCAEQQNHBEAgACAEQQJ0IgJqQazQAWogAiAHaigCVDYCACAEQQFqIQQMAQsLIAcoArwBIQgLQbp/IRAgEyAIayIAIBIgA2tLDQAgAwR/IAMgCCAAEAsgAGoFQQALIAFrIRALIAdB0AFqJAAgEAslACAAQgA3AgAgAEEAOwEIIABBADoACyAAIAE2AgwgACACOgAKC7QFAQN/IwBBMGsiBCQAIABB/wFqIgVBfWohBgJAIAMvAQIEQCAEQRhqIAEgAhAGIgIQAw0BIARBEGogBEEYaiADEBwgBEEIaiAEQRhqIAMQHCAAIQMDQAJAIARBGGoQBCADIAZPckUEQCADIARBEGogBEEYahASOgAAIAMgBEEIaiAEQRhqEBI6AAEgBEEYahAERQ0BIANBAmohAwsgBUF+aiEFAn8DQEG6fyECIAMiASAFSw0FIAEgBEEQaiAEQRhqEBI6AAAgAUEBaiEDIARBGGoQBEEDRgRAQQIhAiAEQQhqDAILIAMgBUsNBSABIARBCGogBEEYahASOgABIAFBAmohA0EDIQIgBEEYahAEQQNHDQALIARBEGoLIQUgAyAFIARBGGoQEjoAACABIAJqIABrIQIMAwsgAyAEQRBqIARBGGoQEjoAAiADIARBCGogBEEYahASOgADIANBBGohAwwAAAsACyAEQRhqIAEgAhAGIgIQAw0AIARBEGogBEEYaiADEBwgBEEIaiAEQRhqIAMQHCAAIQMDQAJAIARBGGoQBCADIAZPckUEQCADIARBEGogBEEYahAROgAAIAMgBEEIaiAEQRhqEBE6AAEgBEEYahAERQ0BIANBAmohAwsgBUF+aiEFAn8DQEG6fyECIAMiASAFSw0EIAEgBEEQaiAEQRhqEBE6AAAgAUEBaiEDIARBGGoQBEEDRgRAQQIhAiAEQQhqDAILIAMgBUsNBCABIARBCGogBEEYahAROgABIAFBAmohA0EDIQIgBEEYahAEQQNHDQALIARBEGoLIQUgAyAFIARBGGoQEToAACABIAJqIABrIQIMAgsgAyAEQRBqIARBGGoQEToAAiADIARBCGogBEEYahAROgADIANBBGohAwwAAAsACyAEQTBqJAAgAgtpAQF/An8CQAJAIAJBB00NACABKAAAQbfIwuF+Rw0AIAAgASgABDYCmOIBQWIgAEEQaiABIAIQPiIDEAMNAhogAEKBgICAEDcDiOEBIAAgASADaiACIANrECoMAQsgACABIAIQKgtBAAsLrQMBBn8jAEGAAWsiAyQAQWIhCAJAIAJBCUkNACAAQZjQAGogAUEIaiIEIAJBeGogAEGY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wOABCwutAgIEfwF+IwBBQGoiBCQAAkACQCACQQhJDQAgASgAAEFwcUHQ1LTCAUcNACABIAIQIiEBIABCADcDCCAAQQA2AgQgACABNgIADAELIARBGGogASACEC0iAxADBEAgACADEBoMAQsgAwRAIABBuH8QGgwBCyACIAQoAjAiA2shAiABIANqIQMDQAJAIAAgAyACIARBCGoQLCIFEAMEfyAFBSACIAVBA2oiBU8NAUG4fwsQGgwCCyAGQQFqIQYgAiAFayECIAMgBWohAyAEKAIMRQ0ACyAEKAI4BEAgAkEDTQRAIABBuH8QGgwCCyADQQRqIQMLIAQoAighAiAEKQMYIQcgAEEANgIEIAAgAyABazYCACAAIAIgBmytIAcgB0J/URs3AwgLIARBQGskAAslAQF/IwBBEGsiAiQAIAIgACABEFEgAigCACEAIAJBEGokACAAC30BBH8jAEGQBGsiBCQAIARB/wE2AggCQCAEQRBqIARBCGogBEEMaiABIAIQFSIGEAMEQCAGIQUMAQtBVCEFIAQoAgwiB0EGSw0AIAMgBEEQaiAEKAIIIAcQQSIFEAMNACAAIAEgBmogAiAGayADEDwhBQsgBEGQBGokACAFC4cBAgJ/An5BABAWIQMCQANAIAEgA08EQAJAIAAoAABBcHFB0NS0wgFGBEAgACABECIiAhADRQ0BQn4PCyAAIAEQVSIEQn1WDQMgBCAFfCIFIARUIQJCfiEEIAINAyAAIAEQUiICEAMNAwsgASACayEBIAAgAmohAAwBCwtCfiAFIAEbIQQLIAQLPwIBfwF+IwBBMGsiAiQAAn5CfiACQQhqIAAgARAtDQAaQgAgAigCHEEBRg0AGiACKQMICyEDIAJBMGokACADC40BAQJ/IwBBMGsiASQAAkAgAEUNACAAKAKI4gENACABIABB/OEBaigCADYCKCABIAApAvThATcDICAAEDAgACgCqOIBIQIgASABKAIoNgIYIAEgASkDIDcDECACIAFBEGoQGyAAQQA2AqjiASABIAEoAig2AgggASABKQMgNwMAIAAgARAbCyABQTBqJAALKgECfyMAQRBrIgAkACAAQQA2AgggAEIANwMAIAAQWCEBIABBEGokACABC4cBAQN/IwBBEGsiAiQAAkAgACgCAEUgACgCBEVzDQAgAiAAKAIINgIIIAIgACkCADcDAAJ/IAIoAgAiAQRAIAIoAghBqOMJIAERBQAMAQtBqOMJECgLIgFFDQAgASAAKQIANwL04QEgAUH84QFqIAAoAgg2AgAgARBZIAEhAwsgAkEQaiQAIAMLywEBAn8jAEEgayIBJAAgAEGBgIDAADYCtOIBIABBADYCiOIBIABBADYC7OEBIABCADcDkOIBIABBADYCpOMJIABBADYC3OIBIABCADcCzOIBIABBADYCvOIBIABBADYCxOABIABCADcCnOIBIABBpOIBakIANwIAIABBrOIBakEANgIAIAFCADcCECABQgA3AhggASABKQMYNwMIIAEgASkDEDcDACABKAIIQQh2QQFxIQIgAEEANgLg4gEgACACNgKM4gEgAUEgaiQAC3YBA38jAEEwayIBJAAgAARAIAEgAEHE0AFqIgIoAgA2AiggASAAKQK80AE3AyAgACgCACEDIAEgAigCADYCGCABIAApArzQATcDECADIAFBEGoQGyABIAEoAig2AgggASABKQMgNwMAIAAgARAbCyABQTBqJAALzAEBAX8gACABKAK00AE2ApjiASAAIAEoAgQiAjYCwOABIAAgAjYCvOABIAAgAiABKAIIaiICNgK44AEgACACNgLE4AEgASgCuNABBEAgAEKBgICAEDcDiOEBIAAgAUGk0ABqNgIMIAAgAUGUIGo2AgggACABQZwwajYCBCAAIAFBDGo2AgAgAEGs0AFqIAFBqNABaigCADYCACAAQbDQAWogAUGs0AFqKAIANgIAIABBtNABaiABQbDQAWooAgA2AgAPCyAAQgA3A4jhAQs7ACACRQRAQbp/DwsgBEUEQEFsDwsgAiAEEGAEQCAAIAEgAiADIAQgBRBhDwsgACABIAIgAyAEIAUQZQtGAQF/IwBBEGsiBSQAIAVBCGogBBAOAn8gBS0ACQRAIAAgASACIAMgBBAyDAELIAAgASACIAMgBBA0CyEAIAVBEGokACAACzQAIAAgAyAEIAUQNiIFEAMEQCAFDwsgBSAESQR/IAEgAiADIAVqIAQgBWsgABA1BUG4fwsLRgEBfyMAQRBrIgUkACAFQQhqIAQQDgJ/IAUtAAkEQCAAIAEgAiADIAQQYgwBCyAAIAEgAiADIAQQNQshACAFQRBqJAAgAAtZAQF/QQ8hAiABIABJBEAgAUEE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";return { ZSTDDecoder: Q };
    })();
    /**
     * Loader for KTX 2.0 GPU Texture containers.
     *
     * KTX 2.0 is a container format for various GPU texture formats. The loader
     * supports Basis Universal GPU textures, which can be quickly transcoded to
     * a wide variety of GPU texture compression formats, as well as some
     * uncompressed DataTexture and Data3DTexture formats.
     *
     * References:
     * - KTX: http://github.khronos.org/KTX-Specification/
     * - DFD: https://www.khronos.org/registry/DataFormat/specs/1.3/dataformat.1.3.html#basicdescriptor
     */
    
    
    
    
    
    
    const _taskCache = new WeakMap();
    
    let _activeLoaders = 0;
    
    let _zstd;
    
    class KTX2Loader extends Loader {
    
    	constructor( manager ) {
    
    		super( manager );
    
    		this.transcoderPath = '';
    		this.transcoderBinary = null;
    		this.transcoderPending = null;
    
    		this.workerPool = new WorkerPool();
    		this.workerSourceURL = '';
    		this.workerConfig = null;
    
    		if ( typeof MSC_TRANSCODER !== 'undefined' ) {
    
    			console.warn(
    
    				'THREE.KTX2Loader: Please update to latest "basis_transcoder".'
    				+ ' "msc_basis_transcoder" is no longer supported in three.js r125+.'
    
    			);
    
    		}
    
    	}
    
    	setTranscoderPath( path ) {
    
    		this.transcoderPath = path;
    
    		return this;
    
    	}
    
    	setWorkerLimit( num ) {
    
    		this.workerPool.setWorkerLimit( num );
    
    		return this;
    
    	}
    
    	detectSupport( renderer ) {
    
    		this.workerConfig = {
    			astcSupported: renderer.extensions.has( 'WEBGL_compressed_texture_astc' ),
    			etc1Supported: renderer.extensions.has( 'WEBGL_compressed_texture_etc1' ),
    			etc2Supported: renderer.extensions.has( 'WEBGL_compressed_texture_etc' ),
    			dxtSupported: renderer.extensions.has( 'WEBGL_compressed_texture_s3tc' ),
    			bptcSupported: renderer.extensions.has( 'EXT_texture_compression_bptc' ),
    			pvrtcSupported: renderer.extensions.has( 'WEBGL_compressed_texture_pvrtc' )
    				|| renderer.extensions.has( 'WEBKIT_WEBGL_compressed_texture_pvrtc' )
    		};
    
    
    		if ( renderer.capabilities.isWebGL2 ) {
    
    			// https://github.com/mrdoob/three.js/pull/22928
    			this.workerConfig.etc1Supported = false;
    
    		}
    
    		return this;
    
    	}
    
    	init() {
    
    		if ( ! this.transcoderPending ) {
    
    			// Load transcoder wrapper.
    			const jsLoader = new FileLoader( this.manager );
    			jsLoader.setPath( this.transcoderPath );
    			jsLoader.setWithCredentials( this.withCredentials );
    			const jsContent = jsLoader.loadAsync( 'basis_transcoder.js' );
    
    			// Load transcoder WASM binary.
    			const binaryLoader = new FileLoader( this.manager );
    			binaryLoader.setPath( this.transcoderPath );
    			binaryLoader.setResponseType( 'arraybuffer' );
    			binaryLoader.setWithCredentials( this.withCredentials );
    			const binaryContent = binaryLoader.loadAsync( 'basis_transcoder.wasm' );
    
    			this.transcoderPending = Promise.all( [ jsContent, binaryContent ] )
    				.then( ( [ jsContent, binaryContent ] ) => {
    
    					const fn = KTX2Loader.BasisWorker.toString();
    
    					const body = [
    						'/* constants */',
    						'let _EngineFormat = ' + JSON.stringify( KTX2Loader.EngineFormat ),
    						'let _TranscoderFormat = ' + JSON.stringify( KTX2Loader.TranscoderFormat ),
    						'let _BasisFormat = ' + JSON.stringify( KTX2Loader.BasisFormat ),
    						'/* basis_transcoder.js */',
    						jsContent,
    						'/* worker */',
    						fn.substring( fn.indexOf( '{' ) + 1, fn.lastIndexOf( '}' ) )
    					].join( '\n' );
    
    					this.workerSourceURL = URL.createObjectURL( new Blob( [ body ] ) );
    					this.transcoderBinary = binaryContent;
    
    					this.workerPool.setWorkerCreator( () => {
    
    						const worker = new Worker( this.workerSourceURL );
    						const transcoderBinary = this.transcoderBinary.slice( 0 );
    
    						worker.postMessage( { type: 'init', config: this.workerConfig, transcoderBinary }, [ transcoderBinary ] );
    
    						return worker;
    
    					} );
    
    				} );
    
    			if ( _activeLoaders > 0 ) {
    
    				// Each instance loads a transcoder and allocates workers, increasing network and memory cost.
    
    				console.warn(
    
    					'THREE.KTX2Loader: Multiple active KTX2 loaders may cause performance issues.'
    					+ ' Use a single KTX2Loader instance, or call .dispose() on old instances.'
    
    				);
    
    			}
    
    			_activeLoaders ++;
    
    		}
    
    		return this.transcoderPending;
    
    	}
    
    	load( url, onLoad, onProgress, onError ) {
    
    		if ( this.workerConfig === null ) {
    
    			throw new Error( 'THREE.KTX2Loader: Missing initialization with `.detectSupport( renderer )`.' );
    
    		}
    
    		const loader = new FileLoader( this.manager );
    
    		loader.setResponseType( 'arraybuffer' );
    		loader.setWithCredentials( this.withCredentials );
    
    		loader.load( url, ( buffer ) => {
    
    			// Check for an existing task using this buffer. A transferred buffer cannot be transferred
    			// again from this thread.
    			if ( _taskCache.has( buffer ) ) {
    
    				const cachedTask = _taskCache.get( buffer );
    
    				return cachedTask.promise.then( onLoad ).catch( onError );
    
    			}
    
    			this._createTexture( buffer )
    				.then( ( texture ) => onLoad ? onLoad( texture ) : null )
    				.catch( onError );
    
    		}, onProgress, onError );
    
    	}
    
    	_createTextureFrom( transcodeResult, container ) {
    
    		const { mipmaps, width, height, format, type, error, dfdTransferFn, dfdFlags } = transcodeResult;
    
    		if ( type === 'error' ) return Promise.reject( error );
    
    		const texture = container.layerCount > 1
    			? new CompressedArrayTexture( mipmaps, width, height, container.layerCount, format, UnsignedByteType )
    			: new CompressedTexture( mipmaps, width, height, format, UnsignedByteType );
    
    
    		texture.minFilter = mipmaps.length === 1 ? LinearFilter : LinearMipmapLinearFilter;
    		texture.magFilter = LinearFilter;
    		texture.generateMipmaps = false;
    
    		texture.needsUpdate = true;
    		texture.encoding = dfdTransferFn === KHR_DF_TRANSFER_SRGB ? sRGBEncoding : LinearEncoding;
    		texture.premultiplyAlpha = !! ( dfdFlags & KHR_DF_FLAG_ALPHA_PREMULTIPLIED );
    
    		return texture;
    
    	}
    
    	/**
    	 * @param {ArrayBuffer} buffer
    	 * @param {object?} config
    	 * @return {Promise<CompressedTexture|CompressedArrayTexture|DataTexture|Data3DTexture>}
    	 */
    	async _createTexture( buffer, config = {} ) {
    
    		const container = read( new Uint8Array( buffer ) );
    
    		if ( container.vkFormat !== VK_FORMAT_UNDEFINED ) {
    
    			return createDataTexture( container );
    
    		}
    
    		//
    		const taskConfig = config;
    		const texturePending = this.init().then( () => {
    
    			return this.workerPool.postMessage( { type: 'transcode', buffer, taskConfig: taskConfig }, [ buffer ] );
    
    		} ).then( ( e ) => this._createTextureFrom( e.data, container ) );
    
    		// Cache the task result.
    		_taskCache.set( buffer, { promise: texturePending } );
    
    		return texturePending;
    
    	}
    
    	dispose() {
    
    		this.workerPool.dispose();
    		if ( this.workerSourceURL ) URL.revokeObjectURL( this.workerSourceURL );
    
    		_activeLoaders --;
    
    		return this;
    
    	}
    
    }
    
    
    /* CONSTANTS */
    
    KTX2Loader.BasisFormat = {
    	ETC1S: 0,
    	UASTC_4x4: 1,
    };
    
    KTX2Loader.TranscoderFormat = {
    	ETC1: 0,
    	ETC2: 1,
    	BC1: 2,
    	BC3: 3,
    	BC4: 4,
    	BC5: 5,
    	BC7_M6_OPAQUE_ONLY: 6,
    	BC7_M5: 7,
    	PVRTC1_4_RGB: 8,
    	PVRTC1_4_RGBA: 9,
    	ASTC_4x4: 10,
    	ATC_RGB: 11,
    	ATC_RGBA_INTERPOLATED_ALPHA: 12,
    	RGBA32: 13,
    	RGB565: 14,
    	BGR565: 15,
    	RGBA4444: 16,
    };
    
    KTX2Loader.EngineFormat = {
    	RGBAFormat: RGBAFormat,
    	RGBA_ASTC_4x4_Format: RGBA_ASTC_4x4_Format,
    	RGBA_BPTC_Format: RGBA_BPTC_Format,
    	RGBA_ETC2_EAC_Format: RGBA_ETC2_EAC_Format,
    	RGBA_PVRTC_4BPPV1_Format: RGBA_PVRTC_4BPPV1_Format,
    	RGBA_S3TC_DXT5_Format: RGBA_S3TC_DXT5_Format,
    	RGB_ETC1_Format: RGB_ETC1_Format,
    	RGB_ETC2_Format: RGB_ETC2_Format,
    	RGB_PVRTC_4BPPV1_Format: RGB_PVRTC_4BPPV1_Format,
    	RGB_S3TC_DXT1_Format: RGB_S3TC_DXT1_Format,
    };
    
    
    /* WEB WORKER */
    
    KTX2Loader.BasisWorker = function () {
    
    	let config;
    	let transcoderPending;
    	let BasisModule;
    
    	const EngineFormat = _EngineFormat; // eslint-disable-line no-undef
    	const TranscoderFormat = _TranscoderFormat; // eslint-disable-line no-undef
    	const BasisFormat = _BasisFormat; // eslint-disable-line no-undef
    
    	self.addEventListener( 'message', function ( e ) {
    
    		const message = e.data;
    
    		switch ( message.type ) {
    
    			case 'init':
    				config = message.config;
    				init( message.transcoderBinary );
    				break;
    
    			case 'transcode':
    				transcoderPending.then( () => {
    
    					try {
    
    						const { width, height, hasAlpha, mipmaps, format, dfdTransferFn, dfdFlags } = transcode( message.buffer );
    
    						const buffers = [];
    
    						for ( let i = 0; i < mipmaps.length; ++ i ) {
    
    							buffers.push( mipmaps[ i ].data.buffer );
    
    						}
    
    						self.postMessage( { type: 'transcode', id: message.id, width, height, hasAlpha, mipmaps, format, dfdTransferFn, dfdFlags }, buffers );
    
    					} catch ( error ) {
    
    						console.error( error );
    
    						self.postMessage( { type: 'error', id: message.id, error: error.message } );
    
    					}
    
    				} );
    				break;
    
    		}
    
    	} );
    
    	function init( wasmBinary ) {
    
    		transcoderPending = new Promise( ( resolve ) => {
    
    			BasisModule = { wasmBinary, onRuntimeInitialized: resolve };
    			BASIS( BasisModule ); // eslint-disable-line no-undef
    
    		} ).then( () => {
    
    			BasisModule.initializeBasis();
    
    			if ( BasisModule.KTX2File === undefined ) {
    
    				console.warn( 'THREE.KTX2Loader: Please update Basis Universal transcoder.' );
    
    			}
    
    		} );
    
    	}
    
    	function transcode( buffer ) {
    
    		const ktx2File = new BasisModule.KTX2File( new Uint8Array( buffer ) );
    
    		function cleanup() {
    
    			ktx2File.close();
    			ktx2File.delete();
    
    		}
    
    		if ( ! ktx2File.isValid() ) {
    
    			cleanup();
    			throw new Error( 'THREE.KTX2Loader:	Invalid or unsupported .ktx2 file' );
    
    		}
    
    		const basisFormat = ktx2File.isUASTC() ? BasisFormat.UASTC_4x4 : BasisFormat.ETC1S;
    		const width = ktx2File.getWidth();
    		const height = ktx2File.getHeight();
    		const layers = ktx2File.getLayers() || 1;
    		const levels = ktx2File.getLevels();
    		const hasAlpha = ktx2File.getHasAlpha();
    		const dfdTransferFn = ktx2File.getDFDTransferFunc();
    		const dfdFlags = ktx2File.getDFDFlags();
    
    		const { transcoderFormat, engineFormat } = getTranscoderFormat( basisFormat, width, height, hasAlpha );
    
    		if ( ! width || ! height || ! levels ) {
    
    			cleanup();
    			throw new Error( 'THREE.KTX2Loader:	Invalid texture' );
    
    		}
    
    		if ( ! ktx2File.startTranscoding() ) {
    
    			cleanup();
    			throw new Error( 'THREE.KTX2Loader: .startTranscoding failed' );
    
    		}
    
    		const mipmaps = [];
    
    		for ( let mip = 0; mip < levels; mip ++ ) {
    
    			const layerMips = [];
    
    			let mipWidth, mipHeight;
    
    			for ( let layer = 0; layer < layers; layer ++ ) {
    
    				const levelInfo = ktx2File.getImageLevelInfo( mip, layer, 0 );
    				mipWidth = levelInfo.origWidth;
    				mipHeight = levelInfo.origHeight;
    				const dst = new Uint8Array( ktx2File.getImageTranscodedSizeInBytes( mip, layer, 0, transcoderFormat ) );
    				const status = ktx2File.transcodeImage(
    					dst,
    					mip,
    					layer,
    					0,
    					transcoderFormat,
    					0,
    					- 1,
    					- 1,
    				);
    
    				if ( ! status ) {
    
    					cleanup();
    					throw new Error( 'THREE.KTX2Loader: .transcodeImage failed.' );
    
    				}
    
    				layerMips.push( dst );
    
    			}
    
    			mipmaps.push( { data: concat( layerMips ), width: mipWidth, height: mipHeight } );
    
    		}
    
    		cleanup();
    
    		return { width, height, hasAlpha, mipmaps, format: engineFormat, dfdTransferFn, dfdFlags };
    
    	}
    
    	//
    
    	// Optimal choice of a transcoder target format depends on the Basis format (ETC1S or UASTC),
    	// device capabilities, and texture dimensions. The list below ranks the formats separately
    	// for ETC1S and UASTC.
    	//
    	// In some cases, transcoding UASTC to RGBA32 might be preferred for higher quality (at
    	// significant memory cost) compared to ETC1/2, BC1/3, and PVRTC. The transcoder currently
    	// chooses RGBA32 only as a last resort and does not expose that option to the caller.
    	const FORMAT_OPTIONS = [
    		{
    			if: 'astcSupported',
    			basisFormat: [ BasisFormat.UASTC_4x4 ],
    			transcoderFormat: [ TranscoderFormat.ASTC_4x4, TranscoderFormat.ASTC_4x4 ],
    			engineFormat: [ EngineFormat.RGBA_ASTC_4x4_Format, EngineFormat.RGBA_ASTC_4x4_Format ],
    			priorityETC1S: Infinity,
    			priorityUASTC: 1,
    			needsPowerOfTwo: false,
    		},
    		{
    			if: 'bptcSupported',
    			basisFormat: [ BasisFormat.ETC1S, BasisFormat.UASTC_4x4 ],
    			transcoderFormat: [ TranscoderFormat.BC7_M5, TranscoderFormat.BC7_M5 ],
    			engineFormat: [ EngineFormat.RGBA_BPTC_Format, EngineFormat.RGBA_BPTC_Format ],
    			priorityETC1S: 3,
    			priorityUASTC: 2,
    			needsPowerOfTwo: false,
    		},
    		{
    			if: 'dxtSupported',
    			basisFormat: [ BasisFormat.ETC1S, BasisFormat.UASTC_4x4 ],
    			transcoderFormat: [ TranscoderFormat.BC1, TranscoderFormat.BC3 ],
    			engineFormat: [ EngineFormat.RGB_S3TC_DXT1_Format, EngineFormat.RGBA_S3TC_DXT5_Format ],
    			priorityETC1S: 4,
    			priorityUASTC: 5,
    			needsPowerOfTwo: false,
    		},
    		{
    			if: 'etc2Supported',
    			basisFormat: [ BasisFormat.ETC1S, BasisFormat.UASTC_4x4 ],
    			transcoderFormat: [ TranscoderFormat.ETC1, TranscoderFormat.ETC2 ],
    			engineFormat: [ EngineFormat.RGB_ETC2_Format, EngineFormat.RGBA_ETC2_EAC_Format ],
    			priorityETC1S: 1,
    			priorityUASTC: 3,
    			needsPowerOfTwo: false,
    		},
    		{
    			if: 'etc1Supported',
    			basisFormat: [ BasisFormat.ETC1S, BasisFormat.UASTC_4x4 ],
    			transcoderFormat: [ TranscoderFormat.ETC1 ],
    			engineFormat: [ EngineFormat.RGB_ETC1_Format ],
    			priorityETC1S: 2,
    			priorityUASTC: 4,
    			needsPowerOfTwo: false,
    		},
    		{
    			if: 'pvrtcSupported',
    			basisFormat: [ BasisFormat.ETC1S, BasisFormat.UASTC_4x4 ],
    			transcoderFormat: [ TranscoderFormat.PVRTC1_4_RGB, TranscoderFormat.PVRTC1_4_RGBA ],
    			engineFormat: [ EngineFormat.RGB_PVRTC_4BPPV1_Format, EngineFormat.RGBA_PVRTC_4BPPV1_Format ],
    			priorityETC1S: 5,
    			priorityUASTC: 6,
    			needsPowerOfTwo: true,
    		},
    	];
    
    	const ETC1S_OPTIONS = FORMAT_OPTIONS.sort( function ( a, b ) {
    
    		return a.priorityETC1S - b.priorityETC1S;
    
    	} );
    	const UASTC_OPTIONS = FORMAT_OPTIONS.sort( function ( a, b ) {
    
    		return a.priorityUASTC - b.priorityUASTC;
    
    	} );
    
    	function getTranscoderFormat( basisFormat, width, height, hasAlpha ) {
    
    		let transcoderFormat;
    		let engineFormat;
    
    		const options = basisFormat === BasisFormat.ETC1S ? ETC1S_OPTIONS : UASTC_OPTIONS;
    
    		for ( let i = 0; i < options.length; i ++ ) {
    
    			const opt = options[ i ];
    
    			if ( ! config[ opt.if ] ) continue;
    			if ( ! opt.basisFormat.includes( basisFormat ) ) continue;
    			if ( hasAlpha && opt.transcoderFormat.length < 2 ) continue;
    			if ( opt.needsPowerOfTwo && ! ( isPowerOfTwo( width ) && isPowerOfTwo( height ) ) ) continue;
    
    			transcoderFormat = opt.transcoderFormat[ hasAlpha ? 1 : 0 ];
    			engineFormat = opt.engineFormat[ hasAlpha ? 1 : 0 ];
    
    			return { transcoderFormat, engineFormat };
    
    		}
    
    		console.warn( 'THREE.KTX2Loader: No suitable compressed texture format found. Decoding to RGBA32.' );
    
    		transcoderFormat = TranscoderFormat.RGBA32;
    		engineFormat = EngineFormat.RGBAFormat;
    
    		return { transcoderFormat, engineFormat };
    
    	}
    
    	function isPowerOfTwo( value ) {
    
    		if ( value <= 2 ) return true;
    
    		return ( value & ( value - 1 ) ) === 0 && value !== 0;
    
    	}
    
    	/** Concatenates N byte arrays. */
    	function concat( arrays ) {
    
    		let totalByteLength = 0;
    
    		for ( const array of arrays ) {
    
    			totalByteLength += array.byteLength;
    
    		}
    
    		const result = new Uint8Array( totalByteLength );
    
    		let byteOffset = 0;
    
    		for ( const array of arrays ) {
    
    			result.set( array, byteOffset );
    
    			byteOffset += array.byteLength;
    
    		}
    
    		return result;
    
    	}
    
    };
    
    //
    // DataTexture and Data3DTexture parsing.
    
    const FORMAT_MAP = {
    
    	[ VK_FORMAT_R32G32B32A32_SFLOAT ]: RGBAFormat,
    	[ VK_FORMAT_R16G16B16A16_SFLOAT ]: RGBAFormat,
    	[ VK_FORMAT_R8G8B8A8_UNORM ]: RGBAFormat,
    	[ VK_FORMAT_R8G8B8A8_SRGB ]: RGBAFormat,
    
    	[ VK_FORMAT_R32G32_SFLOAT ]: RGFormat,
    	[ VK_FORMAT_R16G16_SFLOAT ]: RGFormat,
    	[ VK_FORMAT_R8G8_UNORM ]: RGFormat,
    	[ VK_FORMAT_R8G8_SRGB ]: RGFormat,
    
    	[ VK_FORMAT_R32_SFLOAT ]: RedFormat,
    	[ VK_FORMAT_R16_SFLOAT ]: RedFormat,
    	[ VK_FORMAT_R8_SRGB ]: RedFormat,
    	[ VK_FORMAT_R8_UNORM ]: RedFormat,
    
    };
    
    const TYPE_MAP = {
    
    	[ VK_FORMAT_R32G32B32A32_SFLOAT ]: FloatType,
    	[ VK_FORMAT_R16G16B16A16_SFLOAT ]: HalfFloatType,
    	[ VK_FORMAT_R8G8B8A8_UNORM ]: UnsignedByteType,
    	[ VK_FORMAT_R8G8B8A8_SRGB ]: UnsignedByteType,
    
    	[ VK_FORMAT_R32G32_SFLOAT ]: FloatType,
    	[ VK_FORMAT_R16G16_SFLOAT ]: HalfFloatType,
    	[ VK_FORMAT_R8G8_UNORM ]: UnsignedByteType,
    	[ VK_FORMAT_R8G8_SRGB ]: UnsignedByteType,
    
    	[ VK_FORMAT_R32_SFLOAT ]: FloatType,
    	[ VK_FORMAT_R16_SFLOAT ]: HalfFloatType,
    	[ VK_FORMAT_R8_SRGB ]: UnsignedByteType,
    	[ VK_FORMAT_R8_UNORM ]: UnsignedByteType,
    
    };
    
    const ENCODING_MAP = {
    
    	[ VK_FORMAT_R8G8B8A8_SRGB ]: sRGBEncoding,
    	[ VK_FORMAT_R8G8_SRGB ]: sRGBEncoding,
    	[ VK_FORMAT_R8_SRGB ]: sRGBEncoding,
    
    };
    
    async function createDataTexture( container ) {
    
    	const { vkFormat, pixelWidth, pixelHeight, pixelDepth } = container;
    
    	if ( FORMAT_MAP[ vkFormat ] === undefined ) {
    
    		throw new Error( 'THREE.KTX2Loader: Unsupported vkFormat.' );
    
    	}
    
    	const level = container.levels[ 0 ];
    
    	let levelData;
    	let view;
    
    	if ( container.supercompressionScheme === KHR_SUPERCOMPRESSION_NONE ) {
    
    		levelData = level.levelData;
    
    	} else if ( container.supercompressionScheme === KHR_SUPERCOMPRESSION_ZSTD ) {
    
    		if ( ! _zstd ) {
    
    			_zstd = new Promise( async ( resolve ) => {
    
    				const zstd = new ZSTDDecoder();
    				await zstd.init();
    				resolve( zstd );
    
    			} );
    
    		}
    
    		levelData = ( await _zstd ).decode( level.levelData, level.uncompressedByteLength );
    
    	} else {
    
    		throw new Error( 'THREE.KTX2Loader: Unsupported supercompressionScheme.' );
    
    	}
    
    	if ( TYPE_MAP[ vkFormat ] === FloatType ) {
    
    		view = new Float32Array(
    
    			levelData.buffer,
    			levelData.byteOffset,
    			levelData.byteLength / Float32Array.BYTES_PER_ELEMENT
    
    		);
    
    	} else if ( TYPE_MAP[ vkFormat ] === HalfFloatType ) {
    
    		view = new Uint16Array(
    
    			levelData.buffer,
    			levelData.byteOffset,
    			levelData.byteLength / Uint16Array.BYTES_PER_ELEMENT
    
    		);
    
    	} else {
    
    		view = levelData;
    
    	}
    	//
    
    	const texture = pixelDepth === 0
    		? new DataTexture( view, pixelWidth, pixelHeight )
    		: new Data3DTexture( view, pixelWidth, pixelHeight, pixelDepth );
    
    	texture.type = TYPE_MAP[ vkFormat ];
    	texture.format = FORMAT_MAP[ vkFormat ];
    	texture.encoding = ENCODING_MAP[ vkFormat ] || LinearEncoding;
    
    	texture.needsUpdate = true;
    
    	//
    
    	return Promise.resolve( texture );
    
    }
    
    
    
    cache = { T: THREE, K: KTX2Loader }; return KTX2Loader;
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== model/glb/GLBAvatar.js ===== */
/*
 * GLBAvatar: drives a rigged glTF/GLB character through the AvatarModel contract.
 *
 * It assumes NOTHING about names. A RigMap says which morph targets, bones and clips mean what; resolve()
 * checks them against the file and produces a report. What the model lacks is reported, not faked:
 *   - no viseme morphs      -> visemes are converted to ARKit channels (FaceMixer)
 *   - no jawOpen morph      -> a jaw bone is driven by the mouth level
 *   - no eye bones          -> gaze goes through eyeLook* morphs
 *   - no idle clip          -> breathing and posture come from the AnimationController
 *   - no morphs at all      -> the model can still turn its head and breathe
 *
 * Conventions: the model faces +Z, Y is up (glTF). Bone rotations are applied as deltas expressed in the
 * model's rest-pose frame, so they do not depend on how the skeleton's local axes happen to be authored.
 * Scale is normalised to rig.options.fitHeight so camera and lighting treat every model alike.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, T = root.THREE, clamp = WA.clamp, C = WA.Channels;

  function GLBAvatar(opts) {
    WA.AvatarModel.call(this);
    this.o = WA.assign({ rigMap: null, fitHeight: 7.05, timeout: 30000, castShadow: true, envIntensity: 1, useIdleClip: true, dracoPath: null, ktx2: true, ktx2Path: null, renderer: null }, opts || {});
    this.rig = this.o.rigMap || WA.RigMap.create();
    this.gltf = null; this.mixer = null; this.res = null; this.slots = {}; this.vslots = {}; this.bones = {}; this.landmarks = null;
    this.meshes = []; this.state = { head: [0, 0, 0], eye: null, pose: {}, jaw: 0, mouth: 0, idle: 1, speaking: false };
    this.clipActions = {}; this.animated = {}; this.info = null; this.bytes = 0; this.scale = 1; this.nativeVisemes = false;
  }
  GLBAvatar.prototype = Object.create(WA.AvatarModel.prototype);
  GLBAvatar.prototype.constructor = GLBAvatar;

  /* ---------- loading ---------- */
  function readData(d) {
    if (d instanceof ArrayBuffer) return Promise.resolve(d);
    if (d && d.buffer instanceof ArrayBuffer && d.byteLength != null) return Promise.resolve(d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength));
    if (d && typeof d.arrayBuffer === 'function') return d.arrayBuffer();
    return Promise.reject(WA.AvatarError('BAD_GLB_INPUT', 'GLB data must be an ArrayBuffer, typed array, Blob or File'));
  }

  GLBAvatar.prototype._loader = function () {
    if (!T || !T.GLTFLoader) throw WA.AvatarError('NO_GLTF_LOADER', 'THREE.GLTFLoader is not loaded: include the three.js GLTFLoader before loading a GLB');
    var L = new T.GLTFLoader();
    /* KTX2 (Basis) textures: needs the renderer (to pick the GPU format) and the transcoder files at ktx2Path. Without a renderer the loader is not set up. */
    if (this.o.ktx2 !== false && this.o.renderer && L.setKTX2Loader && WA.makeKTX2Loader) {
      try { var K = new (WA.makeKTX2Loader(T))(); K.setTranscoderPath(this.o.ktx2Path || WA.KTX2_PATH); K.detectSupport(this.o.renderer); L.setKTX2Loader(K); this._ktx2 = K; }
      catch (e) { this._ktx2Error = e; }
    }
    if (root.MeshoptDecoder && L.setMeshoptDecoder) L.setMeshoptDecoder(root.MeshoptDecoder);
    if (this.o.dracoPath && T.DRACOLoader) { var D = new T.DRACOLoader(); D.setDecoderPath(this.o.dracoPath); L.setDRACOLoader(D); this._draco = D; }
    return L;
  };

  /* GLTFLoader tolerates a texture that fails to load (it logs and carries on), so a wrong transcoder path would give a head with no skin and no error.
   * Count the KTX2 textures the used materials ask for and the ones that arrived; fewer is a failure. */
  GLBAvatar.prototype._checkKTX2 = function (g) {
    var j = g && g.parser && g.parser.json; if (!j || (j.extensionsUsed || []).indexOf('KHR_texture_basisu') < 0) return;
    var isKtx = function (i) { var t = j.textures && j.textures[i]; return !!(t && t.extensions && t.extensions.KHR_texture_basisu); }, used = {}, need = {}, got = {};
    (j.meshes || []).forEach(function (m) { m.primitives.forEach(function (p) { if (p.material != null) used[p.material] = 1; }); });
    Object.keys(used).forEach(function (mi) { var m = j.materials[mi] || {}, pbr = m.pbrMetallicRoughness || {};
      [pbr.baseColorTexture, pbr.metallicRoughnessTexture, m.normalTexture, m.occlusionTexture, m.emissiveTexture].forEach(function (r) { if (r && isKtx(r.index)) need[r.index] = 1; }); });
    g.scene.traverse(function (o) { [].concat(o.material || []).forEach(function (m) { ['map', 'normalMap', 'metalnessMap', 'roughnessMap', 'aoMap', 'emissiveMap'].forEach(function (k) { if (m[k] && m[k].isTexture) got[m[k].uuid] = 1; }); }); });
    var n = Object.keys(need).length;
    if (n && Object.keys(got).length < n) throw WA.AvatarError('KTX2_FAILED', 'KTX2 textures did not load (' + Object.keys(got).length + ' of ' + n + '): check that the Basis transcoder files are reachable at ' + (this.o.ktx2Path || WA.KTX2_PATH));
  };

  GLBAvatar.prototype.load = function () {
    var self = this, o = this.o, loader;
    try { loader = this._loader(); } catch (e) { return Promise.reject(e); }
    var t0 = root.performance ? performance.now() : 0;
    var parsed = new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(WA.AvatarError('TIMEOUT', 'Loading the GLB took longer than ' + o.timeout + ' ms')); }, o.timeout);
      function ok(g) { clearTimeout(timer); resolve(g); }
      function bad(e) { clearTimeout(timer); var msg = e && e.message ? e.message : String(e), k = /ktx2|basisu|basis_transcoder/i.test(msg); if (/setKTX2Loader/.test(msg)) msg = 'this GLB uses KTX2 textures but KTX2 loading is not set up (it needs the renderer, which createAvatar passes, and ktx2 must not be false)'; reject(WA.AvatarError(k ? 'KTX2_FAILED' : o.url && !o.data ? 'FETCH_FAILED' : 'PARSE_FAILED', 'Could not read the GLB: ' + msg, e)); }
      if (o.data || o.file) readData(o.data || o.file).then(function (buf) { self.bytes = buf.byteLength; try { loader.parse(buf, '', ok, bad); } catch (e) { bad(e); } }, bad);
      else if (o.url) loader.load(o.url, function (g) { ok(g); }, o.onProgress, bad);
      else { clearTimeout(timer); reject(WA.AvatarError('NO_SOURCE', 'GLBAvatar needs a url, data or file')); }
    });
    return parsed.then(function (g) { self._checkKTX2(g); self._build(g); self.loadMs = root.performance ? Math.round(performance.now() - t0) : null; if (self.info) self.info.loadMs = self.loadMs; return self.getInfo(); });
  };

  GLBAvatar.prototype._build = function (gltf) {
    var self = this, scene = gltf.scene || (gltf.scenes && gltf.scenes[0]);
    if (!scene) throw WA.AvatarError('EMPTY_GLB', 'The file has no scene');
    var meshes = [], boneNames = [], boneObjs = {}, morphNames = [], seen = {};
    scene.traverse(function (n) {
      if (n.isBone) { boneNames.push(n.name); boneObjs[n.name] = n; }
      if (n.isMesh || n.isSkinnedMesh) {
        meshes.push(n);
        if (n.morphTargetDictionary) Object.keys(n.morphTargetDictionary).forEach(function (k) { if (!seen[k]) { seen[k] = 1; morphNames.push(k); } });
      }
    });
    if (!meshes.length) throw WA.AvatarError('NO_MESH', 'The file has no meshes');
    this.gltf = gltf; this.scene = scene; this.meshes = meshes; this.json = gltf.parser && gltf.parser.json || {};

    // normalise: feet on the floor, centred, scaled to fitHeight
    scene.updateMatrixWorld(true);
    var box = new T.Box3().setFromObject(scene), h = box.max.y - box.min.y;
    if (!(h > 1e-6) || !isFinite(h)) throw WA.AvatarError('BAD_BOUNDS', 'The model has no measurable size');
    var s = this.o.fitHeight / h; this.scale = s;
    var wrap = new T.Group(); wrap.name = 'GLBAvatar'; wrap.add(scene);
    scene.scale.multiplyScalar(s); scene.position.set(-((box.min.x + box.max.x) / 2) * s, -box.min.y * s, -((box.min.z + box.max.z) / 2) * s);
    wrap.updateMatrixWorld(true); this.object3D = wrap;

    var clipNames = (gltf.animations || []).map(function (a) { return a.name; });
    var res = WA.RigMap.resolve(this.rig, { morphNames: morphNames, boneNames: boneNames, clipNames: clipNames });
    this.res = res; this.nativeVisemes = res.report.visemesNative;

    // morph slots: channel -> [{ inf, i }]
    function slotsFor(map, target) {
      for (var ch in map) {
        var list = [];
        map[ch].forEach(function (name) { meshes.forEach(function (m) { var d = m.morphTargetDictionary; if (d && d[name] !== undefined && m.morphTargetInfluences) list.push({ inf: m.morphTargetInfluences, i: d[name] }); }); });
        if (list.length) target[ch] = list;
      }
    }
    slotsFor(res.morphs, this.slots); slotsFor(res.visemes, this.vslots);

    // bones: rest pose and the rest-frame of each parent, so deltas are axis-independent
    var slotsB = res.bones;
    for (var slot in slotsB) {
      var b = boneObjs[slotsB[slot]]; if (!b) continue;
      var pq = new T.Quaternion(); if (b.parent) b.parent.getWorldQuaternion(pq);
      this.bones[slot] = { obj: b, rest: b.quaternion.clone(), restPos: b.position.clone(), pq: pq, pqi: pq.clone().invert() };
    }

    // clips
    if (gltf.animations && gltf.animations.length && T.AnimationMixer) {
      this.mixer = new T.AnimationMixer(scene);
      ['idle', 'talk'].forEach(function (k) {
        var nm = res.clips[k]; if (!nm) return;
        var clip = gltf.animations.filter(function (a) { return a.name === nm; })[0]; if (!clip) return;
        var act = self.mixer.clipAction(clip); act.play(); act.setEffectiveWeight(k === 'idle' ? 1 : 0); self.clipActions[k] = act;
        clip.tracks.forEach(function (t) { self.animated[t.name.split('.')[0]] = true; });
      });
      if (!this.o.useIdleClip && this.clipActions.idle) this.clipActions.idle.setEffectiveWeight(0);
    }

    // eye mode
    var eo = this.rig.options.eyeMode, hasEyeBones = !!(this.bones.leftEye || this.bones.rightEye), hasEyeMorphs = !!(this.slots.eyeLookOutLeft || this.slots.eyeLookUpLeft);
    this.eyeMode = eo === 'bones' ? 'bones' : eo === 'morphs' ? 'morphs' : (hasEyeBones ? 'bones' : hasEyeMorphs ? 'morphs' : 'none');
    this.jawMode = this.slots.jawOpen ? 'morph' : (this.bones.jaw ? 'bone' : 'none');

    this._landmarks(h * s);
    this._materials();
    this.loaded = true; this._measure(); this._warn();
  };

  GLBAvatar.prototype._materials = function () {
    var self = this, mats = {}, tex = {};
    this.object3D.traverse(function (n) {
      if (!(n.isMesh || n.isSkinnedMesh)) return;
      n.frustumCulled = false;                                   // skinned and morphed bounds are not reliable
      if (self.o.castShadow) { n.castShadow = true; n.receiveShadow = true; }
      (Array.isArray(n.material) ? n.material : [n.material]).forEach(function (m) { if (m) mats[m.uuid] = m; });
    });
    this.materialList = Object.keys(mats).map(function (k) { return mats[k]; });
    this.materialList.forEach(function (m) {
      if ('envMapIntensity' in m) m.envMapIntensity = self.o.envIntensity;
      for (var k in m) { var v = m[k]; if (v && v.isTexture) tex[v.uuid] = v; }
    });
    this.textureList = Object.keys(tex).map(function (k) { return tex[k]; });
  };

  GLBAvatar.prototype._landmarks = function (height) {
    var ov = this.rig.options.landmarks, bones = this.bones, wp = new T.Vector3(), topY = height, B = this.bones;
    function y(b) { return b ? (b.obj.getWorldPosition(wp), wp.y) : null; }
    this.object3D.updateMatrixWorld(true);
    var eyeY = null, ey = [y(B.leftEye), y(B.rightEye)].filter(function (v) { return v != null; });
    if (ey.length) eyeY = ey.reduce(function (a, b) { return a + b; }, 0) / ey.length;
    var headY = y(B.head), hh;
    if (eyeY != null) hh = (topY - eyeY) / 0.47;
    else if (headY != null) hh = (topY - headY) / 0.8;
    else hh = height / (this.rig.options.headsTall || 7.2);
    var d = WA.AvatarModel.defaultLandmarks(height);
    var lm = { height: height, headHeight: hh, headTopY: topY, headCenterY: topY - hh / 2, chinY: topY - hh, eyeY: eyeY != null ? eyeY : topY - hh * 0.47,
      shoulderY: y(B.leftShoulder) != null ? y(B.leftShoulder) : topY - hh * 1.5, chestY: y(B.spine2) != null ? y(B.spine2) : topY - hh * 2.1, hipsY: y(B.hips) != null ? y(B.hips) : d.hipsY };
    if (ov) for (var k in ov) lm[k] = ov[k];
    this.landmarks = lm;
  };

  GLBAvatar.prototype._measure = function () {
    var tri = 0, vtx = 0, skinned = 0, morphMax = 0, texBytes = 0;
    this.object3D.traverse(function (n) {
      if (!n.geometry) return;
      var g = n.geometry; tri += (g.index ? g.index.count : g.attributes.position.count) / 3; vtx += g.attributes.position.count;
      if (n.isSkinnedMesh) skinned++;
      var mt = g.morphAttributes && g.morphAttributes.position; if (mt) morphMax = Math.max(morphMax, mt.length);
    });
    this.textureList.forEach(function (t) { var im = t.image; if (im && im.width) texBytes += im.width * im.height * 4 * (t.generateMipmaps === false ? 1 : 1.33); });
    this.info = { kind: 'glb', name: this.gltf.asset && this.gltf.asset.generator || 'glb', triangles: Math.round(tri), vertices: vtx, skinnedMeshes: skinned, meshes: this.meshes.length,
      materials: this.materialList.length, textures: this.textureList.length, textureMemoryMB: +(texBytes / 1048576).toFixed(1), morphTargetsMax: morphMax,
      bones: Object.keys(this.res.bones).length, animations: (this.gltf.animations || []).length, fileMB: this.bytes ? +(this.bytes / 1048576).toFixed(2) : null,
      scale: +this.scale.toFixed(4), eyeMode: this.eyeMode, jawMode: this.jawMode, grade: this.res.report.grade };
  };
  GLBAvatar.prototype._warn = function () {
    var w = this.res.report.warnings, self = this; w.forEach(function (m) { self.emit('warning', WA.AvatarError('RIG_WARNING', m)); });
  };

  /* ---------- AvatarModel contract ---------- */
  GLBAvatar.prototype.onAttach = function (scene, renderer) {
    if (renderer && this.textureList) { var a = renderer.capabilities.getMaxAnisotropy(); this.textureList.forEach(function (t) { t.anisotropy = Math.min(8, a); }); }
    scene.add(this.object3D);
  };
  GLBAvatar.prototype.setEnvIntensity = function (k) { this.materialList.forEach(function (m) { if ('envMapIntensity' in m) m.envMapIntensity = k; }); };

  GLBAvatar.prototype.setExpression = function (ch) {
    var gains = this.rig.options.gains, mg = this.rig.options.morphGain;
    for (var k in ch) {
      var sl = this.slots[k]; if (!sl) continue;
      var v = clamp(ch[k] * mg * (gains && gains[k] != null ? gains[k] : 1), 0, 1);
      for (var i = 0; i < sl.length; i++) sl[i].inf[sl[i].i] = v;
    }
    this.state.jaw = ch.jawOpen || 0;
    if (this.eyeMode === 'bones' || this.eyeMode === 'none') return;
  };
  GLBAvatar.prototype.setViseme = function (w) {
    var g = this.rig.options.visemeGain;
    for (var v in w) { var sl = this.vslots[v]; if (!sl) continue; var x = clamp(w[v] * g, 0, 1); for (var i = 0; i < sl.length; i++) sl[i].inf[sl[i].i] = x; }
  };
  GLBAvatar.prototype.setMouthLevel = function (v) { this.state.mouth = v; };
  GLBAvatar.prototype.setEyeTarget = function (yaw, pitch, per) { this.state.eye = { yaw: yaw, pitch: pitch, per: per || null }; };
  GLBAvatar.prototype.setHeadRotation = function (yaw, pitch, roll) { this.state.head = [yaw, pitch, roll]; };
  GLBAvatar.prototype.setBodyPose = function (p) { this.state.pose = p || {}; };
  GLBAvatar.prototype.setIdle = function (k) {
    this.state.idle = clamp(k, 0, 1);
    if (this.clipActions.idle && this.o.useIdleClip) this.clipActions.idle.setEffectiveWeight(this.state.idle);
  };
  GLBAvatar.prototype.setSpeaking = function (on) {
    this.state.speaking = !!on; var a = this.clipActions.talk; if (a) a.setEffectiveWeight(on ? 1 : 0);
  };

  /* A delta rotation (yaw, pitch, roll in radians, in the model frame) on top of a bone's base orientation. */
  var _e = null, _q = null;
  function applyDelta(rec, yaw, pitch, roll, useCurrent) {
    if (!rec) return;
    if (!_e) { _e = new T.Euler(); _q = new T.Quaternion(); }
    _e.set(pitch, yaw, roll, 'YXZ'); _q.setFromEuler(_e);
    var base = useCurrent ? rec.obj.quaternion : rec.rest;
    // parentRest^-1 * delta * parentRest, then on top of the base: expressed in the rest frame of the parent
    _q.premultiply(rec.pqi).multiply(rec.pq);
    rec.obj.quaternion.copy(base).premultiply(_q);
  }

  GLBAvatar.prototype.update = function (dt) {
    if (!this.loaded) return;
    if (this.mixer) this.mixer.update(dt);
    var B = this.bones, S = this.state, p = S.pose, an = this.animated, self = this;
    function cur(slot) { return !!(B[slot] && an[B[slot].obj.name]); }

    // head and neck share the rotation 70/30
    var h = S.head, hasNeck = !!B.neck;
    applyDelta(B.head, h[0] * (hasNeck ? 0.7 : 1), h[1] * (hasNeck ? 0.7 : 1), -h[2] * (hasNeck ? 0.7 : 1), cur('head'));
    if (hasNeck) applyDelta(B.neck, h[0] * 0.3, h[1] * 0.3, -h[2] * 0.3, cur('neck'));

    // body: breath into the chest, lean/roll/yaw into the spine, shoulders lift
    var br = p.breath || 0, chest = p.chest || 0;
    var spine = B.spine2 || B.spine1 || B.spine;
    if (spine) applyDelta(spine, (p.bodyYaw || 0), -(chest * 0.012) + (p.lean || 0) * 0.05, -(p.bodyRoll || 0), cur(B.spine2 ? 'spine2' : B.spine1 ? 'spine1' : 'spine'));
    if (B.leftShoulder) applyDelta(B.leftShoulder, 0, 0, -(p.shoulderL || 0) * 0.025 - br * 0.01, cur('leftShoulder'));
    if (B.rightShoulder) applyDelta(B.rightShoulder, 0, 0, (p.shoulderR || 0) * 0.025 + br * 0.01, cur('rightShoulder'));
    if (B.hips) { var hb = B.hips; if (!an[hb.obj.name]) hb.obj.position.copy(hb.restPos); }

    // jaw bone fallback
    if (this.jawMode === 'bone') applyDelta(B.jaw, 0, Math.max(S.jaw, S.mouth) * 0.22, 0, cur('jaw'));

    // eyes
    var e = S.eye;
    if (e) {
      var per = e.per || { yawL: e.yaw, yawR: e.yaw, pitchL: e.pitch, pitchR: e.pitch };
      if (this.eyeMode === 'bones') {
        // eyes look up when pitch > 0, which is a negative rotation about X
        applyDelta(B.leftEye, per.yawL, -per.pitchL, 0, cur('leftEye')); applyDelta(B.rightEye, per.yawR, -per.pitchR, 0, cur('rightEye'));
      } else if (this.eyeMode === 'morphs') this._eyeMorphs(per);
    }
  };

  GLBAvatar.prototype._eyeMorphs = function (per) {
    var lim = this.rig.options.eyeYawLimit, plim = this.rig.options.eyePitchLimit, self = this;
    function put(ch, v) { var sl = self.slots[ch]; if (!sl) return; v = clamp(v, 0, 1); for (var i = 0; i < sl.length; i++) sl[i].inf[sl[i].i] = v; }
    // yaw > 0 looks toward screen right: the subject's LEFT eye turns out, the RIGHT eye turns in
    var yl = per.yawL / lim, yr = per.yawR / lim, pl = per.pitchL / plim, pr = per.pitchR / plim;
    put('eyeLookOutLeft', yl); put('eyeLookInLeft', -yl); put('eyeLookInRight', yr); put('eyeLookOutRight', -yr);
    put('eyeLookUpLeft', pl); put('eyeLookDownLeft', -pl); put('eyeLookUpRight', pr); put('eyeLookDownRight', -pr);
  };

  GLBAvatar.prototype.getLandmarks = function () { return this.landmarks; };
  GLBAvatar.prototype.capabilities = function () {
    var r = this.res ? this.res.report : null;
    return { morphTargets: !!(r && r.counts.morphs), visemes: this.nativeVisemes, eyeBones: !!(this.bones.leftEye || this.bones.rightEye), eyeMorphs: !!this.slots.eyeLookOutLeft,
      jaw: this.jawMode !== 'none', body: !!(this.bones.spine || this.bones.spine1 || this.bones.spine2), tongue: !!this.slots.tongueOut, animations: !!this.mixer,
      channels: Object.keys(this.slots), eyeMode: this.eyeMode, jawMode: this.jawMode };
  };
  GLBAvatar.prototype.getInfo = function () { return this.info || { kind: 'glb', loaded: false }; };
  GLBAvatar.prototype.getRigReport = function () { return this.res ? this.res.report : null; };

  GLBAvatar.prototype.dispose = function () {
    if (this.mixer) { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.scene); this.mixer = null; }
    if (this._draco) { this._draco.dispose(); this._draco = null; }
    if (this._ktx2) { try { this._ktx2.dispose(); } catch (e) {} this._ktx2 = null; }
    if (this.object3D) {
      this.object3D.traverse(function (n) { if (n.geometry) n.geometry.dispose(); if (n.isSkinnedMesh && n.skeleton) n.skeleton.dispose(); });
      (this.materialList || []).forEach(function (m) { m.dispose(); });
      (this.textureList || []).forEach(function (t) { t.dispose(); });
      if (this.object3D.parent) this.object3D.parent.remove(this.object3D);
    }
    this.object3D = null; this.gltf = null; this.slots = {}; this.vslots = {}; this.bones = {}; this.loaded = false;
  };

  /* where the Basis transcoder files live (basis_transcoder.js and .wasm). Pages override this; a spec can pass ktx2Path too. */
  WA.KTX2_PATH = WA.KTX2_PATH || 'https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/libs/basis/';
  WA.GLBAvatar = GLBAvatar;
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== model/AvatarAdapter.js ===== */
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

/* ===== model/loadAvatar.js ===== */
/*
 * loadAvatar: picks and builds a model from a description.
 *
 *   loadAvatar({ source: 'glb', url: 'wendy.glb', rigMap: {...} })      a rigged GLB
 *   loadAvatar({ source: 'glb', data: arrayBuffer })                      a GLB already in memory
 *   loadAvatar({ source: 'procedural' })                                  the built-in fallback
 *   loadAvatar({ source: 'auto', url: 'wendy.glb' })                      GLB if it loads, procedural if not
 *   loadAvatar('wendy.glb')                                               same as auto with a url
 *
 * It resolves { model, source, fallback, error } and never rejects in 'auto' mode (or with fallback: true):
 * an unusable asset gives the procedural model and the reason in `error`, so the product keeps working.
 * With source 'glb' and fallback false it rejects with the typed AvatarError instead.
 * New model types register with registerModel(name, factory).
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit;
  var registry = {
    procedural: function () { return new WA.ProceduralAvatar(); },
    glb: function (spec) { return new WA.GLBAvatar(spec); }
  };

  function rigMapFrom(r) {
    if (!r) return WA.RigMap.create();
    if (r.morphs && r.options && r.bones) return r;                              // already a complete RigMap
    if (typeof r === 'string') return WA.RigMap.create({}, r);
    var preset = r.preset; var o = {}; for (var k in r) if (k !== 'preset') o[k] = r[k];
    return WA.RigMap.create(o, preset);
  }

  WA.registerModel = function (name, factory) { if (typeof factory !== 'function') throw WA.AvatarError('BAD_FACTORY', 'registerModel needs a factory function'); registry[name] = factory; };
  WA.modelTypes = function () { return Object.keys(registry); };

  WA.loadAvatar = function (spec) {
    if (typeof spec === 'string') spec = { source: 'auto', url: spec };
    spec = spec || { source: 'procedural' };
    var source = spec.source || (spec.url || spec.data || spec.file ? 'auto' : 'procedural');
    var fallback = spec.fallback != null ? !!spec.fallback : source === 'auto';

    function proc(reason) {
      var m = registry.procedural(spec);
      return { model: m, source: 'procedural', fallback: !!reason, error: reason || null };
    }
    if (source === 'procedural') return Promise.resolve(proc(null));
    var factory = registry[source === 'auto' ? 'glb' : source];
    if (!factory) { var e = WA.AvatarError('UNKNOWN_SOURCE', 'Unknown avatar source "' + source + '". Known: ' + Object.keys(registry).join(', ')); return fallback ? Promise.resolve(proc(e)) : Promise.reject(e); }
    if (source === 'auto' && !(spec.url || spec.data || spec.file)) return Promise.resolve(proc(null));

    var model;
    try { var s2 = {}; for (var k in spec) s2[k] = spec[k]; s2.rigMap = rigMapFrom(spec.rigMap); model = factory(s2); }
    catch (err) { var ae = err && err.code ? err : WA.AvatarError('MODEL_INIT_FAILED', 'Could not create the model: ' + err.message, err); return fallback ? Promise.resolve(proc(ae)) : Promise.reject(ae); }

    return model.load().then(function () {
      var rep = model.getRigReport && model.getRigReport();
      if (rep && rep.grade === 'insufficient' && spec.requireUsableRig !== false && fallback) {
        var why = WA.AvatarError('RIG_INSUFFICIENT', 'The model loaded but its rig lacks essential channels (' + rep.essentialMissing.join(', ') + '). Check the RigMap.');
        try { model.dispose(); } catch (x) {}
        return proc(why);
      }
      return { model: model, source: source === 'auto' ? 'glb' : source, fallback: false, error: null };
    }, function (err) {
      try { model.dispose(); } catch (x) {}
      var ae = err && err.code ? err : WA.AvatarError('LOAD_FAILED', 'Loading failed: ' + (err && err.message), err);
      if (fallback) return proc(ae);
      throw ae;
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== runtime/ConversationState.js ===== */
/*
 * ConversationState: the actual state model of the character, not a visual effect.
 *
 *   IDLE -> LISTENING -> THINKING -> SPEAKING -> IDLE
 *   SPEAKING -> INTERRUPTED -> LISTENING          (the user talks over her)
 *
 * Pure and deterministic: no clock, no DOM. Time only moves when tick(dt) is called, so the same events and ticks always
 * give the same history. Every change goes through a short TRANSITION (`state` reads TRANSITION and `target` says where
 * it is going); events that arrive during it are applied to the target. An event with no edge from the current state is
 * refused (dispatch returns false, an `invalid` event is emitted): it never throws and never changes the state.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit;

  var STATES = ['IDLE', 'LISTENING', 'THINKING', 'SPEAKING', 'INTERRUPTED', 'TRANSITION', 'ERROR'];
  var EDGES = {
    IDLE: { userStart: 'LISTENING', responseStart: 'SPEAKING' },
    LISTENING: { userEnd: 'THINKING', responseStart: 'SPEAKING', cancel: 'IDLE' },
    THINKING: { responseStart: 'SPEAKING', userStart: 'LISTENING', cancel: 'IDLE' },
    SPEAKING: { responseEnd: 'IDLE', userStart: 'INTERRUPTED', interrupt: 'INTERRUPTED', cancel: 'IDLE' },
    INTERRUPTED: { settled: 'LISTENING', userStart: 'LISTENING', cancel: 'IDLE' },
    ERROR: { userStart: 'LISTENING' }
  };
  var ANYWHERE = { error: 'ERROR', reset: 'IDLE' };

  function ConversationState(opts) {
    opts = opts || {};
    this.transitionTime = opts.transition == null ? 0.2 : opts.transition;     // seconds spent in TRANSITION
    this.interruptHold = opts.interruptHold == null ? 0.35 : opts.interruptHold; // seconds in INTERRUPTED before LISTENING
    this.state = 'IDLE'; this.target = 'IDLE'; this.previous = null; this.time = 0; this.history = [];
    this._left = 0; this._hold = 0; this._handlers = {};
  }
  ConversationState.STATES = STATES; ConversationState.EDGES = EDGES;

  ConversationState.prototype.on = function (n, f) { (this._handlers[n] = this._handlers[n] || []).push(f); return f; };
  ConversationState.prototype.off = function (n, f) { var l = this._handlers[n]; if (l) this._handlers[n] = l.filter(function (x) { return x !== f; }); };
  ConversationState.prototype._emit = function (n, d) { (this._handlers[n] || []).slice().forEach(function (f) { try { f(d); } catch (e) {} }); };

  /* the state events are applied to: the target while a transition is under way */
  ConversationState.prototype.current = function () { return this.state === 'TRANSITION' ? this.target : this.state; };
  ConversationState.prototype.isIn = function (s) { return this.current() === s; };
  ConversationState.prototype.canDispatch = function (ev) { var c = this.current(); return !!((EDGES[c] && EDGES[c][ev]) || ANYWHERE[ev]); };

  ConversationState.prototype._commit = function () {
    if (this.state !== 'TRANSITION') return;
    this.state = this.target; this._hold = this.state === 'INTERRUPTED' ? this.interruptHold : 0;
    this._emit('enter', { state: this.state, time: this.time });
  };
  ConversationState.prototype._begin = function (to, ev, manual) {
    var from = this.current(); this.previous = from; this.target = to;
    this.history.push({ t: +this.time.toFixed(3), from: from, to: to, event: ev, manual: !!manual }); if (this.history.length > 100) this.history.shift();
    if (this.transitionTime > 0) { this.state = 'TRANSITION'; this._left = this.transitionTime; } else { this.state = to; this._hold = to === 'INTERRUPTED' ? this.interruptHold : 0; }
    this._emit('change', { from: from, to: to, event: ev, manual: !!manual });
    if (this.state !== 'TRANSITION') this._emit('enter', { state: this.state, time: this.time });
    return true;
  };

  /* events: userStart userEnd responseStart responseEnd interrupt cancel settled error reset */
  ConversationState.prototype.dispatch = function (ev, data) {
    var c = this.current(), to = (EDGES[c] && EDGES[c][ev]) || ANYWHERE[ev];
    if (!to) { this._emit('invalid', { state: c, event: ev }); return false; }
    this._commit(); this._left = 0;
    if (to === c && ev !== 'reset') return true;
    return this._begin(to, ev, false) && (data == null || true);
  };
  /* explicit override from a control panel or a test: any state to any known state, recorded as manual */
  ConversationState.prototype.force = function (name) {
    name = String(name || '').toUpperCase();
    if (STATES.indexOf(name) < 0 || name === 'TRANSITION') { this._emit('invalid', { state: this.current(), event: 'force:' + name }); return false; }
    this._commit(); this._left = 0; return this._begin(name, 'manual', true);
  };
  ConversationState.prototype.tick = function (dt) {
    this.time += dt;
    if (this.state === 'TRANSITION') { this._left -= dt; if (this._left <= 0) this._commit(); return; }
    if (this.state === 'INTERRUPTED' && this._hold > 0) { this._hold -= dt; if (this._hold <= 0) this.dispatch('settled'); }
  };
  ConversationState.prototype.reset = function () { this.state = 'IDLE'; this.target = 'IDLE'; this.previous = null; this._left = 0; this._hold = 0; this.history = []; this._emit('enter', { state: 'IDLE', time: this.time }); };

  WA.ConversationState = ConversationState;
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== runtime/Phonemizer.js ===== */
/*
 * Phonemizer: text -> ARPAbet phoneme events { ph, t, d } for the lip-sync timeline.
 *
 * A small English rule set with an exception list. It is APPROXIMATE: good enough to drive plausible mouth shapes for
 * ordinary executive prose, not a dictionary. A real TTS that returns its own visemes or phonemes replaces it
 * (SpeechResult.phonemes), and nothing else changes.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit;

  var EXC = {
    the: 'DH AH', a: 'AH', an: 'AE N', of: 'AH V', to: 'T UW', too: 'T UW', you: 'Y UW', your: 'Y AO R', youre: 'Y UH R', is: 'IH Z', was: 'W AH Z', are: 'AA R', were: 'W ER', what: 'W AH T', who: 'HH UW',
    one: 'W AH N', two: 'T UW', do: 'D UW', does: 'D AH Z', have: 'HH AE V', said: 'S EH D', they: 'DH EY', there: 'DH EH R', their: 'DH EH R', this: 'DH IH S', that: 'DH AE T', then: 'DH EH N',
    them: 'DH EH M', these: 'DH IY Z', those: 'DH OW Z', than: 'DH AE N', with: 'W IH TH', from: 'F R AH M', about: 'AH B AW T', would: 'W UH D', could: 'K UH D', should: 'SH UH D', people: 'P IY P AH L',
    problem: 'P R AA B L AH M', issue: 'IH SH UW', separate: 'S EH P ER EY T', noise: 'N OY Z', next: 'N EH K S T', move: 'M UW V', lets: 'L EH T S', whats: 'W AH T S', thats: 'DH AE T S', its: 'IH T S',
    dont: 'D OW N T', cant: 'K AE N T', wont: 'W OW N T', ive: 'AY V', were: 'W ER', we: 'W IY', he: 'HH IY', she: 'SH IY', me: 'M IY', be: 'B IY', my: 'M AY', by: 'B AY', no: 'N OW', so: 'S OW',
    go: 'G OW', how: 'HH AW', now: 'N AW', not: 'N AA T', actually: 'AE K CH UW AH L IY', before: 'B IH F AO R', decide: 'D IH S AY D', decision: 'D IH S IH SH AH N', executive: 'IH G Z EH K Y AH T IH V',
    because: 'B IH K AO Z', every: 'EH V R IY', other: 'AH DH ER', another: 'AH N AH DH ER', whole: 'HH OW L', where: 'W EH R', here: 'HH IY R', here_: '', want: 'W AA N T', work: 'W ER K', world: 'W ER L D',
    right: 'R AY T', night: 'N AY T', know: 'N OW', through: 'TH R UW', thought: 'TH AO T', enough: 'IH N AH F', happened: 'HH AE P AH N D', story: 'S T AO R IY', telling: 'T EH L IH NG',
    yourself: 'Y AO R S EH L F', happening: 'HH AE P AH N IH NG'
  };
  var DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  var VOW = 'aeiouy';
  function isV(c) { return !!c && VOW.indexOf(c) >= 0; }

  function g2p(s) {
    var out = [], i = 0, n = s.length;
    function at(k) { return s.charAt(i + k); }
    while (i < n) {
      var c = s[i], c1 = at(1), c2 = at(2), two = c + c1, three = two + c2, rest = s.slice(i);
      if (rest === 'tion' || rest === 'sion') { out.push('SH', 'AH', 'N'); break; }
      if (c === 'l' && c1 === 'e' && i + 2 === n && i > 0 && !isV(s[i - 1])) { out.push('AH', 'L'); break; }
      if (three === 'tch') { out.push('CH'); i += 3; continue; }
      if (three === 'igh') { out.push('AY'); i += 3; continue; }
      if (two === 'sh') { out.push('SH'); i += 2; continue; }
      if (two === 'ch') { out.push('CH'); i += 2; continue; }
      if (two === 'th') { out.push('TH'); i += 2; continue; }
      if (two === 'ph') { out.push('F'); i += 2; continue; }
      if (two === 'wh') { out.push('W'); i += 2; continue; }
      if (two === 'ck') { out.push('K'); i += 2; continue; }
      if (two === 'ng') { out.push('NG'); i += 2; continue; }
      if (two === 'qu') { out.push('K', 'W'); i += 2; continue; }
      if (i === 0 && two === 'kn') { out.push('N'); i += 2; continue; }
      if (i === 0 && two === 'wr') { out.push('R'); i += 2; continue; }
      if (two === 'gh') { i += 2; continue; }
      if (c === c1 && !isV(c)) { i++; continue; }
      if (!isV(c)) {
        var m = { b: 'B', d: 'D', f: 'F', h: 'HH', j: 'JH', k: 'K', l: 'L', m: 'M', n: 'N', p: 'P', r: 'R', t: 'T', v: 'V', w: 'W', z: 'Z', q: 'K' }[c];
        if (m) out.push(m);
        else if (c === 'c') out.push('eiy'.indexOf(c1) >= 0 && c1 ? 'S' : 'K');
        else if (c === 'g') out.push('eiy'.indexOf(c1) >= 0 && c1 && i + 2 < n ? 'JH' : 'G');
        else if (c === 's') out.push(i === n - 1 && i > 0 && 'bdgvzmnlraeiou'.indexOf(s[i - 1]) >= 0 ? 'Z' : 'S');
        else if (c === 'x') out.push('K', 'S');
        i++; continue;
      }
      // vowels
      var magic = s[i + 2] === 'e' && i + 3 === n && !isV(c1);
      if (c === 'y' && i === 0) { out.push('Y'); i++; continue; }
      var dg = { ee: 'IY', ea: 'IY', oo: 'UW', ou: 'AW', ow: 'OW', ai: 'EY', ay: 'EY', oi: 'OY', oy: 'OY', au: 'AO', aw: 'AO', ie: 'IY', ei: 'EY', ey: 'EY', oa: 'OW', ue: 'UW', ui: 'UW' }[two];
      if (dg) { out.push(dg); i += 2; continue; }
      if (c1 === 'r' && !isV(c2) && 'aeiou'.indexOf(c) >= 0) { out.push(c === 'a' ? 'AA' : c === 'o' ? 'AO' : 'ER'); if (c === 'a' || c === 'o') out.push('R'); i += 2; continue; }
      if (c === 'a') out.push(magic ? 'EY' : 'AE');
      else if (c === 'e') { if (i === n - 1 && n > 2) { i++; continue; } out.push(n === 2 && i === 1 ? 'IY' : 'EH'); }
      else if (c === 'i') out.push(magic ? 'AY' : 'IH');
      else if (c === 'o') out.push(magic ? 'OW' : 'AA');
      else if (c === 'u') out.push(magic ? 'UW' : 'AH');
      else if (c === 'y') out.push(i === n - 1 ? (n <= 3 ? 'AY' : 'IY') : 'IH');
      i++;
    }
    return out;
  }

  /* text -> words [{ word, ph: [..], pause }] */
  function words(text) {
    var out = [], tokens = String(text == null ? '' : text).replace(/[’']/g, '').match(/[A-Za-z]+|[0-9]|[.,;:!?—–-]/g) || [];
    tokens.forEach(function (t) {
      if (/[0-9]/.test(t)) { out.push({ word: DIGITS[+t], ph: g2p(DIGITS[+t]), pause: 0 }); return; }
      if (/[A-Za-z]/.test(t)) { var w = t.toLowerCase(); out.push({ word: w, ph: EXC[w] ? EXC[w].split(' ') : g2p(w), pause: 0 }); return; }
      if (!out.length) return;
      var p = /[.!?]/.test(t) ? 0.45 : /[;:]/.test(t) ? 0.35 : /[—–-]/.test(t) ? 0.22 : 0.3;
      out[out.length - 1].pause = Math.max(out[out.length - 1].pause, p);
    });
    return out;
  }

  var V = { AA: 1, AE: 1, AH: 1, AO: 1, AW: 1, AY: 1, EH: 1, ER: 1, EY: 1, IH: 1, IY: 1, OW: 1, OY: 1, UH: 1, UW: 1 }, DIPH = { AW: 1, AY: 1, EY: 1, OW: 1, OY: 1 }, STOP = { B: 1, D: 1, G: 1, K: 1, P: 1, T: 1 }, NAS = { M: 1, N: 1, NG: 1 };
  function dur(ph, stressed, pace) { var d = V[ph] ? (DIPH[ph] ? 0.2 : 0.14) : STOP[ph] ? 0.065 : NAS[ph] ? 0.08 : 0.095; if (stressed && V[ph]) d *= 1.35; return d * pace; }

  /* opts: { rate (1 = calm and deliberate), lead, tail } -> { events, duration, syllables, words } */
  function toEvents(text, opts) {
    opts = opts || {}; var pace = 1.1 / (opts.rate || 1), t = opts.lead == null ? 0.25 : opts.lead, ev = [{ ph: 'SIL', t: 0, d: t }], syl = 0, ws = words(text);
    ws.forEach(function (w) {
      var first = true;
      w.ph.forEach(function (ph) {
        var st = V[ph] && first; if (V[ph]) { first = false; syl++; }
        var d = dur(ph, st, pace); ev.push({ ph: ph, t: +t.toFixed(3), d: +d.toFixed(3) }); t += d;
      });
      t += 0.045 * pace; if (w.pause) { ev.push({ ph: 'SIL', t: +t.toFixed(3), d: +(w.pause * pace / 1.1).toFixed(3) }); t += w.pause * pace / 1.1; }
    });
    var tail = opts.tail == null ? 0.4 : opts.tail; ev.push({ ph: 'SIL', t: +t.toFixed(3), d: tail });
    return { events: ev, duration: +(t + tail).toFixed(3), syllables: syl, words: ws.length };
  }

  WA.Phonemizer = { g2p: g2p, words: words, toEvents: toEvents, VOWELS: V };
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== runtime/SynthVoice.js ===== */
/*
 * SynthVoice: phoneme events -> audible PCM. A small source-filter (glottal pulse train through two formant resonators,
 * shaped noise for fricatives and bursts). It is intelligible as speech-like sound but robotic: it exists so the product
 * speaks, with matching lip-sync, with no network and no credentials. A real TTS replaces it behind SpeechProvider.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit;

  var VOWEL = { AA: [730, 1090], AE: [660, 1720], AH: [640, 1190], AO: [570, 840], AW: [700, 1200], AY: [700, 1300], EH: [530, 1840], ER: [490, 1350], EY: [450, 2000], IH: [390, 1990], IY: [270, 2290], OW: [500, 900], OY: [500, 900], UH: [440, 1020], UW: [300, 870] };
  var SONOR = { L: [360, 1300, 0.55], R: [310, 1060, 0.55], W: [290, 610, 0.5], Y: [270, 2100, 0.5], M: [250, 1000, 0.3], N: [250, 1500, 0.3], NG: [250, 1200, 0.3] };
  // fricatives: [noise centre Hz, noise level, voiced level]
  var FRIC = { S: [6000, 0.5, 0], SH: [3200, 0.5, 0], F: [4000, 0.22, 0], TH: [4500, 0.16, 0], HH: [1500, 0.3, 0], Z: [6000, 0.3, 0.3], V: [4000, 0.14, 0.3], DH: [4500, 0.1, 0.3], ZH: [3200, 0.3, 0.3], CH: [3200, 0.5, 0], JH: [3200, 0.35, 0.2] };
  var STOPS = { P: [900, 0], B: [900, 0.25], T: [4000, 0], D: [4000, 0.25], K: [2000, 0], G: [2000, 0.25] };

  function render(events, opts) {
    opts = opts || {}; var sr = opts.sampleRate || 22050, base = opts.pitch || 172;
    var last = events[events.length - 1], total = last.t + last.d, n = Math.ceil(total * sr) + sr / 4, out = new Float32Array(n);
    var seed = 12345; function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; }
    var phase = 0, y1a = 0, y2a = 0, y1b = 0, y2b = 0, y1n = 0, y2n = 0;
    function coef(f, bw) { var r = Math.exp(-Math.PI * bw / sr), a2 = -r * r, a1 = 2 * r * Math.cos(2 * Math.PI * f / sr); return [a1, a2, 1 - a1 - a2]; }
    events.forEach(function (e) {
      var ph = e.ph; if (ph === 'SIL' || ph === 'SP') return;
      var i0 = Math.floor(e.t * sr), len = Math.max(1, Math.floor(e.d * sr)), v = VOWEL[ph], so = SONOR[ph], fr = FRIC[ph], st = STOPS[ph];
      var f1 = 500, f2 = 1500, voiced = 0, noise = 0, nf = 3000, burst = false;
      if (v) { f1 = v[0]; f2 = v[1]; voiced = 1; } else if (so) { f1 = so[0]; f2 = so[1]; voiced = so[2]; } else if (fr) { nf = fr[0]; noise = fr[1]; voiced = fr[2]; f1 = 450; f2 = 1500; } else if (st) { nf = st[0]; voiced = st[1]; burst = true; } else return;
      var c1 = coef(f1, 90), c2 = coef(f2, 130), cn = coef(nf, nf * 0.35);
      for (var k = 0; k < len && i0 + k < n; k++) {
        var u = k / len, env = Math.min(1, u * 12) * Math.min(1, (1 - u) * 10);
        var f0 = base * (1 - 0.14 * ((i0 + k) / sr) / Math.max(1, total)) * (1 + 0.012 * Math.sin(2 * Math.PI * 5 * (i0 + k) / sr));
        phase += f0 / sr; if (phase >= 1) phase -= 1;
        var glot = (1 - phase) * (1 - phase) * 2 - 0.66, s = 0;
        if (voiced > 0 && !(burst && u < 0.6)) {
          var a = glot * voiced, ya = c1[0] * y1a + c1[1] * y2a + c1[2] * a; y2a = y1a; y1a = ya;
          var yb = c2[0] * y1b + c2[1] * y2b + c2[2] * a; y2b = y1b; y1b = yb;
          s += (ya * 1.0 + yb * 0.55) * (v ? 1 : 0.6);
        }
        if (noise > 0 || (burst && u < 0.35)) {
          var x = rnd() * (burst ? 0.9 : noise), yn = cn[0] * y1n + cn[1] * y2n + cn[2] * x; y2n = y1n; y1n = yn;
          s += yn * 1.4 * (burst ? Math.max(0, 1 - u / 0.35) : 1);
        }
        out[i0 + k] += s * env * (burst && u >= 0.35 && u < 0.6 ? 0 : 1) * (v ? 1 : 0.7);
      }
    });
    var peak = 0.0001; for (var i = 0; i < n; i++) { var a = Math.abs(out[i]); if (a > peak) peak = a; }
    var g = 0.55 / peak; for (var j = 0; j < n; j++) out[j] *= g;
    return { pcm: out, sampleRate: sr, duration: n / sr };
  }
  WA.SynthVoice = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== runtime/Speech.js ===== */
/*
 * Speech providers.
 *
 *   Text -> SpeechProvider -> SpeechResult -> playback -> LipSyncController -> Avatar
 *
 * interface SpeechProvider {
 *   name: string
 *   available(): boolean
 *   speak(text, hooks?): Promise<SpeechResult>     hooks: { onStart(result) } (providers that play the sound themselves call it when sound starts)
 *   stop(): void
 * }
 * SpeechResult { text, provider, playback: 'engine' | 'provider', audio?: Float32Array (mono PCM), sampleRate?, phonemes: [{ ph, t, d }], duration }
 *   playback 'engine'   the avatar plays `audio` and runs the lips from `phonemes` (or from the audio level when there are none)
 *   playback 'provider' the provider plays the sound itself (onStart tells the avatar when) and the lips run from `phonemes`
 * A cloud TTS plugs in here: return its audio and its viseme/phoneme events. Nothing else in the application changes.
 *
 * Providers in the kit: SyntheticSpeechProvider (offline formant voice, robotic, always available) and BrowserSpeechProvider
 * (the browser's speechSynthesis voices; the sound cannot be captured, so lips follow an estimated timeline).
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit;

  function SyntheticSpeechProvider(opts) { this.name = 'synthetic'; this.opts = opts || {}; this._n = 0; }
  SyntheticSpeechProvider.prototype.available = function () { return true; };
  SyntheticSpeechProvider.prototype.speak = function (text) {
    var o = this.opts, tl = WA.Phonemizer.toEvents(text, { rate: o.rate || 1 });
    if (!tl.syllables) return Promise.reject(WA.AvatarError('EMPTY_TEXT', 'There is nothing to say'));
    var a = WA.SynthVoice.render(tl.events, { pitch: o.pitch, sampleRate: o.sampleRate });
    return Promise.resolve({ text: text, provider: this.name, playback: 'engine', audio: a.pcm, sampleRate: a.sampleRate, phonemes: tl.events, duration: a.duration });
  };
  SyntheticSpeechProvider.prototype.stop = function () {};

  function BrowserSpeechProvider(opts) { this.name = 'browser'; this.opts = opts || {}; this._u = null; }
  BrowserSpeechProvider.prototype.available = function () {
    try { return !!(root.speechSynthesis && root.SpeechSynthesisUtterance && root.speechSynthesis.getVoices().length > 0); } catch (e) { return false; }
  };
  BrowserSpeechProvider.prototype.speak = function (text, hooks) {
    var self = this, o = this.opts;
    if (!this.available()) return Promise.reject(WA.AvatarError('TTS_UNAVAILABLE', 'The browser has no speech voices'));
    var rate = o.rate || 0.95, tl = WA.Phonemizer.toEvents(text, { rate: rate });
    return new Promise(function (resolve, reject) {
      var u = new root.SpeechSynthesisUtterance(text), voices = root.speechSynthesis.getVoices(), started = false, timer;
      var pick = o.voice ? voices.filter(function (v) { return v.name === o.voice; })[0] : voices.filter(function (v) { return /^en/i.test(v.lang); })[0];
      if (pick) u.voice = pick; u.rate = rate; u.pitch = o.pitch || 0.95; u.lang = (pick && pick.lang) || 'en-US';
      var result = { text: text, provider: self.name, playback: 'provider', phonemes: tl.events, duration: tl.duration };
      u.onstart = function () { started = true; clearTimeout(timer); if (hooks && hooks.onStart) hooks.onStart(result); };
      u.onend = function () { clearTimeout(timer); self._u = null; resolve(result); };
      u.onerror = function (e) { clearTimeout(timer); self._u = null; if (e && (e.error === 'canceled' || e.error === 'interrupted')) resolve(result); else reject(WA.AvatarError('TTS_FAILED', 'Browser speech failed: ' + (e && e.error))); };
      timer = setTimeout(function () { if (!started) { try { root.speechSynthesis.cancel(); } catch (e) {} reject(WA.AvatarError('TTS_NO_START', 'Browser speech did not start')); } }, o.startTimeout || 2500);
      self._u = u; root.speechSynthesis.cancel(); root.speechSynthesis.speak(u);
    });
  };
  BrowserSpeechProvider.prototype.stop = function () { try { if (root.speechSynthesis) root.speechSynthesis.cancel(); } catch (e) {} this._u = null; };

  /* 'auto' (browser voices when the browser has them, otherwise synthetic) | 'browser' | 'synthetic' | a provider object */
  function createSpeechProvider(which, opts) {
    if (which && typeof which === 'object' && typeof which.speak === 'function') return which;
    if (which === 'synthetic') return new SyntheticSpeechProvider(opts);
    var b = new BrowserSpeechProvider(opts);
    if (which === 'browser') return b;
    return b.available() ? b : new SyntheticSpeechProvider(opts);
  }

  WA.SyntheticSpeechProvider = SyntheticSpeechProvider; WA.BrowserSpeechProvider = BrowserSpeechProvider; WA.createSpeechProvider = createSpeechProvider;
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== runtime/ExecutiveAvatar.js ===== */
/*
 * ExecutiveAvatar: the AVATAR_RUNTIME_CONTRACT.
 *
 *   TEMPORARY_ASSET  ->  AVATAR_RUNTIME_CONTRACT (this file)  ->  PRODUCTION_VERA_ASSET
 *
 * The application talks only to the object returned by createExecutiveAvatar(). It never touches a mesh, a morph target, a bone
 * or a file name. What the character is made of lives in the asset (a GLB through RigMap, or the built-in procedural character);
 * swapping the asset is a change of `options.asset` and nothing else.
 *
 * It adds, on top of the existing AvatarAPI (reused, not replaced):
 *   - a real conversation state model (ConversationState): IDLE LISTENING THINKING SPEAKING INTERRUPTED TRANSITION ERROR
 *   - executive presence per state (what the face, gaze and body do in each)
 *   - the speech pipeline: Text -> SpeechProvider -> audio -> LipSyncController -> avatar, with stop and interruption
 *   - an asset-independent expression and viseme vocabulary
 *   - a deterministic demo sequence
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit;

  var DEMO_TEXT = "Let's separate the problem from the noise. The issue is not what happened. The issue is what is preventing the next move.";

  /* The public expression vocabulary. Each name maps to an engine expression plus an intensity; the engine blends between them. */
  var EXPRESSIONS = { neutral: ['neutral', 1], warm: ['empathetic', 0.75], focused: ['analyzing', 0.65], skeptical: ['skeptical', 1], concerned: ['concerned', 1], confident: ['confident', 1], surprised: ['surprised', 0.8], firm: ['firm', 1] };
  /* The public viseme vocabulary -> engine viseme names (Oculus 15) */
  var VISEMES = { AA: 'viseme_aa', E: 'viseme_E', O: 'viseme_O', M: 'viseme_PP', F: 'viseme_FF', TH: 'viseme_TH', S: 'viseme_SS', REST: 'viseme_sil' };
  var ANIMATIONS = ['nod', 'acknowledge', 'blink', 'lookAway', 'idle'];

  /* What each conversation state does to the character */
  var PRESENCE = {
    IDLE: { cog: null, expr: 'neutral', gaze: 'camera', idle: 1, attention: 0.7 },
    LISTENING: { cog: 'LISTENING', gaze: 'camera', idle: 0.55, attention: 0.95 },
    THINKING: { cog: 'THINKING', idle: 0.7, attention: 0.8 },
    SPEAKING: { cog: 'SPEAKING', gaze: 'camera', idle: 0.9, attention: 0.85 },
    INTERRUPTED: { cog: 'LISTENING', expr: ['concerned', 0.3], gaze: 'camera', idle: 0.5, attention: 1 },
    ERROR: { cog: null, expr: ['concerned', 0.5], gaze: 'camera', idle: 0.8, attention: 0.7 }
  };

  /* What an asset must provide, and how the runtime degrades when it does not. Documented here, enforced by the rig report. */
  var CONTRACT = {
    required: ['a loadable model (GLB through RigMap, or the procedural character)', 'a head with a jaw that opens (bone or blendshape)'],
    expected: ['52 ARKit blendshapes', '15 Oculus visemes', 'eye bones or look-blendshapes', 'head and neck bones', 'spine and shoulders for body presence'],
    degrades: { 'no visemes': 'jaw and mouth shapes from the audio level (amplitude fallback)', 'no blendshapes': 'bones only', 'no eye controls': 'head turns carry the gaze', 'no body': 'head and neck only', 'missing file or bad GLB': 'the procedural character, with a warning' },
    textures: 'PNG/JPEG today. KTX2 is required for production and is NOT supported by the current loader.',
    swap: 'options.asset = { url: "vera-production.glb", rigMap?: {...}, role: "PRODUCTION" }'
  };

  function createExecutiveAvatar(container, options) {
    options = options || {};
    var asset = options.asset || { source: 'procedural' };
    var role = asset.role || (asset.url || asset.data ? 'ASSET' : 'DEVELOPMENT_PLACEHOLDER');
    var spec = asset.url || asset.data ? { source: 'auto', url: asset.url, data: asset.data, rigMap: asset.rigMap || (asset.profile && asset.profile.rigMap) } : { source: 'procedural' };
    var avatar = WA.createAvatar(container, { shot: options.shot || 'MEDIUM_CLOSE', style: options.style || 'executive', quality: options.quality || 'medium', paused: options.paused, adaptive: options.adaptive,
      pixelRatio: options.pixelRatio, autoState: true, avatar: spec });
    var convo = new WA.ConversationState(options.state), handlers = {}, timers = [], clock = 0, token = 0, demoToken = 0, pending = null, destroyed = false;
    var provider = WA.createSpeechProvider(options.speech || 'auto', options.speechOptions), fallbackVoice = new WA.SyntheticSpeechProvider(options.speechOptions);
    var lastAnimation = 'idle', lastError = null, assetInfo = { profiled: 0, requested: asset.url || (asset.data ? '(data)' : 'procedural'), role: role, label: asset.label || null, loaded: null, fallback: false, error: null };

    function emit(n, d) { (handlers[n] || []).slice().forEach(function (f) { try { f(d); } catch (e) {} }); }
    function later(sec, fn) { timers.push({ at: clock + sec, fn: fn }); }
    function wait(sec) { return new Promise(function (res) { later(sec, res); }); }

    /* ---------- presence: what the character does in each state ---------- */
    function applyPresence(state) {
      var p = PRESENCE[state]; if (!p) return;
      avatar.setCognitiveState(p.cog);
      var e = p.expr; if (e) { if (typeof e === 'string') avatar.setExpression(e); else avatar.setExpression(e[0], { intensity: e[1] }); }
      if (p.gaze) avatar.lookAt(p.gaze);
      avatar.idle({ intensity: p.idle }); avatar.setAttention(p.attention);
      if (state === 'LISTENING' && convo.previous === 'INTERRUPTED') avatar.gesture('nod');
    }
    convo.on('change', function (c) { applyPresence(c.to); emit('state', { state: c.to, from: c.from, event: c.event }); });
    convo.on('invalid', function (d) { emit('warning', WA.AvatarError('INVALID_TRANSITION', 'Event "' + d.event + '" is not valid in state ' + d.state)); });
    avatar.on('warning', function (w) { emit('warning', w); }); avatar.on('error', function (e) { emit('error', e); });
    avatar.on('tick', function (dt) {
      clock += dt; convo.tick(dt);
      for (var i = timers.length - 1; i >= 0; i--) if (timers[i].at <= clock) { var t = timers.splice(i, 1)[0]; try { t.fn(); } catch (e) {} }
    });

    /* ---------- speech: Text -> SpeechProvider -> audio -> lip-sync -> avatar ---------- */
    function play(result, mine) {
      var phon = { phonemes: result.phonemes, provider: 'phonemes' };
      if (result.playback === 'engine' && result.audio) {
        return avatar.speak(result.audio, { phonemes: result.phonemes, provider: 'phonemes', sampleRate: result.sampleRate }).catch(function (e) {
          if (e && e.code === 'PLAY_BLOCKED' && mine()) { emit('warning', WA.AvatarError('AUDIO_BLOCKED', 'The browser blocked audio until the page is clicked; lips run silently')); return avatar.speak(null, phon); }
          throw e;
        });
      }
      return avatar.speak(null, phon);
    }
    function stopAudio() { try { provider.stop(); } catch (e) {} try { fallbackVoice.stop(); } catch (e) {} avatar.stopSpeaking(); }

    function speak(text, opts) {
      text = String(text == null ? '' : text).trim();
      if (!text) return Promise.reject(WA.AvatarError('EMPTY_TEXT', 'There is nothing to say'));
      var c = convo.current();
      if (c === 'INTERRUPTED' || (c === 'ERROR' && false)) return Promise.resolve({ ok: false, reason: 'user is speaking' });
      var my = ++token, mine = function () { return my === token && !destroyed; };
      if (pending) { stopAudio(); pending.resolve({ ok: false, reason: 'replaced' }); pending = null; }
      if (c !== 'SPEAKING') convo.dispatch('responseStart'); else applyPresence('SPEAKING');
      emit('speechstart', { text: text });
      return new Promise(function (resolve) {
        var done = false, prov = provider;
        function finish(res) { if (done) return; done = true; if (pending && pending.my === my) pending = null; resolve(res); }
        pending = { my: my, resolve: finish };
        var started = false;
        function run(p) {
          return p.speak(text, { onStart: function (r) { if (!mine()) return; started = true; play(r, mine).then(function () { if (mine()) end({ ok: true, provider: p.name, duration: r.duration }); }, fail); } })
            .then(function (r) {
              if (!mine()) return;
              if (r.playback === 'provider') { if (!started) { started = true; play(r, mine); } end({ ok: true, provider: p.name, duration: r.duration }); }
              else if (!started) { started = true; play(r, mine).then(function () { if (mine()) end({ ok: true, provider: p.name, duration: r.duration }); }, fail); }
            }, function (e) { if (mine() && p !== fallbackVoice) { emit('warning', WA.AvatarError('SPEECH_FALLBACK', 'Speech provider "' + p.name + '" failed (' + (e && e.message) + '); using the synthetic voice', e)); prov = fallbackVoice; return run(fallbackVoice); } fail(e); });
        }
        function end(res) { if (!mine()) return finish({ ok: false, reason: 'stopped' }); avatar.stopSpeaking(); if (convo.isIn('SPEAKING')) convo.dispatch('responseEnd'); emit('speechend', res); finish(res); }
        function fail(e) { if (!mine()) return finish({ ok: false, reason: 'stopped' }); lastError = e; stopAudio(); convo.dispatch('error'); emit('error', e); finish({ ok: false, reason: 'error', error: e }); }
        run(provider);
      });
    }
    function stopSpeaking() {
      var had = !!pending || avatar.isSpeaking(); token++; stopAudio();
      if (pending) { var p = pending; pending = null; p.resolve({ ok: false, reason: 'stopped' }); }
      if (convo.isIn('SPEAKING')) convo.dispatch('cancel');
      if (had) emit('speechend', { ok: false, reason: 'stopped' });
    }
    function interrupt() { if (convo.isIn('SPEAKING')) { token++; stopAudio(); if (pending) { var p = pending; pending = null; p.resolve({ ok: false, reason: 'interrupted' }); } emit('speechend', { ok: false, reason: 'interrupted' }); return convo.dispatch('interrupt'); } return false; }

    /* ---------- the conversation: what the application reports ---------- */
    function userStartedSpeaking() { if (convo.isIn('SPEAKING')) return interrupt(); return convo.dispatch('userStart'); }
    function userStoppedSpeaking() { return convo.dispatch('userEnd'); }

    function setState(name) {
      name = String(name || '').toUpperCase();
      if (name === 'SPEAKING' && !avatar.isSpeaking()) return convo.force('SPEAKING');
      if (name === 'IDLE' && convo.isIn('SPEAKING')) { stopSpeaking(); return true; }
      if (name === 'LISTENING') { if (convo.isIn('SPEAKING')) return interrupt(); if (convo.canDispatch('userStart')) return convo.dispatch('userStart'); }
      if (name === 'THINKING' && convo.canDispatch('userEnd')) return convo.dispatch('userEnd');
      return convo.force(name);
    }

    function setExpression(name, opts) {
      var key = String(name == null ? '' : name).toLowerCase(), m = EXPRESSIONS[key];
      if (!m) { var known = Object.keys(EXPRESSIONS); emit('warning', WA.AvatarError('UNKNOWN_EXPRESSION', 'Unknown expression "' + name + '". Known: ' + known.join(', '))); return false; }
      var o = {}; for (var k in (opts || {})) o[k] = opts[k];
      o.intensity = o.intensity != null ? o.intensity : m[1];
      var ok = avatar.setExpression(m[0], o); if (ok) emit('expression', key); return ok;
    }
    function setViseme(name, w) {
      var n = String(name == null ? '' : name).toUpperCase(), v = VISEMES[n];
      if (!v) { emit('warning', WA.AvatarError('UNKNOWN_VISEME', 'Unknown viseme "' + name + '". Known: ' + Object.keys(VISEMES).join(', '))); return false; }
      avatar.setViseme(n === 'REST' ? null : v, w == null ? 1 : w); return true;
    }
    function playAnimation(name) {
      var n = String(name || ''), ok = false;
      if (n === 'nod' || n === 'acknowledge') ok = avatar.gesture('nod');
      else if (n === 'lookAway') { ok = avatar.lookAt('right'); later(1.1, function () { avatar.lookAt('camera'); }); }
      else if (n === 'blink') ok = avatar.gesture('blink');
      else if (n === 'idle') { avatar.idle({ intensity: 1 }); ok = true; }
      if (ok) { lastAnimation = n; emit('animation', n); } else emit('warning', WA.AvatarError('UNKNOWN_ANIMATION', 'Unknown animation "' + name + '". Known: ' + ANIMATIONS.join(', ')));
      return ok;
    }
    function idle(o) { stopDemo(); if (convo.isIn('SPEAKING')) stopSpeaking(); if (!convo.isIn('IDLE')) convo.dispatch('reset'); avatar.idle(o == null ? { intensity: 1 } : o); lastAnimation = 'idle'; return true; }

    /* ---------- the demo: IDLE, look, LISTENING, THINKING, focused, SPEAKING, firm, IDLE ---------- */
    function stopDemo() { demoToken++; }
    function runDemo(text) {
      var d = ++demoToken, alive = function () { return d === demoToken && !destroyed; };
      function step(name) { emit('demostep', name); }
      stopSpeaking(); convo.dispatch('reset'); setExpression('neutral');
      return (async function () {
        step('IDLE'); avatar.lookAt('left'); await wait(1.4); if (!alive()) return { ok: false };
        step('LOOK'); avatar.lookAt('camera'); await wait(1.3); if (!alive()) return { ok: false };
        step('LISTENING'); userStartedSpeaking(); await wait(1.0); if (!alive()) return { ok: false }; playAnimation('nod'); await wait(1.8); if (!alive()) return { ok: false };
        step('THINKING'); userStoppedSpeaking(); await wait(0.7); if (!alive()) return { ok: false };
        step('FOCUSED'); setExpression('focused'); await wait(1.5); if (!alive()) return { ok: false };
        step('SPEAKING'); var r = await speak(text || DEMO_TEXT); if (!alive() || !r.ok) return { ok: false, speech: r };
        step('FIRM'); setExpression('firm'); await wait(1.8); if (!alive()) return { ok: false };
        step('IDLE'); convo.dispatch('reset'); step('DONE'); return { ok: true };
      })();
    }

    /* ---------- the 1.5 second presence test: neutral, looks to the camera, a subtle blink, holds the gaze ---------- */
    function runPresenceTest() {
      stopSpeaking(); if (!convo.isIn('IDLE')) convo.dispatch('reset'); setExpression('neutral'); var log = [{ t: 0, what: 'neutral' }];
      avatar.lookAt(0.32, -0.04);
      return new Promise(function (resolve) {
        later(0.5, function () { avatar.lookAt('camera'); log.push({ t: 0.5, what: 'looks toward camera' }); });
        later(1.0, function () { avatar.gesture('blink'); log.push({ t: 1.0, what: 'subtle blink' }); });
        later(1.5, function () { log.push({ t: 1.5, what: 'holds gaze' }); emit('presencetest', log); resolve(log); });
      });
    }

    /* ---------- introspection ---------- */
    function morphInfo() {
      var caps = avatar.capabilities() || {}, rep = avatar.getRigReport() || {}, inf = avatar.getModelInfo() || {};
      return { kind: inf.kind || null, grade: rep.grade || null, morphTargets: !!caps.morphTargets, visemes: !!caps.visemes, eyes: !!(caps.eyeBones || caps.eyeMorphs), jaw: !!caps.jaw, body: !!caps.body, animations: !!caps.animations,
        channels: rep.channels ? { resolved: rep.channels.resolved, total: rep.channels.total } : (caps.channels ? { resolved: caps.channels.length } : null), notes: rep.notes || [] };
    }
    function info() {
      var s = avatar.stats(), d = avatar.debug(), m = morphInfo();
      return { fps: s.fps, state: convo.state, target: convo.current(), expression: avatar.getExpression(), cognitive: avatar.getCognitiveState(), animation: lastAnimation, speaking: avatar.isSpeaking(), shot: avatar.getShot(),
        asset: { role: role, profiled: assetInfo.profiled, requested: assetInfo.requested, loaded: assetInfo.loaded, fallback: assetInfo.fallback, error: assetInfo.error, label: assetInfo.label }, rig: m, provider: provider.name, triangles: s.triangles, drawCalls: s.drawCalls, time: d.time };
    }

    /* An asset profile is DATA about one asset (material overrides, hidden meshes), never logic: { materials: { name: { color, map: null, roughness, metalness, envMapIntensity } }, hide: [mesh names] } */
    function applyProfile(p) {
      var m = avatar.model; if (!p || !m || !m.object3D) return 0; var n = 0;
      m.object3D.traverse(function (o) {
        if (p.hide && p.hide.indexOf(o.name) >= 0) { o.visible = false; n++; }
        [].concat(o.material || []).forEach(function (mat) { var c = p.materials && p.materials[mat.name]; if (!c || mat.__profiled) return; mat.__profiled = true; n++;
          if (c.type === 'lambert' && o.material === mat && root.THREE) { var nm = new root.THREE.MeshLambertMaterial({ color: c.color || '#000000', name: mat.name }); nm.__profiled = true; nm.side = mat.side; if (mat.normalMap && c.normal !== false) nm.normalMap = null; o.material = nm; n++; return; }
          if (c.color != null && mat.color) mat.color.set(c.color); if (c.map === null) mat.map = null; if (c.roughness != null) mat.roughness = c.roughness; if (c.metalness != null) mat.metalness = c.metalness;
          if (c.envMapIntensity != null) mat.envMapIntensity = c.envMapIntensity; if (c.emissive != null && mat.emissive) mat.emissive.set(c.emissive); mat.needsUpdate = true; });
      });
      return n;
    }
    var ready = avatar.ready.then(function (r) {
      if (asset.profile) assetInfo.profiled = applyProfile(asset.profile);
      assetInfo.loaded = (r.info && (r.info.name || r.info.kind)) || r.source; assetInfo.fallback = !!r.fallback || (r.source === 'procedural' && !!asset.url); assetInfo.error = r.error ? (r.error.code || 'ERROR') + ': ' + r.error.message : null;
      if (assetInfo.fallback && assetInfo.error) emit('warning', WA.AvatarError('ASSET_FALLBACK', 'The asset could not be used (' + assetInfo.error + '); showing the built-in placeholder'));
      applyPresence('IDLE'); emit('ready', info()); return info();
    });

    var api = {
      ready: ready, version: WA.VERSION, role: role,
      /* conversation */
      setState: setState, getState: function () { return convo.state; }, getTargetState: function () { return convo.current(); }, states: WA.ConversationState.STATES.slice(), stateHistory: function () { return convo.history.slice(); },
      userStartedSpeaking: userStartedSpeaking, userStoppedSpeaking: userStoppedSpeaking, interrupt: interrupt,
      /* the character */
      setExpression: setExpression, getExpression: function () { return avatar.getExpression(); }, expressions: Object.keys(EXPRESSIONS),
      speak: speak, stopSpeaking: stopSpeaking, isSpeaking: function () { return avatar.isSpeaking(); },
      setViseme: setViseme, visemes: Object.keys(VISEMES), setLevel: function (v) { avatar.setLevel(v); },
      lookAt: function (x, y) { return avatar.lookAt(x, y); }, setShot: function (n, o) { return avatar.setShot(n, o); }, getShot: function () { return avatar.getShot(); }, shots: ['CLOSE', 'MEDIUM_CLOSE', 'MEDIUM', 'FULL'],
      playAnimation: playAnimation, animations: ANIMATIONS.slice(), idle: idle,
      /* demo and tools */
      runDemo: runDemo, stopDemo: stopDemo, demoText: DEMO_TEXT, runPresenceTest: runPresenceTest,
      info: info, contract: function () { return CONTRACT; }, rigInfo: morphInfo, stats: function () { return avatar.stats(); },
      setSpeechProvider: function (p, o) { provider = WA.createSpeechProvider(p, o); return provider.name; }, speechProvider: function () { return provider.name; },
      on: function (n, f) { (handlers[n] = handlers[n] || []).push(f); return f; }, off: function (n, f) { handlers[n] = (handlers[n] || []).filter(function (x) { return x !== f; }); },
      advance: function (s, nr) { avatar.advance(s, nr); }, pause: function () { avatar.pause(); }, resume: function () { avatar.resume(); },
      capture: function (t) { return avatar.capture(t); }, avatar: avatar,
      destroy: function () { destroyed = true; token++; demoToken++; try { provider.stop(); } catch (e) {} avatar.destroy(); }
    };
    return api;
  }

  WA.createExecutiveAvatar = createExecutiveAvatar;
  WA.ExecutiveContract = { EXPRESSIONS: EXPRESSIONS, VISEMES: VISEMES, ANIMATIONS: ANIMATIONS, PRESENCE: PRESENCE, CONTRACT: CONTRACT, DEMO_TEXT: DEMO_TEXT };
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== validate/AssetValidator.js ===== */
/*
 * AssetValidator: decides whether a GLB is fit to be the executive character.
 *
 * Three layers, kept apart on purpose:
 *   inspect(model)            measures the file: rig, blendshapes, visemes, eyes, mouth, materials, geometry, animation, delivery
 *   runExpressionTest / runLipSyncTest / measureFps
 *                             drive the real pipeline and measure what the face actually does (vertex displacement of the morph targets)
 *   evaluate(report, opts)    turns the measurements into an Asset Acceptance Score (0-100), hard gates and a verdict
 *
 * What code can and cannot judge:
 *   code judges structure and behaviour: names, counts, symmetry, dead or exploding targets, distinct visemes, pivots, budgets;
 *   it cannot judge whether a face is beautiful or looks like a premium digital executive. That part of the score
 *   (54 of 100 is automatic; 46 needs a person) comes from a visual rubric a human fills in, and the verdict stays
 *   PENDENTE until it is filled. An asset can never be accepted by the automatic part alone.
 *
 * Displacements are expressed in head heights (1.0 = the full height of the head), so they do not depend on model scale.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, C = WA.Channels, clamp = WA.clamp;

  /* ---------- score definition ---------- */
  // weight = points in the 100; auto = share of those points that code can award (the rest is the human rubric)
  var CATEGORIES = [
    { id: 'facial', label: 'Facial Quality', weight: 25, auto: 0 },
    { id: 'eyes', label: 'Eyes', weight: 15, auto: 8 / 15 },
    { id: 'materials', label: 'Materials', weight: 10, auto: 6 / 10 },
    { id: 'hair', label: 'Hair', weight: 10, auto: 3 / 10 },
    { id: 'rig', label: 'Facial Rig', weight: 15, auto: 1 },
    { id: 'lipsync', label: 'Lip Sync', weight: 10, auto: 7 / 10 },
    { id: 'anim', label: 'Animation Readiness', weight: 5, auto: 1 },
    { id: 'perf', label: 'Performance', weight: 5, auto: 1 },
    { id: 'web', label: 'Web Delivery', weight: 5, auto: 1 }
  ];
  var PHASES = {
    head: { label: 'Fase 1: cabeça', fileMB: 6, fileHardMB: 8, tris: 45000, drawCalls: 8, texMB: 40, skinned: 4 },
    full: { label: 'Personagem completo', fileMB: 12, fileHardMB: 15, tris: 75000, drawCalls: 12, texMB: 64, skinned: 6 }
  };
  // human rubric: each item 0-5. `cat` is the category it feeds.
  var RUBRIC = [
    { id: 'f_proportions', cat: 'facial', label: 'Proporções humanas, mandíbula, queixo, maçãs e nariz elegantes' },
    { id: 'f_skin', cat: 'facial', label: 'Pele: poros, variação de cor, brilho que varia por zona, sem aparência de plástico' },
    { id: 'f_mouth', cat: 'facial', label: 'Lábios com volume, dentes, língua e interior da boca convincentes' },
    { id: 'f_asym', cat: 'facial', label: 'Pequenas assimetrias e imperfeições que a tornam humana' },
    { id: 'f_expr', cat: 'facial', label: 'Microexpressões legíveis: listening, thinking, firm, skeptical, empathetic' },
    { id: 'f_presence', cat: 'facial', label: 'Autoridade, inteligência e serenidade: a pessoa mais atenta da sala' },
    { id: 'e_depth', cat: 'eyes', label: 'Íris, esclera, córnea e brilho (catchlight) com profundidade' },
    { id: 'e_alive', cat: 'eyes', label: 'Olhar vivo: micro-sacadas, pálpebras acompanham, sem olhar fixo de boneca' },
    { id: 'e_states', cat: 'eyes', label: 'O olhar comunica os estados (ouvindo, analisando, firme, empatia, confiança), sem olhos arregalados' },
    { id: 'm_skin', cat: 'materials', label: 'Pele sob os três estilos de luz (conversation, executive, intimate)' },
    { id: 'm_other', cat: 'materials', label: 'Reflexo/refração do olho, tecido do vestido, sem brilho exagerado' },
    { id: 'h_hair', cat: 'hair', label: 'Parece cabelo: volume, variação, sem fitas plásticas nem capacete' },
    { id: 'l_sync', cat: 'lipsync', label: 'Lip sync: fechamentos em p/b/m, f/v, dentes e língua visíveis; não é só abrir e fechar' }
  ];
  var MANUAL_GATES = { facialMin: 3.5, itemMin: 2 };

  /* ---------- helpers ---------- */
  function kindOf(name, matName) {
    var s = (name + ' ' + (matName || '')).toLowerCase();
    if (/cornea|tearline|tear_|lacrim|wetness|eyewet/.test(s)) return 'cornea';
    if (/eyelash|lash/.test(s)) return 'lash';
    if (/eyebrow|brow/.test(s)) return 'brow';
    if (/eye|iris|sclera|pupil/.test(s)) return 'eye';
    if (/teeth|tooth|gum|dent/.test(s)) return 'teeth';
    if (/tongue|lingua/.test(s)) return 'tongue';
    if (/mouth|inner|cavity|oral/.test(s)) return 'mouth';
    if (/hair|scalp|ponytail|bun/.test(s)) return 'hair';
    if (/dress|cloth|garment|shirt|jacket|suit|fabric|vestido|roupa|collar/.test(s)) return 'cloth';
    if (/shoe|boot|heel|sapato/.test(s)) return 'shoe';
    if (/head|face|skin|body|neck|torso|rosto|pele|arm|leg|hand/.test(s)) return 'skin';
    return 'other';
  }
  function attrXYZ(attr, i, out) {
    if (attr.isInterleavedBufferAttribute || attr.normalized || !(attr.array instanceof Float32Array)) { out[0] = attr.getX(i); out[1] = attr.getY(i); out[2] = attr.getZ(i); }
    else { out[0] = attr.array[i * 3]; out[1] = attr.array[i * 3 + 1]; out[2] = attr.array[i * 3 + 2]; }
  }
  function toArray(attr) {
    var n = attr.count, a = new Float32Array(n * 3), t = [0, 0, 0];
    if (!attr.isInterleavedBufferAttribute && !attr.normalized && attr.array instanceof Float32Array && attr.itemSize === 3) return attr.array;
    for (var i = 0; i < n; i++) { attrXYZ(attr, i, t); a[i * 3] = t[0]; a[i * 3 + 1] = t[1]; a[i * 3 + 2] = t[2]; }
    return a;
  }
  /* relative deltas of morph target i, as a Float32Array (n*3), in mesh space */
  function deltaOf(mesh, i, cache) {
    var key = mesh.uuid + ':' + i; if (cache && cache[key]) return cache[key];
    var g = mesh.geometry, mp = g.morphAttributes.position[i], d = toArray(mp);
    if (!g.morphTargetsRelative) { var base = toArray(g.attributes.position), r = new Float32Array(d.length); for (var k = 0; k < d.length; k++) r[k] = d[k] - base[k]; d = r; }
    if (cache) cache[key] = d; return d;
  }
  function worldScale(mesh) { var e = mesh.matrixWorld.elements; return Math.hypot(e[0], e[1], e[2]) || 1; }
  function stats(d, n) { var s = 0, mx = 0; for (var i = 0; i < n; i++) { var m = d[i * 3] * d[i * 3] + d[i * 3 + 1] * d[i * 3 + 1] + d[i * 3 + 2] * d[i * 3 + 2]; s += m; if (m > mx) mx = m; } return { rms: Math.sqrt(s / n), max: Math.sqrt(mx) }; }
  function dot(a, b) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
  function norm(a) { return Math.sqrt(dot(a, a)); }

  /* ---------- inspection ---------- */
  function inspect(model, opts) {
    opts = opts || {};
    if (!model || !model.res || !model.meshes) throw WA.AvatarError('NOT_A_GLB', 'AssetValidator needs a loaded GLBAvatar (load a GLB first)');
    var T = root.THREE, rep = model.res.report, lm = model.landmarks, h = lm.headHeight, json = model.json || {};
    var ext = json.extensionsUsed || [], r = { phase: opts.phase || 'full', headHeight: h, rig: rep, landmarks: lm };
    var cache = {};

    /* geometry */
    var meshes = [], tris = 0, skinned = 0, drawCalls = 0;
    model.object3D.updateMatrixWorld(true);
    model.meshes.forEach(function (m) {
      var g = m.geometry, mats = Array.isArray(m.material) ? m.material : [m.material], n = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
      var kind = kindOf(m.name, mats[0] && mats[0].name);
      meshes.push({ name: m.name, kind: kind, tris: Math.round(n), vertices: g.attributes.position.count, morphs: (g.morphAttributes.position || []).length, skinned: !!m.isSkinnedMesh, materials: mats.map(function (x) { return x && x.name; }), mesh: m });
      tris += n; if (m.isSkinnedMesh) skinned++; drawCalls += Math.max(1, g.groups && g.groups.length || mats.length);
    });
    var byKind = {}; meshes.forEach(function (m) { byKind[m.kind] = (byKind[m.kind] || 0) + m.tris; });
    var lods = []; model.scene.traverse(function (n) { if (/(^|[^a-z])lod[_ ]?\d/i.test(n.name || '')) lods.push(n.name); });
    r.geometry = { tris: Math.round(tris), byKind: byKind, meshes: meshes.map(function (m) { return { name: m.name, kind: m.kind, tris: m.tris, vertices: m.vertices, morphs: m.morphs, skinned: m.skinned, materials: m.materials }; }), skinned: skinned, drawCalls: drawCalls, lods: lods };

    /* blendshapes: per canonical channel, the displacement it produces, on every mesh that carries it */
    var morphMeshes = meshes.filter(function (m) { return m.morphs > 0; });
    var primary = morphMeshes.slice().sort(function (a, b) { return b.morphs * 1e6 + b.vertices - (a.morphs * 1e6 + a.vertices); })[0];
    var perChannel = {}, carried = {};
    function chanStats(names, kindsOut) {
      var best = null;
      names.forEach(function (nm) {
        morphMeshes.forEach(function (mm) {
          var idx = mm.mesh.morphTargetDictionary && mm.mesh.morphTargetDictionary[nm]; if (idx === undefined) return;
          kindsOut[mm.kind] = true;
          var d = deltaOf(mm.mesh, idx, cache), s = stats(d, mm.vertices), k = worldScale(mm.mesh) / h;
          var cur = { rms: s.rms * k, max: s.max * k, mesh: mm.name };
          if (!best || cur.rms > best.rms) best = cur;
        });
      });
      return best;
    }
    var found = Object.keys(model.res.morphs);
    found.forEach(function (ch) { var k = {}, s = chanStats(model.res.morphs[ch], k); perChannel[ch] = { rms: s ? s.rms : 0, max: s ? s.max : 0, carriedBy: Object.keys(k) }; });
    var dead = found.filter(function (ch) { return perChannel[ch].rms < 3e-5; });
    var outliers = found.filter(function (ch) { return perChannel[ch].max > 0.2; });
    var pairs = [];
    C.ARKIT.forEach(function (ch) { if (/Left$/.test(ch)) { var R = ch.replace(/Left$/, 'Right'); if (perChannel[ch] && perChannel[R]) { var a = perChannel[ch].rms, b = perChannel[R].rms, hi = Math.max(a, b); if (hi > 3e-5) pairs.push({ left: ch, right: R, ratio: +(Math.min(a, b) / hi).toFixed(3) }); } } });
    var asymBad = pairs.filter(function (p) { return p.ratio < 0.55; }), asymPerfect = pairs.filter(function (p) { return p.ratio > 0.9995; });
    r.blendshapes = { found: found.length, arkitFound: rep.found.length, coverage: rep.coverage, missing: rep.missing, essentialMissing: rep.essentialMissing, dead: dead, outliers: outliers, pairs: pairs, asymmetricBroken: asymBad.map(function (p) { return p.left; }),
      perfectMirror: asymPerfect.length, perChannel: perChannel, unmatched: rep.unmatchedMorphs, jawClench: !!perChannel.jawClench };

    /* visemes */
    var vis = {}, vFields = {}, vcarried = {};
    if (primary) {
      C.VISEMES.forEach(function (v) {
        var names = model.res.visemes[v]; if (!names) return; var k = {}, s = chanStats(names, k); vis[v] = { rms: s ? s.rms : 0, carriedBy: Object.keys(k) };
        vcarried[v] = k;
        var idx = primary.mesh.morphTargetDictionary[names[0]]; if (idx !== undefined) vFields[v] = deltaOf(primary.mesh, idx, cache);
      });
    }
    var dup = [], names = Object.keys(vFields).filter(function (v) { return v !== 'viseme_sil'; });
    for (var i = 0; i < names.length; i++) for (var j = i + 1; j < names.length; j++) {
      var a = vFields[names[i]], b = vFields[names[j]], na = norm(a), nb = norm(b); if (na < 1e-9 || nb < 1e-9) continue;
      var cos = dot(a, b) / (na * nb), ratio = Math.min(na, nb) / Math.max(na, nb); if (cos > 0.97 && ratio > 0.8) dup.push([names[i], names[j], +cos.toFixed(3)]);
    }
    var inDup = {}; dup.forEach(function (p) { inDup[p[0]] = inDup[p[1]] = 1; });
    var tongue = meshes.filter(function (m) { return m.kind === 'tongue'; }), teeth = meshes.filter(function (m) { return m.kind === 'teeth'; });
    function carries(ms, list) { var n = 0; ms.forEach(function (m) { var d = m.mesh.morphTargetDictionary || {}; list.forEach(function (c) { var nm = (model.res.morphs[c] || model.res.visemes[c] || [])[0]; if (nm && d[nm] !== undefined) n++; }); }); return n; }
    var tongueV = ['viseme_TH', 'viseme_DD', 'viseme_nn', 'viseme_RR', 'viseme_kk', 'tongueOut'], teethV = ['jawOpen', 'viseme_aa', 'viseme_PP', 'viseme_FF', 'viseme_O'];
    r.visemes = { native: rep.visemesNative, found: Object.keys(vis).length, missing: C.VISEMES.filter(function (v) { return !vis[v]; }), perViseme: vis,
      distinct: names.length - Object.keys(inDup).length + (vis.viseme_sil ? 1 : 0), duplicates: dup, silentSil: !vis.viseme_sil || vis.viseme_sil.rms < 5e-4,
      tongueCarries: carries(tongue, tongueV), teethCarries: carries(teeth, teethV), tongueMeshes: tongue.length, teethMeshes: teeth.length };

    /* eyes */
    var bones = model.bones, eyeMeshes = meshes.filter(function (m) { return m.kind === 'eye'; }), corneaMeshes = meshes.filter(function (m) { return m.kind === 'cornea'; });
    var pivot = []; ['leftEye', 'rightEye'].forEach(function (s) {
      var b = bones[s]; if (!b || !T) return; var bp = new T.Vector3(); b.obj.getWorldPosition(bp);
      var best = null; eyeMeshes.forEach(function (m) { var bb = new T.Box3().setFromObject(m.mesh), c = bb.getCenter(new T.Vector3()), size = bb.getSize(new T.Vector3()), rad = Math.max(size.x, size.y, size.z) / 2, dist = c.distanceTo(bp); if (!best || dist < best.dist) best = { dist: dist, rad: rad, off: dist / Math.max(rad, 1e-6) }; });
      if (best) pivot.push({ slot: s, offsetRatio: +best.off.toFixed(2), eyeRadiusHeads: +(best.rad / h).toFixed(3) });
    });
    var lookCh = ['eyeLookUpLeft', 'eyeLookDownLeft', 'eyeLookInLeft', 'eyeLookOutLeft', 'eyeLookUpRight', 'eyeLookDownRight', 'eyeLookInRight', 'eyeLookOutRight'];
    var transmissive = model.materialList.some(function (m) { return m.transmission > 0 || m.clearcoat > 0 || m.ior > 1.2; });
    r.eyes = { bones: { left: !!bones.leftEye, right: !!bones.rightEye }, mode: model.eyeMode, eyeMeshes: eyeMeshes.length, corneaMeshes: corneaMeshes.length, pivot: pivot, lookMorphs: lookCh.filter(function (c) { return perChannel[c] && perChannel[c].rms >= 3e-5; }).length,
      blinkIndependent: !!(perChannel.eyeBlinkLeft && perChannel.eyeBlinkRight), reflective: transmissive, eyeTris: eyeMeshes.reduce(function (a, m) { return a + m.tris; }, 0) };

    /* mouth */
    r.mouth = { jawMode: model.jawMode, jawMorph: !!perChannel.jawOpen && perChannel.jawOpen.rms >= 3e-5, teeth: teeth.length, tongue: tongue.length, inner: meshes.filter(function (m) { return m.kind === 'mouth'; }).length, tongueOut: !!perChannel.tongueOut,
      mouthChannels: ['mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthRollLower', 'mouthRollUpper', 'mouthPressLeft', 'mouthPressRight'].filter(function (c) { return perChannel[c]; }).length };

    /* materials and textures */
    var skinMesh = meshes.filter(function (m) { return m.kind === 'skin'; }).sort(function (a, b) { return b.tris - a.tris; })[0];
    var skinMatName = skinMesh && skinMesh.materials[0];
    var mats = model.materialList.map(function (m) {
      var maps = {}; ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap', 'clearcoatMap', 'sheenColorMap'].forEach(function (k) { if (m[k]) maps[k] = true; });
      return { name: m.name, type: m.type, maps: maps, roughness: m.roughness, metalness: m.metalness, clearcoat: m.clearcoat || 0, sheen: m.sheen || 0, transmission: m.transmission || 0, transparent: !!m.transparent, alphaTest: m.alphaTest || 0,
        alphaToCoverage: !!m.alphaToCoverage, doubleSided: m.side === T.DoubleSide, unlit: m.type === 'MeshBasicMaterial', isSkin: m.name === skinMatName };
    });
    var texList = model.textureList.map(function (t) { var im = t.image || {}; return { w: im.width || (t.mipmaps && t.mipmaps[0] && t.mipmaps[0].width) || 0, h: im.height || (t.mipmaps && t.mipmaps[0] && t.mipmaps[0].height) || 0, compressed: !!t.isCompressedTexture }; });
    var texBytes = 0; texList.forEach(function (t) { texBytes += t.w * t.h * (t.compressed ? 1 : 4) * 1.33; });
    var maxTex = texList.reduce(function (a, t) { return Math.max(a, t.w, t.h); }, 0);
    r.materials = { count: mats.length, list: mats, textures: texList.length, textureList: texList, textureMB: +(texBytes / 1048576).toFixed(1), maxTexture: maxTex, skinMaterial: mats.filter(function (m) { return m.isSkin; })[0] || null,
      hairMaterial: mats.filter(function (m) { return meshes.some(function (x) { return x.kind === 'hair' && x.materials.indexOf(m.name) >= 0; }); })[0] || null, anySheen: mats.some(function (m) { return m.sheen > 0; }), anyUnlit: mats.some(function (m) { return m.unlit; }),
      sssNote: 'glTF não tem espalhamento subsuperficial padrão: avaliado por proxy (mapas de albedo, normal e rugosidade/ORM na pele) e visualmente.' };
    var hair = meshes.filter(function (m) { return m.kind === 'hair'; });
    r.hair = { meshes: hair.length, tris: hair.reduce(function (a, m) { return a + m.tris; }, 0), brows: meshes.filter(function (m) { return m.kind === 'brow'; }).length, lashes: meshes.filter(function (m) { return m.kind === 'lash'; }).length };

    /* animation */
    var clips = (model.gltf.animations || []).map(function (a) {
      var morphTracks = a.tracks.filter(function (t) { return /morphTargetInfluences/.test(t.name); }).length, closed = true, bonesAnimated = {};
      a.tracks.forEach(function (t) { bonesAnimated[t.name.split('.')[0]] = 1; if (/quaternion/.test(t.name) && t.values.length >= 8) { var k = 4, f = t.values.slice(0, k), l = t.values.slice(t.values.length - k), dd = 0; for (var q = 0; q < k; q++) dd += Math.abs(f[q] - l[q]); if (dd > 0.01) closed = false; } });
      return { name: a.name, duration: +a.duration.toFixed(2), tracks: a.tracks.length, morphTracks: morphTracks, loopClosed: closed, bones: Object.keys(bonesAnimated).length };
    });
    var need = ['head', 'neck', 'leftEye', 'rightEye', 'jaw'], needFull = ['hips', 'spine', 'spine2', 'leftShoulder', 'rightShoulder'];
    r.animation = { clips: clips, idle: model.res.clips.idle || null, talk: model.res.clips.talk || null, headBonesMissing: need.filter(function (s) { return !bones[s]; }), bodyBonesMissing: needFull.filter(function (s) { return !bones[s] && !(s === 'spine2' && (bones.spine1 || bones.spine)); }), bones: Object.keys(bones).length };

    /* delivery */
    var ext2 = function (n) { return ext.indexOf(n) >= 0; }, external = [];
    (json.images || []).forEach(function (im) { if (im.uri && !/^data:/.test(im.uri)) external.push(im.uri); }); (json.buffers || []).forEach(function (b) { if (b.uri && !/^data:/.test(b.uri)) external.push(b.uri); });
    r.delivery = { fileMB: model.bytes ? +(model.bytes / 1048576).toFixed(2) : null, extensions: ext, meshopt: ext2('EXT_meshopt_compression'), draco: ext2('KHR_draco_mesh_compression'), ktx2: ext2('KHR_texture_basisu'), quantized: ext2('KHR_mesh_quantization'),
      external: external, loadMs: model.loadMs || null, generator: json.asset && json.asset.generator || null };
    r.perf = { tris: r.geometry.tris, drawCalls: drawCalls, skinned: skinned, morphMax: model.info ? model.info.morphTargetsMax : 0 };
    return r;
  }

  /* ---------- measurements that drive the live pipeline ---------- */
  function headMesh(model) {
    var best = null; model.meshes.forEach(function (m) { var n = (m.geometry.morphAttributes.position || []).length; if (n && (!best || n * 1e6 + m.geometry.attributes.position.count > best.k)) best = { m: m, k: n * 1e6 + m.geometry.attributes.position.count }; });
    return best && best.m;
  }
  /* displacement field (head heights) produced by the CURRENT influences of the head mesh, plus metrics */
  function currentField(model, cache) {
    var m = headMesh(model); if (!m) return null;
    var g = m.geometry, n = g.attributes.position.count, inf = m.morphTargetInfluences, f = new Float32Array(n * 3), mp = g.morphAttributes.position;
    for (var i = 0; i < mp.length; i++) { var w = inf[i]; if (!(Math.abs(w) > 1e-4)) continue; var d = deltaOf(m, i, cache); for (var k = 0; k < f.length; k++) f[k] += w * d[k]; }
    return { field: f, mesh: m };
  }
  function fieldMetrics(model, fm) {
    var m = fm.mesh, f = fm.field, h = model.landmarks.headHeight, lm = model.landmarks, sc = worldScale(m) / h, n = f.length / 3, pos = m.geometry.attributes.position, e = m.matrixWorld.elements, t = [0, 0, 0];
    var z = { upper: [0, 0], mid: [0, 0], lower: [0, 0] }, sides = { L: [0, 0], R: [0, 0] }, all = 0, mx = 0, cnt = 0;
    for (var i = 0; i < n; i++) {
      attrXYZ(pos, i, t); var wy = e[1] * t[0] + e[5] * t[1] + e[9] * t[2] + e[13], wx = e[0] * t[0] + e[4] * t[1] + e[8] * t[2] + e[12];
      if (wy < lm.chinY - 0.3 * h || wy > lm.headTopY + 0.15 * h) continue;
      var d2 = (f[i * 3] * f[i * 3] + f[i * 3 + 1] * f[i * 3 + 1] + f[i * 3 + 2] * f[i * 3 + 2]) * sc * sc; cnt++; all += d2; if (d2 > mx) mx = d2;
      var zk = wy < lm.chinY + 0.42 * h ? 'lower' : wy < lm.eyeY - 0.08 * h ? 'mid' : 'upper'; z[zk][0] += d2; z[zk][1]++;
      var sk = wx > 0 ? 'L' : 'R'; sides[sk][0] += d2; sides[sk][1]++;
    }
    function rms(a) { return a[1] ? Math.sqrt(a[0] / a[1]) : 0; }
    var l = rms(sides.L), r = rms(sides.R);
    return { rms: cnt ? Math.sqrt(all / cnt) : 0, max: Math.sqrt(mx), upper: rms(z.upper), mid: rms(z.mid), lower: rms(z.lower), left: l, right: r, asym: Math.max(l, r) > 1e-9 ? Math.abs(l - r) / Math.max(l, r) : 0 };
  }
  function distance(a, b) { var s = 0; for (var i = 0; i < a.length; i++) { var d = a[i] - b[i]; s += d * d; } return Math.sqrt(s / (a.length / 3)); }

  var EMOTIONS = ['neutral', 'listening', 'thinking', 'analyzing', 'confident', 'firm', 'skeptical', 'empathetic', 'surprised', 'concerned', 'decisive'];
  var EXPR_LIMITS = { dead: 0.0003, exploding: 0.14 };

  function runExpressionTest(avatar) {
    var model = avatar.model, cache = {}, rows = [], fields = {}, h = model.landmarks.headHeight, sc = null, bad = 0;
    var prev = avatar.getExpression(), prevCog = avatar.getCognitiveState();
    avatar.lookAt('camera');
    EMOTIONS.forEach(function (n) {
      avatar.setExpression(n); avatar.advance(3.5);
      var fm = currentField(model, cache); if (!fm) return; var met = fieldMetrics(model, fm); sc = sc || worldScale(fm.mesh) / h; fields[n] = fm.field;
      var nan = 0; for (var i = 0; i < fm.field.length; i += 7) if (!isFinite(fm.field[i])) nan++;
      if (nan) bad++;
      rows.push({ name: n, rms: +met.rms.toFixed(5), max: +met.max.toFixed(4), upper: +met.upper.toFixed(5), mid: +met.mid.toFixed(5), lower: +met.lower.toFixed(5), asym: +met.asym.toFixed(2), nan: nan });
    });
    // nearest neighbour of every emotion (distinctness)
    var neutral = fields.neutral;
    rows.forEach(function (r) {
      var nearest = null; Object.keys(fields).forEach(function (o) { if (o === r.name) return; var d = distance(fields[r.name], fields[o]) * sc; if (!nearest || d < nearest.d) nearest = { to: o, d: d }; });
      r.nearest = nearest ? nearest.to : null; r.nearestDist = nearest ? +nearest.d.toFixed(5) : null;
      r.fromNeutral = neutral ? +(distance(fields[r.name], neutral) * sc).toFixed(5) : null;
      r.dead = r.name !== 'neutral' && r.fromNeutral < EXPR_LIMITS.dead; r.exploding = r.max > EXPR_LIMITS.exploding;
    });
    var cogRows = [];
    ['LISTENING', 'PROCESSING', 'THINKING', 'SPEAKING', 'DECIDING', 'WARNING', 'EMPATHY', 'CHALLENGE', 'CONFIDENCE'].forEach(function (n) {
      avatar.setCognitiveState(n); avatar.advance(3.5); var fm = currentField(model, cache); if (!fm) return; var met = fieldMetrics(model, fm); cogRows.push({ name: n, rms: +met.rms.toFixed(5), max: +met.max.toFixed(4), asym: +met.asym.toFixed(2) });
    });
    if (prevCog) avatar.setCognitiveState(prevCog); avatar.setExpression(prev);
    var alive = rows.filter(function (r) { return r.name === 'neutral' || (!r.dead && !r.exploding); }).length;
    var sk = rows.filter(function (r) { return r.name === 'skeptical'; })[0];
    return { rows: rows, cognitive: cogRows, aliveFraction: rows.length ? alive / rows.length : 0, nan: bad, skepticalAsym: sk ? sk.asym : null,
      minDistinct: rows.reduce(function (a, r) { return r.nearestDist == null ? a : Math.min(a, r.nearestDist); }, 9), limits: EXPR_LIMITS };
  }

  function runLipSyncTest(avatar) {
    var model = avatar.model, cache = {}, rows = [], fields = {}, h = model.landmarks.headHeight, sc = null, lowerShare = [];
    avatar.stopSpeaking(); avatar.setExpression('neutral'); avatar.advance(2);
    C.VISEMES.forEach(function (v) {
      avatar.setViseme(v, 1); avatar.advance(0.6);
      var fm = currentField(model, cache); if (!fm) return; var met = fieldMetrics(model, fm); sc = sc || worldScale(fm.mesh) / h; fields[v] = fm.field;
      rows.push({ viseme: v, rms: +met.rms.toFixed(5), lower: +met.lower.toFixed(5), mid: +met.mid.toFixed(5), upper: +met.upper.toFixed(5) });
    });
    avatar.setViseme(null); avatar.advance(1);
    var names = Object.keys(fields).filter(function (v) { return v !== 'viseme_sil'; }), mind = 9, pair = null;
    for (var i = 0; i < names.length; i++) for (var j = i + 1; j < names.length; j++) { var d = distance(fields[names[i]], fields[names[j]]) * sc; if (d < mind) { mind = d; pair = names[i] + ' ~ ' + names[j]; } }
    rows.forEach(function (r) { var tot = r.lower + r.mid + r.upper; r.lowerShare = tot > 0 ? +(r.lower / tot).toFixed(2) : 0; if (r.viseme !== 'viseme_sil') lowerShare.push(r.lowerShare); });
    // timeline run through the whole pipeline: the mouth must open and close, not stay open
    var seq = [], t = 0; ['PP', 'aa', 'FF', 'O', 'nn', 'E', 'PP', 'U', 'SS', 'aa'].forEach(function (v) { seq.push({ t: t, d: 0.16, v: v }); t += 0.22; });
    avatar.speak(null, { visemes: seq }).catch(function () {}); var series = [];
    for (var k = 0; k < 90; k++) { avatar.advance(1 / 30); var f2 = currentField(model, cache); if (f2) series.push(fieldMetrics(model, f2).lower); }
    avatar.stopSpeaking(); avatar.advance(1);
    var mx = Math.max.apply(null, series), mn = Math.min.apply(null, series.slice(5, 70)), swings = 0, up = false;
    series.forEach(function (x, i) { var hi = x > mx * 0.55; if (hi && !up) swings++; up = hi; });
    return { rows: rows, minDistinct: +mind.toFixed(5), closestPair: pair, distinctPairs: names.length, meanLowerShare: lowerShare.length ? +(lowerShare.reduce(function (a, b) { return a + b; }, 0) / lowerShare.length).toFixed(2) : 0,
      timeline: { openClose: swings, minOverMax: mx > 0 ? +(mn / mx).toFixed(2) : 1, peak: +mx.toFixed(5) }, nativeVisemes: avatar.capabilities().visemes };
  }

  function gpuInfo() {
    try {
      var c = document.createElement('canvas'), gl = c.getContext('webgl'), ext = gl && gl.getExtension('WEBGL_debug_renderer_info'), name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
      return { renderer: name, software: /swiftshader|llvmpipe|software|softpipe|basic render/i.test(name) };
    } catch (e) { return { renderer: 'unknown', software: true }; }
  }
  function measureFps(avatar, seconds) {
    var g = gpuInfo(); seconds = seconds || 3;
    return new Promise(function (resolve) {
      avatar.resume(); var t0 = performance.now(), n = 0, id;
      (function tick() { n++; if (performance.now() - t0 < seconds * 1000) id = requestAnimationFrame(tick); else { var ms = (performance.now() - t0) / n; resolve({ fps: +(1000 / ms).toFixed(1), frameMs: +ms.toFixed(1), renderer: g.renderer, software: g.software, stepMs: avatar.stats().stepMs, modelUpdateMs: avatar.stats().modelUpdateMs }); } })();
    });
  }

  /* ---------- evaluation ---------- */
  function lin(x, lo, hi) { return clamp((x - lo) / (hi - lo), 0, 1); }
  function inv(x, ok, bad) { return 1 - lin(x, ok, bad); }

  /* each check returns { s: 0..1 | null (not measured), d: detail }. gate: failing it rejects the asset outright. */
  function buildChecks(r, o) {
    var P = PHASES[o.phase] || PHASES.full, full = o.phase !== 'head', X = r.expressionTest, L = r.lipTest, F = r.fps, ch = r.blendshapes, V = r.visemes, E = r.eyes, M = r.mouth, MT = r.materials, A = r.animation, D = r.delivery, G = r.geometry;
    var skin = MT.skinMaterial, hairM = MT.hairMaterial, hairInfo = r.hair;
    var out = [];
    function add(id, cat, label, w, fn, gate) { var v = fn(); out.push({ id: id, cat: cat, label: label, w: w, s: v.s, d: v.d, gate: gate || null }); }
    var pf = function (ok, d) { return { s: ok ? 1 : 0, d: d || '' }; };

    /* eyes: 8 */
    add('eye_bones', 'eyes', 'Ossos dos dois olhos', 2, function () { var n = (E.bones.left ? 1 : 0) + (E.bones.right ? 1 : 0); return { s: n / 2, d: n + ' de 2 ossos; modo ' + E.mode }; });
    add('eye_pivot', 'eyes', 'Pivô do olho no centro do globo (≤ 0,25 do raio)', 1.5, function () { if (!E.pivot.length) return { s: E.eyeMeshes ? 0 : 0, d: E.eyeMeshes ? 'sem ossos para medir' : 'sem malhas de olho identificadas' }; var worst = Math.max.apply(null, E.pivot.map(function (p) { return p.offsetRatio; })); return { s: inv(worst, 0.25, 0.9), d: 'desvio máximo ' + worst + ' raios' }; });
    add('eye_meshes', 'eyes', 'Globos oculares como malhas separadas (≥ 2)', 1, function () { return { s: lin(E.eyeMeshes, 0, 2), d: E.eyeMeshes + ' malha(s)' }; });
    add('eye_cornea', 'eyes', 'Córnea/reflexo (malha de córnea ou material com clearcoat/transmissão)', 1.5, function () { return { s: E.corneaMeshes > 0 ? 1 : E.reflective ? 0.7 : 0, d: E.corneaMeshes + ' córnea(s); material reflexivo: ' + (E.reflective ? 'sim' : 'não') }; });
    add('eye_look', 'eyes', 'Morphs eyeLook (8) para as pálpebras acompanharem o olhar', 1.5, function () { return { s: E.lookMorphs / 8, d: E.lookMorphs + ' de 8' }; });
    add('eye_blink', 'eyes', 'Piscada independente esquerda/direita', 0.5, function () { return pf(E.blinkIndependent); });

    /* materials: 6 */
    add('mat_albedo', 'materials', 'Pele com mapa de cor (albedo)', 1, function () { return pf(skin && skin.maps.map, skin ? skin.name : 'sem material de pele identificado'); });
    add('mat_normal', 'materials', 'Pele com mapa de normal (microdetalhe)', 1.5, function () { return pf(skin && skin.maps.normalMap); });
    add('mat_rough', 'materials', 'Pele com rugosidade variável (mapa de rugosidade ou ORM)', 1.5, function () { return pf(skin && (skin.maps.roughnessMap || skin.maps.metalnessMap)); });
    add('mat_res', 'materials', 'Resolução da pele ≥ 1024 (rosto), ≤ 4096', 0.5, function () { return { s: MT.maxTexture ? (MT.maxTexture >= 1024 && MT.maxTexture <= 4096 ? 1 : MT.maxTexture > 4096 ? 0.4 : 0.3) : 0, d: 'maior textura ' + MT.maxTexture }; });
    add('mat_count', 'materials', 'No máximo 8 materiais', 0.5, function () { return { s: inv(MT.count, 8, 14), d: MT.count + ' materiais' }; });
    add('mat_unlit', 'materials', 'Sem materiais sem iluminação (unlit)', 0.5, function () { return pf(!MT.anyUnlit); });
    add('mat_sheen', 'materials', 'Tecido com sheen (vestido)', 0.5, function () { return { s: MT.anySheen ? 1 : 0, d: MT.anySheen ? 'sheen presente' : 'sem sheen' }; });
    // phase 1 has no dress: the sheen check does not apply
    if (!full) out[out.length - 1].s = null;

    /* hair: 3 */
    add('hair_mesh', 'hair', 'Malha de cabelo presente', 1.5, function () { return pf(hairInfo.meshes > 0, hairInfo.meshes + ' malha(s)'); });
    add('hair_tris', 'hair', 'Cabelo entre 3 mil e 25 mil triângulos', 0.75, function () { if (!hairInfo.meshes) return { s: 0, d: 'sem cabelo' }; var t = hairInfo.tris; return { s: t >= 3000 && t <= 25000 ? 1 : t > 25000 ? inv(t, 25000, 50000) : lin(t, 500, 3000), d: t + ' triângulos' }; });
    add('hair_alpha', 'hair', 'Transparência do cabelo tratada (alphaTest, blend ou alpha-to-coverage)', 0.75, function () { if (!hairM) return { s: 0, d: 'sem material de cabelo' }; return pf(hairM.alphaTest > 0 || hairM.transparent || hairM.alphaToCoverage || hairM.maps.alphaMap, 'alphaTest ' + hairM.alphaTest); });

    /* facial rig: 15 */
    add('rig_cov', 'rig', 'Cobertura dos 52 canais ARKit (≥ 98%)', 4.5, function () { return { s: lin(ch.coverage, 0.8, 0.98), d: Math.round(ch.coverage * 100) + '% (' + ch.arkitFound + '/52)' }; }, { id: 'rig_grade', label: 'Rig com cobertura full ou good', test: function () { return ['full', 'good'].indexOf(r.rig.grade) >= 0 && !ch.essentialMissing.length; } });
    add('rig_dead', 'rig', 'Nenhum blendshape morto (sem deslocamento)', 2, function () { return { s: inv(ch.dead.length, 0, 6), d: ch.dead.length ? ch.dead.slice(0, 8).join(', ') : 'nenhum' }; });
    add('rig_bound', 'rig', 'Deslocamentos dentro de limites (≤ 20% da altura da cabeça)', 1.5, function () { return { s: inv(ch.outliers.length, 0, 4), d: ch.outliers.length ? ch.outliers.join(', ') : 'ok' }; });
    add('rig_lr', 'rig', 'Pares esquerda/direita coerentes (razão ≥ 0,55) e assimetria autoral', 1.5, function () { var bad = ch.asymmetricBroken.length, mirror = ch.pairs.length ? ch.perfectMirror / ch.pairs.length : 0; return { s: inv(bad, 0, 5) * (mirror > 0.9 ? 0.6 : 1), d: bad + ' par(es) quebrado(s); ' + Math.round(mirror * 100) + '% idênticos (espelho mecânico)' }; });
    add('rig_teeth', 'rig', 'Dentes acompanham mandíbula/boca (morphs nos dentes)', 1.5, function () { return { s: M.teeth ? lin(V.teethCarries, 0, 3) : 0, d: M.teeth ? M.teeth + ' malha(s), ' + V.teethCarries + ' morph(s) compartilhados' : 'sem malha de dentes' }; });
    add('rig_tongue', 'rig', 'Língua com morphs (tongueOut e visemas de língua)', 1, function () { return { s: M.tongue ? lin(V.tongueCarries, 0, 3) : 0, d: M.tongue ? V.tongueCarries + ' morph(s) na língua' : 'sem malha de língua' }; });
    add('rig_jaw', 'rig', 'Mandíbula (morph jawOpen ou osso Jaw)', 1, function () { return { s: M.jawMorph ? 1 : M.jawMode === 'bone' ? 0.6 : 0, d: M.jawMorph ? 'morph' : M.jawMode }; }, { id: 'jaw', label: 'Mandíbula presente', test: function () { return M.jawMorph || M.jawMode === 'bone'; } });
    add('rig_clench', 'rig', 'Extensão jawClench (tensão da mandíbula para FIRM/DECISIVE)', 0.5, function () { return pf(ch.jawClench); });
    add('rig_comp', 'rig', 'Composição: as 11 emoções produzem rosto vivo e sem distorção', 1.5, function () { return X ? { s: X.aliveFraction * (X.nan ? 0 : 1), d: Math.round(X.aliveFraction * 100) + '% das emoções ok' } : { s: null, d: 'teste de expressões não executado' }; });
    add('rig_asym', 'rig', 'CÉTICA é assimétrica (≥ 0,12 entre os lados)', 0.5, function () { return X && X.skepticalAsym != null ? { s: lin(X.skepticalAsym, 0.03, 0.12), d: 'assimetria ' + X.skepticalAsym } : { s: null, d: 'não executado' }; });
    add('eye_gate', 'rig', 'Olhos rigados (osso ou morph)', 0, function () { return pf(E.bones.left || E.bones.right || E.lookMorphs >= 4); }, { id: 'eyes', label: 'Olhos com rig (ossos ou eyeLook)', test: function () { return (E.bones.left && E.bones.right) || E.lookMorphs >= 8; } });

    /* lip sync: 7 */
    add('vis_native', 'lipsync', '15 visemas nativos', 3, function () { return { s: V.found / 15, d: V.found + ' de 15' + (V.missing.length ? ' (faltam ' + V.missing.join(', ') + ')' : '') }; }, { id: 'visemes', label: 'Visemas nativos (≥ 13 de 15)', test: function () { return V.found >= 13; } });
    add('vis_distinct', 'lipsync', 'Visemas distintos entre si (sem cópias)', 1.5, function () { var rowsOk = L ? L.minDistinct : null; var dupSc = inv(V.duplicates.length, 0, 5); return { s: dupSc, d: V.duplicates.length ? V.duplicates.slice(0, 3).map(function (p) { return p.slice(0, 2).join('~'); }).join(', ') : 'distintos' + (L ? '; par mais próximo ' + L.closestPair : '') }; });
    add('vis_tt', 'lipsync', 'Língua e dentes participam dos visemas', 1, function () { var a = M.tongue ? lin(V.tongueCarries, 0, 4) : 0, b = M.teeth ? lin(V.teethCarries, 0, 4) : 0; return { s: (a + b) / 2, d: 'língua ' + V.tongueCarries + ', dentes ' + V.teethCarries }; });
    add('vis_run', 'lipsync', 'Fala completa: a boca abre e fecha, não fica aberta', 1.5, function () { if (!L) return { s: null, d: 'teste de lip sync não executado' }; var t = L.timeline; return { s: lin(t.openClose, 2, 5) * (t.minOverMax < 0.6 ? 1 : 0.5) * (L.meanLowerShare >= 0.55 ? 1 : 0.6), d: t.openClose + ' aberturas; mín/máx ' + t.minOverMax + '; ' + Math.round(L.meanLowerShare * 100) + '% do movimento na parte baixa do rosto' }; });

    /* animation readiness: 5 */
    add('an_idle', 'anim', 'Clipe idle (laço de 3 a 8 s, fechado)', 1.5, function () { var c = A.clips.filter(function (x) { return x.name === A.idle; })[0]; if (!c) return { s: 0, d: 'sem clipe idle' }; return { s: (c.duration >= 3 && c.duration <= 8 ? 0.6 : 0.2) + (c.loopClosed ? 0.4 : 0), d: c.name + ' ' + c.duration + ' s, laço ' + (c.loopClosed ? 'fechado' : 'aberto') }; });
    if (!full) out[out.length - 1].s = null;
    add('an_bones', 'anim', 'Ossos necessários (cabeça, pescoço, olhos, mandíbula' + (full ? ', coluna, ombros' : '') + ')', 2, function () { var miss = A.headBonesMissing.concat(full ? A.bodyBonesMissing : []); return { s: inv(miss.length, 0, 4), d: miss.length ? 'faltam ' + miss.join(', ') : 'completo' }; });
    add('an_nomorph', 'anim', 'Clipes só de ossos (sem trilhas de morph)', 1, function () { var n = A.clips.reduce(function (a, c) { return a + c.morphTracks; }, 0); return { s: n ? 0 : 1, d: n + ' trilhas de morph' }; });
    add('an_clips', 'anim', 'Clipes extras (Talk, ListenNod): opcional', 0.5, function () { return { s: A.clips.length >= 2 ? 1 : 0.5, d: A.clips.length + ' clipe(s)' }; });

    /* performance: 5 */
    add('pf_tris', 'perf', 'Triângulos dentro do orçamento (' + P.tris.toLocaleString('pt-BR') + ')', 2, function () { return { s: inv(G.tris, P.tris, P.tris * 1.6), d: G.tris.toLocaleString('pt-BR') + ' triângulos' }; });
    add('pf_calls', 'perf', 'Draw calls ≤ ' + P.drawCalls, 1, function () { return { s: inv(G.drawCalls, P.drawCalls, P.drawCalls * 2), d: G.drawCalls + ' draw calls' }; });
    add('pf_skin', 'perf', 'Malhas com skin ≤ ' + P.skinned, 0.5, function () { return { s: inv(G.skinned, P.skinned, P.skinned * 2), d: G.skinned + ' malhas' }; });
    add('pf_fps', 'perf', 'FPS ≥ 55 em GPU real', 1.5, function () { if (!F) return { s: null, d: 'não medido' }; if (F.software) return { s: null, d: 'renderização por software (' + F.renderer + '): FPS não é válido' }; return { s: lin(F.fps, 30, 55), d: F.fps + ' fps em ' + F.renderer }; });

    /* web delivery: 5 */
    add('web_size', 'web', 'Arquivo ≤ ' + P.fileMB + ' MB', 2, function () { var mb = D.fileMB; if (mb == null) return { s: null, d: 'tamanho desconhecido (carregar por arquivo)' }; return { s: inv(mb, P.fileMB, P.fileHardMB), d: mb + ' MB' }; }, { id: 'size', label: 'Arquivo ≤ ' + P.fileHardMB + ' MB (limite duro)', test: function () { return D.fileMB == null || D.fileMB <= P.fileHardMB; } });
    add('web_geo', 'web', 'Geometria comprimida (meshopt ou Draco)', 1, function () { return { s: D.meshopt ? 1 : D.draco ? 0.7 : 0, d: D.meshopt ? 'meshopt' : D.draco ? 'Draco (não comprime bem morph targets)' : 'sem compressão' }; });
    add('web_ktx', 'web', 'Texturas KTX2 (Basis)', 1, function () { return { s: D.ktx2 ? 1 : MT.textures ? 0 : null, d: D.ktx2 ? 'KTX2' : MT.textures ? 'PNG/JPEG' : 'sem texturas' }; });
    add('web_tex', 'web', 'Memória de textura ≤ ' + P.texMB + ' MB', 0.5, function () { return { s: inv(MT.textureMB, P.texMB, P.texMB * 1.6), d: MT.textureMB + ' MB' }; });
    add('web_ext', 'web', 'Sem recursos externos (tudo dentro do .glb)', 0.5, function () { return { s: D.external.length ? 0 : 1, d: D.external.length ? D.external.slice(0, 3).join(', ') : 'ok' }; }, { id: 'external', label: 'Sem URIs externas', test: function () { return !D.external.length; } });
    return out;
  }

  function evaluate(report, opts) {
    opts = opts || {}; var manual = opts.manual || {}, phase = opts.phase || 'full', checks = buildChecks(report, { phase: phase });
    var gates = [{ id: 'valid', label: 'GLB válido e carregado', ok: true }];
    checks.forEach(function (c) { if (c.gate) gates.push({ id: c.gate.id, label: c.gate.label, ok: !!c.gate.test() }); });
    var X = report.expressionTest; if (X) gates.push({ id: 'finite', label: 'Expressões sem valores inválidos (NaN)', ok: !X.nan });

    /* manual rubric */
    var rated = {}, byCat = {}; RUBRIC.forEach(function (it) { var v = manual.scores && manual.scores[it.id]; (byCat[it.cat] = byCat[it.cat] || []).push(v); if (v != null) rated[it.id] = v; });
    var facialVals = byCat.facial.filter(function (v) { return v != null; }), facialAvg = facialVals.length ? facialVals.reduce(function (a, b) { return a + b; }, 0) / facialVals.length : null;
    var overall = manual.overall || null;
    if (overall) gates.push({ id: 'premium', label: 'Parece executiva digital premium (e não avatar 3D genérico)', ok: overall === 'premium' });
    if (facialAvg != null && facialVals.length === byCat.facial.length) gates.push({ id: 'facial_min', label: 'Qualidade facial ≥ ' + MANUAL_GATES.facialMin + '/5 e nenhum item ≤ ' + (MANUAL_GATES.itemMin - 1), ok: facialAvg >= MANUAL_GATES.facialMin && facialVals.every(function (v) { return v >= MANUAL_GATES.itemMin; }) });

    var cats = CATEGORIES.map(function (c) {
      var cc = checks.filter(function (k) { return k.cat === c.id && k.w > 0; }), meas = cc.filter(function (k) { return k.s != null; }), wsum = meas.reduce(function (a, k) { return a + k.w; }, 0);
      var autoFrac = wsum ? meas.reduce(function (a, k) { return a + k.w * k.s; }, 0) / wsum : null, unmeasured = cc.length - meas.length;
      var autoPts = c.weight * c.auto, manPts = c.weight * (1 - c.auto), vals = byCat[c.id] || [], got = vals.filter(function (v) { return v != null; });
      var manFrac = vals.length ? (got.length === vals.length ? got.reduce(function (a, b) { return a + b; }, 0) / (5 * vals.length) : null) : null;
      var auto = autoPts === 0 ? 0 : autoFrac == null ? null : autoPts * autoFrac;
      var man = manPts > 0 ? (manFrac == null ? null : manPts * manFrac) : 0;
      return { id: c.id, label: c.label, weight: c.weight, autoMax: autoPts, manualMax: manPts, auto: auto, manual: man, autoFrac: autoFrac, unmeasured: unmeasured, total: auto != null && man != null ? auto + man : null, manualPending: manPts > 0 && man == null };
    });
    var techMax = cats.reduce(function (a, c) { return a + c.autoMax; }, 0), techGot = cats.reduce(function (a, c) { return a + (c.auto || 0); }, 0);
    // categories that could not be measured at all (e.g. FPS only) are rescaled so one unmeasured line does not punish the asset
    var complete = cats.every(function (c) { return c.total != null; }), total = complete ? Math.round(cats.reduce(function (a, c) { return a + c.total; }, 0)) : null;
    var failed = gates.filter(function (g) { return !g.ok; });
    var verdict, why;
    if (failed.length) { verdict = 'REJEITAR'; why = 'Falhou em: ' + failed.map(function (g) { return g.label; }).join('; '); }
    else if (total == null) { verdict = 'PENDENTE'; why = 'Parte técnica sem reprovação automática. Falta a avaliação visual humana (46 dos 100 pontos). Nenhum asset é aceito só pela parte técnica.'; }
    else if (total >= 85) { verdict = 'ACEITAR'; why = 'Nota ' + total + '/100, sem reprovação.'; }
    else if (total >= 70) { verdict = 'REVISAR'; why = 'Nota ' + total + '/100: devolver ao artista com a lista de itens abaixo do mínimo.'; }
    else { verdict = 'REJEITAR'; why = 'Nota ' + total + '/100, abaixo de 70.'; }
    var worst = checks.filter(function (c) { return c.s != null && c.w > 0 && c.s < 0.7; }).sort(function (a, b) { return a.s * a.w - b.s * b.w; });
    return { phase: phase, total: total, technical: { points: +techGot.toFixed(1), max: +techMax.toFixed(1), percent: Math.round(techGot / techMax * 100) }, categories: cats, checks: checks, gates: gates, verdict: verdict, why: why, fixes: worst.slice(0, 12).map(function (c) { return c.label + ': ' + c.d; }), manualComplete: complete, facialAvg: facialAvg };
  }

  /* Everything in one call: inspect, drive the pipeline, measure, evaluate. */
  function runAll(avatar, opts) {
    opts = opts || {};
    var model = avatar.model; if (!model || !model.res) return Promise.reject(WA.AvatarError('NOT_A_GLB', 'Carregue um GLB primeiro: o modelo procedural não é validado.'));
    var report = inspect(model, opts); report.expressionTest = runExpressionTest(avatar); report.lipTest = runLipSyncTest(avatar);
    var fpsP = opts.fps === false ? Promise.resolve(null) : measureFps(avatar, opts.fpsSeconds || 3);
    return fpsP.then(function (f) { report.fps = f; var result = evaluate(report, opts); return { report: report, result: result }; });
  }

  /* a JSON-safe copy of a report (no THREE objects) */
  function serialize(x) { return JSON.parse(JSON.stringify(x, function (k, v) { return k === 'mesh' ? undefined : v; })); }

  WA.AssetValidator = { CATEGORIES: CATEGORIES, PHASES: PHASES, RUBRIC: RUBRIC, MANUAL_GATES: MANUAL_GATES, EXPR_LIMITS: EXPR_LIMITS, inspect: inspect, evaluate: evaluate, runExpressionTest: runExpressionTest, runLipSyncTest: runLipSyncTest, measureFps: measureFps, gpuInfo: gpuInfo, runAll: runAll, serialize: serialize, kindOf: kindOf,
    /* measurement helpers reused by the Head Review */
    currentField: currentField, fieldMetrics: fieldMetrics, fieldDistance: distance, headMesh: headMesh, worldScale: worldScale };
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== review/ScorecardData.js ===== */
/*
 * ScorecardData: the visual scorecard (weights, items, barriers). Single source of truth for the documents
 * (tools/gen-docs.js), the Head Gate and the tests. phases: 0 = concept stills, 1 = real-time head, 4 = final character.
 */
(function (root) {
  'use strict';
  var data = {
  categories: [
    { id: 'FACE', weight: 22, items: [
      ['F1', 'Proportions and structure follow the Bible (ratios, jaw, chin, cheekbones, nose, brows)', '0,1,4'],
      ['F2', 'The face is a specific person with character, not a type', '0,1,4'],
      ['F3', 'Perceived age 43: lived-in, not retouched, not older or younger', '0,1,4'],
      ['F4', 'Natural asymmetry (2 to 3%) present in the neutral mesh', '0,1,4'],
      ['F5', 'Lips with volume; real teeth, tongue and mouth interior', '1,4'],
      ['F6', 'Close-up quality: silhouette, topology, no defects at CLOSE', '1,4']] },
    { id: 'EYES', weight: 15, items: [
      ['E1', 'Shape, size, lids and rest aperture (12% of iris) follow the Bible', '0,1,4'],
      ['E2', 'Iris depth, sclera, cornea, catchlight: the eye is alive, not painted', '0,1,4'],
      ['E3', 'Lids with thickness, lashes, wet line, soft lid shadow', '0,1,4'],
      ['E4', 'Gaze in motion: micro-saccades, independent eyes, lids follow gaze, no stare', '1,4'],
      ['E5', 'The six messages are readable without speech (listening, thinking, caught-it, disagree, rationalizing, continue)', '1,4']] },
    { id: 'EXPRESSION', weight: 14, items: [
      ['X1', 'One face, ten expressions (overlay test): never ten different faces', '1,4'],
      ['X2', 'Subtlety: every state within the amplitude table, none exaggerated', '1,4'],
      ['X3', 'Asymmetric states (skeptical, thinking, confident) work', '1,4'],
      ['X4', 'Combinations and transitions are clean: no collapsing corners, no popping', '1,4'],
      ['X5', 'Speaking reads as speech: closures p/b/m, f/v, teeth, tongue; not a mouth flap', '1,4'],
      ['X6', 'Rest-state life: breath, blinks, micro-movement without fidgeting', '1,4']] },
    { id: 'PRESENCE', weight: 14, items: [
      ['P1', '1.5 s test, Q1: "a person you would take seriously"', '0,1,4'],
      ['P2', '1.5 s test, Q2: "capable of advising a CEO"', '0,1,4'],
      ['P3', '1.5 s test, Q3: "would have the courage to disagree with him"', '0,1,4'],
      ['P4', 'First impression: "the smartest person in the room"', '0,1,4'],
      ['P5', 'Posture and stillness: composed, comfortable being looked at', '1,4']] },
    { id: 'IDENTITY', weight: 8, items: [
      ['I1', 'Originality: likeness test (fewer than 2 of 10 name the same real person)', '0,1,4'],
      ['I2', 'Consistency: the same woman across 3 lights, 3 shots, 10 expressions, speaking', '1,4'],
      ['I3', 'Visual DNA coverage (traits present out of 10, scaled to 0-5)', '0,1,4'],
      ['I4', 'Blind comparison: reviewers pick her as a premium character over generic avatars', '0,1,4']] },
    { id: 'SKIN', weight: 9, items: [
      ['S1', 'Tone and colour variation follow the Bible (redness, cool under-eye)', '0,1,4'],
      ['S2', 'Roughness varies by zone; speculars broad and rolled off', '1,4'],
      ['S3', 'Pores, fine lines, micro-wrinkles, one or two marks', '0,1,4'],
      ['S4', 'Subsurface warmth painted at ears, nostrils, eye corners', '1,4'],
      ['S5', 'The same skin under all three lighting styles', '1,4'],
      ['S6', 'No plastic, no wax, no noise-on-flat-colour', '0,1,4']] },
    { id: 'HAIR', weight: 8, items: [
      ['H1', 'Reads as hair: volume, depth, layering; no helmet, no ribbons', '0,1,4'],
      ['H2', 'Hairline, low side part, baby hairs, a handful of flyaways', '0,1,4'],
      ['H3', 'Satin anisotropic sheen, no mirror gloss', '1,4'],
      ['H4', 'Motion: small damped lag with the head', '4'],
      ['H5', 'Survives close-up: no visible card seams, clean alpha', '1,4']] },
    { id: 'CLOTHING', weight: 5, items: [
      ['C1', 'Cut and silhouette follow the Bible (sheath, jewel neckline, three-quarter sleeves, below the knee)', '0,4'],
      ['C2', 'Matte crepe, real drape, micro-wrinkles, black not pure black', '4'],
      ['C3', 'Reads as top-level executive: not a blazer avatar, not sexualised, not futuristic', '0,4'],
      ['C4', 'Accessories: only the 5 mm gold studs', '0,4']] },
    { id: 'CINEMATIC', weight: 5, items: [
      ['Q1', 'Lighting reads as portrait light in all three styles', '0,1,4'],
      ['Q2', 'Camera and composition: CLOSE, MEDIUM, FULL as specified', '1,4'],
      ['Q3', 'Materials respond to light believably (skin, hair, eyes, fabric)', '1,4'],
      ['Q4', 'Overall polish at 1080p and in motion: it looks like film, not like a render', '1,4']] }
  ],
  barriers: [
    ['B1', 'Generic face', 'A majority of reviewers call the face generic or stock, or fewer than 80% pick her in the blind comparison (I4)'],
    ['B2', 'Dead eyes', 'E2 or E4 scores 1 or less, or 40% of reviewers call the eyes dead, glassy or painted'],
    ['B3', 'Childlike appearance', 'A majority say she looks young or childlike, or the median apparent age is under 30'],
    ['B4', 'Generic-avatar appearance', '40% or more say "avatar", "game character", "cartoon" or "mannequin"'],
    ['B5', 'No executive presence', 'Any of the three 1.5 s questions has fewer than 80% "yes"'],
    ['B6', 'Resembles a real person', 'Two or more of 10 viewers name the same real person (I1)'],
    ['B7', 'Doll, porcelain or perfect symmetry', 'F4 scores 1 or less, or reviewers use "doll", "porcelain", "perfect"'],
    ['B8', 'Plastic skin', 'S6 or S2 scores 1 or less'],
    ['B9', 'Helmet or ribbon hair', 'H1 scores 1 or less'],
    ['B10', 'Smiling by default', 'The neutral mouth reads as smiling, pressed or sad to a majority of reviewers'],
    ['B11', 'Dead or uncanny when speaking', 'X5 scores 1 or less (mouth flap, no teeth or tongue, closures that do not close)'],
    ['B12', 'Ten different faces', 'X1 or I2 scores 1 or less (expressions or lights change who she is)'],
    ['B13', 'Uncanny moment', '40% of reviewers mark any frame of the guided review as unsettling'],
    ['B14', 'Departure from the Bible', 'Skin tone, hair, dress or accessories contradict locked decisions without written approval (any matching item at 1 or less)']
  ],
  presenceYesToScore: [[1.0, 5], [0.9, 4.5], [0.8, 4], [0.6, 3], [0.4, 2], [0, 0]]
};
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  if (root.AvatarKit) root.AvatarKit.ScorecardData = data;
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== review/SpeechScript.js ===== */
/*
 * SpeechScript: the one sentence every head candidate must speak, as a phoneme timeline.
 *
 * This is NOT a voice and NOT a TTS. It is a fixed, hand-transcribed ARPAbet script with deterministic timing
 * (calm, deliberate delivery), so every candidate is driven by exactly the same mouth targets in the same order.
 * It tests the RIG (visemes, jaw, lips, teeth, tongue, stability), not the pronunciation of a speech engine.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit;

  var TEXT = "Before we decide what to do, let's separate what is actually happening from the story you're telling yourself about it.";
  // [word, ARPAbet phonemes (a trailing ! marks a stressed vowel), pause after in seconds]
  var WORDS = [
    ['Before', 'B IH F AO! R', 0], ['we', 'W IY', 0], ['decide', 'D IH S AY! D', 0], ['what', 'W AH! T', 0], ['to', 'T UW', 0], ['do,', 'D UW!', 0.42],
    ["let's", 'L EH! T S', 0], ['separate', 'S EH! P ER EY T', 0], ['what', 'W AH! T', 0], ['is', 'IH Z', 0], ['actually', 'AE! K CH UW AH L IY', 0],
    ['happening', 'HH AE! P AH N IH NG', 0.3], ['from', 'F R AH! M', 0], ['the', 'DH AH', 0], ['story', 'S T AO! R IY', 0], ["you're", 'Y UH R', 0],
    ['telling', 'T EH! L IH NG', 0], ['yourself', 'Y AO R S EH! L F', 0], ['about', 'AH B AW! T', 0], ['it.', 'IH! T', 0.35]
  ];
  var VOWELS = { AA: 1, AE: 1, AH: 1, AO: 1, AW: 1, AY: 1, EH: 1, ER: 1, EY: 1, IH: 1, IY: 1, OW: 1, OY: 1, UH: 1, UW: 1 };
  var DIPHTHONG = { AW: 1, AY: 1, EY: 1, OW: 1, OY: 1 };
  var STOP = { B: 1, D: 1, G: 1, K: 1, P: 1, T: 1 }, NASAL = { M: 1, N: 1, NG: 1 };
  var PACE = 1.1;                                    // calm, deliberate delivery: the whole clip is 12 to 14 s
  function dur(ph, stressed) {
    var d = VOWELS[ph] ? (DIPHTHONG[ph] ? 0.2 : 0.14) : STOP[ph] ? 0.065 : NASAL[ph] ? 0.08 : 0.095;
    if (stressed && VOWELS[ph]) d *= 1.35;
    return d * PACE;
  }

  /* Events in the shape VisemeTimeline.fromPhonemes expects: { ph, t, d } in seconds, plus lead-in and tail of silence. */
  function events(opts) {
    opts = opts || {}; var t = opts.lead == null ? 0.5 : opts.lead, out = [{ ph: 'SIL', t: 0, d: t }];
    WORDS.forEach(function (w) {
      w[1].split(' ').forEach(function (tok) { var st = tok.charAt(tok.length - 1) === '!', ph = st ? tok.slice(0, -1) : tok, d = dur(ph, st); out.push({ ph: ph, t: +t.toFixed(3), d: +d.toFixed(3) }); t += d; });
      t += 0.045 * PACE; if (w[2]) { out.push({ ph: 'SIL', t: +t.toFixed(3), d: w[2] }); t += w[2]; }
    });
    out.push({ ph: 'SIL', t: +t.toFixed(3), d: opts.tail == null ? 0.6 : opts.tail });
    return out;
  }
  function info() {
    var ev = events(), last = ev[ev.length - 1], syl = 0, ph = {};
    ev.forEach(function (e) { if (VOWELS[e.ph]) syl++; if (e.ph !== 'SIL') ph[e.ph] = (ph[e.ph] || 0) + 1; });
    // the 15 Oculus visemes the sentence needs, through the engine's own table (never a second mapping)
    var vis = {}; ev.forEach(function (e) { var m = WA.VisemeTables.ARPABET[e.ph]; if (m && m[0] !== 'viseme_sil') vis[m[0]] = (vis[m[0]] || 0) + 1; });
    return { text: TEXT, seconds: +(last.t + last.d).toFixed(2), speechStart: ev[1].t, speechEnd: ev[ev.length - 2].t + ev[ev.length - 2].d, syllables: syl, phonemes: ph, requiredVisemes: Object.keys(vis).sort(), visemeCounts: vis, events: ev };
  }
  /* times (seconds) of the first strong examples of the visemes a human reviewer must see as stills */
  function stillTimes() {
    var ev = events(), want = { viseme_aa: 'AE', viseme_PP: 'P', viseme_FF: 'F', viseme_O: 'AO', viseme_TH: 'DH', viseme_E: 'EH', viseme_U: 'UW' }, out = {};
    Object.keys(want).forEach(function (v) { var e = ev.filter(function (x) { return x.ph === want[v]; })[0]; if (e) out[v] = +(e.t + e.d * 0.5).toFixed(3); });
    return out;
  }

  WA.SpeechScript = { TEXT: TEXT, events: events, info: info, stillTimes: stillTimes, VOWELS: VOWELS };
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== review/HeadGate.js ===== */
/*
 * HeadGate: the domain of the Head Prototype Gate. Pure logic (no DOM, no WebGL, no files), so it runs in Node and in the browser.
 *
 *   candidate registry   HEAD-001, HEAD-002...: identity, versions, file hash, state machine
 *   review configuration the single, hashed set of conditions every candidate is rendered and tested under
 *   mapping report       which morph targets drive which Bible expressions; what is UNMAPPED
 *   scoring              TECHNICAL / VISUAL / PRESENCE / SPEECH / EXPRESSION / IDENTITY, reusing the visual scorecard weights
 *   hard barriers        the 14 rejection rules, automatic where the code can know, human where it cannot
 *   decision             PASS / CONDITIONAL / REJECTED, with the reasons, and the comparison between candidates with WHY
 *
 * Honesty rule: a score that needs a person is never invented. It stays null with status "HUMAN REVIEW REQUIRED"
 * until the ratings exist; a null never counts as zero and never as a pass.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, SC = WA.ScorecardData, clamp = WA.clamp;

  /* ================= review configuration (deterministic) ================= */
  var CONFIG = {
    version: 1,
    canvas: { width: 1280, height: 720, pixelRatio: 1 },
    quality: 'high',
    camera: { shot: 'CLOSE', style: 'executive', look: 'camera' },
    lighting: 'executive',                  // the SAME lighting for every shot of every candidate
    step: 1 / 30,                           // simulation step; no wall-clock time is ever used
    settle: 4,                              // seconds a shot is held before it is captured
    orbit: { front: 0, threeQuarter: 0.61, profile: 1.5708 },
    shots: [
      { id: '01_FRONT_NEUTRAL', kind: 'pose', pose: { expression: 'neutral' }, orbit: 'front', gaze: 'camera' },
      { id: '02_FRONT_LISTENING', kind: 'pose', pose: { state: 'LISTENING' }, orbit: 'front', gaze: 'camera' },
      { id: '03_FRONT_THINKING', kind: 'pose', pose: { state: 'THINKING' }, orbit: 'front', gaze: 'camera', waitFor: 'gazeAway' },
      { id: '04_FRONT_FIRM', kind: 'pose', pose: { expression: 'firm' }, orbit: 'front', gaze: 'camera' },
      { id: '05_FRONT_SKEPTICAL', kind: 'pose', pose: { expression: 'skeptical' }, orbit: 'front', gaze: 'camera' },
      { id: '06_THREE_QUARTER', kind: 'pose', pose: { state: 'LISTENING' }, orbit: 'threeQuarter', gaze: 'camera' },
      { id: '07_PROFILE', kind: 'pose', pose: { expression: 'neutral' }, orbit: 'profile', gaze: 'center' },
      { id: '08_SPEAKING', kind: 'speech', still: 'viseme_aa', orbit: 'front', gaze: 'camera' },
      { id: '09_SPEAKING_CLOSE', kind: 'speech', still: 'viseme_O', orbit: 'front', gaze: 'camera', framing: 'intimate' },   // tighter framing, SAME lighting
      { id: '10_IDLE_1_5_SECONDS', kind: 'presence' }
    ],
    presence: {
      seconds: 1.5, breathPeriod: 4.6,
      cues: [{ t: 0.0, what: 'neutral face' }, { t: 0.3, what: 'micro eye movement' }, { t: 0.6, what: 'small breath' }, { t: 0.9, what: 'micro facial change' }, { t: 1.2, what: 'gaze stabilises' }, { t: 1.5, what: 'observer answers A, B, C' }],
      microEye: { x: 0.035, y: -0.02 }, microFace: { expression: 'listening', intensity: 0.35 },
      questions: [
        { id: 'A', text: 'Does she look like a real adult person?', scorecard: 'P1' },
        { id: 'B', text: 'Does she look like someone with executive authority?', scorecard: 'P2' },
        { id: 'C', text: 'Would I trust her to tell me something I do not want to hear?', scorecard: 'P3' }]
    },
    // thresholds are first defensible values, to be recalibrated with the first professional asset (see HEAD_PROTOTYPE_GATE.md)
    limits: {
      expressionPeak: 0.06, speechPeak: 0.1, exploding: 0.14, vertexStep: 0.012, speechStep: 0.04, combinationExcess: 1.2,
      eyeAlign: 0.12, jerkP95: 0.35, cyclesPerSyllable: [0.4, 1.4], closureContrast: 0.55, microEyeMin: 0.008, breathMin: 0.1,
      faceChange: [0.00004, 0.004], fidgetMax: 0.03, eyeStableStd: 0.012, xSubtlety: [0.035, 0.1], skepticalAsym: [0.03, 0.12]
    },
    pass: { total: 85, conditional: 70, itemMin: 3, itemMinConditional: 2, speech: 4.0, speechReject: 3.0, presenceYes: 0.8 }
  };
  function stable(x) { return JSON.stringify(x, function (k, v) { if (v && typeof v === 'object' && !Array.isArray(v)) { var o = {}; Object.keys(v).sort().forEach(function (key) { o[key] = v[key]; }); return o; } return v; }); }
  function hash(str) { var h = 0x811c9dc5; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; } return ('00000000' + h.toString(16)).slice(-8); }
  function configHash() { return hash(stable(CONFIG)); }

  /* ================= candidates and the state machine ================= */
  var STATES = ['PENDING_ASSET', 'DRAFT', 'UNDER_REVIEW', 'PASS', 'CONDITIONAL', 'REJECTED'];
  var TRANSITIONS = {
    PENDING_ASSET: ['DRAFT'], DRAFT: ['UNDER_REVIEW', 'REJECTED'], UNDER_REVIEW: ['PASS', 'CONDITIONAL', 'REJECTED', 'DRAFT'],
    PASS: ['UNDER_REVIEW'], CONDITIONAL: ['UNDER_REVIEW', 'REJECTED'], REJECTED: ['DRAFT']
  };
  var ID_RE = /^HEAD-\d{3}$/;
  function canTransition(a, b) { return (TRANSITIONS[a] || []).indexOf(b) >= 0; }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function err(code, msg) { return WA.AvatarError(code, msg); }
  function today() { return new Date().toISOString().slice(0, 10); }

  function createCandidate(o) {
    o = o || {}; if (!ID_RE.test(o.id || '')) throw err('BAD_CANDIDATE_ID', 'Candidate id must look like HEAD-001, got "' + o.id + '"');
    var c = { id: o.id, name: o.name || o.id, vendor: o.vendor || '', sample: !!o.sample, version: 0, state: 'PENDING_ASSET', created: o.date || today(), asset: null, rigMap: o.rigMap || null, notes: o.notes || '', review: null, decision: null, history: [], log: [] };
    c.log.push({ date: c.created, event: 'created', state: c.state });
    if (o.file) return registerAsset(c, o);
    return c;
  }
  /* The GLB of a candidate. A new asset after a decision archives the previous version: the candidate's identity stays, the review starts over. */
  function registerAsset(c, a) {
    c = clone(c); if (!a || !a.file || !a.sha256) throw err('BAD_ASSET', 'registerAsset needs { file, sha256 }');
    if (c.state === 'PENDING_ASSET') { /* first asset */ }
    else if (c.state === 'DRAFT') { /* replacing a draft: fine */ }
    else if (c.state === 'PASS' || c.state === 'CONDITIONAL' || c.state === 'REJECTED') { c.history.push({ version: c.version, state: c.state, asset: c.asset, decision: c.decision }); }
    else throw err('ILLEGAL_TRANSITION', c.id + ' is ' + c.state + ': decide it (or withdraw it to DRAFT) before a new asset is registered');
    c.version = a.version || (c.version + 1); if (c.history.length && c.version <= c.history[c.history.length - 1].version) throw err('VERSION_NOT_NEWER', 'A new asset needs a version above ' + c.history[c.history.length - 1].version);
    c.asset = { file: a.file, sha256: a.sha256, bytes: a.bytes || null, vendor: a.vendor || c.vendor, date: a.date || today(), note: a.note || '' }; if (a.vendor) c.vendor = a.vendor;
    c.review = null; c.decision = null; c.state = 'DRAFT'; c.log.push({ date: c.asset.date, event: 'asset registered v' + c.version, state: 'DRAFT' }); return c;
  }
  function transition(c, to, meta) {
    c = clone(c); if (STATES.indexOf(to) < 0) throw err('BAD_STATE', 'Unknown state ' + to);
    if (!canTransition(c.state, to)) throw err('ILLEGAL_TRANSITION', c.id + ': ' + c.state + ' -> ' + to + ' is not allowed');
    c.state = to; c.log.push({ date: (meta && meta.date) || today(), event: (meta && meta.event) || 'transition', state: to, by: meta && meta.by }); return c;
  }
  function attachReview(c, review) {
    if (c.state !== 'DRAFT' && c.state !== 'UNDER_REVIEW') throw err('ILLEGAL_TRANSITION', c.id + ' is ' + c.state + ': start a new version to review again');
    if (review.candidate && (review.candidate.id !== c.id || review.candidate.sha256 !== c.asset.sha256)) throw err('REVIEW_MISMATCH', 'The review belongs to ' + review.candidate.id + ' / ' + review.candidate.sha256 + ', not to ' + c.id + ' / ' + c.asset.sha256);
    if (review.configHash !== configHash()) throw err('CONFIG_MISMATCH', 'The review was produced under another review configuration (' + review.configHash + ' != ' + configHash() + ')');
    var n = clone(c); n.review = { automated: review, ratings: (c.review && c.review.ratings) || null }; if (n.state === 'DRAFT') n = transition(n, 'UNDER_REVIEW', { event: 'automated review attached' }); return n;
  }
  function attachRatings(c, ratings) {
    if (!c.review) throw err('NO_REVIEW', c.id + ' has no automated review yet'); var n = clone(c); n.review.ratings = mergeRatings(n.review.ratings, ratings); return n;
  }
  function mergeRatings(a, b) {
    var r = clone(a || { reviewers: [], items: {}, speech: {}, presenceVotes: {}, humanBarriers: {}, likeness: null, blind: null, dnaTraits: null }); b = b || {};
    (b.reviewers || []).forEach(function (n) { if (r.reviewers.indexOf(n) < 0) r.reviewers.push(n); });
    ['items', 'speech'].forEach(function (k) { Object.keys(b[k] || {}).forEach(function (id) { r[k][id] = [].concat(b[k][id]); }); });
    Object.keys(b.presenceVotes || {}).forEach(function (q) { r.presenceVotes[q] = b.presenceVotes[q]; });
    Object.keys(b.humanBarriers || {}).forEach(function (q) { r.humanBarriers[q] = b.humanBarriers[q]; });
    ['likeness', 'blind', 'dnaTraits', 'barriersReviewed'].forEach(function (k) { if (b[k] != null) r[k] = b[k]; }); return r;
  }
  function median(a) { a = [].concat(a).filter(function (x) { return typeof x === 'number' && isFinite(x); }).sort(function (x, y) { return x - y; }); if (!a.length) return null; var m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }

  /* ================= mapping layer: Bible expressions -> available morph targets ================= */
  var REVIEW_EXPRESSIONS = [
    { id: 'listening', mix: [['listening', 1]], drive: { state: 'LISTENING' } },
    { id: 'thinking', mix: [['thinking', 1]], drive: { state: 'THINKING' } },
    { id: 'perceived_unsaid', mix: [['analyzing', 0.6], ['thinking', 0.3]], drive: { state: 'PROCESSING' } },
    { id: 'disagreement', mix: [['skeptical', 0.8], ['firm', 0.3]], drive: { state: 'CHALLENGE' } },
    { id: 'rationalization', mix: [['skeptical', 0.5]], drive: { expression: 'skeptical', intensity: 0.5 }, note: 'review approximation: skeptical at 0.5 (the slow blink and head tilt are the engine\'s)' },
    { id: 'continue', mix: [['listening', 1]], drive: { state: 'LISTENING' }, note: 'the micro-nod is the engine\'s' },
    { id: 'welcoming', mix: [['empathetic', 0.6], ['confident', 0.25]], drive: { expression: 'empathetic', intensity: 0.6 }, note: 'review approximation: empathetic at 0.6' },
    { id: 'firm', mix: [['firm', 1]], drive: { expression: 'firm' } },
    { id: 'skeptical', mix: [['skeptical', 1]], drive: { expression: 'skeptical' } },
    { id: 'confident', mix: [['confident', 1]], drive: { state: 'CONFIDENCE' } }
  ];
  /* The channels an expression needs: the departure from the relaxed baseline that is at least 0.1 in any emotion of its mix. */
  function requiredChannels(exp) {
    var E = WA.ExpressionController.EMOTIONS, B = WA.ExpressionController.BASE, need = {};
    exp.mix.forEach(function (m) { var f = E[m[0]].face; Object.keys(f).forEach(function (ch) { if (Math.abs(f[ch] - (B[ch] || 0)) >= 0.1 || (ch === 'jawClench' && f[ch] >= 0.1)) need[ch] = Math.max(need[ch] || 0, f[ch]); }); });
    return Object.keys(need).sort();
  }
  /*
   * res = the model's RigMap resolution (model.res). Nothing is guessed: a channel is MAPPED_EXACT, MAPPED_ALIAS, MAPPED_FUZZY (a name-token match
   * that a person must confirm) or UNMAPPED. A mirrored model is only trusted when the candidate's RigMap says so.
   */
  function mappingReport(res) {
    var how = (res.report && res.report.matchedBy) || {}, rows = REVIEW_EXPRESSIONS.map(function (e) {
      var req = requiredChannels(e).map(function (ch) {
        var names = res.morphs[ch]; if (!names || !names.length) return { ch: ch, status: 'UNMAPPED', names: [] };
        return { ch: ch, status: how[ch] === 'exact' ? 'MAPPED_EXACT' : how[ch] === 'alias' ? 'MAPPED_ALIAS' : 'MAPPED_FUZZY', names: names };
      });
      var unm = req.filter(function (r) { return r.status === 'UNMAPPED'; }), fuzzy = req.filter(function (r) { return r.status === 'MAPPED_FUZZY'; });
      var share = req.length ? (req.length - unm.length) / req.length : 1;
      return { id: e.id, mix: e.mix, note: e.note || null, required: req, unmapped: unm.map(function (r) { return r.ch; }), fuzzy: fuzzy.map(function (r) { return r.ch; }), share: +share.toFixed(2),
        reproducible: unm.length <= 1 && share >= 0.8 };
    });
    var script = WA.SpeechScript ? WA.SpeechScript.info().requiredVisemes : [], missingV = script.filter(function (v) { return !(res.visemes && res.visemes[v]); });
    return { expressions: rows, notReproducible: rows.filter(function (r) { return !r.reproducible; }).map(function (r) { return r.id; }), fuzzyChannels: Array.from(new Set(rows.reduce(function (a, r) { return a.concat(r.fuzzy); }, []))),
      visemes: { required: script, missing: missingV, native: !!(res.report && res.report.visemesNative) } };
  }

  /* ================= scoring ================= */
  function lin(x, lo, hi) { return clamp((x - lo) / (hi - lo), 0, 1); }
  function yesToScore(rate) { var t = SC.presenceYesToScore; for (var i = 0; i < t.length; i++) if (rate >= t[i][0] - 1e-9) return t[i][1]; return 0; }
  var SPEECH_ITEMS = ['naturalness', 'teeth', 'tongue', 'jaw', 'sync', 'lips', 'eyes', 'cheeks', 'chin', 'micro', 'human', 'noavatar'];
  var SPEECH_LABELS = { naturalness: 'Mouth naturalness', teeth: 'Teeth', tongue: 'Tongue', jaw: 'Jaw', sync: 'Synchronisation', lips: 'Lip deformation', eyes: 'Eye stability', cheeks: 'Cheek stability', chin: 'Chin stability', micro: 'Micro-expressions while speaking', human: 'Human appearance', noavatar: 'Absence of the "avatar" effect' };
  var SPEECH_TO_F5 = ['naturalness', 'teeth', 'tongue', 'lips'];

  /* automatic scores for the items the code can honestly measure (0 to 5), or null when the measurement does not exist */
  function autoItems(auto) {
    var L = CONFIG.limits, out = {}, ex = auto && auto.expression, tr = auto && auto.transitions, pr = auto && auto.presence;
    if (ex && ex.maxPeak != null) out.X2 = +(5 * (1 - lin(ex.maxPeak, L.xSubtlety[0], L.xSubtlety[1]))).toFixed(2);
    if (ex && ex.skepticalAsym != null) out.X3 = +(5 * lin(ex.skepticalAsym, L.skepticalAsym[0], L.skepticalAsym[1])).toFixed(2);
    if (tr && tr.flags) out.X4 = Math.max(0, 5 - tr.flags.length);
    if (pr && pr.metrics) { var m = pr.metrics, bad = [!m.eyeMoveDetected, !m.breathDetected, !m.faceChangeInRange, !m.eyeStableAtEnd, m.fidget].filter(Boolean).length; out.X6 = Math.max(0, 5 - bad); }
    return out;
  }
  function itemScore(it, auto, rt, autoMap) {
    var id = it[0], r = rt || {}, v = null, src = 'human';
    if (autoMap[id] != null) return { id: id, score: autoMap[id], source: 'automated' };
    if (id === 'X5' || id === 'F5') {
      var keys = id === 'X5' ? SPEECH_ITEMS : SPEECH_TO_F5, vals = keys.map(function (k) { return median((r.speech || {})[k]); });
      if (vals.every(function (x) { return x != null; })) return { id: id, score: +(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length).toFixed(2), source: 'speech checklist' };
      return { id: id, score: null, source: 'human' };
    }
    if (id === 'P1' || id === 'P2' || id === 'P3') { var q = CONFIG.presence.questions.filter(function (x) { return x.scorecard === id; })[0], pv = (r.presenceVotes || {})[q.id]; if (pv && pv.yes + pv.no >= 1) return { id: id, score: yesToScore(pv.yes / (pv.yes + pv.no)), source: 'presence votes', rate: pv.yes / (pv.yes + pv.no), n: pv.yes + pv.no }; return { id: id, score: null, source: 'human' }; }
    if (id === 'I1' && r.likeness) return { id: id, score: r.likeness.names === 0 ? 5 : r.likeness.names === 1 ? 4 : 0, source: 'likeness test' };
    if (id === 'I3' && r.dnaTraits != null) return { id: id, score: +(r.dnaTraits / 10 * 5).toFixed(2), source: 'DNA traits' };
    if (id === 'I4' && r.blind) return { id: id, score: yesToScore(r.blind.picked / r.blind.of), source: 'blind comparison' };
    var m = median((r.items || {})[id]); return { id: id, score: m, source: 'human' };
  }
  var VISUAL_CATS = ['FACE', 'EYES', 'SKIN', 'HAIR', 'CLOTHING', 'CINEMATIC'];

  function sectionOf(items, weightOf) {
    var applicable = items, rated = applicable.filter(function (i) { return i.score != null; }), pending = applicable.filter(function (i) { return i.score == null; });
    var tot = applicable.reduce(function (a, i) { return a + weightOf(i); }, 0), got = rated.reduce(function (a, i) { return a + weightOf(i) * i.score / 5; }, 0), ratedW = rated.reduce(function (a, i) { return a + weightOf(i); }, 0);
    var complete = pending.length === 0 && applicable.length > 0;
    return { value: complete ? Math.round(got / tot * 100) : null, partial: !complete && ratedW > 0 ? Math.round(got / ratedW * 100) : null, status: !applicable.length ? 'NOT APPLICABLE' : complete ? (rated.every(function (i) { return i.source === 'automated'; }) ? 'AUTOMATED' : 'COMPLETE') : 'HUMAN REVIEW REQUIRED',
      rated: rated.length, of: applicable.length, pending: pending.map(function (i) { return i.id; }), automated: rated.filter(function (i) { return i.source === 'automated'; }).map(function (i) { return i.id; }) };
  }

  function score(automated, ratings) {
    var auto = autoItems(automated), all = [];
    SC.categories.forEach(function (c) { c.items.forEach(function (it) { if (it[2].split(',').indexOf('1') >= 0) { var s = itemScore(it, automated, ratings, auto); s.cat = c.id; s.text = it[1]; s.weight = c.weight / c.items.filter(function (x) { return x[2].split(',').indexOf('1') >= 0; }).length; all.push(s); } }); });
    var by = function (cats, filter) { return all.filter(function (i) { return cats.indexOf(i.cat) >= 0 && (!filter || filter(i)); }); }, w = function (i) { return i.weight; };
    var val = by(VISUAL_CATS);
    var sections = {
      TECHNICAL: technicalSection(automated),
      VISUAL: sectionOf(val, w),
      PRESENCE: sectionOf(by(['PRESENCE']), w),
      SPEECH: speechSection(ratings),
      EXPRESSION: sectionOf(by(['EXPRESSION'], function (i) { return i.id !== 'X5'; }), w),
      IDENTITY: sectionOf(by(['IDENTITY']), w)
    };
    var scorecard = sectionOf(all, w);
    return { sections: sections, scorecard: { value: scorecard.value, partial: scorecard.partial, status: scorecard.status, rated: scorecard.rated, of: scorecard.of, pending: scorecard.pending },
      items: all, lowest: all.filter(function (i) { return i.score != null; }).sort(function (a, b) { return a.score - b.score; })[0] || null, autoItems: auto };
  }
  function technicalSection(auto) {
    var v = auto && auto.validator && auto.validator.result; if (!v) return { value: null, status: 'NOT RUN', gatesFailed: [] };
    return { value: v.technical.percent, status: 'AUTOMATED', gatesFailed: v.gates.filter(function (g) { return !g.ok; }).map(function (g) { return g.label; }), points: v.technical.points, max: v.technical.max };
  }
  function speechSection(ratings) {
    var r = (ratings && ratings.speech) || {}, vals = SPEECH_ITEMS.map(function (k) { return median(r[k]); }), rated = vals.filter(function (x) { return x != null; });
    var complete = rated.length === SPEECH_ITEMS.length, mean = rated.length ? rated.reduce(function (a, b) { return a + b; }, 0) / rated.length : null;
    return { value: complete ? Math.round(mean / 5 * 100) : null, partial: !complete && rated.length ? Math.round(mean / 5 * 100) : null, mean: complete ? +mean.toFixed(2) : null, status: complete ? 'COMPLETE' : 'HUMAN REVIEW REQUIRED', rated: rated.length, of: SPEECH_ITEMS.length,
      pending: SPEECH_ITEMS.filter(function (k, i) { return vals[i] == null; }) };
  }

  /* ================= hard rejection rules (HR-01 .. HR-14) ================= */
  var HR = [
    ['HR-01', 'Childlike appearance', 'human', 'B3'], ['HR-02', 'Generic face', 'human', 'B1'], ['HR-03', 'Looks like an avatar', 'human', 'B4'], ['HR-04', 'Dead eyes', 'human', 'B2'],
    ['HR-05', 'Artificial mouth', 'human', 'B11'], ['HR-06', 'Broken speech', 'auto+human', 'B11'], ['HR-07', 'Obviously artificial teeth', 'human', 'B11'],
    ['HR-08', 'Facial rig cannot reproduce the required expressions', 'auto', null], ['HR-09', 'Strong loss of identity when speaking', 'auto+human', 'B12'],
    ['HR-10', 'Eyes cannot be controlled', 'auto', null], ['HR-11', 'Jaw cannot be controlled', 'auto', null], ['HR-12', 'Required visemes cannot be executed', 'auto', null],
    ['HR-13', 'A real person is recognisable as the origin', 'human', 'B6'], ['HR-14', 'Technical failure incompatible with the Asset Brief', 'auto', null]
  ];
  function barriers(automated, ratings) {
    var a = automated || {}, v = a.validator && a.validator.result, rep = a.validator && a.validator.report, hb = (ratings && ratings.humanBarriers) || {}, L = CONFIG.limits;
    var sp = a.speech, mp = a.mapping, items = {}; (score(a, ratings).items || []).forEach(function (i) { items[i.id] = i.score; });
    var gate = function (id) { var g = v && v.gates.filter(function (x) { return x.id === id; })[0]; return g ? !g.ok : null; };
    var out = HR.map(function (h) { return { id: h[0], label: h[1], mode: h[2], scorecard: h[3], triggered: null, evidence: [], by: null }; });
    var B = function (id) { return out.filter(function (o) { return o.id === id; })[0]; };
    function set(id, trig, ev, by) { var b = B(id); if (trig) { b.triggered = true; b.by = by; b.evidence.push(ev); } else if (b.triggered == null && trig === false) { b.triggered = false; b.by = by; } }
    // human flags
    HR.forEach(function (h) { if (hb[h[0]] === true) set(h[0], true, 'reviewer marked this barrier', 'human'); else if (hb[h[0]] === false) set(h[0], false, '', 'human'); });
    // a reviewer who states that every hard rule was checked clears the ones nobody marked
    if (ratings && ratings.barriersReviewed === true) HR.forEach(function (h) { if (h[2].indexOf('human') >= 0 && hb[h[0]] == null) set(h[0], false, '', 'human'); });
    // automatic detection
    if (mp) { var bad = mp.notReproducible || []; set('HR-08', bad.length >= 3, bad.length + ' of 10 expressions are not reproducible with this rig: ' + bad.join(', '), 'auto'); if (bad.length < 3) set('HR-08', false, '', 'auto'); }
    if (v) {
      var gEyes = gate('eyes'); if (gEyes != null) set('HR-10', gEyes, 'no usable eye control (eye bones or eyeLook morphs)', 'auto');
      var gJaw = gate('jaw'); if (gJaw != null) set('HR-11', gJaw, 'no jawOpen morph and no Jaw bone', 'auto');
      var gVis = gate('visemes'), miss = mp ? mp.visemes.missing : []; set('HR-12', !!gVis || miss.length > 0, (gVis ? 'fewer than 13 native visemes. ' : '') + (miss.length ? 'missing for the standard sentence: ' + miss.join(', ') : ''), 'auto'); if (!gVis && !miss.length) set('HR-12', false, '', 'auto');
      var failed = v.gates.filter(function (g) { return !g.ok && ['eyes', 'jaw', 'visemes', 'rig_grade'].indexOf(g.id) < 0; }).map(function (g) { return g.label; });
      var parts = rep ? [[rep.mouth.teeth, 'teeth mesh'], [rep.mouth.tongue, 'tongue mesh'], [rep.eyes.eyeMeshes >= 2, 'two eye meshes'], [rep.hair.meshes, 'hair mesh (basic hair is required in Phase 1)']].filter(function (p) { return !p[0]; }).map(function (p) { return 'missing ' + p[1]; }) : [];
      var rig = v.gates.filter(function (g) { return g.id === 'rig_grade' && !g.ok; }).length ? ['rig grade below good'] : [];
      var ev = failed.concat(parts, rig); set('HR-14', ev.length > 0, ev.join('; '), 'auto'); if (!ev.length) set('HR-14', false, '', 'auto');
    }
    if (sp && sp.metrics) {
      var f = sp.flags || []; var broken = f.filter(function (x) { return /^(popping|no mouth|jerk|frozen)/.test(x); });
      set('HR-06', broken.length > 0, broken.join('; '), 'auto'); if (!broken.length && B('HR-06').triggered == null) set('HR-06', false, '', 'auto');
      var drift = sp.metrics.peakDisplacement > L.exploding; set('HR-09', drift, 'face deforms beyond ' + L.exploding + ' of head height while speaking (' + sp.metrics.peakDisplacement.toFixed(3) + ')', 'auto'); if (!drift && B('HR-09').triggered == null) set('HR-09', false, '', 'auto');
    }
    // evidence from human scores (a barrier a reviewer has not marked, but whose underlying item is at 1 or less)
    var ev1 = function (id, ids) { var low = ids.filter(function (i) { return items[i] != null && items[i] <= 1; }); if (low.length) set(id, true, 'scored 1 or less: ' + low.join(', '), 'human'); };
    ev1('HR-04', ['E2', 'E4']); ev1('HR-05', ['X5', 'F5']); ev1('HR-09', ['I2']); ev1('HR-02', ['I4']);
    var sc = (ratings && ratings.speech) || {}; if (median(sc.teeth) != null && median(sc.teeth) <= 1) set('HR-07', true, 'speech checklist: teeth scored ' + median(sc.teeth), 'human');
    if (median(sc.sync) != null && median(sc.sync) <= 1) set('HR-06', true, 'speech checklist: synchronisation scored ' + median(sc.sync), 'human');
    if (median(sc.naturalness) != null && median(sc.naturalness) <= 1) set('HR-05', true, 'speech checklist: mouth naturalness scored ' + median(sc.naturalness), 'human');
    ['human', 'noavatar'].forEach(function (k) { if (median(sc[k]) != null && median(sc[k]) <= 1) set('HR-03', true, 'speech checklist: ' + k + ' scored ' + median(sc[k]), 'human'); });
    if (ratings && ratings.likeness && ratings.likeness.names >= 2) set('HR-13', true, ratings.likeness.names + ' of ' + ratings.likeness.of + ' viewers named the same real person', 'human');
    if (ratings && ratings.blind && ratings.blind.picked / ratings.blind.of < 0.8) set('HR-02', true, 'only ' + Math.round(ratings.blind.picked / ratings.blind.of * 100) + '% picked her over generic avatars (needs 80%)', 'human');
    if (items.F4 != null && items.F4 <= 1) set('HR-03', true, 'F4 (asymmetry) scored 1 or less: doll-like', 'human');
    var pv = (ratings && ratings.presenceVotes) || {}; CONFIG.presence.questions.forEach(function (q) { var x = pv[q.id]; if (x && x.yes + x.no && x.yes / (x.yes + x.no) < CONFIG.pass.presenceYes) { var b = B('HR-03'); b.evidence.push('presence question ' + q.id + ' below ' + CONFIG.pass.presenceYes * 100 + '% yes (' + Math.round(x.yes / (x.yes + x.no) * 100) + '%)'); } });
    return out;
  }

  /* The technical facts of a candidate, collected from the existing validator report (nothing is measured twice). */
  function metrics(review) {
    var v = review && review.validator && review.validator.report; if (!v) return null; var f = review.file || {};
    return { triangles: v.geometry.tris, fileBytes: f.bytes, fileMB: v.delivery.fileMB, meshes: v.geometry.meshes.length, materials: v.materials.count, textures: v.materials.textures, textureMB: v.materials.textureMB, maxTexture: v.materials.maxTexture,
      morphTargets: (f.morphNames || []).length, morphNames: f.morphNames || [], arkit: { found: v.blendshapes.arkitFound, of: 52, coverage: v.blendshapes.coverage, missing: v.blendshapes.missing }, visemes: { found: v.visemes.found, of: 15, native: v.visemes.native, missing: v.visemes.missing },
      eyeBones: v.eyes.bones, eyeMode: v.eyes.mode, eyeLookMorphs: v.eyes.lookMorphs, jaw: { mode: v.mouth.jawMode, morph: v.mouth.jawMorph }, bones: v.animation.bones, missingBones: v.animation.headBonesMissing, clips: v.animation.clips.map(function (c) { return c.name + ' ' + c.duration + 's'; }),
      compression: { meshopt: v.delivery.meshopt, draco: v.delivery.draco, quantized: v.delivery.quantized }, ktx2: v.delivery.ktx2, extensions: v.delivery.extensions, loadMs: v.delivery.loadMs, grade: v.rig.grade };
  }

  /* ================= decision ================= */
  function recommend(automated, ratings) {
    var sc = score(automated, ratings), bs = barriers(automated, ratings), S = sc.sections, P = CONFIG.pass, why = [], todo = [];
    var hit = bs.filter(function (b) { return b.triggered === true; });
    if (!automated || !automated.validator) { return { recommendation: 'UNDER_REVIEW', why: ['The automated review has not run.'], todo: ['Run validate-head'], scores: sc, barriers: bs, auto: false }; }
    var techFail = S.TECHNICAL.gatesFailed || [];
    if (hit.length) { hit.forEach(function (b) { why.push(b.id + ' ' + b.label + (b.evidence.length ? ': ' + b.evidence.join('; ') : '')); }); return { recommendation: 'REJECTED', why: why, todo: [], scores: sc, barriers: bs, auto: hit.every(function (b) { return b.by === 'auto'; }) }; }
    if (techFail.length) { return { recommendation: 'REJECTED', why: techFail.map(function (g) { return 'Technical gate failed: ' + g; }), todo: [], scores: sc, barriers: bs, auto: true }; }
    var humanSections = ['VISUAL', 'PRESENCE', 'SPEECH', 'EXPRESSION', 'IDENTITY'].filter(function (k) { return S[k].value == null; });
    var unknownBarriers = bs.filter(function (b) { return b.triggered == null && b.mode.indexOf('human') >= 0; });
    if (humanSections.length || unknownBarriers.length) {
      humanSections.forEach(function (k) { todo.push('HUMAN REVIEW REQUIRED: ' + k + ' (' + (S[k].pending || []).join(', ') + ')'); });
      if (unknownBarriers.length) todo.push('HUMAN REVIEW REQUIRED: confirm barriers ' + unknownBarriers.map(function (b) { return b.id; }).join(', ') + ' (yes or no)');
      return { recommendation: 'UNDER_REVIEW', why: ['No automatic barrier and no technical gate failed; the human review is not finished.'], todo: todo, scores: sc, barriers: bs, auto: false };
    }
    var total = sc.scorecard.value, low = sc.lowest ? sc.lowest.score : 5, sp = S.SPEECH.mean, pres = CONFIG.presence.questions.every(function (q) { var x = ratings.presenceVotes[q.id]; return x && x.yes / (x.yes + x.no) >= P.presenceYes; });
    var idOk = sc.items.filter(function (i) { return i.cat === 'IDENTITY'; }).every(function (i) { return i.score >= 4; }), techOk = S.TECHNICAL.value >= 85;
    if (sp < P.speechReject) { return { recommendation: 'REJECTED', why: ['SPEECH ' + S.SPEECH.value + '% (mean ' + sp + '/5) is below the rejection line of ' + P.speechReject + '/5. A head that is good still and bad speaking is not accepted.'], todo: [], scores: sc, barriers: bs, auto: false }; }
    var fronts = [['visual quality (scorecard >= ' + P.total + ', no item < ' + P.itemMin + ')', total >= P.total && low >= P.itemMin], ['speech (mean >= ' + P.speech + ')', sp >= P.speech], ['executive presence (3 questions >= ' + P.presenceYes * 100 + '% yes)', pres],
      ['character identity (I1 to I4 >= 4)', idOk], ['technical (>= 85% of automatic points)', techOk]];
    var fail = fronts.filter(function (f) { return !f[1]; }).map(function (f) { return f[0]; });
    if (!fail.length) return { recommendation: 'PASS', why: ['All fronts pass: scorecard ' + total + '/100, speech ' + S.SPEECH.value + '%, presence, identity and technical (' + S.TECHNICAL.value + '%).'], todo: [], scores: sc, barriers: bs, auto: false };
    var cond = total >= P.conditional && low >= P.itemMinConditional && sp >= 3.5;
    fail.forEach(function (k) { why.push('Does not pass: ' + k); });
    return { recommendation: cond ? 'CONDITIONAL' : 'REJECTED', why: why.concat(cond ? ['Within reach: return to the vendor with the fix list (max two rounds).'] : ['Below the conditional line (scorecard >= ' + P.conditional + ', no item < ' + P.itemMinConditional + ', speech >= 3.5).']), todo: [], scores: sc, barriers: bs, auto: false };
  }
  /* The human signs the decision. PASS and CONDITIONAL only when the recommendation says so; REJECTED may be a human override. */
  function decide(c, decision, by, reason) {
    if (['PASS', 'CONDITIONAL', 'REJECTED'].indexOf(decision) < 0) throw err('BAD_DECISION', 'decision must be PASS, CONDITIONAL or REJECTED');
    if (!by) throw err('NO_SIGNATURE', 'A decision needs the name of the person who signs it (--by)');
    if (!c.review) throw err('NO_REVIEW', c.id + ' has no review');
    var rec = recommend(c.review.automated, c.review.ratings);
    if (decision !== 'REJECTED' && rec.recommendation !== decision) throw err('DECISION_NOT_SUPPORTED', 'The review recommends ' + rec.recommendation + ', so ' + decision + ' cannot be signed. ' + (rec.todo.concat(rec.why)).join(' '));
    var n = transition(c, decision, { by: by, event: 'decision' }); n.decision = { decision: decision, by: by, date: today(), reason: reason || '', recommendation: rec.recommendation, why: rec.why, configHash: configHash(), scores: { sections: Object.keys(rec.scores.sections).reduce(function (o, k) { o[k] = rec.scores.sections[k].value; return o; }, {}), total: rec.scores.scorecard.value } }; return n;
  }

  /* ================= comparison, with WHY ================= */
  var RANK_ORDER = ['SPEECH', 'PRESENCE', 'IDENTITY', 'EXPRESSION', 'VISUAL', 'TECHNICAL'];
  function compare(cands) {
    var rows = cands.map(function (c) {
      var r = c.review ? recommend(c.review.automated, c.review.ratings) : null, S = r ? r.scores.sections : null;
      return { id: c.id, name: c.name, version: c.version, state: c.state, recommendation: r ? r.recommendation : c.state, sections: S ? RANK_ORDER.concat([]).reduce(function (o, k) { o[k] = S[k].value; return o; }, {}) : {}, total: r ? r.scores.scorecard.value : null,
        barriers: r ? r.barriers.filter(function (b) { return b.triggered === true; }).map(function (b) { return b.id; }) : [], pending: r ? r.todo : ['no review'], why: r ? r.why : [] };
    });
    var eligible = rows.filter(function (r) { return !r.barriers.length && r.recommendation !== 'REJECTED' && RANK_ORDER.every(function (k) { return r.sections[k] != null; }); });
    eligible.sort(function (a, b) { for (var i = 0; i < RANK_ORDER.length; i++) { var k = RANK_ORDER[i], d = b.sections[k] - a.sections[k]; if (Math.abs(d) >= 3) return d; } return (b.total || 0) - (a.total || 0); });
    var notRanked = rows.filter(function (r) { return eligible.indexOf(r) < 0; }).map(function (r) { return { id: r.id, reason: r.barriers.length ? 'barriers ' + r.barriers.join(', ') : r.recommendation === 'REJECTED' ? 'rejected' : 'human review incomplete: ' + r.pending.join(' | ') }; });
    var why = [];
    for (var i = 0; i + 1 < eligible.length; i++) {
      var a = eligible[i], b = eligible[i + 1], k = RANK_ORDER.filter(function (x) { return Math.abs(a.sections[x] - b.sections[x]) >= 3; })[0];
      why.push(k ? a.id + ' ranks above ' + b.id + ' because of ' + k + ' (' + a.sections[k] + '% vs ' + b.sections[k] + '%); the order of importance is ' + RANK_ORDER.join(' > ') + '.' : a.id + ' and ' + b.id + ' are within 3 points on every section; ' + a.id + ' has the higher scorecard total (' + a.total + ' vs ' + b.total + ').');
    }
    if (eligible.length === 1 && notRanked.length) why.push(eligible[0].id + ' is the only candidate that is complete and free of barriers.');
    if (!eligible.length) why.push('No candidate can be ranked: ' + (notRanked.map(function (n) { return n.id + ': ' + n.reason; }).join('; ') || 'no candidates') + '.');
    return { rows: rows, ranking: eligible.map(function (r) { return r.id; }), winner: eligible.length ? eligible[0].id : null, notRanked: notRanked, why: why, order: RANK_ORDER };
  }

  WA.HeadGate = { CONFIG: CONFIG, configHash: configHash, stable: stable, hash: hash, STATES: STATES, TRANSITIONS: TRANSITIONS, ID_RE: ID_RE, canTransition: canTransition, createCandidate: createCandidate, registerAsset: registerAsset, transition: transition,
    attachReview: attachReview, metrics: metrics, attachRatings: attachRatings, mergeRatings: mergeRatings, REVIEW_EXPRESSIONS: REVIEW_EXPRESSIONS, requiredChannels: requiredChannels, mappingReport: mappingReport,
    score: score, barriers: barriers, HR: HR, recommend: recommend, decide: decide, compare: compare, SPEECH_ITEMS: SPEECH_ITEMS, SPEECH_LABELS: SPEECH_LABELS, median: median, yesToScore: yesToScore, autoItems: autoItems };
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== review/HeadReview.js ===== */
/*
 * HeadReview: runs the standard review of ONE head candidate in a browser and returns a plain, serialisable result.
 *
 *   technical      the existing AssetValidator (not duplicated), phase "head"
 *   mapping        which morph targets drive the Bible expressions (HeadGate.mappingReport)
 *   shots          the 10 standard stills, under the single review configuration
 *   presence       the 1.5 second presence test: scripted cues, 6 frames, measured events
 *   speech         the standard sentence driven through the real engine, with stability metrics and viseme stills
 *   expression     the 10 review expressions: deformation, distinctness
 *   transitions    NEUTRAL>LISTENING>THINKING>FIRM>NEUTRAL and NEUTRAL>SKEPTICAL>SPEAKING>NEUTRAL
 *
 * Every part runs in its OWN fresh avatar, built from the same configuration (canvas, pixel ratio, camera, lighting, quality),
 * stepped with a fixed time step and never with the wall clock. Same file in, same pixels out.
 * Nothing here judges beauty: it produces stills and measurements, and says what only a person can decide.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, AV = WA.AssetValidator, HG = WA.HeadGate, CFG = HG.CONFIG, L = CFG.limits;

  function pct(a, p) { var s = a.slice().sort(function (x, y) { return x - y; }); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; }
  function jerk(series) {                                // p95 of the second difference, relative to the series peak (0 = perfectly smooth)
    var mx = Math.max.apply(null, series.concat([1e-9])), d = []; for (var i = 1; i < series.length - 1; i++) d.push(Math.abs(series[i + 1] - 2 * series[i] + series[i - 1]) / mx); return +pct(d, 0.95).toFixed(4);
  }
  function std(a) { if (!a.length) return 0; var m = a.reduce(function (x, y) { return x + y; }, 0) / a.length; return Math.sqrt(a.reduce(function (x, y) { return x + (y - m) * (y - m); }, 0) / a.length); }
  function isBlink(ch) { return !!ch && (ch.eyeBlinkLeft > 0.45 || ch.eyeBlinkRight > 0.45); }
  /* drops the frames of a blink (and one frame either side): a blink is the fastest legitimate motion of the face and must not read as popping or jerk */
  function noBlink(series, blinkMask) { var out = []; for (var i = 0; i < series.length; i++) if (!blinkMask[i] && !blinkMask[i - 1] && !blinkMask[i + 1]) out.push(series[i]); return out; }
  function settleNoBlink(av) { var k = 0; while (isBlink(av.debug().channels) && k++ < 30) av.advance(CFG.step, true); av.advance(0.1, true); }
  function imgHash(url) { return HG.hash(url); }

  /* a fresh avatar for one part of the review, built from the single configuration */
  function withAvatar(source, fn) {
    var box = document.createElement('div'); box.style.cssText = 'position:fixed;left:-30000px;top:0;width:' + CFG.canvas.width + 'px;height:' + CFG.canvas.height + 'px;pointer-events:none;'; document.body.appendChild(box);
    var av = WA.createAvatar(box, { paused: true, adaptive: false, quality: CFG.quality, pixelRatio: CFG.canvas.pixelRatio, shot: CFG.camera.shot, style: CFG.camera.style, look: CFG.camera.look, autoState: false,
      avatar: { source: 'glb', data: source.data.slice(0), rigMap: source.rigMap, fallback: false } });
    function done() { try { av.destroy(); } catch (e) {} if (box.parentNode) box.parentNode.removeChild(box); }
    return av.ready.then(function (r) {
      if (!av.model || av.getModelInfo().kind !== 'glb') throw (r && r.error) || WA.AvatarError('REVIEW_NEEDS_GLB', 'The candidate did not load as a GLB');
      if (source.prepare) source.prepare(av);   // test seam: lets a test damage the loaded model
      av.setLighting(CFG.lighting); av.lookAt('camera'); av.advance(3, true);
      return Promise.resolve(fn(av)).then(function (v) { done(); return v; }, function (e) { done(); throw e; });
    });
  }
  function drive(av, d) {
    if (d.state) av.setCognitiveState(d.state);
    if (d.expression) av.setExpression(d.expression, d.intensity == null ? undefined : { intensity: d.intensity });
  }
  function toBase(av, orbit, gaze) {
    av.stopSpeaking(); av.setCameraStyle(CFG.camera.style, 0.01); av.setShot(CFG.camera.shot, { style: CFG.camera.style, duration: 0.01 }); av.setLighting(CFG.lighting);
    av.setOrbit(CFG.orbit[orbit || 'front'], true); av.lookAt(gaze || 'camera');
  }
  function field(av, cache) { var f = AV.currentField(av.model, cache); return f ? { f: f, m: AV.fieldMetrics(av.model, f) } : null; }
  function eyeYaw(model) {
    var T = root.THREE, B = model.bones, v = new T.Vector3(), out = {};
    ['leftEye', 'rightEye'].forEach(function (s) { var b = B[s]; if (!b) return; b.obj.updateWorldMatrix(true, false); v.set(0, 0, 1).transformDirection(b.obj.matrixWorld); out[s] = Math.atan2(v.x, v.z); });
    return out.leftEye != null && out.rightEye != null ? out : null;
  }

  /* ---------------- shots ---------------- */
  function runShots(source, spec) {
    var info = WA.SpeechScript.info(), times = WA.SpeechScript.stillTimes();
    return withAvatar(source, function (av) {
      var out = [];
      CFG.shots.forEach(function (sh) {
        if (sh.kind === 'presence') return;
        toBase(av, sh.orbit, sh.gaze);
        if (sh.kind === 'pose') {
          drive(av, sh.pose); av.advance(CFG.settle, true);
          if (sh.waitFor === 'gazeAway') { var k = 0; while (!av.debug().gaze.away && k++ < 30 * 25) av.advance(CFG.step, true); av.advance(0.4, true); }
        } else {
          av.setCognitiveState('LISTENING'); av.advance(2, true);
          if (sh.framing) { av.setCameraStyle(sh.framing, 0.01); av.setLighting(CFG.lighting); av.advance(3, true); }
          av.speak(null, { phonemes: info.events, provider: 'phonemes' }).catch(function () {});
          var t0 = times[sh.still], n = Math.round(t0 * 30); for (var i = 0; i < n; i++) av.advance(CFG.step, true);
        }
        var url = av.capture(); out.push({ id: sh.id, width: CFG.canvas.width, height: CFG.canvas.height, hash: imgHash(url), dataUrl: spec.keepImages === false ? null : url });
        av.stopSpeaking();
      });
      return out;
    });
  }

  /* ---------------- 1.5 second presence test ---------------- */
  function runPresence(source, spec) {
    var P = CFG.presence;
    return withAvatar(source, function (av) {
      toBase(av, 'front', 'camera'); av.setExpression('neutral'); av.advance(4, true);
      // the clip starts so that the engine's breath inhale begins exactly at the 0.6 s cue (the breath cycle is deterministic)
      var T0 = Math.ceil((av.debug().time + 0.6) / P.breathPeriod) * P.breathPeriod - 0.6, k = Math.round((T0 - av.debug().time) * 30); for (var i = 0; i < k; i++) av.advance(CFG.step, true);
      var cache = {}, frames = [], series = [], cues = [0, 9, 18, 27, 36, 45], base = field(av, cache);
      for (var s = 0; s <= 45; s++) {
        if (s === 9) av.lookAt(P.microEye.x, P.microEye.y);
        if (s === 27) av.setExpression(P.microFace.expression, { intensity: P.microFace.intensity });
        if (s === 36) av.lookAt('camera');
        var d = av.debug(), fm = field(av, cache);
        series.push({ blink: isBlink(d.channels), s: s, t: +(s / 30).toFixed(3), yaw: d.gaze.yaw, pitch: d.gaze.pitch, breath: d.pose.breath, head: [d.pose.headYaw, d.pose.headPitch, d.pose.headRoll], rms: fm ? fm.m.rms : 0, max: fm ? fm.m.max : 0 });
        if (cues.indexOf(s) >= 0) { var url = av.capture(); frames.push({ t: +(s / 30).toFixed(1), cue: P.cues[cues.indexOf(s)].what, hash: imgHash(url), dataUrl: spec.keepImages === false ? null : url }); }
        if (s < 45) av.advance(CFG.step, true);
      }
      var at = function (t) { return series[Math.round(t * 30)]; }, atNB = function (t) { var i = Math.round(t * 30); for (var j = 0; j < 8; j++) { if (series[i + j] && !series[i + j].blink) return series[i + j]; if (series[i - j] && !series[i - j].blink) return series[i - j]; } return series[i]; }, eyeMove = Math.hypot(at(0.6).yaw - at(0.3).yaw, at(0.6).pitch - at(0.3).pitch) + Math.hypot(at(0.3).yaw - at(0.0).yaw, at(0.3).pitch - at(0.0).pitch);
      var breathRise = at(1.2).breath - at(0.6).breath, change = Math.abs(atNB(1.5).rms - atNB(0.9).rms), tail = series.slice(36), headMotion = Math.max.apply(null, series.map(function (x) { return Math.max(Math.abs(x.head[0] - series[0].head[0]), Math.abs(x.head[1] - series[0].head[1]), Math.abs(x.head[2] - series[0].head[2])); }));
      var m = { eyeMove: +eyeMove.toFixed(4), eyeMoveDetected: eyeMove >= L.microEyeMin, breathRise: +breathRise.toFixed(3), breathDetected: breathRise >= L.breathMin, faceChange: +change.toFixed(5), faceChangeInRange: change >= L.faceChange[0] && change <= L.faceChange[1],
        eyeStableAtEnd: std(tail.map(function (x) { return x.yaw; })) <= L.eyeStableStd && std(tail.map(function (x) { return x.pitch; })) <= L.eyeStableStd, headMotion: +headMotion.toFixed(4), fidget: headMotion > L.fidgetMax };
      return { seconds: P.seconds, cues: P.cues, frames: frames, series: series.filter(function (x) { return x.s % 3 === 0; }), metrics: m, questions: P.questions, humanReview: 'REQUIRED: the observer answers A, B and C' };
    });
  }

  /* ---------------- speech test ---------------- */
  function runSpeech(source, spec) {
    var info = WA.SpeechScript.info(), still = WA.SpeechScript.stillTimes();
    return withAvatar(source, function (av) {
      toBase(av, 'front', 'camera'); av.setCognitiveState('LISTENING'); av.advance(3, true);
      var cache = {}, fr = [], blinkMask = [], stills = [], seenV = {}, n = Math.ceil(info.seconds * 30) + 12, model = av.model, wantStill = Object.keys(still).map(function (v) { return { v: v, i: Math.round(still[v] * 30) }; });
      av.speak(null, { phonemes: info.events, provider: 'phonemes' }).catch(function () {});
      for (var i = 0; i < n; i++) {
        av.advance(CFG.step, true); var d = av.debug(), fm = field(av, cache), ey = eyeYaw(model);
        Object.keys(d.visemes || {}).forEach(function (v) { if (d.visemes[v] > 0.5) seenV[v] = (seenV[v] || 0) + 1; });
        blinkMask.push(isBlink(d.channels)); fr.push({ t: (i + 1) / 30, lower: fm ? fm.m.lower : 0, mid: fm ? fm.m.mid : 0, upper: fm ? fm.m.upper : 0, peak: fm ? fm.m.max : 0, rms: fm ? fm.m.rms : 0, jaw: d.channels.jawOpen, yawL: ey ? ey.leftEye : null, yawR: ey ? ey.rightEye : null });
        wantStill.forEach(function (w) { if (w.i === i + 1) { var url = av.capture(); stills.push({ id: w.v, t: +((i + 1) / 30).toFixed(2), hash: imgHash(url), dataUrl: spec.keepImages === false ? null : url }); } });
      }
      av.stopSpeaking();
      var lower = fr.map(function (x) { return x.lower; }), peak = Math.max.apply(null, noBlink(fr, blinkMask).map(function (x) { return x.peak; })), lowerNB = noBlink(lower, blinkMask), midNB = noBlink(fr.map(function (x) { return x.mid; }), blinkMask), jawNB = noBlink(fr.map(function (x) { return x.jaw; }), blinkMask);
      // mouth movements: peaks of the lower-face displacement that stand out from the valleys on either side (about one per syllable nucleus)
      var mx = Math.max.apply(null, lower), cycles = 0; for (var q = 3; q < lower.length - 3; q++) { var v0 = lower[q]; if (v0 >= lower[q - 1] && v0 > lower[q + 1]) { var lo1 = Math.min.apply(null, lower.slice(Math.max(0, q - 8), q)), lo2 = Math.min.apply(null, lower.slice(q, Math.min(lower.length, q + 9))); if (v0 - Math.max(lo1, lo2) >= 0.12 * mx) cycles++; } }
      var at = function (e) { return Math.min(fr.length - 1, Math.round((e.t + e.d * 0.6) * 30)); }, clos = info.events.filter(function (e) { return e.ph === 'P' || e.ph === 'B' || e.ph === 'M'; }), opn = info.events.filter(function (e) { return e.ph === 'AE' || e.ph === 'AA' || e.ph === 'AO'; });
      var avg = function (es) { return es.length ? es.reduce(function (a, e) { return a + fr[at(e)].jaw; }, 0) / es.length : 0; }, contrast = avg(opn) > 1e-6 ? avg(clos) / avg(opn) : 1;
      var align = fr.filter(function (x) { return x.yawL != null; }).map(function (x) { return Math.abs(x.yawL - x.yawR); }), eyeAlign = align.length ? Math.max.apply(null, align) : null;
      var missingV = info.requiredVisemes.filter(function (v) { return !seenV[v]; });
      var m = { frames: fr.length, seconds: info.seconds, syllables: info.syllables, cycles: cycles, cyclesPerSyllable: +(cycles / info.syllables).toFixed(2), jerkJaw: jerk(lowerNB), jerkCheeks: jerk(midNB), jerkChin: jerk(jawNB), closureContrast: +contrast.toFixed(2), eyeAlignMax: eyeAlign == null ? null : +eyeAlign.toFixed(3),
        peakDisplacement: +peak.toFixed(4), faceLife: +std(noBlink(fr, blinkMask).map(function (x) { return x.mid + x.upper; })).toExponential(2), visemesNotReached: missingV };
      var flags = [];
      if (cycles / info.syllables < L.cyclesPerSyllable[0]) flags.push('no mouth movement: ' + cycles + ' mouth cycles for ' + info.syllables + ' syllables'); else if (cycles / info.syllables > L.cyclesPerSyllable[1]) flags.push('jerk: frantic mouth (' + m.cyclesPerSyllable + ' cycles per syllable)');
      if (m.jerkJaw > L.jerkP95) flags.push('jerk: jaw/lower face (p95 ' + m.jerkJaw + ')'); if (m.jerkCheeks > L.jerkP95) flags.push('jerk: cheeks (p95 ' + m.jerkCheeks + ')'); if (m.jerkChin > L.jerkP95) flags.push('jerk: chin (p95 ' + m.jerkChin + ')');
      if (contrast > L.closureContrast) flags.push('closures do not close: jaw at p/b/m is ' + Math.round(contrast * 100) + '% of the open vowels (limit ' + L.closureContrast * 100 + '%)');
      if (eyeAlign != null && eyeAlign > L.eyeAlign) flags.push('eyes misaligned while speaking (' + eyeAlign.toFixed(3) + ' rad)');
      if (peak > L.speechPeak) flags.push('deformation: peak ' + peak.toFixed(3) + ' of head height (limit ' + L.speechPeak + ')');
      if (std(noBlink(fr, blinkMask).map(function (x) { return x.mid + x.upper; })) < 2e-5) flags.push('frozen face: no movement outside the mouth while speaking');
      if (missingV.length) flags.push('visemes never reached: ' + missingV.join(', '));
      return { script: { text: info.text, seconds: info.seconds, syllables: info.syllables, requiredVisemes: info.requiredVisemes }, metrics: m, flags: flags, stills: stills, series: fr.filter(function (x, i) { return i % 3 === 0; }).map(function (x) { return { t: +x.t.toFixed(2), lower: +x.lower.toFixed(5), jaw: +(x.jaw || 0).toFixed(3) }; }),
        checklist: HG.SPEECH_ITEMS.map(function (k) { return { id: k, label: HG.SPEECH_LABELS[k] }; }), humanReview: 'REQUIRED: the 12 speech checklist items' };
    });
  }

  /* ---------------- expressions ---------------- */
  function runExpressions(source, spec) {
    return withAvatar(source, function (av) {
      var cache = {}, rows = [], fields = {}, sc;
      toBase(av, 'front', 'camera'); av.setExpression('neutral'); av.advance(4, true); settleNoBlink(av); var n0 = field(av, cache); sc = AV.worldScale(n0.f.mesh) / av.model.landmarks.headHeight;
      HG.REVIEW_EXPRESSIONS.forEach(function (e) {
        toBase(av, 'front', 'camera'); drive(av, e.drive); av.advance(CFG.settle, true); settleNoBlink(av); var fm = field(av, cache), d = av.debug(), url = av.capture(); fields[e.id] = fm.f.field;
        rows.push({ id: e.id, rms: +fm.m.rms.toFixed(5), max: +fm.m.max.toFixed(4), upper: +fm.m.upper.toFixed(5), mid: +fm.m.mid.toFixed(5), lower: +fm.m.lower.toFixed(5), asym: +fm.m.asym.toFixed(2), fromNeutral: +(AV.fieldDistance(fm.f.field, n0.f.field) * sc).toFixed(5), channels: d.channels && Object.keys(d.channels).filter(function (k) { return d.channels[k] > 0.15; }).length,
          hash: imgHash(url), dataUrl: spec.keepImages === false ? null : url });
      });
      rows.forEach(function (r) { var best = null; Object.keys(fields).forEach(function (o) { if (o === r.id) return; var other = HG.REVIEW_EXPRESSIONS.filter(function (e) { return e.id === o; })[0], mine = HG.REVIEW_EXPRESSIONS.filter(function (e) { return e.id === r.id; })[0]; if (JSON.stringify(other.drive) === JSON.stringify(mine.drive)) return; var dist = AV.fieldDistance(fields[r.id], fields[o]) * sc; if (!best || dist < best.d) best = { to: o, d: dist }; }); r.nearest = best ? best.to : null; r.nearestDist = best ? +best.d.toFixed(5) : null; r.drive = JSON.stringify(HG.REVIEW_EXPRESSIONS.filter(function (e) { return e.id === r.id; })[0].drive); r.dead = r.fromNeutral < 0.0003; r.exploding = r.max > L.exploding; r.overBudget = r.max > L.expressionPeak; });
      var sk = rows.filter(function (r) { return r.id === 'skeptical'; })[0];
      return { rows: rows, maxPeak: Math.max.apply(null, rows.map(function (r) { return r.max; })), skepticalAsym: sk ? sk.asym : null, dead: rows.filter(function (r) { return r.dead; }).map(function (r) { return r.id; }), exploding: rows.filter(function (r) { return r.exploding; }).map(function (r) { return r.id; }),
        overBudget: rows.filter(function (r) { return r.overBudget; }).map(function (r) { return r.id; }), indistinct: rows.filter(function (r) { var o = rows.filter(function (x) { return x.id === r.nearest; })[0]; return o && o.drive !== r.drive && r.nearestDist < 0.15 * Math.min(r.fromNeutral, o.fromNeutral); }).map(function (r) { return r.id + '~' + r.nearest; }), humanReview: 'REQUIRED: legibility of each expression, X1 one face, X3 asymmetry in the render' };
    });
  }

  /* ---------------- transitions ---------------- */
  function runTransitions(source) {
    var info = WA.SpeechScript.info();
    function sequence(av, name, steps) {
      var cache = {}, series = [], marks = [], sc = null, steady = [];
      toBase(av, 'front', 'camera'); av.setExpression('neutral'); av.advance(4, true);
      steps.forEach(function (st) {
        marks.push({ at: series.length, name: st.name });
        if (st.drive) drive(av, st.drive); if (st.speak) av.speak(null, { phonemes: info.events, provider: 'phonemes' }).catch(function () {});
        var n = Math.round(st.seconds * 30);
        for (var i = 0; i < n; i++) {
          av.advance(CFG.step, true); var fm = field(av, cache), d = av.debug(), ey = eyeYaw(av.model); sc = sc || AV.worldScale(fm.f.mesh) / av.model.landmarks.headHeight;
          series.push({ blink: isBlink(d.ch || d.channels), field: fm.f.field.slice(), rms: fm.m.rms, max: fm.m.max, lower: fm.m.lower, name: st.name, jaw: d.channels.jawOpen, ch: d.channels, yawL: ey && ey.leftEye, yawR: ey && ey.rightEye });
        }
        steady.push(series[series.length - 1]);
        if (st.speak) av.stopSpeaking();
      });
      var step = 0, stepS = 0, chStep = 0, peak = 0, peakS = 0, rmsMax = 0, ok = series.filter(function (x) { return !x.blink; }), calm = ok.filter(function (x) { return x.name !== 'SPEAKING'; }), talk = ok.filter(function (x) { return x.name === 'SPEAKING'; });
      for (var i = 1; i < series.length; i++) {
        if (series[i].blink || series[i - 1].blink) continue;                       // a blink is not a transition
        var a = series[i - 1].field, b = series[i].field, mx = 0; for (var k = 0; k < a.length; k += 3) { var dx = b[k] - a[k], dy = b[k + 1] - a[k + 1], dz = b[k + 2] - a[k + 2], dd = dx * dx + dy * dy + dz * dz; if (dd > mx) mx = dd; }
        var d1 = Math.sqrt(mx) * sc; if (series[i].name === 'SPEAKING') stepS = Math.max(stepS, d1); else step = Math.max(step, d1);
        Object.keys(series[i].ch).forEach(function (c) { if (!/Blink/.test(c)) chStep = Math.max(chStep, Math.abs(series[i].ch[c] - series[i - 1].ch[c])); });
      }
      calm.forEach(function (x) { peak = Math.max(peak, x.max); }); talk.forEach(function (x) { peakS = Math.max(peakS, x.max); }); ok.forEach(function (x) { rmsMax = Math.max(rmsMax, x.rms); });
      var steadyPeak = Math.max.apply(null, steady.filter(function (x) { return !x.blink && x.name !== 'SPEAKING'; }).map(function (x) { return x.max; })), excess = steadyPeak > 1e-9 ? peak / steadyPeak : 1;
      // information only: the engine adds micro-expressions, so the end of the sequence is never bit-identical to its start
      var avgField = function (from, to) { var acc = new Float32Array(series[0].field.length), n = 0; for (var q = from; q < to; q++) if (!series[q].blink) { for (var z = 0; z < acc.length; z++) acc[z] += series[q].field[z]; n++; } for (var y = 0; y < acc.length; y++) acc[y] /= Math.max(1, n); return acc; };
      var drift = AV.fieldDistance(avgField(series.length - 15, series.length), avgField(0, 15)) * sc / Math.max(rmsMax, 1e-9);
      var al = series.filter(function (x) { return x.yawL != null; }).map(function (x) { return Math.abs(x.yawL - x.yawR); }), speakSeries = talk.map(function (x) { return x.lower; });
      var m = { frames: series.length, blinkFrames: series.length - ok.length, maxVertexStep: +step.toFixed(5), maxVertexStepSpeech: talk.length ? +stepS.toFixed(5) : null, maxChannelStep: +chStep.toFixed(4), peak: +peak.toFixed(4), peakSpeech: talk.length ? +peakS.toFixed(4) : null, combinationExcess: +excess.toFixed(2), neutralDrift: +drift.toFixed(3), eyeAlignMax: al.length ? +Math.max.apply(null, al).toFixed(3) : null, jawJerk: speakSeries.length > 5 ? jerk(speakSeries) : null };
      var flags = [];
      if (m.maxVertexStep > L.vertexStep) flags.push('popping or snapping: a vertex moves ' + m.maxVertexStep + ' of head height in one frame between expressions (limit ' + L.vertexStep + ')');
      if (m.maxVertexStepSpeech != null && m.maxVertexStepSpeech > L.speechStep) flags.push('popping or snapping while speaking: a vertex moves ' + m.maxVertexStepSpeech + ' of head height in one frame (limit ' + L.speechStep + ')');
      if (m.combinationExcess > L.combinationExcess) flags.push('overshoot: the combined targets exceed the strongest steady state by ' + Math.round((m.combinationExcess - 1) * 100) + '%');
      if (m.peak > L.expressionPeak) flags.push('deformation: peak ' + m.peak + ' of head height between expressions (limit ' + L.expressionPeak + ')');
      if (m.peakSpeech != null && m.peakSpeech > L.speechPeak) flags.push('deformation while speaking: peak ' + m.peakSpeech + ' (limit ' + L.speechPeak + ')');
      if (m.eyeAlignMax != null && m.eyeAlignMax > L.eyeAlign) flags.push('eyes misaligned (' + m.eyeAlignMax + ' rad)');
      if (m.jawJerk != null && m.jawJerk > L.jerkP95) flags.push('artificial jaw: jerky while speaking (p95 ' + m.jawJerk + ')');
      return { name: name, steps: steps.map(function (s) { return s.name + ' ' + s.seconds + 's'; }), metrics: m, flags: flags };
    }
    var A = [{ name: 'NEUTRAL', seconds: 1, drive: { expression: 'neutral' } }, { name: 'LISTENING', seconds: 2.5, drive: { state: 'LISTENING' } }, { name: 'THINKING', seconds: 2.5, drive: { state: 'THINKING' } }, { name: 'FIRM', seconds: 2.5, drive: { expression: 'firm' } }, { name: 'NEUTRAL', seconds: 3, drive: { expression: 'neutral' } }];
    var B = [{ name: 'NEUTRAL', seconds: 1, drive: { expression: 'neutral' } }, { name: 'SKEPTICAL', seconds: 2.5, drive: { expression: 'skeptical' } }, { name: 'SPEAKING', seconds: 4.5, speak: true }, { name: 'NEUTRAL', seconds: 3, drive: { expression: 'neutral' } }];
    return withAvatar(source, function (av) { return sequence(av, 'A', A); }).then(function (a) { return withAvatar(source, function (av) { return sequence(av, 'B', B); }).then(function (b) {
      var flags = a.flags.map(function (f) { return 'A: ' + f; }).concat(b.flags.map(function (f) { return 'B: ' + f; }));
      return { A: a, B: b, flags: flags, humanReview: 'REQUIRED: loss of identity, excessive change of appearance, artificial jaw (look at the stills and the video)' };
    }); });
  }

  /* ---------------- the whole review ---------------- */
  /*
   * source: { id, version, sha256, data: ArrayBuffer, rigMap }.  opts: { keepImages (default true), fps (default true), onProgress }
   * Returns the automated review, ready for HeadGate.attachReview().
   */
  function run(source, opts) {
    opts = opts || {}; var say = opts.onProgress || function () {}, out = { schema: 1, configHash: HG.configHash(), candidate: { id: source.id, version: source.version || 1, sha256: source.sha256 }, generatedAt: new Date().toISOString(), renderer: AV.gpuInfo(), software: null };
    out.software = out.renderer.software;
    say('technical validation');
    return withAvatar(source, function (av) {
      var rep = null; return AV.runAll(av, { phase: 'head', fps: opts.fps !== false, fpsSeconds: 2 }).then(function (r) { out.validator = AV.serialize({ report: r.report, result: r.result }); out.mapping = HG.mappingReport(av.model.res); var names = {}; av.model.meshes.forEach(function (m) { Object.keys(m.morphTargetDictionary || {}).forEach(function (k) { names[k] = 1; }); }); out.file = { bytes: av.model.bytes || null, loadMs: av.model.loadMs || null, morphNames: Object.keys(names).sort() }; });
    }).then(function () { say('standard shots'); return runShots(source, opts); })
      .then(function (s) { out.shots = s; say('presence test'); return runPresence(source, opts); })
      .then(function (p) { out.presence = p; say('speech test'); return runSpeech(source, opts); })
      .then(function (s) { out.speech = s; say('expressions'); return runExpressions(source, opts); })
      .then(function (e) { out.expression = e; say('transitions'); return runTransitions(source); })
      .then(function (t) { out.transitions = t; say('done'); return out; });
  }

  WA.HeadReview = { run: run, runShots: runShots, runPresence: runPresence, runSpeech: runSpeech, runExpressions: runExpressions, runTransitions: runTransitions, withAvatar: withAvatar, jerk: jerk };
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== AvatarAPI.js ===== */
/*
 * AvatarAPI: the only surface the rest of the application needs.
 *
 *   const avatar = AvatarKit.createAvatar(container, { avatar: { source: 'glb', url: 'wendy.glb', rigMap }, shot: 'CLOSE' });
 *   avatar.setExpression('firm');                  // what the face shows
 *   avatar.setCognitiveState('CHALLENGE');          // what the agent is doing: face, gaze, posture follow
 *   avatar.speak(audio, { visemes, provider });     // mouth follows phonetic data if given, the audio if not
 *   avatar.setShot('CLOSE', { style: 'executive' });
 *   avatar.lookAt('camera');                        // camera | cursor | center | left | right | x, y
 *
 * Everything from v1 still works: setExpression, speak, stopSpeaking, setLevel, setViseme, setSpeaking,
 * isSpeaking, lookAt, idle, setShot, getShot, shots, on/off, pause/resume, advance, renderNow, debug, destroy.
 * Nothing outside this file touches meshes, morphs or materials.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, T = root.THREE, clamp = WA.clamp;

  WA.createAvatar = function (container, options) {
    options = options || {};
    if (!container || !container.appendChild) throw WA.AvatarError('BAD_CONTAINER', 'createAvatar needs a DOM element');
    if (!T) throw WA.AvatarError('NO_THREE', 'three.js is not loaded');
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;';
    container.appendChild(canvas);

    var renderer;
    try { renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
    catch (e) { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); throw WA.AvatarError('NO_WEBGL', 'WebGL is not available', e); }
    var quality = options.quality || 'high', fixedPR = options.pixelRatio > 0 ? +options.pixelRatio : 0, basePR = fixedPR || Math.min(root.devicePixelRatio || 1, quality === 'low' ? 1 : 2), prScale = 1;
    renderer.setPixelRatio(basePR);
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = quality !== 'low'; renderer.shadowMap.type = T.PCFSoftShadowMap;

    var scene = new T.Scene(), camera = new T.PerspectiveCamera(24, 1, 0.1, 200);
    var em = new WA.Emitter();
    var lighting = new WA.StudioLighting(renderer, scene, { style: options.style || 'conversation', quality: quality, backdrop: options.backdrop !== false });
    var adapter = new WA.AvatarAdapter(scene, renderer);
    var composer = new WA.ExpressionComposer({ context: options.context || 'conversation' });
    var anim = new WA.AnimationController(), gaze = new WA.GazeController(), lip = new WA.LipSyncController(), mixer = new WA.FaceMixer();
    var cam = new WA.CameraController(camera, canvas);
    var shotStyle = options.style || 'conversation';
    cam.setStyle(shotStyle, 0.01); cam.setShot(options.shot || 'CLOSE', { duration: 0.01, style: shotStyle });
    if (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) { anim.intensity = 0.4; cam.drift = 0.3; }

    function emit(name, data) { em.emit(name, data); }
    adapter.on('error', function (e) { emit('error', e); });
    adapter.on('warning', function (e) { emit('warning', e); });
    lip.on('warning', function (e) { emit('warning', e); });
    adapter.on('model', function (d) { cam.setLandmarks(d.landmarks, false); lighting.setLandmarks(d.landmarks); });
    adapter.on('failed', function () { if (adapter.model && adapter.model.getInfo().kind !== 'procedural') { emit('warning', WA.AvatarError('MODEL_FAILED', 'The model kept failing; switching to the procedural fallback')); api.loadAvatar({ source: 'procedural' }); } });

    var look = options.look === 'pointer' ? 'cursor' : (options.look || 'cursor'), pointer = { x: 0, y: 0 };
    gaze.setAim(look === 'manual' ? 'camera' : look);
    function onPointer(e) {
      var r = container.getBoundingClientRect();
      pointer.x = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1);
      pointer.y = clamp(-(e.clientY - (r.top + r.height * 0.35)) / (r.height / 2), -1, 1);
    }
    root.addEventListener('pointermove', onPointer);

    function resize() {
      var w = container.clientWidth, h = container.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); cam.setAspect(w / h);
    }
    var ro = root.ResizeObserver ? new root.ResizeObserver(resize) : null;
    if (ro) ro.observe(container); else root.addEventListener('resize', resize);
    resize();

    var running = !options.paused, visible = true, last = performance.now() / 1000, time = 0, raf = 0, destroyed = false, stepErrors = 0;
    var io = root.IntersectionObserver ? new root.IntersectionObserver(function (en) { visible = en[0].isIntersecting; }) : null;
    if (io) io.observe(container);
    var frameMs = 16, slowFor = 0, fastFor = 0, fps = 60, lastMixed = null, lastGaze = null, lipOut = null, comp = null, stepMs = 0;
    var autoState = options.autoState !== false, saved = null;

    /* ---------- one simulation step (separate from drawing, so tests and tools can advance time deterministically) ---------- */
    function step(dt) {
      var t0 = performance.now();
      time += dt;
      lipOut = lip.update(dt, time);
      comp = composer.update(dt, time, { speaking: lipOut.speaking, level: lipOut.level });
      var orbit = cam.update(dt, time), frame = cam.getFrame();
      var g = gaze.update(dt, time, { mode: comp.gaze, saccade: comp.saccade, attention: comp.attention, speaking: lipOut.speaking, emphasis: comp.emphasis, viewYaw: orbit, cursor: pointer, silence: lipOut.silence });
      var a = anim.update(dt, time, { head: comp.head, motion: comp.motion, nods: comp.nods, blinkScale: comp.blinkScale, gaze: { yaw: g.yaw, pitch: g.pitch, blink: g.blink },
        speaking: lipOut.speaking, activity: comp.act, emphasis: comp.emphasis, attention: comp.attention });
      var mixed = mixer.mix({ channels: comp.channels, blink: a.blink, gazePitch: g.pitch, visemes: lipOut.visemes, level: lipOut.level, speaking: lipOut.speaking, silence: lipOut.silence,
        t: time, dt: dt, nativeVisemes: adapter.hasNativeVisemes(), recipes: adapter.model && adapter.model.visemeRecipes || null });
      var pose = a.pose; pose.chest = clamp(pose.chest + mixer.breath * 0.6, 0, 1.4); pose.breath = clamp(pose.breath + mixer.breath * 0.3, 0, 1.4);
      adapter.setExpression(mixed); if (mixer.visOut) adapter.setViseme(mixer.visOut);
      adapter.setMouthLevel(lipOut.level); adapter.setEyeTarget(g.yaw, g.pitch, g.eyes);
      adapter.setHeadRotation(pose.headYaw, pose.headPitch, pose.headRoll); adapter.setBodyPose(pose);
      adapter.update(dt);
      lighting.setFocus(frame.y, Math.max(1.5, frame.vis * 0.62)); lighting.setBackdropYaw(orbit + frame.az); lighting.update(dt);
      if (adapter.model && adapter.model.setEnvIntensity) adapter.model.setEnvIntensity(lighting.envIntensity);
      lastMixed = mixed; lastGaze = g; stepMs += (performance.now() - t0 - stepMs) * 0.1;
      emit('tick', dt);
    }
    function draw() { renderer.render(scene, camera); }
    function frame() {
      if (destroyed) return;
      raf = root.requestAnimationFrame(frame);
      if (!running || !visible || document.hidden) { last = performance.now() / 1000; return; }
      var now = performance.now() / 1000, raw = now - last, dt = Math.min(0.05, raw); last = now;
      try { step(dt); draw(); stepErrors = 0; }
      catch (e) { stepErrors++; if (stepErrors === 1) emit('error', WA.AvatarError('FRAME_ERROR', 'Render loop error: ' + e.message, e)); if (stepErrors >= 5) { running = false; emit('fatal', e); } return; }
      frameMs += (raw * 1000 - frameMs) * 0.08; fps = 1000 / Math.max(1, frameMs);
      if (options.adaptive !== false) {            // adaptive resolution: protect the frame rate on weak GPUs
        if (frameMs > 26) { slowFor += raw; fastFor = 0; } else if (frameMs < 15) { fastFor += raw; slowFor = 0; } else { slowFor = fastFor = 0; }
        if (slowFor > 2 && prScale > 0.6) { prScale = Math.max(0.6, prScale - 0.15); renderer.setPixelRatio(basePR * prScale); resize(); slowFor = 0; emit('quality', { pixelRatio: basePR * prScale }); }
        else if (fastFor > 6 && prScale < 1) { prScale = Math.min(1, prScale + 0.15); renderer.setPixelRatio(basePR * prScale); resize(); fastFor = 0; emit('quality', { pixelRatio: basePR * prScale }); }
      }
    }
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); running = false; emit('contextlost'); });
    canvas.addEventListener('webglcontextrestored', function () { running = !options.paused; last = performance.now() / 1000; emit('contextrestored'); });

    /* ---------- speech helpers ---------- */
    function snapshot() { saved = { cog: composer.cog.name, mix: composer.expr.mix.map(function (m) { return { name: m.name, w: m.w }; }), override: composer.override }; }
    function restore() {
      if (!saved) return; var s = saved; saved = null;
      if (composer.cog.name !== 'SPEAKING') return;                       // the application took over meanwhile: leave it
      if (s.cog) composer.setCognitive(s.cog, time); else { composer.cog.clear(); composer.expr.setMix(s.mix); }
      emit('cognitive', composer.getCognitive());
    }

    var api = {
      /* ---------- expression ---------- */
      /* name: neutral listening thinking analyzing confident firm skeptical empathetic surprised concerned decisive (any case). opts: { intensity 0..1.2, transition } */
      setExpression: function (name, opts) { var ok = composer.setEmotion(String(name).toLowerCase(), opts); if (ok) emit('expression', composer.getEmotion()); else emit('warning', WA.AvatarError('UNKNOWN_EXPRESSION', 'Unknown expression "' + name + '". Known: ' + WA.ExpressionController.names.join(', '))); return ok; },
      getExpression: function () { return composer.getEmotion(); },
      expressions: WA.ExpressionController.names.slice(),

      /* name: LISTENING PROCESSING THINKING SPEAKING DECIDING WARNING EMPATHY CHALLENGE CONFIDENCE */
      setCognitiveState: function (name, opts) { if (name == null || name === '') { composer.cog.clear(); composer.override = false; composer.expr.setMix([{ name: 'neutral', w: 1 }]); saved = null; emit('cognitive', composer.getCognitive()); return true; } var ok = composer.setCognitive(name == null ? '' : String(name).toUpperCase(), time, opts); if (ok) { saved = null; emit('cognitive', composer.getCognitive()); emit('expression', composer.getEmotion()); } else emit('warning', WA.AvatarError('UNKNOWN_STATE', 'Unknown cognitive state "' + name + '". Known: ' + WA.CognitiveState.names.join(', '))); return ok; },
      getCognitiveState: function () { return composer.getCognitive(); },
      cognitiveStates: WA.CognitiveState.names.slice(),
      /* conversation | executive | intimate: how much the face shows and how much it moves */
      setContext: function (c) { var ok = composer.setContext(c); if (ok) emit('context', c); return ok; },
      contexts: Object.keys(WA.Contexts),
      setAttention: function (a) { composer.setAttention(a); },

      /* ---------- speech ---------- */
      /*
       * audio: AudioBuffer, Float32Array PCM, ArrayBuffer, Blob/File, HTMLAudioElement, MediaStream, URL, or null (timeline only).
       * opts: { visemes | phonemes | characters | alignment | marks, provider: 'azure'|'polly'|'phonemes'|..., offset, sampleRate }
       * Resolves when playback ends. Rejects with AvatarError (NO_SOURCE, DECODE_FAILED, PLAY_BLOCKED, ...).
       */
      speak: function (src, opts) {
        var cn = composer.cog.name;
        if (autoState && (!cn || /^(LISTENING|PROCESSING|THINKING)$/.test(cn))) { snapshot(); composer.setCognitive('SPEAKING', time); emit('cognitive', 'SPEAKING'); }
        adapter.setSpeaking(true); emit('speakstart', src);
        return lip.speak(src, opts).then(function () { adapter.setSpeaking(false); restore(); emit('speakend'); }, function (e) { adapter.setSpeaking(false); restore(); emit('speakend'); throw e; });
      },
      stopSpeaking: function () { lip.stop(); lip.setSyntheticSpeaking(false); adapter.setSpeaking(false); restore(); emit('speakend'); },
      pauseSpeech: function () { var ok = lip.pause(); if (ok) emit('speechpause'); return ok; },
      resumeSpeech: function () { var ok = lip.resume(); if (ok) emit('speechresume'); return ok; },
      isPaused: function () { return lip.paused; },
      setLevel: function (v) { lip.setLevel(v); },
      setViseme: function (name, weight) { lip.setViseme(name, weight); },
      setSpeaking: function (on) { lip.setSyntheticSpeaking(on); adapter.setSpeaking(on); if (on) emit('speakstart'); else emit('speakend'); },
      isSpeaking: function () { return lip.isSpeaking(); },

      /* ---------- gaze ---------- */
      /* 'camera' | 'cursor' ('pointer') | 'center' | 'left' | 'right' | 'down' | 'up' | x, y in -1..1 (screen space). left/right are screen directions. */
      lookAt: function (x, y) {
        if (x === 'pointer') x = 'cursor';
        if (x == null) x = 'camera';
        var ok = gaze.setAim(x, y); if (ok) emit('gaze', gaze.getAim()); return ok;
      },
      getGazeTarget: function () { return gaze.getAim(); },

      /* a one-off body gesture: 'nod' (a small acknowledging nod), 'blink'. Returns false for an unknown name. */
      gesture: function (name) { if (name === 'nod') { anim.nod.start = time; anim.nod.amp = 0.04; anim.nod.next = time + 5; return true; } if (name === 'blink') { var b = anim._b; if (b && b.start < 0) { b.start = time; b.dbl = false; b.second = false; } return true; } return false; },

      /* ---------- idle ---------- */
      idle: function (o) {
        if (o === false) o = { intensity: 0 }; o = o || {};
        if (o.intensity != null) { anim.intensity = clamp(o.intensity, 0, 1); cam.drift = anim.intensity; adapter.setIdle(anim.intensity); }
        if (o.blink != null) anim.blinkEnabled = !!o.blink;
      },

      /* ---------- camera and light ---------- */
      /* name: CLOSE | MEDIUM | FULL (also closeup, medium, full). o: { style: conversation|executive|intimate, duration } or a duration in seconds */
      setShot: function (name, o) { var ok = cam.setShot(name, o); if (ok) { if (o && o.style) { shotStyle = o.style; lighting.setStyle(o.style); } emit('shot', cam.shot); } return ok; },
      getShot: function () { return cam.shot; },
      shots: ['CLOSE', 'MEDIUM', 'FULL'],
      setCameraStyle: function (s, d) { var ok = cam.setStyle(s, d); if (ok) { shotStyle = s; lighting.setStyle(s); emit('style', s); } return ok; },
      getCameraStyle: function () { return cam.style; },
      styles: Object.keys(WA.CameraController.STYLES),
      setLighting: function (style) { return lighting.setStyle(style); },
      /* camera azimuth in radians, held until the user drags (0 front, 0.61 three-quarter, 1.571 profile) */
      setOrbit: function (rad, instant) { cam.setOrbit(rad, instant); },
      /* renders the current frame and returns it as a PNG data URL (same pixels as the canvas) */
      capture: function (type) { draw(); return canvas.toDataURL(type || 'image/png'); },
      setQuality: function (q) { var ok = lighting.setQuality(q); if (ok) { quality = q; basePR = fixedPR || Math.min(root.devicePixelRatio || 1, q === 'low' ? 1 : 2); renderer.setPixelRatio(basePR * prScale); renderer.shadowMap.enabled = q !== 'low'; resize(); } return ok; },

      /* ---------- model ---------- */
      /*
       * spec: { source: 'glb'|'procedural'|'auto', url | data | file, rigMap, fallback } or a url string.
       * Resolves { source, fallback, error, info, rigReport }. With fallback the promise does not reject: the procedural model is used and `error` says why.
       */
      loadAvatar: function (spec) {
        emit('loading', spec);
        var sp = typeof spec === 'string' ? { source: 'auto', url: spec } : WA.assign({}, spec || {}); if (!sp.renderer) sp.renderer = renderer; if (sp.ktx2Path == null && options.ktx2Path) sp.ktx2Path = options.ktx2Path;
        return WA.loadAvatar(sp).then(function (r) {
          if (destroyed) { try { r.model.dispose(); } catch (e) {} return r; }
          adapter.use(r.model);
          var res = { source: r.source, fallback: r.fallback, error: r.error, info: r.model.getInfo(), rigReport: r.model.getRigReport(), landmarks: r.model.getLandmarks() };
          if (r.error) emit('warning', r.error);
          emit('modelchange', res); return res;
        }, function (e) { emit('error', e); throw e; });
      },
      getModelInfo: function () { return adapter.getInfo(); },
      getRigReport: function () { return adapter.getRigReport(); },
      capabilities: function () { return adapter.caps; },
      get model() { return adapter.model; },

      /* ---------- events, loop, diagnostics ---------- */
      on: function (name, fn) { return em.on(name, fn); }, off: function (name, fn) { em.off(name, fn); },
      pause: function () { running = false; }, resume: function () { running = true; last = performance.now() / 1000; },
      /* advance the simulation by `seconds` in fixed 1/30 s steps and draw once. Deterministic: used by tests and offline rendering. */
      advance: function (seconds, noRender) { var n = Math.max(1, Math.round(seconds * 30)); for (var i = 0; i < n; i++) step(1 / 30); if (!noRender) draw(); },
      renderNow: function () { draw(); },
      /* read-only snapshot of what is on screen, useful for tests and debugging */
      debug: function () {
        return { channels: lastMixed ? JSON.parse(JSON.stringify(lastMixed)) : null, gaze: lastGaze ? { yaw: lastGaze.yaw, pitch: lastGaze.pitch, away: lastGaze.away, eyes: lastGaze.eyes } : null,
          pose: JSON.parse(JSON.stringify(anim.pose)), expression: composer.getEmotion(), cognitive: composer.getCognitive(), context: composer.context, shot: cam.shot, style: cam.style, frame: cam.getFrame(),
          speaking: lip.speaking, speech: lipOut ? { source: lipOut.source, level: lipOut.level, paused: lipOut.paused, time: lip.getTime() } : null, visemes: lipOut ? JSON.parse(JSON.stringify(lipOut.visemes)) : null,
          model: adapter.model ? adapter.model.getInfo().kind : null, time: time };
      },
      stats: function () {
        var i = renderer.info;
        return { fps: +fps.toFixed(1), frameMs: +frameMs.toFixed(1), stepMs: +stepMs.toFixed(2), modelUpdateMs: +adapter.updateMs.toFixed(2), pixelRatio: +(basePR * prScale).toFixed(2),
          triangles: i.render.triangles, drawCalls: i.render.calls, geometries: i.memory.geometries, textures: i.memory.textures, model: adapter.getInfo() };
      },
      destroy: function () {
        destroyed = true; running = false; root.cancelAnimationFrame(raf); root.removeEventListener('pointermove', onPointer);
        if (ro) ro.disconnect(); else root.removeEventListener('resize', resize);
        if (io) io.disconnect();
        lip.stop(); adapter.dispose(); lighting.dispose(); renderer.dispose(); if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      },
      version: WA.VERSION
    };

    raf = root.requestAnimationFrame(frame);
    // initial model: procedural by default, otherwise what the options ask for (a GLB falls back to procedural if it fails)
    var spec = options.avatar || { source: 'procedural' };
    api.ready = api.loadAvatar(spec).then(function (r) { step(1 / 60); emit('ready', r); return r; }, function (e) {
      return api.loadAvatar({ source: 'procedural' }).then(function (r) { r.error = e; emit('ready', r); return r; });
    });
    return api;
  };
})(typeof window !== 'undefined' ? window : globalThis);
