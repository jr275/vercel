#!/usr/bin/env node
// node tools/vera-review.js [--glb <url>] [--out <dir>]   Captures the Vera v0.1 review set in fixed conditions (deterministic: simulation time, no wall clock)
// into review/vera-v01/ and prints the score from assets/vera-v01/score.json (a human or reviewer fills that file; nothing is scored automatically).
const fs = require('fs'), path = require('path'), http = require('http'), { spawnSync } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || (() => { try { require.resolve('playwright'); return 'playwright'; } catch (e) { return '/opt/node22/lib/node_modules/playwright'; } })());
const KIT = path.join(__dirname, '..'), arg = n => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : null; };
const OUT = path.resolve(arg('out') || path.join(KIT, 'review/vera-v01')); fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.json': 'application/json' };
(async () => {
  spawnSync(process.execPath, [path.join(__dirname, 'build.js')], { stdio: 'ignore' });
  const srv = http.createServer((q, r) => { const f = path.join(KIT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(KIT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
  await new Promise(r => srv.listen(0, r)); const base = 'http://localhost:' + srv.address().port;
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
  const errors = [], files = [];
  async function open(w, h) { const p = await b.newPage({ viewport: { width: w, height: h } }); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    await p.goto(base + '/dist/executive-avatar.local.html?review=vera&paused=1' + (arg('glb') ? '&glb=' + arg('glb') : '')); await p.waitForFunction(() => window.__executiveReady === true, null, { timeout: 120000 });
    await p.evaluate(() => { executive.setSpeechProvider({ name: 'timeline', speak: async (t) => { const r = AvatarKit.Phonemizer.toEvents(t); return { playback: 'engine', phonemes: r.events, duration: r.duration }; }, stop() {} }); executive.advance(3, true); }); return p; }
  const adv = (p, s) => p.evaluate(async s => { for (let i = 0; i < Math.round(s * 10); i++) executive.advance(0.1, true); }, s);
  async function snap(p, name) { await p.evaluate(() => executive.advance(0.05)); const d = await p.evaluate(() => executive.capture()); fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(d.split(',')[1], 'base64')); files.push(name + '.png'); }
  // desktop 1440
  let p = await open(1440, 900); const info = await p.evaluate(() => executive.info());
  await adv(p, 2); await snap(p, '01_medium_close_1440');
  await p.evaluate(() => veraReview.close()); await adv(p, 3); await snap(p, '02_close_1440');
  for (const e of ['neutral', 'focused', 'skeptical', 'firm', 'warm']) { await p.evaluate(e => executive.setExpression(e), e); await adv(p, 3); await snap(p, '03_expr_' + e); }
  await p.evaluate(() => executive.setExpression('neutral')); await adv(p, 2);
  // 1.5 second test
  await p.evaluate(() => { window.__pt = executive.runPresenceTest(); }); await snap(p, '04_presence_t0.0'); for (const t of ['0.5', '1.0', '1.5']) { await adv(p, 0.5); await snap(p, '04_presence_t' + t); }
  await adv(p, 1);
  // speaking: IDLE, LISTENING, THINKING, SPEAKING, captured at start, middle and end
  const states = []; await snap(p, '05_speak_0_neutral');
  const sp = await p.evaluate(async () => { const log = []; executive.on('state', s => log.push(s.state)); executive.userStartedSpeaking(); for (let i = 0; i < 20; i++) executive.advance(0.1, true); executive.userStoppedSpeaking(); for (let i = 0; i < 15; i++) executive.advance(0.1, true);
    window.__sp = executive.speak(executive.demoText); await new Promise(r => setTimeout(r, 0)); return { log }; });
  const dur = await p.evaluate(() => AvatarKit.Phonemizer.toEvents(executive.demoText).duration); let t = 0;
  for (const [name, at] of [['1_begin', 0.12], ['2_middle', 0.5], ['3_end', 0.9]]) { await adv(p, Math.max(0, dur * at - t)); t = dur * at; await snap(p, '05_speak_' + name); }
  await p.evaluate(async () => { for (let i = 0; i < 80; i++) executive.advance(0.1, true); await window.__sp; executive.advance(0.5, true); });
  const speakStates = await p.evaluate(() => executive.stateHistory().map(h => h.to));
  await p.evaluate(() => veraReview.full()); await adv(p, 3); await snap(p, '06_full_1440'); await p.close();
  // mobile 390
  p = await open(390, 844); await adv(p, 2); await snap(p, '07_mobile_390_medium_close'); await p.evaluate(() => veraReview.close()); await adv(p, 3); await snap(p, '07_mobile_390_close'); await p.close();
  await b.close(); srv.close();
  // contact sheet
  const sheetIn = ['01_medium_close_1440', '02_close_1440', '03_expr_neutral', '03_expr_focused', '03_expr_skeptical', '03_expr_firm', '03_expr_warm', '05_speak_1_begin', '05_speak_2_middle', '05_speak_3_end'].map(n => path.join(OUT, n + '.png'));
  const m = spawnSync('montage', [...sheetIn, '-tile', '5x2', '-geometry', '480x300+4+4', '-background', '#0b0b0e', path.join(OUT, 'sheet.png')]); if (m.status === 0) files.push('sheet.png');
  const sc = path.join(KIT, 'assets/vera-v01/score.json'); let score = null;
  if (fs.existsSync(sc)) { const j = JSON.parse(fs.readFileSync(sc, 'utf8')); let total = 0; Object.keys(j.weights).forEach(k => { total += j.weights[k] * j.scores[k] / 5; }); j.total = Math.round(total * 10) / 10; score = j; fs.writeFileSync(path.join(OUT, 'score.json'), JSON.stringify(j, null, 1)); }
  const result = { asset: info.asset, rig: info.rig, speakStates, errors, files, score: score && { total: score.total, scores: score.scores } };
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 1)); console.log(JSON.stringify(result, null, 1));
})();
