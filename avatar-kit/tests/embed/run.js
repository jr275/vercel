const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright'), http = require('http'), fs = require('fs'), path = require('path');
const ROOT = require('path').resolve(process.argv[2] || '.'), MIME = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm' };
(async () => {
  const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
  await new Promise(r => srv.listen(0, r)); const port = srv.address().port;
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const p = await b.newPage({ viewport: { width: 900, height: 700 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:' + port + '/index.html'); await p.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const r = await p.evaluate(async () => { const h = window.__h.current; const rt = h.runtime; rt.pause();
    rt.setSpeechProvider({ name: 't', speak: async (t) => { const x = AvatarKit.Phonemizer.toEvents(t); return { playback: 'engine', phonemes: x.events, duration: x.duration }; }, stop() {} });
    const t = h.speak('The issue is the next move.'); await new Promise(r => setTimeout(r, 0)); let jaw = 0; for (let i = 0; i < 40; i++) { rt.advance(0.1, true); jaw = Math.max(jaw, rt.avatar.debug().channels.jawOpen || 0); } const res = await t; rt.advance(0.5, true);
    h.setExpression('firm'); h.setShot('CLOSE'); const canv = document.querySelectorAll('#root canvas').length; const info = rt.info();
    window.__remount(); await new Promise(r => setTimeout(r, 300)); return { res, jaw, canv, role: info.asset.role, state: rt.getState(), canvAfter: document.querySelectorAll('#root canvas').length, warn: window.__warn || null, err: window.__err || null }; });
  console.log(JSON.stringify(r), errs); if (errs.length || !r.res.ok || r.canv !== 1 || r.canvAfter !== 1 || r.jaw < 0.05 || r.warn) process.exitCode = 1; await b.close(); srv.close();
})();
