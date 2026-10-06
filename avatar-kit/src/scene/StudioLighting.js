/*
 * StudioLighting: a cinematic portrait setup built from real 3D lights and an image-based environment.
 * Nothing here is a CSS background or a baked image.
 *
 *   key      the main light, soft-shadowed, off-axis, slightly above eye line
 *   fill     low, cool, opposite the key; sets the shadow ratio
 *   rimA/B   two lights behind: separate hair and shoulders from the backdrop
 *   ambient  hemisphere, very low
 *   env      an environment of softboxes, prefiltered (PMREM): it is what gives skin sheen, eyes their
 *            catchlight and hair its highlight on any PBR model
 *   backdrop a large inverted sphere with a shader gradient and a soft light pool behind the head
 *   floor    shadow-only plane for grounding in full shots
 *
 * Everything is placed relative to the model's landmarks, in head heights, so it suits any scale.
 * Styles (conversation, executive, intimate) set angle, ratio, colour temperature and exposure, and
 * change smoothly. Quality sets shadow resolution and softness.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, T = root.THREE;

  var STYLES = {
    conversation: { key: 3.0, keyCol: 0xffeedd, az: -34, el: 24, fill: 0.14, rimA: 1.4, rimB: 1.0, amb: 0.16, exposure: 1.05, pool: 0.9, poolCol: 0x4a4540, env: 1 },
    executive: { key: 2.6, keyCol: 0xfff3e6, az: -26, el: 20, fill: 0.22, rimA: 1.2, rimB: 0.8, amb: 0.22, exposure: 1.0, pool: 0.7, poolCol: 0x3a3f4a, env: 0.9 },
    intimate: { key: 2.5, keyCol: 0xffe2c8, az: -48, el: 14, fill: 0.08, rimA: 1.7, rimB: 0.9, amb: 0.14, exposure: 1.12, pool: 1.0, poolCol: 0x5a4a40, env: 0.95 }
  };
  var QUALITY = { low: { shadow: 512, radius: 2, env: 128 }, medium: { shadow: 1024, radius: 3, env: 256 }, high: { shadow: 2048, radius: 4, env: 256 } };

  var BACKDROP_VS = 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
  var BACKDROP_FS = [
    'varying vec3 vDir; uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uPool; uniform float uPoolK; uniform vec2 uPoolAt;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }',
    'void main(){',
    '  float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);',
    '  vec3 col = mix(uBottom, uTop, smoothstep(0.15, 0.85, h));',
    '  vec2 q = vec2(vDir.x, vDir.y - uPoolAt.y) ; float pool = exp(-dot(q,q) * 16.0) * step(vDir.z, 0.0) * uPoolK;',
    '  col += uPool * pool;',
    '  col *= 1.0 - 0.35 * smoothstep(0.45, 1.0, length(vDir.xy));',                  // vignette
    '  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;',                               // dither against banding
    '  gl_FragColor = vec4(col, 1.0);',                                                // colours are authored in display (sRGB) space: no tone mapping or re-encoding
    '}'].join('\n');

  function StudioLighting(renderer, scene, opts) {
    this.o = WA.assign({ style: 'conversation', quality: 'high', backdrop: true, floor: true }, opts || {});
    this.renderer = renderer; this.scene = scene;
    this.lm = WA.AvatarModel.defaultLandmarks(7.05);
    this.group = new T.Group(); this.group.name = 'StudioLighting'; scene.add(this.group);
    this.style = STYLES[this.o.style] ? this.o.style : 'conversation';
    this.q = QUALITY[this.o.quality] || QUALITY.high;
    this.cur = WA.assign({}, STYLES[this.style]); this.curCols = {};
    var G = this.group;

    this.key = new T.DirectionalLight(0xffffff, 1); this.key.castShadow = true;
    this.key.shadow.bias = -0.0004; this.key.shadow.normalBias = 0.012; this.key.shadow.camera.near = 0.5; this.key.shadow.camera.far = 80;
    this.fill = new T.DirectionalLight(0xdfe6ff, 0.2);
    this.rimA = new T.DirectionalLight(0x8fb0ff, 1.4); this.rimB = new T.DirectionalLight(0xffcfb4, 1.0);
    this.amb = new T.HemisphereLight(0xa9a6c4, 0x7a5048, 0.3);
    G.add(this.key, this.key.target, this.fill, this.rimA, this.rimB, this.amb);
    this.setQuality(this.o.quality);

    this.env = null; this._buildEnv();
    if (this.o.backdrop) this._buildBackdrop();
    if (this.o.floor) {
      this.floor = new T.Mesh(new T.PlaneGeometry(40, 40), new T.ShadowMaterial({ opacity: 0.2 }));
      this.floor.rotation.x = -Math.PI / 2; this.floor.receiveShadow = true; G.add(this.floor);
    }
    this.focus = { y: this.lm.eyeY, extent: 2.5 };
    this._apply(1, true);
  }
  StudioLighting.STYLES = STYLES; StudioLighting.QUALITY = QUALITY;

  StudioLighting.prototype._buildEnv = function () {
    var es = new T.Scene(), sky = new T.Mesh(new T.SphereGeometry(10, 24, 16), new T.MeshBasicMaterial({ color: 0x15171d, side: T.BackSide }));
    es.add(sky);
    function box(w, h, col, k, x, y, z) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(col).multiplyScalar(k), side: T.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m);
    }
    box(5, 6, 0xfff0e0, 9, -6, 3.5, 5);          // key softbox, upper left front: its reflection is the catchlight
    box(4, 5, 0xdce6ff, 1.6, 6.5, 0.5, 4);       // fill card, right
    box(2.2, 8, 0x9db8ff, 5, -6, 3, -6);         // rim strips behind
    box(2.2, 8, 0xffd2b8, 3.5, 6, 3, -6);
    box(14, 3, 0xffffff, 0.7, 0, 9, 0);          // top bounce
    var pm = new T.PMREMGenerator(this.renderer);
    var rt = pm.fromScene(es, 0.03); this.env = rt; this.scene.environment = rt.texture; pm.dispose();
    es.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  };

  StudioLighting.prototype._buildBackdrop = function () {
    var u = { uTop: { value: new T.Color(0x15171d) }, uBottom: { value: new T.Color(0x050608) }, uPool: { value: new T.Color(0x4a4540) }, uPoolK: { value: 0.9 }, uPoolAt: { value: new T.Vector2(0, 0.0) } };
    this.backdropU = u;
    this.backdrop = new T.Mesh(new T.SphereGeometry(70, 32, 20), new T.ShaderMaterial({ uniforms: u, vertexShader: BACKDROP_VS, fragmentShader: BACKDROP_FS, side: T.BackSide, depthWrite: false, toneMapped: false }));
    this.backdrop.renderOrder = -10; this.backdrop.frustumCulled = false; this.group.add(this.backdrop);
  };

  StudioLighting.prototype.setLandmarks = function (lm) { if (lm) { this.lm = lm; this._apply(1, true); } };
  StudioLighting.prototype.setStyle = function (name) { if (!STYLES[name]) return false; this.style = name; return true; };
  StudioLighting.prototype.setQuality = function (q) {
    var Q = QUALITY[q]; if (!Q) return false; this.q = Q;
    var s = this.key.shadow; s.mapSize.set(Q.shadow, Q.shadow); s.radius = Q.radius; if (s.map) { s.map.dispose(); s.map = null; }
    return true;
  };
  /* y: height the shadow frustum is centred on; extent: half-size in scene units. The camera calls this as it moves. */
  StudioLighting.prototype.setFocus = function (y, extent) { this.focus.y = y; this.focus.extent = Math.max(1.2, extent); this._shadow(); };

  StudioLighting.prototype._shadow = function () {
    var s = this.key.shadow.camera, e = this.focus.extent;
    s.left = -e; s.right = e; s.top = e; s.bottom = -e; s.updateProjectionMatrix();
    this.key.target.position.set(0, this.focus.y, 0); this.key.target.updateMatrixWorld();
    this._place();
  };
  function dir(az, el) { var a = az * Math.PI / 180, e = el * Math.PI / 180; return new T.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)); }
  StudioLighting.prototype._place = function () {
    var h = this.lm.headHeight, c = this.cur, cy = this.focus.y, D = 6 * h;
    var k = dir(c.az, c.el).multiplyScalar(D); this.key.position.set(k.x, cy + k.y, k.z);
    var f = dir(52, 8).multiplyScalar(D); this.fill.position.set(f.x, cy + f.y, f.z);
    var ra = dir(-145, 28).multiplyScalar(D), rb = dir(150, 22).multiplyScalar(D);
    this.rimA.position.set(ra.x, cy + ra.y, ra.z); this.rimB.position.set(rb.x, cy + rb.y, rb.z);
    [this.fill, this.rimA, this.rimB].forEach(function (l) { l.target.position.set(0, cy, 0); }, this);
  };

  /* eases the current values toward the style; k is the blend (1 = snap) */
  StudioLighting.prototype._apply = function (k, snap) {
    var t = STYLES[this.style], c = this.cur, kk = snap ? 1 : k;
    ['key', 'az', 'el', 'fill', 'rimA', 'rimB', 'amb', 'exposure', 'pool', 'env'].forEach(function (n) { c[n] += (t[n] - c[n]) * kk; });
    var self = this;
    function col(name, hex) { var cc = self.curCols[name] || (self.curCols[name] = new T.Color(hex)); if (snap) cc.setHex(hex); else cc.lerp(new T.Color(hex), kk); return cc; }
    this.key.color.copy(col('key', t.keyCol)); this.key.intensity = c.key;
    this.fill.intensity = c.fill; this.rimA.intensity = c.rimA; this.rimB.intensity = c.rimB; this.amb.intensity = c.amb;
    this.renderer.toneMappingExposure = c.exposure;
    if (this.backdropU) { this.backdropU.uPool.value.copy(col('pool', t.poolCol)); this.backdropU.uPoolK.value = c.pool; }
    this.envIntensity = c.env;
    this._place();
  };

  /* The backdrop turns with the camera, so the background behind the head is the same in every view (front, three-quarter, profile). */
  StudioLighting.prototype.setBackdropYaw = function (a) { if (this.backdrop) this.backdrop.rotation.y = a; };

  StudioLighting.prototype.update = function (dt) {
    if (this.backdropU) this.backdropU.uPoolAt.value.set(0, (this.lm.headCenterY - this.lm.height * 0.5) / 40);
    this._apply(1 - Math.exp(-2.5 * dt), false);
  };

  StudioLighting.prototype.dispose = function () {
    this.scene.remove(this.group); if (this.scene.environment === (this.env && this.env.texture)) this.scene.environment = null;
    if (this.env) this.env.dispose();
    this.group.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    if (this.key.shadow.map) this.key.shadow.map.dispose();
  };

  WA.StudioLighting = StudioLighting;
})(typeof window !== 'undefined' ? window : globalThis);
