/*
 * TestVoice: a synthetic voice with a known phonetic script, so lip-sync can be verified without a TTS.
 * makeTestVoice() returns PCM; makeTestVoiceWithVisemes() returns PCM plus the matching viseme events,
 * which is what a real TTS integration would hand to avatar.speak().
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit;
  var VOWELS = [[730, 1090, 'viseme_aa'], [270, 2290, 'viseme_I'], [570, 840, 'viseme_O'], [300, 870, 'viseme_U'], [530, 1840, 'viseme_E'], [660, 1720, 'viseme_aa']];
  var CONS = ['viseme_PP', 'viseme_DD', 'viseme_SS', 'viseme_nn', 'viseme_FF', 'viseme_kk'];

  function build(sampleRate, seed) {
    sampleRate = sampleRate || 22050;
    var dur = 7, n = Math.floor(dur * sampleRate), buf = new Float32Array(n), rnd = WA.rng(seed || 12), syl = [], events = [];
    var cursor = 0.2;
    while (cursor < dur - 0.5) {
      var words = 2 + Math.floor(rnd() * 3);
      for (var w = 0; w < words; w++) { var L = 0.13 + rnd() * 0.1; syl.push([cursor, L, Math.floor(rnd() * VOWELS.length), 170 + rnd() * 50, Math.floor(rnd() * CONS.length)]); cursor += L + 0.04; }
      cursor += 0.28 + rnd() * 0.25;
    }
    var phase = 0, lp1 = 0, lp2 = 0;
    for (var s = 0; s < syl.length; s++) {
      var st = syl[s], i0 = Math.floor(st[0] * sampleRate), len = Math.floor(st[1] * sampleRate), v = VOWELS[st[2]];
      events.push({ t: st[0] - 0.03, d: 0.05, v: CONS[st[4]] });
      events.push({ t: st[0] + 0.02, d: st[1] - 0.02, v: v[2] });
      for (var i = 0; i < len && i0 + i < n; i++) {
        var u = i / len, env = Math.sin(Math.PI * u); env *= env;
        phase += (st[3] * (1 + 0.06 * Math.sin(u * 3))) / sampleRate; if (phase > 1) phase -= 1;
        var pulse = (1 - phase) * (1 - phase) * 2 - 0.7;
        var w1 = 2 * Math.PI * v[0] / sampleRate, w2 = 2 * Math.PI * v[1] / sampleRate;
        lp1 += (pulse - lp1) * Math.min(1, w1 * 1.1); lp2 += (pulse - lp2) * Math.min(1, w2 * 0.9);
        buf[i0 + i] += (lp1 * 0.9 + (pulse - lp2) * 0.35) * env * 0.4;
      }
    }
    return { pcm: buf, sampleRate: sampleRate, events: events, duration: dur };
  }
  WA.makeTestVoice = function (sampleRate) { return build(sampleRate).pcm; };
  WA.makeTestVoiceWithVisemes = function (sampleRate) { return build(sampleRate); };
})(typeof window !== 'undefined' ? window : globalThis);
