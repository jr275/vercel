import test from 'node:test';
import assert from 'node:assert/strict';
import { talk, tick, drain } from './helpers.mjs';
import { abortError } from '../../lib/vera/util.mjs';

test('user speaks, Vera thinks, responds, then is ready', async () => {
  const t = talk({ auto: true });
  t.input.say();
  assert.equal(t.convo.state, 'LISTENING');
  t.input.partial('what is on my');
  t.input.final('what is on my calendar');
  await tick();
  assert.deepEqual(t.states, ['LISTENING', 'THINKING', 'SPEAKING', 'READY']);
  const reply = t.convo.transcript.at(-1);
  assert.equal(reply.role, 'vera');
  assert.match(reply.text, /Investor update/);
  assert.ok(reply.toolCalls.some(c => c.name === 'calendar_analysis'));
});

test('user interrupts while Vera speaks; she stops, remembers what was said, and recovers', async () => {
  const t = talk();
  t.convo.submit('good morning, brief me');
  await tick();
  assert.equal(t.convo.state, 'SPEAKING');
  t.voice.release(2); // two segments spoken aloud
  await tick();
  t.input.say(); // barge-in
  assert.equal(t.convo.state, 'INTERRUPTED');
  const [, ev] = t.events.find(([n]) => n === 'interrupted');
  assert.equal(ev.was, 'SPEAKING');
  assert.ok(ev.spoken.startsWith('Good morning.'));
  assert.ok(t.voice.log.some(l => l.type === 'stop'));
  const interrupted = t.v.brain.history().find(h => h.interrupted);
  assert.equal(interrupted.spoken, ev.spoken); // memory holds only what was actually said
  assert.ok(interrupted.spoken.length < interrupted.content.length);
  // recovery: the user speaks again and gets a fresh, correct answer
  t.input.final('what do you know about Carlos');
  await tick();
  assert.equal(t.convo.state, 'SPEAKING');
  await drain(t);
  assert.equal(t.convo.state, 'READY');
  assert.match(t.convo.transcript.at(-1).text, /Carlos Mendes, Head of Commercial/);
  assert.deepEqual(t.states.slice(-4), ['INTERRUPTED', 'THINKING', 'SPEAKING', 'READY']);
});

test('barge-in while THINKING cancels the model call and leaves no half answer', async () => {
  let aborted = false;
  const slow = { id: 'slow', live: false, async complete({ signal }) { await new Promise((_, rej) => signal.addEventListener('abort', () => { aborted = true; rej(abortError()); })); } };
  const t = talk({ model: slow, auto: true });
  t.convo.submit('brief me');
  await tick();
  assert.equal(t.convo.state, 'THINKING');
  t.input.say();
  await tick();
  assert.equal(aborted, true);
  assert.equal(t.convo.state, 'INTERRUPTED');
  assert.ok(t.events.some(([n]) => n === 'cancelled'));
  assert.equal(t.convo.transcript.filter(l => l.role === 'vera').length, 0);
  assert.equal(t.v.brain.history()[0].cancelled, true);
});

test('interruption with no follow-up recovers to READY instead of hanging', async () => {
  const t = talk();
  t.convo.submit('brief me');
  await tick();
  t.input.say();
  assert.equal(t.convo.state, 'INTERRUPTED');
  t.input.silence();
  assert.equal(t.convo.state, 'READY');
  assert.ok(t.events.some(([n]) => n === 'recovered'));
});

test('microphone permission denied is reported and the conversation stays usable by text', async () => {
  const t = talk({ auto: true });
  t.input.say();
  t.input.fail('permission_denied');
  assert.equal(t.convo.state, 'READY');
  assert.equal(t.events.find(([n]) => n === 'input_error')[1].code, 'permission_denied');
  await t.convo.submit('what is on my calendar');
  assert.equal(t.convo.state, 'READY');
  assert.equal(t.convo.transcript.at(-1).role, 'vera');
});

test('a voice failure does not lose the reply and returns to READY', async () => {
  const t = talk();
  t.voice.speak = async () => { throw new Error('tts down'); };
  await t.convo.submit('what is on my calendar');
  assert.equal(t.convo.state, 'READY');
  assert.equal(t.convo.transcript.at(-1).role, 'vera');
  assert.ok(t.events.some(([n, d]) => n === 'error' && d.stage === 'voice'));
});
