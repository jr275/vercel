import test from 'node:test';
import assert from 'node:assert/strict';
import { world, talk, tick, drain, NOW } from './helpers.mjs';
import { createMemory } from '../../lib/vera/memory.mjs';
import { seedMemory } from '../../lib/vera/scenario.mjs';

test('learn a fact through conversation and retrieve it later', async () => {
  const v = world();
  const a = await v.brain.respond('remember that Carlos prefers calls over email');
  assert.equal(a.toolCalls[0].name, 'memory_learn');
  assert.equal(v.memory.preferences().some(p => /calls over email/.test(p.text)), true);
  const b = await v.brain.respond('what does Carlos prefer');
  assert.match(b.text, /prefers calls over email/);
  assert.ok(b.cognitive.EXECUTIVE_MEMORY.length > 0);
});

test('memory holds people, companies, projects, decisions, commitments, dates, relationships, issues', () => {
  const m = seedMemory();
  assert.ok(m.people().length >= 4 && m.companies().length >= 2 && m.projects().length >= 1);
  assert.equal(m.unresolvedDecisions().length, 1);
  assert.equal(m.openCommitments().length, 1);
  assert.equal(m.openIssues().length, 1);
  assert.equal(m.dates().length, 1);
  assert.ok(m.toJSON().relationships.length === 1);
});

test('recall ranks by relevance and finds nothing for unknown topics', () => {
  const m = seedMemory();
  assert.equal(m.recall('discount ceiling')[0].kind, 'issue');
  assert.deepEqual(m.recall('zeppelin'), []);
});

test('upcoming dates: João birthday is tomorrow', () => {
  const d = seedMemory().upcomingDates(NOW, 2);
  assert.equal(d[0].person.name, 'João Silva');
  assert.equal(d[0].inDays, 1);
});

test('memory survives a JSON round trip', () => {
  const m = seedMemory();
  m.learn('Marina likes short agendas');
  const m2 = createMemory({ now: () => NOW }).fromJSON(JSON.parse(JSON.stringify(m.toJSON())));
  assert.equal(m2.findPerson('carlos').name, 'Carlos Mendes');
  assert.match(m2.recall('short agendas')[0].text, /short agendas/);
});

test('an interrupted reply is stored as only what was spoken', async () => {
  const t = talk();
  t.convo.submit('brief me');
  await tick();
  t.voice.release(1);
  await tick();
  t.input.say();
  const h = t.v.brain.history().find(x => x.interrupted);
  assert.equal(h.spoken, 'Good morning.');
});
