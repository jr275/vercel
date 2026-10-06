// EXECUTIVE COGNITIVE STATE — what the assistant is *thinking about*, independent of the conversation
// state machine (LISTENING / THINKING / SPEAKING ...), which is about turn-taking.
//   EXECUTIVE_CONTEXT  who/what the request is about
//   EXECUTIVE_INTENT   what the user wants
//   EXECUTIVE_PRIORITY what matters most right now
//   EXECUTIVE_MEMORY   what was recalled
//   EXECUTIVE_ACTION   what is proposed / pending / done
export const COGNITIVE_STATES = ['EXECUTIVE_CONTEXT', 'EXECUTIVE_INTENT', 'EXECUTIVE_PRIORITY', 'EXECUTIVE_MEMORY', 'EXECUTIVE_ACTION'];

const RULES = [
  ['learn', /^\s*(please\s+)?(remember|note|keep in mind|make a note)(\s+that)?\b|\bfyi\b/i],
  ['briefing', /\b(briefing|brief me|morning|what should i know|what do i need to know|catch me up|bring me up to speed)\b/i],
  ['meeting_prep', /\b(prepare|prep|get me ready|ready for)\b.*\b(meeting|call|sync|catch-?up)\b|\b(meeting|call|sync)\b.*\b(prepare|prep)\b|\bprepare\b.*\bwith\b/i],
  ['email_send', /\b(send|draft|write|compose|reply)\b.*\b(email|mail|message|reply)\b|\b(email|message)\b\s+\w+\s+(saying|that|to say)\b/i],
  ['email', /\b(email|emails|inbox|mail|unanswered|unread)\b/i],
  ['reminder', /\bremind me\b/i],
  ['followup', /\b(follow[- ]?ups?|owe|pending|commitments?|unresolved|open items?)\b/i],
  ['calendar', /\b(calendar|schedule|agenda|meetings?|conflicts?|birthdays?|what'?s on)\b/i],
  ['news', /\b(news|market|competitors?)\b/i],
  ['decision', /\b(decision|decide|pricing|should we)\b/i],
  ['recall', /\b(recall|do you remember|what did|what does|what do you know|who is|tell me about|when is|when was|prefer)\b/i],
  ['greeting', /^\s*(hi|hello|hey|good (morning|afternoon|evening))\b/i],
];

export function classifyIntent(text, { memory, pending } = {}) {
  const t = String(text ?? '').trim();
  const yes = /^\s*(yes|yep|yeah|sure|please do|go ahead|do it|confirm|confirmed|send it|ok(ay)?|sim|pode)\b/i.test(t);
  const no = /^\s*(no|nope|cancel|don'?t|do not|hold off|never mind|stop|não|nao)\b/i.test(t);
  const entities = { people: memory ? memory.peopleIn(t).map(p => p.name) : [], projects: memory ? memory.projectsIn(t).map(p => p.name) : [] };
  if (pending?.confirmation && yes) return { intent: 'confirm', entities };
  if (pending?.confirmation && no) return { intent: 'decline', entities };
  if (pending?.offer && yes) return { intent: 'accept_offer', entities };
  if (pending?.offer && no) return { intent: 'decline_offer', entities };
  for (const [intent, re] of RULES) if (re.test(t)) return { intent, entities };
  return { intent: 'general', entities };
}

export function createCognition({ now = () => Date.now() } = {}) {
  const state = Object.fromEntries(COGNITIVE_STATES.map(k => [k, null]));
  const history = [];
  return {
    state,
    history,
    set(key, value, note) {
      if (!COGNITIVE_STATES.includes(key)) throw new Error(`Unknown cognitive state ${key}`);
      state[key] = value;
      history.push({ at: now(), key, value, note });
    },
    snapshot: () => JSON.parse(JSON.stringify(state)),
    reset() {
      COGNITIVE_STATES.forEach(k => (state[k] = null));
    },
  };
}
