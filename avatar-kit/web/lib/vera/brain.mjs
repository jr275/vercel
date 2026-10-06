// EXECUTIVE BRAIN: one assistant. Turns a user utterance into a reply by
//   classify intent -> cognitive state -> recall memory -> model <-> tools loop -> reply.
// It knows nothing about voice or the avatar. Cancellation: pass an AbortSignal; an aborted turn leaves
// memory, gate and history untouched except for recording that the turn was cancelled.
import { classifyIntent, createCognition } from './cognition.mjs';
import { buildSystemPrompt } from './persona.mjs';
import { alertText } from './synthesis.mjs';
import { throwIfAborted, isAbort } from './util.mjs';

const MAX_STEPS = 4;

export function createBrain({ memory, registry, gate, executive, model, skills = [], now = () => Date.now() }) {
  const cognition = createCognition({ now });
  const history = []; // { role:'user'|'assistant', content, interrupted?, spoken?, cancelled? }
  let pending = { offer: null, confirmation: null };

  const syncPending = () => (pending.confirmation = gate.pending().slice(-1)[0] ?? null);
  const modelHistory = () =>
    history
      .filter(h => !h.cancelled)
      .slice(-10)
      .map(h => ({ role: h.role, content: h.interrupted ? `${h.spoken ?? ''} [interrupted by the user]` : h.content }));

  async function respond(text, { signal } = {}) {
    throwIfAborted(signal);
    syncPending();
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
      if (intent === 'confirm') {
        const r = await gate.confirm(pending.confirmation?.id);
        pending.confirmation = null;
        const reply = r.ok ? `Done. Sent to ${r.result?.toName ?? r.result?.to ?? 'the recipient'}.` : 'There is nothing waiting for confirmation.';
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
      const system = buildSystemPrompt({ cognitive: cognition.snapshot(), now: now(), skills });
      const messages = [...modelHistory().slice(0, -1), { role: 'user', content: text }];
      const toolCalls = [];
      let reply = '';
      for (let step = 0; step < MAX_STEPS; step++) {
        throwIfAborted(signal);
        const out = await model.complete({ system, messages, tools: registry.definitions(), signal, meta: { intent, entities, offer, text } });
        throwIfAborted(signal);
        if (!out.toolCalls?.length) {
          reply = out.text;
          break;
        }
        messages.push({ role: 'assistant', content: out.text, toolCalls: out.toolCalls });
        const results = [];
        for (const c of out.toolCalls) {
          const r = await registry.call(c.name, c.args, { signal });
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

  function finish(text, { intent, toolCalls }) {
    history.push({ role: 'assistant', content: text });
    return { text, intent, toolCalls, cognitive: cognition.snapshot(), pending: { offer: pending.offer, confirmation: pending.confirmation }, model: model.id, live: !!model.live };
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
    /** The user cut Vera off: remember only what was actually said aloud. */
    noteInterrupted(spoken) {
      const last = [...history].reverse().find(h => h.role === 'assistant');
      if (last) Object.assign(last, { interrupted: true, spoken: spoken ?? '' });
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
