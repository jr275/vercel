import test from 'node:test';
import assert from 'node:assert/strict';
import { world, CARLOS_EMAIL } from './helpers.mjs';

test('email + calendar + person are connected into one context', async () => {
  const v = world();
  const r = await v.executive.ingest(CARLOS_EMAIL);
  const n = r.notification;
  assert.equal(n.signal.who, 'Carlos Mendes');
  assert.ok(n.context.some(c => /associated with Project X/.test(c)), 'person -> project');
  assert.ok(n.context.some(c => /pricing decision was unresolved/.test(c)), 'person -> unresolved decision');
  assert.ok(n.context.some(c => /discount ceiling/.test(c)), 'person -> open issue');
  assert.equal(n.meeting.title, 'Project X sync', 'calendar');
  assert.match(n.recommendation, /tomorrow at 10:00/);
});

test('asking about a meeting combines calendar, person memory and news', async () => {
  const v = world();
  const r = await v.brain.respond('prepare me for the meeting with Carlos about pricing');
  assert.deepEqual(r.toolCalls.map(c => c.name), ['meeting_prep']);
  assert.match(r.text, /Project X sync, tomorrow at 10:00/);
  assert.match(r.text, /2 open items/);
  assert.match(r.text, /Lumen Systems cuts enterprise list prices/);
});
