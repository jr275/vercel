/*
 * SpeechScript: the one sentence every head candidate must speak, as a phoneme timeline.
 *
 * This is NOT a voice and NOT a TTS. It is a fixed, hand-transcribed ARPAbet script with deterministic timing
 * (calm, deliberate delivery), so every candidate is driven by exactly the same mouth targets in the same order.
 * It tests the RIG (visemes, jaw, lips, teeth, tongue, stability), not the pronunciation of a speech engine.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit;

  var TEXT = "Before we decide what to do, let's separate what is actually happening from the story you're telling yourself about it.";
  // [word, ARPAbet phonemes (a trailing ! marks a stressed vowel), pause after in seconds]
  var WORDS = [
    ['Before', 'B IH F AO! R', 0], ['we', 'W IY', 0], ['decide', 'D IH S AY! D', 0], ['what', 'W AH! T', 0], ['to', 'T UW', 0], ['do,', 'D UW!', 0.42],
    ["let's", 'L EH! T S', 0], ['separate', 'S EH! P ER EY T', 0], ['what', 'W AH! T', 0], ['is', 'IH Z', 0], ['actually', 'AE! K CH UW AH L IY', 0],
    ['happening', 'HH AE! P AH N IH NG', 0.3], ['from', 'F R AH! M', 0], ['the', 'DH AH', 0], ['story', 'S T AO! R IY', 0], ["you're", 'Y UH R', 0],
    ['telling', 'T EH! L IH NG', 0], ['yourself', 'Y AO R S EH! L F', 0], ['about', 'AH B AW! T', 0], ['it.', 'IH! T', 0.35]
  ];
  var VOWELS = { AA: 1, AE: 1, AH: 1, AO: 1, AW: 1, AY: 1, EH: 1, ER: 1, EY: 1, IH: 1, IY: 1, OW: 1, OY: 1, UH: 1, UW: 1 };
  var DIPHTHONG = { AW: 1, AY: 1, EY: 1, OW: 1, OY: 1 };
  var STOP = { B: 1, D: 1, G: 1, K: 1, P: 1, T: 1 }, NASAL = { M: 1, N: 1, NG: 1 };
  var PACE = 1.1;                                    // calm, deliberate delivery: the whole clip is 12 to 14 s
  function dur(ph, stressed) {
    var d = VOWELS[ph] ? (DIPHTHONG[ph] ? 0.2 : 0.14) : STOP[ph] ? 0.065 : NASAL[ph] ? 0.08 : 0.095;
    if (stressed && VOWELS[ph]) d *= 1.35;
    return d * PACE;
  }

  /* Events in the shape VisemeTimeline.fromPhonemes expects: { ph, t, d } in seconds, plus lead-in and tail of silence. */
  function events(opts) {
    opts = opts || {}; var t = opts.lead == null ? 0.5 : opts.lead, out = [{ ph: 'SIL', t: 0, d: t }];
    WORDS.forEach(function (w) {
      w[1].split(' ').forEach(function (tok) { var st = tok.charAt(tok.length - 1) === '!', ph = st ? tok.slice(0, -1) : tok, d = dur(ph, st); out.push({ ph: ph, t: +t.toFixed(3), d: +d.toFixed(3) }); t += d; });
      t += 0.045 * PACE; if (w[2]) { out.push({ ph: 'SIL', t: +t.toFixed(3), d: w[2] }); t += w[2]; }
    });
    out.push({ ph: 'SIL', t: +t.toFixed(3), d: opts.tail == null ? 0.6 : opts.tail });
    return out;
  }
  function info() {
    var ev = events(), last = ev[ev.length - 1], syl = 0, ph = {};
    ev.forEach(function (e) { if (VOWELS[e.ph]) syl++; if (e.ph !== 'SIL') ph[e.ph] = (ph[e.ph] || 0) + 1; });
    // the 15 Oculus visemes the sentence needs, through the engine's own table (never a second mapping)
    var vis = {}; ev.forEach(function (e) { var m = WA.VisemeTables.ARPABET[e.ph]; if (m && m[0] !== 'viseme_sil') vis[m[0]] = (vis[m[0]] || 0) + 1; });
    return { text: TEXT, seconds: +(last.t + last.d).toFixed(2), speechStart: ev[1].t, speechEnd: ev[ev.length - 2].t + ev[ev.length - 2].d, syllables: syl, phonemes: ph, requiredVisemes: Object.keys(vis).sort(), visemeCounts: vis, events: ev };
  }
  /* times (seconds) of the first strong examples of the visemes a human reviewer must see as stills */
  function stillTimes() {
    var ev = events(), want = { viseme_aa: 'AE', viseme_PP: 'P', viseme_FF: 'F', viseme_O: 'AO', viseme_TH: 'DH', viseme_E: 'EH', viseme_U: 'UW' }, out = {};
    Object.keys(want).forEach(function (v) { var e = ev.filter(function (x) { return x.ph === want[v]; })[0]; if (e) out[v] = +(e.t + e.d * 0.5).toFixed(3); });
    return out;
  }

  WA.SpeechScript = { TEXT: TEXT, events: events, info: info, stillTimes: stillTimes, VOWELS: VOWELS };
})(typeof window !== 'undefined' ? window : globalThis);
