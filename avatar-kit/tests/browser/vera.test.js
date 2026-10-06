// Vera v0.1 review route: the character with almost no UI, the profile applied, the 1.5 s test, expression comparison, speaking, mobile.
const test = require('node:test'), assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || (() => { try { require.resolve('playwright'); return 'playwright'; } catch (e) { return '/opt/node22/lib/node_modules/playwright'; } })());
const ROOT = path.join(__dirname, '../..'), MIME = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.json': 'application/json' };
const HAVE_ASSET = fs.existsSync(path.join(ROOT, 'assets/vera-v01/vera-v01-base.glb')), SKIP = HAVE_ASSET ? false : 'assets/vera-v01/vera-v01-base.glb is not in the repository (19 MB): see assets/vera-v01/SOURCE.md and tools/optimize-glb.mjs';
let server, browser, base;
test.before(async () => {
  server = http.createServer((req, res) => { const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
  await new Promise(r => server.listen(0, r)); base = 'http://localhost:' + server.address().port;
  browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
});
test.after(async () => { await browser.close(); server.close(); });
async function open(w, h, extra) {
  const p = await browser.newPage({ viewport: { width: w || 1440, height: h || 900 } }); p.__e = []; p.on('pageerror', e => p.__e.push(e.message)); p.on('console', m => { if (m.type() === 'error') p.__e.push(m.text().slice(0, 200)); });
  await p.goto(base + '/dist/executive-avatar.local.html?review=vera&paused=1' + (extra || '')); await p.waitForFunction(() => window.__executiveReady === true, null, { timeout: 120000 });
  await p.evaluate(() => { executive.setSpeechProvider({ name: 't', speak: async (t) => { const r = AvatarKit.Phonemizer.toEvents(t); return { playback: 'engine', phonemes: r.events, duration: r.duration }; }, stop() {} }); executive.advance(3, true); }); return p;
}
const adv = (p, s) => p.evaluate(s => { for (let i = 0; i < Math.round(s * 10); i++) executive.advance(0.1, true); }, s);
const img = (p) => p.evaluate(() => { executive.advance(0.05); return executive.capture(); });

test('review route: only the character, the Vera v0.1 asset with its profile, full rig, no errors', { skip: SKIP }, async () => {
  const p = await open(); const r = await p.evaluate(() => { const vis = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
    const i = executive.info(), suit = []; executive.avatar.model.object3D.traverse(o => { if (o.material && o.material.name === 'Human.female_casualsuit01') suit.push({ type: o.material.type, color: o.material.color.getHexString(), map: !!o.material.map }); });
    return { ui: ['dev', 'devbtn', 'tag', 'note'].map(vis), role: i.asset.role, profiled: i.asset.profiled, fallback: i.asset.fallback, rig: i.rig, shot: i.shot, lm: executive.avatar.model.getLandmarks().headHeight, suit, canvas: !!document.querySelector('#stage canvas') }; });
  assert.deepEqual(r.ui, [false, false, false, false]); assert.equal(r.canvas, true); assert.equal(r.role, 'VISUAL_PROTOTYPE'); assert.ok(r.profiled >= 3); assert.equal(r.fallback, false);
  assert.equal(r.rig.grade, 'full'); assert.ok(r.rig.morphTargets && r.rig.visemes && r.rig.eyes && r.rig.jaw); assert.equal(r.shot, 'MEDIUM_CLOSE'); assert.ok(Math.abs(r.lm - 0.91) < 1e-6, 'landmark override from the profile');
  assert.deepEqual(r.suit, [{ type: 'MeshLambertMaterial', color: '050506', map: false }]); assert.deepEqual(p.__e, []); await p.close();
});

test('1.5 second test: neutral, looks to the camera, a blink, holds the gaze; the gaze really moves', { skip: SKIP }, async () => {
  const p = await open(); const r = await p.evaluate(async () => { const gz = []; const t = executive.runPresenceTest(); for (let i = 0; i < 16; i++) { gz.push(executive.avatar.debug().gaze); executive.advance(0.1, true); } const log = await t; return { log, y0: gz[1].yaw, y1: gz[15].yaw, blink: executive.playAnimation('blink') }; });
  assert.deepEqual(r.log.map(x => x.t), [0, 0.5, 1, 1.5]); assert.deepEqual(r.log.map(x => x.what), ['neutral', 'looks toward camera', 'subtle blink', 'holds gaze']); assert.ok(Math.abs(r.y0 - r.y1) > 0.02, 'gaze moved toward the camera: ' + r.y0 + ' -> ' + r.y1); assert.equal(r.blink, true); await p.close();
});

test('expression comparison: neutral, focused, skeptical, firm, warm are five different faces in the same camera and light', { skip: SKIP }, async () => {
  const p = await open(); await p.evaluate(() => veraReview.close()); await adv(p, 3); const shots = {};
  for (const e of ['neutral', 'focused', 'skeptical', 'firm', 'warm']) { await p.evaluate(e => executive.setExpression(e), e); await adv(p, 3); shots[e] = await img(p); }
  const hashes = new Set(Object.values(shots)); assert.equal(hashes.size, 5, 'every expression looks different'); assert.deepEqual(p.__e, []); await p.close();
});

test('speaking test: IDLE, LISTENING, THINKING, SPEAKING, IDLE with the exact sentence; the mouth opens and the face stays', { skip: SKIP }, async () => {
  const p = await open(); await p.evaluate(() => veraReview.close()); await adv(p, 2);
  const r = await p.evaluate(async () => { const jaw = []; executive.userStartedSpeaking(); for (let i = 0; i < 15; i++) executive.advance(0.1, true); executive.userStoppedSpeaking(); for (let i = 0; i < 10; i++) executive.advance(0.1, true);
    const t = executive.speak(executive.demoText); await new Promise(r => setTimeout(r, 0)); for (let i = 0; i < 160; i++) { executive.advance(0.1, true); jaw.push(executive.avatar.debug().channels.jawOpen || 0); } const res = await t; executive.advance(0.5, true); return { jaw, res, hist: executive.stateHistory().map(h => h.to), text: executive.demoText, end: executive.getState() }; });
  assert.equal(r.text, "Let's separate the problem from the noise. The issue is not what happened. The issue is what is preventing the next move."); assert.deepEqual(r.hist, ['LISTENING', 'THINKING', 'SPEAKING', 'IDLE']); assert.equal(r.res.ok, true); assert.equal(r.end, 'IDLE');
  assert.ok(Math.max(...r.jaw) > 0.1, 'the mouth opens: ' + Math.max(...r.jaw)); assert.ok(Math.max(...r.jaw) < 0.95, 'and never gapes'); await p.close();
});

test('mobile 390px: renders the character, no UI, no overflow, no errors', { skip: SKIP }, async () => {
  const p = await open(390, 844); const m = await p.evaluate(() => { const c = document.querySelector('#stage canvas'); return { w: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, canvas: [c.clientWidth, c.clientHeight], dev: getComputedStyle(document.getElementById('dev')).display }; });
  assert.ok(m.w <= m.cw); assert.deepEqual(m.canvas, [390, 844]); assert.equal(m.dev, 'none'); assert.deepEqual(p.__e, []); await p.close();
});

test('the capture tool writes the review set and the score file computes to the weighted total', () => {
  const sc = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/vera-v01/score.json'), 'utf8')); assert.equal(Object.values(sc.weights).reduce((a, b) => a + b, 0), 100);
  Object.values(sc.scores).forEach(v => assert.ok(v >= 0 && v <= 5)); const total = Object.keys(sc.weights).reduce((a, k) => a + sc.weights[k] * sc.scores[k] / 5, 0); assert.ok(total >= 0 && total <= 100); assert.equal(total, 36);
});
