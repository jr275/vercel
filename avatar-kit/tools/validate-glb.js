// node tools/validate-glb.js <file.glb> [--phase=head|full] [--rigmap=rigmap.json] [--json=out.json] [--scores=manual.json]
// Loads the GLB in headless Chromium, runs the real pipeline and prints the Asset Acceptance report.
// Exit code: 0 = ACEITAR, 2 = PENDENTE (technical part passed, visual rubric still to be filled), 3 = REVISAR, 1 = REJEITAR or error.
// The software renderer used here cannot judge FPS: that line is reported "not measured". Run the Avatar Lab on a real GPU for it.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || (() => { try { require.resolve('playwright'); return 'playwright'; } catch (e) { return '/opt/node22/lib/node_modules/playwright'; } })());
const args = process.argv.slice(2), file = args.find(a => !a.startsWith('--')), val = n => { const a = args.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : undefined; };
if (!file || !fs.existsSync(file)) { console.error('usage: node tools/validate-glb.js <file.glb> [--phase=head|full] [--rigmap=file.json] [--json=out.json] [--scores=manual.json]'); process.exit(1); }
const ROOT = path.join(__dirname, '..'), phase = val('phase') || 'head';
const rigMap = val('rigmap') ? JSON.parse(fs.readFileSync(val('rigmap'), 'utf8')) : undefined, manual = val('scores') ? JSON.parse(fs.readFileSync(val('scores'), 'utf8')) : { scores: {}, overall: null };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm' };
(async () => {
  const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
  await new Promise(r => srv.listen(0, r));
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  let code = 1;
  try {
    const p = await b.newPage({ viewport: { width: 640, height: 480 } }); p.on('pageerror', e => console.error('pageerror:', e.message));
    await p.goto('http://localhost:' + srv.address().port + '/tests/browser/harness.html', { waitUntil: 'commit' });
    await p.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
    const b64 = fs.readFileSync(file).toString('base64');
    const out = await p.evaluate(async ({ b64, rigMap, phase, manual }) => {
      const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const r = await __avatar.loadAvatar({ source: 'glb', data: u.buffer, rigMap, fallback: false });
      const run = await AvatarKit.AssetValidator.runAll(__avatar, { phase, manual, fpsSeconds: 2 });
      return AvatarKit.AssetValidator.serialize({ load: { source: r.source, info: r.info }, report: run.report, result: run.result });
    }, { b64, rigMap, phase, manual });
    const R = out.result, pct = x => Math.round(x * 100) + '%';
    console.log('\nASSET ACCEPTANCE  ' + path.basename(file) + '  (' + R.phase + ')');
    console.log('verdict: ' + R.verdict + '   score: ' + (R.total == null ? '—' : R.total + '/100') + '   technical: ' + R.technical.points + '/' + R.technical.max + ' (' + R.technical.percent + '%)');
    console.log(R.why + '\n');
    R.categories.forEach(c => console.log('  ' + c.label.padEnd(22) + (c.autoMax ? ('auto ' + (c.auto == null ? 'n/m' : c.auto.toFixed(1)) + '/' + c.autoMax.toFixed(1)) : 'auto -').padEnd(18) + (c.manualMax ? 'humano ' + (c.manual == null ? 'pendente' : c.manual.toFixed(1)) + '/' + c.manualMax.toFixed(1) : '')));
    console.log('\ngates:'); R.gates.forEach(g => console.log('  [' + (g.ok ? 'ok' : 'FALHOU') + '] ' + g.label));
    if (R.fixes.length) { console.log('\nitens abaixo de 70%:'); R.fixes.forEach(f => console.log('  - ' + f)); }
    if (val('json')) { fs.writeFileSync(val('json'), JSON.stringify(out, null, 1)); console.log('\nrelatório completo: ' + val('json')); }
    code = { ACEITAR: 0, PENDENTE: 2, REVISAR: 3, REJEITAR: 1 }[R.verdict];
  } catch (e) { console.error('ERRO: ' + (e.message || e)); code = 1; }
  await b.close(); srv.close(); process.exit(code);
})();
