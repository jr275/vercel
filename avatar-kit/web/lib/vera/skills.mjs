// SKILLS: one Vera, many skills. A skill is a named capability that contributes tools and (optionally)
// proactive behaviour. `status` is honest: 'implemented' has code and tests behind it,
// 'declared' is on the map but has no implementation yet.
import { normalize, detectTopics } from './events.mjs';
import { daysBetween, hhmm, DAY, norm } from './util.mjs';

const whenTxt = (t, now) => {
  const d = daysBetween(now, t);
  return `${d === 0 ? 'today' : d === 1 ? 'tomorrow' : new Date(t).toISOString().slice(0, 10)} at ${hhmm(t)}`;
};
const str = { type: 'string' };

export function registerSkills({ registry, memory, calendar, email, news, executive, now = () => Date.now() }) {
  const personOf = q => memory.findPerson(q) ?? memory.peopleIn(String(q ?? ''))[0] ?? null;

  const openItemsFor = p => {
    const c = memory.contextFor({ person: p });
    return {
      decisions: c.decisions.map(d => d.topic + (d.summary ? ` — ${d.summary}` : '')),
      issues: c.issues.map(i => i.text),
      commitments: c.commitments.map(x => x.text),
      lastContactDays: c.daysSinceContact,
      lastSummary: c.lastInteraction?.summary ?? null,
      projects: c.projects.map(x => x.name),
    };
  };

  const T = [];
  const tool = (skill, def) => (T.push({ skill, name: def.name }), registry.register(def));

  // ---- Calendar ---------------------------------------------------------------------------------
  tool('calendar', {
    name: 'calendar_analysis',
    description: 'Read upcoming events; identify important meetings, conflicts, preparation needs and important dates.',
    input_schema: { type: 'object', properties: { days: { type: 'number' } } },
    async run({ days = 2 } = {}) {
      const t = now();
      const events = await calendar.list({ from: t, to: t + days * DAY });
      const enriched = events.map(e => {
        const sig = normalize({ kind: 'calendar', id: e.id, at: e.start, title: e.title, description: e.description, attendees: e.attendees, start: e.start }, { memory });
        const open = sig.people.flatMap(p => {
          const o = openItemsFor(p);
          return [...o.decisions, ...o.issues, ...o.commitments];
        });
        const important = open.length > 0 || /board|investor|client|review/i.test(e.title);
        return { id: e.id, title: e.title, start: e.start, end: e.end, when: whenTxt(e.start, t), attendees: sig.people.map(p => p.name), unknownAttendees: sig.unknownPeople, important, openItems: open, needsPrep: open.length > 0 || !e.description };
      });
      const conflicts = [];
      for (let i = 0; i < events.length; i++) for (let j = i + 1; j < events.length; j++) if (events[j].start < events[i].end && events[i].start < events[j].end) conflicts.push({ a: events[i].title, b: events[j].title, when: whenTxt(events[j].start, t) });
      return { count: events.length, events: enriched, important: enriched.filter(e => e.important), conflicts, prep: enriched.filter(e => e.needsPrep && e.important), dates: memory.upcomingDates(t, days).map(d => ({ person: d.person.name, kind: d.kind, inDays: d.inDays })) };
    },
  });

  // ---- Email ------------------------------------------------------------------------------------
  const firstSentence = b => String(b ?? '').split(/(?<=[.!?])\s/)[0];
  tool('email', {
    name: 'email_inbox',
    description: 'Read relevant messages: who they are from, urgency, a one-line summary, and how they connect to what you already know.',
    input_schema: { type: 'object', properties: { unreadOnly: { type: 'boolean' } } },
    async run({ unreadOnly = false } = {}) {
      const msgs = await email.list({ since: now() - 7 * DAY, unreadOnly });
      const rows = msgs.map(m => {
        const sig = normalize({ kind: 'email', id: m.id, at: m.at, from: m.from, subject: m.subject, body: m.body }, { memory });
        const ctx = sig.people.map(p => memory.contextFor({ person: p, topic: sig.topics.join(' ') }));
        const connected = ctx.flatMap(c => [...c.decisions.map(d => d.topic), ...c.issues.map(i => i.text)]);
        return { id: m.id, from: sig.sender, known: sig.senderKnown, subject: m.subject, summary: `${m.subject}. ${firstSentence(m.body)}`, urgent: sig.urgency.level >= 0.6, topics: sig.topics, connected, relevant: sig.senderKnown || connected.length > 0, read: !!m.read };
      });
      const sent = email.outbox ?? [];
      const unanswered = msgs.filter(m => /\?|please|can you|need/i.test(m.body ?? '') && !sent.some(o => norm(o.to ?? '') && norm(m.from).includes(norm(o.to)))).map(m => ({ id: m.id, from: m.from.replace(/<.*>/, '').trim(), subject: m.subject, ageDays: Math.floor((now() - m.at) / DAY) }));
      return { total: rows.length, relevant: rows.filter(r => r.relevant), ignored: rows.filter(r => !r.relevant).length, unanswered };
    },
  });
  tool('email', {
    name: 'email_send',
    description: 'Send an email. CONSEQUENTIAL: requires explicit user confirmation before it is sent.',
    consequential: true,
    input_schema: { type: 'object', properties: { to: str, subject: str, body: str }, required: ['to'] },
    describe: a => `Send an email to ${a.to}${a.subject ? ` — "${a.subject}"` : ''}`,
    async run(a) {
      const p = personOf(a.to);
      const r = await email.send({ to: p?.email ?? a.to, toName: p?.name ?? a.to, subject: a.subject ?? '(no subject)', body: a.body ?? '', sentAt: now() });
      if (p) memory.recordInteraction({ person: p.id, at: now(), kind: 'email', summary: `emailed: ${a.subject ?? 'message'}` });
      return { sent: true, id: r.id, to: p?.email ?? a.to, toName: p?.name ?? a.to };
    },
  });

  // ---- People / Personal context / Company ------------------------------------------------------
  tool('people', {
    name: 'person_context',
    description: 'Everything known about a person: role, company, projects, last contact, open decisions, issues and commitments.',
    input_schema: { type: 'object', properties: { name: str }, required: ['name'] },
    async run({ name }) {
      const p = personOf(name);
      if (!p) return { found: false, name };
      const c = memory.contextFor({ person: p });
      const o = openItemsFor(p);
      return { found: true, name: p.name, role: p.role, company: p.company, ...o, facts: c.facts.map(f => f.text), birthday: memory.dates().find(d => d.person === p.id) ?? null };
    },
  });
  tool('personal', {
    name: 'memory_recall',
    description: 'Search everything remembered (people, companies, projects, decisions, commitments, preferences, facts).',
    input_schema: { type: 'object', properties: { query: str }, required: ['query'] },
    async run({ query }) {
      return { query, matches: memory.recall(query) };
    },
  });
  tool('personal', {
    name: 'memory_learn',
    description: 'Store a fact or preference the user has just told you.',
    input_schema: { type: 'object', properties: { text: str }, required: ['text'] },
    async run({ text }) {
      return memory.learn(text.replace(/^\s*(please\s+)?(remember|note|keep in mind|make a note)(\s+that)?\s*/i, ''));
    },
  });
  tool('company', {
    name: 'company_info',
    description: 'What is known about a company: kind, people, projects.',
    input_schema: { type: 'object', properties: { name: str }, required: ['name'] },
    async run({ name }) {
      const c = memory.companies().find(x => norm(x.name).includes(norm(name)));
      if (!c) return { found: false, name };
      return { found: true, name: c.name, kind: c.kind, people: memory.people().filter(p => p.company === c.name).map(p => p.name), projects: memory.projects().filter(p => (p.companies ?? []).includes(c.name)).map(p => p.name) };
    },
  });

  // ---- Meeting prep / Follow-up / Reminder / Decision support / News -----------------------------
  tool('meeting_prep', {
    name: 'meeting_prep',
    description: 'Prepare a briefing for a meeting (by title) or for the next meeting with a person.',
    input_schema: { type: 'object', properties: { meeting: str, person: str, topic: str } },
    async run({ meeting, person, topic } = {}) {
      const t = now();
      const p = personOf(person);
      const evts = await calendar.list({ from: t, to: t + 14 * DAY });
      const ev = evts.find(e => meeting && norm(e.title).includes(norm(meeting))) ?? (p ? evts.find(e => (e.attendees ?? []).some(a => memory.findPerson(a)?.id === p.id)) : null) ?? evts[0] ?? null;
      const attendees = ev ? (ev.attendees ?? []).map(a => memory.findPerson(a)).filter(Boolean) : p ? [p] : [];
      const rows = attendees.map(a => ({ name: a.name, role: a.role, ...openItemsFor(a) }));
      const openItems = rows.flatMap(r => [...r.decisions.map(d => `Decide: ${d}`), ...r.issues.map(i => `Resolve: ${i}`), ...r.commitments.map(c => `Deliver: ${c}`)]);
      const wanted = topic ? detectTopics(topic) : [];
      const newsHits = wanted.length ? (await news.list({ since: t - 2 * DAY })).filter(n => detectTopics(n.headline + ' ' + n.summary).some(x => wanted.includes(x))) : [];
      return { meeting: ev ? { title: ev.title, when: whenTxt(ev.start, t), agenda: ev.description ?? null } : null, attendees: rows, openItems, missingAgenda: !!ev && !ev.description, related: newsHits.map(n => n.headline) };
    },
  });
  tool('follow_up', {
    name: 'followup_list',
    description: 'Open commitments, unresolved decisions and items waiting on someone.',
    input_schema: { type: 'object', properties: { person: str } },
    async run({ person } = {}) {
      const p = person ? personOf(person) : null;
      const c = p ? memory.contextFor({ person: p }) : null;
      return {
        person: p?.name ?? null,
        commitments: (c ? c.commitments : memory.openCommitments()).map(x => ({ text: x.text, dueAt: x.dueAt })),
        decisions: (c ? c.decisions : memory.unresolvedDecisions()).map(d => d.topic),
        issues: (c ? c.issues : memory.openIssues()).map(i => i.text),
      };
    },
  });
  tool('reminder', {
    name: 'reminder_add',
    description: 'Create a reminder (an open commitment owned by the user).',
    input_schema: { type: 'object', properties: { text: str, dueAt: { type: 'number' }, person: str }, required: ['text'] },
    async run({ text, dueAt = null, person }) {
      const p = personOf(person);
      return memory.addCommitment({ text, dueAt, toPerson: p?.id ?? null });
    },
  });
  tool('decision_support', {
    name: 'decision_support',
    description: 'Lay out an open decision: who is involved, what is unresolved, and what has changed (news).',
    input_schema: { type: 'object', properties: { topic: str }, required: ['topic'] },
    async run({ topic }) {
      const c = memory.contextFor({ topic });
      const t = now();
      const items = (await news.list({ since: t - 3 * DAY })).filter(n => normalize({ kind: 'news', id: n.id, at: n.at, headline: n.headline, summary: n.summary }, { memory }).topics.some(x => norm(topic).includes(x)));
      return { topic, decisions: c.decisions.map(d => ({ topic: d.topic, summary: d.summary, people: d.people.map(id => memory.findPerson(id)?.name).filter(Boolean) })), openIssues: c.issues.map(i => i.text), changes: items.map(n => n.headline), note: 'Options are not generated here; this lays out facts for the decision.' };
    },
  });
  tool('news', {
    name: 'news_feed',
    description: 'Recent news, filtered to what is connected to the user’s companies, competitors and decisions. (Feed is simulated in this build.)',
    input_schema: { type: 'object', properties: {} },
    async run() {
      const items = await news.list({ since: now() - 2 * DAY });
      return { items: items.map(n => normalize({ kind: 'news', id: n.id, at: n.at, headline: n.headline, summary: n.summary }, { memory })).map(s => ({ headline: s.title, companies: s.companies.map(c => c.name), topics: s.topics, relevant: s.companies.length > 0 || s.topics.length > 0 })) };
    },
  });
  tool('briefing', {
    name: 'morning_briefing',
    description: 'Gather every signal, run the proactive pipeline and return ONE synthesized briefing.',
    input_schema: { type: 'object', properties: {} },
    async run() {
      const b = await executive.briefing();
      return { text: b.text, items: b.items, also: b.also, offer: b.offer };
    },
  });

  const names = new Set(T.map(x => x.skill));
  const has = s => names.has(s);
  const skills = [
    ['calendar', 'Calendar', 'implemented', 'calendar_analysis'],
    ['email', 'Email', 'implemented', 'email_inbox, email_send (gated)'],
    ['people', 'People', 'implemented', 'person_context'],
    ['company', 'Company', 'implemented', 'company_info (memory only)'],
    ['news', 'News', 'implemented', 'news_feed (simulated feed)'],
    ['research', 'Research', 'declared', 'no web/search provider wired'],
    ['meeting_prep', 'Meeting Prep', 'implemented', 'meeting_prep'],
    ['follow_up', 'Follow-up', 'implemented', 'followup_list'],
    ['reminder', 'Reminder', 'implemented', 'reminder_add (stored; not scheduled to fire)'],
    ['decision_support', 'Decision Support', 'implemented', 'decision_support (facts, no option generation)'],
    ['personal', 'Personal Context', 'implemented', 'memory_recall, memory_learn'],
  ].map(([id, title, status, detail]) => ({ id, title, status: status === 'implemented' && !has(id) ? 'declared' : status, detail }));
  return { skills, tools: T };
}
