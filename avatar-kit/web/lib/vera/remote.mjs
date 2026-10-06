// Brain adapter for the browser: same interface as the in-process brain, backed by /api/vera.
// The conversation runtime cannot tell the difference — which is the point of the layering.
import { abortError } from './util.mjs';

export function createRemoteBrain({ fetchImpl = (...a) => fetch(...a), url = '/api/vera' } = {}) {
  async function post(body, signal) {
    const res = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal });
    const j = await res.json().catch(() => ({ ok: false, error: 'bad_response' }));
    if (!res.ok || !j.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
    return j;
  }
  return {
    post,
    async respond(text, { signal } = {}) {
      if (signal?.aborted) throw abortError();
      return (await post({ action: 'say', text }, signal)).reply;
    },
    announce: n => ({ text: n.announcementText }),
    noteInterrupted(spoken) {
      void post({ action: 'interrupted', spoken }).catch(() => {});
    },
  };
}
/** Wrap a server announcement so conversation.alert() can queue it. */
export const remoteAlert = (announcement, id = `remote_${Date.now()}`) => ({ id, announcementText: announcement.text });
