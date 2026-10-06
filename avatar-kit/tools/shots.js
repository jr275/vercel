// usage: node tools/shots.js page.html outPrefix w h "name1=js1" ...   (each step: run js, wait, screenshot)
const { chromium } = require(process.env.PLAYWRIGHT_PATH || (() => { try { require.resolve('playwright'); return 'playwright'; } catch (e) { return '/opt/node22/lib/node_modules/playwright'; } })());
(async () => {
  const [,, page, prefix, w, h, ...steps] = process.argv;
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  const logs = []; p.on('console', m => logs.push(m.type() + ': ' + m.text())); p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  await p.goto(page.startsWith('http') ? page : 'file://' + require('path').resolve(page), { timeout: 180000, waitUntil: 'commit' });
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 170000 }).catch(() => logs.push('NOT READY'));
  for (const st of steps) {
    const i = st.indexOf('='); const name = st.slice(0, i), js = st.slice(i + 1);
    if (js) { const r = await p.evaluate(js); if (r !== undefined) logs.push(name + ' -> ' + JSON.stringify(r)); }
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${prefix}_${name}.png`, fullPage: !!process.env.FULL });
  }
  console.log(logs.slice(0, 20).join('\n') || 'no console output');
  await b.close();
})();
