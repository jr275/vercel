// node tools/pack-embed.js   Builds the drop-in package in embed/: the bundle plus the vendor scripts and Basis transcoder it needs.
// Copy embed/ to your app's static folder (for Next.js: public/avatar-kit/). embed/ExecutiveAvatar.tsx and loadAvatarKit.ts are hand-written.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..'), out = path.join(root, 'embed');
cp.execFileSync(process.execPath, [path.join(__dirname, 'build.js')], { stdio: 'ignore' });
const copy = (from, to) => { fs.mkdirSync(path.dirname(path.join(out, to)), { recursive: true }); fs.copyFileSync(path.join(root, from), path.join(out, to)); };
copy('dist/avatar-kit.js', 'avatar-kit.js');
['three.min.js', 'loaders/GLTFLoader.js', 'libs/meshopt_decoder.js', 'libs/basis/basis_transcoder.js', 'libs/basis/basis_transcoder.wasm'].forEach(f => copy('vendor/' + f, 'vendor/' + f));
copy('vendor/ktx2-src/LICENSE-three', 'vendor/LICENSE-three');
console.log('embed/ ready:', fs.readdirSync(out).join(', '));
