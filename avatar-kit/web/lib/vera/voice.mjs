// VOICE OUTPUT interface (TTS). The conversation layer talks only to this; the avatar is one adapter.
//   voice.speak(text, { signal }) -> Promise<{ completed, spoken, segments }>
//   voice.stop()                  -> string   the text that had actually been spoken when it stopped
// planSpeech() turns text into segments with pauses, emphasis and a pitch contour, so any provider
// (streaming vendor TTS, SSML, the synthetic engine) renders the same cadence.
import { abortError, createEmitter } from './util.mjs';

const PAUSE = { '.': 380, '?': 420, '!': 360, ';': 240, ':': 220, ',': 150, none: 0 };
const EMPH = /\b(urgent|important|unresolved|today|tomorrow|before|only|never|confirm)\b/gi;

export function planSpeech(text) {
  const sentences = String(text)
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<![0-9])(?<=[.!?])\s+/)
    .filter(Boolean);
  const out = [];
  sentences.forEach((s, si) => {
    // a numbered heading ("1.") stays attached to what follows
    const parts = s.split(/(?<=[,;:])\s+/).filter(Boolean);
    parts.forEach((p, pi) => {
      const last = pi === parts.length - 1;
      const end = p.slice(-1);
      const mark = PAUSE[end] != null ? end : 'none';
      out.push({
        text: p,
        pauseAfterMs: last ? PAUSE[mark] + (si < sentences.length - 1 && /^\d+\.$/.test(sentences[si + 1]?.split(' ')[0] ?? '') ? 120 : 0) : PAUSE[mark],
        emphasis: [...p.matchAll(EMPH)].map(m => m[0].toLowerCase()),
        pitch: end === '?' ? 'rise' : last && end === '.' ? 'fall' : 'level',
        rate: end === '?' ? 0.97 : 1,
      });
    });
  });
  return out;
}

/** Deterministic voice for tests: segments complete only when the test releases them (or immediately in auto mode). */
export class FakeVoice {
  constructor({ auto = false } = {}) {
    Object.assign(this, createEmitter(), { id: 'fake', auto, speaking: false, log: [], _spoken: [], _waiters: [] });
  }
  /** Let the next segment finish. */
  release(n = 1) {
    for (let i = 0; i < n; i++) this._waiters.shift()?.();
  }
  releaseAll() {
    while (this._waiters.length) this._waiters.shift()();
  }
  async speak(text, { signal } = {}) {
    const segments = planSpeech(text);
    this.speaking = true;
    this._spoken = [];
    this._stopped = false;
    this.log.push({ type: 'speak', text, segments });
    this.emit('start', { text });
    const onAbort = () => this.stop();
    signal?.addEventListener('abort', onAbort);
    try {
      for (const seg of segments) {
        if (this._stopped) break;
        await new Promise(res => {
          if (this.auto) return res();
          this._waiters.push(res);
          this._wake = res;
        });
        if (this._stopped) break;
        this._spoken.push(seg.text);
      }
      const completed = !this._stopped;
      return { completed, spoken: this._spoken.join(' '), segments: segments.length };
    } finally {
      signal?.removeEventListener('abort', onAbort);
      this.speaking = false;
      this.emit('end', { completed: !this._stopped });
    }
  }
  stop() {
    this._stopped = true;
    this.log.push({ type: 'stop' });
    this.releaseAll();
    return this._spoken.join(' ');
  }
}

/**
 * Adapter: voice -> avatar runtime. The runtime (and its speech provider: synthetic, browser, or a
 * production TTS) renders one segment at a time; pauses between segments are produced here.
 */
export class RuntimeVoice {
  constructor(getRuntime, { wait = (ms, signal) => new Promise((res, rej) => { const t = setTimeout(res, ms); signal?.addEventListener('abort', () => { clearTimeout(t); rej(abortError()); }); }) } = {}) {
    Object.assign(this, createEmitter(), { id: 'avatar-runtime', getRuntime, wait, speaking: false, _spoken: [], _stopped: false, _ctl: null });
  }
  async speak(text, { signal } = {}) {
    const rt = this.getRuntime();
    if (!rt) throw new Error('Avatar runtime not ready');
    const segments = planSpeech(text);
    this._stopped = false;
    this._spoken = [];
    this.speaking = true;
    this._ctl = new AbortController();
    const onAbort = () => this.stop();
    signal?.addEventListener('abort', onAbort);
    try {
      for (const seg of segments) {
        if (this._stopped) break;
        const r = await rt.speak(seg.text);
        if (this._stopped) break;
        if (r && r.ok === false) {
          if (r.reason === 'interrupted') break;
          throw new Error(r.reason ?? 'speech failed');
        }
        this._spoken.push(seg.text);
        if (seg.pauseAfterMs) {
          try {
            await this.wait(seg.pauseAfterMs, this._ctl.signal);
          } catch {
            break;
          }
        }
      }
      return { completed: !this._stopped, spoken: this._spoken.join(' '), segments: segments.length };
    } finally {
      signal?.removeEventListener('abort', onAbort);
      this.speaking = false;
    }
  }
  stop() {
    this._stopped = true;
    this._ctl?.abort();
    try {
      this.getRuntime()?.stopSpeaking?.();
    } catch {
      /* runtime gone */
    }
    return this._spoken.join(' ');
  }
}

/** A voice with no sound: renders the speech plan as timed text. Used by the review console and anywhere audio is not wanted. */
export class TextVoice {
  constructor({ msPerSegment = 140 } = {}) {
    Object.assign(this, createEmitter(), { id: 'text', msPerSegment, speaking: false, _spoken: [], _stopped: false });
  }
  async speak(text, { signal } = {}) {
    const segments = planSpeech(text);
    this._stopped = false;
    this._spoken = [];
    this.speaking = true;
    try {
      for (const seg of segments) {
        if (this._stopped) break;
        await new Promise(res => {
          this._wake = res;
          setTimeout(res, this.msPerSegment);
        });
        if (this._stopped || signal?.aborted) break;
        this._spoken.push(seg.text);
        this.emit('segment', seg);
      }
      return { completed: !this._stopped && !signal?.aborted, spoken: this._spoken.join(' '), segments: segments.length };
    } finally {
      this.speaking = false;
    }
  }
  stop() {
    this._stopped = true;
    this._wake?.();
    return this._spoken.join(' ');
  }
}
