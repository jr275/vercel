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
const stateText = p => p.locator('.state-tag span').first().innerText();
const waitState = (p, s, ms = 60000) => p.waitForFunction(x => document.querySelector('.state-tag span')?.textContent === x, s, { timeout: ms });
const begin = async p => { await p.getByRole('button', { name: 'Press to begin' }).click({ timeout: 90000 }); await p.waitForSelector('.bar'); };

const p = await open(1280, 800);
await step('the start screen waits for the character, then offers one button', async () => {
  await p.screenshot({ path: join(OUT, '00_loading.png') });
  await p.getByRole('button', { name: 'Press to begin' }).waitFor({ timeout: 90000 });
  await p.screenshot({ path: join(OUT, '01_start.png') });
});
await step('begin: the bar, one word of status and no dashboard', async () => {
  await begin(p);
  assert.equal(await stateText(p), 'Ready');
  assert.equal(await p.locator('.bar').count(), 1);
  assert.equal(await p.locator('.card, nav, aside:visible').count(), 0);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: join(OUT, '02_ready.png') });
});
await step('typing a message: she thinks, speaks, and returns to ready; the transcript has both sides', async () => {
  await p.locator('#message').fill('Should I replace my head of sales?');
  await p.locator('#message').press('Enter');
  await waitState(p, 'Thinking', 20000);
  await p.screenshot({ path: join(OUT, '03_thinking.png') });
  await waitState(p, 'Speaking', 30000);
  await p.screenshot({ path: join(OUT, '04_speaking.png') });
  await waitState(p, 'Ready', 90000);
  await p.keyboard.press('t');
  await p.waitForSelector('.drawer.is-open');
  const lines = await p.locator('.line').allInnerTexts();
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^You\s+Should I replace my head of sales\?/);
  assert.match(lines[1], /^Advisor\s+\S/);
  await p.screenshot({ path: join(OUT, '05_transcript.png') });
  await p.keyboard.press('Escape');
});
await step('interruption: sending while she speaks stops her and she answers the new message', async () => {
  await p.locator('#message').fill('Tell me what you think.');
  await p.locator('#message').press('Enter');
  await waitState(p, 'Speaking', 40000);
  await p.locator('#message').fill('Wait, one more thing.');
  await p.locator('#message').press('Enter');
  await p.waitForFunction(() => ['Listening', 'Thinking'].includes(document.querySelector('.state-tag span')?.textContent ?? ''), null, { timeout: 20000 });
  assert.equal(await p.evaluate(() => window.__runtime.isSpeaking()), false);
  await waitState(p, 'Speaking', 40000);
  await waitState(p, 'Ready', 90000);
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
  await m.keyboard.press('t').catch(() => {});
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
