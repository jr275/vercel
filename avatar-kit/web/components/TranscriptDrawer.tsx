'use client';
import { useEffect, useRef } from 'react';
import type { Line } from '@/hooks/useConversation';

/** The conversation as plain lines, not bubbles. Hidden by default. */
export function TranscriptDrawer({ open, lines, onClose }: { open: boolean; lines: Line[]; onClose: () => void }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: 'end' });
  }, [open, lines.length]);
  return (
    <aside className={`drawer${open ? ' is-open' : ''}`} aria-label="Transcript" aria-hidden={!open} inert={!open}>
      <header>
        <h2>Transcript</h2>
        <button type="button" className="icon" onClick={onClose} aria-label="Close transcript">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <div className="lines">
        {lines.length === 0 ? <p className="empty">Nothing said yet.</p> : null}
        {lines.map(l => (
          <p key={l.id} className={`line ${l.role}`}>
            <span className="who">{l.role === 'you' ? 'You' : 'Advisor'}</span>
            {l.text}
          </p>
        ))}
        <div ref={end} />
      </div>
    </aside>
  );
}
