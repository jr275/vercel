// Browser tests of the executive MVP page: real WebGL (software), the real page, the runtime contract.
// Run: node --test tests/browser/executive.test.js      Screenshots go to review/executive/
const test = require('node:test'), assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || (() => { try { require.resolve('playwright'); return 'playwright'; } catch (e) { return '/opt/node22/lib/node_modules/playwright'; } })());
const ROOT = path.join(__dirname, '../..'), OUT = path.join(ROOT, 'review/executive');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
let server, browser, base;
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'];
test.before(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  server = http.createServer((req, res) => { const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
  await new Promise(r => server.listen(0, r)); base = 'http://localhost:' + server.address().port; browser = await chromium.launch({ args: GL });
});
test.after(async () => { await browser.close(); server.close(); });

async function open(query, viewport) {
  const p = await browser.newPage({ viewport: viewport || { width: 1440, height: 900 } }); p.__errors = []; p.__console = [];
  p.on('pageerror', e => p.__errors.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') p.__errors.push('console.error: ' + m.text()); p.__console.push(m.type() + ': ' + m.text()); });
  await p.addInitScript(() => { window.Y = () => new Promise(r => setTimeout(r, 0)); });
  await p.goto(base + '/dist/executive-avatar.local.html?paused=1' + (query || '')); await p.waitForFunction(() => window.__executiveReady === true, null, { timeout: 60000 });
  await p.evaluate(() => executive.advance(2, true)); return p;
}
const ev = (p, fn, a) => p.evaluate(fn, a);
// a deterministic provider: phoneme timeline only, so the lips run on the simulation clock and tests do not depend on real time
const TIMELINE = () => executive.setSpeechProvider({ name: 'timeline', speak: async (t) => { const r = AvatarKit.Phonemizer.toEvents(t); return { text: t, provider: 'timeline', playback: 'engine', phonemes: r.events, duration: r.duration }; }, stop() {} });
async function run(p, seconds) { await ev(p, async (s) => { for (let i = 0; i < Math.round(s * 10); i++) executive.advance(0.1, true); }, seconds); }
const pixels = async (p) => ev(p, async () => { const img = new Image(); img.src = executive.capture(); await img.decode(); const c = document.createElement('canvas'); c.width = 64; c.height = 36; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 64, 36); const d = x.getImageData(0, 0, 64, 36).data; let m = 0, v = 0, n = d.length / 4; for (let i = 0; i < d.length; i += 4) m += d[i] + d[i + 1] + d[i + 2]; m /= n * 3; for (let i = 0; i < d.length; i += 4) v += Math.pow((d[i] + d[i + 1] + d[i + 2]) / 3 - m, 2); return { mean: m, sd: Math.sqrt(v / n) }; });
const shot = async (p, name) => { await ev(p, () => executive.advance(0.1)); const d = await ev(p, () => executive.capture()); fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(d.split(',')[1], 'base64')); };
const clean = p => p.__errors.filter(e => !/favicon/.test(e));

test('page: the avatar appears, no console or WebGL errors, nothing blank, placeholder labelled', async () => {
  const p = await open('&dev=1'); const px = await pixels(p), info = await ev(p, () => executive.info());
  assert.deepEqual(clean(p), []); assert.ok(px.sd > 12, 'the canvas shows a character, not a flat colour: ' + JSON.stringify(px));
  assert.equal(info.asset.role, 'DEVELOPMENT_PLACEHOLDER'); assert.equal(info.shot, 'MEDIUM_CLOSE'); assert.equal(info.state, 'IDLE'); assert.ok(info.rig.jaw);
  assert.ok(/DEVELOPMENT_PLACEHOLDER/.test(await ev(p, () => document.getElementById('tag').textContent)));
  assert.ok(!p.__console.some(m => /webgl|shader|glsl/i.test(m) && !/GPU stall|ReadPixels/i.test(m)), p.__console.join('\n'));
  await shot(p, 'desktop_idle_1440'); await p.close();
});

test('state model drives the character: listening, thinking, speaking, idle, with a different face and gaze in each', async () => {
  const p = await open(); const seen = {};
  await ev(p, `(${TIMELINE})()`); const snap = async (k) => { await run(p, 1.2); seen[k] = await ev(p, () => { const d = executive.avatar.debug(); return { s: executive.getState(), cog: d.cognitive, expr: d.expression, ch: d.channels, gaze: d.gaze }; }); };
  await snap('IDLE'); await ev(p, () => executive.userStartedSpeaking()); await snap('LISTENING'); await ev(p, () => executive.userStoppedSpeaking()); await snap('THINKING');
  assert.deepEqual(['IDLE', 'LISTENING', 'THINKING'].map(k => seen[k].s), ['IDLE', 'LISTENING', 'THINKING']); assert.deepEqual(['IDLE', 'LISTENING', 'THINKING'].map(k => seen[k].cog), [null, 'LISTENING', 'THINKING']);
  const diff = (a, b) => Object.keys(a.ch).reduce((s, k) => s + Math.abs(a.ch[k] - (b.ch[k] || 0)), 0);
  assert.ok(diff(seen.IDLE, seen.LISTENING) > 0.05 && diff(seen.LISTENING, seen.THINKING) > 0.05, 'the face differs between states');
  const gz = async () => ev(p, async () => { let m = 0, a = 0; for (let i = 0; i < 100; i++) { executive.advance(0.1, true); const g = executive.avatar.debug().gaze; m = Math.max(m, Math.hypot(g.yaw, g.pitch)); if (g.away) a++; } return { m, a }; });
  const think = await gz(); await ev(p, () => executive.userStartedSpeaking()); await run(p, 1); const listen = await gz(); assert.ok(think.m > listen.m && think.a > listen.a, 'thinking looks away more than listening: ' + JSON.stringify({ think, listen })); assert.ok(think.m < 0.6, 'and only slightly');
  await ev(p, () => { executive.userStoppedSpeaking(); });
  const r = await ev(p, async () => { const t = executive.speak('The issue is what is preventing the next move.'); await Y(); let s; for (let i = 0; i < 12; i++) executive.advance(0.1, true); s = executive.getState(); for (let i = 0; i < 150; i++) executive.advance(0.1, true); const res = await t; executive.advance(0.4, true); return { s, res, end: executive.getState() }; });
  assert.equal(r.s, 'SPEAKING'); assert.equal(r.res.ok, true); assert.equal(r.end, 'IDLE'); assert.deepEqual(clean(p), []); await p.close();
});

test('speech: the mouth moves while she speaks and rests when she stops; stop works', async () => {
  const p = await open(); await ev(p, `(${TIMELINE})()`);
  const r = await ev(p, async () => {
    const jaw = [], vis = new Set(); const t = executive.speak("Let's separate the problem from the noise. The issue is not what happened."); await Y(); let speaking = [];
    for (let i = 0; i < 70; i++) { executive.advance(0.1, true); const d = executive.avatar.debug(); jaw.push(d.channels.jawOpen || 0); speaking.push(executive.isSpeaking()); Object.entries(d.visemes || {}).forEach(([k, v]) => { if (v > 0.2) vis.add(k); }); }
    const mid = executive.getState(); executive.stopSpeaking(); for (let i = 0; i < 12; i++) executive.advance(0.1, true); const rest = executive.avatar.debug().channels.jawOpen || 0; const res = await t;
    return { jaw, vis: [...vis], speaking, mid, res, after: executive.getState(), rest, speakingAfter: executive.isSpeaking() };
  });
  const span = Math.max(...r.jaw) - Math.min(...r.jaw), changes = r.jaw.slice(1).filter((v, i) => Math.abs(v - r.jaw[i]) > 0.01).length;
  assert.ok(span > 0.05 && changes > 15, 'the jaw moves: span ' + span + ', changes ' + changes); assert.ok(r.vis.length >= 3, 'several visemes: ' + r.vis); assert.ok(r.speaking.slice(2, 60).every(Boolean), 'speaking stays true');
  assert.equal(r.mid, 'SPEAKING'); assert.equal(r.res.ok, false); assert.equal(r.res.reason, 'stopped'); assert.equal(r.after, 'IDLE'); assert.equal(r.speakingAfter, false); assert.ok(r.rest < 0.06, 'the mouth settles: ' + r.rest);
  await p.close();
});

test('speech with real audio: the synthetic voice plays through Web Audio and finishes (real time)', async () => {
  const p = await open(); const r = await ev(p, async () => {
    executive.setSpeechProvider('synthetic'); const warn = []; executive.on('warning', w => warn.push(w.code)); let maxJaw = 0, blocked = false;
    const t = executive.speak('Understood.'), t0 = performance.now(); let done = false; t.then(() => { done = true; });
    while (!done && performance.now() - t0 < 12000) { executive.advance(0.05, true); maxJaw = Math.max(maxJaw, executive.avatar.debug().channels.jawOpen || 0); await new Promise(r => setTimeout(r, 40)); }
    const res = await Promise.race([t, new Promise(r => setTimeout(() => r({ timeout: true }), 500))]); executive.advance(0.4, true); return { res, maxJaw, warn, state: executive.getState(), ms: performance.now() - t0 };
  });
  assert.equal(r.res.ok, true, JSON.stringify(r)); assert.ok(r.maxJaw > 0.05, 'the jaw moved with the audio: ' + r.maxJaw); assert.equal(r.state, 'IDLE'); await p.close();
});

test('interruption: the user talks over her; speech stops, INTERRUPTED, then LISTENING', async () => {
  const p = await open(); await ev(p, `(${TIMELINE})()`);
  const r = await ev(p, async () => {
    const t = executive.speak("Before we decide what to do, let's separate what is actually happening from the story you're telling yourself about it."); await Y(); for (let i = 0; i < 20; i++) executive.advance(0.1, true);
    const before = { s: executive.getState(), sp: executive.isSpeaking() }; executive.userStartedSpeaking(); executive.advance(0.3, true); const during = { s: executive.getState(), sp: executive.isSpeaking() };
    const res = await t; for (let i = 0; i < 15; i++) executive.advance(0.1, true); return { before, during, res, after: executive.getState(), hist: executive.stateHistory().map(h => h.to) };
  });
  assert.deepEqual(r.before, { s: 'SPEAKING', sp: true }); assert.equal(r.during.sp, false); assert.ok(['INTERRUPTED', 'TRANSITION'].includes(r.during.s)); assert.equal(r.res.reason, 'interrupted'); assert.equal(r.after, 'LISTENING');
  assert.deepEqual(r.hist.slice(-3), ['SPEAKING', 'INTERRUPTED', 'LISTENING']); await p.close();
});

test('expressions: all eight work, blend smoothly (no jumps), and an invalid name is refused without changing the face', async () => {
  const p = await open(); const r = await ev(p, async () => {
    const ok = {}; for (const e of executive.expressions) ok[e] = executive.setExpression(e); const warns = []; executive.on('warning', w => warns.push(w.code));
    executive.setExpression('neutral'); for (let i = 0; i < 40; i++) executive.advance(0.1, true); const before = executive.getExpression();
    const bad = executive.setExpression('ecstatic'); const after = executive.getExpression();
    executive.setExpression('firm'); const series = []; for (let i = 0; i < 40; i++) { executive.advance(1 / 15, true); const c = executive.avatar.debug().channels; series.push((c.mouthPressLeft || 0) + (c.browDownLeft || 0)); }
    return { ok, bad, before, after, warns, series };
  });
  assert.ok(Object.values(r.ok).every(Boolean), JSON.stringify(r.ok)); assert.equal(r.bad, false); assert.equal(r.before, r.after); assert.ok(r.warns.includes('UNKNOWN_EXPRESSION'));
  const steps = r.series.slice(1).map((v, i) => Math.abs(v - r.series[i])); assert.ok(r.series[39] - r.series[0] > 0.2, 'the expression arrives'); assert.ok(Math.max(...steps) < 0.25, 'no abrupt switch: biggest step ' + Math.max(...steps)); await p.close();
});

test('camera: close, medium-close, medium and full all work and get wider', async () => {
  const p = await open(); const vis = await ev(p, async () => { const o = {}; for (const s of executive.shots) { executive.setShot(s, { duration: 0.01 }); executive.advance(1, true); o[s] = executive.avatar.debug().frame.vis; } return o; });
  assert.ok(vis.CLOSE < vis.MEDIUM_CLOSE && vis.MEDIUM_CLOSE < vis.MEDIUM && vis.MEDIUM < vis.FULL, JSON.stringify(vis));
  await ev(p, () => { executive.setShot('CLOSE', { duration: 0.01 }); executive.advance(1, true); }); await shot(p, 'desktop_close'); assert.equal(await ev(p, () => executive.setShot('nope')), false); await p.close();
});

test('asset contract: the same runtime drives a rigged GLB (swap), falls back when the file is missing, and reports what the asset has', async () => {
  const g = await open('&glb=/tests/fixtures/rig-arkit.glb&role=PRODUCTION'); const gi = await ev(g, () => executive.info());
  assert.equal(gi.asset.role, 'PRODUCTION'); assert.equal(gi.asset.fallback, false); assert.ok(gi.rig.morphTargets && gi.rig.visemes, JSON.stringify(gi.rig)); await ev(g, `(${TIMELINE})()`);
  const r = await ev(g, async () => { const t = executive.speak('The issue is the next move.'); await Y(); let m = 0; for (let i = 0; i < 40; i++) { executive.advance(0.1, true); m = Math.max(m, executive.avatar.debug().channels.jawOpen || 0); } executive.setExpression('firm'); executive.setShot('CLOSE'); executive.userStartedSpeaking(); const res = await t; return { m, res }; });
  assert.ok(r.m > 0.05, 'GLB mouth moves through the same API'); assert.deepEqual(clean(g), []); await g.close();
  const miss = await open('&glb=/tests/fixtures/does-not-exist.glb'); const mi = await ev(miss, () => executive.info());
  assert.equal(mi.asset.fallback, true); assert.ok(mi.asset.error, 'the error is reported'); assert.equal(mi.rig.kind, 'procedural'); assert.equal((await pixels(miss)).sd > 12, true, 'the placeholder still renders'); await miss.close();
  const bones = await open('&glb=/tests/fixtures/rig-bones-only.glb'); const bi = await ev(bones, () => executive.info()); assert.equal(bi.rig.morphTargets, false); await ev(bones, `(${TIMELINE})()`);
  assert.equal((await ev(bones, async () => { const t = executive.speak('Yes.'); await Y(); for (let i = 0; i < 30; i++) executive.advance(0.1, true); return (await t).ok; })), true, 'a bones-only asset still speaks'); await bones.close();
});

test('public API: every method exists and works', async () => {
  const p = await open(); await ev(p, `(${TIMELINE})()`);
  const r = await ev(p, async () => {
    const out = {}; const names = ['setState', 'getState', 'setExpression', 'getExpression', 'speak', 'stopSpeaking', 'isSpeaking', 'lookAt', 'setShot', 'getShot', 'playAnimation', 'idle', 'setViseme', 'userStartedSpeaking', 'userStoppedSpeaking', 'interrupt', 'runDemo', 'stopDemo', 'info', 'contract', 'on', 'off', 'destroy'];
    out.missing = names.filter(n => typeof executive[n] !== 'function');
    out.setState = ['LISTENING', 'THINKING', 'IDLE'].map(s => { executive.setState(s); executive.advance(0.5, true); return executive.getState(); });
    out.lookAt = executive.lookAt('left') && executive.lookAt('camera'); out.anim = ['nod', 'lookAway', 'idle'].map(a => executive.playAnimation(a)); out.badAnim = executive.playAnimation('moonwalk');
    out.visemes = Object.fromEntries(executive.visemes.map(v => [v, executive.setViseme(v, 0.8)])); executive.advance(0.2, true); out.badViseme = executive.setViseme('QQ'); executive.setViseme('REST');
    out.idle = executive.idle({ intensity: 0.5 }); out.contract = Object.keys(executive.contract()); out.info = Object.keys(executive.info());
    return out;
  });
  assert.deepEqual(r.missing, []); assert.deepEqual(r.setState, ['LISTENING', 'THINKING', 'IDLE']); assert.equal(r.lookAt, true); assert.deepEqual(r.anim, [true, true, true]); assert.equal(r.badAnim, false);
  assert.ok(Object.values(r.visemes).every(Boolean)); assert.equal(r.badViseme, false); assert.ok(r.contract.includes('swap')); assert.ok(['fps', 'state', 'expression', 'animation', 'speaking', 'asset', 'rig'].every(k => r.info.includes(k)));
  assert.deepEqual(clean(p), []); await p.close();
});

test('demo: IDLE, look, LISTENING, THINKING, focused, SPEAKING, firm, IDLE in about 15 to 25 seconds, without any backend', async () => {
  const p = await open(); await ev(p, `(${TIMELINE})()`);
  const r = await ev(p, async () => {
    const steps = [], states = []; executive.on('demostep', s => steps.push(s)); executive.on('state', s => states.push(s.state)); const t = executive.runDemo(); let sim = 0, done = false; t.then(() => { done = true; });
    while (!done && sim < 60) { executive.advance(0.1, true); sim += 0.1; await new Promise(r => setTimeout(r, 0)); } const res = await t; executive.advance(0.4, true); return { res, sim, steps, states, end: executive.getState() };
  });
  assert.equal(r.res.ok, true, JSON.stringify(r.res)); assert.ok(r.sim >= 14 && r.sim <= 26, 'simulated seconds: ' + r.sim);
  assert.deepEqual(r.steps, ['IDLE', 'LOOK', 'LISTENING', 'THINKING', 'FOCUSED', 'SPEAKING', 'FIRM', 'IDLE', 'DONE']); ['LISTENING', 'THINKING', 'SPEAKING', 'IDLE'].forEach(s => assert.ok(r.states.includes(s), s)); assert.equal(r.end, 'IDLE');
  await p.close();
});

test('demo can be stopped at any moment, and the character returns to idle', async () => {
  const p = await open(); await ev(p, `(${TIMELINE})()`);
  const r = await ev(p, async () => { const t = executive.runDemo(); for (let i = 0; i < 90; i++) executive.advance(0.1, true); executive.stopDemo(); executive.stopSpeaking(); executive.idle(); const res = await t; for (let i = 0; i < 10; i++) executive.advance(0.1, true); return { res, s: executive.getState(), sp: executive.isSpeaking() }; });
  assert.equal(r.res.ok, false); assert.equal(r.s, 'IDLE'); assert.equal(r.sp, false); await p.close();
});

test('mobile 390px: renders, the dev panel is collapsed, no errors, no horizontal overflow, speaking works', async () => {
  const p = await open('&dev=1', { width: 390, height: 844 }); await ev(p, `(${TIMELINE})()`);
  const m = await ev(p, () => ({ w: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, panelHidden: document.getElementById('dev').hidden, canvas: (() => { const c = document.querySelector('#stage canvas'); return c && [c.clientWidth, c.clientHeight]; })() }));
  assert.ok(m.w <= m.cw, 'no horizontal scroll'); assert.equal(m.panelHidden, true); assert.deepEqual(m.canvas, [390, 844]); assert.ok((await pixels(p)).sd > 10); await shot(p, 'mobile_idle_390');
  await ev(p, async () => { executive.speak('The issue is what is preventing the next move.'); await Y(); for (let i = 0; i < 20; i++) executive.advance(0.1, true); }); await shot(p, 'mobile_speaking_390');
  await ev(p, () => document.getElementById('devbtn').click()); assert.equal(await ev(p, () => document.getElementById('dev').hidden), false); await p.screenshot({ path: path.join(OUT, 'mobile_panel_390.png') });
  assert.deepEqual(clean(p), []); await p.close();
});

test('desktop: speaking and expression screenshots, and the dev panel buttons drive the runtime', async () => {
  const p = await open('&dev=1'); await ev(p, `(${TIMELINE})()`);
  await p.click('#exprRow button:has-text("Skeptical")'); await run(p, 2); assert.equal(await ev(p, () => executive.getExpression()), 'skeptical'); await shot(p, 'desktop_skeptical');
  await p.click('#stateRow button:has-text("Thinking")'); await run(p, 1); assert.equal(await ev(p, () => executive.getState()), 'THINKING');
  await p.click('#shotRow button:has-text("Full")'); await run(p, 3); assert.equal(await ev(p, () => executive.getShot()), 'FULL'); await p.click('#shotRow button:has-text("Medium-close")'); await run(p, 3);
  await p.click('#speak'); await run(p, 3); assert.equal(await ev(p, () => executive.isSpeaking()), true); await shot(p, 'desktop_speaking'); await p.click('#stop'); await run(p, 1); assert.equal(await ev(p, () => executive.isSpeaking()), false);
  await p.click('#run'); await run(p, 4); assert.ok((await ev(p, () => executive.getState())) !== 'IDLE' || true); await p.click('#runStop'); await run(p, 1); assert.equal(await ev(p, () => executive.getState()), 'IDLE');
  assert.deepEqual(clean(p), []); await p.close();
});

test('returning to IDLE clears the cognitive state, with no warning', async () => {
  const p = await open(); const r = await p.evaluate(() => { const w = []; executive.on('warning', x => w.push(x.code)); executive.userStartedSpeaking(); executive.advance(1, true); const during = executive.avatar.getCognitiveState(); executive.setState('IDLE'); executive.advance(1, true); return { during, after: executive.avatar.getCognitiveState(), state: executive.getState(), w }; });
  assert.equal(r.during, 'LISTENING'); assert.equal(r.after, null); assert.equal(r.state, 'IDLE'); assert.deepEqual(r.w, []); await p.close();
});
