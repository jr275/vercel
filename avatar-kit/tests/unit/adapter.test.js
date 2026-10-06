const test = require('node:test'), assert = require('node:assert');
const load = require('./load');
const WA = load(['core/util.js', 'model/channels.js', 'model/AvatarModel.js', 'model/RigMap.js', 'model/AvatarAdapter.js', 'model/loadAvatar.js']);

class Fake extends WA.AvatarModel {
  constructor() { super(); this.calls = []; this.disposed = false; this.throwOn = null; }
  load() { return Promise.resolve({}); } dispose() { this.disposed = true; }
  setExpression(c) { this.calls.push(['expr', c]); } setViseme() {} setMouthLevel() {} setEyeTarget(y, p) { this.calls.push(['eye', y, p]); } setHeadRotation() {} setBodyPose() {} setIdle() {} setSpeaking() {}
  update() { if (this.throwOn) throw new Error('boom'); } getLandmarks() { return WA.AvatarModel.defaultLandmarks(); } capabilities() { return { visemes: true }; } getInfo() { return { kind: 'fake' }; } onAttach() {}
}
test('contract check lists missing methods', () => {
  assert.deepEqual(WA.AvatarModel.check(new Fake()), []);
  const bad = { load() {}, dispose() {} }; assert.ok(WA.AvatarModel.check(bad).includes('setViseme'));
  const ad = new WA.AvatarAdapter({}, {}); assert.throws(() => ad.use(bad), e => e.code === 'BAD_MODEL' && /setViseme/.test(e.message));
});
test('swap replays state onto the new model and disposes the old', () => {
  const ad = new WA.AvatarAdapter({}, {}), a = new Fake(), b = new Fake(); ad.use(a);
  ad.setExpression({ jawOpen: 0.3 }); ad.setEyeTarget(0.1, 0.2); ad.use(b);
  assert.ok(a.disposed); assert.ok(b.calls.some(c => c[0] === 'expr' && c[1].jawOpen === 0.3)); assert.ok(b.calls.some(c => c[0] === 'eye' && c[1] === 0.1));
});
test('a throwing model is isolated: reported once, then marked failed', () => {
  const ad = new WA.AvatarAdapter({}, {}, { maxErrors: 3 }), m = new Fake(); ad.use(m); m.throwOn = true;
  const ev = []; ad.on('error', e => ev.push(e)); ad.on('failed', () => ev.push('failed'));
  for (let i = 0; i < 5; i++) ad.update(0.016);
  assert.equal(ev.filter(e => e !== 'failed').length, 1); assert.equal(ev.filter(e => e === 'failed').length >= 1, true);
});
test('viseme calls are skipped for models without native visemes', () => {
  const ad = new WA.AvatarAdapter({}, {}), m = new Fake(); m.capabilities = () => ({ visemes: false }); let n = 0; m.setViseme = () => n++; ad.use(m); ad.setViseme({}); assert.equal(n, 0);
});
test('loadAvatar: unknown source rejects typed; auto falls back with the reason', async () => {
  WA.ProceduralAvatar = class extends Fake { };
  await assert.rejects(() => WA.loadAvatar({ source: 'fbx', fallback: false }), e => e.code === 'UNKNOWN_SOURCE');
  const r = await WA.loadAvatar({ source: 'fbx', fallback: true }); assert.equal(r.source, 'procedural'); assert.equal(r.fallback, true); assert.equal(r.error.code, 'UNKNOWN_SOURCE');
});
test('loadAvatar: GLB failure falls back (auto) or rejects (strict); procedural is direct', async () => {
  WA.ProceduralAvatar = class extends Fake { };
  WA.GLBAvatar = class extends Fake { load() { return Promise.reject(WA.AvatarError('FETCH_FAILED', 'nope')); } };
  const a = await WA.loadAvatar({ source: 'auto', url: 'x.glb' }); assert.equal(a.source, 'procedural'); assert.equal(a.error.code, 'FETCH_FAILED');
  await assert.rejects(() => WA.loadAvatar({ source: 'glb', url: 'x.glb', fallback: false }), e => e.code === 'FETCH_FAILED');
  const p = await WA.loadAvatar({ source: 'procedural' }); assert.equal(p.fallback, false);
  const s = await WA.loadAvatar('x.glb'); assert.equal(s.source, 'procedural');
});
test('loadAvatar: an insufficient rig is rejected into fallback', async () => {
  WA.ProceduralAvatar = class extends Fake { };
  WA.GLBAvatar = class extends Fake { getRigReport() { return { grade: 'insufficient', essentialMissing: ['jawOpen'] }; } };
  const r = await WA.loadAvatar({ source: 'auto', url: 'x.glb' }); assert.equal(r.error.code, 'RIG_INSUFFICIENT');
});
test('registerModel adds a custom model type', async () => {
  WA.registerModel('mine', () => new Fake()); assert.ok(WA.modelTypes().includes('mine'));
  const r = await WA.loadAvatar({ source: 'mine' }); assert.equal(r.source, 'mine'); assert.throws(() => WA.registerModel('x', 5));
});
test('rigMap forms: preset name, overrides, complete map', async () => {
  let got; WA.GLBAvatar = class extends Fake { constructor(s) { super(); got = s.rigMap; } };
  await WA.loadAvatar({ source: 'glb', url: 'a', rigMap: 'bones-only' }); assert.equal(got.options.eyeMode, 'bones');
  await WA.loadAvatar({ source: 'glb', url: 'a', rigMap: { preset: 'arkit', options: { swapLeftRight: true } } }); assert.equal(got.options.swapLeftRight, true);
  const full = WA.RigMap.create(); await WA.loadAvatar({ source: 'glb', url: 'a', rigMap: full }); assert.equal(got, full);
});
