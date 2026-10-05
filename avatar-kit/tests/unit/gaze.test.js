const test = require('node:test'), assert = require('node:assert');
const load = require('./load');
const WA = load(['core/util.js', 'model/channels.js', 'control/GazeController.js', 'control/AnimationController.js']);
function sim(g, sec, inp, t0 = 0) { const log = []; for (let i = 0; i < sec * 60; i++) { const o = g.update(1 / 60, t0 + i / 60, typeof inp === 'function' ? inp(i) : inp); log.push({ yaw: o.yaw, pitch: o.pitch, away: o.away, eyes: JSON.parse(JSON.stringify(o.eyes)), phase: o.phase }); } return log; }

test('direct gaze is never perfectly still (micro-saccades)', () => {
  const g = new WA.GazeController(); const l = sim(g, 6, { mode: 'hold' }); const ys = l.map(x => x.yaw);
  const range = Math.max(...ys) - Math.min(...ys); assert.ok(range > 0.002 && range < 0.06, 'range ' + range);
  const changes = l.filter((x, i) => i && Math.abs(x.yaw - l[i - 1].yaw) > 1e-4).length; assert.ok(changes > 60);
});
test('think mode: looks away and down, then returns to direct', () => {
  const g = new WA.GazeController(); const l = sim(g, 20, { mode: 'think' });
  assert.ok(l.some(x => x.away && x.pitch < -0.1), 'looked down while away');
  const firstAway = l.findIndex(x => x.away); assert.ok(firstAway >= 0 && l.slice(firstAway).some(x => !x.away && Math.abs(x.yaw) < 0.05), 'returned to direct');
});
test('eyes are asymmetric: converge and differ slightly per eye', () => {
  const g = new WA.GazeController(); const l = sim(g, 4, { mode: 'hold' }); const e = l[l.length - 1].eyes;
  assert.ok(e.yawL > e.yawR, 'converged'); assert.ok(l.some(x => Math.abs(x.eyes.pitchL - x.eyes.pitchR) > 1e-4));
});
test('eye contact does not become a stare in attend mode', () => {
  const g = new WA.GazeController(); const l = sim(g, 60, { mode: 'attend' }); let run = 0, worst = 0;
  l.forEach(x => { if (!x.away) { run++; worst = Math.max(worst, run); } else run = 0; });
  assert.ok(worst / 60 < 11, 'longest direct run ' + (worst / 60).toFixed(1) + 's'); assert.ok(l.filter(x => x.away).length > 60);
});
test('aim: left/right are screen directions, camera compensates for orbit', () => {
  const g = new WA.GazeController(); g.setAim('left'); let l = sim(g, 2, { mode: 'hold' }); assert.ok(l[l.length - 1].yaw < -0.3);
  g.setAim('right'); l = sim(g, 2, { mode: 'hold' }, 2); assert.ok(l[l.length - 1].yaw > 0.3);
  g.setAim('camera'); l = sim(g, 2, { mode: 'hold', viewYaw: 0.4 }, 4); assert.ok(l[l.length - 1].yaw > 0.25);
  assert.equal(g.setAim('nowhere'), false);
});
test('eye speed is bounded (jumps are fast but finite)', () => {
  const g = new WA.GazeController(); g.setAim('center'); sim(g, 1, { mode: 'hold' }); g.setAim('right'); const l = sim(g, 1, { mode: 'hold' }, 1);
  let v = 0; l.forEach((x, i) => { if (i) v = Math.max(v, Math.abs(x.yaw - l[i - 1].yaw) * 60); }); assert.ok(v < 14 && v > 1, 'peak rad/s ' + v);
});
test('speak mode: looks away as speech begins, returns on emphasis', () => {
  const g = new WA.GazeController(); sim(g, 2, { mode: 'speak' });
  let l = sim(g, 3, { mode: 'speak', speaking: true, silence: 0, emphasis: 0 }, 2); assert.ok(l.some(x => x.away));
  l = sim(g, 0.5, { mode: 'speak', speaking: true, silence: 0, emphasis: 0.8 }, 5); assert.ok(l.slice(-5).every(x => !x.away));
});
test('animation: head follows gaze only partly and lags; blink spacing is natural', () => {
  const a = new WA.AnimationController(); let blinks = 0, was = 0, maxHead = 0;
  for (let i = 0; i < 60 * 40; i++) { const o = a.update(1 / 60, i / 60, { motion: 1, gaze: { yaw: 0.4, pitch: 0 }, head: { yaw: 0, pitch: 0, roll: 0 }, blinkScale: 1 });
    if (o.blink > 0.5 && was <= 0.5) blinks++; was = o.blink; maxHead = Math.max(maxHead, Math.abs(o.pose.headYaw)); }
  assert.ok(blinks >= 6 && blinks <= 18, 'blinks in 40 s: ' + blinks); assert.ok(maxHead > 0.1 && maxHead < 0.3, 'head yaw ' + maxHead);
});
test('animation: idle head motion stays small', () => {
  const a = new WA.AnimationController(); let m = 0; for (let i = 0; i < 60 * 30; i++) { const p = a.update(1 / 60, i / 60, { motion: 1, gaze: { yaw: 0, pitch: 0 }, head: { yaw: 0, pitch: 0, roll: 0 } }).pose; m = Math.max(m, Math.abs(p.headYaw), Math.abs(p.headPitch), Math.abs(p.headRoll)); }
  assert.ok(m < 0.045, 'max idle head angle (rad) ' + m);
});
