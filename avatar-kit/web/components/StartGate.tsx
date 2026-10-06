type Props = { ready: boolean; failed: string | null; onBegin: () => void };

/** Browsers block audio until the first click, so the first thing the user does is press one button. */
export function StartGate({ ready, failed, onBegin }: Props) {
  return (
    <div className="gate" role="dialog" aria-modal="true" aria-label="Start">
      <button type="button" className="gate-btn" onClick={onBegin} disabled={!ready}>
        {failed ? 'Could not load' : ready ? 'Press to begin' : 'Loading'}
      </button>
      {failed ? <p className="gate-note">{failed}</p> : null}
    </div>
  );
}
