import type { UiState } from '@/hooks/useConversation';

/** The only status the interface shows: a small dot and one word. Announced to screen readers when it changes. */
export function StateTag({ state }: { state: UiState }) {
  return (
    <div className="state-tag" data-state={state.toLowerCase()}>
      <span className="dot" aria-hidden="true" />
      <span>{state}</span>
      <span className="sr-only" role="status" aria-live="polite">
        {`Advisor is ${state.toLowerCase()}`}
      </span>
    </div>
  );
}
