// Tool PROVIDERS: the replaceable boundary to the outside world. Each one is an interface with a
// deterministic in-memory implementation (data supplied by the caller). A Google/Microsoft provider
// would implement the same methods. NOTHING here talks to a network.
//
//   CalendarProvider: list({from,to}) -> CalendarEvent[]   create(event) cancel(id)
//   EmailProvider:    list({since,unreadOnly}) -> Email[]   send(draft) -> {id}
//   NewsProvider:     list({since}) -> NewsItem[]

export function createMockCalendar(events = []) {
  const items = [...events];
  return {
    id: 'mock-calendar',
    simulated: true,
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
    outbox,
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
    async list({ since = 0 } = {}) {
      return items.filter(n => n.at >= since).sort((a, b) => b.at - a.at);
    },
  };
}
