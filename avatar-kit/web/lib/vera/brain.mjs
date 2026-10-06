// EXECUTIVE BRAIN: one assistant. Turns a user utterance into a reply by
//   classify intent -> cognitive state -> recall memory -> model <-> tools loop -> reply.
// It knows nothing about voice or the avatar. Cancellation: pass an AbortSignal; an aborted turn leaves
// memory, gate and history untouched except for recording that the turn was cancelled.
import { classifyIntent, createCognition, parseConfirmation } from './cognition.mjs';
import { buildSystemPrompt } from './persona.mjs';
import { alertText } from './synthesis.mjs';
import { throwIfAborted, isAbort } from './util.mjs';
import { auditClaims } from './grounding.mjs';

const MAX_STEPS = 4;
const ADDR_RE = /[^\s@<>,;"']+@[^\s@<>,;"']+\.[^\s@<>,;"']+/g;
const CLARIFY = 'I have not done anything yet. To go ahead, say just "yes". To cancel, say "no".';
const EXPIRED = 'That request expired, so nothing was sent. Ask me again if you still want it.';

export function createBrain({ memory, registry, gate, executive, model, skills = [], now = () => Date.now() }) {
  const cognition = createCognition({ now });
  const history = []; // { role:'user'|'assistant', content, interrupted?, spoken?, cancelled? }
  let pending = { offer: null, confirmation: null };
  let focus = null; // the event/context/insight the conversation is currently about (system facts with provenance)
  let turnStart = { audit: 0, calls: 0 };

  // addresses the USER typed (never tool output, never model output): the only way to reach a non-contact
  const userAddresses = () => history.filter(h => h.role === 'user' && !h.cancelled).flatMap(h => h.content.match(ADDR_RE) ?? []);
  const syncPending = () => (pending.confirmation = gate.pending().slice(-1)[0] ?? null);
  const modelHistory = () =>
    history
      .filter(h => !h.cancelled)
      .slice(-10)
      .map(h => ({ role: h.role, content: h.interrupted ? `${h.spoken ?? ''} [interrupted by the user]` : h.content }));

  async function respond(text, { signal } = {}) {
    throwIfAborted(signal);
    syncPending();
    turnStart = { audit: gate.audit.length, calls: registry.calls.length };
    const turn = { role: 'user', content: text };
    history.push(turn);
    try {
      // --- cognitive state ---------------------------------------------------------------------
      const { intent, entities } = classifyIntent(text, { memory, pending });
      cognition.set('EXECUTIVE_INTENT', { intent }, text);
      cognition.set('EXECUTIVE_CONTEXT', { people: entities.people, projects: entities.projects, ctx: entities.people.map(n => memory.contextFor({ person: n }).projects.map(p => p.name)) });
      cognition.set('EXECUTIVE_PRIORITY', executive.surfaced().slice(-3).map(a => ({ who: a.signal.who, topic: a.topic, class: a.classification })));
      const recalled = memory.recall(text, { limit: 4 });
      cognition.set('EXECUTIVE_MEMORY', recalled.map(r => ({ kind: r.kind, text: r.text.slice(0, 80) })));

      // --- confirmations are never delegated to the model ---------------------------------------
      const expired = gate.takeExpired();
      if (!pending.confirmation && expired.length && parseConfirmation(text) === 'confirm') {
        cognition.set('EXECUTIVE_ACTION', { status: 'expired', tool: expired[0].tool });
        return finish(EXPIRED, { intent: 'confirm_expired', toolCalls: [], signal });
      }
      if (intent === 'confirm_ambiguous') {
        cognition.set('EXECUTIVE_ACTION', { status: 'awaiting_confirmation', note: 'ambiguous reply, not confirmed' });
        return finish(CLARIFY, { intent, toolCalls: [], signal });
      }
      if (intent === 'confirm') {
        const r = await gate.confirm(pending.confirmation?.id);
        pending.confirmation = null;
        const reply = r.ok ? (r.tool === 'email_send' ? `Done. Sent to ${r.result?.toName ?? r.result?.to ?? 'the recipient'}.` : 'Done.') : r.error === 'expired' ? EXPIRED : 'There is nothing waiting for confirmation.';
        cognition.set('EXECUTIVE_ACTION', { status: r.ok ? 'executed' : 'none', tool: r.tool });
        return finish(reply, { intent, toolCalls: r.ok ? [{ name: r.tool, status: 'executed' }] : [], signal });
      }
      if (intent === 'decline') {
        gate.decline(pending.confirmation?.id);
        pending.confirmation = null;
        cognition.set('EXECUTIVE_ACTION', { status: 'declined' });
        return finish('Understood. I have not sent anything.', { intent, toolCalls: [], signal });
      }
      const offer = intent === 'accept_offer' ? pending.offer : null;
      if (intent === 'accept_offer' || intent === 'decline_offer') pending.offer = null;

      // --- model <-> tools loop --------------------------------------------------------------------
      const toolCalls = [];
      // The user's own words are the only source of 'user' authority. These two writes are performed by code from
      // the user's literal utterance (origin:'user'); the model is told they happened and cannot repeat them.
      let direct = null;
      if (intent === 'learn') direct = { tool: 'memory_learn', args: { text } };
      else if (intent === 'reminder') direct = { tool: 'reminder_add', args: { text: text.replace(/^\s*remind me( to)?\s*/i, '').trim(), person: entities.people[0] } };
      if (direct) {
        const r = await registry.call(direct.tool, direct.args, { signal, origin: 'user', userAddresses: userAddresses() });
        throwIfAborted(signal);
        toolCalls.push({ name: direct.tool, args: direct.args, status: r.status ?? (r.ok ? 'done' : 'error'), origin: 'user' });
        direct.result = r.result;
        cognition.set('EXECUTIVE_ACTION', { status: r.status ?? 'error', tool: direct.tool, provenance: 'user' });
      }
      const system = buildSystemPrompt({ cognitive: cognition.snapshot(), now: now(), skills, focus }) + (direct ? `\nThe user's request was already carried out and stored (${direct.tool}). Acknowledge it briefly; do not call that tool again.` : '');
      const messages = [...modelHistory().slice(0, -1), { role: 'user', content: text }];
      const offered = registry.definitions().filter(t => !direct || t.name !== direct.tool);
      let reply = '';
      for (let step = 0; step < MAX_STEPS; step++) {
        throwIfAborted(signal);
        const out = await model.complete({ system, messages, tools: offered, signal, meta: { intent, entities, offer, text, done: direct ? { tool: direct.tool, result: direct.result } : null } });
        throwIfAborted(signal);
        if (!out.toolCalls?.length) {
          reply = out.text;
          break;
        }
        messages.push({ role: 'assistant', content: out.text, toolCalls: out.toolCalls });
        const results = [];
        for (const c of out.toolCalls) {
          // the model may only use the tools it was offered this turn
          const r = !offered.some(t => t.name === c.name) ? { ok: false, error: `tool_not_available:${c.name}` } : await registry.call(c.name, c.args, { signal, origin: 'model', userAddresses: userAddresses() });
          throwIfAborted(signal);
          toolCalls.push({ name: c.name, args: c.args, status: r.status ?? (r.ok ? 'done' : 'error') });
          const output = { ok: r.ok, status: r.status, error: r.error, result: r.result, confirmation: r.confirmation };
          results.push({ id: c.id, name: c.name, output });
          cognition.set('EXECUTIVE_ACTION', { status: r.status ?? 'error', tool: c.name });
          if (r.status === 'awaiting_confirmation') pending.confirmation = r.confirmation;
          if (c.name === 'morning_briefing' && r.result?.offer) pending.offer = { label: 'Prepare the briefing', calls: r.result.items.filter(i => i.action).map(i => [i.action.tool, i.action.args]) };
          if (c.name === 'meeting_prep') pending.offer = null;
        }
        messages.push({ role: 'tool', results });
      }
      if (!reply) reply = 'I could not complete that. Could you rephrase?';
      if (!toolCalls.length) cognition.set('EXECUTIVE_ACTION', { status: 'none' });
      return finish(reply, { intent, toolCalls, signal });
    } catch (e) {
      if (isAbort(e)) {
        turn.cancelled = true;
        cognition.set('EXECUTIVE_ACTION', { status: 'cancelled' });
      }
      throw e;
    }
  }

  function finish(modelText, { intent, toolCalls }) {
    // MODEL CLAIM != SYSTEM REALITY: what the system actually did this turn, from the gate and the registry
    const executed = gate.audit.slice(turnStart.audit).filter(a => a.event === 'execute');
    const facts = {
      sent: executed.some(a => a.tool === 'email_send') || registry.calls.slice(turnStart.calls).some(c => c.name === 'email_send' && c.status === 'done'),
      memoryWritten: registry.calls.slice(turnStart.calls).some(c => c.name === 'memory_learn' && c.status === 'done'),
      confirmed: gate.audit.slice(turnStart.audit).some(a => a.event === 'confirm'),
    };
    const audited = auditClaims(modelText, facts, { pendingDraft: !!gate.pending().length });
    const text = audited.text;
    history.push({ role: 'assistant', content: text });
    return { text, claim_audit: { flags: audited.flags, corrected: audited.flags.length > 0, model_text: audited.flags.length ? modelText : undefined }, intent, toolCalls, cognitive: cognition.snapshot(), pending: { offer: pending.offer, confirmation: pending.confirmation }, model: model.id, live: !!model.live };
  }

  return {
    respond,
    /** Proactive: Vera raises an alert on her own. Returns the spoken text and arms the optional action as an offer. */
    announce(notification) {
      const text = alertText(notification);
      history.push({ role: 'assistant', content: text, proactive: true });
      pending.offer = notification.action && !notification.action.consequential ? { label: notification.action.label, calls: [[notification.action.tool, notification.action.args]] } : null;
      cognition.set('EXECUTIVE_PRIORITY', [{ who: notification.signal.who, topic: notification.topic, class: notification.classification }], 'proactive');
      cognition.set('EXECUTIVE_ACTION', { status: pending.offer ? 'proposed' : 'none', label: notification.action?.label });
      return { text, notification, pending: { offer: pending.offer, confirmation: pending.confirmation } };
    },
    /** Proactive executive alert: speak it and make the event/context/insight the focus of the conversation. */
    announceExecutive({ text, focus: f }) {
      focus = f;
      history.push({ role: 'assistant', content: text, proactive: true });
      pending.offer = null;
      cognition.set('EXECUTIVE_CONTEXT', { event: f.event.id, people: f.event.entities?.people ?? [] }, 'proactive');
      cognition.set('EXECUTIVE_ACTION', { status: 'none', note: 'alert raised; any action needs the user' });
      return { text, focus: f, pending: { offer: null, confirmation: pending.confirmation } };
    },
    focus: () => focus,
    /** The user cut Vera off: remember only what was actually said aloud. */
    noteInterrupted(spoken) {
      // accept only a prefix of what she actually said: a client cannot rewrite the history with arbitrary text
      const last = [...history].reverse().find(h => h.role === 'assistant');
      const n = s => String(s ?? '').replace(/\s+/g, ' ').trim();
      if (last && n(last.content).startsWith(n(spoken))) Object.assign(last, { interrupted: true, spoken: n(spoken) });
    },
    pending: () => ({ ...pending }),
    history: () => history.map(h => ({ ...h })),
    cognition,
    reset() {
      history.length = 0;
      pending = { offer: null, confirmation: null };
      cognition.reset();
    },
  };
}
