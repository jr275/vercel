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
