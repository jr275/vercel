// Workspace scoping for Anthropic requests. Mocked fetch only: the real API is never called here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AnthropicModel, createModel } from '../../lib/vera/models.mjs';

const capture = () => {
  const seen = [];
  const fetchImpl = async (_u, init) => (seen.push(init.headers), { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'ok' }] }) });
  return { seen, fetchImpl };
};
const ask = m => m.complete({ system: 's', messages: [{ role: 'user', content: 'hi' }] });

test('with a workspace id, the request carries anthropic-workspace-id', async () => {
  const { seen, fetchImpl } = capture();
  await ask(new AnthropicModel({ apiKey: 'k', workspaceId: 'wrkspc_test', fetchImpl }));
  assert.equal(seen[0]['anthropic-workspace-id'], 'wrkspc_test');
  assert.equal(seen[0]['x-api-key'], 'k');
});

test('without a workspace id, the header is absent (workspace-scoped keys keep working)', async () => {
  const { seen, fetchImpl } = capture();
  await ask(new AnthropicModel({ apiKey: 'k', fetchImpl }));
  await ask(new AnthropicModel({ apiKey: 'k', workspaceId: '', fetchImpl }));
  assert.ok(seen.every(h => !('anthropic-workspace-id' in h)));
});

test('createModel reads ANTHROPIC_WORKSPACE_ID from the environment, and never from anywhere else', async () => {
  const { seen, fetchImpl } = capture();
  await ask(createModel({ env: { ANTHROPIC_API_KEY: 'k', ANTHROPIC_WORKSPACE_ID: 'wrkspc_env' }, fetchImpl }));
  await ask(createModel({ env: { ANTHROPIC_API_KEY: 'k' }, fetchImpl }));
  assert.equal(seen[0]['anthropic-workspace-id'], 'wrkspc_env');
  assert.ok(!('anthropic-workspace-id' in seen[1]));
});

test('the workspace id does not appear in the model description or errors', async () => {
  const m = new AnthropicModel({ apiKey: 'k-secret', workspaceId: 'wrkspc_secret', fetchImpl: async () => ({ ok: false, status: 400, text: async () => 'bad', json: async () => ({}) }) });
  assert.ok(!JSON.stringify({ id: m.id }).includes('wrkspc_secret'));
  await assert.rejects(ask(m), e => !/wrkspc_secret|k-secret/.test(e.message));
});
