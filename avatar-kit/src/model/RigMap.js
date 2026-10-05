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
