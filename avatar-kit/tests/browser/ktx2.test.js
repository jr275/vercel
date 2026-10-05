// KTX2 (Basis) texture loading in a real browser. Fixtures: tests/fixtures/rig-arkit-ktx2*.glb (built by tools/make-ktx2-fixture.js).
const test = require('node:test'), assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || (() => { try { require.resolve('playwright'); return 'playwright'; } catch (e) { return '/opt/node22/lib/node_modules/playwright'; } })());
const ROOT = path.join(__dirname, '../..'), MIME = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
let server, browser, base;
test.before(async () => {
  server = http.createServer((req, res) => { const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
  await new Promise(r => server.listen(0, r)); base = 'http://localhost:' + server.address().port;
  browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
});
test.after(async () => { await browser.close(); server.close(); });
const open = async (q) => { const p = await browser.newPage({ viewport: { width: 640, height: 640 } }); p.__e = []; p.on('pageerror', e => p.__e.push(e.message)); p.on('console', m => { if (m.type() === 'error') p.__e.push(m.text()); }); await p.goto(base + '/tests/browser/harness.html?' + q); await p.waitForFunction(() => window.__ready === true, null, { timeout: 60000 }); return p; };
const textures = p => p.evaluate(() => { const t = []; __avatar.model.object3D.traverse(o => { const m = o.material && o.material.map; if (m) t.push({ compressed: !!m.isCompressedTexture, mips: (m.mipmaps || []).length, w: m.image && m.image.width }); }); return { kind: __avatar.getModelInfo().kind, fallback: __readyInfo.fallback, error: __readyInfo.error && (__readyInfo.error.code + ': ' + __readyInfo.error.message), t, errors: __errors }; });

test('KTX2 UASTC and ETC1S textures load through the engine and stay compressed on the GPU', async () => {
  for (const f of ['rig-arkit-ktx2.glb', 'rig-arkit-ktx2-etc1s.glb']) {
    const p = await open('glb=/tests/fixtures/' + f + '&shot=CLOSE'); const r = await textures(p);
    assert.equal(r.kind, 'glb', f + ': ' + r.error); assert.equal(r.fallback, false); assert.equal(r.t.length, 1); assert.equal(r.t[0].compressed, true, 'a compressed GPU texture, transcoded in the browser'); assert.ok(r.t[0].mips >= 8, 'mipmaps kept'); assert.equal(r.t[0].w, 256);
    assert.deepEqual(r.errors, []); assert.deepEqual(p.__e, []); await p.close();
  }
});

test('the textured head renders differently from the untextured one, and the rig still works', async () => {
  const shot = async (q) => { const p = await open(q + '&shot=CLOSE'); const d = await p.evaluate(() => { __avatar.advance(1); return __avatar.capture(); }); const r = await p.evaluate(() => { __avatar.setExpression('firm'); __avatar.advance(1); return { jaw: (__avatar.model.getRigReport() || {}).grade, caps: __avatar.capabilities() }; }); await p.close(); return { d, r }; };
  const a = await shot('glb=/tests/fixtures/rig-arkit.glb'), b = await shot('glb=/tests/fixtures/rig-arkit-ktx2.glb');
  assert.notEqual(a.d, b.d, 'the texture is visible'); assert.equal(b.r.caps.visemes, true); assert.equal(b.r.caps.morphTargets, true);
});

test('KTX2 can be switched off, and a GLB that needs it then fails with a clear KTX2_FAILED (falls back with auto)', async () => {
  const p = await open('');
  const r = await p.evaluate(async () => { const o = {}; try { await AvatarKit.loadAvatar({ source: 'glb', url: '/tests/fixtures/rig-arkit-ktx2.glb', ktx2: false, fallback: false }); o.off = 'loaded'; } catch (e) { o.off = e.code + ': ' + e.message; }
    const a = await AvatarKit.loadAvatar({ source: 'auto', url: '/tests/fixtures/rig-arkit-ktx2.glb', ktx2: false }); o.auto = { source: a.source, fallback: a.fallback, code: a.error && a.error.code }; return o; });
  assert.ok(/^KTX2_FAILED: .*KTX2 loading is not set up/.test(r.off), r.off); assert.deepEqual(r.auto, { source: 'procedural', fallback: true, code: 'KTX2_FAILED' }); await p.close();
});

test('a wrong transcoder path fails loudly with KTX2_FAILED and the placeholder is shown instead', async () => {
  const p = await browser.newPage(); await p.goto(base + '/tests/browser/harness.html'); await p.waitForFunction(() => window.__ready === true);
  const r = await p.evaluate(async () => { const box = document.createElement('div'); box.style.cssText = 'width:300px;height:300px'; document.body.appendChild(box);
    const av = AvatarKit.createAvatar(box, { paused: true, adaptive: false, ktx2Path: '/nope/', avatar: { source: 'auto', url: '/tests/fixtures/rig-arkit-ktx2.glb' } }); const res = await av.ready; return { fallback: res.fallback, code: res.error && res.error.code, kind: av.getModelInfo().kind }; });
  assert.equal(r.fallback, true); assert.equal(r.code, 'KTX2_FAILED'); assert.equal(r.kind, 'procedural'); await p.close();
});

test('the executive runtime takes a KTX2 GLB as a drop-in asset: same API, no fallback, speaks', async () => {
  const p = await browser.newPage({ viewport: { width: 640, height: 640 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(base + '/dist/executive-avatar.local.html?paused=1&dev=0&glb=/tests/fixtures/rig-arkit-ktx2.glb&role=PRODUCTION'); await p.waitForFunction(() => window.__executiveReady === true, null, { timeout: 60000 });
  const r = await p.evaluate(async () => { executive.setSpeechProvider({ name: 't', speak: async (t) => { const x = AvatarKit.Phonemizer.toEvents(t); return { playback: 'engine', phonemes: x.events, duration: x.duration }; }, stop() {} });
    const info = executive.info(); const t = executive.speak('The issue is the next move.'); await new Promise(r => setTimeout(r, 0)); let m = 0; for (let i = 0; i < 40; i++) { executive.advance(0.1, true); m = Math.max(m, executive.avatar.debug().channels.jawOpen || 0); } await t; return { role: info.asset.role, fallback: info.asset.fallback, morph: info.rig.morphTargets, m }; });
  assert.equal(r.role, 'PRODUCTION'); assert.equal(r.fallback, false); assert.equal(r.morph, true); assert.ok(r.m > 0.05); assert.deepEqual(errs, []); await p.close();
});
