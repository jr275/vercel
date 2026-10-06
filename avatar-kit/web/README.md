# Executive avatar: front end

A Next.js app (App Router, TypeScript, plain CSS) around the executive avatar. The character fills the screen; the interface is one quiet bar, a status word, a hidden transcript and a presence mode that shows only her. Standalone: it is not part of the pnpm workspace.

```sh
npm install
npm run dev        # syncs ../embed into public/avatar-kit and components/avatar, then next dev
npm run build && npm start
npm run e2e        # Playwright check (after build)
```

- **Keys:** hold Space to talk, T transcript, P presence mode, Esc closes.
- **No backend:** replies come from a short canned list in `hooks/useConversation.ts`. Replace `respond()` with a model call; everything else stays.
- **The character:** `components/avatar/` and `public/avatar-kit/` are copied from `../embed` by `scripts/sync-avatar.mjs` (both are gitignored). Without an asset URL you get the built-in `DEVELOPMENT_PLACEHOLDER`. For the production character pass `assetUrl` and `assetRole="PRODUCTION"` to `<ExecutiveAvatar />` in `app/page.tsx`.
- **Deploy on Vercel:** set the project's root directory to `avatar-kit/web` and enable "Include source files outside of the Root Directory" (the sync step reads `../embed`).
- Add `?debug` to the URL to expose the runtime as `window.__runtime`.
