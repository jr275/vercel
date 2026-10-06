// node tools/make-test-glb.js [out.glb] [--names=arkit|custom] [--swap] [--no-visemes] [--no-eyebones] [--no-jaw] [--no-morphs] [--no-idle]
const fs = require('fs'), path = require('path'), { build } = require('./fixture-glb');
const args = process.argv.slice(2), out = args.find(a => !a.startsWith('--')) || path.join(__dirname, '../tests/fixtures/rig-arkit.glb');
const val = n => { const a = args.find(x => x.startsWith('--' + n + '=')); return a ? a.split('=')[1] : undefined; }, flag = n => args.includes('--' + n);
const r = build({ names: val('names'), swap: flag('swap'), noVisemes: flag('no-visemes'), noEyeBones: flag('no-eyebones'), noJaw: flag('no-jaw'), noMorphs: flag('no-morphs'), noIdle: flag('no-idle') });
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, r.glb);
console.log(JSON.stringify({ out: path.relative(process.cwd(), out), KB: Math.round(r.glb.length / 1024), morphs: r.morphs, bones: r.bones }));
