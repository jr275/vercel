#!/usr/bin/env node
// Builds tests/fixtures/rig-arkit-ktx2.glb: the rig-arkit test fixture with a real Basis (UASTC or ETC1S) KTX2 base colour texture,
// KHR_texture_basisu and spherical UVs. A TEST FIXTURE for the KTX2 loading path, not an asset.
//   npm i ktx2-encoder (anywhere)   node tools/make-ktx2-fixture.js --encoder /path/to/node_modules/ktx2-encoder [--etc1s] [--out file]
const fs = require('fs'), path = require('path');
const arg = n => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : null; };
(async () => {
  const enc = arg('encoder'); if (!enc) { console.error('--encoder <path to node_modules/ktx2-encoder> is required'); process.exit(1); }
  const { encodeToKTX2 } = await import(path.join(path.resolve(enc), 'dist/node/index.js'));
  const W = 256, H = 256, rgba = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, c = ((x >> 5) + (y >> 5)) & 1; rgba[i] = c ? 214 : 70 + (x >> 2); rgba[i + 1] = c ? 120 + (y >> 2) : 60; rgba[i + 2] = c ? 90 : 190; rgba[i + 3] = 255; }
  const ktx2 = Buffer.from(await encodeToKTX2(new Uint8Array(8), { isUASTC: !process.argv.includes('--etc1s'), generateMipmap: true, qualityLevel: 128, imageDecoder: async () => ({ width: W, height: H, data: rgba }) }));
  const src = fs.readFileSync(path.join(__dirname, '../tests/fixtures/rig-arkit.glb')), jl = src.readUInt32LE(12), json = JSON.parse(src.slice(20, 20 + jl).toString()), bl = src.readUInt32LE(20 + jl), bin = src.slice(28 + jl, 28 + jl + bl);
  const pad4 = b => Buffer.concat([b, Buffer.alloc((4 - b.length % 4) % 4)]);
  // the head: the primitive with the most vertices
  let best = null; json.meshes.forEach(m => m.primitives.forEach(p => { const n = json.accessors[p.attributes.POSITION].count; if (!best || n > best.n) best = { p, n }; }));
  const pa = json.accessors[best.p.attributes.POSITION], pv = json.bufferViews[pa.bufferView], off = (pv.byteOffset || 0) + (pa.byteOffset || 0), stride = pv.byteStride || 12, uv = Buffer.alloc(best.n * 8);
  for (let i = 0; i < best.n; i++) { const x = bin.readFloatLE(off + i * stride), y = bin.readFloatLE(off + i * stride + 4), z = bin.readFloatLE(off + i * stride + 8); uv.writeFloatLE(Math.atan2(x, z) / (2 * Math.PI) + 0.5, i * 8); uv.writeFloatLE(0.5 - (y - pa.min[1] - (pa.max[1] - pa.min[1]) / 2) / (pa.max[1] - pa.min[1]), i * 8 + 4); }
  let nb = pad4(bin); const add = (buf, extra) => { const o = nb.length; nb = Buffer.concat([nb, pad4(buf)]); json.bufferViews.push(Object.assign({ buffer: 0, byteOffset: o, byteLength: buf.length }, extra || {})); return json.bufferViews.length - 1; };
  const uvView = add(uv, { target: 34962 }), imgView = add(ktx2);
  json.accessors.push({ bufferView: uvView, componentType: 5126, count: best.n, type: 'VEC2' }); best.p.attributes.TEXCOORD_0 = json.accessors.length - 1;
  json.images = [{ bufferView: imgView, mimeType: 'image/ktx2', name: 'basecolor_ktx2' }]; json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
  json.textures = [{ sampler: 0, extensions: { KHR_texture_basisu: { source: 0 } } }];
  const mi = best.p.material != null ? best.p.material : (json.materials.push({}), best.p.material = json.materials.length - 1), mat = json.materials[mi]; mat.pbrMetallicRoughness = Object.assign(mat.pbrMetallicRoughness || {}, { baseColorTexture: { index: 0 }, baseColorFactor: [1, 1, 1, 1] });
  json.extensionsUsed = Array.from(new Set((json.extensionsUsed || []).concat('KHR_texture_basisu'))); json.extensionsRequired = Array.from(new Set((json.extensionsRequired || []).concat('KHR_texture_basisu')));
  json.buffers[0].byteLength = nb.length;
  const jb = pad4(Buffer.from(JSON.stringify(json))); while (jb.length % 4) jb.push; for (let i = jb.length - 1; i >= 0 && jb[i] === 0; i--) jb[i] = 0x20;
  const head = Buffer.alloc(12); head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jb.length + 8 + nb.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(jb.length, 0); jh.write('JSON', 4); const bh = Buffer.alloc(8); bh.writeUInt32LE(nb.length, 0); bh.write('BIN\0', 4);
  const out = arg('out') || path.join(__dirname, '../tests/fixtures/rig-arkit-ktx2.glb'); fs.writeFileSync(out, Buffer.concat([head, jh, jb, bh, nb])); console.log(out, ktx2.length + ' byte KTX2,', (fs.statSync(out).size / 1024).toFixed(1) + ' KB');
})();
