import test from 'node:test';
import assert from 'node:assert/strict';
import { createVera } from '../../lib/vera/create.mjs';
import { seedProviders } from '../../lib/vera/scenario.mjs';
import { AnthropicModel, ScriptedModel, createModel } from '../../lib/vera/models.mjs';

const json = (body, ok = true, status = 200) => ({ ok, status, json: async () => body, text: async () => JSON.stringify(body) });

test('without an API key the stand-in is used and reported as not live', async () => {
  const m = createModel({ env: {} });
  assert.ok(m instanceof ScriptedModel);
  assert.equal(m.live, false);
  const v = createVera({ providers: seedProviders(), env: {} });
  assert.equal((await v.brain.respond('what is on my calendar')).live, false);
});

test('with a key the Anthropic provider is selected', () => {
  const m = createModel({ env: { ANTHROPIC_API_KEY: 'k', VERA_MODEL: 'claude-test' }, fetchImpl: () => {} });
  assert.ok(m instanceof AnthropicModel);
  assert.equal(m.model, 'claude-test');
  assert.equal(m.live, true);
});

test('Anthropic request shape (MOCKED fetch, not a live call)', async () => {
  let req;
  const fetchImpl = async (url, init) => ((req = { url, init, body: JSON.parse(init.body) }), json({ content: [{ type: 'text', text: 'Hello.' }], usage: { input_tokens: 1, output_tokens: 1 } }));
  const m = new AnthropicModel({ apiKey: 'sk-test', model: 'claude-x', fetchImpl });
  const out = await m.complete({ system: 'sys', messages: [{ role: 'user', content: 'hi' }], tools: [{ name: 't', description: 'd', input_schema: { type: 'object' }, consequential: true }] });
  assert.equal(req.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(req.init.headers['x-api-key'], 'sk-test');
  assert.equal(req.init.headers['anthropic-version'], '2023-06-01');
  assert.deepEqual(Object.keys(req.body).sort(), ['max_tokens', 'messages', 'model', 'system', 'tools']);
  assert.deepEqual(req.body.tools[0], { name: 't', description: 'd', input_schema: { type: 'object' } }); // internal flags not leaked
  assert.equal(out.text, 'Hello.');
});

test('the brain runs a tool loop with an Anthropic-shaped model (MOCKED)', async () => {
  const calls = [];
  const fetchImpl = async (_u, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    if (calls.length === 1) return json({ content: [{ type: 'tool_use', id: 'tu_1', name: 'calendar_analysis', input: { days: 2 } }] });
    return json({ content: [{ type: 'text', text: 'You have four meetings.' }] });
  };
  const v = createVera({ providers: seedProviders(), model: new AnthropicModel({ apiKey: 'k', fetchImpl }) });
  const r = await v.brain.respond('what is on my calendar');
  assert.equal(r.text, 'You have four meetings.');
  assert.deepEqual(r.toolCalls.map(c => c.name), ['calendar_analysis']);
  const second = calls[1].messages;
  assert.equal(second.at(-2).content.at(-1).type, 'tool_use');
  const tr = second.at(-1).content[0];
  assert.equal(tr.type, 'tool_result');
  assert.equal(tr.tool_use_id, 'tu_1');
  assert.equal(JSON.parse(tr.content).result.count, 4); // real tool output went back to the model
  assert.match(calls[0].system, /You are Vera/);
  assert.match(calls[0].system, /EXECUTIVE_INTENT/);
});

test('a model that asks to send email still cannot send without the user', async () => {
  const fetchImpl = async (_u, init) => {
    const body = JSON.parse(init.body);
    return body.messages.length === 1
      ? json({ content: [{ type: 'tool_use', id: 'tu', name: 'email_send', input: { to: 'Carlos', subject: 'Hi', body: 'Hi' } }] })
      : json({ content: [{ type: 'text', text: 'Drafted. Shall I send it?' }] });
  };
  const v = createVera({ providers: seedProviders(), model: new AnthropicModel({ apiKey: 'k', fetchImpl }) });
  const r = await v.brain.respond('write to Carlos');
  assert.equal(r.toolCalls[0].status, 'awaiting_confirmation');
  assert.equal(v.email.outbox.length, 0);
});

test('API errors surface as errors and aborts are honoured', async () => {
  const bad = new AnthropicModel({ apiKey: 'k', fetchImpl: async () => json({ error: 'x' }, false, 529) });
  await assert.rejects(bad.complete({ system: '', messages: [{ role: 'user', content: 'x' }] }), /529/);
  const ac = new AbortController();
  ac.abort();
  await assert.rejects(bad.complete({ system: '', messages: [], signal: ac.signal }), { name: 'AbortError' });
});

test('history that opens with a proactive alert is sent with a leading user turn (API requires user first)', async () => {
  const sent = [];
  const fetchImpl = async (_u, init) => (sent.push(JSON.parse(init.body).messages), json({ content: [{ type: 'text', text: 'ok' }] }));
  const v = createVera({ providers: seedProviders({ carlosEmail: false }), model: new AnthropicModel({ apiKey: 'k', fetchImpl }) });
  const { CARLOS_EMAIL } = await import('../../lib/vera/scenario.mjs');
  v.brain.announce((await v.executive.ingest(CARLOS_EMAIL)).notification);
  await v.brain.respond('yes');
  assert.equal(sent[0][0].role, 'user');
  assert.deepEqual(sent[0].map(m => m.role), ['user', 'assistant', 'user']);
});
