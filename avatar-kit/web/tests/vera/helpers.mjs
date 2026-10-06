import { createVera } from '../../lib/vera/create.mjs';
import { seedProviders, CARLOS_EMAIL, NOW } from '../../lib/vera/scenario.mjs';
import { FakeSpeechInput } from '../../lib/vera/speech-input.mjs';
import { FakeVoice } from '../../lib/vera/voice.mjs';
import { createConversation } from '../../lib/vera/conversation.mjs';

export { NOW, CARLOS_EMAIL };
export const world = (opts = {}) => createVera({ providers: seedProviders({ carlosEmail: false }), ...opts });
export const morning = () => createVera({ providers: seedProviders({ carlosEmail: true }) });
export function talk(opts = {}) {
  const v = world(opts);
  const input = new FakeSpeechInput();
  const voice = new FakeVoice({ auto: !!opts.auto });
  const convo = createConversation({ brain: v.brain, voice, input });
  const states = [];
  const events = [];
  convo.on('state', s => states.push(s.state));
  for (const e of ['interrupted', 'cancelled', 'recovered', 'alert', 'reply', 'input_error', 'error']) convo.on(e, d => events.push([e, d]));
  return { v, input, voice, convo, states, events };
}
/** Let queued microtasks/promises settle. */
export const tick = (n = 8) => new Promise(r => { let i = 0; const f = () => (++i >= n ? r() : setImmediate(f)); setImmediate(f); });
/** Release voice segments until the voice has finished. */
export async function drain(t) {
  for (let i = 0; i < 60 && (t.voice.speaking || t.convo.state === 'THINKING'); i++) {
    t.voice.release();
    await tick(2);
  }
}
