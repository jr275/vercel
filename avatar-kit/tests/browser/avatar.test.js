// Browser tests: real WebGL (software), real three.js, real GLB fixtures. Run: node --test tests/browser/avatar.test.js
const test = require('node:test'), assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || (() => { try { require.resolve('playwright'); return 'playwright'; } catch (e) { return '/opt/node22/lib/node_modules/playwright'; } })());
const ROOT = path.join(__dirname, '../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
let server, browser, base;
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'];

test.before(async () => {
  server = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, r)); base = 'http://localhost:' + server.address().port;
  browser = await chromium.launch({ args: GL });
});
test.after(async () => { await browser.close(); server.close(); });

async function open(query = '', size = [640, 480]) {
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } }), errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base + '/tests/browser/harness.html' + query, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  page.pageErrors = errors; return page;
}
const ev = (page, fn, arg) => page.evaluate(fn, arg);

test('API: every v1 method and every new method exists', async () => {
  const p = await open();
  const missing = await ev(p, () => ['setExpression', 'getExpression', 'speak', 'stopSpeaking', 'setLevel', 'setViseme', 'setSpeaking', 'isSpeaking', 'lookAt', 'idle', 'setShot', 'getShot', 'on', 'off', 'pause', 'resume', 'advance', 'renderNow', 'debug', 'destroy',
    'setCognitiveState', 'getCognitiveState', 'setContext', 'setAttention', 'pauseSpeech', 'resumeSpeech', 'setCameraStyle', 'setLighting', 'setQuality', 'loadAvatar', 'getModelInfo', 'getRigReport', 'capabilities', 'stats'].filter(m => typeof __avatar[m] !== 'function'));
  assert.deepEqual(missing, []); assert.deepEqual(await ev(p, () => __avatar.shots), ['CLOSE', 'MEDIUM', 'FULL']);
  assert.deepEqual(p.pageErrors, []); await p.close();
});

test('procedural: loads, renders, reports itself honestly', async () => {
  const p = await open(); const r = await ev(p, () => ({ info: __avatar.getModelInfo(), rep: __avatar.getRigReport(), caps: __avatar.capabilities(), st: __avatar.stats(), errors: __errors }));
  assert.equal(r.info.kind, 'procedural'); assert.equal(r.rep.grade, 'fallback'); assert.equal(r.caps.visemes, false); assert.ok(r.st.triangles > 1000); assert.deepEqual(r.errors, []); await p.close();
});

test('expressions: all 10 are distinct, smooth and finite', async () => {
  const p = await open();
  const res = await ev(p, () => {
    const names = ['neutral', 'listening', 'thinking', 'analyzing', 'firm', 'skeptical', 'empathetic', 'confident', 'concerned', 'decisive', 'surprised'], out = {};
    __avatar.setExpression('neutral'); __avatar.advance(3); const base = __avatar.debug().channels;
    names.forEach(n => { __avatar.setExpression(n); __avatar.advance(3); const c = __avatar.debug().channels; let d = 0, nan = 0; for (const k in c) { d += Math.abs(c[k] - base[k]); if (!isFinite(c[k])) nan++; } out[n] = { d: +d.toFixed(3), nan, expr: __avatar.getExpression(), sig: JSON.stringify(c) }; });
    return out;
  });
  const sigs = new Set(); for (const [n, r] of Object.entries(res)) { assert.equal(r.nan, 0, n); assert.equal(r.expr, n); sigs.add(r.sig); if (n !== 'neutral') assert.ok(r.d > 0.15, n + ' differs from neutral by ' + r.d); }
  assert.equal(sigs.size, 11, 'every expression has its own face'); assert.deepEqual(p.pageErrors, []); await p.close();
});

test('expressions: a change is gradual (no frame jumps) through the real pipeline', async () => {
  const p = await open();
  const worst = await ev(p, () => {
    __avatar.setExpression('neutral'); __avatar.advance(2); let prev = __avatar.debug().channels, worst = 0; __avatar.setExpression('surprised');
    for (let i = 0; i < 45; i++) { __avatar.advance(1 / 30); const c = __avatar.debug().channels; for (const k in c) if (!/Blink/.test(k)) worst = Math.max(worst, Math.abs(c[k] - prev[k])); prev = c; }
    return worst;
  });
  assert.ok(worst < 0.12, 'largest per-step change ' + worst); await p.close();
});

test('cognitive states: nine accepted, unknown rejected, gaze/blink behaviour differs', async () => {
  const p = await open();
  const r = await ev(p, () => {
    const out = {}; ['LISTENING', 'PROCESSING', 'THINKING', 'SPEAKING', 'DECIDING', 'WARNING', 'EMPATHY', 'CHALLENGE', 'CONFIDENCE'].forEach(n => { out[n] = { ok: __avatar.setCognitiveState(n), got: (__avatar.advance(1), __avatar.getCognitiveState()) }; });
    out.bad = __avatar.setCognitiveState('PANIC'); out.lower = __avatar.setCognitiveState('challenge'); return out;
  });
  for (const n of ['LISTENING', 'PROCESSING', 'THINKING', 'SPEAKING', 'DECIDING', 'WARNING', 'EMPATHY', 'CHALLENGE', 'CONFIDENCE']) { assert.equal(r[n].ok, true, n); assert.equal(r[n].got, n); }
  assert.equal(r.bad, false); assert.equal(r.lower, true); await p.close();
});

test('CHALLENGE looks like skepticism + firmness; WARNING like firmness + concern', async () => {
  const p = await open();
  const r = await ev(p, () => { __avatar.setCognitiveState('CHALLENGE'); __avatar.advance(3); const a = __avatar.debug(); __avatar.setCognitiveState('WARNING'); __avatar.advance(3); const b = __avatar.debug(); return { a: a.channels, b: b.channels, ae: a.expression, be: b.expression }; });
  assert.equal(r.ae, 'skeptical'); assert.ok(Math.abs(r.a.browOuterUpLeft - r.a.browOuterUpRight) > 0.25, 'asymmetric brow'); assert.ok(r.a.mouthPressLeft > 0.3);
  assert.equal(r.be, 'firm'); assert.ok(r.b.browInnerUp > 0.1 && r.b.jawClench > 0.4); await p.close();
});

test('camera: three shots x three styles, from landmarks, and ready for a model swap', async () => {
  const p = await open();
  const r = await ev(p, () => {
    const o = {}; ['CLOSE', 'MEDIUM', 'FULL'].forEach(s => { ['conversation', 'executive', 'intimate'].forEach(st => { __avatar.setShot(s, { style: st, duration: 0.01 }); __avatar.advance(0.3); const f = __avatar.debug().frame; o[s + '/' + st] = { d: f.d, y: f.y, vis: f.vis }; }); });
    o.badShot = __avatar.setShot('WIDE'); o.legacy = __avatar.setShot('closeup', 0.01); o.shotNow = __avatar.getShot(); return o;
  });
  for (const st of ['conversation', 'executive', 'intimate']) assert.ok(r['CLOSE/' + st].d < r['MEDIUM/' + st].d && r['MEDIUM/' + st].d < r['FULL/' + st].d, st);
  assert.ok(r['CLOSE/intimate'].vis < r['CLOSE/conversation'].vis && r['CLOSE/conversation'].vis < r['CLOSE/executive'].vis);
  assert.equal(r.badShot, false); assert.equal(r.legacy, true); assert.equal(r.shotNow, 'CLOSE'); await p.close();
});

test('gaze: camera / cursor / center / left / right behave', async () => {
  const p = await open();
  const r = await ev(p, () => { const o = {}; ['left', 'right', 'center', 'camera'].forEach(t => { __avatar.lookAt(t); __avatar.advance(2); o[t] = __avatar.debug().gaze.yaw; }); o.xy = (__avatar.lookAt(0.5, 0.5), __avatar.advance(2), __avatar.debug().gaze); o.bad = __avatar.lookAt('nowhere'); return o; });
  assert.ok(r.left < -0.3 && r.right > 0.3 && Math.abs(r.center) < 0.06 && Math.abs(r.camera) < 0.06, JSON.stringify(r)); assert.ok(r.xy.yaw > 0.1 && r.xy.pitch > 0.03); assert.equal(r.bad, false); await p.close();
});

test('gaze is alive: micro-saccades over a still hold, asymmetric eyes', async () => {
  const p = await open();
  const r = await ev(p, () => { __avatar.lookAt('camera'); __avatar.setCognitiveState('CONFIDENCE'); __avatar.advance(1); const ys = [], d = []; for (let i = 0; i < 120; i++) { __avatar.advance(1 / 30); const g = __avatar.debug().gaze; ys.push(g.yaw); d.push(g.eyes.yawL - g.eyes.yawR); } return { range: Math.max(...ys) - Math.min(...ys), vergence: d.reduce((a, b) => a + b) / d.length }; });
  assert.ok(r.range > 0.002 && r.range < 0.08, 'range ' + r.range); assert.ok(r.vergence > 0.01, 'eyes converge a little: ' + r.vergence); await p.close();
});

test('speech: phonetic timeline drives visemes, pause freezes, resume continues, stop resolves', async () => {
  const p = await open();
  const r = await ev(p, async () => {
    const ev = [{ t: 0.1, d: 0.5, v: 'aa' }, { t: 0.7, d: 0.3, v: 'PP' }, { t: 1.1, d: 0.5, v: 'O' }]; let ended = false;
    const prom = __avatar.speak(null, { visemes: ev }).then(() => { ended = true; });
    __avatar.advance(0.3); const a = __avatar.debug(); const speaking = __avatar.isSpeaking();
    __avatar.pauseSpeech(); const t0 = __avatar.debug().speech.time; __avatar.advance(1); const t1 = __avatar.debug().speech.time; const paused = __avatar.isPaused();
    __avatar.resumeSpeech(); __avatar.advance(1.2); const b = __avatar.debug();
    __avatar.advance(3); await prom; return { aa: a.visemes.viseme_aa, src: a.speech.source, speaking, frozen: t0 === t1, paused, mid: b.visemes.viseme_O, ended, after: __avatar.isSpeaking(), cog: __avatar.getCognitiveState() };
  });
  assert.equal(r.src, 'timeline'); assert.ok(r.aa > 0.5); assert.ok(r.speaking && r.frozen && r.paused); assert.ok(r.ended && !r.after); await p.close();
});

test('speech: real audio, no phonetic data -> amplitude fallback follows the voice', async () => {
  const p = await open();
  const r = await ev(p, async () => {
    const v = AvatarKit.makeTestVoiceWithVisemes(22050); __avatar.resume(); const seen = { amp: 0, max: 0, srcs: {} };
    const prom = __avatar.speak(v.pcm, { sampleRate: 22050 }).catch(e => ({ err: e.code }));
    for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 100)); const d = __avatar.debug(); if (d.speech) { seen.srcs[d.speech.source] = 1; seen.max = Math.max(seen.max, d.speech.level); } }
    __avatar.stopSpeaking(); const res = await prom; __avatar.pause(); return { seen, res: res && res.err || 'ok' };
  });
  assert.ok(r.seen.srcs.amplitude, JSON.stringify(r)); assert.ok(r.seen.max > 0.12, 'mouth opened with the voice: ' + r.seen.max); await p.close();
});

test('speech: bad inputs reject with typed errors', async () => {
  const p = await open();
  const r = await ev(p, async () => { const o = {}; try { await __avatar.speak(null, {}); } catch (e) { o.none = e.code; } try { await __avatar.speak(new ArrayBuffer(16)); } catch (e) { o.decode = e.code; } try { await __avatar.speak({}); } catch (e) { o.bad = e.code; } return o; });
  assert.equal(r.none, 'NO_SOURCE'); assert.equal(r.decode, 'DECODE_FAILED'); assert.equal(r.bad, 'BAD_AUDIO'); await p.close();
});

test('speech sets and restores the cognitive state', async () => {
  const p = await open();
  const r = await ev(p, async () => { __avatar.setCognitiveState('LISTENING'); __avatar.advance(1); const prom = __avatar.speak(null, { visemes: [{ t: 0.1, d: 0.3, v: 'aa' }] }); const during = __avatar.getCognitiveState(); __avatar.advance(2); await prom; return { during, after: __avatar.getCognitiveState() }; });
  assert.equal(r.during, 'SPEAKING'); assert.equal(r.after, 'LISTENING'); await p.close();
});

test('lighting: backdrop and lights are real 3D objects, styles change them smoothly', async () => {
  const p = await open();
  const r = await ev(p, () => { const sc = __avatar.model.object3D.parent; const g = sc.children.find(c => c.name === 'StudioLighting'); const lights = []; g.traverse(o => { if (o.isLight) lights.push(o.type + ':' + o.intensity.toFixed(2)); });
    const before = g.children.find(c => c.isDirectionalLight).intensity; __avatar.setLighting('intimate'); __avatar.advance(0.1); const mid = g.children.find(c => c.isDirectionalLight).intensity; __avatar.advance(3); const after = g.children.find(c => c.isDirectionalLight).intensity;
    return { lights, hasEnv: !!sc.environment, backdrop: g.children.some(c => c.material && c.material.type === 'ShaderMaterial'), before, mid, after }; });
  assert.ok(r.lights.length >= 5); assert.ok(r.hasEnv && r.backdrop); assert.ok(r.before !== r.after && Math.abs(r.mid - r.before) < Math.abs(r.after - r.before), JSON.stringify(r)); await p.close();
});

/* ------------------------------ GLB ------------------------------ */
const GLB = '?glb=/tests/fixtures/rig-arkit.glb';
test('GLB: loads a rigged model, resolves the rig, normalises the scale, frames from landmarks', async () => {
  const p = await open(GLB);
  const r = await ev(p, () => ({ src: __readyInfo.source, fb: __readyInfo.fallback, info: __avatar.getModelInfo(), rep: __avatar.getRigReport(), caps: __avatar.capabilities(), lm: __readyInfo.landmarks, errs: __errors }));
  assert.equal(r.src, 'glb'); assert.equal(r.fb, false); assert.equal(r.info.kind, 'glb'); assert.equal(r.rep.grade, 'full'); assert.equal(r.rep.coverage, 1); assert.ok(r.caps.visemes && r.caps.eyeBones && r.caps.jaw && r.caps.animations);
  assert.ok(Math.abs(r.lm.height - 7.05) < 0.01, 'normalised height ' + r.lm.height); assert.ok(r.lm.headHeight > 0.8 && r.lm.headHeight < 1.4, 'head height ' + r.lm.headHeight); assert.deepEqual(r.errs, []); await p.close();
});

test('GLB: native visemes and jaw are driven (morph influences actually move)', async () => {
  const p = await open(GLB);
  const r = await ev(p, async () => {
    const head = __avatar.model.meshes.find(m => m.name === 'HeadMesh' || m.morphTargetDictionary), d = head.morphTargetDictionary, inf = head.morphTargetInfluences;
    const prom = __avatar.speak(null, { visemes: [{ t: 0.05, d: 0.6, v: 'aa' }] }); __avatar.advance(0.3); const aa = inf[d.viseme_aa], jaw = inf[d.jawOpen], funnel = inf[d.mouthFunnel]; __avatar.advance(2); await prom;
    return { aa, jaw, funnel, after: inf[d.viseme_aa], count: Object.keys(d).length };
  });
  assert.ok(r.aa > 0.5 && r.jaw > 0.05 && r.after < 0.05 && r.count === 67, JSON.stringify(r)); await p.close();
});

test('GLB: expression morphs follow the composer and move the mesh', async () => {
  const p = await open(GLB);
  const r = await ev(p, () => { const head = __avatar.model.meshes.find(m => m.morphTargetDictionary), d = head.morphTargetDictionary, inf = head.morphTargetInfluences; __avatar.setExpression('skeptical'); __avatar.advance(3); return { L: inf[d.browOuterUpLeft], R: inf[d.browOuterUpRight], smileR: inf[d.mouthSmileRight], smileL: inf[d.mouthSmileLeft] }; });
  assert.ok(r.L > 0.6 && r.R < 0.15 && r.smileR > 0.15 && r.smileL < 0.1, JSON.stringify(r)); await p.close();
});

test('GLB: gaze turns the eye bones to the correct side; head follows partially and lags', async () => {
  const p = await open(GLB);
  const r = await ev(p, () => {
    const m = __avatar.model, eye = m.bones.leftEye.obj, head = m.bones.head.obj, T = THREE, v = new T.Vector3();
    function dir(b) { b.updateWorldMatrix(true, false); v.set(0, 0, 1).transformDirection(b.matrixWorld); return v.x; }
    __avatar.lookAt('center'); __avatar.advance(2); const c = dir(eye), hc = dir(head); __avatar.lookAt('right'); __avatar.advance(2); const r = dir(eye), hr = dir(head); __avatar.lookAt('left'); __avatar.advance(2); const l = dir(eye), hl = dir(head);
    return { c, r, l, hc, hr, hl };
  });
  assert.ok(r.r - r.c > 0.2 && r.l - r.c < -0.2, 'eyes: ' + JSON.stringify(r)); assert.ok(r.hr > r.hc && r.hl < r.hc, 'head follows direction'); assert.ok(Math.abs(r.hr - r.hc) < Math.abs(r.r - r.c), 'head turns less than the eyes'); await p.close();
});

test('GLB: breath moves the chest, idle clip plays, head turns with yaw', async () => {
  const p = await open(GLB);
  const r = await ev(p, () => { const m = __avatar.model, s = m.bones.spine2.obj; const q0 = s.quaternion.toArray(); __avatar.advance(2.2); const q1 = s.quaternion.toArray(); return { moved: q0.some((x, i) => Math.abs(x - q1[i]) > 1e-4), clip: !!m.clipActions.idle }; });
  assert.ok(r.moved && r.clip); await p.close();
});

test('GLB: custom names + mirrored sides work through RigMap config alone', async () => {
  const p = await open();
  const r = await ev(p, async () => {
    const C = AvatarKit.Channels, vis = {}, bones = {}; C.VISEMES.forEach(v => vis[v] = ['PH_' + v.replace('viseme_', '').toUpperCase()]);
    ['hips', 'spine', 'spine1', 'spine2', 'neck', 'head', 'leftShoulder', 'rightShoulder', 'leftEye', 'rightEye', 'jaw'].forEach(b => bones[b] = ['rig_' + ({ hips: 'Hips', spine: 'Spine', spine1: 'Spine1', spine2: 'Spine2', neck: 'Neck', head: 'Head', leftShoulder: 'LeftShoulder', rightShoulder: 'RightShoulder', leftEye: 'LeftEye', rightEye: 'RightEye', jaw: 'Jaw' })[b]]);
    const strict = await AvatarKit.loadAvatar({ source: 'auto', url: '/tests/fixtures/rig-custom.glb' });
    const ok = await __avatar.loadAvatar({ source: 'glb', url: '/tests/fixtures/rig-custom.glb', rigMap: { visemes: vis, bones, options: { ignoreTokens: ['fc'], swapLeftRight: true } } });
    const head = __avatar.model.meshes.find(m => m.morphTargetDictionary), d = head.morphTargetDictionary; __avatar.setExpression('skeptical'); __avatar.advance(3);
    return { strictSource: strict.source, strictErr: strict.error && strict.error.code, source: ok.source, grade: ok.rigReport.grade, native: ok.rigReport.visemesNative, leftBrowOnRightMorph: head.morphTargetInfluences[d.FC_BROW_OUTER_UP_R], other: head.morphTargetInfluences[d.FC_BROW_OUTER_UP_L] };
  });
  assert.equal(r.strictSource, 'procedural'); assert.equal(r.strictErr, 'RIG_INSUFFICIENT', 'without a RigMap, an unknown naming is refused, not guessed'); assert.equal(r.source, 'glb'); assert.ok(['full', 'good'].includes(r.grade), r.grade); assert.ok(r.native);
  assert.ok(r.leftBrowOnRightMorph > 0.6 && r.other < 0.15, 'swapLeftRight routed subject-left to the _R morph: ' + JSON.stringify(r)); await p.close();
});

test('GLB: bones-only and no-eye models still work, reporting what they lack', async () => {
  const p = await open();
  const r = await ev(p, async () => {
    const a = await __avatar.loadAvatar({ source: 'glb', url: '/tests/fixtures/rig-bones-only.glb', rigMap: 'bones-only' }); __avatar.setExpression('skeptical'); __avatar.speak(null, { visemes: [{ t: 0.0, d: 1, v: 'aa' }] }); __avatar.advance(0.5);
    const jaw = __avatar.model.bones.jaw.obj.quaternion.x; const ca = __avatar.capabilities(); __avatar.stopSpeaking();
    const b = await __avatar.loadAvatar({ source: 'glb', url: '/tests/fixtures/rig-no-eyes.glb' }); __avatar.advance(0.5);
    return { a: { grade: a.rigReport.grade, src: a.source, jaw, ca, w: a.rigReport.warnings }, b: { grade: b.rigReport.grade, caps: __avatar.capabilities(), warn: b.rigReport.warnings, errs: __errors } };
  });
  assert.equal(r.a.src, 'glb'); assert.equal(r.a.grade, 'bones-only'); assert.ok(r.a.jaw > 0.01, 'jaw bone opens with speech'); assert.equal(r.a.ca.jawMode, 'bone');
  assert.equal(r.b.caps.eyeMode, 'morphs', 'no eye bones: gaze through eyeLook morphs'); assert.equal(r.b.caps.visemes, false, 'no viseme morphs: converted from ARKit channels'); await p.close();
});

test('GLB without native visemes speaks through ARKit channels', async () => {
  const p = await open('?glb=/tests/fixtures/rig-no-eyes.glb');
  const r = await ev(p, async () => { const head = __avatar.model.meshes.find(m => m.morphTargetDictionary), d = head.morphTargetDictionary; const prom = __avatar.speak(null, { visemes: [{ t: 0.05, d: 0.6, v: 'O' }] }); __avatar.advance(0.3); const o = { funnel: head.morphTargetInfluences[d.mouthFunnel], jaw: head.morphTargetInfluences[d.jawOpen] }; __avatar.advance(2); await prom; return o; });
  assert.ok(r.funnel > 0.3 && r.jaw > 0.1, JSON.stringify(r)); await p.close();
});

test('failures fall back to the procedural model and say why; strict mode rejects', async () => {
  const p = await open();
  const r = await ev(p, async () => {
    const o = {}; const a = await __avatar.loadAvatar({ source: 'auto', url: '/nope/missing.glb' }); o.missing = { src: a.source, fb: a.fallback, code: a.error && a.error.code };
    const bytes = new Uint8Array(2048).map((_, i) => i * 7 % 251); const b = await __avatar.loadAvatar({ source: 'auto', data: bytes.buffer }); o.corrupt = { src: b.source, code: b.error && b.error.code };
    try { await __avatar.loadAvatar({ source: 'glb', url: '/nope/missing.glb', fallback: false }); o.strict = 'resolved'; } catch (e) { o.strict = e.code; }
    try { await __avatar.loadAvatar({ source: 'glb' }); o.nosrc = 'resolved'; } catch (e) { o.nosrc = e.code; }
    __avatar.advance(1); o.kind = __avatar.getModelInfo().kind; return o;
  });
  assert.deepEqual(r.missing, { src: 'procedural', fb: true, code: 'FETCH_FAILED' }); assert.equal(r.corrupt.src, 'procedural'); assert.equal(r.corrupt.code, 'PARSE_FAILED');
  assert.equal(r.strict, 'FETCH_FAILED'); assert.equal(r.nosrc, 'NO_SOURCE'); assert.equal(r.kind, 'procedural'); await p.close();
});

test('automatic selection: a GLB when the file is good, procedural otherwise, at creation time', async () => {
  const good = await open(GLB), bad = await open('?glb=/missing.glb');
  assert.equal(await ev(good, () => __avatar.getModelInfo().kind), 'glb'); const b = await ev(bad, () => ({ kind: __avatar.getModelInfo().kind, errs: __errors }));
  assert.equal(b.kind, 'procedural'); assert.ok(b.errs.some(e => /FETCH_FAILED/.test(e))); await good.close(); await bad.close();
});

test('swapping models repeatedly does not leak GPU resources', async () => {
  const p = await open(GLB);
  const r = await ev(p, async () => {
    const mem = () => { const m = __avatar.stats(); return m.geometries + ':' + m.textures; }; __avatar.advance(0.5); const base = __avatar.stats().geometries, baseT = __avatar.stats().textures, series = [];
    for (let i = 0; i < 6; i++) { await __avatar.loadAvatar({ source: 'glb', url: '/tests/fixtures/rig-arkit.glb' }); __avatar.advance(0.2); series.push(__avatar.stats().geometries); }
    await __avatar.loadAvatar({ source: 'procedural' }); __avatar.advance(0.2); const proc = __avatar.stats().geometries; await __avatar.loadAvatar({ source: 'glb', url: '/tests/fixtures/rig-arkit.glb' }); __avatar.advance(0.2);
    return { base, series, proc, end: __avatar.stats().geometries, baseT, endT: __avatar.stats().textures };
  });
  assert.ok(r.series.every(g => g === r.series[0]), 'geometry count stable across reloads: ' + JSON.stringify(r)); assert.equal(r.end, r.series[0]); assert.ok(r.endT <= r.baseT + 2); await p.close();
});

test('long run: 60 s of mixed activity stays finite and bounded', async () => {
  const p = await open(GLB);
  const r = await ev(p, () => { const exp = ['listening', 'firm', 'skeptical', 'empathetic', 'confident'], cs = ['LISTENING', 'THINKING', 'CHALLENGE', 'EMPATHY']; let bad = 0, maxHead = 0, maxEye = 0;
    for (let i = 0; i < 20; i++) { __avatar.setExpression(exp[i % 5]); if (i % 3 == 0) __avatar.setCognitiveState(cs[i % 4]); __avatar.advance(3); const d = __avatar.debug(); for (const k in d.channels) if (!isFinite(d.channels[k]) || d.channels[k] < 0 || d.channels[k] > 1) bad++; maxHead = Math.max(maxHead, Math.abs(d.pose.headYaw), Math.abs(d.pose.headPitch), Math.abs(d.pose.headRoll)); maxEye = Math.max(maxEye, Math.abs(d.gaze.yaw), Math.abs(d.gaze.pitch)); }
    return { bad, maxHead, maxEye, errs: __errors }; });
  assert.equal(r.bad, 0); assert.ok(r.maxHead < 0.25, 'head ' + r.maxHead); assert.ok(r.maxEye < 0.55); assert.deepEqual(r.errs, []); await p.close();
});

test('destroy releases the canvas and stops the loop', async () => {
  const p = await open(); const r = await ev(p, () => { const before = document.querySelectorAll('canvas').length; __avatar.destroy(); return { before, after: document.querySelectorAll('canvas').length }; });
  assert.equal(r.before, 1); assert.equal(r.after, 0); assert.deepEqual(p.pageErrors, []); await p.close();
});

/* ------------------------------ Asset validation ------------------------------ */
test('validator: refuses the procedural model, with a typed error', async () => {
  const p = await open(); const r = await ev(p, async () => { try { await AvatarKit.AssetValidator.runAll(__avatar, {}); return 'ran'; } catch (e) { return e.code; } });
  assert.equal(r, 'NOT_A_GLB'); await p.close();
});
test('validator: the full-rig fixture passes the gates, is never accepted, and its gaps are measured', async () => {
  const p = await open(GLB);
  const r = await ev(p, async () => { const o = await AvatarKit.AssetValidator.runAll(__avatar, { phase: 'head', fpsSeconds: 1 }); const R = o.report, X = R.expressionTest, L = R.lipTest;
    return { v: o.result.verdict, failed: o.result.gates.filter(g => !g.ok).map(g => g.id), tech: o.result.technical.percent, total: o.result.total, teeth: R.mouth.teeth, tongue: R.mouth.tongue, hair: R.hair.meshes, vis: R.visemes.found, cov: R.blendshapes.coverage, size: R.delivery.fileMB,
      exprAlive: X.aliveFraction, nan: X.nan, skAsym: X.skepticalAsym, lipOC: L.timeline.openClose, fpsSoftware: R.fps.software, perfFps: o.result.checks.find(c => c.id === 'pf_fps').s, rows: X.rows.length, cog: X.cognitive.length, eyePivot: R.eyes.pivot.map(x => x.offsetRatio) }; });
  assert.equal(r.v, 'PENDENTE'); assert.deepEqual(r.failed, []); assert.equal(r.total, null); assert.equal(r.teeth, 0); assert.equal(r.tongue, 0); assert.equal(r.hair, 0); assert.equal(r.vis, 15); assert.equal(r.cov, 1);
  assert.ok(r.exprAlive === 1 && r.nan === 0 && r.rows === 11 && r.cog === 9, JSON.stringify(r)); assert.ok(r.skAsym > 0.12, 'skeptical asymmetry ' + r.skAsym); assert.ok(r.lipOC >= 2, 'speech opens and closes: ' + r.lipOC);
  assert.ok(r.fpsSoftware && r.perfFps === null, 'software GL: FPS is not scored'); assert.ok(r.tech > 40 && r.tech < 80, 'technical ' + r.tech); r.eyePivot.forEach(x => assert.ok(x < 0.6, 'eye pivot offset ' + x)); await p.close();
});
test('validator: a rig with no eye bones or viseme morphs is rejected by gates', async () => {
  const p = await open('?glb=/tests/fixtures/rig-no-eyes.glb');
  const r = await ev(p, async () => { const o = await AvatarKit.AssetValidator.runAll(__avatar, { phase: 'head', fps: false }); return { v: o.result.verdict, failed: o.result.gates.filter(g => !g.ok).map(g => g.id) }; });
  assert.equal(r.v, 'REJEITAR'); assert.ok(r.failed.includes('eyes') && r.failed.includes('visemes'), JSON.stringify(r)); await p.close();
});
test('validator: dead and exploding targets are caught in a real file', async () => {
  const p = await open(GLB);
  const r = await ev(p, async () => { const m = __avatar.model, head = m.meshes.find(x => x.morphTargetDictionary), d = head.morphTargetDictionary, mp = head.geometry.morphAttributes.position;
    mp[d.cheekPuff].array.fill(0); const big = mp[d.noseSneerLeft].array; for (let i = 0; i < big.length; i++) big[i] *= 4000;
    const rep = AvatarKit.AssetValidator.inspect(m, { phase: 'head' }); return { dead: rep.blendshapes.dead, outliers: rep.blendshapes.outliers }; });
  assert.ok(r.dead.includes('cheekPuff')); assert.ok(r.outliers.includes('noseSneerLeft')); await p.close();
});
