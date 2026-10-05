# Avatar Runtime Contract

```
TEMPORARY_ASSET  ->  AVATAR_RUNTIME_CONTRACT  ->  PRODUCTION_VERA_ASSET
```

The application depends on the runtime object returned by `AvatarKit.createExecutiveAvatar(container, options)` (`src/runtime/ExecutiveAvatar.js`). It never touches a mesh, a morph target, a bone or a file name. Replace the asset and nothing in the application changes.

## Open it

`dist/executive-avatar.html` (CDN build) or `dist/executive-avatar.local.html` (vendor files next to it; serve the kit folder over http). Built by `node tools/build.js`. Query: `?glb=<url>&role=PRODUCTION` loads a GLB, `?speech=synthetic|browser|auto`, `?dev=0` hides the panel.

## The interface

| Group | Calls |
|---|---|
| Conversation | `setState(name)`, `getState()`, `userStartedSpeaking()`, `userStoppedSpeaking()`, `interrupt()`, `stateHistory()` |
| Face | `setExpression(name, {intensity})`, `getExpression()`; names: neutral, warm, focused, skeptical, concerned, confident, surprised, firm |
| Speech | `speak(text)` resolves `{ok, reason?}`; `stopSpeaking()`, `isSpeaking()`, `setSpeechProvider(name or object)` |
| Lips | `setViseme('AA'/'E'/'O'/'M'/'F'/'TH'/'S'/'REST', weight)`, `setLevel(0..1)` |
| Body and eyes | `lookAt('camera'/'left'/'right'/x,y)`, `playAnimation('nod'/'acknowledge'/'lookAway'/'idle')`, `idle({intensity})` |
| Camera | `setShot('CLOSE'/'MEDIUM_CLOSE'/'MEDIUM'/'FULL')` (default MEDIUM_CLOSE), `getShot()` |
| Demo and tools | `runDemo()`, `stopDemo()`, `info()`, `rigInfo()`, `contract()`, `on(event, fn)` |

States: IDLE, LISTENING, THINKING, SPEAKING, INTERRUPTED, TRANSITION, ERROR. Every change passes through TRANSITION (0.2 s); an event with no edge from the current state is refused with an `INVALID_TRANSITION` warning. Events: `state`, `expression`, `speechstart`, `speechend`, `animation`, `warning`, `error`, `ready`.

## Speech pipeline

`Text -> SpeechProvider -> SpeechResult -> playback -> LipSyncController -> avatar`. A provider implements `speak(text, hooks): Promise<SpeechResult>`, `stop()` and `available()`. `SpeechResult` is `{ text, provider, playback: 'engine' | 'provider', audio?, sampleRate?, phonemes, duration }`. A cloud TTS plugs in by returning its audio and its viseme or phoneme events. Provided: `SyntheticSpeechProvider` (offline, robotic) and `BrowserSpeechProvider` (system voices; sound cannot be captured, so the lips follow an estimated timeline). Audio level alone is the fallback and is not treated as final lip sync.

## What an asset must provide

Required: a model that loads (GLB through RigMap, or the built-in character) and a jaw that opens. Expected: 52 ARKit blendshapes, 15 Oculus visemes, eye bones or look-blendshapes, head and neck bones, spine and shoulders. When something is missing the runtime degrades instead of failing: no visemes uses the jaw and mouth shapes from the audio level; no blendshapes uses bones; no eye controls uses the head turn; a missing or broken file falls back to the built-in character with a warning (`ASSET_FALLBACK`).

Textures: PNG, JPEG or **KTX2** (Basis UASTC or ETC1S, `KHR_texture_basisu`). KTX2 loading uses three.js r147's `KTX2Loader` (generated into `src/vendor/KTX2Loader.js` by `tools/make-ktx2-loader.js`) and needs the Basis transcoder files (`basis_transcoder.js` and `.wasm`) reachable over http at `AvatarKit.KTX2_PATH` (or `ktx2Path` in the options); the CDN build points at jsdelivr, the local pages at `vendor/libs/basis/`. A KTX2 texture that fails to load is an error (`KTX2_FAILED`, then the placeholder), never a silently untextured head. Not available under `file://`.

## The swap

```js
createExecutiveAvatar(el, { asset: { url: 'vera-production.glb', role: 'PRODUCTION', rigMap: { preset: 'arkit-visemes' } } })
```

The built-in character is `DEVELOPMENT_PLACEHOLDER`; it is shown with that label and is not the production character.
