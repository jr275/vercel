const test = require('node:test'), assert = require('node:assert');
const load = require('./load');
const WA = load(['core/util.js', 'model/channels.js', 'control/VisemeEngine.js', 'control/AmplitudeFallback.js', 'control/LipSyncController.js', 'control/TestVoice.js']);
const V = WA.Channels.VISEMES;
const out = () => { const o = {}; V.forEach(v => o[v] = 0); return o; };

test('timeline: phonemes map to visemes and peak at their time', () => {
  const tl = WA.VisemeTimeline.fromPhonemes([{ ph: 'AA', t: 0.5, d: 0.2 }, { ph: 'M', t: 0.8, d: 0.1 }]);
  const e = new WA.VisemeEngine(); e.load(tl);
  let o = out(); e.sample(0.6, o); assert.ok(o.viseme_aa > 0.9, 'aa open at 0.6');
  o = out(); e.sample(0.85, o); assert.ok(o.viseme_PP > 0.8, 'PP closed at 0.85');
  o = out(); e.sample(0.0, o); assert.ok(V.every(v => o[v] === 0), 'silent before start');
});
test('lip closure suppresses the open vowel', () => {
  const e = new WA.VisemeEngine(); e.load(WA.VisemeTimeline.fromEvents([{ t: 0.1, d: 0.3, v: 'aa' }, { t: 0.2, d: 0.1, v: 'PP' }]));
  const o = out(); e.sample(0.25, o); assert.ok(o.viseme_PP > o.viseme_aa);
});
test('azure ticks (100ns) and ids', () => {
  const tl = WA.VisemeTimeline.auto([{ id: 1, audioOffset: 5000000 }, { id: 21, audioOffset: 8000000 }], { provider: 'azure' });
  assert.equal(tl.events[0].t, 0.5); assert.equal(tl.events[0].v, 'viseme_aa'); assert.equal(tl.events[1].v, 'viseme_PP');
});
test('polly speech marks (ndjson string)', () => {
  const tl = WA.VisemeTimeline.auto('{"time":100,"type":"viseme","value":"p"}\n{"time":300,"type":"viseme","value":"a"}');
  assert.equal(tl.events.length, 2); assert.equal(tl.events[0].v, 'viseme_PP'); assert.equal(tl.events[1].t, 0.3);
});
test('character alignment (digraphs)', () => {
  const tl = WA.VisemeTimeline.auto({ characters: ['s', 'h', 'e'], character_start_times_seconds: [0, 0.1, 0.2], character_end_times_seconds: [0.1, 0.2, 0.3] });
  assert.equal(tl.events[0].v, 'viseme_CH');
});
test('bad events are dropped, empty is safe', () => {
  const tl = WA.VisemeTimeline.fromEvents([{ t: NaN, v: 'aa' }, { t: 1, v: 'zz' }, { t: 2, v: 'aa' }]);
  assert.equal(tl.events.length, 1);
  const e = new WA.VisemeEngine(); const o = out(); assert.doesNotThrow(() => e.sample(1, o));
});
test('sum of viseme weights is bounded', () => {
  const e = new WA.VisemeEngine(); const ev = V.slice(1).map((v, i) => ({ t: 0.5 + i * 0.01, d: 0.4, v }));
  e.load(WA.VisemeTimeline.fromEvents(ev)); const o = out(); e.sample(0.62, o);
  assert.ok(V.reduce((s, v) => s + o[v], 0) <= 1.16);
});
test('amplitude fallback: silence closed, loud open, adapts to quiet speaker', () => {
  const a = new WA.AmplitudeFallback(), o = {};
  for (let i = 0; i < 30; i++) a.update(1 / 60, 0.0005, 1, 1, 2);
  a.toVisemes(o); assert.ok(V.every(v => o[v] === 0));
  for (let i = 0; i < 120; i++) a.update(1 / 60, 0.03, 1, 1, 2);       // quiet but steady voice
  a.toVisemes(o); assert.ok(o.viseme_aa > 0.5, 'quiet speaker still opens: ' + o.viseme_aa);
  const b = new WA.AmplitudeFallback(); for (let i = 0; i < 60; i++) b.update(1 / 60, 0.2, 1, 20, 30);
  b.toVisemes(o); assert.ok(o.viseme_E > o.viseme_O, 'high-frequency energy -> wide');
});
test('LipSync: timeline on own clock, pause freezes, stop resolves', async () => {
  const L = new WA.LipSyncController(); let done = false;
  const p = L.speak(null, { visemes: [{ t: 0.1, d: 0.3, v: 'aa' }] }).then(() => done = true);
  let r; for (let i = 0; i < 18; i++) r = L.update(1 / 60, i / 60);       // 0.3 s
  assert.equal(r.source, 'timeline'); assert.ok(r.visemes.viseme_aa > 0.5); assert.ok(L.isSpeaking());
  L.paused = true; const t0 = L.getTime(); L.update(0.5, 1); assert.equal(L.getTime(), t0, 'clock frozen while paused');
  L.paused = false; for (let i = 0; i < 120; i++) L.update(1 / 60, 1);
  await p; assert.ok(done); assert.ok(!L.isSpeaking());
});
test('LipSync: visemes ease, never snap', () => {
  const L = new WA.LipSyncController(); L.setViseme('aa', 1); const r = L.update(1 / 60, 0);
  assert.ok(r.visemes.viseme_aa > 0 && r.visemes.viseme_aa < 0.6);
});
test('LipSync: speak without anything rejects with a typed error', async () => {
  const L = new WA.LipSyncController();
  await assert.rejects(() => L.speak(null, {}), e => e.code === 'NO_SOURCE');
});
test('test voice has events inside its duration', () => {
  const v = WA.makeTestVoiceWithVisemes(8000);
  assert.ok(v.events.length > 10 && v.events.every(e => e.t >= 0 && e.t < v.duration)); assert.equal(v.pcm.length, 8000 * 7);
});
test('a duration given by the provider is honoured beyond the guessed-duration cap', () => {
  const e = new WA.VisemeEngine(); e.load(WA.VisemeTimeline.fromEvents([{ t: 0, d: 1, v: 'aa' }]));
  const o = out(); e.sample(0.7, o); assert.ok(o.viseme_aa > 0.9, 'held vowel at 0.7s: ' + o.viseme_aa);
  const g = new WA.VisemeEngine(); g.load(WA.VisemeTimeline.fromEvents([{ t: 0, v: 'aa' }])); const p = out(); g.sample(0.7, p); assert.ok(p.viseme_aa < 0.1, 'guessed duration still capped');
});
