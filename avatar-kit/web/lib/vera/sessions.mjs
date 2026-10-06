// SESSION-SCOPED STATE. One session = one Vera (own Brain, Memory, ConfirmationGate, conversation history,
// provider instances). Nothing is shared between sessions: a confirmation, a memory or a pending offer from
// session A cannot be reached from session B. Not authentication: the session id is an unguessable capability
// held in an httpOnly cookie, enough to keep browsers apart. Replace with real identity before any deployment.
import { randomUUID } from 'node:crypto';

export function createSessionStore({ factory, ttlMs = 60 * 60 * 1000, max = 100, now = () => Date.now() }) {
  const sessions = new Map();
  const prune = () => {
    for (const [id, s] of sessions) if (now() - s.lastSeen > ttlMs) sessions.delete(id);
    while (sessions.size > max) sessions.delete(sessions.keys().next().value); // oldest first
  };
  return {
    /** Returns the session for a known id, or creates a NEW one. A client-chosen unknown id is never adopted. */
    resolve(id) {
      prune();
      const s = id && sessions.get(id);
      if (s) {
        s.lastSeen = now();
        sessions.delete(id);
        sessions.set(id, s); // most recently used last
        return { id, vera: s.vera, created: false };
      }
      const nid = randomUUID();
      sessions.set(nid, { vera: factory(), lastSeen: now() });
      prune();
      return { id: nid, vera: sessions.get(nid).vera, created: true };
    },
    /** Replace the state of THIS session only. */
    reset(id) {
      const s = sessions.get(id);
      if (s) s.vera = factory();
      return s?.vera ?? null;
    },
    size: () => sessions.size,
  };
}
