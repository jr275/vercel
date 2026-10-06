// End-to-end check of the front end in a real browser: node tests/e2e.mjs   (needs `npm run build` first and Playwright)
// Starts `next start`, drives the page like a user (start, type, interrupt, hold to talk, presence, settings, 390 px) and saves screenshots to ../../review/web/.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || (() => { try { require.resolve('playwright'); return 'playwright'; } catch { return '/opt/node22/lib/node_modules/playwright'; } })());
const OUT = join(here, '..', '..', 'review', 'web');
mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT || '3107';
const base = `http://localhost:${PORT}`;

const server = spawn(process.execPath, [join(here, '..', 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', PORT], { cwd: join(here, '..'), stdio: 'ignore' });
const stop = () => server.kill();
process.on('exit', stop);
for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n    ', String(e.message).split('\n')[0]); } };

async function open(w, h) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  p.errors = [];
  p.on('pageerror', e => p.errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) p.errors.push(m.text()); });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto(`${base}/?debug`, { waitUntil: 'domcontentloaded' });
  return p;
}
const stateText = async p => { const v = await p.locator('.state-tag').getAttribute('data-state'); return v[0].toUpperCase() + v.slice(1); };
const waitState = (p, s, ms = 60000) => p.waitForFunction(x => document.querySelector('.state-tag')?.getAttribute('data-state') === x.toLowerCase(), s, { timeout: ms });
// the status changes faster than a polling check can see on a slow renderer, so record every change
const track = p => p.evaluate(() => {
  window.__seen = [];
  const el = document.querySelector('.state-tag');
  const push = () => { const v = el.getAttribute('data-state'), l = window.__seen[window.__seen.length - 1]; if (!l || l.s !== v) window.__seen.push({ s: v, speaking: window.__runtime.isSpeaking() }); };
  push();
  new MutationObserver(push).observe(el, { attributes: true, attributeFilter: ['data-state'] });
});
const seen = p => p.evaluate(() => window.__seen);
const waitSeen = async (p, fn, ms = 90000) => {
  try { await p.waitForFunction(f => new Function('seen', 'return (' + f + ')(seen)')(window.__seen), fn.toString(), { timeout: ms }); }
  catch (e) { throw new Error('status sequence seen: ' + (await seen(p)).map(x => x.s).join('>') + '\n' + e.message); }
};
const begin = async p => { await p.getByRole('button', { name: 'Press to begin' }).click({ timeout: 90000 }); await p.waitForSelector('.bar'); };

const p = await open(1440, 900);
await step('the start screen waits for the character, then offers one button', async () => {
  await p.screenshot({ path: join(OUT, '00_loading.png') });
  await p.getByRole('button', { name: 'Press to begin' }).waitFor({ timeout: 90000 });
  await p.screenshot({ path: join(OUT, '01_start.png') });
});
await step('begin: the bar, one word of status and no dashboard', async () => {
  await begin(p);
  assert.equal(await stateText(p), 'Ready');
  assert.equal(await p.locator('.bar').count(), 1);
  assert.equal(await p.locator('.card, nav, [role="tablist"]').count(), 0);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: join(OUT, '02_ready.png') });
});
await step('typing a message: she thinks, speaks, and returns to ready; the transcript has both sides', async () => {
  await track(p);
  await p.locator('#message').fill('Should I replace my head of sales?');
  await p.locator('#message').press('Enter');
  await waitSeen(p, seen => seen.some(x => x.s === 'speaking'), 60000);
  await p.screenshot({ path: join(OUT, '04_speaking.png') });
  await waitSeen(p, seen => seen.map(x => x.s).join('>').includes('speaking>ready'));
  const order = (await seen(p)).map(x => x.s);
  assert.ok(order.indexOf('thinking') >= 0 && order.indexOf('thinking') < order.indexOf('speaking'), 'thinking comes before speaking: ' + order.join('>'));
  await p.evaluate(() => document.activeElement?.blur());   // typing a letter in the field must not toggle panels
  await p.keyboard.press('t');
  await p.waitForSelector('.drawer.is-open');
  const lines = await p.locator('.line').allInnerTexts();
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^you\s+Should I replace my head of sales\?/i);
  assert.match(lines[1], /^advisor\s+\S/i);
  await p.screenshot({ path: join(OUT, '05_transcript.png') });
  await p.keyboard.press('Escape');
});
await step('interruption: sending while she speaks stops her and she answers the new message', async () => {
  await p.screenshot({ path: join(OUT, 'loop_1_ready.png') });
  await track(p);
  await p.locator('#message').fill('Tell me what you think.');
  await p.locator('#message').press('Enter');
  await waitSeen(p, seen => seen.some(x => x.s === 'speaking'), 60000);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: join(OUT, 'loop_2_speaking.png') });
  await p.locator('#message').fill('Wait, one more thing.');
  await p.locator('#message').press('Enter');
  await waitSeen(p, seen => { const i = seen.findIndex(x => x.s === 'speaking'); return seen.slice(i + 1).some(x => x.s === 'listening' || x.s === 'thinking'); }, 30000);
  const all = await seen(p), i = all.findIndex(x => x.s === 'speaking'), after = all.slice(i + 1).find(x => x.s === 'listening' || x.s === 'thinking');
  assert.equal(after.speaking, false, 'her voice stopped when the user interrupted');
  await p.screenshot({ path: join(OUT, 'loop_3_interrupted_recovering.png') });
  await waitSeen(p, seen => seen.filter(x => x.s === 'speaking').length >= 2);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: join(OUT, 'loop_4_speaking_again.png') });
  await waitSeen(p, seen => seen.map(x => x.s).join('>').match(/speaking>.*speaking>ready$/));
  await p.waitForTimeout(800);
  await p.screenshot({ path: join(OUT, 'loop_5_ready.png') });
});
await step('hold to talk: listening while held, thinking when released', async () => {
  const talk = p.locator('.talk');
  const box = await talk.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await waitState(p, 'Listening', 20000);
  await p.screenshot({ path: join(OUT, '06_listening.png') });
  await p.mouse.up();
  await waitState(p, 'Thinking', 20000);
  await waitState(p, 'Ready', 120000);
});
await step('presence mode hides everything but her; Esc brings the interface back', async () => {
  await p.keyboard.press('p');
  await p.waitForSelector('.app.is-presence');
  await p.waitForTimeout(600);
  await p.screenshot({ path: join(OUT, '07_presence.png') });
  assert.equal(await p.locator('.bar').evaluate(el => getComputedStyle(el.closest('.bottom')).opacity), '0');
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('.app.is-presence'));
});
await step('settings: framing changes the camera, captions show her words, voice can be switched', async () => {
  await p.getByRole('button', { name: 'Settings' }).click();
  await p.getByLabel('Framing').selectOption('CLOSE');
  assert.equal(await p.evaluate(() => window.__runtime.getShot()), 'CLOSE');
  await p.getByLabel('Voice').selectOption('synthetic');
  assert.equal(await p.evaluate(() => window.__runtime.speechProvider()), 'synthetic');
  await p.getByLabel('Captions').check();
  await p.keyboard.press('Escape');
  await p.locator('#message').fill('Say it plainly.');
  await p.locator('#message').press('Enter');
  await p.waitForSelector('.captions.on', { timeout: 40000 });
  assert.ok((await p.locator('.captions').innerText()).length > 10);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: join(OUT, '08_close_captions.png') });
  await waitState(p, 'Ready', 90000);
});
await step('no console or page errors on desktop', async () => { assert.deepEqual(p.errors, []); });
await p.close();

const m = await open(390, 844);
await step('mobile 390 px: no horizontal overflow, the bar sits inside the screen, no errors', async () => {
  await begin(m);
  await m.waitForTimeout(2500);
  const r = await m.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bar: document.querySelector('.bar').getBoundingClientRect().toJSON(), h: innerHeight }));
  assert.ok(r.sw <= r.cw, 'no horizontal scroll');
  assert.ok(r.bar.left >= 0 && r.bar.right <= r.cw && r.bar.bottom <= r.h);
  await m.screenshot({ path: join(OUT, '09_mobile.png') });
  await m.getByRole('button', { name: /Transcript/ }).click();
  await m.waitForSelector('.drawer.is-open');
  await m.screenshot({ path: join(OUT, '10_mobile_transcript.png') });
  assert.deepEqual(m.errors, []);
});
await m.close();
await browser.close();
stop();
console.log(failed ? `\n${failed} step(s) failed` : '\nall steps passed');
process.exit(failed ? 1 : 0);
