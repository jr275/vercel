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
