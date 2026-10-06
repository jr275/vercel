// CONVERSATION RUNTIME: turn-taking between the user and Vera.
//   input (speech or text) -> brain -> voice.   It does not know the avatar or the model.
// State (conversation, not cognition):  READY | LISTENING | THINKING | SPEAKING | INTERRUPTED
//   barge-in while SPEAKING  -> voice stopped, spoken portion recorded, turn aborted -> INTERRUPTED
//   barge-in while THINKING  -> brain call aborted                                  -> INTERRUPTED
//   final transcript         -> THINKING -> SPEAKING -> READY
//   interruption with no follow-up (silence/cough) -> recovered to READY
import { createEmitter, isAbort, sleep } from './util.mjs';

export const CONVERSATION_STATES = ['READY', 'LISTENING', 'THINKING', 'SPEAKING', 'INTERRUPTED'];

/**
 * @param {{ brain: { respond(text:string,o:{signal:AbortSignal}):Promise<any>, announce?(n:any):any, noteInterrupted?(s:string):void },
 *           voice: { speak(text:string,o:{signal:AbortSignal}):Promise<{completed:boolean,spoken:string}>, stop():string },
 *           input?: any, minThinkMs?: number }} deps
 */
export function createConversation({ brain, voice, input = null, minThinkMs = 0 }) {
  const bus = createEmitter();
  let state = 'READY';
  let turn = 0;
  let ctl = null;
  let gotFinal = false;
  let interruptedAt = null;
  const queue = []; // proactive alerts waiting for a quiet moment
  const transcript = [];

  const set = s => {
    if (s === state) return;
    const from = state;
    state = s;
    bus.emit('state', { state: s, from });
    if (s === 'READY') flush();
  };
  const log = (role, text, extra = {}) => {
    const row = { role, text, ...extra };
    transcript.push(row);
    bus.emit('line', row);
    return row;
  };

  /** Stop whatever Vera is doing because the user took the floor. */
  function bargeIn() {
    const was = state;
    if (was !== 'SPEAKING' && was !== 'THINKING') return false;
    turn++; // invalidate the running turn
    const spoken = voice.stop?.() ?? '';
    ctl?.abort();
    if (was === 'SPEAKING') brain.noteInterrupted?.(spoken);
    interruptedAt = { was, spoken };
    bus.emit('interrupted', { was, spoken });
    set('INTERRUPTED');
    return true;
  }

  async function runTurn(text) {
    const my = ++turn;
    ctl = new AbortController();
    const { signal } = ctl;
    set('THINKING');
    let reply;
    try {
      const t0 = Date.now();
      reply = await brain.respond(text, { signal });
      if (minThinkMs > Date.now() - t0) await sleep(minThinkMs - (Date.now() - t0), signal); // a beat of thought, never an instant reply
    } catch (e) {
      if (isAbort(e) || my !== turn) return bus.emit('cancelled', { text });
      bus.emit('error', { stage: 'brain', error: e });
      set('READY');
      return;
    }
    if (my !== turn) return bus.emit('cancelled', { text });
    log('vera', reply.text, { intent: reply.intent, toolCalls: reply.toolCalls, pending: reply.pending });
    bus.emit('reply', reply);
    await speak(reply.text, my, signal);
  }

  async function speak(text, my, signal) {
    set('SPEAKING');
    try {
      const r = await voice.speak(text, { signal });
      if (my !== turn) return; // interrupted: bargeIn already moved the state
      bus.emit('spoken', r);
      set('READY');
    } catch (e) {
      if (my !== turn) return;
      bus.emit('error', { stage: 'voice', error: e });
      set('READY'); // recovery: the text reply is already in the transcript
    }
  }

  function flush() {
    if (state !== 'READY' || !queue.length) return;
    const n = queue.shift();
    const a = brain.announce(n);
    const my = ++turn;
    ctl = new AbortController();
    log('vera', a.text, { proactive: true, notification: n.id });
    bus.emit('alert', a);
    void speak(a.text, my, ctl.signal);
  }

  const api = {
    get state() {
      return state;
    },
    transcript,
    on: bus.on,
    /** User typed (or an external STT produced) a complete message. */
    submit(text) {
      const t = String(text ?? '').trim();
      if (!t) return Promise.resolve();
      if (state === 'SPEAKING' || state === 'THINKING') bargeIn();
      gotFinal = true;
      interruptedAt = null;
      log('you', t);
      return runTurn(t);
    },
    /** A proactive alert wants the floor. It waits if the user or Vera is mid-turn. */
    alert(notification) {
      queue.push(notification);
      flush();
    },
    interrupt: bargeIn,
    /** The user took the floor (push-to-talk press, or the recogniser heard speech). */
    listen() {
      gotFinal = false;
      if (!bargeIn() && state === 'READY') set('LISTENING');
    },
    pendingAlerts: () => queue.length,
    async startListening() {
      if (!input) return false;
      return input.start();
    },
    stopListening() {
      input?.stop();
    },
  };

  if (input) {
    input.on('speechstart', () => api.listen());
    input.on('partial', ({ text }) => bus.emit('partial', { text }));
    input.on('final', ({ text }) => {
      bus.emit('final', { text });
      void api.submit(text);
    });
    input.on('end', () => {
      // user stopped without a usable transcript: recover instead of staying stuck listening
      if ((state === 'LISTENING' || state === 'INTERRUPTED') && !gotFinal) {
        bus.emit('recovered', { from: state, interrupted: interruptedAt });
        set('READY');
      }
    });
    input.on('error', e => {
      bus.emit('input_error', e);
      if (state === 'LISTENING' || state === 'INTERRUPTED') set('READY');
    });
  }
  return api;
}
