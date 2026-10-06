/*
 * VisemeEngine: a timeline of speech sounds in, mouth shape weights out.
 *
 * Input is whatever a TTS provides:
 *   - phonemes with timestamps (ARPAbet), optionally durations
 *   - Azure viseme ids (0..21) with audio offsets
 *   - Amazon Polly viseme speech marks
 *   - character timings (the shape ElevenLabs-style alignment returns)
 *   - Oculus visemes directly
 * It is normalised to events { t, d, v, w } in seconds, then sampled at any time.
 *
 * Sampling is not "show the current viseme". Each sound has an anticipation, an attack and
 * a release, so neighbouring sounds overlap the way real articulation does (coarticulation),
 * and lip closures (p, b, m, f, v) take priority over open vowels while they last.
 *
 * The mappings from provider ids to Oculus visemes are documented tables: check them against
 * your voice's documentation before shipping, and override with opts.map if your voice differs.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, V = WA.Channels.VISEMES, smooth = WA.smooth;
  var P = function (n) { return 'viseme_' + n; };

  var ARPABET = {
    AA: [P('aa')], AE: [P('aa')], AH: [P('aa'), 0.8], AO: [P('O')], AW: [P('O')], AY: [P('aa')], B: [P('PP')], CH: [P('CH')], D: [P('DD')],
    DH: [P('TH')], EH: [P('E')], ER: [P('RR')], EY: [P('E')], F: [P('FF')], G: [P('kk')], HH: [P('aa'), 0.3], IH: [P('I')], IY: [P('I')],
    JH: [P('CH')], K: [P('kk')], L: [P('nn')], M: [P('PP')], N: [P('nn')], NG: [P('kk')], OW: [P('O')], OY: [P('O')], P: [P('PP')],
    R: [P('RR')], S: [P('SS')], SH: [P('CH')], T: [P('DD')], TH: [P('TH')], UH: [P('U')], UW: [P('U')], V: [P('FF')], W: [P('U')],
    Y: [P('I')], Z: [P('SS')], ZH: [P('CH')], SIL: [P('sil')], SP: [P('sil')]
  };
  // Azure speech viseme ids 0..21 (documented IPA groups, mapped to the nearest Oculus viseme)
  var AZURE = ['sil', 'aa', 'aa', 'O', 'E', 'RR', 'I', 'U', 'O', 'O', 'O', 'aa', 'aa', 'RR', 'nn', 'SS', 'CH', 'TH', 'FF', 'DD', 'kk', 'PP'].map(P);
  var AZURE_W = { 12: 0.3 };
  // Amazon Polly viseme speech mark values
  var POLLY = { p: P('PP'), t: P('DD'), S: P('CH'), T: P('TH'), f: P('FF'), k: P('kk'), i: P('I'), r: P('RR'), s: P('SS'), u: P('U'),
    '@': P('aa'), a: P('aa'), e: P('E'), E: P('E'), o: P('O'), O: P('O'), sil: P('sil') };
  // coarse letter-to-viseme fallback for providers that only give character timings
  var LETTER = { a: 'aa', e: 'E', i: 'I', o: 'O', u: 'U', y: 'I', w: 'U', b: 'PP', p: 'PP', m: 'PP', f: 'FF', v: 'FF', t: 'DD', d: 'DD',
    n: 'nn', l: 'nn', s: 'SS', z: 'SS', c: 'kk', k: 'kk', g: 'kk', q: 'kk', x: 'kk', j: 'CH', r: 'RR', h: 'aa' };
  var LETTER_W = { h: 0.3 };

  var GAIN = { viseme_sil: 0, viseme_PP: 1, viseme_FF: 0.95, viseme_TH: 0.8, viseme_DD: 0.7, viseme_kk: 0.65, viseme_CH: 0.9, viseme_SS: 0.8,
    viseme_nn: 0.6, viseme_RR: 0.8, viseme_aa: 1, viseme_E: 0.95, viseme_I: 0.9, viseme_O: 1, viseme_U: 1 };
  var VOWELS = { viseme_aa: 1, viseme_E: 1, viseme_I: 1, viseme_O: 1, viseme_U: 1 };

  /* ---------- timeline ---------- */
  function Timeline(events) {
    this.events = events.filter(function (e) { return e && V.indexOf(e.v) >= 0 && isFinite(e.t); })
      .map(function (e) { return { t: +e.t, d: e.d > 0 ? +e.d : 0, v: e.v, w: e.w == null ? 1 : e.w }; })
      .sort(function (a, b) { return a.t - b.t; });
    this.duration = this.events.length ? this.events[this.events.length - 1].t + (this.events[this.events.length - 1].d || 0.15) : 0;
  }
  function num(x, d) { return x == null || !isFinite(x) ? d : +x; }
  function secs(item, unit) {
    if (item.t != null) return +item.t * (unit === 'ms' ? 0.001 : 1);
    if (item.start != null) return +item.start * (unit === 'ms' ? 0.001 : 1);
    if (item.time != null) return +item.time * 0.001;                         // Polly: ms
    if (item.offsetMs != null) return +item.offsetMs * 0.001;
    if (item.offset != null) return +item.offset * 0.001;                      // ms
    if (item.audioOffset != null) return +item.audioOffset / 1e7;              // Azure: ticks of 100 ns
    return NaN;
  }
  Timeline.fromEvents = function (list) { return new Timeline(list.map(function (e) { return { t: e.t, d: e.d, v: e.v.indexOf('viseme_') === 0 ? e.v : P(e.v), w: e.w }; })); };
  Timeline.fromPhonemes = function (list, opts) {
    var map = (opts && opts.map) || ARPABET, unit = (opts && opts.unit) || 's';
    return new Timeline(list.map(function (p) {
      var ph = String(p.ph || p.phoneme || p.p || '').toUpperCase().replace(/[0-9]/g, ''), m = map[ph];
      if (!m) return null;
      var dur = p.d != null ? p.d : p.duration;
      return { t: secs(p, unit), d: dur != null ? dur * (unit === 'ms' ? 0.001 : 1) : 0, v: m[0], w: m[1] };
    }).filter(Boolean));
  };
  Timeline.fromAzure = function (list, opts) {
    var map = (opts && opts.map) || AZURE;
    return new Timeline(list.map(function (e) {
      var id = e.id != null ? e.id : e.visemeId, v = map[id];
      return v ? { t: secs(e, 'ms'), d: 0, v: v, w: AZURE_W[id] } : null;
    }).filter(Boolean));
  };
  Timeline.fromPolly = function (marks) {
    if (typeof marks === 'string') marks = marks.split('\n').filter(Boolean).map(function (l) { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
    return new Timeline(marks.filter(function (m) { return m.type === 'viseme' || m.value; }).map(function (m) {
      var v = POLLY[m.value]; return v ? { t: secs(m, 'ms'), d: 0, v: v } : null;
    }).filter(Boolean));
  };
  Timeline.fromCharacters = function (al) {
    var chars = al.characters || al.chars, st = al.character_start_times_seconds || al.starts, en = al.character_end_times_seconds || al.ends, ev = [];
    if (!chars) return new Timeline([]);
    for (var i = 0; i < chars.length; i++) {
      var ch = String(chars[i]).toLowerCase(), k = LETTER[ch];
      if (ch === 't' && chars[i + 1] === 'h') k = 'TH';
      if (ch === 's' && chars[i + 1] === 'h') k = 'CH';
      if (ch === 'c' && chars[i + 1] === 'h') k = 'CH';
      if (!k) continue;
      var ps = +st[i], pe = en ? +en[i] : NaN;
      ev.push({ t: ps, d: isFinite(pe) ? pe - ps : 0, v: P(k), w: LETTER_W[ch] });
    }
    return new Timeline(ev);
  };
  /* Picks the right constructor from the shape of the input or opts.provider. */
  Timeline.auto = function (input, opts) {
    opts = opts || {};
    if (input instanceof Timeline) return input;
    var p = opts.provider;
    if (input && input.characters || (input && input.chars)) return Timeline.fromCharacters(input);
    if (typeof input === 'string' || p === 'polly') return Timeline.fromPolly(input);
    if (!Array.isArray(input) || !input.length) return new Timeline([]);
    var f = input[0];
    if (p === 'azure' || f.visemeId != null || (f.id != null && f.audioOffset != null) || (f.id != null && f.offsetMs != null)) return Timeline.fromAzure(input, opts);
    if (p === 'phonemes' || p === 'arpabet' || f.ph != null || f.phoneme != null) return Timeline.fromPhonemes(input, opts);
    if (f.type === 'viseme') return Timeline.fromPolly(input);
    return Timeline.fromEvents(input);
  };

  /* ---------- engine ---------- */
  function VisemeEngine(opts) {
    this.o = WA.assign({ anticipation: 0.045, attack: 0.05, release: 0.075, defaultDur: 0.11, maxDur: 0.32, articulation: 1, gap: 0.14 }, opts || {});
    this.tl = null; this.lastActive = -1; this._seed = 0;
  }
  VisemeEngine.prototype.load = function (timeline) { this.tl = timeline; this.lastActive = -1; };
  VisemeEngine.prototype.clear = function () { this.tl = null; };
  VisemeEngine.prototype.hasTimeline = function () { return !!(this.tl && this.tl.events.length); };
  VisemeEngine.prototype.duration = function () { return this.tl ? this.tl.duration : 0; };

  /* Fills `out` (all 15 visemes) for time t in seconds. Returns { active, silence } where silence is seconds since the last sound. */
  VisemeEngine.prototype.sample = function (t, out) {
    var i, n = V.length;
    for (i = 0; i < n; i++) out[V[i]] = 0;
    if (!this.tl) return { active: false, silence: 99 };
    var E = this.tl.events, o = this.o, A = o.anticipation, active = false;
    // first event that starts after the window of interest
    var lo = 0, hi = E.length;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (E[mid].t > t + A) hi = mid; else lo = mid + 1; }
    for (i = lo - 1; i >= 0 && i > lo - 9; i--) {
      var ev = E[i], next = E[i + 1];
      var dur = ev.d || o.defaultDur, end = ev.t + Math.min(ev.d ? 1.2 : o.maxDur, dur);       // a duration given by the provider is honoured; a guessed one is capped
      if (next && next.t - end < o.gap && !ev.d) end = Math.min(end, next.t + o.release * 0.5);     // overlap into the next sound
      else if (next && !ev.d) end = Math.max(end, Math.min(next.t, ev.t + o.maxDur));            // hold until the next sound
      var rise = smooth(ev.t - A, ev.t + o.attack * 0.5, t), fall = 1 - smooth(end - o.release * 0.5, end + o.release, t);
      var w = rise * fall * ev.w * GAIN[ev.v] * o.articulation;
      if (w > out[ev.v]) out[ev.v] = w;
      if (w > 0.03) active = true;
    }
    // lip closures win over open vowels while they last
    var closure = Math.max(out.viseme_PP, out.viseme_FF * 0.6);
    if (closure > 0.05) for (var vw in VOWELS) out[vw] *= 1 - 0.75 * closure;
    var sum = 0; for (i = 0; i < n; i++) sum += out[V[i]];
    if (sum > 1.15) { var k = 1.15 / sum; for (i = 0; i < n; i++) out[V[i]] *= k; }
    if (active) this.lastActive = t;
    return { active: active, silence: this.lastActive < 0 ? (t < (E.length ? E[0].t : 0) ? 99 : t - Math.max(0, E.length ? E[0].t : 0)) : t - this.lastActive };
  };

  WA.VisemeTimeline = Timeline;
  WA.VisemeEngine = VisemeEngine;
  WA.VisemeTables = { ARPABET: ARPABET, AZURE: AZURE, POLLY: POLLY, LETTER: LETTER };
})(typeof window !== 'undefined' ? window : globalThis);
