// Head Gate: browser and CLI integration. Run: node --test tests/browser/headgate.test.js
const test = require('node:test'), assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || (() => { try { require.resolve('playwright'); return 'playwright'; } catch (e) { return '/opt/node22/lib/node_modules/playwright'; } })());
const ROOT = path.join(__dirname, '../..'), MIME = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
let server, browser, base;
test.before(async () => {
  server = http.createServer((req, res) => { const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
  await new Promise(r => server.listen(0, r)); base = 'http://localhost:' + server.address().port;
  browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
});
test.after(async () => { await browser.close(); server.close(); });
async function page() { const p = await browser.newPage({ viewport: { width: 1280, height: 720 } }); await p.goto(base + '/tests/browser/harness.html', { waitUntil: 'commit' }); await p.waitForFunction(() => window.__ready === true, null, { timeout: 120000 }); return p; }
const A = '/tests/fixtures/rig-arkit.glb', B = '/tests/fixtures/rig-no-eyes.glb';
const ev = (p, fn, arg) => p.evaluate(fn, arg);

/* decodes every shot and reads a 24x24 patch of the background (top-left and top-right corners) */
const corners = (p, urls) => ev(p, async (urls) => { const out = []; for (const u of urls) { const im = new Image(); im.src = u; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const avg = (x, y) => { const d = g.getImageData(x, y, 24, 24).data; let r = 0, gg = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; } const n = d.length / 4; return [r / n, gg / n, b / n]; };
  out.push({ w: im.width, h: im.height, tl: avg(2, 2), tr: avg(im.width - 26, 2), bl: avg(2, im.height - 26) }); } return out; }, urls);

test('standard shots: ten shots, one resolution, one background, one lighting, for every candidate', async () => {
  const p = await page();
  const r = await ev(p, async ([a, b]) => { const out = {}; for (const [k, u] of [['A', a], ['B', b]]) { const buf = await (await fetch(u)).arrayBuffer(); out[k] = await AvatarKit.HeadReview.runShots({ id: 'HEAD-9' + k, data: buf }, {}); } return { A: out.A.map(s => ({ id: s.id, u: s.dataUrl })), B: out.B.map(s => ({ id: s.id, u: s.dataUrl })) }; }, [A, B]);
  assert.deepEqual(r.A.map(s => s.id), ['01_FRONT_NEUTRAL', '02_FRONT_LISTENING', '03_FRONT_THINKING', '04_FRONT_FIRM', '05_FRONT_SKEPTICAL', '06_THREE_QUARTER', '07_PROFILE', '08_SPEAKING', '09_SPEAKING_CLOSE'], 'plus 10_IDLE_1_5_SECONDS from the presence test');
  const ca = await corners(p, r.A.map(s => s.u)), cb = await corners(p, r.B.map(s => s.u)), all = ca.concat(cb);
  all.forEach(c => { assert.equal(c.w, 1280); assert.equal(c.h, 720); });
  const near = (x, y, tol = 3) => x.every((v, i) => Math.abs(v - y[i]) <= tol);
  all.forEach((c, i) => ['tl', 'tr', 'bl'].forEach(k => assert.ok(near(c[k], all[0][k], 8), 'background patch ' + k + ' differs in shot ' + i + ': ' + c[k] + ' vs ' + all[0][k])));
  const hashes = new Set(r.A.map(s => s.u)); assert.equal(hashes.size, r.A.length, 'every shot is a different picture'); assert.notEqual(r.A[0].u, r.B[0].u, 'two candidates give two pictures'); await p.close();
});
test('determinism: the same file gives the same pixels in a fresh browser (shots, presence frames, speech stills)', async () => {
  const run = async () => { const p = await page(); const r = await ev(p, async (a) => { const buf = await (await fetch(a)).arrayBuffer(), src = { id: 'HEAD-901', data: buf }; const s = await AvatarKit.HeadReview.runShots(src, { keepImages: false }), pr = await AvatarKit.HeadReview.runPresence(src, { keepImages: false });
    return { shots: s.map(x => x.hash), presence: pr.frames.map(x => x.hash), metrics: pr.metrics, cfg: AvatarKit.HeadGate.configHash() }; }, A); await p.close(); return r; };
  const a = await run(), b = await run(); assert.deepEqual(a.shots, b.shots); assert.deepEqual(a.presence, b.presence); assert.deepEqual(a.metrics, b.metrics); assert.equal(a.cfg, b.cfg); assert.equal(a.presence.length, 6);
});
test('candidate isolation: reviewing A, then B, then A again changes nothing in A', async () => {
  const p = await page();
  const r = await ev(p, async ([a, b]) => { const H = AvatarKit.HeadReview, ba = await (await fetch(a)).arrayBuffer(), bb = await (await fetch(b)).arrayBuffer(); const f = async (buf, id) => (await H.runShots({ id, data: buf }, { keepImages: false })).map(s => s.hash);
    const a1 = await f(ba, 'HEAD-001'), b1 = await f(bb, 'HEAD-002'), a2 = await f(ba, 'HEAD-001'); return { a1, b1, a2 }; }, [A, B]);
  assert.deepEqual(r.a1, r.a2); assert.notDeepEqual(r.a1, r.b1); await p.close();
});
test('the 1.5 s presence test: cues measured, breath aligned to the 0.6 s cue, six frames', async () => {
  const p = await page(); const r = await ev(p, async (a) => { const buf = await (await fetch(a)).arrayBuffer(); const pr = await AvatarKit.HeadReview.runPresence({ id: 'HEAD-901', data: buf }, { keepImages: false }); return { frames: pr.frames.map(f => f.t + ':' + f.cue), m: pr.metrics, series: pr.series.map(s => [s.t, s.breath]), q: pr.questions.map(q => q.id) }; }, A);
  assert.deepEqual(r.frames, ['0:neutral face', '0.3:micro eye movement', '0.6:small breath', '0.9:micro facial change', '1.2:gaze stabilises', '1.5:observer answers A, B, C']); assert.deepEqual(r.q, ['A', 'B', 'C']);
  assert.ok(r.m.eyeMoveDetected && r.m.breathDetected && r.m.faceChangeInRange && r.m.eyeStableAtEnd && !r.m.fidget, JSON.stringify(r.m));
  const b = Object.fromEntries(r.series); assert.ok(b[0.6] < 0.25 && b[0.6] < b[0.3], 'the exhale is ending and the inhale has not started at the 0.6 s cue: ' + b[0.3] + ' ' + b[0.6]); assert.ok(b[1.2] - b[0.6] > 0.1, 'and it is under way after it'); await p.close();
});
test('speech test: the standard sentence drives the real engine, and the metrics are present', async () => {
  const p = await page(); const r = await ev(p, async (a) => { const buf = await (await fetch(a)).arrayBuffer(); const s = await AvatarKit.HeadReview.runSpeech({ id: 'HEAD-901', data: buf }, { keepImages: false }); return { m: s.metrics, flags: s.flags, stills: s.stills.map(x => x.id), seconds: s.script.seconds, items: s.checklist.length }; }, A);
  assert.ok(r.seconds >= 10 && r.seconds <= 15); assert.equal(r.items, 12); assert.deepEqual(r.stills.sort(), ['viseme_E', 'viseme_FF', 'viseme_O', 'viseme_PP', 'viseme_TH', 'viseme_U', 'viseme_aa']);
  ['cyclesPerSyllable', 'jerkJaw', 'jerkCheeks', 'jerkChin', 'closureContrast', 'peakDisplacement'].forEach(k => assert.ok(Number.isFinite(r.m[k]), k)); assert.ok(r.m.cyclesPerSyllable > 0.4, 'the mouth moves with the syllables'); assert.ok(r.m.closureContrast < 0.55, 'p/b/m close the jaw'); assert.deepEqual(r.m.visemesNotReached, []); await p.close();
});
test('speech test catches a broken mouth: a head whose jaw and visemes do nothing is flagged', async () => {
  const p = await page(); const r = await ev(p, async (a) => { const buf = await (await fetch(a)).arrayBuffer(); const H = AvatarKit.HeadReview;
    // sabotage: zero every mouth-related morph target of the head mesh, as a rig whose mouth targets are empty would behave
    const prepare = (av) => { const m = av.model.meshes.find(x => x.morphTargetDictionary); Object.keys(m.morphTargetDictionary).filter(k => /^(viseme_|jaw|mouth|tongue)/.test(k)).forEach(k => { const t = m.geometry.morphAttributes.position[m.morphTargetDictionary[k]]; if (m.geometry.morphTargetsRelative) t.array.fill(0); else t.array.set(m.geometry.attributes.position.array); }); };
    const s = await H.runSpeech({ id: 'HEAD-902', data: buf, prepare }, { keepImages: false }); return { flags: s.flags, c: s.metrics.cyclesPerSyllable }; }, A);
  assert.ok(r.flags.some(f => /no mouth movement/.test(f)), JSON.stringify(r)); await p.close();
});
test('mapping layer on real files: exact ARKit names, studio names through a RigMap, and UNMAPPED when nothing matches', async () => {
  const p = await page(); const r = await ev(p, async () => { const HG = AvatarKit.HeadGate, out = {};
    const a = await AvatarKit.loadAvatar({ source: 'glb', url: '/tests/fixtures/rig-arkit.glb', fallback: false }); out.arkit = HG.mappingReport(a.model.res); a.model.dispose();
    const c = await AvatarKit.loadAvatar({ source: 'glb', url: '/tests/fixtures/rig-custom.glb', rigMap: { options: { ignoreTokens: ['fc'], swapLeftRight: true } }, fallback: false }); out.custom = HG.mappingReport(c.model.res); c.model.dispose();
    const n = await AvatarKit.loadAvatar({ source: 'glb', url: '/tests/fixtures/rig-bones-only.glb', rigMap: 'bones-only', fallback: false }); out.bones = HG.mappingReport(n.model.res); n.model.dispose(); return out; });
  assert.deepEqual(r.arkit.notReproducible, []); assert.deepEqual(r.arkit.fuzzyChannels, []); assert.deepEqual(r.arkit.visemes.missing, []);
  assert.deepEqual(r.custom.notReproducible, [], 'studio names reproduce every expression once the RigMap says how'); assert.ok(r.custom.fuzzyChannels.length > 10, 'matched by name tokens: flagged for a person to confirm'); assert.ok(r.custom.visemes.missing.length > 0, 'viseme names were not configured: reported, not guessed');
  assert.equal(r.bones.notReproducible.length, 10); assert.ok(r.bones.expressions[0].required.every(x => x.status === 'UNMAPPED')); await p.close();
});

/* ---------- the command line, end to end, in a temporary registry ---------- */
const cli = (root, ...a) => spawnSync(process.execPath, [path.join(ROOT, 'tools/head-gate.js'), ...a, '--root', root], { encoding: 'utf8', timeout: 600000 });
test('CLI: init, register, validate-head, rate, decide, compare, with the exit codes and the package', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hg-')), g = path.join(ROOT, 'tests/fixtures/rig-arkit.glb');
  let r = cli(root, 'init'); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /HEAD-001 v0\s+PENDING_ASSET/);
  r = cli(root, 'validate-head', 'HEAD-001'); assert.equal(r.status, 1); assert.match(r.stderr, /PENDING_ASSET/);
  r = cli(root, 'register', 'HEAD-007', '--file', g, '--vendor', 'Test', '--name', 'fixture'); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /State: DRAFT/);
  r = cli(root, 'register', 'HEAD-007', '--file', path.join(ROOT, 'package.json')); assert.equal(r.status, 1, 'not a glb is refused');
  r = cli(root, 'validate-head', 'HEAD-007'); assert.equal(r.status, 1, r.stdout + r.stderr); assert.match(r.stdout, /REJECTED \(automatic rules\)/); assert.match(r.stdout, /HR-14/);
  const pkg = path.join(root, 'candidates/HEAD-007/v001/package'); ['1_technical_report.md', '2_visual_review_checklist.md', '3_expression_report.md', '4_speech_report.md', '5_presence_report.md', '6_scorecard.md', '7_rejection_barriers.md', '8_final_recommendation.md', 'review.html', 'result.json'].forEach(f => assert.ok(fs.existsSync(path.join(pkg, f)), f));
  assert.equal(fs.readdirSync(path.join(pkg, 'shots')).length, 9); assert.equal(fs.readdirSync(path.join(pkg, 'presence')).length, 6); assert.equal(fs.readdirSync(path.join(pkg, 'speech')).length, 7); assert.equal(fs.readdirSync(path.join(pkg, 'expressions')).length, 10);
  const md = fs.readFileSync(path.join(pkg, '6_scorecard.md'), 'utf8'); assert.match(md, /HUMAN REVIEW REQUIRED/); assert.match(fs.readFileSync(path.join(pkg, '1_technical_report.md'), 'utf8'), /not measured/);
  const c = JSON.parse(fs.readFileSync(path.join(root, 'candidates/HEAD-007/candidate.json'), 'utf8')); assert.equal(c.state, 'UNDER_REVIEW'); assert.ok(!JSON.stringify(c).includes('data:image'), 'no images inside the registry record');
  r = cli(root, 'decide', 'HEAD-007', '--decision', 'PASS', '--by', 'me'); assert.equal(r.status, 1); assert.match(r.stderr, /DECISION_NOT_SUPPORTED/);
  r = cli(root, 'decide', 'HEAD-007', '--decision', 'REJECTED', '--by', 'Owner', '--reason', 'no teeth'); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /REJECTED \(signed by Owner\)/);
  r = cli(root, 'register', 'HEAD-007', '--file', g, '--version', '2'); assert.equal(r.status, 0, r.stderr); r = cli(root, 'status', 'HEAD-007'); assert.match(r.stdout, /HEAD-007 v2\s+DRAFT/);
  r = cli(root, 'ratings-template', 'HEAD-007', '--out', path.join(root, 't.json')); assert.equal(r.status, 0); const t = JSON.parse(fs.readFileSync(path.join(root, 't.json'), 'utf8')); assert.ok('F1' in t.items && 'teeth' in t.speech && 'HR-01' in t.humanBarriers);
  r = cli(root, 'compare'); assert.equal(r.status, 0); assert.match(r.stdout, /No candidate can be ranked/); fs.rmSync(root, { recursive: true, force: true });
});
