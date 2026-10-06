// Server-side singleton for the Next API route (single process, in-memory; state resets on restart).
import { createVera } from './create.mjs';
import { createSessionStore } from './sessions.mjs';
import { seedProviders, CARLOS_EMAIL } from './scenario.mjs';

let n = 0;
export const PRESETS = {
  carlos_email: now => ({ ...CARLOS_EMAIL, id: `inj_carlos_${++n}`, at: now }),
  competitor_news: now => ({ kind: 'news', id: `inj_news_${++n}`, at: now, headline: 'Lumen Systems announces a second price cut on enterprise plans', summary: 'The competitor repositions enterprise pricing again.' }),
  newsletter: now => ({ kind: 'email', id: `inj_spam_${++n}`, at: now, from: 'Weekly Digest <digest@news.example>', subject: 'Your weekly digest', body: 'Ten links you might like.' }),
  stranger_urgent: now => ({ kind: 'email', id: `inj_stranger_${++n}`, at: now, from: 'Unknown Sender <x@y.example>', subject: 'URGENT act now', body: 'urgent deadline today' }),
};

function build() {
  return createVera({ providers: seedProviders({ carlosEmail: true }), env: process.env });
}
export function getStore() {
  const g = globalThis;
  g.__veraSessions ??= createSessionStore({ factory: build });
  return g.__veraSessions;
}
/** Event injection is a simulation tool: off in production unless VERA_SIMULATION=1. */
export const simulationEnabled = () => process.env.NODE_ENV !== 'production' || process.env.VERA_SIMULATION === '1';

export async function snapshot(v) {
  const sent = v.email.sent ? await v.email.sent({}) : [];
  const mem = v.memory.toJSON();
  return {
    model: { id: v.model.id, live: !!v.model.live },
    providers: { calendar: v.calendar.id, email: v.email.id, news: v.news.id, simulated: true },
    memory: Object.fromEntries(Object.entries(mem).filter(([k]) => k !== 'seq').map(([k, a]) => [k, a.length])),
    memoryItems: { people: mem.people.map(p => p.name), decisions: mem.decisions.map(d => `${d.topic} [${d.status}]`), commitments: mem.commitments.map(c => `${c.text} [${c.status}]`), issues: mem.issues.map(i => `${i.text} [${i.status}]`), facts: mem.facts.map(f => f.text), preferences: mem.preferences.map(p => p.text) },
    cognitive: v.brain.cognition.snapshot(),
    pending: { ...v.brain.pending(), gate: v.gate.pending() },
    skills: v.skills,
    tools: v.registry.definitions().map(t => ({ name: t.name, consequential: t.consequential })),
    toolCalls: v.registry.calls.slice(-12).map(c => ({ name: c.name, args: c.args, status: c.status ?? (c.ok ? 'done' : c.error) })),
    audit: v.gate.audit.slice(-10),
    outbox: sent.map(o => ({ to: o.toName ?? o.to, subject: o.subject })),
    capabilities: { email: v.email.capabilities, calendar: v.calendar.capabilities },
    briefing: (b => b && { signals: b.notifications.length, items: b.items.map(i => ({ n: i.n, label: i.label, classification: i.classification, importance: +i.importance.toFixed(2) })), also: b.also, signalRows: b.notifications.map(n => ({ kind: n.kind, title: n.signal.title, classification: n.classification, decision: n.decision, importance: n.importance })) })(v.executive.lastBriefing()),
    alerts: v.executive.alerts.slice(-8).map(a => ({ id: a.id, classification: a.classification, decision: a.decision, who: a.signal.who, title: a.signal.title, importance: a.importance })),
  };
}
