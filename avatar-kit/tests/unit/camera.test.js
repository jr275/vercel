const test = require('node:test'), assert = require('node:assert');
const load = require('./load');
const WA = load(['core/util.js', 'model/channels.js', 'model/AvatarModel.js', 'scene/CameraController.js']);
const CC = WA.CameraController, lm = WA.AvatarModel.defaultLandmarks(7.05);
const fakeCam = () => ({ position: { set(x, y, z) { this.x = x; this.y = y; this.z = z; } }, lookAt() {}, fov: 24, updateProjectionMatrix() {} });

test('framing is derived from landmarks, not constants (scales with the model)', () => {
  const a = CC.frameFor('CLOSE', 'conversation', WA.AvatarModel.defaultLandmarks(7.05), 1), b = CC.frameFor('CLOSE', 'conversation', WA.AvatarModel.defaultLandmarks(3.525), 1);
  assert.ok(Math.abs(a.d / b.d - 2) < 1e-6 && Math.abs(a.y / b.y - 2) < 1e-6);
});
test('shots get progressively wider; styles differ', () => {
  const d = s => CC.frameFor(s, 'conversation', lm, 1).d; assert.ok(d('CLOSE') < d('MEDIUM') && d('MEDIUM') < d('FULL'));
  const c = s => CC.frameFor('CLOSE', s, lm, 1); assert.ok(c('intimate').vis < c('conversation').vis && c('conversation').vis < c('executive').vis);
  assert.ok(c('executive').drift < c('conversation').drift);
});
test('CLOSE keeps the eyes in the upper half and the whole head in frame', () => {
  const f = CC.frameFor('CLOSE', 'conversation', lm, 1), top = f.y + f.vis / 2, bot = f.y - f.vis / 2;
  assert.ok(lm.headTopY < top && lm.chinY > bot && lm.eyeY > f.y);
});
test('FULL contains the whole figure', () => { const f = CC.frameFor('FULL', 'executive', lm, 1); assert.ok(f.y + f.vis / 2 >= lm.height && f.y - f.vis / 2 <= 0.01); });
test('narrow aspect backs the camera off', () => { assert.ok(CC.frameFor('CLOSE', 'conversation', lm, 0.5).d > CC.frameFor('CLOSE', 'conversation', lm, 1).d); });
test('legacy names work, bad names and styles are rejected', () => {
  const c = new CC(fakeCam()); assert.ok(c.setShot('closeup')); assert.equal(c.shot, 'CLOSE'); assert.equal(c.setShot('wide'), false); assert.equal(c.setShot('MEDIUM', { style: 'noir' }), false); assert.equal(c.shot, 'CLOSE');
});
test('moves are eased: no jump on the first frame, arrives exactly', () => {
  const cam = fakeCam(), c = new CC(cam); c.update(1 / 60, 0); const z0 = cam.position.z; c.setShot('FULL', { duration: 2 });
  c.update(1 / 60, 0.02); assert.ok(Math.abs(cam.position.z - z0) < 0.05, 'first frame moved ' + Math.abs(cam.position.z - z0));
  for (let i = 0; i < 130; i++) c.update(1 / 60, 0.02 + i / 60); assert.ok(Math.abs(c.cur.d - c.to.d) < 1e-9);
});
test('resting camera drifts by millimetres, not centimetres', () => {
  const cam = fakeCam(), c = new CC(cam); c.setStyle('conversation', 0.01); let minx = 9, maxx = -9;
  for (let i = 0; i < 60 * 30; i++) { c.update(1 / 60, i / 60); minx = Math.min(minx, cam.position.x); maxx = Math.max(maxx, cam.position.x); }
  assert.ok(maxx - minx < 0.06, 'x range ' + (maxx - minx));
});
