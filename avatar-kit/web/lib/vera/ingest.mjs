// INGESTION (pull side): turn the state of the providers + memory into raw events.
// Push-side events (a new email arriving) go straight to pipeline.process().
import { DAY } from './util.mjs';

export async function gatherEvents({ memory, calendar, email, news, now, lookaheadDays = 2, silenceDays = 60 }) {
  const t = now();
  const out = [];
  for (const m of await email.list({ since: t - DAY, unreadOnly: true })) {
    out.push({ kind: 'email', id: m.id, source: 'email', at: m.at, from: m.from, subject: m.subject, body: m.body });
  }
  for (const e of await calendar.list({ from: t, to: t + lookaheadDays * DAY })) {
    out.push({ kind: 'calendar', id: e.id, source: 'calendar', at: e.start, title: e.title, description: e.description, attendees: e.attendees, start: e.start, end: e.end });
  }
  for (const n of await news.list({ since: t - DAY })) {
    out.push({ kind: 'news', id: n.id, source: 'news', at: n.at, headline: n.headline, summary: n.summary });
  }
  for (const d of memory.upcomingDates(t, lookaheadDays)) {
    out.push({ kind: 'date', id: `date:${d.id}:${d.inDays}`, source: 'memory', at: t, person: d.person, dateKind: d.kind, inDays: d.inDays });
  }
  for (const c of memory.openCommitments()) {
    if (c.dueAt && c.dueAt - t <= lookaheadDays * DAY) out.push({ kind: 'commitment', id: c.id, source: 'memory', at: c.dueAt, commitment: c });
  }
  for (const p of memory.people()) {
    const days = memory.daysSinceContact(p, t);
    if (days != null && days >= silenceDays) out.push({ kind: 'silence', id: `silence:${p.id}`, source: 'memory', at: t, person: p, days });
  }
  return out;
}
