/*
 * Phonemizer: text -> ARPAbet phoneme events { ph, t, d } for the lip-sync timeline.
 *
 * A small English rule set with an exception list. It is APPROXIMATE: good enough to drive plausible mouth shapes for
 * ordinary executive prose, not a dictionary. A real TTS that returns its own visemes or phonemes replaces it
 * (SpeechResult.phonemes), and nothing else changes.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit;

  var EXC = {
    the: 'DH AH', a: 'AH', an: 'AE N', of: 'AH V', to: 'T UW', too: 'T UW', you: 'Y UW', your: 'Y AO R', youre: 'Y UH R', is: 'IH Z', was: 'W AH Z', are: 'AA R', were: 'W ER', what: 'W AH T', who: 'HH UW',
    one: 'W AH N', two: 'T UW', do: 'D UW', does: 'D AH Z', have: 'HH AE V', said: 'S EH D', they: 'DH EY', there: 'DH EH R', their: 'DH EH R', this: 'DH IH S', that: 'DH AE T', then: 'DH EH N',
    them: 'DH EH M', these: 'DH IY Z', those: 'DH OW Z', than: 'DH AE N', with: 'W IH TH', from: 'F R AH M', about: 'AH B AW T', would: 'W UH D', could: 'K UH D', should: 'SH UH D', people: 'P IY P AH L',
    problem: 'P R AA B L AH M', issue: 'IH SH UW', separate: 'S EH P ER EY T', noise: 'N OY Z', next: 'N EH K S T', move: 'M UW V', lets: 'L EH T S', whats: 'W AH T S', thats: 'DH AE T S', its: 'IH T S',
    dont: 'D OW N T', cant: 'K AE N T', wont: 'W OW N T', ive: 'AY V', were: 'W ER', we: 'W IY', he: 'HH IY', she: 'SH IY', me: 'M IY', be: 'B IY', my: 'M AY', by: 'B AY', no: 'N OW', so: 'S OW',
    go: 'G OW', how: 'HH AW', now: 'N AW', not: 'N AA T', actually: 'AE K CH UW AH L IY', before: 'B IH F AO R', decide: 'D IH S AY D', decision: 'D IH S IH SH AH N', executive: 'IH G Z EH K Y AH T IH V',
    because: 'B IH K AO Z', every: 'EH V R IY', other: 'AH DH ER', another: 'AH N AH DH ER', whole: 'HH OW L', where: 'W EH R', here: 'HH IY R', here_: '', want: 'W AA N T', work: 'W ER K', world: 'W ER L D',
    right: 'R AY T', night: 'N AY T', know: 'N OW', through: 'TH R UW', thought: 'TH AO T', enough: 'IH N AH F', happened: 'HH AE P AH N D', story: 'S T AO R IY', telling: 'T EH L IH NG',
    yourself: 'Y AO R S EH L F', happening: 'HH AE P AH N IH NG'
  };
  var DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  var VOW = 'aeiouy';
  function isV(c) { return !!c && VOW.indexOf(c) >= 0; }

  function g2p(s) {
    var out = [], i = 0, n = s.length;
    function at(k) { return s.charAt(i + k); }
    while (i < n) {
      var c = s[i], c1 = at(1), c2 = at(2), two = c + c1, three = two + c2, rest = s.slice(i);
      if (rest === 'tion' || rest === 'sion') { out.push('SH', 'AH', 'N'); break; }
      if (c === 'l' && c1 === 'e' && i + 2 === n && i > 0 && !isV(s[i - 1])) { out.push('AH', 'L'); break; }
      if (three === 'tch') { out.push('CH'); i += 3; continue; }
      if (three === 'igh') { out.push('AY'); i += 3; continue; }
      if (two === 'sh') { out.push('SH'); i += 2; continue; }
      if (two === 'ch') { out.push('CH'); i += 2; continue; }
      if (two === 'th') { out.push('TH'); i += 2; continue; }
      if (two === 'ph') { out.push('F'); i += 2; continue; }
      if (two === 'wh') { out.push('W'); i += 2; continue; }
      if (two === 'ck') { out.push('K'); i += 2; continue; }
      if (two === 'ng') { out.push('NG'); i += 2; continue; }
      if (two === 'qu') { out.push('K', 'W'); i += 2; continue; }
      if (i === 0 && two === 'kn') { out.push('N'); i += 2; continue; }
      if (i === 0 && two === 'wr') { out.push('R'); i += 2; continue; }
      if (two === 'gh') { i += 2; continue; }
      if (c === c1 && !isV(c)) { i++; continue; }
      if (!isV(c)) {
        var m = { b: 'B', d: 'D', f: 'F', h: 'HH', j: 'JH', k: 'K', l: 'L', m: 'M', n: 'N', p: 'P', r: 'R', t: 'T', v: 'V', w: 'W', z: 'Z', q: 'K' }[c];
        if (m) out.push(m);
        else if (c === 'c') out.push('eiy'.indexOf(c1) >= 0 && c1 ? 'S' : 'K');
        else if (c === 'g') out.push('eiy'.indexOf(c1) >= 0 && c1 && i + 2 < n ? 'JH' : 'G');
        else if (c === 's') out.push(i === n - 1 && i > 0 && 'bdgvzmnlraeiou'.indexOf(s[i - 1]) >= 0 ? 'Z' : 'S');
        else if (c === 'x') out.push('K', 'S');
        i++; continue;
      }
      // vowels
      var magic = s[i + 2] === 'e' && i + 3 === n && !isV(c1);
      if (c === 'y' && i === 0) { out.push('Y'); i++; continue; }
      var dg = { ee: 'IY', ea: 'IY', oo: 'UW', ou: 'AW', ow: 'OW', ai: 'EY', ay: 'EY', oi: 'OY', oy: 'OY', au: 'AO', aw: 'AO', ie: 'IY', ei: 'EY', ey: 'EY', oa: 'OW', ue: 'UW', ui: 'UW' }[two];
      if (dg) { out.push(dg); i += 2; continue; }
      if (c1 === 'r' && !isV(c2) && 'aeiou'.indexOf(c) >= 0) { out.push(c === 'a' ? 'AA' : c === 'o' ? 'AO' : 'ER'); if (c === 'a' || c === 'o') out.push('R'); i += 2; continue; }
      if (c === 'a') out.push(magic ? 'EY' : 'AE');
      else if (c === 'e') { if (i === n - 1 && n > 2) { i++; continue; } out.push(n === 2 && i === 1 ? 'IY' : 'EH'); }
      else if (c === 'i') out.push(magic ? 'AY' : 'IH');
      else if (c === 'o') out.push(magic ? 'OW' : 'AA');
      else if (c === 'u') out.push(magic ? 'UW' : 'AH');
      else if (c === 'y') out.push(i === n - 1 ? (n <= 3 ? 'AY' : 'IY') : 'IH');
      i++;
    }
    return out;
  }

  /* text -> words [{ word, ph: [..], pause }] */
  function words(text) {
    var out = [], tokens = String(text == null ? '' : text).replace(/[’']/g, '').match(/[A-Za-z]+|[0-9]|[.,;:!?—–-]/g) || [];
    tokens.forEach(function (t) {
      if (/[0-9]/.test(t)) { out.push({ word: DIGITS[+t], ph: g2p(DIGITS[+t]), pause: 0 }); return; }
      if (/[A-Za-z]/.test(t)) { var w = t.toLowerCase(); out.push({ word: w, ph: EXC[w] ? EXC[w].split(' ') : g2p(w), pause: 0 }); return; }
      if (!out.length) return;
      var p = /[.!?]/.test(t) ? 0.45 : /[;:]/.test(t) ? 0.35 : /[—–-]/.test(t) ? 0.22 : 0.3;
      out[out.length - 1].pause = Math.max(out[out.length - 1].pause, p);
    });
    return out;
  }

  var V = { AA: 1, AE: 1, AH: 1, AO: 1, AW: 1, AY: 1, EH: 1, ER: 1, EY: 1, IH: 1, IY: 1, OW: 1, OY: 1, UH: 1, UW: 1 }, DIPH = { AW: 1, AY: 1, EY: 1, OW: 1, OY: 1 }, STOP = { B: 1, D: 1, G: 1, K: 1, P: 1, T: 1 }, NAS = { M: 1, N: 1, NG: 1 };
  function dur(ph, stressed, pace) { var d = V[ph] ? (DIPH[ph] ? 0.2 : 0.14) : STOP[ph] ? 0.065 : NAS[ph] ? 0.08 : 0.095; if (stressed && V[ph]) d *= 1.35; return d * pace; }

  /* opts: { rate (1 = calm and deliberate), lead, tail } -> { events, duration, syllables, words } */
  function toEvents(text, opts) {
    opts = opts || {}; var pace = 1.1 / (opts.rate || 1), t = opts.lead == null ? 0.25 : opts.lead, ev = [{ ph: 'SIL', t: 0, d: t }], syl = 0, ws = words(text);
    ws.forEach(function (w) {
      var first = true;
      w.ph.forEach(function (ph) {
        var st = V[ph] && first; if (V[ph]) { first = false; syl++; }
        var d = dur(ph, st, pace); ev.push({ ph: ph, t: +t.toFixed(3), d: +d.toFixed(3) }); t += d;
      });
      t += 0.045 * pace; if (w.pause) { ev.push({ ph: 'SIL', t: +t.toFixed(3), d: +(w.pause * pace / 1.1).toFixed(3) }); t += w.pause * pace / 1.1; }
    });
    var tail = opts.tail == null ? 0.4 : opts.tail; ev.push({ ph: 'SIL', t: +t.toFixed(3), d: tail });
    return { events: ev, duration: +(t + tail).toFixed(3), syllables: syl, words: ws.length };
  }

  WA.Phonemizer = { g2p: g2p, words: words, toEvents: toEvents, VOWELS: V };
})(typeof window !== 'undefined' ? window : globalThis);
