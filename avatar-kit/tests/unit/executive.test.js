const test = require('node:test'), assert = require('node:assert');
const load = require('./load');
const WA = load(['core/util.js', 'model/channels.js', 'control/VisemeEngine.js', 'control/ExpressionController.js', 'control/CognitiveState.js', 'runtime/ConversationState.js', 'runtime/Phonemizer.js', 'runtime/SynthVoice.js', 'runtime/Speech.js']);
const CS = WA.ConversationState;
const run = (c, ...evs) => { evs.forEach(e => { c.dispatch(e); c.tick(1); }); return c; };

/* ---------- state machine ---------- */
test('state machine: IDLE -> LISTENING -> THINKING -> SPEAKING -> IDLE, through TRANSITION', () => {
  const c = new CS(); assert.equal(c.state, 'IDLE');
  c.dispatch('userStart'); assert.equal(c.state, 'TRANSITION'); assert.equal(c.target, 'LISTENING'); c.tick(0.25); assert.equal(c.state, 'LISTENING');
  c.dispatch('userEnd'); c.tick(0.25); assert.equal(c.state, 'THINKING');
  c.dispatch('responseStart'); c.tick(0.25); assert.equal(c.state, 'SPEAKING');
  c.dispatch('responseEnd'); c.tick(0.25); assert.equal(c.state, 'IDLE');
  assert.deepEqual(c.history.map(h => h.to), ['LISTENING', 'THINKING', 'SPEAKING', 'IDLE']);
});
test('state machine: SPEAKING -> INTERRUPTED -> LISTENING, by itself after the hold', () => {
  const c = run(new CS(), 'userStart', 'userEnd', 'responseStart'); assert.equal(c.state, 'SPEAKING');
  c.dispatch('userStart'); c.tick(0.25); assert.equal(c.state, 'INTERRUPTED');
  c.tick(0.2); assert.equal(c.state, 'INTERRUPTED', 'held for a moment'); c.tick(0.3); c.tick(0.25); assert.equal(c.state, 'LISTENING');
  assert.deepEqual(c.history.slice(-2).map(h => h.to), ['INTERRUPTED', 'LISTENING']);
});
test('state machine: an interruption that is already over goes straight to THINKING, and her reply is not dropped', () => {
  const c = run(new CS(), 'userStart', 'userEnd', 'responseStart'); c.dispatch('userStart'); c.tick(0.25); assert.equal(c.state, 'INTERRUPTED');
  assert.equal(c.dispatch('userEnd'), true); c.tick(0.25); assert.equal(c.state, 'THINKING'); c.dispatch('responseStart'); c.tick(0.25); assert.equal(c.state, 'SPEAKING');
});
test('state machine: events during a transition apply to its target; invalid events are refused and change nothing', () => {
  const c = new CS(), seen = []; c.on('invalid', d => seen.push(d));
  c.dispatch('userStart'); assert.equal(c.dispatch('userEnd'), true, 'LISTENING is the target, so userEnd is valid at once'); c.tick(1); assert.equal(c.state, 'THINKING');
  assert.equal(c.dispatch('responseEnd'), false); assert.equal(c.state, 'THINKING'); assert.deepEqual(seen, [{ state: 'THINKING', event: 'responseEnd' }]);
  assert.equal(c.dispatch('nonsense'), false);
});
test('state machine: error and reset work from anywhere; ERROR recovers when the user speaks', () => {
  const c = run(new CS(), 'userStart', 'userEnd', 'responseStart'); c.dispatch('error'); c.tick(1); assert.equal(c.state, 'ERROR');
  c.dispatch('userStart'); c.tick(1); assert.equal(c.state, 'LISTENING'); c.dispatch('reset'); c.tick(1); assert.equal(c.state, 'IDLE');
});
test('state machine: deterministic (same events and ticks, same history) and force() is recorded as manual', () => {
  const a = run(new CS(), 'userStart', 'userEnd', 'responseStart', 'userStart'), b = run(new CS(), 'userStart', 'userEnd', 'responseStart', 'userStart'); a.tick(2); b.tick(2);
  assert.deepEqual(a.history, b.history); assert.equal(a.state, b.state);
  const c = new CS(); assert.equal(c.force('thinking'), true); c.tick(1); assert.equal(c.state, 'THINKING'); assert.equal(c.history[0].manual, true);
  assert.equal(c.force('flying'), false); assert.equal(c.force('transition'), false);
});

/* ---------- expression vocabulary ---------- */
test('expression API: every public name maps to a real engine expression, with a sane intensity', () => {
  const E = { neutral: 1, warm: 1, focused: 1, skeptical: 1, concerned: 1, confident: 1, surprised: 1, firm: 1 };
  load(['runtime/ExecutiveAvatar.js']); const X = WA.ExecutiveContract.EXPRESSIONS;
  assert.deepEqual(Object.keys(X).sort(), Object.keys(E).sort());
  Object.values(X).forEach(([eng, k]) => { assert.ok(WA.ExpressionController.names.includes(eng), eng); assert.ok(k > 0 && k <= 1.2); });
  Object.values(WA.ExecutiveContract.VISEMES).forEach(v => assert.ok(WA.Channels.VISEMES.includes(v), v));
});

/* ---------- speech pipeline ---------- */
test('phonemizer: words become ordered phoneme events that the viseme engine understands', () => {
  const r = WA.Phonemizer.toEvents("Let's separate the problem from the noise. The issue is not what happened."); let prev = 0;
  r.events.forEach(e => { assert.ok(e.t >= prev - 1e-9 && e.d > 0); prev = e.t; assert.ok(e.ph === 'SIL' || WA.VisemeTables.ARPABET[e.ph], 'unknown phoneme ' + e.ph); });
  assert.ok(r.syllables >= 12 && r.duration > 4 && r.duration < 12); assert.equal(r.events[r.events.length - 1].ph, 'SIL');
  assert.ok(WA.Phonemizer.toEvents('Hello, world.', { rate: 2 }).duration < WA.Phonemizer.toEvents('Hello, world.', { rate: 1 }).duration, 'a faster rate is shorter');
  assert.equal(WA.Phonemizer.toEvents('???').syllables, 0);
});
test('synthetic voice: finite, audible audio whose length matches the timeline', () => {
  const r = WA.Phonemizer.toEvents('Separate the problem from the noise.'), a = WA.SynthVoice.render(r.events);
  let bad = 0, rms = 0; a.pcm.forEach(x => { if (!isFinite(x)) bad++; rms += x * x; }); rms = Math.sqrt(rms / a.pcm.length);
  assert.equal(bad, 0); assert.ok(rms > 0.03 && rms < 0.6, 'rms ' + rms); assert.ok(Math.abs(a.duration - r.duration) < 0.5);
});
test('speech providers: the synthetic provider returns a SpeechResult; auto falls back to it without browser voices; a custom provider is accepted', async () => {
  const p = WA.createSpeechProvider('auto'); assert.equal(p.name, 'synthetic', 'no speechSynthesis in Node');
  const r = await p.speak('The issue is the next move.'); assert.equal(r.playback, 'engine'); assert.ok(r.audio instanceof Float32Array && r.phonemes.length > 5 && r.duration > 1);
  await assert.rejects(p.speak('???'), e => e.code === 'EMPTY_TEXT');
  const custom = { name: 'mine', speak: async () => ({}), stop() {} }; assert.equal(WA.createSpeechProvider(custom), custom);
  assert.equal(WA.createSpeechProvider('browser').available(), false); await assert.rejects(WA.createSpeechProvider('browser').speak('hi'), e => e.code === 'TTS_UNAVAILABLE');
  assert.doesNotThrow(() => p.stop());
});

/* ---------- KTX2 loader (generated from three.js r147) ---------- */
test('KTX2 loader: the generated file is up to date, has no imports left, and builds a loader for a THREE build', () => {
  const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process'), f = path.join(__dirname, '../../src/vendor/KTX2Loader.js'), before = fs.readFileSync(f, 'utf8');
  assert.equal(spawnSync(process.execPath, [path.join(__dirname, '../../tools/make-ktx2-loader.js')]).status, 0); assert.equal(fs.readFileSync(f, 'utf8'), before, 'regenerating changes nothing');
  assert.ok(!/^\s*import\s/m.test(before) && !/^\s*export\s/m.test(before));
  const W = load(['vendor/KTX2Loader.js']); class Loader { constructor() { this.crossOrigin = 'anonymous'; } } const T = { Loader, FileLoader: class {}, LinearEncoding: 3000, sRGBEncoding: 3001 };
  const K = W.makeKTX2Loader(T); assert.equal(typeof K, 'function'); assert.equal(W.makeKTX2Loader(T), K, 'created once per THREE build');
  const k = new K(); assert.equal(typeof k.setTranscoderPath, 'function'); assert.equal(typeof k.detectSupport, 'function'); assert.equal(typeof k.dispose, 'function');
});
