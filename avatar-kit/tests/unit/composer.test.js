const test = require('node:test'), assert = require('node:assert');
const load = require('./load');
const WA = load(['core/util.js', 'model/channels.js', 'control/ExpressionController.js', 'control/CognitiveState.js', 'control/ExpressionComposer.js']);
const run = (c, sec, speech, t0 = 0) => { let o; for (let i = 0; i < sec * 60; i++) o = c.update(1 / 60, t0 + i / 60, speech); return o; };
const snap = o => JSON.parse(JSON.stringify(o.channels));

test('all 11 emotions are defined and use only canonical channels', () => {
  const names = ['neutral', 'listening', 'thinking', 'analyzing', 'confident', 'firm', 'skeptical', 'empathetic', 'surprised', 'concerned', 'decisive'];
  names.forEach(n => { assert.ok(WA.ExpressionController.EMOTIONS[n], n); Object.keys(WA.ExpressionController.EMOTIONS[n].face).forEach(ch => assert.ok(WA.Channels.isChannel(ch), n + ':' + ch)); });
});
test('cognitive states: the nine required exist', () => {
  ['LISTENING', 'PROCESSING', 'THINKING', 'SPEAKING', 'DECIDING', 'WARNING', 'EMPATHY', 'CHALLENGE', 'CONFIDENCE'].forEach(n => { const p = WA.CognitiveState.profile(n); assert.ok(p, n); p.mix.forEach(m => assert.ok(WA.ExpressionController.EMOTIONS[m.name], n + ' -> ' + m.name)); });
  assert.equal(WA.CognitiveState.profile('nope'), null);
});
test('transitions are never instant and never overshoot', () => {
  const c = new WA.ExpressionComposer(); run(c, 1);
  const before = snap(run(c, 0.01)); c.setEmotion('skeptical');
  const f1 = c.update(1 / 60, 1.02); assert.ok(f1.channels.browOuterUpLeft < 0.15, 'first frame barely moved: ' + f1.channels.browOuterUpLeft);
  let prev = f1.channels.browOuterUpLeft, max = 0; let o;
  for (let i = 0; i < 180; i++) { o = c.update(1 / 60, 1.03 + i / 60); assert.ok(o.channels.browOuterUpLeft >= prev - 1e-6, 'monotonic'); prev = o.channels.browOuterUpLeft; max = Math.max(max, prev); }
  assert.ok(Math.abs(prev - 0.78) < 0.05 && max <= 0.8, 'settles at target without overshoot: ' + prev);
  assert.ok(before.browOuterUpLeft < 0.1);
});
test('frame-to-frame channel change is bounded (no pops)', () => {
  const c = new WA.ExpressionComposer(); let prev = snap(run(c, 1)), worst = 0;
  ['firm', 'surprised', 'empathetic'].forEach((n, k) => { c.setEmotion(n); for (let i = 0; i < 120; i++) { const o = c.update(1 / 60, 2 + k * 3 + i / 60); for (const ch in o.channels) { worst = Math.max(worst, Math.abs(o.channels[ch] - prev[ch])); prev[ch] = o.channels[ch]; } } });
  assert.ok(worst < 0.1, 'largest single-frame step ' + worst);
});
test('explicit emotion wins over the cognitive state, which keeps its gaze', () => {
  const c = new WA.ExpressionComposer(); c.setCognitive('CHALLENGE', 0); assert.equal(c.getEmotion(), 'skeptical');
  c.setEmotion('empathetic'); const o = run(c, 1); assert.equal(o.lead, 'empathetic'); assert.equal(o.gaze, 'hold');
  c.setCognitive('LISTENING', 5); assert.equal(c.getEmotion(), 'listening');
});
test('speech releases held mouth shapes', () => {
  const c = new WA.ExpressionComposer(); c.setEmotion('firm'); const quiet = run(c, 2).channels.mouthPressLeft;
  const talk = run(c, 1.5, { speaking: true, level: 0.6 }, 2).channels.mouthPressLeft;
  assert.ok(talk < quiet * 0.5, quiet + ' -> ' + talk);
});
test('executive context shows less than intimate', () => {
  const a = new WA.ExpressionComposer({ context: 'executive' }), b = new WA.ExpressionComposer({ context: 'intimate' });
  a.setEmotion('confident'); b.setEmotion('confident');
  assert.ok(run(a, 2).channels.mouthSmileLeft < run(b, 2).channels.mouthSmileLeft);
});
test('unknown names are rejected without changing state', () => {
  const c = new WA.ExpressionComposer(); assert.equal(c.setEmotion('furious'), false); assert.equal(c.setCognitive('PANIC'), false); assert.equal(c.getEmotion(), 'neutral');
});
test('intensity scales the departure from baseline', () => {
  const lo = new WA.ExpressionComposer(), hi = new WA.ExpressionComposer(); lo.setEmotion('surprised', { intensity: 0.3 }); hi.setEmotion('surprised', { intensity: 1 });
  assert.ok(run(lo, 2).channels.eyeWideLeft < run(hi, 2).channels.eyeWideLeft * 0.5);
});
