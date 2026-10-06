/*
 * AmplitudeFallback: when no phonetic data exists, derive a plausible mouth from the audio itself.
 *
 * It is a fallback, and it says so: amplitude alone cannot tell "b" from "o". It does two
 * things better than "mouth open = volume": it adapts to the speaker's loudness, and it
 * uses the balance of low and high frequencies to choose between round, open and wide shapes.
 * The output has the same form as VisemeEngine (weights over the 15 visemes), so everything
 * downstream is identical whichever source is active.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, clamp = WA.clamp, V = WA.Channels.VISEMES;

  function AmplitudeFallback() { this.ref = 0.05; this.level = 0; this.wide = 0; this.bias = 0; }

  /*
   * rms: RMS of the current audio block; lo/hi/all: summed spectrum energy below 800 Hz,
   * between 2.2 and 6.5 kHz, and total. Updates the smoothed level and wide.
   */
  AmplitudeFallback.prototype.update = function (dt, rms, lo, hi, all) {
    this.ref = Math.max(rms, this.ref * (1 - 0.15 * dt), 0.02);              // adaptive gain with slow release
    var lvl = rms < 0.004 ? 0 : clamp(rms / (this.ref * 0.85), 0, 1);
    var target = Math.pow(lvl, 0.85) * 0.95;
    var tw = all > 0 ? clamp((hi - lo) / all * 1.6, -0.7, 0.7) : 0;
    var up = target > this.level;
    this.level += (target - this.level) * (1 - Math.exp(-(up ? 30 : 15) * dt));
    this.wide += (tw - this.wide) * (1 - Math.exp(-14 * dt));
    return this;
  };

  /* Direct level (0..1) with an optional wide (-1..1), for callers that measure the audio themselves. */
  AmplitudeFallback.prototype.set = function (dt, level, wide) {
    var up = level > this.level;
    this.level += (level - this.level) * (1 - Math.exp(-(up ? 30 : 15) * dt));
    this.wide += ((wide || 0) - this.wide) * (1 - Math.exp(-14 * dt));
    return this;
  };

  /* Writes the 15 viseme weights for the current level and wide. */
  AmplitudeFallback.prototype.toVisemes = function (out) {
    for (var i = 0; i < V.length; i++) out[V[i]] = 0;
    var open = clamp(this.level, 0, 1), w = this.wide;
    if (open < 0.02) return out;
    var round = Math.max(0, -w), spread = Math.max(0, w);           // spectrum says: rounded (low) or spread (high) shape
    out.viseme_aa = open * (1 - 0.55 * (round + spread));
    out.viseme_E = open * spread * 0.7; out.viseme_I = open * spread * 0.3;
    out.viseme_O = open * round * 0.8; out.viseme_U = open * round * 0.35;
    return out;
  };

  AmplitudeFallback.prototype.reset = function () { this.level = 0; this.wide = 0; };

  WA.AmplitudeFallback = AmplitudeFallback;
})(typeof window !== 'undefined' ? window : globalThis);
