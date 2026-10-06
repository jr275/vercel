import test from 'node:test';
import assert from 'node:assert/strict';
import { world, CARLOS_EMAIL, NOW } from './helpers.mjs';

test('pipeline runs every stage in order', async () => {
  const v = world();
  const r = await v.executive.ingest(CARLOS_EMAIL);
  assert.deepEqual(r.trace.map(t => t.stage), ['EVENT', 'INGESTION', 'NORMALIZATION', 'RELEVANCE', 'CONTEXT', 'IMPORTANCE', 'DECISION', 'NOTIFICATION', 'OPTIONAL ACTION']);
});

test('Carlos / pricing / urgent produces SIGNAL, CONTEXT, ASSESSMENT, RECOMMENDATION, ACTION', async () => {
  const v = world();
  const { notification: n } = await v.executive.ingest(CARLOS_EMAIL);
  assert.deepEqual([n.signal.who, n.signal.topic, n.signal.urgency], ['Carlos Mendes', 'Pricing decision', 'Urgent']);
  assert.equal(n.classification, 'URGENT');
  assert.deepEqual(n.assessment, ['high relevance', 'time-sensitive', 'potential business impact']);
  assert.match(n.recommendation, /^Review the pricing decision before your meeting/);
  assert.equal(n.action.label, 'Prepare the relevant context');
  assert.equal(n.decision, 'SURFACE_NOW');
});

test('the outcome is computed, not scripted: resolve the decision and the same email matters less', async () => {
  const v = world();
  v.memory.resolveDecision('Pricing decision', 'agreed');
  const { notification: n, importance } = await v.executive.ingest({ ...CARLOS_EMAIL, id: 'x2' });
  assert.ok(importance < 0.6);
  assert.notEqual(n?.decision, 'SURFACE_NOW');
  assert.ok(!n || !n.assessment.includes('potential business impact'));
});

test('irrelevant events are suppressed; duplicates are dropped', async () => {
  const v = world();
  const spam = { kind: 'email', id: 's1', at: NOW, from: 'Weekly Digest <digest@news.example>', subject: 'Your weekly digest', body: 'Ten links.' };
  const a = await v.executive.ingest(spam);
  assert.equal(a.status, 'suppressed');
  assert.equal(a.notification, null);
  assert.equal((await v.executive.ingest(spam)).status, 'duplicate');
  assert.equal(v.executive.alerts.length, 0);
});

test('unknown sender with urgent words but no connection is not escalated', async () => {
  const v = world();
  const r = await v.executive.ingest({ kind: 'email', id: 'u1', at: NOW, from: 'Stranger <x@y.example>', subject: 'URGENT act now', body: 'urgent deadline today' });
  assert.notEqual(r.notification?.decision, 'SURFACE_NOW');
});

test('personal events: birthday tomorrow, silence for 96 days, commitment due today', async () => {
  const v = world();
  const b = await v.executive.briefing();
  const kinds = Object.fromEntries(b.notifications.map(n => [n.kind + ':' + (n.people[0] ?? ''), n.classification]));
  assert.ok(kinds['date:João Silva']);
  assert.ok(kinds['silence:Priya Nair']);
  assert.ok(kinds['commitment:Marina Costa']);
});
