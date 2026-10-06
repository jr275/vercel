// The vertical slice, end to end, through the real layers (only the edges are fakes):
// EMAIL SIGNAL -> PERSON CONTEXT -> RELEVANCE -> EXECUTIVE REASONING -> PROACTIVE ALERT -> CONVERSATION -> OPTIONAL ACTION
import test from 'node:test';
import assert from 'node:assert/strict';
import { talk, tick, drain, CARLOS_EMAIL } from './helpers.mjs';

test('Carlos emails that the pricing decision is urgent; Vera raises it, explains it, offers to prepare, and acts on yes', async () => {
  const t = talk({ auto: true });
  // wire the proactive engine to the conversation (what the app does)
  t.v.executive.onAlert(n => n.decision === 'SURFACE_NOW' && t.convo.alert(n));

  await t.v.executive.ingest(CARLOS_EMAIL); // 1-6: email -> normalise -> relevance -> context -> importance -> decision
  await tick();
  const alert = t.convo.transcript.find(l => l.proactive);
  assert.ok(alert, 'Vera spoke first');
  assert.match(alert.text, /^Carlos just wrote about the pricing decision and marked it urgent\./);
  assert.match(alert.text, /Carlos Mendes is associated with Project X/);
  assert.match(alert.text, /This is high relevance, time-sensitive and potential business impact\./);
  assert.match(alert.text, /Review the pricing decision before your meeting tomorrow at 10:00\./);
  assert.match(alert.text, /Shall I prepare the relevant context\?$/);
  assert.equal(t.convo.state, 'READY');
  assert.deepEqual(t.v.brain.cognition.snapshot().EXECUTIVE_ACTION, { status: 'proposed', label: 'Prepare the relevant context' });

  await t.convo.submit('yes');
  const reply = t.convo.transcript.at(-1);
  assert.equal(reply.intent, 'accept_offer');
  assert.ok(reply.toolCalls.some(c => c.name === 'meeting_prep'));
  assert.match(reply.text, /Project X sync, tomorrow at 10:00/);
  assert.match(reply.text, /Decide: Pricing decision/);
  assert.match(reply.text, /Lumen Systems cuts enterprise list prices/);

  // optional consequential action stays gated
  await t.convo.submit('email Carlos saying I will decide before the sync');
  assert.equal(t.v.email.outbox.length, 0);
  await t.convo.submit('yes');
  assert.equal(t.v.email.outbox.length, 1);
});

test('a proactive alert waits while the user is being spoken to, then is delivered', async () => {
  const t = talk();
  t.convo.submit('brief me'); // Vera is speaking now (manual voice)
  await tick();
  assert.equal(t.convo.state, 'SPEAKING');
  t.convo.alert((await t.v.executive.ingest(CARLOS_EMAIL)).notification);
  assert.equal(t.convo.pendingAlerts(), 1);
  assert.ok(!t.convo.transcript.some(l => l.proactive));
  await drain(t);
  await tick();
  assert.ok(t.convo.transcript.some(l => l.proactive), 'delivered after she finished');
  assert.equal(t.convo.pendingAlerts(), 0);
});
