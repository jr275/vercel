'use client';

export type Voice = 'auto' | 'browser' | 'synthetic';
export type Framing = 'CLOSE' | 'MEDIUM_CLOSE' | 'MEDIUM';

type Props = {
  open: boolean;
  voice: Voice;
  framing: Framing;
  captions: boolean;
  onVoice: (v: Voice) => void;
  onFraming: (f: Framing) => void;
  onCaptions: (on: boolean) => void;
};

export function SettingsPopover({ open, voice, framing, captions, onVoice, onFraming, onCaptions }: Props) {
  return (
    <div className={`pop${open ? ' is-open' : ''}`} role="group" aria-label="Settings" aria-hidden={!open} inert={!open}>
      <label>
        <span>Voice</span>
        <select value={voice} onChange={e => onVoice(e.target.value as Voice)}>
          <option value="auto">Automatic</option>
          <option value="browser">This device</option>
          <option value="synthetic">Synthetic</option>
        </select>
      </label>
      <label>
        <span>Framing</span>
        <select value={framing} onChange={e => onFraming(e.target.value as Framing)}>
          <option value="CLOSE">Close</option>
          <option value="MEDIUM_CLOSE">Medium close</option>
          <option value="MEDIUM">Medium</option>
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={captions} onChange={e => onCaptions(e.target.checked)} />
        <span>Captions</span>
      </label>
    </div>
  );
}
