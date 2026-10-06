'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ExecutiveAvatar } from '@/components/avatar/ExecutiveAvatar';
import type { AvatarRuntime, ExecutiveAvatarHandle } from '@/components/avatar/ExecutiveAvatar';
import { ControlBar } from '@/components/ControlBar';
import { SettingsPopover, type Framing, type Voice } from '@/components/SettingsPopover';
import { StartGate } from '@/components/StartGate';
import { StateTag } from '@/components/StateTag';
import { TranscriptDrawer } from '@/components/TranscriptDrawer';
import { useConversation } from '@/hooks/useConversation';

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);

export default function Page() {
  const avatar = useRef<ExecutiveAvatarHandle>(null);
  const getRuntime = useCallback((): AvatarRuntime | null => avatar.current?.runtime ?? null, []);
  const convo = useConversation(getRuntime);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [presence, setPresence] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [settings, setSettings] = useState(false);
  const [voice, setVoice] = useState<Voice>('auto');
  const [framing, setFraming] = useState<Framing>('MEDIUM_CLOSE');
  const [captions, setCaptions] = useState(false);
  const [phone] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches);
  const quality = phone ? 'low' : 'medium';

  const begin = () => {
    setStarted(true);
    void getRuntime()?.runPresenceTest();
  };

  const changeVoice = (v: Voice) => {
    setVoice(v);
    getRuntime()?.setSpeechProvider(v);
  };
  const changeFraming = (f: Framing) => {
    setFraming(f);
    getRuntime()?.setShot(f, { style: f === 'CLOSE' ? 'intimate' : 'executive' });
  };
  const changeCaptions = (on: boolean) => {
    setCaptions(on);
    convo.setCaptions(on);
  };

  // keyboard: hold Space to talk, T transcript, P presence, Esc leaves presence or closes panels
  const held = useRef(false);
  const { talkStart, talkEnd } = convo;
  useEffect(() => {
    if (!started) return;
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPresence(false);
        setDrawer(false);
        setSettings(false);
        return;
      }
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ' ' && !e.repeat && !held.current) {
        e.preventDefault();
        held.current = true;
        talkStart();
      } else if (e.key.toLowerCase() === 't' && !e.repeat) setDrawer(d => !d);
      else if (e.key.toLowerCase() === 'p' && !e.repeat) setPresence(p => !p);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ' && held.current) {
        held.current = false;
        talkEnd();
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [started, talkStart, talkEnd]);

  const busy = convo.ui === 'Thinking' || convo.ui === 'Speaking';

  return (
    <main className={`app${presence ? ' is-presence' : ''}`}>
      <div className="stage">
        <ExecutiveAvatar
          ref={avatar}
          quality={quality}
          cameraStyle={phone ? 'intimate' : 'executive'}
          shot="MEDIUM_CLOSE"
          speech="auto"
          basePath="/avatar-kit"
          onReady={rt => {
            setReady(true);
            // ?debug exposes the runtime to the console and to the end-to-end test
            if (new URLSearchParams(window.location.search).has('debug')) (window as unknown as { __runtime: AvatarRuntime }).__runtime = rt;
          }}
          onState={e => convo.onState(e.state)}
          onWarning={w => console.warn(w.code, w.message)}
          onError={e => {
            if (!ready) setFailed(e.message || 'The character could not load.');
            else convo.setError('I could not speak. Try again.');
          }}
        />
      </div>

      {started ? (
        <>
          <div className="chrome">
            <StateTag state={convo.ui} />
            <div className="tools">
              <button type="button" className="icon" aria-label="Transcript (T)" aria-expanded={drawer} onClick={() => setDrawer(d => !d)}>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M5 7h14M5 12h14M5 17h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
              <button type="button" className="icon" aria-label="Settings" aria-expanded={settings} onClick={() => setSettings(s => !s)}>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M4 8h9m4 0h3M4 16h3m4 0h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  <circle cx="15" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <circle cx="9" cy="16" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
              <button type="button" className="icon" aria-label="Presence mode (P)" onClick={() => setPresence(true)}>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
              <SettingsPopover
                open={settings}
                voice={voice}
                framing={framing}
                captions={captions}
                onVoice={changeVoice}
                onFraming={changeFraming}
                onCaptions={changeCaptions}
              />
            </div>
          </div>

          <div className="bottom">
            <p className={`captions${convo.caption ? ' on' : ''}`} aria-live="off">
              {convo.caption}
            </p>
            <ControlBar
              busy={busy}
              talking={convo.talking}
              error={convo.error}
              onSend={convo.send}
              onTalkStart={convo.talkStart}
              onTalkEnd={convo.talkEnd}
              onRetry={convo.retry}
            />
          </div>

          <TranscriptDrawer open={drawer} lines={convo.lines} onClose={() => setDrawer(false)} />

          {presence ? (
            <button type="button" className="exit-presence" aria-label="Leave presence mode" onClick={() => setPresence(false)} />
          ) : null}
        </>
      ) : (
        <StartGate ready={ready} failed={failed} onBegin={begin} />
      )}
    </main>
  );
}
