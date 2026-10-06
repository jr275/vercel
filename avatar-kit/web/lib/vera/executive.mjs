// The proactive engine facade: ingest events, keep the alert queue, produce briefings.
import { createPipeline } from './pipeline.mjs';
import { gatherEvents } from './ingest.mjs';
import { synthesize } from './synthesis.mjs';
import { DAY } from './util.mjs';

export function createExecutive({ memory, calendar, email, news, now = () => Date.now() }) {
  const pipeline = createPipeline({ memory, calendar, now });
  const alerts = []; // surfaced + digested notifications, newest last
  const traces = [];
  const listeners = new Set();

  async function ingest(raw) {
    const r = await pipeline.process(raw);
    traces.push({ at: now(), eventId: raw.id, status: r.status, trace: r.trace });
    if (r.notification) {
      alerts.push(r.notification);
      listeners.forEach(f => f(r.notification));
    }
    return r;
  }

  let last = null;
  /**
   * COMPUTE a briefing from the current state. Read-only: it publishes nothing, enqueues no alerts, fires no
   * listeners and does not touch the pipeline's dedupe state, so it is idempotent and safe for a model to call.
   * (Publishing an alert is `ingest()`, which is only driven by events arriving.)
   */
  async function briefing() {
    const events = await gatherEvents({ memory, calendar, email, news, now });
    const runs = [];
    for (const e of events) runs.push(await pipeline.process(e, { dedupe: false }));
    const notifications = runs.map(r => r.notification).filter(Boolean);
    const next = (await calendar.list({ from: now(), to: now() + DAY }))[0] ?? null;
    return (last = { ...synthesize(notifications, { now: now(), firstMeeting: next }), traces: runs.map(r => ({ status: r.status, trace: r.trace })), notifications });
  }

  return {
    ingest,
    briefing,
    alerts,
    traces,
    lastBriefing: () => last,
    surfaced: () => alerts.filter(a => a.decision === 'SURFACE_NOW'),
    onAlert: f => (listeners.add(f), () => listeners.delete(f)),
    resetAlerts: () => (alerts.length = 0),
  };
}
