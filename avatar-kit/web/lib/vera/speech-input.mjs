// SPEECH INPUT interface (STT). Events:
//   speechstart            the user began speaking (this is what barge-in listens to)
//   partial {text}         interim transcript
//   final {text}           final transcript for an utterance
//   end                    recognition stopped (no more audio)
//   error {code,message}   'permission_denied' | 'unsupported' | 'no_speech' | 'network' | 'error'
// Providers: BrowserSpeechInput (Web Speech API; needs a real browser + mic, NOT verified in CI),
//            FakeSpeechInput (deterministic, for tests and ?fakemic).
import { createEmitter } from './util.mjs';

export class FakeSpeechInput {
  constructor() {
    Object.assign(this, createEmitter(), { id: 'fake', listening: false, permission: 'granted' });
  }
  supported() {
    return true;
  }
  async start() {
    this.listening = true;
  }
  stop() {
    if (this.listening) this.emit('end');
    this.listening = false;
  }
  // test drivers
  say() {
    this.emit('speechstart');
  }
  partial(text) {
    this.emit('partial', { text });
  }
  final(text) {
    this.emit('final', { text });
  }
  silence() {
    this.emit('end');
  }
  fail(code) {
    this.emit('error', { code, message: code });
  }
}

export class BrowserSpeechInput {
  constructor({ lang = 'en-US', win = typeof window !== 'undefined' ? window : null } = {}) {
    Object.assign(this, createEmitter(), { id: 'browser', lang, win, rec: null, listening: false, permission: 'prompt' });
  }
  supported() {
    return !!(this.win && (this.win.SpeechRecognition || this.win.webkitSpeechRecognition));
  }
  async start() {
    if (!this.supported()) {
      this.emit('error', { code: 'unsupported', message: 'Speech recognition is not available in this browser. Type instead.' });
      return false;
    }
    if (this.listening) return true;
    const Rec = this.win.SpeechRecognition || this.win.webkitSpeechRecognition;
    const r = (this.rec = new Rec());
    r.lang = this.lang;
    r.continuous = true;
    r.interimResults = true;
    let started = false;
    const begin = () => {
      if (!started) {
        started = true;
        this.emit('speechstart');
      }
    };
    r.onspeechstart = begin;
    r.onresult = ev => {
      begin();
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const text = res[0].transcript.trim();
        if (res.isFinal) {
          started = false;
          this.emit('final', { text, confidence: res[0].confidence });
        } else this.emit('partial', { text });
      }
    };
    r.onerror = e => {
      const code = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'permission_denied' : e.error === 'no-speech' ? 'no_speech' : e.error === 'network' ? 'network' : 'error';
      if (code === 'permission_denied') this.permission = 'denied';
      this.emit('error', { code, message: e.message || e.error });
    };
    r.onend = () => {
      this.listening = false;
      this.emit('end');
    };
    try {
      r.start();
      this.listening = true;
      this.permission = 'granted';
      return true;
    } catch (e) {
      this.emit('error', { code: 'error', message: String(e?.message ?? e) });
      return false;
    }
  }
  stop() {
    try {
      this.rec?.stop();
    } catch {
      /* already stopped */
    }
  }
}
