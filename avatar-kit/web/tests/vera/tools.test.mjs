import test from 'node:test';
import assert from 'node:assert/strict';
import { world, NOW } from './helpers.mjs';

test('calendar is queried: important meetings, conflicts, prep, dates', async () => {
  const v = world();
  const r = (await v.registry.call('calendar_analysis', { days: 2 })).result;
  assert.equal(r.count, 4);
  assert.deepEqual(r.conflicts.map(c => [c.a, c.b]), [['Hiring review', 'Vendor call']]);
  assert.ok(r.important.some(e => e.title === 'Project X sync'));
  assert.ok(r.prep.some(e => e.title === 'Investor update' && e.openItems.length === 1));
  assert.equal(r.dates[0].person, 'João Silva');
});

test('email is queried: people, urgency, summary, link to context, unanswered', async () => {
  const v = world();
  v.email.receive({ id: 'm9', at: NOW - 1000, from: 'Carlos Mendes <carlos@northwind.example>', subject: 'Pricing decision is urgent', body: 'We need it. Can you confirm today?', read: false });
  const r = (await v.registry.call('email_inbox', {})).result;
  const m = r.relevant.find(x => x.id === 'm9');
  assert.deepEqual([m.from, m.known, m.urgent], ['Carlos Mendes', true, true]);
  assert.ok(m.connected.includes('Pricing decision'));
  assert.ok(r.ignored >= 1);
  assert.ok(r.unanswered.some(u => u.id === 'm9'));
});

test('tool use through the brain: calendar + email + context combined in one answer', async () => {
  const v = world();
  const a = await v.brain.respond('what is on my calendar');
  const b = await v.brain.respond('anything in my email');
  assert.equal(a.toolCalls[0].name, 'calendar_analysis');
  assert.equal(b.toolCalls[0].name, 'email_inbox');
  assert.deepEqual(v.registry.calls.map(c => c.name), ['calendar_analysis', 'email_inbox']);
});

test('sending email requires explicit confirmation; nothing is sent before it', async () => {
  const v = world();
  const r = await v.brain.respond('email Carlos saying the pricing call moves to Friday');
  assert.equal(r.toolCalls[0].status, 'awaiting_confirmation');
  assert.match(r.text, /has not been sent/);
  assert.equal(v.email.outbox.length, 0);
  assert.equal(r.pending.confirmation.tool, 'email_send');
  const c = await v.brain.respond('yes');
  assert.equal(v.email.outbox.length, 1);
  assert.equal(v.email.outbox[0].to, 'carlos@northwind.example');
  assert.match(c.text, /Sent to Carlos Mendes/);
});

test('declining discards the action', async () => {
  const v = world();
  await v.brain.respond('email Carlos saying hello');
  const d = await v.brain.respond('no, cancel');
  assert.match(d.text, /not sent anything/);
  assert.equal(v.email.outbox.length, 0);
  assert.equal(v.gate.pending().length, 0);
});

test('the model cannot confirm on its own: a tool call is always parked', async () => {
  const v = world();
  const r = await v.registry.call('email_send', { to: 'Carlos', subject: 's', body: 'b' });
  assert.equal(r.status, 'awaiting_confirmation');
  assert.equal(v.email.outbox.length, 0);
});

test('standing authorization (future autonomy) is explicit, per tool, audited and revocable', async () => {
  const v = world();
  v.gate.authorize('email_send', 'carlos only');
  const r = await v.registry.call('email_send', { to: 'Carlos', subject: 's' });
  assert.equal(r.status, 'done');
  assert.equal(v.email.outbox.length, 1);
  v.gate.revoke('email_send');
  assert.equal((await v.registry.call('email_send', { to: 'Carlos' })).status, 'awaiting_confirmation');
  assert.deepEqual(v.gate.audit.map(a => a.event).filter(e => e !== 'park'), ['authorize', 'revoke']);
});

test('skills are honest about what exists', () => {
  const v = world();
  const s = Object.fromEntries(v.skills.map(x => [x.title, x.status]));
  assert.equal(Object.keys(s).length, 11);
  assert.equal(s['Research'], 'declared');
  assert.equal(s['Calendar'], 'implemented');
});
