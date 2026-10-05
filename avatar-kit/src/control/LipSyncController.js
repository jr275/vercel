/*
 * LipSyncController: audio and/or phonetic data in, viseme weights out.
 *
 *   TTS -> audio (+ optional visemes/phonemes/characters) -> [ this ] -> 15 viseme weights -> model
 *
 * Source priority per frame:
 *   1. manual viseme (setViseme)            -- explicit override
 *   2. timeline (VisemeEngine)              -- when speak() received phonetic data; follows the audio clock
 *   3. external level (setLevel)            -- caller measures the audio itself
 *   4. amplitude (AmplitudeFallback)        -- audio only, no phonetic data
 *   5. synthetic                            -- demo mouth movement without audio
 * Whichever is active, the output has the same shape, so the model does not care.
 * speak() resolves when playback ends (or stop() is called); pause()/resume() freeze and continue both audio and timeline.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, clamp = WA.clamp, V = WA.Channels.VISEMES;

  // legacy names from v1 -> Oculus
  var LEGACY = { rest: 'viseme_sil', aa: 'viseme_aa', ee: 'viseme_E', ih: 'viseme_I', oh: 'viseme_O', oo: 'viseme_U', mm: 'viseme_PP', ff: 'viseme_FF', th: 'viseme_TH', ss: 'viseme_SS' };
  // how open the jaw is for each viseme, to derive a single "mouth level" for models without morphs
  var OPEN = { viseme_sil: 0, viseme_PP: 0, viseme_FF: 0.12, viseme_TH: 0.2, viseme_DD: 0.25, viseme_kk: 0.3, viseme_CH: 0.2, viseme_SS: 0.12,
    viseme_nn: 0.18, viseme_RR: 0.25, viseme_aa: 1, viseme_E: 0.45, viseme_I: 0.3, viseme_O: 0.6, viseme_U: 0.25 };

  function LipSyncController(opts) {
    WA.Emitter.call(this);
    this.o = WA.assign({ engine: null }, opts || {});
    this.ctx = null; this.analyser = null; this.time = null; this.freq = null;
    this.source = null; this.playing = false; this.paused = false; this.synthetic = false; this.ext = null;
    this.engine = new WA.VisemeEngine(this.o.engine); this.amp = new WA.AmplitudeFallback();
    this.manual = null; this._clock = 0; this._startedAt = 0; this._audioClock = null; this._done = null;
    this.visemes = {}; this.tmp = {}; V.forEach(function (v) { this.visemes[v] = 0; this.tmp[v] = 0; }, this);
    this.level = 0; this.wide = 0; this.sourceKind = 'none'; this.silence = 99;
    this.speaking = false;
  }
  LipSyncController.prototype = Object.create(WA.Emitter.prototype);
  LipSyncController.prototype.constructor = LipSyncController;

  LipSyncController.prototype._ensure = function () {
    if (!this.ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) throw WA.AvatarError('NO_WEBAUDIO', 'Web Audio is not available in this browser');
      this.ctx = new AC();
      this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 1024; this.analyser.smoothingTimeConstant = 0.35;
      this.time = new Float32Array(this.analyser.fftSize); this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    }
    if (this.ctx.state === 'suspended' && !this.paused) this.ctx.resume();
    return this.ctx;
  };

  LipSyncController.prototype.stop = function () {
    try { if (this.source && this.source.stop) this.source.stop(); } catch (e) {}
    try { if (this.source && this.source.pause) this.source.pause(); } catch (e) {}
    try { if (this.source && this.source.disconnect) this.source.disconnect(); } catch (e) {}
    this.source = null; this.playing = false; this.paused = false; this._audioClock = null;
    this.engine.clear(); this.amp.reset(); this._clock = 0;
    if (this.ctx && this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (e) {} }
    if (this._done) { var d = this._done; this._done = null; d(); }
  };

  LipSyncController.prototype.pause = function () {
    if (!this.playing || this.paused) return false;
    this.paused = true;
    try { if (this.source && this.source.pauseSource) this.source.pauseSource(); else if (this.ctx) this.ctx.suspend(); } catch (e) {}
    this.emit('pause'); return true;
  };
  LipSyncController.prototype.resume = function () {
    if (!this.playing || !this.paused) return false;
    this.paused = false;
    try { if (this.source && this.source.resumeSource) this.source.resumeSource(); else if (this.ctx) this.ctx.resume(); } catch (e) {}
    this.emit('resume'); return true;
  };

  /* Phonetic data in any supported shape -> loads the timeline. Safe with bad input (ignored with a warning event). */
  LipSyncController.prototype._loadPhonetics = function (opts) {
    var data = opts.visemes || opts.phonemes || opts.characters || opts.alignment || opts.marks;
    if (!data) { this.engine.clear(); return false; }
    try {
      var o = { provider: opts.provider || (opts.phonemes ? 'phonemes' : undefined), map: opts.map, unit: opts.unit };
      var tl = WA.VisemeTimeline.auto(data, o);
      if (opts.offset) tl = new WA.VisemeTimeline(tl.events.map(function (e) { return { t: e.t + opts.offset, d: e.d, v: e.v, w: e.w }; }));
      this.engine.load(tl); return tl.events.length > 0;
    } catch (e) { this.engine.clear(); this.emit('warning', WA.AvatarError('BAD_VISEME_DATA', 'Phonetic data ignored: ' + e.message, e)); return false; }
  };

  /*
   * Accepts: AudioBuffer, Float32Array PCM (opts.sampleRate), ArrayBuffer, Blob/File, HTMLAudioElement, MediaStream, URL string.
   * opts.visemes | phonemes | characters | alignment | marks, opts.provider ('azure'|'polly'|'phonemes'|...), opts.offset (s).
   * Without audio (src == null) and with phonetic data it runs the timeline on its own clock: used by tests and silent previews.
   */
  LipSyncController.prototype.speak = function (src, opts) {
    var self = this; opts = opts || {};
    this.stop();
    var hasPhon = this._loadPhonetics(opts);
    if (src == null) {
      if (!hasPhon) return Promise.reject(WA.AvatarError('NO_SOURCE', 'speak() needs audio or phonetic data'));
      return new Promise(function (resolve) {
        self.playing = true; self._clock = 0; self._done = function () { resolve(); };
        self.source = null; self._timed = self.engine.duration() + 0.25;
      });
    }
    var ctx;
    try { ctx = this._ensure(); } catch (e) { return Promise.reject(e); }
    return new Promise(function (resolve, reject) {
      function finish() { self.playing = false; self.paused = false; self.source = null; self._audioClock = null; self._done = null; resolve(); }
      function startBuffer(buf) {
        var node = ctx.createBufferSource(); node.buffer = buf;
        node.connect(self.analyser); self.analyser.connect(ctx.destination);
        node.onended = finish; self.source = node; self._done = finish; self.playing = true;
        var t0 = ctx.currentTime; self._audioClock = function () { return ctx.currentTime - t0; };
        node.start();
      }
      try {
        if (src && src.numberOfChannels && src.getChannelData) return startBuffer(src);
        if (typeof Float32Array !== 'undefined' && src instanceof Float32Array) {
          var pcm = ctx.createBuffer(1, src.length, opts.sampleRate || 22050); pcm.copyToChannel(src, 0); return startBuffer(pcm);
        }
        if (typeof root.MediaStream !== 'undefined' && src instanceof root.MediaStream) {
          var ms = ctx.createMediaStreamSource(src); ms.connect(self.analyser);
          self.source = ms; self.playing = true; self._done = finish; return;
        }
        if (typeof root.HTMLMediaElement !== 'undefined' && src instanceof root.HTMLMediaElement) {
          var el = src, node = el.__wa_node || (el.__wa_node = ctx.createMediaElementSource(el));
          node.connect(self.analyser); self.analyser.connect(ctx.destination);
          el.onended = finish;
          self.source = { pause: function () { el.pause(); }, pauseSource: function () { el.pause(); }, resumeSource: function () { el.play(); },
            disconnect: function () { try { node.disconnect(); } catch (e) {} } };
          self._audioClock = function () { return el.currentTime; };
          self._done = finish; self.playing = true; el.play().catch(function (e) { self.stop(); reject(WA.AvatarError('PLAY_BLOCKED', 'Audio could not start (needs a user gesture?)', e)); }); return;
        }
        if (typeof src === 'string') {
          var a = new root.Audio(); a.crossOrigin = 'anonymous'; a.src = src; return self.speak(a, opts).then(resolve, reject);
        }
        var readBuf = src instanceof ArrayBuffer ? Promise.resolve(src) : (src && src.arrayBuffer ? src.arrayBuffer() : Promise.reject(WA.AvatarError('BAD_AUDIO', 'Unsupported audio source')));
        readBuf.then(function (ab) { return new Promise(function (ok, no) { ctx.decodeAudioData(ab, ok, no); }); })
          .then(startBuffer).catch(function (e) { reject(e && e.code ? e : WA.AvatarError('DECODE_FAILED', 'Audio could not be decoded', e)); });
      } catch (e) { reject(e); }
    });
  };

  LipSyncController.prototype.setSyntheticSpeaking = function (on) { this.synthetic = !!on; };
  LipSyncController.prototype.setLevel = function (v) { this.ext = v == null ? null : clamp(+v || 0, 0, 1); };
  LipSyncController.prototype.setViseme = function (name, weight) {
    var n = name && (V.indexOf(name) >= 0 ? name : (V.indexOf('viseme_' + name) >= 0 ? 'viseme_' + name : LEGACY[name]));
    this.manual = n ? { v: n, w: clamp(weight == null ? 1 : weight, 0, 1) } : null;
  };
  LipSyncController.prototype.isSpeaking = function () { return !!(this.playing || this.synthetic || this.ext != null || this.manual); };
  LipSyncController.prototype.getTime = function () { return this._audioClock ? this._audioClock() : this._clock; };

  /* Smooths each viseme toward its target so even manual / amplitude input never snaps. */
  LipSyncController.prototype._ease = function (dt) {
    var kUp = 1 - Math.exp(-34 * dt), kDn = 1 - Math.exp(-20 * dt);
    for (var i = 0; i < V.length; i++) { var n = V[i], c = this.visemes[n], t = this.tmp[n]; this.visemes[n] = c + (t - c) * (t > c ? kUp : kDn); }
  };

  LipSyncController.prototype.update = function (dt, t) {
    var i, kind = 'none', wide = 0;
    for (i = 0; i < V.length; i++) this.tmp[V[i]] = 0;
    if (this.playing && !this.paused && !this._audioClock) this._clock += dt;
    var tl = this.engine.hasTimeline() && this.playing;
    if (this.manual) {
      this.tmp[this.manual.v] = this.manual.w; kind = 'manual';
    } else if (tl) {
      var st = this.engine.sample(this.getTime(), this.tmp); this.silence = st.silence; kind = 'timeline';
      if (!this._audioClock && this._clock > this._timed) this.stop();
    } else if (this.ext != null) {
      this.amp.set(dt, Math.pow(this.ext, 0.85) * 0.95, 0); this.amp.toVisemes(this.tmp); kind = 'external';
    } else if (this.playing && this.analyser && this._audioClock) {
      if (!this.paused) {
        this.analyser.getFloatTimeDomainData(this.time); this.analyser.getByteFrequencyData(this.freq);
        var sum = 0, n = this.time.length;
        for (i = 0; i < n; i++) sum += this.time[i] * this.time[i];
        var lo = 0, hi = 0, all = 1e-6, bw = this.ctx.sampleRate / this.analyser.fftSize;
        for (i = 2; i < this.freq.length; i++) { var f = i * bw, e = this.freq[i]; all += e; if (f < 800) lo += e; else if (f > 2200 && f < 6500) hi += e; }
        this.amp.update(dt, Math.sqrt(sum / n), lo, hi, all);
      } else this.amp.set(dt, 0, 0);
      this.amp.toVisemes(this.tmp); kind = 'amplitude';
    } else if (this.playing && this.analyser) {          // MediaStream: no clock
      this.analyser.getFloatTimeDomainData(this.time); this.analyser.getByteFrequencyData(this.freq);
      var s2 = 0; for (i = 0; i < this.time.length; i++) s2 += this.time[i] * this.time[i];
      this.amp.update(dt, Math.sqrt(s2 / this.time.length), 1, 1, 2); this.amp.toVisemes(this.tmp); kind = 'amplitude';
    } else if (this.synthetic) {
      var syll = Math.abs(Math.sin(t * 8.2 + Math.sin(t * 1.9) * 2)) * (0.55 + 0.45 * Math.sin(t * 3.1));
      this.amp.set(dt, syll * (Math.sin(t * 0.85) > -0.55 ? 1 : 0.1) * 0.8, Math.sin(t * 3.7) * 0.35); this.amp.toVisemes(this.tmp); kind = 'synthetic';
    } else if (this.amp.level > 0.01) { this.amp.set(dt, 0, 0); this.amp.toVisemes(this.tmp); }
    this._ease(dt);
    var lvl = 0, wsum = 0, wd = 0;
    for (i = 0; i < V.length; i++) { var w = this.visemes[V[i]]; lvl = Math.max(lvl, w * OPEN[V[i]]); }
    wd = (this.visemes.viseme_E + this.visemes.viseme_I + this.visemes.viseme_SS) - (this.visemes.viseme_O + this.visemes.viseme_U);
    this.level = lvl; this.wide = clamp(wd, -1, 1); this.sourceKind = kind;
    this.speaking = this.isSpeaking();
    return { visemes: this.visemes, level: this.level, wide: this.wide, speaking: this.speaking, paused: this.paused, source: kind,
      active: this.speaking || lvl > 0.03, silence: kind === 'timeline' ? this.silence : (lvl > 0.04 ? 0 : 99) };
  };

  WA.LipSyncController = LipSyncController;
  WA.VISEME_OPENNESS = OPEN;
})(typeof window !== 'undefined' ? window : globalThis);
