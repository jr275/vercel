// PROACTIVE INTELLIGENCE
// EVENT -> INGESTION -> NORMALIZATION -> RELEVANCE -> CONTEXT -> IMPORTANCE -> DECISION -> NOTIFICATION -> OPTIONAL ACTION
// Every stage appends to a trace, so the review UI can show *why* something was (or was not) surfaced.
// The result is computed from memory + calendar; nothing about the outcome is written in advance.
import { normalize } from './events.mjs';
import { daysBetween, hhmm, list, DAY } from './util.mjs';

/**
 * @typedef {Object} Signal  normalised event (see events.mjs)
 * @typedef {Object} Notification
 * @property {string} id
 * @property {'INFORMATION'|'INSIGHT'|'ACTION'|'URGENT'} classification
 * @property {string} key  grouping key used by synthesis (person or project)
 */

export const THRESHOLDS = { surface: 0.6, digest: 0.35 };

export function createPipeline({ memory, calendar, now = () => Date.now(), thresholds = THRESHOLDS }) {
  const seen = new Set();

  async function nextMeetingWith(people, from) {
    if (!calendar || !people.length) return null;
    const ids = new Set(people.map(p => p.id));
    const evts = await calendar.list({ from, to: from + 14 * DAY });
    return (
      evts.find(e => (e.attendees ?? []).some(a => ids.has(memory.findPerson(a)?.id) && e.start >= from)) ?? null
    );
  }

  /** Run one raw event through every stage. Returns the full record, never throws on irrelevance. */
  async function process(raw) {
    const trace = [];
    const step = (stage, detail, data) => trace.push({ stage, detail, ...(data ? { data } : {}) });
    const t0 = now();

    // 1. EVENT / INGESTION
    const rid = raw.id ?? `${raw.kind}:${raw.at}:${raw.subject ?? raw.title ?? raw.headline ?? ''}`;
    raw = { ...raw, id: rid, at: raw.at ?? t0 };
    step('EVENT', `${raw.kind} received${raw.subject ? `: "${raw.subject}"` : raw.headline ? `: "${raw.headline}"` : ''}`);
    if (seen.has(rid)) {
      step('INGESTION', 'duplicate, dropped');
      return { status: 'duplicate', trace, notification: null };
    }
    seen.add(rid);
    step('INGESTION', `accepted from ${raw.source ?? raw.kind}`);

    // 2. NORMALIZATION
    const sig = normalize(raw, { memory });
    step(
      'NORMALIZATION',
      `people=[${sig.people.map(p => p.name).join(', ') || (sig.unknownPeople ?? []).join(', ') || '-'}] topics=[${sig.topics.join(', ') || '-'}] urgency=${sig.urgency.level.toFixed(1)}`,
      { sender: sig.sender, unknown: sig.unknownPeople }
    );

    // 3. RELEVANCE — why might this matter to *this* executive?
    const why = [];
    const add = (w, text) => why.push({ w, text });
    const ctxs = sig.people.map(p => memory.contextFor({ person: p, topic: sig.topics.join(' ') }));
    const decisions = new Map();
    const commitments = new Map();
    const issues = new Map();
    const projects = new Map();
    ctxs.forEach(c => {
      c.decisions.forEach(d => decisions.set(d.id, d));
      c.commitments.forEach(x => commitments.set(x.id, x));
      c.issues.forEach(x => issues.set(x.id, x));
      c.projects.forEach(x => projects.set(x.id, x));
    });
    // News/topics can be connected to a decision without any person in the text.
    const topicCtx = sig.topics.length ? memory.contextFor({ topic: sig.topics.join(' ') }) : null;
    topicCtx?.decisions.forEach(d => decisions.set(d.id, d));
    if (sig.kind === 'news') memory.projectsIn(sig.text).forEach(p => projects.set(p.id, p));

    if (sig.people.length) add(0.25, `${list(sig.people.map(p => p.name))} ${sig.people.length > 1 ? 'are' : 'is'} in your network`);
    if (decisions.size && sig.topics.length) {
      const matching = [...decisions.values()].filter(d => sig.topics.some(t => d.keywords.includes(t) || d.topic.toLowerCase().includes(t)));
      if (matching.length) add(0.3, `touches unresolved decision: ${list(matching.map(d => d.topic))}`);
    }
    if (projects.size) add(0.15, `connected to ${list([...projects.values()].map(p => p.name))}`);
    if (commitments.size) add(0.2, `${commitments.size} open commitment${commitments.size > 1 ? 's' : ''} involved`);
    if (sig.kind === 'news' && sig.companies?.some(c => c.kind === 'competitor')) {
      add(0.25, `mentions competitor ${list(sig.companies.filter(c => c.kind === 'competitor').map(c => c.name))}`);
    }
    if (sig.kind === 'date') add(sig.inDays <= 1 ? 0.45 : 0.25, `${sig.inDays === 0 ? 'today' : sig.inDays === 1 ? 'tomorrow' : `in ${sig.inDays} days`}`);
    if (sig.kind === 'silence') add(0.5, `${sig.days} days without contact`);
    if (sig.kind === 'calendar') add(0.15, 'on your calendar');
    const relevance = Math.min(1, why.reduce((a, x) => a + x.w, 0));
    step('RELEVANCE', `${relevance.toFixed(2)} — ${why.map(x => x.text).join('; ') || 'nothing connects this to you'}`, { relevance });

    // 4. CONTEXT — what do we already know?
    const context = [];
    for (const c of ctxs) {
      if (c.person) {
        const bits = [c.person.role && c.company ? `${c.person.role}, ${c.company.name ?? c.person.company}` : c.person.company].filter(Boolean);
        if (c.projects.length) context.push(`${c.person.name} is associated with ${list(c.projects.map(p => p.name))}`);
        else if (bits.length) context.push(`${c.person.name} — ${bits[0]}`);
        if (c.lastInteraction) context.push(`last spoke ${c.daysSinceContact} days ago${c.lastInteraction.summary ? ` (${c.lastInteraction.summary})` : ''}`);
      }
    }
    decisions.forEach(d => context.push(`${d.topic.toLowerCase()} was unresolved${d.summary ? ` — ${d.summary}` : ''}`));
    issues.forEach(i => context.push(`open item: ${i.text}`));
    commitments.forEach(c => context.push(`open commitment: ${c.text}${c.dueAt ? ` (due ${new Date(c.dueAt).toISOString().slice(0, 10)})` : ''}`));
    if (sig.unknownPeople?.length) context.push(`${list(sig.unknownPeople)} not in your memory`);
    step('CONTEXT', context.length ? context.join(' | ') : 'no stored context');

    // 5. IMPORTANCE
    const horizon = sig.startsAt ?? sig.dueAt;
    const hoursTo = horizon ? (horizon - t0) / 3600000 : null;
    const timeSens = sig.kind === 'date' ? (sig.inDays <= 1 ? 0.7 : 0.3) : hoursTo == null ? 0 : hoursTo <= 0 ? 1 : hoursTo <= 36 ? 0.9 : hoursTo <= 72 ? 0.5 : 0.2;
    const impact = Math.min(
      1,
      (decisions.size ? 0.6 : 0) + (projects.size ? 0.2 : 0) + (commitments.size ? 0.2 : 0) + (sig.kind === 'news' && decisions.size ? 0.2 : 0) +
        (sig.kind === 'silence' ? 0.4 : 0)
    );
    const urgency = sig.urgency.level;
    const importance = +(0.4 * relevance + 0.25 * urgency + 0.2 * timeSens + 0.15 * impact).toFixed(3);
    step('IMPORTANCE', `${importance} (relevance ${relevance.toFixed(2)}, urgency ${urgency.toFixed(1)}, time ${timeSens.toFixed(1)}, impact ${impact.toFixed(1)})`, { importance, urgency, timeSens, impact });

    // 6. DECISION
    const nextMeeting = await nextMeetingWith(sig.people, t0);
    const decision = importance >= thresholds.surface ? 'SURFACE_NOW' : importance >= thresholds.digest ? 'DIGEST' : 'SUPPRESS';
    step('DECISION', `${decision} (surface ≥ ${thresholds.surface}, digest ≥ ${thresholds.digest})`);
    if (decision === 'SUPPRESS') return { status: 'suppressed', trace, signal: sig, relevance, importance, notification: null };

    // 7. NOTIFICATION — interpretation, not raw data
    const assessment = [];
    if (relevance >= 0.7) assessment.push('high relevance');
    else if (relevance >= 0.45) assessment.push('moderate relevance');
    if (urgency >= 0.6 || timeSens >= 0.7) assessment.push('time-sensitive');
    if (impact >= 0.6) assessment.push('potential business impact');
    if (!assessment.length) assessment.push('low stakes');

    const person = sig.people[0] ?? null;
    const mainDecision = [...decisions.values()][0] ?? null;
    const topic = mainDecision?.topic ?? sig.topics[0] ?? null;
    const mtgTxt = nextMeeting ? `${daysBetween(t0, nextMeeting.start) === 0 ? 'today' : daysBetween(t0, nextMeeting.start) === 1 ? 'tomorrow' : 'on ' + new Date(nextMeeting.start).toISOString().slice(0, 10)} at ${hhmm(nextMeeting.start)}` : null;

    let recommendation = null;
    let action = null;
    if (sig.kind === 'email' && mainDecision) {
      recommendation = `Review the ${mainDecision.topic.toLowerCase()} before ${nextMeeting ? `your meeting ${mtgTxt}` : 'the next meeting'}.`;
      action = { kind: 'prepare_context', label: 'Prepare the relevant context', tool: 'meeting_prep', args: { person: person?.name, topic } };
    } else if (sig.kind === 'email') {
      recommendation = `Reply to ${sig.sender}${urgency >= 0.6 ? ' today' : ''}.`;
      action = { kind: 'draft_reply', label: `Draft a reply to ${sig.sender}`, tool: 'email_send', args: { to: sig.sender }, consequential: true };
    } else if (sig.kind === 'news' && mainDecision) {
      recommendation = `Factor this into the ${mainDecision.topic.toLowerCase()} before it is decided.`;
      action = { kind: 'prepare_context', label: 'Prepare the relevant context', tool: 'decision_support', args: { topic: mainDecision.topic } };
    } else if (sig.kind === 'calendar') {
      const open = [...commitments.values(), ...decisions.values()];
      recommendation = open.length || !sig.agenda ? 'Prepare before it starts.' : null;
      action = open.length || !sig.agenda ? { kind: 'prepare_context', label: 'Prepare the briefing', tool: 'meeting_prep', args: { meeting: sig.title, person: person?.name } } : null;
    } else if (sig.kind === 'commitment') {
      recommendation = `Close this out${sig.dueAt ? (daysBetween(t0, sig.dueAt) <= 0 ? ' today' : ' soon') : ''}.`;
      action = { kind: 'draft_followup', label: 'Draft the follow-up', tool: 'followup_list', args: { person: person?.name } };
    } else if (sig.kind === 'date') {
      recommendation = `Send ${person.name} a note.`;
      action = { kind: 'draft_message', label: 'Draft a message', tool: 'email_send', args: { to: person.name }, consequential: true };
    } else if (sig.kind === 'silence') {
      recommendation = `Reach out to ${person.name}.`;
      action = { kind: 'draft_message', label: 'Draft a message', tool: 'email_send', args: { to: person.name }, consequential: true };
    }
    step('NOTIFICATION', recommendation ?? 'informational');

    const classification =
      urgency >= 0.6 && relevance >= 0.5 ? 'URGENT' : action && importance >= thresholds.digest && sig.kind !== 'date' && sig.kind !== 'news' ? 'ACTION' : sig.kind === 'news' || context.length >= 3 ? 'INSIGHT' : 'INFORMATION';

    const urgencyWord = urgency >= 0.8 ? 'Urgent' : urgency >= 0.6 ? 'Time-sensitive' : null;
    const notification = {
      id: `ntf_${rid}`,
      eventId: rid,
      kind: sig.kind,
      classification,
      decision,
      importance,
      relevance,
      key: person ? `person:${person.id}` : projects.size ? `project:${[...projects.keys()][0]}` : `event:${rid}`,
      people: sig.people.map(p => p.name),
      topic,
      signal: {
        who: sig.kind === 'email' ? sig.sender : person?.name ?? null,
        topic: topic ? topic[0].toUpperCase() + topic.slice(1) : null,
        urgency: urgencyWord,
        title: sig.title,
      },
      context,
      assessment,
      recommendation,
      action,
      why: `This matters because ${why.map(x => x.text).slice(0, 3).join(' and ') || 'it connects to your work'}.`,
      meeting: nextMeeting ? { id: nextMeeting.id, title: nextMeeting.title, start: nextMeeting.start } : null,
      sourceKind: sig.kind,
      raw: { dueAt: sig.dueAt, startsAt: sig.startsAt, inDays: sig.inDays },
    };
    step('OPTIONAL ACTION', action ? `offer: ${action.label}${action.consequential ? ' (needs confirmation to send)' : ''}` : 'none');
    return { status: 'notified', trace, signal: sig, relevance, importance, notification };
  }

  return { process, reset: () => seen.clear() };
}
