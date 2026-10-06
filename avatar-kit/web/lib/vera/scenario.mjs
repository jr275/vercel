// Deterministic SEED SCENARIO. All names, companies and numbers are fictional test data.
// Fixed clock: Tuesday 2026-10-06 08:30 UTC.
import { createMemory } from './memory.mjs';
import { createMockCalendar, createMockEmail, createMockNews } from './providers.mjs';
import { DAY } from './util.mjs';

export const NOW = Date.UTC(2026, 9, 6, 8, 30);
const at = (dayOffset, h, m = 0) => Date.UTC(2026, 9, 6 + dayOffset, h, m);

export function seedMemory(clock = () => NOW) {
  const m = createMemory({ now: clock });
  m.addCompany({ name: 'Northwind Supply', kind: 'client' });
  m.addCompany({ name: 'Lumen Systems', kind: 'competitor' });
  const carlos = m.addPerson({ name: 'Carlos Mendes', email: 'carlos@northwind.example', company: 'Northwind Supply', role: 'Head of Commercial' });
  const marina = m.addPerson({ name: 'Marina Costa', email: 'marina@board.example', role: 'Board liaison', company: null });
  const joao = m.addPerson({ name: 'João Silva', aliases: ['Joao'], email: 'joao@personal.example' });
  const priya = m.addPerson({ name: 'Priya Nair', email: 'priya@partner.example', role: 'Partner lead' });
  const x = m.addProject({ name: 'Project X', people: [carlos.id], keywords: ['project x', 'enterprise'], summary: 'Enterprise rollout', companies: ['Northwind Supply'] });
  m.addDecision({ topic: 'Pricing decision', summary: 'enterprise tier structure still open', keywords: ['pricing'], project: x.id, people: [carlos.id] });
  m.addIssue({ text: 'Enterprise discount ceiling not agreed', person: carlos.id, project: x.id });
  m.addCommitment({ text: 'Send the Q3 numbers to Marina', toPerson: marina.id, dueAt: at(0, 17) });
  m.addDate({ person: joao.id, kind: 'birthday', month: 10, day: 7 });
  m.addRelationship(carlos.id, marina.id, 'introduced by');
  m.addPreference('Prefers one short briefing in the morning, not separate notifications');
  m.recordInteraction({ person: carlos.id, at: NOW - 18 * DAY, summary: 'pricing tier and discount ceiling left open' });
  m.recordInteraction({ person: marina.id, at: NOW - 6 * DAY, summary: 'board agenda' });
  m.recordInteraction({ person: joao.id, at: NOW - 30 * DAY, summary: 'dinner' });
  m.recordInteraction({ person: priya.id, at: NOW - 96 * DAY, summary: 'partnership intro' });
  return m;
}

export const CARLOS_EMAIL = {
  kind: 'email',
  id: 'msg_carlos_pricing',
  at: NOW,
  from: 'Carlos Mendes <carlos@northwind.example>',
  subject: 'Pricing decision is urgent',
  body: 'We need the pricing decision before the client call. This is urgent.',
};

export function seedProviders({ carlosEmail = true } = {}) {
  const calendar = createMockCalendar([
    { id: 'evt_investor', title: 'Investor update', start: at(0, 15), end: at(0, 16), attendees: ['Marina Costa'] },
    { id: 'evt_carlos', title: 'Project X sync', description: 'Review rollout plan', start: at(1, 10), end: at(1, 11), attendees: ['Carlos Mendes'] },
    { id: 'evt_clash_a', title: 'Hiring review', start: at(1, 14), end: at(1, 15), attendees: [] },
    { id: 'evt_clash_b', title: 'Vendor call', start: at(1, 14, 30), end: at(1, 15, 30), attendees: [] },
  ]);
  const email = createMockEmail([
    { id: 'msg_newsletter', at: NOW - 3600e3, from: 'Weekly Digest <digest@news.example>', subject: 'Your weekly digest', body: 'Ten links you might like.', read: false },
    ...(carlosEmail ? [{ ...CARLOS_EMAIL, at: NOW - 20 * 60e3, read: false }] : []),
    { id: 'msg_marina_old', at: NOW - 2 * DAY, from: 'Marina Costa <marina@board.example>', subject: 'Board agenda', body: 'Can you confirm the agenda?', read: true, threadId: 't_board' },
  ]);
  const news = createMockNews([
    { id: 'news_lumen', at: NOW - 2 * 3600e3, headline: 'Lumen Systems cuts enterprise list prices by 12%', summary: 'The competitor repositions its enterprise tier.' },
    { id: 'news_noise', at: NOW - 3 * 3600e3, headline: 'Local weather: sunny week ahead', summary: 'No impact.' },
  ]);
  return { calendar, email, news };
}
