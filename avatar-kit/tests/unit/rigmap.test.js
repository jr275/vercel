const { test } = require('node:test'); const assert = require('node:assert/strict');
const WA = require('./load')(['core/util.js', 'model/channels.js', 'model/RigMap.js', 'model/AvatarModel.js']);
const C = WA.Channels, R = WA.RigMap;

test('channels: 52 ARKit names, 15 Oculus visemes, no duplicates', () => {
  assert.equal(C.ARKIT.length, 52);
  assert.equal(new Set(C.ARKIT).size, 52);
  assert.equal(C.VISEMES.length, 15);
  assert.ok(C.ESSENTIAL.every(c => C.isChannel(c)));
  assert.equal(C.mirror('mouthSmileLeft'), 'mouthSmileRight');
  assert.equal(C.mirror('jawOpen'), 'jawOpen');
});

test('every viseme has a recipe made only of real channels', () => {
  assert.deepEqual(Object.keys(C.VISEME_TO_ARKIT).sort(), C.VISEMES.slice().sort());
  for (const v in C.VISEME_TO_ARKIT) for (const ch in C.VISEME_TO_ARKIT[v]) {
    assert.ok(C.isChannel(ch), v + ' uses unknown channel ' + ch);
    assert.ok(C.VISEME_TO_ARKIT[v][ch] > 0 && C.VISEME_TO_ARKIT[v][ch] <= 1);
  }
});

test('visemesToChannels: zero in, zero out; clamped to 1 when visemes overlap', () => {
  assert.deepEqual(C.visemesToChannels({}), {});
  const out = C.visemesToChannels({ viseme_aa: 1, viseme_E: 1, viseme_I: 1 });
  for (const k in out) assert.ok(out[k] >= 0 && out[k] <= 1, k + '=' + out[k]);
  assert.ok(out.jawOpen > 0.6);
});

test('RigMap: a complete ARKit + viseme model is graded full and fully matched', () => {
  const inv = { morphNames: C.ARKIT.concat(C.VISEMES), boneNames: ['Hips', 'Spine', 'Neck', 'Head', 'LeftEye', 'RightEye'], clipNames: [] };
  const res = R.resolve(R.create(), inv);
  assert.equal(res.report.grade, 'full');
  assert.equal(res.report.coverage, 1);
  assert.equal(res.report.missing.length, C.EXTENSION.length);   // only the non-ARKit extension is absent
  assert.equal(res.report.visemesNative, true);
  assert.equal(res.bones.head, 'Head');
});

test('RigMap: tolerates other naming styles without guessing wrong meanings', () => {
  const inv = { morphNames: ['blendShape1.jawOpen', 'Mouth_Smile_L', 'Mouth_Smile_R', 'Eye_Blink_L', 'Eye_Blink_R', 'brow-inner-up', 'Brow_Down_L'], boneNames: [], clipNames: [] };
  const res = R.resolve(R.create(), inv);
  assert.deepEqual(res.morphs.jawOpen, ['blendShape1.jawOpen']);
  assert.deepEqual(res.morphs.mouthSmileLeft, ['Mouth_Smile_L']);
  assert.deepEqual(res.morphs.eyeBlinkRight, ['Eye_Blink_R']);
  assert.deepEqual(res.morphs.browInnerUp, ['brow-inner-up']);
  assert.deepEqual(res.morphs.browDownLeft, ['Brow_Down_L']);
  assert.equal(res.morphs.mouthFunnel, undefined);                // not in the model: reported, not invented
  assert.ok(res.report.missing.includes('mouthFunnel'));
});

test('RigMap: a rig with almost nothing is graded insufficient and says why', () => {
  const res = R.resolve(R.create(), { morphNames: ['jawOpen'], boneNames: [], clipNames: [] });
  assert.equal(res.report.grade, 'insufficient');
  assert.ok(res.report.essentialMissing.includes('eyeBlinkLeft'));
  assert.ok(res.report.warnings.some(w => /essential/i.test(w)));
  assert.ok(res.report.warnings.some(w => /head bone/i.test(w)));
});

test('RigMap: explicit names in the rig map win, and namespaced bones resolve', () => {
  const rig = R.create({ morphs: { jawOpen: ['MY_JAW'] }, bones: { head: ['cabeca'] } });
  const res = R.resolve(rig, { morphNames: ['MY_JAW'], boneNames: ['mixamorig:Spine', 'Rig|cabeca'], clipNames: [] });
  assert.deepEqual(res.morphs.jawOpen, ['MY_JAW']);
  assert.equal(res.bones.head, 'Rig|cabeca');
  assert.equal(res.bones.spine, 'mixamorig:Spine');
});

test('RigMap: swapLeftRight handles a model authored with mirrored sides', () => {
  const inv = { morphNames: ['mouthSmileLeft', 'mouthSmileRight'], boneNames: [], clipNames: [] };
  const plain = R.resolve(R.create(), inv), swapped = R.resolve(R.create({ options: { swapLeftRight: true } }), inv);
  assert.deepEqual(plain.morphs.mouthSmileLeft, ['mouthSmileLeft']);
  assert.deepEqual(swapped.morphs.mouthSmileLeft, ['mouthSmileRight']);
});

test('RigMap: bones-only models are reported with a clear limitation', () => {
  const res = R.resolve(R.create({}, 'bones-only'), { morphNames: [], boneNames: ['Head', 'Jaw', 'LeftEye', 'RightEye'], clipNames: [] });
  assert.ok(res.report.warnings.some(w => /jaw bone only/i.test(w)));
  assert.equal(res.bones.jaw, 'Jaw');
});

test('AvatarModel.check flags missing contract methods', () => {
  assert.deepEqual(WA.AvatarModel.check(new WA.AvatarModel()), []);
  const missing = WA.AvatarModel.check({ load() {}, update() {} });
  assert.ok(missing.includes('setExpression') && missing.includes('getLandmarks'));
  assert.deepEqual(Object.keys(WA.AvatarModel.defaultLandmarks()).sort(), ['chestY', 'chinY', 'eyeY', 'headCenterY', 'headHeight', 'headTopY', 'height', 'hipsY', 'shoulderY']);
});

test('ignoreTokens lets a studio prefix be disregarded without listing every name', () => {
  const WA = global.AvatarKit, rig = WA.RigMap.create({ options: { ignoreTokens: ['fc'] } });
  const r = WA.RigMap.resolve(rig, { morphNames: ['FC_EYE_BLINK_L', 'FC_JAW_OPEN', 'FC_MOUTH_SMILE_R'], boneNames: [], clipNames: [] });
  assert.deepEqual(r.morphs.eyeBlinkLeft, ['FC_EYE_BLINK_L']); assert.deepEqual(r.morphs.jawOpen, ['FC_JAW_OPEN']); assert.deepEqual(r.morphs.mouthSmileRight, ['FC_MOUTH_SMILE_R']);
  const noIgnore = WA.RigMap.resolve(WA.RigMap.create(), { morphNames: ['FC_JAW_OPEN'], boneNames: [], clipNames: [] }); assert.equal(noIgnore.morphs.jawOpen, undefined);
});
test('a model with no face morphs but head/jaw bones is graded bones-only, not insufficient', () => {
  const WA = global.AvatarKit, r = WA.RigMap.resolve(WA.RigMap.create({}, 'bones-only'), { morphNames: [], boneNames: ['Head', 'Jaw'], clipNames: [] });
  assert.equal(r.report.grade, 'bones-only');
  assert.equal(WA.RigMap.resolve(WA.RigMap.create(), { morphNames: [], boneNames: [], clipNames: [] }).report.grade, 'insufficient');
});
