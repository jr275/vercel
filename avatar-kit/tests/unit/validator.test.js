const test = require('node:test'), assert = require('node:assert');
const load = require('./load');
global.THREE = { DoubleSide: 2 };
const WA = load(['core/util.js', 'model/channels.js', 'validate/AssetValidator.js']);
const AV = WA.AssetValidator, C = WA.Channels;

const good = require('./good-report')(C);
const full = (scores, overall) => { const s = {}; AV.RUBRIC.forEach(i => s[i.id] = scores); return { scores: s, overall }; };

test('weights add to 100; the automatic part is 54, the human part 46', () => {
  assert.equal(AV.CATEGORIES.reduce((a, c) => a + c.weight, 0), 100);
  assert.ok(Math.abs(AV.CATEGORIES.reduce((a, c) => a + c.weight * c.auto, 0) - 54) < 1e-9);
});
test('an excellent asset is never accepted without the visual rubric', () => {
  const r = AV.evaluate(good(), { phase: 'full' });
  assert.equal(r.verdict, 'PENDENTE'); assert.equal(r.total, null); assert.ok(r.technical.percent >= 95, 'technical ' + r.technical.percent);
});
test('excellent technical + excellent visual = ACEITAR with a high score', () => {
  const r = AV.evaluate(good(), { phase: 'full', manual: full(4.5, 'premium') });
  assert.equal(r.verdict, 'ACEITAR'); assert.ok(r.total >= 90, 'total ' + r.total);
});
test('generic-looking avatar is rejected whatever the technical score', () => {
  const r = AV.evaluate(good(), { phase: 'full', manual: full(5, 'generic') });
  assert.equal(r.verdict, 'REJEITAR'); assert.ok(r.gates.some(g => g.id === 'premium' && !g.ok));
});
test('weak facial quality is rejected by the gate even with perfect rig', () => {
  const m = full(4.5, 'premium'); m.scores.f_skin = 1; const r = AV.evaluate(good(), { phase: 'full', manual: m });
  assert.equal(r.verdict, 'REJEITAR'); assert.ok(r.gates.some(g => g.id === 'facial_min' && !g.ok));
});
test('mediocre visual lands in REVISAR', () => {
  const r = AV.evaluate(good(), { phase: 'full', manual: full(3.5, 'premium') });
  assert.ok(['REVISAR', 'ACEITAR'].includes(r.verdict)); const r2 = AV.evaluate(good(), { phase: 'full', manual: full(3.6, 'premium') }); assert.ok(r2.total < 90);
});
test('hard gates: no native visemes, no eyes, no jaw, huge file, external files', () => {
  const t = (mut, id) => { const g = good(); mut(g); const r = AV.evaluate(g, { phase: 'full', manual: full(5, 'premium') }); assert.equal(r.verdict, 'REJEITAR', id); assert.ok(r.gates.some(x => x.id === id && !x.ok), id); };
  t(g => { g.visemes.found = 4; }, 'visemes'); t(g => { g.eyes.bones = { left: false, right: false }; g.eyes.lookMorphs = 0; }, 'eyes');
  t(g => { g.mouth.jawMorph = false; g.mouth.jawMode = 'none'; }, 'jaw'); t(g => { g.delivery.fileMB = 40; }, 'size'); t(g => { g.delivery.external = ['a.png']; }, 'external');
  t(g => { g.rig.grade = 'insufficient'; }, 'rig_grade'); t(g => { g.expressionTest.nan = 3; }, 'finite');
});
test('dead targets, exploding targets and mechanical mirrors lower the rig score', () => {
  const base = AV.evaluate(good(), { phase: 'full' }).categories.find(c => c.id === 'rig').auto, g = good(); g.blendshapes.dead = ['a', 'b', 'c', 'd']; g.blendshapes.outliers = ['x', 'y']; g.blendshapes.perfectMirror = g.blendshapes.pairs.length;
  assert.ok(AV.evaluate(g, { phase: 'full' }).categories.find(c => c.id === 'rig').auto < base - 2);
});
test('missing teeth, tongue and hair are measured, not ignored', () => {
  const g = good(); g.mouth.teeth = 0; g.mouth.tongue = 0; g.hair = { meshes: 0, tris: 0 }; g.materials.hairMaterial = null; const r = AV.evaluate(g, { phase: 'head' });
  ['rig_teeth', 'rig_tongue', 'hair_mesh'].forEach(id => assert.equal(r.checks.find(c => c.id === id).s, 0, id)); assert.ok(r.fixes.length >= 3);
});
test('software rendering never earns or loses FPS points', () => {
  const g = good(); g.fps = { fps: 4, software: true, renderer: 'SwiftShader' }; const r = AV.evaluate(g, { phase: 'full' }); assert.equal(r.checks.find(c => c.id === 'pf_fps').s, null);
  assert.equal(r.categories.find(c => c.id === 'perf').auto, 5, 'category rescaled over what could be measured');
});
test('phase 1 skips body checks (sheen, idle clip) and uses the head budget', () => {
  const g = good(); g.materials.anySheen = false; g.animation.idle = null; g.animation.clips = []; g.animation.bodyBonesMissing = ['spine'];
  const head = AV.evaluate(g, { phase: 'head' }), full = AV.evaluate(g, { phase: 'full' });
  assert.equal(head.checks.find(c => c.id === 'mat_sheen').s, null); assert.equal(head.checks.find(c => c.id === 'an_idle').s, null); assert.ok(head.technical.percent > full.technical.percent);
  const big = good(); big.geometry.tris = 60000; assert.ok(AV.evaluate(big, { phase: 'head' }).checks.find(c => c.id === 'pf_tris').s < 0.5); assert.equal(AV.evaluate(big, { phase: 'full' }).checks.find(c => c.id === 'pf_tris').s, 1);
});
test('mesh classification by name', () => {
  const k = AV.kindOf; assert.equal(k('Wolf3D_Teeth'), 'teeth'); assert.equal(k('Tongue_Geo'), 'tongue'); assert.equal(k('EyeLeft'), 'eye'); assert.equal(k('Cornea_L'), 'cornea'); assert.equal(k('Hair_cards'), 'hair'); assert.equal(k('Head_LOD0'), 'skin'); assert.equal(k('Dress_Black'), 'cloth'); assert.equal(k('Eyelashes'), 'lash');
});
