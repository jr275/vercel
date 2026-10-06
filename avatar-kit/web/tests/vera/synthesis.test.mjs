import test from 'node:test';
import assert from 'node:assert/strict';
import { morning as world } from './helpers.mjs';
import { synthesize } from '../../lib/vera/synthesis.mjs';
import { NOW } from './helpers.mjs';

test('MORNING: many signals become one coherent briefing, not a list of notifications', async () => {
  const v = world();
  const b = await v.executive.briefing();
  assert.ok(b.notifications.length >= 6, 'many signals went in');
  assert.equal(b.items.length, 3, 'three things came out');
  assert.match(b.text, /^Good morning\. There are three things I think you should know before your first meeting\./);
  const labels = b.items.map(i => i.label).sort();
  assert.deepEqual(labels, ['Carlos', 'Market', 'Meeting']);
  assert.match(b.text, /Carlos wrote about the pricing decision and flagged it as urgent/);
  assert.match(b.text, /Two items from your last conversation are still open/);
  assert.match(b.text, /Lumen Systems cuts enterprise list prices by 12%/);
  assert.match(b.text, /Investor update today at 15:00/);
  assert.match(b.text, /João Silva's birthday is tomorrow/);
  assert.match(b.text, /I can prepare the briefing for you\.$/);
  assert.ok(!/weather|digest/i.test(b.text), 'noise is filtered out');
});

test('the briefing leads with the most important item', async () => {
  const b = await world().executive.briefing();
  assert.equal(b.items[0].label, 'Carlos');
  assert.equal(b.items[0].classification, 'URGENT');
});

test('accepting the offer prepares every item and arms nothing consequential', async () => {
  const v = world();
  await v.brain.respond('give me the morning briefing');
  const r = await v.brain.respond('yes please');
  assert.equal(r.intent, 'accept_offer');
  assert.ok(r.toolCalls.length >= 2);
  assert.ok(r.toolCalls.every(c => c.status === 'done'));
  assert.match(r.text, /Project X sync/);
  assert.match(r.text, /Investor update/);
});

test('nothing to report says so', () => {
  assert.match(synthesize([], { now: NOW }).text, /Nothing needs your attention/);
});
