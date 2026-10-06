// Tool PROVIDERS: the replaceable boundary to the outside world. The brain depends ONLY on these contracts,
// never on a vendor SDK and never on a mock's internals. Nothing here talks to a network.
//
//   CalendarProvider  required: list({from,to}) -> CalendarEvent[]            optional: get(id)
//   EmailProvider     required: list({since,unreadOnly}) -> Email[]            optional: get(id), search(query),
//                                sent({since}) -> Email[]  (for "unanswered" detection), send(draft) -> {id}
//   NewsProvider      required: list({since}) -> NewsItem[]
//
// `capabilities` declares what a provider can do. A tool that needs a capability the provider lacks is simply
// not registered (a read-only mailbox has no `email_send`). OAuth/SDKs live behind these methods, in the provider.

const CONTRACT = {
  calendar: { required: ['list'], capabilities: ['list', 'get'] },
  email: { required: ['list'], capabilities: ['list', 'get', 'search', 'sent', 'send'] },
  news: { required: ['list'], capabilities: ['list'] },
};
export function assertProvider(kind, p) {
  const c = CONTRACT[kind];
  if (!c) throw new Error(`Unknown provider kind: ${kind}`);
  if (!p) throw new Error(`Missing ${kind} provider`);
  for (const m of c.required) if (typeof p[m] !== 'function') throw new Error(`${kind} provider must implement ${m}()`);
  const caps = p.capabilities ?? c.required;
  for (const cap of caps) {
    if (!c.capabilities.includes(cap)) throw new Error(`${kind} provider declares unknown capability "${cap}"`);
    if (typeof p[cap] !== 'function') throw new Error(`${kind} provider declares "${cap}" but does not implement it`);
  }
  return { ...p, capabilities: caps };
}

export function createMockCalendar(events = []) {
  const items = [...events];
  return {
    id: 'mock-calendar',
    simulated: true,
    capabilities: ['list', 'get'],
    async get(id) {
      return items.find(e => e.id === id) ?? null;
    },
    async list({ from = 0, to = Infinity } = {}) {
      return items.filter(e => e.end > from && e.start < to).sort((a, b) => a.start - b.start);
    },
    async create(e) {
      const r = { id: `evt_${items.length + 1}`, ...e };
      items.push(r);
      return r;
    },
    async cancel(id) {
      const i = items.findIndex(e => e.id === id);
      if (i < 0) throw new Error(`No such event: ${id}`);
      return items.splice(i, 1)[0];
    },
  };
}

export function createMockEmail(messages = []) {
  const inbox = [...messages];
  const outbox = [];
  return {
    id: 'mock-email',
    simulated: true,
    capabilities: ['list', 'get', 'search', 'sent', 'send'],
    outbox, // mock internals: tests may read it; the brain must not
    async get(id) {
      return inbox.find(m => m.id === id) ?? null;
    },
    async search(q) {
      const t = String(q).toLowerCase();
      return inbox.filter(m => (m.subject + ' ' + m.body + ' ' + m.from).toLowerCase().includes(t));
    },
    async sent({ since = 0 } = {}) {
      return outbox.filter(o => (o.sentAt ?? 0) >= since);
    },
    async list({ since = 0, unreadOnly = false } = {}) {
      return inbox.filter(m => m.at >= since && (!unreadOnly || !m.read)).sort((a, b) => b.at - a.at);
    },
    /** Record only. A real provider would transmit here — which is why the gate sits above it. */
    async send(draft) {
      const r = { id: `out_${outbox.length + 1}`, ...draft, sentAt: draft.sentAt ?? null };
      outbox.push(r);
      return r;
    },
    receive(m) {
      inbox.push(m);
      return m;
    },
  };
}

export function createMockNews(items = []) {
  return {
    id: 'mock-news',
    simulated: true,
    capabilities: ['list'],
    async list({ since = 0 } = {}) {
      return items.filter(n => n.at >= since).sort((a, b) => b.at - a.at);
    },
  };
}
