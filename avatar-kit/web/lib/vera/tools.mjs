// TOOLS: a registry the model can call, and the human-in-the-loop ConfirmationGate.
// A consequential tool (send, schedule, cancel, purchase, message) never executes straight from a model
// request: it is parked in the gate until the *user* confirms, unless the user granted standing
// autonomy for that tool (`gate.authorize`). The model has no way to confirm on its own behalf.

export function createConfirmationGate({ now = () => Date.now() } = {}) {
  const parked = new Map();
  const autonomy = new Map(); // tool -> { scope, grantedAt }
  const audit = [];
  let seq = 0;
  const log = (event, data) => audit.push({ at: now(), event, ...data });
  const gate = {
    audit,
    autonomy: tool => (autonomy.has(tool) ? 'auto' : 'confirm'),
    /** Standing authorisation: the seam for future autonomy. Explicit, per tool, revocable. */
    authorize(tool, scope = 'all') {
      autonomy.set(tool, { scope, grantedAt: now() });
      log('authorize', { tool, scope });
    },
    revoke(tool) {
      autonomy.delete(tool);
      log('revoke', { tool });
    },
    park(tool, args, summary, run) {
      const id = `confirm_${++seq}`;
      const p = { id, tool, args, summary, at: now(), status: 'pending', run };
      parked.set(id, p);
      log('park', { id, tool, summary });
      return gate.view(p);
    },
    view: p => ({ id: p.id, tool: p.tool, args: p.args, summary: p.summary, at: p.at, status: p.status }),
    pending: () => [...parked.values()].filter(p => p.status === 'pending').map(gate.view),
    async confirm(id) {
      const p = id ? parked.get(id) : [...parked.values()].reverse().find(x => x.status === 'pending');
      if (!p || p.status !== 'pending') return { ok: false, error: 'nothing_pending' };
      p.status = 'confirmed';
      log('confirm', { id: p.id, tool: p.tool });
      const result = await p.run();
      p.status = 'executed';
      log('execute', { id: p.id, tool: p.tool });
      return { ok: true, id: p.id, tool: p.tool, result };
    },
    decline(id) {
      const p = id ? parked.get(id) : [...parked.values()].reverse().find(x => x.status === 'pending');
      if (!p || p.status !== 'pending') return { ok: false, error: 'nothing_pending' };
      p.status = 'declined';
      log('decline', { id: p.id, tool: p.tool });
      return { ok: true, id: p.id, tool: p.tool };
    },
  };
  return gate;
}

export function createToolRegistry({ gate }) {
  const tools = new Map();
  const calls = [];
  return {
    calls,
    register(def) {
      tools.set(def.name, def);
    },
    has: n => tools.has(n),
    names: () => [...tools.keys()],
    definitions: () => [...tools.values()].map(({ name, description, input_schema, consequential }) => ({ name, description, input_schema, consequential: !!consequential })),
    /** Execute a tool. Returns { ok, result } | { ok, status:'awaiting_confirmation', confirmation } | { ok:false, error } */
    async call(name, args = {}, { signal } = {}) {
      const def = tools.get(name);
      const rec = { name, args, at: Date.now() };
      calls.push(rec);
      if (!def) return Object.assign(rec, { ok: false, error: `unknown_tool:${name}` });
      try {
        if (def.consequential && gate.autonomy(name) !== 'auto') {
          const confirmation = gate.park(name, args, def.describe ? def.describe(args) : `${name} ${JSON.stringify(args)}`, () => def.run(args, { signal }));
          return Object.assign(rec, { ok: true, status: 'awaiting_confirmation', confirmation });
        }
        const result = await def.run(args, { signal });
        return Object.assign(rec, { ok: true, status: 'done', result });
      } catch (e) {
        if (e?.name === 'AbortError') throw e;
        return Object.assign(rec, { ok: false, error: String(e?.message ?? e) });
      }
    },
  };
}
