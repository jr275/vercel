/*
 * CognitiveState: what the agent is DOING, as opposed to what its face is showing.
 *
 * The executive agent reports a cognitive state ("PROCESSING", "CHALLENGE"...). Each state is a profile:
 * which emotions it implies (a mix), how the eyes behave, how much the head moves, how often she blinks.
 * An explicit setExpression() after the state wins for the face (the state keeps its gaze and posture),
 * until the next setCognitiveState().
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit;

  // gaze: attend (mostly on you, short glances), think (down/aside, returns), scan, speak (conversational pattern), direct, hold (locked on)
  var STATES = {
    LISTENING: { mix: [['listening', 1]], gaze: 'attend', motion: 1, blink: 1, nods: 1, attention: 0.95 },
    PROCESSING: { mix: [['analyzing', 0.6], ['thinking', 0.3]], gaze: 'scan', motion: 0.75, blink: 1.1, nods: 0, attention: 0.7 },
    THINKING: { mix: [['thinking', 1]], gaze: 'think', motion: 0.75, blink: 0.9, nods: 0, attention: 0.6 },
    SPEAKING: { mix: [['neutral', 0.6], ['confident', 0.35]], gaze: 'speak', motion: 0.8, blink: 1, nods: 0, attention: 0.85 },
    DECIDING: { mix: [['decisive', 1]], gaze: 'hold', motion: 0.3, blink: 0.6, nods: 0, attention: 1, beat: 'decide' },
    WARNING: { mix: [['firm', 0.85], ['concerned', 0.3]], gaze: 'hold', motion: 0.25, blink: 0.5, nods: 0, attention: 1 },
    EMPATHY: { mix: [['empathetic', 1]], gaze: 'attend', motion: 0.85, blink: 1, nods: 0.7, attention: 0.95 },
    CHALLENGE: { mix: [['skeptical', 0.8], ['firm', 0.3]], gaze: 'hold', motion: 0.4, blink: 0.6, nods: 0, attention: 1, head: { pitch: -0.02 } },
    CONFIDENCE: { mix: [['confident', 1]], gaze: 'direct', motion: 0.5, blink: 0.8, nods: 0, attention: 0.95 }
  };
  var NAMES = Object.keys(STATES);

  function CognitiveState() { this.name = null; this.since = 0; }
  CognitiveState.names = NAMES;
  CognitiveState.STATES = STATES;
  CognitiveState.normalize = function (n) { n = String(n == null ? '' : n).toUpperCase(); return STATES[n] ? n : null; };
  CognitiveState.profile = function (n) {
    n = CognitiveState.normalize(n); if (!n) return null;
    var s = STATES[n];
    return { name: n, mix: s.mix.map(function (m) { return { name: m[0], w: m[1] }; }), gaze: s.gaze, motion: s.motion, blink: s.blink, nods: s.nods, attention: s.attention, head: s.head || null, beat: s.beat || null };
  };
  CognitiveState.prototype.set = function (name, t) {
    var n = CognitiveState.normalize(name); if (!n) return false;
    this.name = n; this.since = t || 0; return true;
  };
  CognitiveState.prototype.clear = function () { this.name = null; };
  CognitiveState.prototype.profile = function () { return this.name ? CognitiveState.profile(this.name) : null; };

  WA.CognitiveState = CognitiveState;
})(typeof window !== 'undefined' ? window : globalThis);
