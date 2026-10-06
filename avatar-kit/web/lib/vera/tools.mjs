// TOOLS: a registry the model can call, and the human-in-the-loop ConfirmationGate.
// AUTHORITY RULES (enforced here, in code, not in the prompt):
//  * A consequential tool (send, schedule, cancel, purchase, message) never executes straight from a model
//    request: it is parked in the gate until the *user* confirms, unless the user granted standing autonomy
//    for that tool (`gate.authorize`). The model has no way to confirm on its own behalf.
//  * A tool with `gateModelOrigin` (e.g. creating a commitment) runs immediately only when the call originates
//    from the user's own words (origin:'user', set by the brain from code). A model-originated call is only a
//    PROPOSAL: it is parked and needs the user's confirmation.
//  * A parked action expires (TTL) and shows the user everything it will do (`preview`).
//  * `validate(args, ctx)` runs BEFORE parking, so an unauthorised action is never even proposed.

export const DEFAULT_TTL_MS = 5 * 60 * 1000;

export function createConfirmationGate({ now = () => Date.now(), ttlMs = DEFAULT_TTL_MS } = {}) {
  const parked = new Map();
  const autonomy = new Map(); // tool -> { scope, grantedAt }
  const audit = [];
  const expiredQueue = [];
  let seq = 0;
  const log = (event, data) => audit.push({ at: now(), event, ...data });
  const sweep = () => {
    for (const p of parked.values()) {
      if (p.status === 'pending' && now() >= p.expiresAt) {
        p.status = 'expired';
        expiredQueue.push(gate.view(p));
        log('expire', { id: p.id, tool: p.tool });
      }
    }
  };
  const find = id => (id ? parked.get(id) : [...parked.values()].reverse().find(x => x.status === 'pending'));
  const gate = {
    audit,
    ttlMs,
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
    park(tool, args, summary, run, { preview = null, proposedBy = 'model' } = {}) {
      const id = `confirm_${++seq}`;
      const p = { id, tool, args, summary, preview, proposedBy, at: now(), expiresAt: now() + ttlMs, status: 'pending', run };
      parked.set(id, p);
      log('park', { id, tool, summary, proposedBy });
      return gate.view(p);
    },
    view: p => ({ id: p.id, tool: p.tool, args: p.args, summary: p.summary, preview: p.preview, proposedBy: p.proposedBy, at: p.at, expiresAt: p.expiresAt, status: p.status }),
    pending() {
      sweep();
      return [...parked.values()].filter(p => p.status === 'pending').map(gate.view);
    },
    /** Actions that expired since the last call (so the brain can say so once). */
    takeExpired() {
      sweep();
      return expiredQueue.splice(0);
    },
    async confirm(id) {
      sweep();
      const p = find(id);
      if (!p) return { ok: false, error: 'nothing_pending' };
      if (p.status === 'expired') return { ok: false, error: 'expired', id: p.id, tool: p.tool };
      if (p.status !== 'pending') return { ok: false, error: 'nothing_pending' };
      p.status = 'confirmed';
      log('confirm', { id: p.id, tool: p.tool });
      const result = await p.run();
      p.status = 'executed';
      log('execute', { id: p.id, tool: p.tool });
      return { ok: true, id: p.id, tool: p.tool, result };
    },
    decline(id) {
      sweep();
      const p = find(id);
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
    /**
     * Execute a tool.
     * ctx.origin: 'model' (default, least authority) | 'user' (only the brain sets this, from the user's own words)
     * ctx.userAddresses: e-mail addresses the user typed themselves (for recipient authority)
     * Returns { ok, status:'done', result } | { ok, status:'awaiting_confirmation', confirmation } | { ok:false, error }
     */
    async call(name, args = {}, { signal, origin = 'model', userAddresses = [] } = {}) {
      const def = tools.get(name);
      const rec = { name, args, origin, at: Date.now() };
      calls.push(rec);
      if (!def) return Object.assign(rec, { ok: false, error: `unknown_tool:${name}` });
      const ctx = { signal, origin, userAddresses };
      try {
        const bad = def.validate?.(args, ctx);
        if (bad) return Object.assign(rec, { ok: false, error: bad });
        const needsGate = (def.consequential && gate.autonomy(name) !== 'auto') || (def.gateModelOrigin && origin !== 'user');
        if (needsGate) {
          const summary = def.describe ? def.describe(args, ctx) : `${name} ${JSON.stringify(args)}`;
          const confirmation = gate.park(name, args, summary, () => def.run(args, { ...ctx, confirmed: true }), { preview: def.preview ? def.preview(args, ctx) : { args }, proposedBy: origin });
          return Object.assign(rec, { ok: true, status: 'awaiting_confirmation', confirmation });
        }
        const result = await def.run(args, ctx);
        return Object.assign(rec, { ok: true, status: 'done', result });
      } catch (e) {
        if (e?.name === 'AbortError') throw e;
        return Object.assign(rec, { ok: false, error: String(e?.message ?? e) });
      }
    },
  };
}
