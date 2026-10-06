/*
 * ConversationState: the actual state model of the character, not a visual effect.
 *
 *   IDLE -> LISTENING -> THINKING -> SPEAKING -> IDLE
 *   SPEAKING -> INTERRUPTED -> LISTENING          (the user talks over her)
 *   SPEAKING -> INTERRUPTED -> THINKING           (the user interrupts with a short message and is already done)
 *
 * Pure and deterministic: no clock, no DOM. Time only moves when tick(dt) is called, so the same events and ticks always
 * give the same history. Every change goes through a short TRANSITION (`state` reads TRANSITION and `target` says where
 * it is going); events that arrive during it are applied to the target. An event with no edge from the current state is
 * refused (dispatch returns false, an `invalid` event is emitted): it never throws and never changes the state.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit;

  var STATES = ['IDLE', 'LISTENING', 'THINKING', 'SPEAKING', 'INTERRUPTED', 'TRANSITION', 'ERROR'];
  var EDGES = {
    IDLE: { userStart: 'LISTENING', responseStart: 'SPEAKING' },
    LISTENING: { userEnd: 'THINKING', responseStart: 'SPEAKING', cancel: 'IDLE' },
    THINKING: { responseStart: 'SPEAKING', userStart: 'LISTENING', cancel: 'IDLE' },
    SPEAKING: { responseEnd: 'IDLE', userStart: 'INTERRUPTED', interrupt: 'INTERRUPTED', cancel: 'IDLE' },
    INTERRUPTED: { settled: 'LISTENING', userStart: 'LISTENING', userEnd: 'THINKING', cancel: 'IDLE' },
    ERROR: { userStart: 'LISTENING' }
  };
  var ANYWHERE = { error: 'ERROR', reset: 'IDLE' };

  function ConversationState(opts) {
    opts = opts || {};
    this.transitionTime = opts.transition == null ? 0.2 : opts.transition;     // seconds spent in TRANSITION
    this.interruptHold = opts.interruptHold == null ? 0.35 : opts.interruptHold; // seconds in INTERRUPTED before LISTENING
    this.state = 'IDLE'; this.target = 'IDLE'; this.previous = null; this.time = 0; this.history = [];
    this._left = 0; this._hold = 0; this._handlers = {};
  }
  ConversationState.STATES = STATES; ConversationState.EDGES = EDGES;

  ConversationState.prototype.on = function (n, f) { (this._handlers[n] = this._handlers[n] || []).push(f); return f; };
  ConversationState.prototype.off = function (n, f) { var l = this._handlers[n]; if (l) this._handlers[n] = l.filter(function (x) { return x !== f; }); };
  ConversationState.prototype._emit = function (n, d) { (this._handlers[n] || []).slice().forEach(function (f) { try { f(d); } catch (e) {} }); };

  /* the state events are applied to: the target while a transition is under way */
  ConversationState.prototype.current = function () { return this.state === 'TRANSITION' ? this.target : this.state; };
  ConversationState.prototype.isIn = function (s) { return this.current() === s; };
  ConversationState.prototype.canDispatch = function (ev) { var c = this.current(); return !!((EDGES[c] && EDGES[c][ev]) || ANYWHERE[ev]); };

  ConversationState.prototype._commit = function () {
    if (this.state !== 'TRANSITION') return;
    this.state = this.target; this._hold = this.state === 'INTERRUPTED' ? this.interruptHold : 0;
    this._emit('enter', { state: this.state, time: this.time });
  };
  ConversationState.prototype._begin = function (to, ev, manual) {
    var from = this.current(); this.previous = from; this.target = to;
    this.history.push({ t: +this.time.toFixed(3), from: from, to: to, event: ev, manual: !!manual }); if (this.history.length > 100) this.history.shift();
    if (this.transitionTime > 0) { this.state = 'TRANSITION'; this._left = this.transitionTime; } else { this.state = to; this._hold = to === 'INTERRUPTED' ? this.interruptHold : 0; }
    this._emit('change', { from: from, to: to, event: ev, manual: !!manual });
    if (this.state !== 'TRANSITION') this._emit('enter', { state: this.state, time: this.time });
    return true;
  };

  /* events: userStart userEnd responseStart responseEnd interrupt cancel settled error reset */
  ConversationState.prototype.dispatch = function (ev, data) {
    var c = this.current(), to = (EDGES[c] && EDGES[c][ev]) || ANYWHERE[ev];
    if (!to) { this._emit('invalid', { state: c, event: ev }); return false; }
    this._commit(); this._left = 0;
    if (to === c && ev !== 'reset') return true;
    return this._begin(to, ev, false) && (data == null || true);
  };
  /* explicit override from a control panel or a test: any state to any known state, recorded as manual */
  ConversationState.prototype.force = function (name) {
    name = String(name || '').toUpperCase();
    if (STATES.indexOf(name) < 0 || name === 'TRANSITION') { this._emit('invalid', { state: this.current(), event: 'force:' + name }); return false; }
    this._commit(); this._left = 0; return this._begin(name, 'manual', true);
  };
  ConversationState.prototype.tick = function (dt) {
    this.time += dt;
    if (this.state === 'TRANSITION') { this._left -= dt; if (this._left <= 0) this._commit(); return; }
    if (this.state === 'INTERRUPTED' && this._hold > 0) { this._hold -= dt; if (this._hold <= 0) this.dispatch('settled'); }
  };
  ConversationState.prototype.reset = function () { this.state = 'IDLE'; this.target = 'IDLE'; this.previous = null; this._left = 0; this._hold = 0; this.history = []; this._emit('enter', { state: 'IDLE', time: this.time }); };

  WA.ConversationState = ConversationState;
})(typeof window !== 'undefined' ? window : globalThis);
