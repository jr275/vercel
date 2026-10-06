// MODEL CLAIM != SYSTEM REALITY. Detects what the model SAYS happened and compares it with what the system
// recorded. A claim the system cannot back is never allowed to stand.
const word = /(\d+(?:[.,:]\d+)*%?|\b[A-Z][a-z]+(?: [A-Z][a-z]+)*\b)/g;

export const SENT_CLAIM = /\b(i(?:'ve| have)?\s+(?:just\s+)?sent|(?:email|message)\s+(?:was |has been |is )?sent|sent (?:the|your|an|that) (?:email|message)|it(?:'s| is| has been) sent|(?:has|have) been sent|enviei|mandei)\b/i;
export const CONFIRM_CLAIM = /\b(you(?:'ve| have) confirmed|confirmed (?:the|your)|i(?:'ve| have) confirmed)\b/i;
export const RECURRENCE_CLAIM = /\b(every day|each day|daily)\b/i;
export const MEMORY_CLAIM = /\b(i(?:'ve| have)?\s+(?:remembered|saved|stored|noted|made a note)|i(?:'ll| will) remember|(?:saved|stored) (?:that|this|it) (?:to|in) (?:my )?memory|guardei|anotei)\b/i;
export const REMIND_CLAIM = /\b(i(?:'ll| will)\s+remind you|i(?:'ve| have)\s+set (?:a|the) reminder|reminder (?:is|has been) set|vou te lembrar)\b/i;

/** True when the text asserts that something WAS sent (negated statements such as "nothing has been sent" do not count). */
export const claimsSent = t => SENT_CLAIM.test(String(t ?? '').replace(/\b(?:nothing|not|never|no (?:email|message)|n't)\b[^.!?]{0,40}\bsent\b/gi, ' '));

/** Heuristic only: capitalised names / numbers in a text that appear in neither the corpus nor the prompt. A HUMAN classifies them. */
export function unsupportedCandidates(finalText, corpus) {
  const hay = String(corpus).toLowerCase();
  const out = new Set();
  for (const m of String(finalText ?? '').matchAll(word)) if (!hay.includes(m[0].toLowerCase())) out.add(m[0]);
  return [...out].filter(w => !/^(I|The|This|You|Your|Here|Carlos|Project|Good|Shall|Would|There|It|And|But|Let|Please|Yes|No|Done)$/.test(w));
}

/**
 * @param text   what the model said
 * @param facts  what the system actually did this turn: { sent, memoryWritten }
 * @returns { flags, text } — `text` has a plain correction appended for every unbacked claim
 */
export function auditClaims(text, facts, { pendingDraft = false } = {}) {
  const flags = [], fixes = [];
  const t = String(text ?? '');
  if (claimsSent(t) && !facts.sent) {
    flags.push('sent_claim_unbacked');
    fixes.push(pendingDraft ? 'Correction: nothing has been sent. The draft is waiting for your confirmation.' : 'Correction: nothing has been sent.');
  }
  if (MEMORY_CLAIM.test(t) && !facts.memoryWritten) {
    flags.push('memory_claim_unbacked');
    fixes.push('Correction: I did not store that.');
  }
  if (REMIND_CLAIM.test(t)) {
    flags.push('reminder_claim_unbacked');
    fixes.push('Correction: I cannot schedule reminders yet, so nothing was scheduled.');
  }
  if (CONFIRM_CLAIM.test(t) && !facts.confirmed) {
    flags.push('confirmation_claim_unbacked');
    fixes.push('Correction: nothing has been confirmed.');
  }
  return { flags, text: fixes.length ? `${t.trim()} ${fixes.join(' ')}` : t };
}
