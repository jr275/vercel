'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AvatarRuntime, ConversationState } from '@/components/avatar/ExecutiveAvatar';

export type Line = { id: number; role: 'you' | 'her'; text: string };
export type UiState = 'Ready' | 'Listening' | 'Thinking' | 'Speaking';

// Canned replies. No backend: replace `reply()` with a call to a real model and keep the rest.
const REPLIES = [
  'Understood. Before anything else, tell me what has to be true for this to be a good outcome.',
  'I hear the concern. The question is what you are not saying about it.',
  "Let's look at the decision itself, not the pressure around it.",
  'That is the story. Now tell me what actually happened.',
  'You already know the answer. What is stopping you from acting on it?',
  'Slow down. Which part of this is a fact, and which part is a fear?',
];

const LABEL: Record<ConversationState, UiState> = {
  IDLE: 'Ready',
  LISTENING: 'Listening',
  THINKING: 'Thinking',
  SPEAKING: 'Speaking',
  INTERRUPTED: 'Listening',
  TRANSITION: 'Ready',
  ERROR: 'Ready',
};

/**
 * Owns the conversation: the transcript, the state shown to the user, and the order of events
 * (user speaks, she thinks, she answers, the user may interrupt). The 3D character is driven only through the runtime contract.
 */
export function useConversation(getRuntime: () => AvatarRuntime | null) {
  const [lines, setLines] = useState<Line[]>([]);
  const [ui, setUi] = useState<UiState>('Ready');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [talking, setTalking] = useState(false);
  const turn = useRef(0);
  const next = useRef(0);
  const last = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captionsOn = useRef(false);

  const add = useCallback((role: Line['role'], text: string) => setLines(l => [...l, { id: next.current++, role, text }]), []);
  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const onState = useCallback((s: ConversationState) => setUi(LABEL[s] ?? 'Ready'), []);

  const respond = useCallback(
    (spoken: boolean) => {
      const rt = getRuntime();
      if (!rt) return;
      const my = ++turn.current;
      const reply = REPLIES[(next.current + (spoken ? 1 : 0)) % REPLIES.length];
      clearTimer();
      timer.current = setTimeout(async () => {
        if (my !== turn.current) return;
        add('her', reply);
        if (captionsOn.current) setCaption(reply);
        last.current = reply;
        const res = await rt.speak(reply);
        if (my !== turn.current) return;
        setCaption('');
        if (!res.ok && res.reason === 'error') setError('I could not speak. Try again.');
      }, 1100 + Math.random() * 900);
    },
    [add, getRuntime]
  );

  /** Typed message. If she is speaking, the user interrupts her first. */
  const send = useCallback(
    (text: string) => {
      const t = text.trim();
      const rt = getRuntime();
      if (!t || !rt) return;
      setError(null);
      setCaption('');
      add('you', t);
      rt.userStartedSpeaking();
      rt.userStoppedSpeaking();
      respond(false);
    },
    [add, getRuntime, respond]
  );

  /** Push to talk: no microphone yet, only the state. Holding listens, releasing starts the reply. */
  const talkStart = useCallback(() => {
    const rt = getRuntime();
    if (!rt) return;
    turn.current++;
    clearTimer();
    setError(null);
    setCaption('');
    setTalking(true);
    rt.userStartedSpeaking();
  }, [getRuntime]);

  const talkEnd = useCallback(() => {
    const rt = getRuntime();
    setTalking(false);
    if (!rt) return;
    add('you', 'Spoken message');
    rt.userStoppedSpeaking();
    respond(true);
  }, [add, getRuntime, respond]);

  const retry = useCallback(() => {
    const rt = getRuntime();
    setError(null);
    if (rt && last.current) void rt.speak(last.current);
  }, [getRuntime]);

  const setCaptions = useCallback((on: boolean) => {
    captionsOn.current = on;
    if (!on) setCaption('');
  }, []);

  useEffect(() => () => clearTimer(), []);

  return { lines, ui, caption, error, talking, send, talkStart, talkEnd, retry, onState, setCaptions, setError };
}
