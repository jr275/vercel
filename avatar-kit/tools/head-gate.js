#!/usr/bin/env node
// Head Prototype Gate: the command line.
//
//   node tools/head-gate.js init                                   create the registry and HEAD-001 as PENDING_ASSET
//   node tools/head-gate.js register HEAD-001 --file head.glb --vendor "Studio" [--name "..."] [--version 2] [--rigmap rigmap.json]
//   node tools/head-gate.js validate-head HEAD-001                 the whole automated review + the Golden Review Package
//   node tools/head-gate.js ratings-template HEAD-001              an empty ratings file
//   node tools/head-gate.js rate HEAD-001 --file ratings.json      merge the human ratings and rebuild the package
//   node tools/head-gate.js decide HEAD-001 --decision PASS|CONDITIONAL|REJECTED --by "Name" [--reason "..."]
//   node tools/head-gate.js status [HEAD-001]                      list candidates, or detail of one
//   node tools/head-gate.js report HEAD-001                        rebuild the package from the stored review (no browser)
//   node tools/head-gate.js compare HEAD-001 HEAD-002 ... [--out comparison.md]
//
// Options: --root <dir> (default review/ next to tools/). Nothing is contacted, bought or sent: this is local.
// Exit code: 0 ok, 1 error or REJECTED, 2 review still needs a person.
const fs = require('fs'), path = require('path'), http = require('http');
const { WA, HG, Registry, sha256, writePackage, compareMd, pad } = require('./head-gate-lib');
const args = process.argv.slice(2), cmd = args[0], rest = args.slice(1);
const flag = n => { const i = rest.indexOf('--' + n); return i >= 0 ? rest[i + 1] : undefined; };
const pos = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--')));
const KIT = path.join(__dirname, '..'), reg = new Registry(path.resolve(flag('root') || path.join(KIT, 'review')));
const out = x => console.log(x), die = (m, c) => { console.error('ERROR: ' + m); process.exit(c || 1); };
const need = i => pos[i] || die('missing argument (candidate id)');

function strip(review) { const r = JSON.parse(JSON.stringify(review)); r.shots.forEach(s => delete s.dataUrl); r.speech.stills.forEach(s => delete s.dataUrl); r.presence.frames.forEach(s => delete s.dataUrl); r.expression.rows.forEach(s => delete s.dataUrl); return r; }
function summary(c) {
  const rec = c.review ? HG.recommend(c.review.automated, c.review.ratings) : null, S = rec && rec.scores.sections, f = k => S && S[k].value != null ? S[k].value + '%' : (S ? 'HUMAN REVIEW' : '-');
  return (c.id + ' v' + c.version).padEnd(14) + c.state.padEnd(14) + ('tech ' + f('TECHNICAL')).padEnd(14) + ('speech ' + f('SPEECH')).padEnd(18) + ('presence ' + f('PRESENCE')).padEnd(20) + (rec ? 'rec ' + rec.recommendation : '') + '  ' + (c.name || '');
}

async function validateHead(id) {
  let c = reg.get(id); if (!c.asset) die(id + ' is PENDING_ASSET: register a GLB first (head-gate register ' + id + ' --file head.glb)');
  require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'build.js')], { stdio: 'ignore' });
  const glb = path.join(reg.vdir(c.id, c.version), 'asset.glb'); if (!fs.existsSync(glb)) die('asset file missing: ' + glb);
  const buf = fs.readFileSync(glb); if (sha256(buf) !== c.asset.sha256) die('the stored GLB does not match the registered hash: the candidate was changed after registration');
  const { chromium } = require(process.env.PLAYWRIGHT_PATH || (() => { try { require.resolve('playwright'); return 'playwright'; } catch (e) { return '/opt/node22/lib/node_modules/playwright'; } })()), MIME = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm' };
  const srv = http.createServer((q, r) => { const f = path.join(KIT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(KIT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
  await new Promise(r => srv.listen(0, r));
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  try {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', e => console.error('pageerror:', e.message));
    await p.goto('http://localhost:' + srv.address().port + '/tests/browser/harness.html', { waitUntil: 'commit' }); await p.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
    out('Reviewing ' + c.id + ' v' + c.version + ' (' + (buf.length / 1048576).toFixed(2) + ' MB) under configuration ' + HG.configHash() + ' ...');
    const t0 = Date.now(), review = await p.evaluate(async ({ b64, source }) => {
      const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return AvatarKit.HeadReview.run({ id: source.id, version: source.version, sha256: source.sha256, data: u.buffer, rigMap: source.rigMap }, { keepImages: true, fps: true });
    }, { b64: buf.toString('base64'), source: { id: c.id, version: c.version, sha256: c.asset.sha256, rigMap: c.rigMap || undefined } });
    out('Review finished in ' + Math.round((Date.now() - t0) / 1000) + ' s. Renderer: ' + review.renderer.renderer + (review.software ? ' (software: FPS not valid)' : ''));
    const images = { shots: review.shots, speech: review.speech.stills, presence: review.presence.frames, expression: review.expression.rows };
    c = HG.attachReview(c, strip(review)); reg.save(c);
    const res = writePackage(reg, c, images); out('Golden Review Package: ' + res.dir);
    return c;
  } finally { await b.close(); srv.close(); }
}

(async () => {
  try {
    if (cmd === 'init') {
      fs.mkdirSync(path.join(reg.root, 'candidates'), { recursive: true });
      if (!reg.has('HEAD-001')) reg.save(HG.createCandidate({ id: 'HEAD-001', name: 'First head from the selected vendor', notes: 'PENDING_ASSET: waiting for the first real GLB.' }));
      out('Registry: ' + reg.root); reg.list().forEach(c => out('  ' + summary(c)));
    } else if (cmd === 'register') {
      const id = need(0), file = flag('file'); if (!file || !fs.existsSync(file)) die('--file <head.glb> is required and must exist');
      const buf = fs.readFileSync(file); if (buf.slice(0, 4).toString('latin1') !== 'glTF') die('not a binary glTF (.glb) file');
      let c = reg.has(id) ? reg.get(id) : HG.createCandidate({ id, name: flag('name'), vendor: flag('vendor'), sample: rest.includes('--sample') });
      if (flag('name')) c.name = flag('name'); if (flag('rigmap')) c.rigMap = JSON.parse(fs.readFileSync(flag('rigmap'), 'utf8'));
      const version = flag('version') ? +flag('version') : c.version + 1;
      c = HG.registerAsset(c, { file: path.basename(file), sha256: sha256(buf), bytes: buf.length, version, vendor: flag('vendor') });
      fs.mkdirSync(reg.vdir(id, c.version), { recursive: true }); fs.writeFileSync(path.join(reg.vdir(id, c.version), 'asset.glb'), buf); reg.save(c);
      out('Registered ' + id + ' v' + c.version + ' (' + (buf.length / 1048576).toFixed(2) + ' MB, sha256 ' + c.asset.sha256.slice(0, 12) + '...). State: ' + c.state + '. Next: validate-head ' + id);
    } else if (cmd === 'validate-head') {
      const c = await validateHead(need(0)), rec = HG.recommend(c.review.automated, c.review.ratings);
      out('\n' + summary(c)); out('Recommendation: ' + rec.recommendation + (rec.auto ? ' (automatic rules)' : '')); rec.why.forEach(w => out('  - ' + w)); rec.todo.forEach(w => out('  * ' + w));
      process.exit(rec.recommendation === 'REJECTED' ? 1 : rec.recommendation === 'UNDER_REVIEW' ? 2 : 0);
    } else if (cmd === 'ratings-template') {
      const id = need(0), items = WA.ReviewPage.humanItems(), t = { reviewers: ['name'], items: {}, speech: {}, presenceVotes: { A: { yes: 0, no: 0 }, B: { yes: 0, no: 0 }, C: { yes: 0, no: 0 } }, humanBarriers: {}, likeness: { names: 0, of: 10 }, blind: { picked: 0, of: 10 }, dnaTraits: 0 };
      items.forEach(i => t.items[i.id] = null); HG.SPEECH_ITEMS.forEach(k => t.speech[k] = null); HG.HR.forEach(h => { if (h[2].includes('human')) t.humanBarriers[h[0]] = null; });
      const f = flag('out') || id + '.ratings.json'; fs.writeFileSync(f, JSON.stringify(t, null, 1)); out('Wrote ' + f + ' (null = not rated; remove or fill).');
    } else if (cmd === 'rate') {
      const id = need(0), f = flag('file'); if (!f) die('--file ratings.json is required');
      const raw = JSON.parse(fs.readFileSync(f, 'utf8')), clean = o => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v != null)); raw.items = clean(raw.items); raw.speech = clean(raw.speech); raw.humanBarriers = clean(raw.humanBarriers);
      let c = HG.attachRatings(reg.get(id), raw); reg.save(c); const res = writePackage(reg, c, null); out(summary(c)); res.rec.why.forEach(w => out('  - ' + w)); res.rec.todo.forEach(w => out('  * ' + w));
    } else if (cmd === 'decide') {
      const id = need(0); let c = reg.get(id); c = HG.decide(c, flag('decision'), flag('by'), flag('reason')); reg.save(c); writePackage(reg, c, null); out(id + ' -> ' + c.state + ' (signed by ' + c.decision.by + ')');
    } else if (cmd === 'report') {
      const c = reg.get(need(0)); if (!c.review) die('no review stored'); const r = writePackage(reg, c, null); out('Rebuilt ' + r.dir + ' (images are kept from the last validate-head)'); out('Recommendation: ' + r.rec.recommendation);
    } else if (cmd === 'status') {
      const l = pos.length ? [reg.get(pos[0])] : reg.list(); if (!l.length) out('No candidates. Run: head-gate init');
      l.forEach(c => { out(summary(c)); if (pos.length) { c.log.forEach(e => out('   ' + e.date + '  ' + e.state.padEnd(14) + e.event + (e.by ? ' (' + e.by + ')' : ''))); if (c.review) { const rec = HG.recommend(c.review.automated, c.review.ratings); rec.why.forEach(w => out('   - ' + w)); rec.todo.forEach(w => out('   * ' + w)); } } });
    } else if (cmd === 'compare') {
      const ids = pos.length ? pos : reg.list().map(c => c.id); const cmp = HG.compare(ids.map(i => reg.get(i))), md = compareMd(cmp); if (flag('out')) { fs.writeFileSync(flag('out'), md); out('Wrote ' + flag('out')); } out(md);
    } else { out(fs.readFileSync(__filename, 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n')); }
  } catch (e) { die(e.code ? e.code + ': ' + e.message : e.stack || e.message); }
})();
