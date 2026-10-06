// NORMALIZATION: every source (email, calendar, news, date, commitment, silence) becomes one Signal shape,
// so the rest of the pipeline never knows where it came from.
import { norm, tokens } from './util.mjs';

export const TOPICS = {
  pricing: ['price', 'prices', 'pricing', 'discount', 'tier', 'tiers', 'list price', 'margin'],
  contract: ['contract', 'agreement', 'renewal', 'terms', 'sla'],
  budget: ['budget', 'forecast', 'spend', 'cost', 'costs'],
  hiring: ['hire', 'hiring', 'candidate', 'offer letter', 'headcount'],
  legal: ['legal', 'compliance', 'lawsuit', 'regulator', 'gdpr'],
  launch: ['launch', 'release', 'go-live', 'rollout'],
  investor: ['investor', 'board', 'funding', 'round', 'valuation'],
  supply: ['supplier', 'supply', 'shipment', 'logistics'],
};
const URGENT = [
  'urgent',
  'urgente',
  'asap',
  'immediately',
  'right away',
  'as soon as possible',
  'by end of day',
  'by eod',
  'deadline',
  'time-sensitive',
  'today',
  'critical',
];

export function detectTopics(text) {
  const t = ' ' + norm(text) + ' ';
  return Object.entries(TOPICS)
    .filter(([, words]) => words.some(w => t.includes(' ' + w + ' ') || t.includes(' ' + w + 's ') || t.includes(' ' + w + '.') || t.includes(' ' + w + ',')))
    .map(([k]) => k);
}
export function detectUrgency(text) {
  const t = norm(text);
  const hints = URGENT.filter(w => t.includes(w));
  return { level: hints.length ? Math.min(1, 0.6 + 0.2 * hints.length) : 0, hints };
}

const nameFrom = from => String(from).replace(/<.*?>/, '').replace(/["']/g, '').trim();
const emailOf = from => (String(from).match(/<(.+?)>/) ?? [])[1] ?? (String(from).includes('@') ? String(from).trim() : null);

/** @returns {import('./pipeline.mjs').Signal} */
export function normalize(raw, { memory }) {
  const base = { id: raw.id, kind: raw.kind, source: raw.source ?? raw.kind, at: raw.at, raw };
  switch (raw.kind) {
    case 'email': {
      const text = `${raw.subject}. ${raw.body ?? ''}`;
      const sender = memory.findPerson(emailOf(raw.from)) ?? memory.findPerson(nameFrom(raw.from));
      const people = [...new Map([sender, ...memory.peopleIn(text)].filter(Boolean).map(p => [p.id, p])).values()];
      return {
        ...base,
        title: raw.subject,
        text,
        sender: sender ? sender.name : nameFrom(raw.from),
        senderKnown: !!sender,
        people,
        unknownPeople: sender ? [] : [nameFrom(raw.from)],
        topics: detectTopics(text),
        urgency: detectUrgency(text),
        startsAt: null,
        dueAt: null,
      };
    }
    case 'calendar': {
      const text = `${raw.title}. ${raw.description ?? ''}`;
      const people = (raw.attendees ?? []).map(a => memory.findPerson(a)).filter(Boolean);
      return {
        ...base,
        title: raw.title,
        text,
        people,
        unknownPeople: (raw.attendees ?? []).filter(a => !memory.findPerson(a)),
        topics: detectTopics(text),
        urgency: detectUrgency(raw.title),
        startsAt: raw.start,
        dueAt: raw.start,
        agenda: !!raw.description,
      };
    }
    case 'news': {
      const text = `${raw.headline}. ${raw.summary ?? ''}`;
      const t = norm(text);
      return {
        ...base,
        title: raw.headline,
        text,
        people: memory.peopleIn(text),
        unknownPeople: [],
        companies: memory.companies().filter(c => t.includes(norm(c.name))),
        topics: detectTopics(text),
        urgency: detectUrgency(text),
        startsAt: null,
        dueAt: null,
      };
    }
    case 'date': {
      return {
        ...base,
        title: `${raw.person.name}'s ${raw.dateKind}`,
        text: `${raw.person.name} ${raw.dateKind}`,
        people: [raw.person],
        unknownPeople: [],
        topics: ['personal'],
        urgency: { level: 0, hints: [] },
        inDays: raw.inDays,
        startsAt: null,
        dueAt: raw.at,
      };
    }
    case 'commitment': {
      const c = raw.commitment;
      const people = [memory.findPerson(c.toPerson), memory.findPerson(c.owner)].filter(Boolean);
      return {
        ...base,
        title: c.text,
        text: c.text,
        people,
        unknownPeople: [],
        topics: detectTopics(c.text),
        urgency: detectUrgency(c.text),
        startsAt: null,
        dueAt: c.dueAt,
        commitment: c,
      };
    }
    case 'silence': {
      return {
        ...base,
        title: `No contact with ${raw.person.name}`,
        text: `No contact with ${raw.person.name} for ${raw.days} days`,
        people: [raw.person],
        unknownPeople: [],
        topics: [],
        urgency: { level: 0, hints: [] },
        days: raw.days,
        startsAt: null,
        dueAt: null,
      };
    }
    default:
      throw new Error(`Unsupported event kind: ${raw.kind}`);
  }
}
export { tokens };
