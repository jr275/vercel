'use client';
import { useState } from 'react';

type Props = {
  busy: boolean;
  talking: boolean;
  error: string | null;
  onSend: (text: string) => void;
  onTalkStart: () => void;
  onTalkEnd: () => void;
  onRetry: () => void;
};

/** One quiet bar: hold to talk, type, send. Not a card. It dims while she thinks or speaks. */
export function ControlBar({ busy, talking, error, onSend, onTalkStart, onTalkEnd, onRetry }: Props) {
  const [text, setText] = useState('');
  const submit = () => {
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };
  return (
    <div className="bar-wrap">
      {error ? (
        <p className="bar-error" role="alert">
          {error}{' '}
          <button type="button" className="link" onClick={onRetry}>
            Retry
          </button>
        </p>
      ) : null}
      <form
        className={`bar${busy ? ' is-busy' : ''}`}
        onSubmit={e => {
          e.preventDefault();
          submit();
        }}
      >
        <button
          type="button"
          className={`talk${talking ? ' is-held' : ''}`}
          aria-label="Hold to talk"
          aria-pressed={talking}
          onPointerDown={e => {
            e.currentTarget.setPointerCapture(e.pointerId);
            onTalkStart();
          }}
          onPointerUp={onTalkEnd}
          onPointerCancel={onTalkEnd}
          onContextMenu={e => e.preventDefault()}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect x="9" y="3" width="6" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <label className="sr-only" htmlFor="message">
          Message
        </label>
        <input
          id="message"
          className="field"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Say it the way you would to a colleague"
          autoComplete="off"
          enterKeyHint="send"
        />
        <button type="submit" className="send" disabled={!text.trim()}>
          Send
        </button>
      </form>
      <p className="hint" aria-hidden="true">
        Hold Space to talk
      </p>
    </div>
  );
}
