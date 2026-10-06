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
  ['email_send', /\b(mande|envie|escreva|redija|responda)\b.*\b(email|e-mail|mensagem)\b|\b(send|draft|write|compose|reply)\b.*\b(email|mail|message|reply)\b|\b(email|message)\b\s+\w+\s+(saying|that|to say)\b/i],
  ['email', /\b(email|emails|inbox|mail|unanswered|unread)\b/i],
  ['reminder', /\bremind me\b/i],
  ['followup', /\b(follow[- ]?ups?|owe|pending|commitments?|unresolved|open items?)\b/i],
  ['calendar', /\b(calendar|schedule|agenda|meetings?|conflicts?|birthdays?|what'?s on)\b/i],
  ['news', /\b(news|market|competitors?)\b/i],
  ['decision', /\b(decision|decide|pricing|should we)\b/i],
  ['recall', /\b(recall|do you remember|what did|what does|what do you know|who is|tell me about|when is|when was|prefer)\b/i],
  ['greeting', /^\s*(hi|hello|hey|good (morning|afternoon|evening))\b/i],
];

// ---- confirmation grammar ---------------------------------------------------------------------------------
// A confirmation must be the WHOLE utterance. Anything with extra content (a question, a negation, a change,
// a hedge) is NOT a confirmation. No prefix matching.
const POLITE = '(?:[,.!\\s]+(?:please|thanks|thank you|go ahead|send it|do it|por favor|obrigado))*';
const YES_RE = new RegExp('^(?:yes|yeah|yep|yup|sure|ok|okay|confirm|confirmed|go ahead|do it|send it|please do|sim|pode enviar|pode)' + POLITE + '[.!\\s]*$', 'i');
const NO_WORD = "(?:no|nope|cancel(?: it)?|don'?t send(?: it)?|do not send(?: it)?|don'?t|do not|hold off|never mind|nevermind|stop|n[aã]o)";
const NO_RE = new RegExp('^' + NO_WORD + '(?:[,.!\\s]+(?:' + NO_WORD + '|please|thanks|thank you|por favor))*[.!\\s]*$', 'i');
// starts like an answer to the question, but is not a plain yes/no: needs clarification, never action
const HEDGE_RE = /^(?:yes|yeah|yep|yup|sure|ok|okay|sim|pode|no|nope|n[aã]o|actually|wait|hold on|hang on|but|however|although|well|hmm)\b/i;

/** @returns {'confirm'|'decline'|'ambiguous'|'other'} how an utterance relates to a pending yes/no question */
export function parseConfirmation(text) {
  const t = String(text ?? '').trim().replace(/\s+/g, ' ');
  if (!t) return 'other';
  if (YES_RE.test(t)) return 'confirm';
  if (NO_RE.test(t)) return 'decline';
  if (HEDGE_RE.test(t)) return 'ambiguous';
  return 'other';
}

export function classifyIntent(text, { memory, pending } = {}) {
  const t = String(text ?? '').trim();
  const entities = { people: memory ? memory.peopleIn(t).map(p => p.name) : [], projects: memory ? memory.projectsIn(t).map(p => p.name) : [] };
  const c = parseConfirmation(t);
  if (pending?.confirmation) {
    if (c === 'confirm') return { intent: 'confirm', entities };
    if (c === 'decline') return { intent: 'decline', entities };
    if (c === 'ambiguous') return { intent: 'confirm_ambiguous', entities };
  }
  if (pending?.offer) {
    if (c === 'confirm') return { intent: 'accept_offer', entities };
    if (c === 'decline') return { intent: 'decline_offer', entities };
  }
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
