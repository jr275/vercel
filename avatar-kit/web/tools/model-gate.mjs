// REAL MODEL GATE harness (manual). Runs the existing brain against a real Anthropic model and records what happened.
//   ANTHROPIC_API_KEY=... node tools/model-gate.mjs            real model (VERA_MODEL optional)
//   node tools/model-gate.mjs --mock                           same harness against a local MOCK of the Messages API
//                                                              (validates request shape + harness mechanics; NOT a model)
// The key is read from the environment, never printed, never written. Output: JSON report on stdout.
import http from 'node:http';
import { createVera } from '../lib/vera/create.mjs';
import { AnthropicModel } from '../lib/vera/models.mjs';
import { seedProviders } from '../lib/vera/scenario.mjs';

const MOCK = process.argv.includes('--mock');
const PROMPTS = ['Prepare me for my meeting with Carlos tomorrow.', 'Carlos says pricing is urgent.'];

// ---- a strict mock of the parts of the Messages API contract that the real API enforces -------------------------
function startMock() {
  const seen = [];
  const server = http.createServer((req, res) => {
    let b = '';
    req.on('data', c => (b += c));
    req.on('end', () => {
      const body = JSON.parse(b);
      const errs = [];
      if (!req.headers['x-api-key']) errs.push('missing x-api-key');
      if (req.headers['anthropic-version'] !== '2023-06-01') errs.push('bad anthropic-version');
      const m = body.messages ?? [];
      if (!m.length || m[0].role !== 'user') errs.push(`first message must be user (got ${m[0]?.role})`);
      const ids = new Set();
      m.forEach((x, i) => {
        const blocks = Array.isArray(x.content) ? x.content : [];
        blocks.filter(k => k.type === 'tool_use').forEach(k => ids.add(k.id));
        blocks.filter(k => k.type === 'tool_result').forEach(k => !ids.has(k.tool_use_id) && errs.push(`tool_result ${k.tool_use_id} without tool_use`));
        if (x.role === 'assistant' && Array.isArray(x.content) && !x.content.length) errs.push('empty assistant content');
        if (typeof x.content === 'string' && !x.content.trim()) errs.push(`empty ${x.role} text at ${i}`);
      });
      (body.tools ?? []).forEach(t => Object.keys(t).some(k => !['name', 'description', 'input_schema'].includes(k)) && errs.push(`tool ${t.name} has extra keys`));
      seen.push({ n: m.length, errs });
      res.setHeader('content-type', 'application/json');
      if (errs.length) { res.statusCode = 400; return res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: errs.join('; ') } })); }
      const last = m[m.length - 1];
      const lastIsResult = Array.isArray(last.content) && last.content[0]?.type === 'tool_result';
      const userText = typeof m.filter(x => x.role === 'user' && typeof x.content === 'string').at(-1)?.content === 'string' ? m.filter(x => x.role === 'user' && typeof x.content === 'string').at(-1).content : '';
      if (!lastIsResult && /meeting/i.test(userText)) return res.end(JSON.stringify({ content: [{ type: 'tool_use', id: 'toolu_mock1', name: 'meeting_prep', input: { person: 'Carlos' } }], usage: { input_tokens: 1, output_tokens: 1 } }));
      return res.end(JSON.stringify({ content: [{ type: 'text', text: lastIsResult ? 'MOCK final answer from tool result.' : 'MOCK answer.' }], usage: { input_tokens: 1, output_tokens: 1 } }));
    });
  });
  return new Promise(r => server.listen(0, () => r({ server, seen, url: `http://127.0.0.1:${server.address().port}` })));
}

const apiKey = MOCK ? 'mock-key' : process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.log(JSON.stringify({ ran: false, reason: 'ANTHROPIC_API_KEY is not set in this environment; no real model call was made.' }, null, 2));
  process.exit(2);
}
const mock = MOCK ? await startMock() : null;
const modelId = process.env.VERA_MODEL || 'claude-sonnet-5-5';
const calls = [];
const instrumented = async (url, init) => {
  const t0 = Date.now();
  const body = JSON.parse(init.body);
  const rec = { turnMessages: body.messages.length, tools: body.tools.length, ms: null, status: null, stop: null, usage: null };
  calls.push(rec);
  try {
    const res = await fetch(url, init);
    rec.status = res.status;
    const clone = res.clone();
    const j = await clone.json().catch(() => ({}));
    rec.stop = j.stop_reason ?? null;
    rec.usage = j.usage ?? null;
    if (!res.ok) rec.error = (j.error?.message ?? '').slice(0, 300);
    return res;
  } finally {
    rec.ms = Date.now() - t0;
  }
};
const model = new AnthropicModel({ apiKey, model: modelId, baseUrl: mock?.url ?? process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com', fetchImpl: instrumented });
const report = { ran: true, mode: MOCK ? 'MOCK (not a model)' : 'REAL', model: modelId, runs: [] };

for (const prompt of PROMPTS) {
  const v = createVera({ providers: seedProviders({ carlosEmail: true }), model });
  const memBefore = JSON.stringify(v.memory.toJSON());
  const c0 = calls.length;
  const t0 = Date.now();
  let out, error = null;
  try { out = await v.brain.respond(prompt); } catch (e) { error = String(e.message).slice(0, 300); }
  report.runs.push({
    prompt,
    latencyMs: Date.now() - t0,
    modelTurns: calls.length - c0,
    httpCalls: calls.slice(c0).map(c => ({ ms: c.ms, status: c.status, stop: c.stop, tokens: c.usage })),
    toolCalls: v.registry.calls.map(c => ({ name: c.name, args: c.args, status: c.status ?? (c.ok ? 'done' : c.error) })),
    intentClassifiedByCode: out?.intent ?? null,
    finalResponse: out?.text ?? null,
    error,
    memoryMutated: memBefore !== JSON.stringify(v.memory.toJSON()),
    outbox: v.email.outbox.length,
    parkedConfirmations: v.gate.pending().length,
  });
}

// abort behaviour: abort while the request is in flight; nothing may be committed
{
  const v = createVera({ providers: seedProviders({ carlosEmail: true }), model });
  const memBefore = JSON.stringify(v.memory.toJSON());
  const ac = new AbortController();
  const p = v.brain.respond(PROMPTS[0], { signal: ac.signal });
  setTimeout(() => ac.abort(), MOCK ? 0 : 150);
  let name = null;
  try { await p; } catch (e) { name = e.name; }
  report.abort = { error: name, toolCallsExecuted: v.registry.calls.length, historyCancelled: v.brain.history()[0]?.cancelled === true, memoryMutated: memBefore !== JSON.stringify(v.memory.toJSON()) };
}
if (mock) { report.mockRequestViolations = mock.seen.filter(s => s.errs.length).map(s => s.errs); mock.server.close(); }
console.log(JSON.stringify(report, null, 2));
