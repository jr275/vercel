'use client';
/**
 * <ExecutiveAvatar />: the executive avatar as a React component (Next.js app router: a client component).
 *
 *   <ExecutiveAvatar ref={ref} assetUrl="/avatar/vera.glb" assetRole="PRODUCTION" style={{ height: '100vh' }} />
 *   await ref.current?.speak('Let\'s separate the problem from the noise.');
 *
 * The component depends only on the runtime contract (docs/AVATAR_RUNTIME_CONTRACT.md), never on the character. Replace the GLB, not the code.
 * Without assetUrl it shows the built-in DEVELOPMENT_PLACEHOLDER character.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { CSSProperties } from 'react';
import { loadAvatarKit } from './loadAvatarKit';

export type ConversationState =
  | 'IDLE'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'INTERRUPTED'
  | 'TRANSITION'
  | 'ERROR';
export type Expression =
  | 'neutral'
  | 'warm'
  | 'focused'
  | 'skeptical'
  | 'concerned'
  | 'confident'
  | 'surprised'
  | 'firm';
export type Shot = 'CLOSE' | 'MEDIUM_CLOSE' | 'MEDIUM' | 'FULL';
export type SpeechResult = { ok: boolean; reason?: string; provider?: string };

/** The runtime contract (see docs/AVATAR_RUNTIME_CONTRACT.md). */
export interface AvatarRuntime {
  ready: Promise<unknown>;
  setState(name: ConversationState): boolean;
  getState(): ConversationState;
  userStartedSpeaking(): boolean;
  userStoppedSpeaking(): boolean;
  interrupt(): boolean;
  setExpression(name: Expression, opts?: { intensity?: number }): boolean;
  speak(text: string): Promise<SpeechResult>;
  stopSpeaking(): void;
  isSpeaking(): boolean;
  lookAt(x: 'camera' | 'left' | 'right' | 'up' | 'down' | number, y?: number): boolean;
  setShot(name: Shot, opts?: { style?: string; duration?: number }): boolean;
  playAnimation(name: 'nod' | 'acknowledge' | 'blink' | 'lookAway' | 'idle'): boolean;
  setViseme(name: 'AA' | 'E' | 'O' | 'M' | 'F' | 'TH' | 'S' | 'REST', weight?: number): boolean;
  idle(opts?: { intensity?: number }): boolean;
  runDemo(text?: string): Promise<{ ok: boolean }>;
  stopDemo(): void;
  runPresenceTest(): Promise<unknown>;
  info(): Record<string, any>;
  contract(): Record<string, any>;
  on(event: string, fn: (data: any) => void): unknown;
  off(event: string, fn: (data: any) => void): void;
  setSpeechProvider(provider: 'auto' | 'browser' | 'synthetic' | object, options?: object): string;
  destroy(): void;
}

export interface ExecutiveAvatarProps {
  /** URL of the character GLB. Omit it for the built-in placeholder. */
  assetUrl?: string;
  /** 'PRODUCTION' | 'VISUAL_PROTOTYPE' | 'DEVELOPMENT_PLACEHOLDER' ...: a label shown in info(). */
  assetRole?: string;
  /** Data about one asset: { rigMap?, materials?, hide? }. Optional. */
  profile?: Record<string, any>;
  shot?: Shot;
  /** Camera and light style. */
  cameraStyle?: 'executive' | 'conversation' | 'intimate';
  quality?: 'low' | 'medium' | 'high';
  speech?: 'auto' | 'browser' | 'synthetic';
  /** Where embed/ was copied to. Default '/avatar-kit'. */
  basePath?: string;
  className?: string;
  /** CSS for the container (it fills its parent by default). */
  style?: CSSProperties;
  onReady?: (runtime: AvatarRuntime) => void;
  onState?: (e: { state: ConversationState; from: ConversationState; event: string }) => void;
  onWarning?: (w: { code: string; message: string }) => void;
  onError?: (e: { code?: string; message: string }) => void;
}

export interface ExecutiveAvatarHandle {
  /** The live runtime, or null until ready. */
  runtime: AvatarRuntime | null;
  speak(text: string): Promise<SpeechResult>;
  stopSpeaking(): void;
  setState(name: ConversationState): boolean;
  setExpression(name: Expression): boolean;
  setShot(name: Shot): boolean;
}

const NOT_READY: SpeechResult = { ok: false, reason: 'not ready' };

export const ExecutiveAvatar = forwardRef<ExecutiveAvatarHandle, ExecutiveAvatarProps>(
  function ExecutiveAvatar(props, ref) {
    const box = useRef<HTMLDivElement>(null);
    const rt = useRef<AvatarRuntime | null>(null);
    const cb = useRef(props);
    cb.current = props;

    useImperativeHandle(
      ref,
      () => ({
        get runtime() {
          return rt.current;
        },
        speak: t => (rt.current ? rt.current.speak(t) : Promise.resolve(NOT_READY)),
        stopSpeaking: () => rt.current?.stopSpeaking(),
        setState: n => rt.current?.setState(n) ?? false,
        setExpression: n => rt.current?.setExpression(n) ?? false,
        setShot: n => rt.current?.setShot(n) ?? false,
      }),
      []
    );

    // the runtime is rebuilt only when the character itself changes
    useEffect(() => {
      let cancelled = false;
      let runtime: AvatarRuntime | null = null;
      (async () => {
        const kit = await loadAvatarKit(props.basePath);
        if (cancelled || !box.current) return;
        const p = cb.current;
        runtime = kit.createExecutiveAvatar(box.current, {
          asset: p.assetUrl
            ? { url: p.assetUrl, role: p.assetRole ?? 'ASSET', profile: p.profile, rigMap: p.profile?.rigMap }
            : undefined,
          shot: p.shot,
          style: p.cameraStyle,
          quality: p.quality,
          speech: p.speech ?? 'auto',
        }) as AvatarRuntime;
        runtime.on('state', e => cb.current.onState?.(e));
        runtime.on('warning', w => cb.current.onWarning?.(w));
        runtime.on('error', e => cb.current.onError?.(e));
        rt.current = runtime;
        await runtime.ready;
        if (!cancelled) cb.current.onReady?.(runtime);
      })().catch(e => cb.current.onError?.({ message: String(e?.message ?? e) }));
      return () => {
        cancelled = true;
        rt.current = null;
        runtime?.destroy();
      };
    }, [props.assetUrl, props.assetRole, props.basePath]);

    return (
      <div
        ref={box}
        className={props.className}
        style={{ position: 'relative', width: '100%', height: '100%', minHeight: 240, ...props.style }}
      />
    );
  }
);

export default ExecutiveAvatar;
