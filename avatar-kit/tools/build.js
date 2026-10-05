// node tools/build.js   ->  dist/avatar-kit.js (+ .min.js if esbuild/terser is available) and prints sizes
const fs = require('fs'), path = require('path'), zlib = require('zlib'), cp = require('child_process');
const root = path.join(__dirname, '..');
const ORDER = ['core/util', 'model/channels', 'model/RigMap', 'model/AvatarModel',
  'control/VisemeEngine', 'control/AmplitudeFallback', 'control/LipSyncController', 'control/TestVoice',
  'control/ExpressionController', 'control/CognitiveState', 'control/ExpressionComposer', 'control/GazeController', 'control/AnimationController', 'control/FaceMixer',
  'scene/CameraController', 'scene/StudioLighting',
  'model/procedural/Avatar3D', 'model/procedural/ProceduralAvatar', 'vendor/KTX2Loader', 'model/glb/GLBAvatar', 'model/AvatarAdapter', 'model/loadAvatar', 'runtime/ConversationState', 'runtime/Phonemizer', 'runtime/SynthVoice', 'runtime/Speech', 'runtime/ExecutiveAvatar', 'validate/AssetValidator', 'review/ScorecardData', 'review/SpeechScript', 'review/HeadGate', 'review/HeadReview', 'AvatarAPI'];
const t0 = Date.now();
const bundle = ORDER.map(f => '/* ===== ' + f + '.js ===== */\n' + fs.readFileSync(path.join(root, 'src', f + '.js'), 'utf8')).join('\n');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'avatar-kit.js'), bundle);
const out = { files: ORDER.length, rawKB: +(bundle.length / 1024).toFixed(1), gzipKB: +(zlib.gzipSync(bundle).length / 1024).toFixed(1), buildMs: Date.now() - t0 };
// the lab page: CDN build (for sharing) and a local build (vendor files next to it, for testing over http)
const fixture = fs.readFileSync(path.join(root, 'tools/fixture-glb.js'), 'utf8') + '\nwindow.makeFixtureGLB = function () { var b = FixtureGLB.build({}).glb; return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };';
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.147.0/';
const scripts = base => ['build/three.min.js', 'examples/js/loaders/GLTFLoader.js', 'examples/js/libs/meshopt_decoder.js'].map(f => '<script src="' + base + f + '"></script>').join('\n');
const LOCAL = '../vendor/';
const localScripts = ['<script src="' + LOCAL + 'three.min.js"></script>', '<script src="' + LOCAL + 'loaders/GLTFLoader.js"></script>', '<script src="' + LOCAL + 'libs/meshopt_decoder.js"></script>'].join('\n');
const shell = fs.readFileSync(path.join(root, 'demo/shell.html'), 'utf8');
const KTX = '\nAvatarKit.KTX2_PATH = \'../vendor/libs/basis/\';';
function page(three, local) { return shell.replace('<!--THREE-->', three).replace('/*KIT*/', () => bundle + (local ? KTX : '')).replace('/*MAKEGLB*/', () => fixture); }
fs.writeFileSync(path.join(root, 'dist', 'avatar-lab.html'), page(scripts(CDN)));
fs.writeFileSync(path.join(root, 'dist', 'avatar-lab.local.html'), '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + page(localScripts, true));
const exec = fs.readFileSync(path.join(root, 'demo/executive.html'), 'utf8');
const execPage = (three, local) => '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + exec.replace('<!--THREE-->', three).replace('/*KIT*/', () => bundle + (local ? KTX : ''));
fs.writeFileSync(path.join(root, 'dist', 'executive-avatar.html'), execPage(scripts(CDN)));
fs.writeFileSync(path.join(root, 'dist', 'executive-avatar.local.html'), execPage(localScripts, true));
out.execKB = +(fs.statSync(path.join(root, 'dist', 'executive-avatar.html')).size / 1024).toFixed(1);
out.labKB = +(fs.statSync(path.join(root, 'dist', 'avatar-lab.html')).size / 1024).toFixed(1);
console.log(JSON.stringify(out));
module.exports = { ORDER, bundle };
