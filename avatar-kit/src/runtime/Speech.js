/*
 * Speech providers.
 *
 *   Text -> SpeechProvider -> SpeechResult -> playback -> LipSyncController -> Avatar
 *
 * interface SpeechProvider {
 *   name: string
 *   available(): boolean
 *   speak(text, hooks?): Promise<SpeechResult>     hooks: { onStart(result) } (providers that play the sound themselves call it when sound starts)
 *   stop(): void
 * }
 * SpeechResult { text, provider, playback: 'engine' | 'provider', audio?: Float32Array (mono PCM), sampleRate?, phonemes: [{ ph, t, d }], duration }
 *   playback 'engine'   the avatar plays `audio` and runs the lips from `phonemes` (or from the audio level when there are none)
 *   playback 'provider' the provider plays the sound itself (onStart tells the avatar when) and the lips run from `phonemes`
 * A cloud TTS plugs in here: return its audio and its viseme/phoneme events. Nothing else in the application changes.
 *
 * Providers in the kit: SyntheticSpeechProvider (offline formant voice, robotic, always available) and BrowserSpeechProvider
 * (the browser's speechSynthesis voices; the sound cannot be captured, so lips follow an estimated timeline).
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit;

  function SyntheticSpeechProvider(opts) { this.name = 'synthetic'; this.opts = opts || {}; this._n = 0; }
  SyntheticSpeechProvider.prototype.available = function () { return true; };
  SyntheticSpeechProvider.prototype.speak = function (text) {
    var o = this.opts, tl = WA.Phonemizer.toEvents(text, { rate: o.rate || 1 });
    if (!tl.syllables) return Promise.reject(WA.AvatarError('EMPTY_TEXT', 'There is nothing to say'));
    var a = WA.SynthVoice.render(tl.events, { pitch: o.pitch, sampleRate: o.sampleRate });
    return Promise.resolve({ text: text, provider: this.name, playback: 'engine', audio: a.pcm, sampleRate: a.sampleRate, phonemes: tl.events, duration: a.duration });
  };
  SyntheticSpeechProvider.prototype.stop = function () {};

  function BrowserSpeechProvider(opts) { this.name = 'browser'; this.opts = opts || {}; this._u = null; }
  BrowserSpeechProvider.prototype.available = function () {
    try { return !!(root.speechSynthesis && root.SpeechSynthesisUtterance && root.speechSynthesis.getVoices().length > 0); } catch (e) { return false; }
  };
  BrowserSpeechProvider.prototype.speak = function (text, hooks) {
    var self = this, o = this.opts;
    if (!this.available()) return Promise.reject(WA.AvatarError('TTS_UNAVAILABLE', 'The browser has no speech voices'));
    var rate = o.rate || 0.95, tl = WA.Phonemizer.toEvents(text, { rate: rate });
    return new Promise(function (resolve, reject) {
      var u = new root.SpeechSynthesisUtterance(text), voices = root.speechSynthesis.getVoices(), started = false, timer;
      var pick = o.voice ? voices.filter(function (v) { return v.name === o.voice; })[0] : voices.filter(function (v) { return /^en/i.test(v.lang); })[0];
      if (pick) u.voice = pick; u.rate = rate; u.pitch = o.pitch || 0.95; u.lang = (pick && pick.lang) || 'en-US';
      var result = { text: text, provider: self.name, playback: 'provider', phonemes: tl.events, duration: tl.duration };
      u.onstart = function () { started = true; clearTimeout(timer); if (hooks && hooks.onStart) hooks.onStart(result); };
      u.onend = function () { clearTimeout(timer); self._u = null; resolve(result); };
      u.onerror = function (e) { clearTimeout(timer); self._u = null; if (e && (e.error === 'canceled' || e.error === 'interrupted')) resolve(result); else reject(WA.AvatarError('TTS_FAILED', 'Browser speech failed: ' + (e && e.error))); };
      timer = setTimeout(function () { if (!started) { try { root.speechSynthesis.cancel(); } catch (e) {} reject(WA.AvatarError('TTS_NO_START', 'Browser speech did not start')); } }, o.startTimeout || 2500);
      self._u = u; root.speechSynthesis.cancel(); root.speechSynthesis.speak(u);
    });
  };
  BrowserSpeechProvider.prototype.stop = function () { try { if (root.speechSynthesis) root.speechSynthesis.cancel(); } catch (e) {} this._u = null; };

  /* 'auto' (browser voices when the browser has them, otherwise synthetic) | 'browser' | 'synthetic' | a provider object */
  function createSpeechProvider(which, opts) {
    if (which && typeof which === 'object' && typeof which.speak === 'function') return which;
    if (which === 'synthetic') return new SyntheticSpeechProvider(opts);
    var b = new BrowserSpeechProvider(opts);
    if (which === 'browser') return b;
    return b.available() ? b : new SyntheticSpeechProvider(opts);
  }

  WA.SyntheticSpeechProvider = SyntheticSpeechProvider; WA.BrowserSpeechProvider = BrowserSpeechProvider; WA.createSpeechProvider = createSpeechProvider;
})(typeof window !== 'undefined' ? window : globalThis);
