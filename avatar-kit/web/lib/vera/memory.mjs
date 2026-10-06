// Executive memory: the smallest real store of what an executive assistant must remember.
// People, companies, projects, preferences, decisions, commitments, important dates, relationships,
// pending issues, free facts and an interaction log. In-memory with JSON (de)serialisation; the
// store interface is the replaceable part (swap for a database without touching callers).
import { norm, tokens, daysBetween, DAY } from './util.mjs';

export function createMemory({ now = () => Date.now() } = {}) {
  const s = {
    people: [],
    companies: [],
    projects: [],
    preferences: [],
    decisions: [],
    commitments: [],
    dates: [],
    relationships: [],
    issues: [],
    facts: [],
    interactions: [],
  };
  let seq = 0;
  const id = p => `${p}_${++seq}`;
  const byName = (coll, name) => s[coll].find(x => norm(x.name) === norm(name));

  const api = {
    // ---- writes -------------------------------------------------------------------------------
    addPerson(p) {
      const ex = byName('people', p.name);
      if (ex) return Object.assign(ex, p, { id: ex.id });
      const r = { id: id('per'), aliases: [], company: null, role: null, notes: [], ...p };
      s.people.push(r);
      return r;
    },
    addCompany(c) {
      const ex = byName('companies', c.name);
      if (ex) return Object.assign(ex, c, { id: ex.id });
      const r = { id: id('co'), kind: 'other', ...c };
      s.companies.push(r);
      return r;
    },
    addProject(p) {
      const ex = byName('projects', p.name);
      if (ex) return Object.assign(ex, p, { id: ex.id });
      const r = { id: id('prj'), status: 'active', people: [], keywords: [], companies: [], ...p };
      s.projects.push(r);
      return r;
    },
    addPreference(text, extra = {}) {
      const r = { id: id('pref'), text, at: now(), ...extra };
      s.preferences.push(r);
      return r;
    },
    addDecision(d) {
      const r = { id: id('dec'), status: 'unresolved', people: [], project: null, keywords: [], at: now(), ...d };
      s.decisions.push(r);
      return r;
    },
    resolveDecision(idOrTopic, summary) {
      const d = s.decisions.find(x => x.id === idOrTopic || norm(x.topic) === norm(idOrTopic));
      if (d) Object.assign(d, { status: 'decided', summary: summary ?? d.summary, decidedAt: now() });
      return d;
    },
    addCommitment(c) {
      const r = { id: id('cmt'), owner: 'me', toPerson: null, dueAt: null, status: 'open', at: now(), ...c };
      s.commitments.push(r);
      return r;
    },
    completeCommitment(idOrText) {
      const c = s.commitments.find(x => x.id === idOrText || norm(x.text).includes(norm(idOrText)));
      if (c) Object.assign(c, { status: 'done', doneAt: now() });
      return c;
    },
    addDate(d) {
      const r = { id: id('date'), kind: 'birthday', ...d };
      s.dates.push(r);
      return r;
    },
    addRelationship(a, b, kind) {
      const r = { id: id('rel'), a, b, kind };
      s.relationships.push(r);
      return r;
    },
    addIssue(i) {
      const r = { id: id('iss'), person: null, project: null, status: 'open', at: now(), ...i };
      s.issues.push(r);
      return r;
    },
    recordInteraction(i) {
      const r = { id: id('int'), kind: 'conversation', summary: '', ...i };
      s.interactions.push(r);
      const p = api.findPerson(i.person);
      if (p && (!p.lastContact || i.at > p.lastContact)) p.lastContact = i.at;
      return r;
    },
    /** Learn a free-form fact from the user. Links it to known people and files preferences. */
    learn(text, { source = 'user' } = {}) {
      const people = api.peopleIn(text);
      const isPref = /\b(prefer|prefers|likes|dislikes|always|never|hates|loves)\b/i.test(text);
      const rec = { id: id('fact'), text: text.trim(), people: people.map(p => p.id), source, at: now() };
      s.facts.push(rec);
      if (isPref) api.addPreference(text.trim(), { people: rec.people });
      return { ...rec, kind: isPref ? 'preference' : 'fact' };
    },

    // ---- lookups ------------------------------------------------------------------------------
    findPerson(q) {
      if (!q) return null;
      const byId = s.people.find(p => p.id === q);
      if (byId) return byId;
      const n = norm(q);
      const exact = s.people.find(p => norm(p.name) === n || p.aliases.some(a => norm(a) === n));
      if (exact) return exact;
      const email = s.people.find(p => p.email && norm(p.email) === n);
      if (email) return email;
      const first = s.people.filter(p => norm(p.name).split(' ')[0] === n);
      return first.length === 1 ? first[0] : null;
    },
    /** People named anywhere in free text (first name, full name, alias). */
    peopleIn(text) {
      const t = ' ' + norm(text).replace(/[^a-z0-9@. ]+/g, ' ') + ' ';
      return s.people.filter(p => {
        const names = [p.name, norm(p.name).split(' ')[0], ...p.aliases, p.email].filter(Boolean).map(norm);
        return names.some(n => t.includes(' ' + n + ' '));
      });
    },
    findProject: q => byName('projects', q) ?? null,
    projectsOf: personId => s.projects.filter(p => p.people.includes(personId)),
    projectsIn(text) {
      const t = norm(text);
      return s.projects.filter(p => t.includes(norm(p.name)) || p.keywords.some(k => t.includes(norm(k))));
    },
    daysSinceContact(person, at = now()) {
      const p = typeof person === 'string' ? api.findPerson(person) : person;
      return p?.lastContact ? Math.floor((at - p.lastContact) / DAY) : null;
    },
    unresolvedDecisions: () => s.decisions.filter(d => d.status === 'unresolved'),
    openCommitments: () => s.commitments.filter(c => c.status === 'open'),
    openIssues: () => s.issues.filter(i => i.status === 'open'),
    companies: () => s.companies,
    people: () => s.people,
    projects: () => s.projects,
    dates: () => s.dates,
    facts: () => s.facts,
    preferences: () => s.preferences,
    interactions: () => s.interactions,

    /** Important dates (birthdays) falling within `days` days from `at`, each with `inDays`. */
    upcomingDates(at = now(), days = 7) {
      const out = [];
      for (const d of s.dates) {
        const y = new Date(at).getUTCFullYear();
        for (const yy of [y, y + 1]) {
          const t = Date.UTC(yy, d.month - 1, d.day);
          const inDays = daysBetween(at, t);
          if (inDays >= 0 && inDays <= days) {
            out.push({ ...d, inDays, person: api.findPerson(d.person) ?? { name: d.person } });
            break;
          }
        }
      }
      return out.sort((a, b) => a.inDays - b.inDays);
    },

    /** Free recall by token overlap across every collection. Returns best matches first. */
    recall(query, { limit = 6 } = {}) {
      const q = new Set(tokens(query));
      if (!q.size) return [];
      const rows = [];
      const push = (kind, ref, text) => {
        const tk = tokens(text);
        const hit = tk.filter(t => q.has(t));
        if (hit.length) rows.push({ kind, ref: ref.id, text, score: +(new Set(hit).size / q.size).toFixed(2) });
      };
      s.people.forEach(p => push('person', p, `${p.name} ${p.role ?? ''} ${p.company ?? ''} ${p.notes.join(' ')}`));
      s.companies.forEach(c => push('company', c, `${c.name} ${c.kind} ${c.notes ?? ''}`));
      s.projects.forEach(p => push('project', p, `${p.name} ${p.keywords.join(' ')} ${p.summary ?? ''}`));
      s.decisions.forEach(d => push('decision', d, `${d.topic} ${d.summary ?? ''} ${d.status}`));
      s.commitments.forEach(c => push('commitment', c, `${c.text} ${c.status}`));
      s.issues.forEach(i => push('issue', i, i.text));
      s.preferences.forEach(p => push('preference', p, p.text));
      s.facts.forEach(f => push('fact', f, f.text));
      s.interactions.forEach(i => push('interaction', i, i.summary));
      return rows.sort((a, b) => b.score - a.score).slice(0, limit);
    },

    /** Everything connected to a person (and/or topic) — what the executive needs in hand. */
    contextFor({ person, topic } = {}) {
      const p = typeof person === 'object' ? person : api.findPerson(person);
      const tk = new Set(tokens(topic ?? ''));
      const projects = p ? api.projectsOf(p.id) : [];
      const pids = new Set(projects.map(x => x.id));
      const topical = (...txt) => tk.size && tokens(txt.join(' ')).some(t => tk.has(t));
      const decisions = s.decisions.filter(
        d => d.status === 'unresolved' && ((p && d.people.includes(p.id)) || pids.has(d.project) || topical(d.topic, ...d.keywords))
      );
      const commitments = s.commitments.filter(
        c => c.status === 'open' && ((p && (c.toPerson === p.id || c.owner === p.id)) || topical(c.text))
      );
      const issues = s.issues.filter(i => i.status === 'open' && ((p && i.person === p.id) || pids.has(i.project) || topical(i.text)));
      const interactions = p ? s.interactions.filter(i => api.findPerson(i.person)?.id === p.id).sort((a, b) => b.at - a.at) : [];
      const relationships = p ? s.relationships.filter(r => r.a === p.id || r.b === p.id) : [];
      const facts = p ? s.facts.filter(f => f.people.includes(p.id)) : [];
      return {
        person: p ?? null,
        company: p?.company ? byName('companies', p.company) ?? { name: p.company } : null,
        projects,
        decisions,
        commitments,
        issues,
        lastInteraction: interactions[0] ?? null,
        daysSinceContact: p ? api.daysSinceContact(p) : null,
        relationships,
        facts,
      };
    },

    toJSON: () => JSON.parse(JSON.stringify({ seq, ...s })),
    fromJSON(j) {
      for (const k of Object.keys(s)) s[k] = j[k] ?? [];
      seq = j.seq ?? seq;
      return api;
    },
  };
  return api;
}
