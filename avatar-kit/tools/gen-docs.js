// node tools/gen-docs.js   regenerates the tables inside the docs from the source of truth (channels, emotions, checks, rubric)
// Blocks are delimited by <!-- BEGIN:name --> ... <!-- END:name -->
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
global.window = global; global.THREE = { DoubleSide: 2 };
const load = require('../tests/unit/load'); const WA = load(['core/util.js', 'model/channels.js', 'control/ExpressionController.js', 'control/CognitiveState.js', 'validate/AssetValidator.js']);
const C = WA.Channels, AV = WA.AssetValidator, EM = WA.ExpressionController.EMOTIONS, CS = WA.CognitiveState.STATES;
const good = require('../tests/unit/good-report')(C)();
const blocks = {
  arkit: () => ['| # | Channel | # | Channel | # | Channel |', '|---|---|---|---|---|---|'].concat(Array.from({ length: 18 }, (_, i) => '| ' + [i, i + 18, i + 36].filter(k => k < 52).map(k => (k + 1) + ' | `' + C.ARKIT[k] + '`').join(' | ') + ' |')).join('\n'),
  visemes: () => { const ex = { sil: 'silence', PP: 'p, b, m', FF: 'f, v', TH: 'th', DD: 't, d', kk: 'k, g', CH: 'ch, j, sh', SS: 's, z', nn: 'n, l', RR: 'r', aa: 'ah (father)', E: 'eh (bed)', I: 'ih/ee (see)', O: 'oh (go)', U: 'oo (blue)' }; return ['| Morph target | Sound | Required on meshes |', '|---|---|---|'].concat(C.VISEMES.map(v => '| `' + v + '` | ' + ex[v.replace('viseme_', '')] + ' | ' + (/TH|DD|nn|RR|kk/.test(v) ? 'skin, teeth, **tongue**' : /PP|FF|aa|O|U|E|I|CH|SS/.test(v) ? 'skin, teeth' + (/aa|O|E|U|I/.test(v) ? ', tongue' : '') : 'skin') + ' |')).join('\n'); },
  recipes: () => ['| Emotion | Channels at full intensity (0..1) | Head (rad) | Gaze behaviour |', '|---|---|---|---|'].concat(Object.keys(EM).map(n => { const e = EM[n]; const f = Object.keys(e.face).map(k => k + ' ' + e.face[k]).join(', ') || '(baseline only)'; const h = Object.keys(e.head).map(k => k + ' ' + e.head[k]).join(', ') || '-'; return '| ' + n + ' | ' + f + ' | ' + h + ' | ' + e.gaze + ' |'; })).join('\n'),
  states: () => ['| Cognitive state | Emotion mix | Gaze | Blink rate | Notes |', '|---|---|---|---|---|'].concat(Object.keys(CS).map(n => { const s = CS[n]; return '| ' + n + ' | ' + s.mix.map(m => m[0] + ' ' + m[1]).join(' + ') + ' | ' + s.gaze + ' | x' + s.blink + ' | ' + (s.nods ? 'nods ' + s.nods : '') + (s.beat ? ' decision beat' : '') + ' |'; })).join('\n'),
  checks: () => { const r = AV.evaluate(good, { phase: 'full' }); const cat = Object.fromEntries(AV.CATEGORIES.map(c => [c.id, c.label])); return ['| Category | Check | Points (auto) |', '|---|---|---|'].concat(r.checks.filter(c => c.w > 0).map(c => '| ' + cat[c.cat] + ' | ' + c.label + ' | ' + c.w + ' |')).join('\n'); },
  gates: () => AV.evaluate(good, { phase: 'full', manual: { scores: Object.fromEntries(AV.RUBRIC.map(i => [i.id, 5])), overall: 'premium' } }).gates.map(g => '* ' + g.label).join('\n'),
  categories: () => ['| Category | Points | Automatic | Human rubric |', '|---|---|---|---|'].concat(AV.CATEGORIES.map(c => '| ' + c.label + ' | ' + c.weight + ' | ' + +(c.weight * c.auto).toFixed(1) + ' | ' + +(c.weight * (1 - c.auto)).toFixed(1) + ' |')).concat(['| **Total** | **100** | **54** | **46** |']).join('\n'),
  rubric: () => ['| Category | Item (score 0 to 5) |', '|---|---|'].concat(AV.RUBRIC.map(i => '| ' + AV.CATEGORIES.find(c => c.id === i.cat).label + ' | ' + i.label + ' |')).join('\n'),
  phases: () => ['| | Phase 1 (head) | Final character |', '|---|---|---|', '| File size (target / hard limit) | ' + AV.PHASES.head.fileMB + ' MB / ' + AV.PHASES.head.fileHardMB + ' MB | ' + AV.PHASES.full.fileMB + ' MB / ' + AV.PHASES.full.fileHardMB + ' MB |', '| Triangles (all meshes) | ' + AV.PHASES.head.tris.toLocaleString('en-US') + ' | ' + AV.PHASES.full.tris.toLocaleString('en-US') + ' |', '| Draw calls | ' + AV.PHASES.head.drawCalls + ' | ' + AV.PHASES.full.drawCalls + ' |', '| Texture memory (GPU) | ' + AV.PHASES.head.texMB + ' MB | ' + AV.PHASES.full.texMB + ' MB |', '| Skinned meshes | ' + AV.PHASES.head.skinned + ' | ' + AV.PHASES.full.skinned + ' |'].join('\n')
};
const VS = require('./visual-scorecard-data');
/* sections of the Character Bible, made vendor-safe: no reference to the internal behaviour source, no internal notes */
const bible = fs.readFileSync(path.join(root, 'docs/EXECUTIVE_AVATAR_CHARACTER_BIBLE.md'), 'utf8');
function bibleSection(n) {
  const re = new RegExp('^## ' + n + '\\. .*$', 'm'), m = re.exec(bible); if (!m) throw new Error('Bible section ' + n + ' not found');
  const rest = bible.slice(m.index + m[0].length), end = rest.search(/\n## \d+\. /); let body = end < 0 ? rest : rest.slice(0, end);
  body = body.replace(/\n---\s*$/, '').split('\n').filter(l => !/Wendy|behaviou?r(al)? reference|INTERNAL:/i.test(l)).join('\n').trim();
  const PART = { 1: 'Part 1', 2: 'Part 3', 3: 'Part 3 (eyes)', 4: 'Part 7', 5: 'Part 5', 6: 'Part 4', 7: 'Part 6', 8: 'Part 6', 9: 'Part 8', 10: 'Part 8', 11: 'Part 7', 12: 'Part 2', 13: 'Part 2', 14: 'Part 2' };
  body = body.replace(/\b[Ss]ections? (\d+)(?:\.\d+)?/g, (m, d) => PART[d] || m);
  body = body.replace(/^(#{3,4}) \d+(?:\.\d+)* /gm, '$1 ').replace(/the Brief, Part/g, 'Part');
  return body;
}
for (let i = 0; i <= 15; i++) blocks['bible' + i] = () => bibleSection(i);
blocks.vcategories = () => ['| Category | Points | Items |', '|---|---|---|'].concat(VS.categories.map(c => '| ' + c.id + ' | ' + c.weight + ' | ' + c.items.length + ' |')).concat(['| **Total** | **100** | ' + VS.categories.reduce((a, c) => a + c.items.length, 0) + ' |']).join('\n');
blocks.vitems = () => VS.categories.map(c => '### ' + c.id + ' (' + c.weight + ' points)\n\n| # | Item (score 0 to 5) | Phases |\n|---|---|---|\n' + c.items.map(i => '| ' + i[0] + ' | ' + i[1] + ' | ' + i[2].replace(/,/g, ', ') + ' |').join('\n')).join('\n\n');
blocks.vbarriers = () => ['| # | Barrier (REJECT, whatever the score) | Trigger |', '|---|---|---|'].concat(VS.barriers.map(b => '| ' + b[0] + ' | **' + b[1] + '** | ' + b[2] + ' |')).join('\n');
blocks.vyes = () => ['| Share of reviewers answering "yes" | Item score |', '|---|---|'].concat(VS.presenceYesToScore.map(r => '| ' + (r[0] === 0 ? 'below 40%' : r[0] === 1 ? '100%' : r[0] * 100 + '% or more') + ' | ' + r[1] + ' |')).join('\n');
let n = 0;
fs.readdirSync(path.join(root, 'docs')).filter(f => f.endsWith('.md')).forEach(f => {
  const p = path.join(root, 'docs', f); let s = fs.readFileSync(p, 'utf8'), changed = false;
  s = s.replace(/<!-- BEGIN:(\w+) -->[\s\S]*?<!-- END:\1 -->/g, (m, name) => { if (!blocks[name]) { console.error('unknown block', name, 'in', f); process.exitCode = 1; return m; } changed = true; n++; return '<!-- BEGIN:' + name + ' -->\n' + blocks[name]() + '\n<!-- END:' + name + ' -->'; });
  if (changed) fs.writeFileSync(p, s);
});
console.log('regenerated ' + n + ' blocks');
