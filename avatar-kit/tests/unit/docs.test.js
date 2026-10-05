const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const D = path.join(__dirname, '../../docs'), read = f => fs.readFileSync(path.join(D, f), 'utf8');
const VS = require('../../tools/visual-scorecard-data');

test('visual scorecard: 100 points, unique item ids, barriers defined', () => {
  assert.equal(VS.categories.reduce((a, c) => a + c.weight, 0), 100);
  const ids = VS.categories.flatMap(c => c.items.map(i => i[0])); assert.equal(new Set(ids).size, ids.length);
  assert.equal(VS.barriers.length, 14); VS.categories.forEach(c => c.items.forEach(i => assert.match(i[2], /^[014](,[014])*$/)));
});
test('every generated block in every doc is closed and filled', () => {
  fs.readdirSync(D).filter(f => f.endsWith('.md')).forEach(f => { const s = read(f), begins = s.match(/<!-- BEGIN:\w+ -->/g) || [], ends = s.match(/<!-- END:\w+ -->/g) || []; assert.equal(begins.length, ends.length, f);
    for (const m of s.matchAll(/<!-- BEGIN:(\w+) -->\n([\s\S]*?)\n<!-- END:\1 -->/g)) assert.ok(m[2].trim().length > 20, f + ' block ' + m[1] + ' is empty'); });
});
test('the vendor brief carries the Bible and never the internal reference', () => {
  const b = read('EXECUTIVE_AVATAR_ASSET_BRIEF.md');
  ['Vera Halden', '1.38 : 1', '118° to 125°', '#4A3426', 'Visual DNA', 'PART 11: DELIVERY', 'PART 1: CHARACTER'].forEach(t => assert.ok(b.includes(t), 'brief lacks ' + t));
  for (let i = 1; i <= 11; i++) assert.ok(new RegExp('## PART ' + i + ':').test(b), 'missing PART ' + i);
  [/Wendy/i, /Rhoades/i, /Maggie/i, /Siff/i, /INTERNAL/, /behaviou?r(al)? reference/i, /Billions/i].forEach(re => assert.ok(!re.test(b), 'leak: ' + re));
  assert.ok(!/\b[Ss]ections? \d/.test(b), 'dangling "section N" references from the Bible');
});
test('the Bible keeps the internal note and the ten expressions', () => {
  const s = read('EXECUTIVE_AVATAR_CHARACTER_BIBLE.md'); assert.ok(/Wendy Behavioral System/.test(s));
  ['NEUTRAL', 'LISTENING', 'THINKING', 'ANALYZING', 'SKEPTICAL', 'FIRM', 'EMPATHETIC', 'CONCERNED', 'CONFIDENT', 'DECISIVE'].forEach(n => assert.ok(s.includes('**' + n + '**'), n));
  assert.equal((s.match(/^\d+\. \*\*/gm) || []).length >= 10, true, 'visual DNA has 10 traits');
});
test('documents reference only files that exist', () => {
  fs.readdirSync(D).filter(f => f.endsWith('.md')).forEach(f => { for (const m of read(f).matchAll(/`((?:EXECUTIVE_AVATAR_\w+|ASSET_\w+|ARCHITECTURE)\.md)`/g)) assert.ok(fs.existsSync(path.join(D, m[1])), f + ' -> ' + m[1]); });
});
test('vendor evaluation weights add to 100', () => {
  const s = read('EXECUTIVE_AVATAR_VENDOR_EVALUATION.md'); const rows = [...s.matchAll(/^\| (C\d+) \|[^|]*\| (\d+) \|/gm)].map(m => +m[2]); assert.equal(rows.length, 15); assert.equal(rows.reduce((a, b) => a + b, 0), 100);
});
