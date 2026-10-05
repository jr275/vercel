# React embed check (manual)

Verifies `embed/ExecutiveAvatar.tsx` in a real browser: strict type-check, mount, speak, expression and shot calls, remount. It needs React, which the kit does not depend on, so it runs in a scratch folder:

```sh
W=$(mktemp -d) && cd $W && npm init -y >/dev/null && npm i react@18 react-dom@18 @types/react@18 @types/react-dom@18 typescript esbuild playwright
mkdir -p et/avatar-kit && cp -r <kit>/embed/* et/avatar-kit/ && cp <kit>/embed/*.ts* <kit>/tests/embed/main.tsx et/
echo '<!doctype html><meta charset="utf-8"><body style="margin:0"><div id="root"></div><script src="app.js"></script>' > et/index.html
npx tsc --strict --jsx react-jsx --moduleResolution bundler --module esnext --noEmit --skipLibCheck --lib dom,es2020 et/ExecutiveAvatar.tsx
npx esbuild et/main.tsx --bundle --outfile=et/app.js --format=iife --jsx=automatic
node <kit>/tests/embed/run.js et
```
