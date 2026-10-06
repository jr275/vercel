// Small shared helpers. Pure, no I/O.
export const norm = s =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

const STOP = new Set(
  'the and for with that this have has had you your are was were from about what when where which will would can could should not but any all our they them their there then than into over under just also been being its his her she him who whom how why did does done get got let may might must shall too very out off per via'.split(
    ' '
  )
);
export const tokens = s =>
  norm(s)
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 2 && !STOP.has(t));

export const DAY = 86400000;
export const iso = t => new Date(t).toISOString();
export const dayStart = t => {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};
/** Whole calendar days from `a` to `b` (UTC). Tomorrow = 1. */
export const daysBetween = (a, b) => Math.round((dayStart(b) - dayStart(a)) / DAY);
export const hhmm = t => new Date(t).toISOString().slice(11, 16);
export const sleep = (ms, signal) =>
  new Promise((res, rej) => {
    const t = setTimeout(res, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      rej(abortError());
    });
  });
export function abortError() {
  const e = new Error('Aborted');
  e.name = 'AbortError';
  return e;
}
export const throwIfAborted = signal => {
  if (signal?.aborted) throw abortError();
};
export const isAbort = e => e && e.name === 'AbortError';
export const list = a => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
export function createEmitter() {
  const m = new Map();
  return {
    on(ev, f) {
      m.set(ev, [...(m.get(ev) ?? []), f]);
      return () => m.set(ev, (m.get(ev) ?? []).filter(x => x !== f));
    },
    emit(ev, d) {
      for (const f of m.get(ev) ?? []) {
        try {
          f(d);
        } catch (e) {
          if (typeof console !== 'undefined') console.error('[vera]', ev, e);
        }
      }
    },
  };
}
