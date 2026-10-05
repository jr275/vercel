// Fixture GLB builder (Node and browser). A TEST FIXTURE, not an asset: its geometry is an ellipsoid on a stick figure.
// What it has is the structure of a real facial rig: 52 ARKit blendshapes, 15 Oculus visemes, a Mixamo-style skeleton
// with eye and jaw bones, and an idle clip. Options: { names:'arkit'|'custom', swap, noVisemes, noEyeBones, noJaw, noMorphs, noIdle }
(function (root) {
'use strict';
const ARKIT = ['eyeBlinkLeft', 'eyeLookDownLeft', 'eyeLookInLeft', 'eyeLookOutLeft', 'eyeLookUpLeft', 'eyeSquintLeft', 'eyeWideLeft', 'eyeBlinkRight', 'eyeLookDownRight', 'eyeLookInRight', 'eyeLookOutRight', 'eyeLookUpRight', 'eyeSquintRight', 'eyeWideRight',
  'jawForward', 'jawLeft', 'jawRight', 'jawOpen', 'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight', 'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight', 'mouthDimpleLeft', 'mouthDimpleRight',
  'mouthStretchLeft', 'mouthStretchRight', 'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper', 'mouthPressLeft', 'mouthPressRight', 'mouthLowerDownLeft', 'mouthLowerDownRight', 'mouthUpperUpLeft', 'mouthUpperUpRight',
  'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight', 'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight', 'noseSneerLeft', 'noseSneerRight', 'tongueOut'];
const VIS = ['viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD', 'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR', 'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U'];
// "custom" naming: a studio's own convention, to test RigMap overrides (names are NOT ARKit)
const custom = n => 'FC_' + n.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase().replace(/_LEFT$/, '_L').replace(/_RIGHT$/, '_R');
const customV = n => 'PH_' + n.replace('viseme_', '').toUpperCase();


function build(o) {
  o = o || {};
  const NAMES = o.names || 'arkit', swap = !!o.swap;
  const mName = n => NAMES === 'custom' ? custom(n) : n, vName = n => NAMES === 'custom' ? customV(n) : n;
  const boneName = n => NAMES === 'custom' ? 'rig_' + n : n;
/* ---- head geometry: ellipsoid, ~800 vertices ---- */
const SEG = 32, RING = 24, RX = 0.095, RY = 0.125, RZ = 0.105, CY = 1.65;
const pos = [], nor = [], col = [], idx = [], local = [];
for (let r = 0; r <= RING; r++) for (let s = 0; s <= SEG; s++) {
  const v = r / RING, u = s / SEG, th = v * Math.PI, ph = u * Math.PI * 2;
  const nx = Math.sin(th) * Math.sin(ph), ny = Math.cos(th), nz = Math.sin(th) * Math.cos(ph);       // +Z is the face
  pos.push(nx * RX, CY + ny * RY, nz * RZ); nor.push(nx / RX, ny / RY, nz / RZ);
  const l = Math.hypot(nx / RX, ny / RY, nz / RZ); nor[nor.length - 3] /= l; nor[nor.length - 2] /= l; nor[nor.length - 1] /= l;
  local.push([nx, ny, nz]);
  const mouth = nz > 0.6 && ny < -0.28 && ny > -0.42 && Math.abs(nx) < 0.3;
  col.push(mouth ? 0.55 : 0.93, mouth ? 0.18 : 0.74, mouth ? 0.2 : 0.65);
}
for (let r = 0; r < RING; r++) for (let s = 0; s < SEG; s++) { const a = r * (SEG + 1) + s, b = a + SEG + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
const NV = pos.length / 3;

/* ---- morph targets: each channel moves a region of the face by a vector, so each one is visible and distinct ---- */
function region(cx, cy, cz, rad, dx, dy, dz) {
  const d = new Float32Array(NV * 3);
  for (let i = 0; i < NV; i++) { const [x, y, z] = local[i]; if (z < 0.1) continue; const dist = Math.hypot(x - cx, y - cy, z - cz); const w = Math.max(0, 1 - dist / rad); const k = w * w * (3 - 2 * w); d[i * 3] = dx * k; d[i * 3 + 1] = dy * k; d[i * 3 + 2] = dz * k; }
  return d;
}
const S = swap ? -1 : 1;
const FACE = {                                    // cx, cy, cz, radius, then the displacement
  eyeBlinkLeft: [0.35, 0.18, 0.9, 0.18, 0, -0.012, 0], eyeBlinkRight: [-0.35, 0.18, 0.9, 0.18, 0, -0.012, 0], eyeWideLeft: [0.35, 0.2, 0.9, 0.18, 0, 0.008, 0], eyeWideRight: [-0.35, 0.2, 0.9, 0.18, 0, 0.008, 0],
  eyeSquintLeft: [0.35, 0.12, 0.9, 0.18, 0, 0.006, 0], eyeSquintRight: [-0.35, 0.12, 0.9, 0.18, 0, 0.006, 0],
  jawOpen: [0, -0.62, 0.7, 0.55, 0, -0.05, -0.012], mouthClose: [0, -0.35, 0.95, 0.2, 0, 0.004, 0], mouthFunnel: [0, -0.35, 0.95, 0.22, 0, 0, 0.012], mouthPucker: [0, -0.35, 0.95, 0.2, 0, 0, 0.016],
  mouthSmileLeft: [0.28, -0.33, 0.9, 0.2, 0.012, 0.01, 0], mouthSmileRight: [-0.28, -0.33, 0.9, 0.2, -0.012, 0.01, 0], mouthFrownLeft: [0.28, -0.36, 0.9, 0.2, 0, -0.01, 0], mouthFrownRight: [-0.28, -0.36, 0.9, 0.2, 0, -0.01, 0],
  mouthPressLeft: [0.12, -0.33, 0.95, 0.15, 0, 0.003, 0], mouthPressRight: [-0.12, -0.33, 0.95, 0.15, 0, 0.003, 0], mouthStretchLeft: [0.25, -0.35, 0.9, 0.2, 0.01, 0, 0], mouthStretchRight: [-0.25, -0.35, 0.9, 0.2, -0.01, 0, 0],
  mouthLowerDownLeft: [0.1, -0.45, 0.9, 0.2, 0, -0.012, 0], mouthLowerDownRight: [-0.1, -0.45, 0.9, 0.2, 0, -0.012, 0], mouthUpperUpLeft: [0.1, -0.25, 0.95, 0.2, 0, 0.008, 0], mouthUpperUpRight: [-0.1, -0.25, 0.95, 0.2, 0, 0.008, 0],
  browDownLeft: [0.35, 0.42, 0.85, 0.2, 0, -0.012, 0], browDownRight: [-0.35, 0.42, 0.85, 0.2, 0, -0.012, 0], browInnerUp: [0, 0.42, 0.9, 0.2, 0, 0.014, 0],
  browOuterUpLeft: [0.5, 0.42, 0.8, 0.2, 0, 0.014, 0], browOuterUpRight: [-0.5, 0.42, 0.8, 0.2, 0, 0.014, 0], cheekPuff: [0, -0.2, 0.85, 0.5, 0, 0, 0.01],
  cheekSquintLeft: [0.5, 0, 0.8, 0.2, 0, 0.008, 0], cheekSquintRight: [-0.5, 0, 0.8, 0.2, 0, 0.008, 0], noseSneerLeft: [0.1, -0.05, 1, 0.12, 0, 0.005, 0], noseSneerRight: [-0.1, -0.05, 1, 0.12, 0, 0.005, 0]
};
const morphTargets = [];                           // [{ name, deltas }]
function addMorph(canon, nameFn, geo) { morphTargets.push({ name: nameFn(canon), deltas: geo }); }
let h = 7;
const rnd = () => (h = (h * 16807) % 2147483647) / 2147483647;
ARKIT.forEach(n => {
  let spec = FACE[n]; const left = /Left$/.test(n);
  if (!spec) spec = [(rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2, 0.9, 0.2, (rnd() - 0.5) * 0.01, (rnd() - 0.5) * 0.01, 0.003];
  // when authored swapped, "Left" regions sit on the other side
  const sp = swap && /(Left|Right)$/.test(n) ? [-spec[0], ...spec.slice(1, 4), -spec[4], ...spec.slice(5)] : spec;
  if (!o.noMorphs) addMorph(n, mName, region(...sp));
});
if (!o.noVisemes && !o.noMorphs) VIS.forEach((n, i) => addMorph(n, vName, region(0, -0.38, 0.95, 0.25, 0, n === 'viseme_aa' ? -0.02 : -0.006 * (i % 3), 0.004 * ((i % 4) + 1))));

/* ---- skeleton (Mixamo-style) ---- */
const eyeY = 1.68;
const BONES = [  // name, parent index, world position
  ['Hips', -1, [0, 0.95, 0]], ['Spine', 0, [0, 1.05, 0]], ['Spine1', 1, [0, 1.17, 0]], ['Spine2', 2, [0, 1.3, 0]], ['Neck', 3, [0, 1.45, 0]], ['Head', 4, [0, 1.52, 0]],
  ['LeftShoulder', 3, [0.08, 1.4, 0]], ['RightShoulder', 3, [-0.08, 1.4, 0]]];
if (!o.noEyeBones) BONES.push(['LeftEye', 5, [0.04 * S, eyeY, 0.095]], ['RightEye', 5, [-0.04 * S, eyeY, 0.095]]);
if (!o.noJaw) BONES.push(['Jaw', 5, [0, 1.57, 0.02]]);

/* ---- binary assembly ---- */
const chunks = [], views = [], accessors = []; let total = 0;
function addBuf(arr, target) {
  const buf = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), pad = (4 - buf.length % 4) % 4, off = total;
  chunks.push(buf); total += buf.length; if (pad) { chunks.push(new Uint8Array(pad)); total += pad; }
  views.push({ buffer: 0, byteOffset: off, byteLength: buf.length, ...(target ? { target } : {}) }); return views.length - 1;
}
function addAcc(arr, type, comp, opts = {}) {
  const view = addBuf(arr, opts.target), n = arr.length / ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type]);
  const a = { bufferView: view, componentType: comp, count: n, type, ...(opts.minmax ? minmax(arr, type) : {}), ...(opts.normalized ? { normalized: true } : {}) };
  accessors.push(a); return accessors.length - 1;
}
function minmax(arr, type) { const k = { VEC3: 3, SCALAR: 1 }[type], mn = Array(k).fill(Infinity), mx = Array(k).fill(-Infinity); for (let i = 0; i < arr.length; i++) { mn[i % k] = Math.min(mn[i % k], arr[i]); mx[i % k] = Math.max(mx[i % k], arr[i]); } return { min: mn, max: mx }; }
const F = 5126, U16 = 5123, U8 = 5121, ARR = 34962, EL = 34963;

const nodes = [], nodeOf = {};
const armature = 0; nodes.push({ name: 'Armature', children: [] });
BONES.forEach(([name, parent, wp], i) => {
  const pw = parent < 0 ? [0, 0, 0] : BONES[parent][2];
  const node = { name: boneName(name), translation: wp.map((v, k) => +(v - pw[k]).toFixed(6)) };
  nodes.push(node); nodeOf[i] = nodes.length - 1;
  if (parent < 0) nodes[armature].children.push(nodeOf[i]); else (nodes[nodeOf[parent]].children = nodes[nodeOf[parent]].children || []).push(nodeOf[i]);
});
const joints = BONES.map((_, i) => nodeOf[i]);
const ibm = new Float32Array(BONES.length * 16); BONES.forEach(([, , wp], i) => { const m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -wp[0], -wp[1], -wp[2], 1]; ibm.set(m, i * 16); });
const ibmAcc = addAcc(ibm, 'MAT4', F);
const headJoint = 5, spineJoint = 3;

const materials = [{ name: 'Skin', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], roughnessFactor: 0.55, metallicFactor: 0 } }, { name: 'Dress', pbrMetallicRoughness: { baseColorFactor: [0.03, 0.03, 0.035, 1], roughnessFactor: 0.8, metallicFactor: 0 } },
  { name: 'Eye', pbrMetallicRoughness: { baseColorFactor: [0.9, 0.9, 0.95, 1], roughnessFactor: 0.1, metallicFactor: 0 } }];
const meshes = [];
// head
{
  const P = addAcc(new Float32Array(pos), 'VEC3', F, { target: ARR, minmax: true }), N = addAcc(new Float32Array(nor), 'VEC3', F, { target: ARR }), C = addAcc(new Float32Array(col), 'VEC3', F, { target: ARR });
  const I = addAcc(new Uint16Array(idx), 'SCALAR', U16, { target: EL });
  const jn = new Uint8Array(NV * 4), wt = new Float32Array(NV * 4); for (let i = 0; i < NV; i++) { jn[i * 4] = headJoint; wt[i * 4] = 1; }
  const J = addAcc(jn, 'VEC4', U8, { target: ARR }), W = addAcc(wt, 'VEC4', F, { target: ARR });
  const prim = { attributes: { POSITION: P, NORMAL: N, COLOR_0: C, JOINTS_0: J, WEIGHTS_0: W }, indices: I, material: 0 };
  if (morphTargets.length) prim.targets = morphTargets.map(m => ({ POSITION: addAcc(m.deltas, 'VEC3', F, { target: ARR, minmax: true }) }));
  const mesh = { name: 'Head', primitives: [prim] };
  if (morphTargets.length) { mesh.extras = { targetNames: morphTargets.map(m => m.name) }; mesh.weights = morphTargets.map(() => 0); }
  meshes.push(mesh);
}
// body: a tapered column skinned to the chest
{
  const bp = [], bn = [], bi = []; const rings = [[0.0, 0.16], [0.5, 0.2], [0.95, 0.11], [1.1, 0.13], [1.3, 0.17], [1.42, 0.07]], seg = 16;
  rings.forEach(([y, r]) => { for (let s = 0; s <= seg; s++) { const a = s / seg * Math.PI * 2; bp.push(Math.sin(a) * r, y + 0.0, Math.cos(a) * r * 0.7); bn.push(Math.sin(a), 0, Math.cos(a)); } });
  for (let r = 0; r < rings.length - 1; r++) for (let s = 0; s < seg; s++) { const a = r * (seg + 1) + s, b = a + seg + 1; bi.push(a, b, a + 1, b, b + 1, a + 1); }
  const n = bp.length / 3, jn = new Uint8Array(n * 4), wt = new Float32Array(n * 4); for (let i = 0; i < n; i++) { jn[i * 4] = spineJoint; wt[i * 4] = 1; }
  const P = addAcc(new Float32Array(bp), 'VEC3', F, { target: ARR, minmax: true }), N = addAcc(new Float32Array(bn), 'VEC3', F, { target: ARR }), I = addAcc(new Uint16Array(bi), 'SCALAR', U16, { target: EL });
  meshes.push({ name: 'Body', primitives: [{ attributes: { POSITION: P, NORMAL: N, JOINTS_0: addAcc(jn, 'VEC4', U8, { target: ARR }), WEIGHTS_0: addAcc(wt, 'VEC4', F, { target: ARR }) }, indices: I, material: 1 }] });
}
// eye: small sphere, parented to the eye bones (so rotating the bone moves it)
{
  const ep = [], en = [], ei = [], R = 0.016; for (let r = 0; r <= 8; r++) for (let s = 0; s <= 12; s++) { const th = r / 8 * Math.PI, ph = s / 12 * Math.PI * 2; const x = Math.sin(th) * Math.sin(ph), y = Math.cos(th), z = Math.sin(th) * Math.cos(ph); ep.push(x * R, y * R, z * R); en.push(x, y, z); }
  for (let r = 0; r < 8; r++) for (let s = 0; s < 12; s++) { const a = r * 13 + s, b = a + 13; ei.push(a, b, a + 1, b, b + 1, a + 1); }
  const P = addAcc(new Float32Array(ep), 'VEC3', F, { target: ARR, minmax: true }), N = addAcc(new Float32Array(en), 'VEC3', F, { target: ARR }), I = addAcc(new Uint16Array(ei), 'SCALAR', U16, { target: EL });
  meshes.push({ name: 'Eye', primitives: [{ attributes: { POSITION: P, NORMAL: N }, indices: I, material: 2 }] });
}
const headMeshNode = nodes.push({ name: 'HeadMesh', mesh: 0, skin: 0 }) - 1, bodyMeshNode = nodes.push({ name: 'BodyMesh', mesh: 1, skin: 0 }) - 1;
nodes[armature].children.push(headMeshNode, bodyMeshNode);
BONES.forEach(([name], i) => { if (/Eye$/.test(name)) { const en = nodes.push({ name: 'EyeBall' + name, mesh: 2 }) - 1; (nodes[nodeOf[i]].children = nodes[nodeOf[i]].children || []).push(en); } });

const doc = { asset: { version: '2.0', generator: 'avatar-kit test fixture' }, scene: 0, scenes: [{ nodes: [armature] }], nodes, meshes, materials, skins: [{ joints, inverseBindMatrices: ibmAcc, skeleton: nodeOf[0] }], accessors, bufferViews: views, buffers: [{ byteLength: 0 }] };
if (!o.noIdle) {                           // 4 s breathing clip on the chest and shoulders
  const times = new Float32Array([0, 2, 4]); const t = addAcc(times, 'SCALAR', F, { minmax: true });
  const q = (a) => [Math.sin(a / 2), 0, 0, Math.cos(a / 2)];
  const rot = new Float32Array([...q(0), ...q(-0.015), ...q(0)]); const r = addAcc(rot, 'VEC4', F);
  doc.animations = [{ name: 'Idle', samplers: [{ input: t, output: r, interpolation: 'LINEAR' }], channels: [{ sampler: 0, target: { node: nodeOf[3], path: 'rotation' } }] }];
}
const bin = new Uint8Array(total); { let p = 0; chunks.forEach(c => { bin.set(c, p); p += c.length; }); }
doc.buffers[0].byteLength = bin.length;
const jraw = new TextEncoder().encode(JSON.stringify(doc)), jpad = (4 - jraw.length % 4) % 4, json = new Uint8Array(jraw.length + jpad).fill(0x20); json.set(jraw);
const glb = new Uint8Array(12 + 8 + json.length + 8 + bin.length), dv = new DataView(glb.buffer);
dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, glb.length, true);
dv.setUint32(12, json.length, true); dv.setUint32(16, 0x4E4F534A, true); glb.set(json, 20);
const o2 = 20 + json.length; dv.setUint32(o2, bin.length, true); dv.setUint32(o2 + 4, 0x004E4942, true); glb.set(bin, o2 + 8);
return { glb, morphs: morphTargets.length, bones: BONES.length };
}
const api = { build };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FixtureGLB = api;
})(typeof window !== 'undefined' ? window : globalThis);
