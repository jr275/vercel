// A synthetic report for an excellent asset (used by unit tests and by tools/gen-docs.js)
module.exports = function (C) {
function good() {
  const perChannel = {}; C.ALL.forEach(c => perChannel[c] = { rms: 0.004, max: 0.03, carriedBy: ['skin', 'teeth'] });
  const perViseme = {}; C.VISEMES.forEach(v => perViseme[v] = { rms: 0.004, carriedBy: ['skin', 'teeth', 'tongue'] });
  const pairs = C.ARKIT.filter(c => /Left$/.test(c)).map(l => ({ left: l, right: l.replace('Left', 'Right'), ratio: 0.9 }));
  return {
    rig: { grade: 'full', coverage: 1, found: C.ARKIT, missing: [], essentialMissing: [], unmatchedMorphs: [], warnings: [], visemesNative: true },
    blendshapes: { found: 53, arkitFound: 52, coverage: 1, missing: [], essentialMissing: [], dead: [], outliers: [], pairs, asymmetricBroken: [], perfectMirror: 0, perChannel, unmatched: [], jawClench: true },
    visemes: { native: true, found: 15, missing: [], perViseme, distinct: 15, duplicates: [], tongueCarries: 6, teethCarries: 5, tongueMeshes: 1, teethMeshes: 1 },
    eyes: { bones: { left: true, right: true }, mode: 'bones', eyeMeshes: 2, corneaMeshes: 2, pivot: [{ slot: 'leftEye', offsetRatio: 0.05 }, { slot: 'rightEye', offsetRatio: 0.06 }], lookMorphs: 8, blinkIndependent: true, reflective: true, eyeTris: 3000 },
    mouth: { jawMode: 'morph', jawMorph: true, teeth: 1, tongue: 1, inner: 1, tongueOut: true, mouthChannels: 7 },
    materials: { count: 6, list: [], textures: 8, textureList: [], textureMB: 20, maxTexture: 2048, skinMaterial: { name: 'Skin', maps: { map: true, normalMap: true, roughnessMap: true } }, hairMaterial: { alphaTest: 0.5, transparent: false, maps: {} }, anySheen: true, anyUnlit: false },
    hair: { meshes: 1, tris: 9000, brows: 1, lashes: 1 },
    animation: { clips: [{ name: 'Idle', duration: 5, tracks: 10, morphTracks: 0, loopClosed: true, bones: 5 }], idle: 'Idle', talk: null, headBonesMissing: [], bodyBonesMissing: [], bones: 11 },
    delivery: { fileMB: 6, extensions: ['EXT_meshopt_compression', 'KHR_texture_basisu'], meshopt: true, draco: false, ktx2: true, external: [], loadMs: 800 },
    geometry: { tris: 30000, drawCalls: 7, skinned: 3, byKind: {}, meshes: [], lods: [] },
    expressionTest: { rows: [], aliveFraction: 1, nan: 0, skepticalAsym: 0.2 },
    lipTest: { minDistinct: 0.002, closestPair: 'a ~ b', meanLowerShare: 0.8, timeline: { openClose: 5, minOverMax: 0.1 } },
    fps: { fps: 60, software: false, renderer: 'GPU' }
  };
}
  return good;
};
