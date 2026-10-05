# Executive avatar: drop-in package

A rigged GLB character that listens, thinks, speaks and reacts, behind one runtime contract. The application never touches the character: replace the GLB and nothing else changes.

## Use it in Next.js (or anything React)

1. Copy this folder to `public/avatar-kit/` (it holds `avatar-kit.js` and `vendor/`: three.js r147, GLTFLoader, the meshopt decoder and the Basis transcoder for KTX2 textures).
2. Copy `ExecutiveAvatar.tsx` and `loadAvatarKit.ts` into your components.
3. Render it (client component):

```tsx
'use client';
import { useRef } from 'react';
import { ExecutiveAvatar, type ExecutiveAvatarHandle } from './ExecutiveAvatar';

export default function Page() {
  const avatar = useRef<ExecutiveAvatarHandle>(null);
  return (
    <div style={{ height: '100vh' }}>
      <ExecutiveAvatar
        ref={avatar}
        // assetUrl="/avatar/vera.glb"  assetRole="PRODUCTION"   <- the production swap
        onReady={rt => rt.runDemo()}
      />
    </div>
  );
}
```

`avatar.current?.speak('...')`, `setExpression('skeptical')`, `setShot('CLOSE')`, `setState('LISTENING')`, or use `avatar.current.runtime` for the full contract (`docs/AVATAR_RUNTIME_CONTRACT.md`). Props: `assetUrl`, `assetRole`, `profile`, `shot`, `cameraStyle`, `quality`, `speech`, `basePath`, `onReady`, `onState`, `onWarning`, `onError`.

## Use it in plain HTML

`example.html`. Serve over http, not `file://` (KTX2 and GLB loading need it).

## Notes

- Without `assetUrl` you get the built-in character, labelled `DEVELOPMENT_PLACEHOLDER`. It is not the production character.
- Speech: `auto` uses the browser's voices when it has them, otherwise an offline synthetic voice (robotic). A real TTS plugs in behind `SpeechProvider`.
- The component needs a browser with WebGL. Browsers block audio until the first click or tap.
- Regenerate this folder with `node tools/pack-embed.js` (from the `avatar-kit/` root).
- Type-checked with `strict: true` against React 18 types, and mounted and driven in Chromium (speech, expressions, shot changes, remount).
