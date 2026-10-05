// node tests/run-all.js [--unit]   build + unit tests (+ browser tests unless --unit)
const { spawnSync } = require('child_process'), path = require('path'), root = path.join(__dirname, '..');
const run = (args) => spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' }).status;
let bad = run(['tools/build.js']) || run(['--test', ...require('fs').readdirSync(path.join(root, 'tests/unit')).filter(f => f.endsWith('.test.js')).map(f => 'tests/unit/' + f)]);
if (!bad && !process.argv.includes('--unit')) bad = run(['--test', 'tests/browser/avatar.test.js', 'tests/browser/headgate.test.js', 'tests/browser/executive.test.js', 'tests/browser/ktx2.test.js', 'tests/browser/vera.test.js']);
process.exit(bad ? 1 : 0);
