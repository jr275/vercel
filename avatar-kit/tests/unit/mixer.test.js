const test = require('node:test'), assert = require('node:assert');
const load = require('./load');
const WA = load(['core/util.js', 'model/channels.js', 'control/VisemeEngine.js', 'control/FaceMixer.js']);
const V = WA.Channels.VISEMES, vis = (o) => { const x = {}; V.forEach(v => x[v] = o[v] || 0); return x; };
const base = (o) => Object.assign({}, o);

test('blink combines with the lid baseline and never exceeds 1', () => {
  const m = new WA.FaceMixer(); const o = m.mix({ channels: { eyeBlinkLeft: 0.3, eyeBlinkRight: 0.3 }, blink: 1, gazePitch: -0.3, t: 1 });
  assert.equal(o.eyeBlinkLeft, 1); const o2 = m.mix({ channels: { eyeBlinkLeft: 0.3, eyeBlinkRight: 0.3 }, blink: 0.5, gazePitch: 0, t: 1 }); assert.ok(Math.abs(o2.eyeBlinkLeft - 0.65) < 1e-9);
});
test('lids follow a downward gaze', () => {
  const m = new WA.FaceMixer(); const down = m.mix({ channels: { eyeBlinkLeft: 0.1 }, gazePitch: -0.3, t: 1 }).eyeBlinkLeft, level = m.mix({ channels: { eyeBlinkLeft: 0.1 }, gazePitch: 0, t: 1 }).eyeBlinkLeft;
  assert.ok(down > level + 0.1);
});
test('visemes become ARKit channels when the model has none', () => {
  const m = new WA.FaceMixer(); const o = m.mix({ channels: {}, visemes: vis({ viseme_aa: 1 }), speaking: true, level: 0.8, t: 1 });
  assert.ok(o.jawOpen > 0.5 && o.mouthLowerDownLeft > 0.2); assert.equal(m.visOut, null);
});
test('native visemes are passed through and the mouth shapes are not double-applied', () => {
  const m = new WA.FaceMixer(); const o = m.mix({ channels: {}, visemes: vis({ viseme_O: 1 }), speaking: true, level: 0.8, nativeVisemes: true, t: 1 });
  assert.ok(m.visOut && m.visOut.viseme_O === 1); assert.ok(o.mouthFunnel < 0.1); assert.ok(o.jawOpen > 0.1);
});
test('plosive puffs the cheeks, closure holds the lips', () => {
  const m = new WA.FaceMixer(); const o = m.mix({ channels: {}, visemes: vis({ viseme_PP: 1 }), speaking: true, level: 0.1, t: 1 });
  assert.ok(o.cheekPuff > 0.05 && o.mouthPressLeft > 0.4);
});
test('a pause closes the lips; a long pause takes one breath, and only one', () => {
  const m = new WA.FaceMixer(); let breaths = 0, was = 0, closed = 0;
  for (let i = 0; i < 180; i++) { const t = i / 60, o = m.mix({ channels: {}, visemes: vis({}), speaking: true, level: 0, silence: 0.3 + t, t, dt: 1 / 60 }); if (m.breath > 0.5 && was <= 0.5) breaths++; was = m.breath; closed = Math.max(closed, o.mouthClose); }
  assert.equal(breaths, 1); assert.ok(closed > 0.1);
});
test('all outputs are canonical channels in 0..1', () => {
  const m = new WA.FaceMixer(); const o = m.mix({ channels: { jawOpen: 5, browInnerUp: -2 }, visemes: vis({ viseme_aa: 1, viseme_E: 1 }), speaking: true, level: 1, t: 3 });
  Object.keys(o).forEach(k => { assert.ok(WA.Channels.isChannel(k), k); assert.ok(o[k] >= 0 && o[k] <= 1, k + '=' + o[k]); });
});
