import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import { textureCompress, reorder, prune, dedup } from '@gltf-transform/functions'; import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'; import sharp from 'sharp'; import { ktx2 } from 'ktx2-encoder/gltf-transform';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const imageDecoder = async (buf) => { const { data, info } = await sharp(Buffer.from(buf)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { width: info.width, height: info.height, data: new Uint8Array(data) }; };
const SRC = process.argv[2], OUT = process.argv[3];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(SRC);
await doc.transform(
  dedup(), prune(),
  textureCompress({ encoder: sharp, targetFormat: 'png', resize: [1024, 1024], pattern: /normal|teeth|tongue|eye|ponytail/i }),
  ktx2({ isUASTC: false, generateMipmap: true, imageDecoder, pattern: /casualsuit01_diffuse|ponytail|teeth|tongue/i, qualityLevel: 200 }),
  ktx2({ isUASTC: true, generateMipmap: true, imageDecoder, pattern: /young_lightskinned|brown_eye/i, qualityLevel: 128 }),
  ktx2({ isUASTC: true, generateMipmap: true, imageDecoder, pattern: /normal/i, qualityLevel: 128, isNormalMap: true, isSetKTX2SRGBTransferFunc: false }),
  (doc) => { doc.getRoot().listAccessors().forEach(a => { if (a.getSparse()) a.setSparse(false); }); },
  reorder({ encoder: MeshoptEncoder, target: 'size' })
);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write(OUT, doc);
