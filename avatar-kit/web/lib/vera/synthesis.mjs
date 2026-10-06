// EXECUTIVE SYNTHESIS: many signals -> one coherent briefing. Signals about the same person or project
// are merged, ranked, and cross-linked; the rest is kept as a short "also". Output is computed from
// the notifications; there is no stored briefing text.
import { daysBetween, hhmm, list } from './util.mjs';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];
const rank = n => ({ URGENT: 3, ACTION: 2, INSIGHT: 1, INFORMATION: 0 })[n.classification] * 10 + n.importance;
const when = (t, now) => {
  const d = daysBetween(now, t);
  return `${d === 0 ? 'today' : d === 1 ? 'tomorrow' : 'on ' + new Date(t).toISOString().slice(0, 10)} at ${hhmm(t)}`;
};
const cap = s => s[0].toUpperCase() + s.slice(1);
const lower = s => (s ? s[0].toLowerCase() + s.slice(1) : s);

function label(g) {
  if (g.some(n => n.kind === 'email')) return g.find(n => n.kind === 'email').signal.who.split(' ')[0];
  if (g.some(n => n.kind === 'news')) return 'Market';
  if (g.some(n => n.kind === 'calendar' || n.kind === 'commitment')) return 'Meeting';
  return g[0].signal.who ?? 'Note';
}

function compose(g, now, others) {
  const top = [...g].sort((a, b) => rank(b) - rank(a))[0];
  const email = g.find(n => n.kind === 'email');
  const news = g.find(n => n.kind === 'news');
  const cal = g.find(n => n.kind === 'calendar');
  const cmt = g.find(n => n.kind === 'commitment');
  const parts = [];
  if (email) {
    const topic = lower(email.signal.topic ?? 'the matter');
    parts.push(`${email.signal.who.split(' ')[0]} wrote about ${/decision$/.test(topic) ? 'the ' : ''}${topic}${email.signal.urgency ? ` and flagged it as ${email.signal.urgency.toLowerCase()}` : ''}.`);
    const unresolved = email.context.filter(c => /unresolved|open item/.test(c)).length;
    if (unresolved) parts.push(`${cap(WORDS[unresolved] ?? String(unresolved))} item${unresolved > 1 ? 's' : ''} from your last conversation ${unresolved > 1 ? 'are' : 'is'} still open.`);
    const mtg = g.find(n => n.kind === 'calendar') ?? email;
    if (mtg.meeting && !/meeting/.test(email.recommendation ?? '')) parts.push(`You meet ${when(mtg.meeting.start, now)}.`);
    parts.push(email.recommendation);
  } else if (news) {
    parts.push(`${news.signal.title}.`);
    const link = news.context.find(c => /unresolved/.test(c));
    if (link) parts.push(`It bears on a decision that is still open: ${link.replace(/ was unresolved.*/, '')}.`);
    parts.push(news.recommendation);
  } else {
    if (cal) parts.push(`${cal.signal.title} ${when(cal.raw.startsAt, now)}${cal.people.length ? ` with ${list(cal.people)}` : ''}.`);
    if (cmt) parts.push(`${cmt.signal.title}${cmt.raw.dueAt ? `, due ${when(cmt.raw.dueAt, now)}` : ''}.`);
    if (cal && !cal.raw.agenda && !cal.context.length) parts.push('There is no agenda attached.');
    parts.push(cal?.recommendation ?? cmt?.recommendation);
  }
  // cross-link: another group touching the same topic
  const topic = top.topic;
  const linked = others.find(o => o !== g && topic && o.some(n => n.topic === topic));
  if (linked && !email) parts.push(`This is linked to the ${lower(topic)}.`);
  return parts.filter(Boolean).join(' ');
}

/**
 * @param notifications Notification[] from the pipeline
 * @param opts { now, greeting, firstMeeting }
 */
export function synthesize(notifications, { now, firstMeeting = null, daypart = 'Good morning' } = {}) {
  const live = notifications.filter(n => n && n.decision !== 'SUPPRESS');
  const groups = new Map();
  live.forEach(n => groups.set(n.key, [...(groups.get(n.key) ?? []), n]));
  let all = [...groups.values()];
  // Calendar/commitment signals for a person who also has an email merge into the email item (same key).
  // Personal signals (birthdays, silence) are not headline items.
  const personal = all.filter(g => g.every(n => n.kind === 'date' || n.kind === 'silence'));
  const heads = all.filter(g => !personal.includes(g)).sort((a, b) => Math.max(...b.map(rank)) - Math.max(...a.map(rank)));
  const headline = heads.slice(0, 3);
  const rest = heads.slice(3);

  const items = headline.map((g, i) => ({
    n: i + 1,
    label: label(g),
    text: compose(g, now, heads),
    classification: [...g].sort((a, b) => rank(b) - rank(a))[0].classification,
    importance: Math.max(...g.map(x => x.importance)),
    signals: g.map(x => x.eventId),
    action: g.find(x => x.action)?.action ?? null,
  }));
  const also = [
    ...rest.map(g => `${label(g)}: ${g[0].signal.title}`),
    ...personal.flat().map(n =>
      n.kind === 'date' ? `${n.signal.who ?? n.people[0]}'s ${n.signal.title.split(' ').slice(-1)[0]} is ${n.raw.inDays === 0 ? 'today' : n.raw.inDays === 1 ? 'tomorrow' : `in ${n.raw.inDays} days`}` : `you haven't spoken with ${n.people[0]} in a while`
    ),
  ];
  const prep = items.find(i => i.action?.kind === 'prepare_context');
  const offer = prep ? { kind: 'prepare_briefing', label: 'Prepare the briefing', items: items.map(i => i.n) } : null;

  let text;
  if (!items.length) text = `${daypart}. Nothing needs your attention right now.${also.length ? ` Also, ${list(also)}.` : ''}`;
  else {
    const head = `${daypart}. There ${items.length === 1 ? 'is' : 'are'} ${WORDS[items.length]} thing${items.length > 1 ? 's' : ''} I think you should know${firstMeeting ? ' before your first meeting' : ''}.`;
    text = [head, ...items.map(i => `${i.n}. ${i.label}. ${i.text}`), also.length ? `Also, ${list(also)}.` : '', offer ? 'I can prepare the briefing for you.' : ''].filter(Boolean).join(' ');
  }
  return { text, items, also, offer, count: items.length };
}

/** Spoken form of one proactive alert (SIGNAL / CONTEXT / ASSESSMENT / RECOMMENDATION / ACTION in prose). */
export function alertText(n) {
  const who = n.signal.who ? n.signal.who.split(' ')[0] : null;
  const topic = n.signal.topic ? lower(n.signal.topic) : null;
  const lead =
    n.kind === 'email' ? `${who} just wrote about ${/decision$/.test(topic ?? '') ? 'the ' : ''}${topic ?? 'something'}${n.signal.urgency ? ` and marked it ${n.signal.urgency.toLowerCase()}` : ''}.`
    : n.kind === 'news' ? `${n.signal.title}.`
    : n.kind === 'date' ? `${n.signal.title} ${n.raw.inDays === 0 ? 'is today' : n.raw.inDays === 1 ? 'is tomorrow' : `is in ${n.raw.inDays} days`}.`
    : `${n.signal.title}.`;
  const ctx = n.context.filter(c => !/not in your memory/.test(c)).slice(0, 2).map(c => c[0].toUpperCase() + c.slice(1));
  const why = n.assessment.filter(a => a !== 'low stakes');
  return [lead, ...ctx.map(c => c.replace(/\.?$/, '.')), why.length ? `This is ${list(why)}.` : '', n.recommendation, n.action ? `Shall I ${lower(n.action.label)}?` : ''].filter(Boolean).join(' ');
}
