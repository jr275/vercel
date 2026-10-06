'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AvatarRuntime, ConversationState } from '@/components/avatar/ExecutiveAvatar';
import { createConversation } from '@/lib/vera/conversation.mjs';
import { createRemoteBrain, remoteAlert } from '@/lib/vera/remote.mjs';
import { BrowserSpeechInput, FakeSpeechInput } from '@/lib/vera/speech-input.mjs';
import { RuntimeVoice } from '@/lib/vera/voice.mjs';

export type Line = { id: number; role: 'you' | 'her'; text: string };
export type UiState = 'Ready' | 'Listening' | 'Thinking' | 'Speaking';

const LABEL: Record<string, UiState> = { READY: 'Ready', LISTENING: 'Listening', INTERRUPTED: 'Listening', THINKING: 'Thinking', SPEAKING: 'Speaking' };
const MIC_MESSAGE: Record<string, string> = {
  permission_denied: 'Microphone access was blocked. You can type instead.',
  unsupported: 'Speech recognition is not available in this browser. You can type instead.',
  network: 'Speech recognition lost its connection. Try again, or type.',
  no_speech: 'I did not hear anything. Try again.',
};

/**
 * Wires the layers together for the browser:
 *   mic/text -> Conversation runtime -> remote Executive Brain (/api/vera) -> Voice -> Avatar runtime.
 * The hook holds only UI state. The turn-taking logic lives in lib/vera/conversation.mjs.
 */
export function useConversation(getRuntime: () => AvatarRuntime | null) {
  const [lines, setLines] = useState<Line[]>([]);
  const [ui, setUi] = useState<UiState>('Ready');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [talking, setTalking] = useState(false);
  const next = useRef(0);
  const captionsOn = useRef(false);
  const lastReply = useRef('');
  const parts = useRef<{ convo: any; input: any; voice: any; fake: boolean } | null>(null);

  if (!parts.current && typeof window !== 'undefined') {
    const fake = new URLSearchParams(window.location.search).has('fakemic');
    const input: any = fake ? new FakeSpeechInput() : new BrowserSpeechInput();
    const voice: any = new RuntimeVoice(getRuntime);
    const convo: any = createConversation({ brain: createRemoteBrain(), voice, input, minThinkMs: 700 });
    parts.current = { convo, input, voice, fake };
  }

  useEffect(() => {
    const p = parts.current;
    if (!p) return;
    const { convo, input, fake } = p;
    const rt = () => getRuntime();
    const offs = [
      convo.on('state', ({ state, from }: { state: string; from: string }) => {
        setUi(LABEL[state] ?? 'Ready');
        const r = rt();
        if (!r) return;
        if (state === 'LISTENING' || state === 'INTERRUPTED') r.userStartedSpeaking();
        else if (state === 'THINKING') {
          if (r.getState() !== 'LISTENING' && r.getState() !== 'INTERRUPTED') r.userStartedSpeaking();
          r.userStoppedSpeaking();
        } else if (state === 'READY' && (from === 'LISTENING' || from === 'INTERRUPTED' || from === 'THINKING')) r.setState('IDLE');
      }),
      convo.on('line', (l: { role: string; text: string }) => setLines(ls => [...ls, { id: next.current++, role: l.role === 'you' ? 'you' : 'her', text: l.text }])),
      convo.on('reply', (r: { text: string }) => {
        lastReply.current = r.text;
        if (captionsOn.current) setCaption(r.text);
      }),
      convo.on('alert', (a: { text: string }) => {
        lastReply.current = a.text;
        if (captionsOn.current) setCaption(a.text);
      }),
      convo.on('spoken', () => setCaption('')),
      convo.on('interrupted', () => setCaption('')),
      convo.on('error', (e: { stage: string }) => setError(e.stage === 'voice' ? 'I could not speak. Try again.' : 'I could not reach my assistant brain. Try again.')),
      convo.on('input_error', (e: { code: string; message: string }) => {
        setTalking(false);
        setError(MIC_MESSAGE[e.code] ?? e.message);
      }),
    ];
    if (new URLSearchParams(window.location.search).has('debug') || fake) {
      (window as any).__vera = {
        convo,
        input,
        /** Deliver a proactive alert that the server produced (used by the e2e and the review tools). */
        alert: (a: { text: string }) => convo.alert(remoteAlert(a)),
      };
    }
    return () => offs.forEach((f: () => void) => f());
  }, [getRuntime]);

  /** Typed message. If she is speaking, the user interrupts her first. */
  const send = useCallback((text: string) => {
    setError(null);
    setCaption('');
    void parts.current?.convo.submit(text);
  }, []);

  /** Push to talk: the speech recogniser listens while held. */
  const talkStart = useCallback(() => {
    const p = parts.current;
    if (!p) return;
    setError(null);
    setCaption('');
    setTalking(true);
    p.convo.listen();
    void p.input.start().then(() => p.fake && p.input.say());
  }, []);

  const talkEnd = useCallback(() => {
    const p = parts.current;
    setTalking(false);
    if (!p) return;
    if (p.fake) {
      // deterministic stand-in for speech: the e2e sets window.__fakemicText
      p.input.final((window as any).__fakemicText ?? 'What is on my calendar');
      p.input.stop();
    } else p.input.stop();
  }, []);

  const retry = useCallback(() => {
    setError(null);
    const p = parts.current;
    if (p && lastReply.current) void p.voice.speak(lastReply.current).catch(() => setError('I could not speak. Try again.'));
  }, []);

  const setCaptions = useCallback((on: boolean) => {
    captionsOn.current = on;
    if (!on) setCaption('');
  }, []);

  // The avatar runtime still reports its own state; the tag follows the conversation instead.
  const onState = useCallback((_s: ConversationState) => {}, []);

  return { lines, ui, caption, error, talking, send, talkStart, talkEnd, retry, onState, setCaptions, setError };
}
