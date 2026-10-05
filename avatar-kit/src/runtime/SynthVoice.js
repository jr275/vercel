/*
 * SynthVoice: phoneme events -> audible PCM. A small source-filter (glottal pulse train through two formant resonators,
 * shaped noise for fricatives and bursts). It is intelligible as speech-like sound but robotic: it exists so the product
 * speaks, with matching lip-sync, with no network and no credentials. A real TTS replaces it behind SpeechProvider.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit;

  var VOWEL = { AA: [730, 1090], AE: [660, 1720], AH: [640, 1190], AO: [570, 840], AW: [700, 1200], AY: [700, 1300], EH: [530, 1840], ER: [490, 1350], EY: [450, 2000], IH: [390, 1990], IY: [270, 2290], OW: [500, 900], OY: [500, 900], UH: [440, 1020], UW: [300, 870] };
  var SONOR = { L: [360, 1300, 0.55], R: [310, 1060, 0.55], W: [290, 610, 0.5], Y: [270, 2100, 0.5], M: [250, 1000, 0.3], N: [250, 1500, 0.3], NG: [250, 1200, 0.3] };
  // fricatives: [noise centre Hz, noise level, voiced level]
  var FRIC = { S: [6000, 0.5, 0], SH: [3200, 0.5, 0], F: [4000, 0.22, 0], TH: [4500, 0.16, 0], HH: [1500, 0.3, 0], Z: [6000, 0.3, 0.3], V: [4000, 0.14, 0.3], DH: [4500, 0.1, 0.3], ZH: [3200, 0.3, 0.3], CH: [3200, 0.5, 0], JH: [3200, 0.35, 0.2] };
  var STOPS = { P: [900, 0], B: [900, 0.25], T: [4000, 0], D: [4000, 0.25], K: [2000, 0], G: [2000, 0.25] };

  function render(events, opts) {
    opts = opts || {}; var sr = opts.sampleRate || 22050, base = opts.pitch || 172;
    var last = events[events.length - 1], total = last.t + last.d, n = Math.ceil(total * sr) + sr / 4, out = new Float32Array(n);
    var seed = 12345; function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; }
    var phase = 0, y1a = 0, y2a = 0, y1b = 0, y2b = 0, y1n = 0, y2n = 0;
    function coef(f, bw) { var r = Math.exp(-Math.PI * bw / sr), a2 = -r * r, a1 = 2 * r * Math.cos(2 * Math.PI * f / sr); return [a1, a2, 1 - a1 - a2]; }
    events.forEach(function (e) {
      var ph = e.ph; if (ph === 'SIL' || ph === 'SP') return;
      var i0 = Math.floor(e.t * sr), len = Math.max(1, Math.floor(e.d * sr)), v = VOWEL[ph], so = SONOR[ph], fr = FRIC[ph], st = STOPS[ph];
      var f1 = 500, f2 = 1500, voiced = 0, noise = 0, nf = 3000, burst = false;
      if (v) { f1 = v[0]; f2 = v[1]; voiced = 1; } else if (so) { f1 = so[0]; f2 = so[1]; voiced = so[2]; } else if (fr) { nf = fr[0]; noise = fr[1]; voiced = fr[2]; f1 = 450; f2 = 1500; } else if (st) { nf = st[0]; voiced = st[1]; burst = true; } else return;
      var c1 = coef(f1, 90), c2 = coef(f2, 130), cn = coef(nf, nf * 0.35);
      for (var k = 0; k < len && i0 + k < n; k++) {
        var u = k / len, env = Math.min(1, u * 12) * Math.min(1, (1 - u) * 10);
        var f0 = base * (1 - 0.14 * ((i0 + k) / sr) / Math.max(1, total)) * (1 + 0.012 * Math.sin(2 * Math.PI * 5 * (i0 + k) / sr));
        phase += f0 / sr; if (phase >= 1) phase -= 1;
        var glot = (1 - phase) * (1 - phase) * 2 - 0.66, s = 0;
        if (voiced > 0 && !(burst && u < 0.6)) {
          var a = glot * voiced, ya = c1[0] * y1a + c1[1] * y2a + c1[2] * a; y2a = y1a; y1a = ya;
          var yb = c2[0] * y1b + c2[1] * y2b + c2[2] * a; y2b = y1b; y1b = yb;
          s += (ya * 1.0 + yb * 0.55) * (v ? 1 : 0.6);
        }
        if (noise > 0 || (burst && u < 0.35)) {
          var x = rnd() * (burst ? 0.9 : noise), yn = cn[0] * y1n + cn[1] * y2n + cn[2] * x; y2n = y1n; y1n = yn;
          s += yn * 1.4 * (burst ? Math.max(0, 1 - u / 0.35) : 1);
        }
        out[i0 + k] += s * env * (burst && u >= 0.35 && u < 0.6 ? 0 : 1) * (v ? 1 : 0.7);
      }
    });
    var peak = 0.0001; for (var i = 0; i < n; i++) { var a = Math.abs(out[i]); if (a > peak) peak = a; }
    var g = 0.55 / peak; for (var j = 0; j < n; j++) out[j] *= g;
    return { pcm: out, sampleRate: sr, duration: n / sr };
  }
  WA.SynthVoice = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
