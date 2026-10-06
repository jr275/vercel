/*
 * Avatar3D: the character model. Original design, procedural (no external assets).
 * Exposes a small rig: setFace(), setGaze(), setPose(). It is the FALLBACK model of the kit:
 * ProceduralAvatar adapts it to the AvatarModel contract, and lights come from StudioLighting.
 *
 * Units: 1 unit = one head height. The head centre sits near y = 6.55, feet at y = 0.
 */
(function (root) {
  'use strict';
  var WA = root.AvatarKit, T = root.THREE;
  var clamp = WA.clamp, lerp = WA.lerp, smooth = WA.smooth, gauss = WA.gauss;

  var HEAD = { rx: 0.42, ry: 0.5, rz: 0.46 };
  var LM = { eyeX: 0.19, eyeY: 0.035, eyeR: 0.125, mouthY: -0.275, mouthW: 0.126 };
  var HEAD_CENTER_Y = 6.55;
  var PIVOT_Y = 6.2;

  /* ------------------------------------------------------------------ head */

  function sculpt(p) {
    var x0 = p.x, y0 = p.y, z0 = p.z;
    var wf = smooth(0.0, 0.32, z0 / HEAD.rz);
    var t = clamp(-y0 / HEAD.ry, 0, 1);
    var x = x0 * (1 - 0.07 * t * t) * (1 + 0.035 * gauss((y0 + 0.08) * (y0 + 0.08), 0.18));
    var y = y0 * (1 - 0.08 * smooth(-0.25, -0.5, y0));
    var z = z0 * (1 - 0.08 * t * t);

    z += 0.018 * gauss((y0 - 0.27) * (y0 - 0.27), 0.14) * wf;                       // forehead
    z += 0.022 * gauss(x0 * x0 * 1.5 + (y0 + 0.455) * (y0 + 0.455), 0.07) * wf;     // chin
    z += 0.02 * gauss(x0 * x0 / 1.6 + (y0 + 0.265) * (y0 + 0.265), 0.075) * wf;    // muzzle

    // nose: bridge, tip, wings
    var bridge = (0.016 + 0.082 * smooth(0.1, -0.12, y0)) * smooth(-0.2, -0.15, y0) * smooth(0.17, 0.1, y0);
    z += bridge * gauss(x0 * x0, 0.04) * wf;
    z += 0.048 * gauss(x0 * x0 + (y0 + 0.14) * (y0 + 0.14) * 1.3, 0.042) * wf;

    for (var s = -1; s <= 1; s += 2) {
      var ex = x0 - s * LM.eyeX;
      z -= 0.018 * gauss(ex * ex + (y0 - LM.eyeY) * (y0 - LM.eyeY), 0.075) * wf;    // eye socket
      z -= 0.006 * gauss(ex * ex + (y0 + 0.04) * (y0 + 0.04), 0.06) * wf;           // under-eye
      var cx = x0 - s * 0.235;
      z += 0.022 * gauss(cx * cx + (y0 + 0.03) * (y0 + 0.03), 0.075) * wf;           // cheekbone
      z += 0.014 * gauss((x0 - s * 0.2) * (x0 - s * 0.2) + (y0 + 0.11) * (y0 + 0.11), 0.07) * wf; // apple of the cheek
      x += s * 0.014 * gauss((x0 - s * 0.33) * (x0 - s * 0.33) + (y0 + 0.27) * (y0 + 0.27), 0.07) * smooth(-0.1, 0.2, z0 / HEAD.rz); // jaw angle
      var nx = x0 - s * 0.062;
      z += 0.026 * gauss(nx * nx + (y0 + 0.145) * (y0 + 0.145), 0.03) * wf;        // nostril wing
    }
    // brow ridge
    z += 0.022 * gauss((y0 - 0.13) * (y0 - 0.13), 0.04) * smooth(0.0, 0.1, Math.abs(x0)) * smooth(0.4, 0.22, Math.abs(x0)) * wf;
    p.x = x; p.y = y; p.z = z;
    return p;
  }

  function buildHeadGeometry() {
    var g = new T.SphereGeometry(1, 128, 96);
    var pos = g.attributes.position, p = { x: 0, y: 0, z: 0 };
    for (var i = 0; i < pos.count; i++) {
      p.x = pos.getX(i) * HEAD.rx; p.y = pos.getY(i) * HEAD.ry; p.z = pos.getZ(i) * HEAD.rz;
      sculpt(p);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    g.computeVertexNormals();
    return g;
  }

  // head-local (x, y) on the front of the face -> pixel on the equirect skin texture
  function facePx(x, y, W, H) {
    var cy = clamp(y / HEAD.ry, -0.999, 0.999), th = Math.acos(cy), sn = Math.sin(th);
    var d = Math.asin(clamp((x / HEAD.rx) / sn, -1, 1));
    return { x: (0.25 + d / (2 * Math.PI)) * W, y: (th / Math.PI) * H, sx: W / (2 * Math.PI * HEAD.rx * sn), sy: H / (Math.PI * HEAD.ry * sn) };
  }

  function makeSkinTexture() {
    var W = 2048, H = 1024;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d');
    var vg = g.createLinearGradient(0, 0, 0, H);
    vg.addColorStop(0, '#d29c7d'); vg.addColorStop(0.42, '#d8a687'); vg.addColorStop(0.62, '#d29c7e'); vg.addColorStop(1, '#c8937a');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);

    function blob(x, y, rx, ry, color, a) {
      var p = facePx(x, y, W, H);
      g.save(); g.translate(p.x, p.y); g.scale(p.sx * rx, p.sy * ry);
      var gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      gr.addColorStop(0, WA.rgba(color, a)); gr.addColorStop(1, WA.rgba(color, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.fill(); g.restore();
    }
    for (var s = -1; s <= 1; s += 2) {
      blob(s * 0.4, 0.0, 0.1, 0.28, '#b7826a', 0.38);       // sides of the face fall into shade
      blob(s * 0.245, -0.1, 0.1, 0.07, '#dd7f7c', 0.2);     // cheek colour, discreet
      blob(s * 0.2, 0.1, 0.1, 0.038, '#a87a70', 0.16);      // soft lid colour
      blob(s * 0.185, -0.035, 0.085, 0.03, '#b88878', 0.13); // under-eye
      blob(s * 0.05, -0.125, 0.045, 0.04, '#cc8577', 0.14);  // beside the nose
    }
    blob(0, -0.14, 0.05, 0.04, '#d98c80', 0.16);             // nose tip
    blob(-0.034, -0.163, 0.013, 0.008, '#4a201d', 0.3); blob(0.034, -0.163, 0.013, 0.008, '#4a201d', 0.3);
    blob(0, 0.3, 0.2, 0.09, '#f0c4a8', 0.1);                 // forehead light

    // brows: soft underlay plus individual hairs
    for (var si = -1; si <= 1; si += 2) {
      var P0 = { x: si * 0.075, y: 0.132 }, P1 = { x: si * 0.2, y: 0.195 }, P2 = { x: si * 0.355, y: 0.118 };
      function bz(t) {
        var u = 1 - t;
        return { x: u * u * P0.x + 2 * u * t * P1.x + t * t * P2.x, y: u * u * P0.y + 2 * u * t * P1.y + t * t * P2.y };
      }
      for (var k = 0; k < 44; k++) {
        var t = k / 44, b = bz(t);
        blob(b.x, b.y, 0.05 * (1 - t * 0.5) + 0.008, 0.026 * (1 - t * 0.45) + 0.005, '#140a06', 0.6 * (1 - t * 0.45));
      }
      var rnd = WA.rng(si > 0 ? 11 : 17);
      g.save(); g.lineCap = 'round';
      for (var h = 0; h < 190; h++) {
        var tt = rnd() * 0.96, a = bz(tt), a2 = bz(Math.min(1, tt + 0.07));
        var spread = (0.014 * (1 - tt * 0.7)) * (rnd() - 0.5) * 2;
        var p1 = facePx(a.x, a.y + spread, W, H), p2 = facePx(a2.x, a2.y + spread * 0.8 + 0.004, W, H);
        g.strokeStyle = WA.rgba('#120a06', 0.75 + rnd() * 0.25);
        g.lineWidth = 1.8 + rnd() * 1.4;
        g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke();
      }
      g.restore();
    }
    // fine skin grain so the surface does not look like plastic
    var img = g.getImageData(0, 0, W, H), d = img.data, r2 = WA.rng(5);
    for (var i = 0; i < d.length; i += 4) { var n = (r2() - 0.5) * 7; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(img, 0, 0);

    var tex = new T.CanvasTexture(c);
    tex.encoding = T.sRGBEncoding; tex.anisotropy = 8;
    return tex;
  }

  /* ------------------------------------------------------------------ eyes */

  function makeEyeTexture() {
    var W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d');
    var bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#c9b9b0'); bg.addColorStop(0.3, '#e9dfd9'); bg.addColorStop(0.7, '#e9dfd9'); bg.addColorStop(1, '#cdbdb4');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    var cx = 256, cy = 256, R = 92;
    var rg = g.createRadialGradient(cx, cy, R * 0.3, cx, cy, R);
    rg.addColorStop(0, '#c08a3f'); rg.addColorStop(0.35, '#8a5428'); rg.addColorStop(0.8, '#5a341a'); rg.addColorStop(1, '#2a170d');
    g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    var rnd = WA.rng(3);
    for (var i = 0; i < 90; i++) {
      var a = rnd() * Math.PI * 2, r1 = R * (0.32 + rnd() * 0.1), r2 = R * (0.62 + rnd() * 0.36);
      g.strokeStyle = rnd() > 0.5 ? 'rgba(240,190,110,0.28)' : 'rgba(40,20,10,0.3)'; g.lineWidth = 1 + rnd() * 1.6;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); g.stroke();
    }
    g.strokeStyle = 'rgba(20,10,6,0.9)'; g.lineWidth = 7; g.beginPath(); g.arc(cx, cy, R - 3, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#050304'; g.beginPath(); g.arc(cx, cy, R * 0.37, 0, Math.PI * 2); g.fill();
    var tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding; tex.anisotropy = 4;
    return tex;
  }

  /* --------------------------------------------------------------- ribbons */

  function Ribbon(nx, ny, material) {
    var g = new T.BufferGeometry();
    var pos = new Float32Array(nx * ny * 3), col = new Float32Array(nx * ny * 3), idx = [];
    for (var j = 0; j < ny - 1; j++) for (var i = 0; i < nx - 1; i++) {
      var a = j * nx + i; idx.push(a, a + 1, a + nx, a + 1, a + nx + 1, a + nx);
    }
    g.setIndex(idx);
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    var mesh = new T.Mesh(g, material);
    mesh.frustumCulled = false;
    return {
      mesh: mesh, pos: pos, col: col, nx: nx, ny: ny,
      commit: function () { g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.computeVertexNormals(); }
    };
  }

  /* ------------------------------------------------------------------ hair */

  function makeHairBump() {
    var c = document.createElement('canvas'); c.width = 256; c.height = 512;
    var g = c.getContext('2d'), r = WA.rng(77);
    g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 512);
    for (var i = 0; i < 150; i++) {
      var x = r() * 256, v = 90 + Math.floor(r() * 120);
      g.strokeStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (0.35 + r() * 0.5) + ')'; g.lineWidth = 2 + r() * 3;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 3, 512); g.stroke();
    }
    var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
    return t;
  }

  function buildHair() {
    var rand = WA.rng(2024);
    var RH = { x: 0.455, y: 0.54, z: 0.495, cy: 0.012, cz: -0.02 };
    function hs(th, a, off) {
      var s = 1 + (off || 0);
      return new T.Vector3(RH.x * Math.sin(a) * Math.sin(th) * s, RH.y * Math.cos(th) * s + RH.cy, RH.z * Math.cos(a) * Math.sin(th) * s + RH.cz);
    }
    var locks = [];
    function hang(pts, back, len, wave) {
      var P = pts[pts.length - 1], sx = P.x >= 0 ? 1 : -1, ax = Math.abs(P.x), j = function () { return (rand() - 0.5) * 0.03; };
      function behind(x, z) { return Math.min(z, -0.26 + 0.22 * smooth(0.3, 0.5, Math.abs(x))); }
      var q1 = new T.Vector3(sx * ax * 1.04 + j(), P.y - 0.2 * len, 0), q2 = new T.Vector3(sx * ax * 1.02 + j() + wave, P.y - 0.5 * len, 0),
          q3 = new T.Vector3(sx * ax * 0.94 + j() - wave, P.y - 0.82 * len, 0), q4 = new T.Vector3(sx * ax * 0.82 + j() - wave * 1.8, P.y - 1.0 * len, 0);
      q1.z = behind(q1.x, Math.min(P.z, -0.02) - 0.05 * back);
      q2.z = behind(q2.x, -0.12 - 0.1 * back + j());
      q3.z = behind(q3.x, -0.22 - 0.08 * back + j());
      q4.z = behind(q4.x, -0.26 - 0.06 * back + j());
      pts.push(q1, q2, q3, q4);
    }
    function add(pts, width, tone) { locks.push({ pts: pts, w: width, tone: tone }); }

    // back and crown mass
    for (var i = 0; i < 46; i++) {
      var sg = i % 2 ? 1 : -1, a = sg * (1.45 + rand() * (Math.PI - 1.45));
      var th0 = 0.18 + rand() * 0.9, o = 0.014 + rand() * 0.02;
      var pts = [hs(th0, a, o), hs(th0 + 0.5, a, o + 0.004), hs(1.6 + rand() * 0.16, a, o + 0.014)];
      hang(pts, rand(), 0.8 + rand() * 0.3, (rand() - 0.5) * 0.05);
      add(pts, 0.15 + rand() * 0.09, 0.8 + rand() * 0.4);
    }
    // side parting: the larger sweep falls to screen-left
    function sweep(dir, n, a0, aEnd, e0, wBase) {
      for (var k = 0; k < n; k++) {
        var u = (k + 0.5) / n, th0 = 0.28 + 0.6 * u, te = 1.06 + e0 * u;
        var wps = [0, 0.3, 0.62, 0.84, 1], pts = [];
        for (var q = 0; q < wps.length; q++) {
          var f = wps[q], th = th0 + (te - th0) * f, a = a0 + (aEnd - a0) * f + (rand() - 0.5) * 0.03;
          pts.push(hs(th, a, 0.016 + 0.014 * Math.sin(f * Math.PI) + 0.01 * u + q * 0.003));
        }
        hang(pts, rand() * 0.8, 0.82 + rand() * 0.22, dir * 0.03);
        add(pts, wBase * (0.8 + 0.5 * rand()), 0.85 + rand() * 0.3);
      }
    }
    sweep(-1, 16, 0.2, -1.95, 0.42, 0.115);
    sweep(1, 13, 0.18, 1.95, 0.4, 0.13);

    var P = [], N = [], C = [], UV = [], I = [], base = 0, seg = 36, ring = 10;
    for (var s = 0; s < locks.length; s++) {
      var L = locks[s], curve = new T.CatmullRomCurve3(L.pts, false, 'catmullrom', 0.5), len = curve.getLength();
      var prevS = null;
      for (var r = 0; r <= seg; r++) {
        var t = r / seg, ctr = curve.getPointAt(t), tan = curve.getTangentAt(t);
        var ref = new T.Vector3(ctr.x, Math.max(0, ctr.y) * 0.5, ctr.z + 0.02).normalize();
        var S = new T.Vector3().crossVectors(tan, ref).normalize();
        if (prevS && S.dot(prevS) < 0) S.negate(); prevS = S.clone();
        var Nn = new T.Vector3().crossVectors(S, tan).normalize(); if (Nn.dot(ref) < 0) Nn.negate();
        var prof = (0.5 + 0.5 * smooth(0, 0.14, t)) * (1 - 0.88 * smooth(0.55, 1, t));
        var w = L.w * 0.5 * prof, th = 0.016 * (0.55 + 0.45 * prof);
        for (var m = 0; m <= ring; m++) {
          var ph = (m / ring) * Math.PI * 2, cp = Math.cos(ph), sp = Math.sin(ph);
          P.push(ctr.x + S.x * cp * w + Nn.x * sp * th, ctr.y + S.y * cp * w + Nn.y * sp * th, ctr.z + S.z * cp * w + Nn.z * sp * th);
          var nx = S.x * cp * th + Nn.x * sp * w, ny = S.y * cp * th + Nn.y * sp * w, nz = S.z * cp * th + Nn.z * sp * w, nl = Math.hypot(nx, ny, nz) || 1;
          N.push(nx / nl, ny / nl, nz / nl);
          UV.push(m / ring * 2, t * len * 1.4);
          var shade = L.tone * (0.92 + 0.08 * Math.sin(t * 7 + s));
          C.push(0.034 * shade + 0.004, 0.02 * shade + 0.002, 0.015 * shade + 0.002);
        }
      }
      for (var rr = 0; rr < seg; rr++) for (var mm = 0; mm < ring; mm++) {
        var a1 = base + rr * (ring + 1) + mm, b1 = a1 + 1, c1 = a1 + ring + 1, d1 = c1 + 1;
        I.push(a1, b1, c1, b1, d1, c1);
      }
      base += (seg + 1) * (ring + 1);
    }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(N, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(C, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2));
    g.setIndex(I);
    return g;
  }

  WA.createAvatar3D = function (renderer) {
    var group = new T.Group();
    var M = {};
    var skinTex = makeSkinTexture();
    M.skin = new T.MeshPhysicalMaterial({ map: skinTex, roughness: 0.58, metalness: 0, clearcoat: 0.1, clearcoatRoughness: 0.45, emissive: 0xffffff, emissiveMap: skinTex, emissiveIntensity: 0.09, envMapIntensity: 0.28 });
    M.bodySkin = new T.MeshPhysicalMaterial({ color: 0xa4684f, roughness: 0.6, clearcoat: 0.08, clearcoatRoughness: 0.5, emissive: 0x5a3026, emissiveIntensity: 0.03, envMapIntensity: 0.4 });
    M.lid = new T.MeshPhysicalMaterial({ color: 0xc58f74, roughness: 0.55, emissive: 0x8a4a3e, emissiveIntensity: 0.05, envMapIntensity: 0.3 });
    M.eye = new T.MeshPhysicalMaterial({ map: makeEyeTexture(), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.1 });
    M.lash = new T.MeshStandardMaterial({ color: 0x0c0706, roughness: 0.5 });
    M.lip = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, clearcoat: 0.55, clearcoatRoughness: 0.35, side: T.DoubleSide, envMapIntensity: 0.8 });
    M.mouth = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: T.DoubleSide });
    M.hair = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05, clearcoat: 0.0, clearcoatRoughness: 0.5, envMapIntensity: 0.65, side: T.DoubleSide });
    M.hairCap = new T.MeshStandardMaterial({ color: 0x070404, roughness: 0.5, metalness: 0.1, side: T.DoubleSide });
    M.dress = new T.MeshPhysicalMaterial({ color: 0x030304, roughness: 0.82, metalness: 0.0, side: T.DoubleSide, envMapIntensity: 0.14 });
    if ('sheenColor' in M.dress) { M.dress.sheen = 1; M.dress.sheenColor = new T.Color(0x0c0c11); M.dress.sheenRoughness = 0.6; }
    M.hosiery = new T.MeshPhysicalMaterial({ color: 0x050507, roughness: 0.4, envMapIntensity: 0.25 });
    M.shoe = new T.MeshPhysicalMaterial({ color: 0x08080a, roughness: 0.28, clearcoat: 0.6 });
    M.gold = new T.MeshStandardMaterial({ color: 0xd9b35f, roughness: 0.25, metalness: 0.9 });

    function mesh(geo, mat, shadow) {
      var m = new T.Mesh(geo, mat);
      if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
      return m;
    }
    function ell(rx, ry, rz, mat, seg) {
      var m = mesh(new T.SphereGeometry(1, seg || 32, Math.round((seg || 32) * 0.75)), mat);
      m.scale.set(rx, ry, rz); return m;
    }

    /* ---- head ---- */
    var headPivot = new T.Group(); headPivot.position.set(0, PIVOT_Y, 0);
    var head = new T.Group(); head.position.set(0, HEAD_CENTER_Y - PIVOT_Y, 0);
    headPivot.add(head);
    var headGeo = buildHeadGeometry();
    var headMesh = mesh(headGeo, M.skin); headMesh.receiveShadow = false;
    head.add(headMesh);
    var basePos = new Float32Array(headGeo.attributes.position.array);

    var ray = new T.Raycaster();
    function surface(x, y) {
      ray.set(new T.Vector3(x, y, 2), new T.Vector3(0, 0, -1));
      headMesh.updateMatrixWorld(true);
      var hit = ray.intersectObject(headMesh, false)[0];
      return hit ? { p: hit.point.clone(), n: hit.face.normal.clone() } : { p: new T.Vector3(x, y, 0.4), n: new T.Vector3(0, 0, 1) };
    }

    // ears
    [-1, 1].forEach(function (s) {
      var ear = ell(0.034, 0.075, 0.05, M.bodySkin); ear.position.set(s * 0.395, -0.03, -0.07); ear.rotation.y = s * 0.3; head.add(ear);
    });

    /* ---- influences (sparse morph targets applied on the CPU) ---- */
    function influence(fn) {
      var idx = [], dx = [], dy = [], dz = [], n = basePos.length / 3, out = [0, 0, 0, 0];
      for (var i = 0; i < n; i++) {
        out[0] = 0;
        fn(basePos[3 * i], basePos[3 * i + 1], basePos[3 * i + 2], out);
        if (out[0] > 0.002) { idx.push(i); dx.push(out[0] * out[1]); dy.push(out[0] * out[2]); dz.push(out[0] * out[3]); }
      }
      return { idx: Int32Array.from(idx), dx: Float32Array.from(dx), dy: Float32Array.from(dy), dz: Float32Array.from(dz) };
    }
    function front(z) { return smooth(0.05, 0.3, z / HEAD.rz); }
    var INF = {};
    [-1, 1].forEach(function (s) {
      var k = s < 0 ? 'L' : 'R';
      INF['browUp' + k] = influence(function (x, y, z, o) {
        var w = gauss((x - s * 0.2) * (x - s * 0.2), 0.11) * gauss((y - 0.15) * (y - 0.15), 0.06) * front(z);
        var w2 = gauss((x - s * 0.15) * (x - s * 0.15) + (y - 0.3) * (y - 0.3), 0.14) * 0.3 * front(z);
        o[0] = w + w2; o[1] = 0; o[2] = (0.05 * w + 0.03 * w2) / Math.max(o[0], 1e-6); o[3] = 0.012;
      });
      INF['browInner' + k] = influence(function (x, y, z, o) {
        o[0] = gauss((x - s * 0.09) * (x - s * 0.09), 0.05) * gauss((y - 0.15) * (y - 0.15), 0.045) * front(z);
        o[1] = s * 0.005; o[2] = 0.045; o[3] = 0.004;
      });
      INF['browOuter' + k] = influence(function (x, y, z, o) {
        o[0] = gauss((x - s * 0.3) * (x - s * 0.3), 0.07) * gauss((y - 0.14) * (y - 0.14), 0.05) * front(z);
        o[1] = 0; o[2] = 0.04; o[3] = 0;
      });
      INF['cheek' + k] = influence(function (x, y, z, o) {
        o[0] = gauss((x - s * 0.235) * (x - s * 0.235) + (y + 0.1) * (y + 0.1), 0.09) * front(z);
        o[1] = s * 0.006; o[2] = 0.032; o[3] = 0.014;
      });
      INF['corner' + k] = influence(function (x, y, z, o) {
        o[0] = gauss((x - s * 0.105) * (x - s * 0.105) + (y - LM.mouthY) * (y - LM.mouthY), 0.055) * front(z);
        o[1] = s * 0.02; o[2] = 0.034; o[3] = 0.004;
      });
      INF['clench' + k] = influence(function (x, y, z, o) {
        o[0] = gauss((x - s * 0.3) * (x - s * 0.3) + (y + 0.3) * (y + 0.3), 0.08) * smooth(-0.05, 0.2, z / HEAD.rz);
        o[1] = s * 0.014; o[2] = 0; o[3] = 0.006;
      });
    });
    INF.jaw = influence(function (x, y, z, o) {
      o[0] = smooth(-0.335, -0.46, y) * smooth(-0.05, 0.22, z / HEAD.rz);
      o[1] = 0; o[2] = -0.095; o[3] = -0.012;
    }); /* ---- eyes ---- */
    var eyes = [];
    var R = LM.eyeR;
    [-1, 1].forEach(function (s) {
      var hit = surface(s * LM.eyeX, LM.eyeY);
      var g = new T.Group();
      g.position.copy(hit.p).addScaledVector(hit.n, -R * 0.74);
      head.add(g);
      var ball = mesh(new T.SphereGeometry(R, 48, 36), M.eye, false);
      g.add(ball);

      function lidDome(top) {
        var geo = new T.SphereGeometry(R * 1.045, 36, 18, 0, Math.PI * 2, top ? 0 : Math.PI / 2, Math.PI / 2);
        var lg = new T.Group(), m = mesh(geo, M.lid); lg.add(m);
        if (top) { var ring = new T.Mesh(new T.TorusGeometry(R * 1.045, 0.0062, 6, 48), M.lash); ring.rotation.x = Math.PI / 2; lg.add(ring); }
        if (top) {
          for (var i = 0; i < 10; i++) {
            var psi = Math.PI / 2 - 0.85 + (1.7 * i) / 9, outer = clamp(s * Math.cos(psi) * 1.1 + 0.35, 0, 1);
            var len = 0.016 + 0.024 * outer, dir = new T.Vector3(Math.cos(psi) * 0.62 + s * 0.2 * outer, 0.6, Math.sin(psi) * 0.7 + 0.35).normalize();
            var lash = new T.Mesh(new T.CylinderGeometry(0.0004, 0.0034, len, 4), M.lash);
            lash.position.set(Math.cos(psi) * R * 1.045, 0, Math.sin(psi) * R * 1.045).addScaledVector(dir, len / 2);
            lash.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir);
            lg.add(lash);
          }
        }
        g.add(lg);
        return lg;
      }
      var cl = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
      var c1 = new T.Mesh(new T.CircleGeometry(R * 0.2, 20), cl), c2 = new T.Mesh(new T.CircleGeometry(R * 0.085, 14), cl);
      function place(m, dx, dy) {
        var v = new T.Vector3(dx, dy, 0); v.z = Math.sqrt(Math.max(0.05, 1 - dx * dx - dy * dy));
        m.position.copy(v).multiplyScalar(R * 1.012); m.lookAt(v.clone().multiplyScalar(5)); g.add(m);
      }
      place(c1, -0.2, 0.22); place(c2, 0.2, -0.2);
      eyes.push({ s: s, g: g, ball: ball, upper: lidDome(true), lower: lidDome(false) });
    }); /* ---- mouth ---- */
    var mHit = surface(0, LM.mouthY), mHi = surface(0, LM.mouthY + 0.05), mLo = surface(0, LM.mouthY - 0.05), mSide = surface(0.1, LM.mouthY);
    var Z0 = mHit.p.z, ZSLOPE = (mHi.p.z - mLo.p.z) / 0.1, ZCURVE = Math.max(0.2, (Z0 - mSide.p.z) / 0.01);
    function zAt(x, y) { return Z0 - ZCURVE * x * x + ZSLOPE * (y - LM.mouthY) + 0.004; }
    var NX = 30;
    var upperLip = Ribbon(NX, 6, M.lip), lowerLip = Ribbon(NX, 6, M.lip), cavity = Ribbon(NX, 10, M.mouth);
    [upperLip, lowerLip].forEach(function (r) { r.mesh.castShadow = true; r.mesh.receiveShadow = true; });
    head.add(upperLip.mesh); head.add(lowerLip.mesh); head.add(cavity.mesh);

    var LIP_EDGE = [0.16, 0.03, 0.035], LIP_BODY = [0.4, 0.09, 0.1], LIP_LIGHT = [0.5, 0.14, 0.14];
    function setLipColor(r, j, ny, edgeAtJ0) {
      var t = j / (ny - 1), e = edgeAtJ0 ? 1 - t : t;       // e = 1 at the closing line
      var k = smooth(0.0, 0.9, e), c = [0, 0, 0];
      for (var q = 0; q < 3; q++) c[q] = lerp(LIP_BODY[q], LIP_EDGE[q], Math.pow(k, 2.2)) * (1 - 0.0) + (LIP_LIGHT[q] - LIP_BODY[q]) * 0.5 * Math.sin(Math.PI * (1 - e)) * 0.4;
      return c;
    }

    var mouthState = { cornerL: 0, cornerR: 0, press: 0, wide: 0, open: 0 };
    function updateMouth(f) {
      var open = clamp(f.jaw, 0, 1.2), press = clamp(f.lipPress, 0, 1), wide = f.mouthWide || 0;
      var w = LM.mouthW * (1 + 0.1 * (f.smileL + f.smileR) / 2 + 0.1 * wide - 0.07 * press - 0.0);
      var drop = open * 0.1;
      for (var j = 0; j < 6; j++) for (var i = 0; i < NX; i++) {
        var u = i / (NX - 1), s = u * 2 - 1, x = s * w, as = Math.abs(s);
        var corner = (s < 0 ? f.smileL : f.smileR) * 0.03 - press * 0.002 + (f.cornerDown || 0) * 0.014;
        var line = corner * as * as * (0.4 + 0.6 * as);
        var env = 1 - Math.pow(as, 2.4);
        var thU = (0.031 * (0.35 + 0.65 * env) + 0.004 * Math.cos(s * 9) * (1 - as)) * (1 - 0.35 * press) * (1 + 0.1 * open);
        var thL = (0.042 * (0.3 + 0.7 * env)) * (1 - 0.3 * press);
        var bowDip = (1 - as) < 0.12 ? 0 : 0;
        // upper lip, rows go from the closing line (j = 0) up to the vermilion border
        var tU = j / 5, yU0 = line + open * 0.006 * env, yU1 = yU0 + thU + bowDip;
        var yu = LM.mouthY + lerp(yU0, yU1, tU);
        var bu = Math.pow(Math.sin(Math.PI * tU * 0.92 + 0.12), 0.9) * 0.016 * env;
        var o = (j * NX + i) * 3;
        upperLip.pos[o] = x; upperLip.pos[o + 1] = yu; upperLip.pos[o + 2] = zAt(x, yu) + bu + open * 0.004 * env;
        var cu = setLipColor(upperLip, j, 6, true);
        upperLip.col[o] = cu[0]; upperLip.col[o + 1] = cu[1]; upperLip.col[o + 2] = cu[2];
        // lower lip, rows go from the bottom border (j = 0) up to the closing line
        var tL = j / 5, yL1 = line - drop * env - 0.0, yL0 = yL1 - thL;
        var yl = LM.mouthY + lerp(yL0, yL1, tL) - (1 - env) * 0.0;
        var bl = Math.pow(Math.sin(Math.PI * (1 - tL) * 0.92 + 0.12), 0.9) * 0.021 * env;
        lowerLip.pos[o] = x; lowerLip.pos[o + 1] = yl; lowerLip.pos[o + 2] = zAt(x, yl) + bl + open * 0.014 * env;
        var cl = setLipColor(lowerLip, j, 6, false);
        lowerLip.col[o] = cl[0]; lowerLip.col[o + 1] = cl[1]; lowerLip.col[o + 2] = cl[2];
      }
      // cavity between the lips: teeth, then dark, then tongue
      for (var jj = 0; jj < 10; jj++) for (var ii = 0; ii < NX; ii++) {
        var u2 = ii / (NX - 1), s2 = u2 * 2 - 1, as2 = Math.abs(s2), x2 = s2 * w * 0.93;
        var env2 = 1 - Math.pow(as2, 2.4);
        var cornerY = (s2 < 0 ? f.smileL : f.smileR) * 0.03 * as2 * as2 * (0.4 + 0.6 * as2);
        var top = cornerY + open * 0.006 * env2, bot = cornerY - drop * env2;
        var tt = jj / 9, y2 = LM.mouthY + lerp(bot, top, tt);
        var o2 = (jj * NX + ii) * 3;
        cavity.pos[o2] = x2; cavity.pos[o2 + 1] = y2; cavity.pos[o2 + 2] = zAt(x2, y2) + 0.002;
        var teeth = tt > 0.7 && open > 0.06 ? 1 : 0, tongue = tt < 0.35 ? 1 : 0;
        var cc = teeth ? [0.65, 0.58, 0.52] : tongue ? [0.32, 0.06, 0.07] : [0.03, 0.005, 0.008];
        cavity.col[o2] = cc[0]; cavity.col[o2 + 1] = cc[1]; cavity.col[o2 + 2] = cc[2];
      }
      upperLip.commit(); lowerLip.commit(); cavity.commit();
    } /* ---- hair ---- */
    var hairGroup = new T.Group(); headPivot.add(hairGroup);
    hairGroup.position.set(0, HEAD_CENTER_Y - PIVOT_Y, 0);
    var strands = new T.Mesh(buildHair(), M.hair); strands.castShadow = true; strands.receiveShadow = true;
    hairGroup.add(strands);
    var capTop = new T.Mesh(new T.SphereGeometry(1, 64, 48, 0, Math.PI * 2, 0, 1.0), M.hairCap);
    capTop.scale.set(0.46, 0.545, 0.5); capTop.position.set(0, 0.012, -0.02); capTop.castShadow = true; hairGroup.add(capTop);
    var capBack = new T.Mesh(new T.SphereGeometry(1, 64, 48, Math.PI, Math.PI, 0, 2.05), M.hairCap);
    capBack.scale.set(0.46, 0.545, 0.5); capBack.position.set(0, 0.012, -0.02); capBack.castShadow = true; hairGroup.add(capBack); /* ---- body ---- */
    var body = new T.Group();
    var neckGeo = new T.CylinderGeometry(0.2, 0.245, 0.95, 48, 6, true), neckCol = [];
    for (var ni = 0; ni < neckGeo.attributes.position.count; ni++) {      // shade under the jaw: darker near the chin, open towards the collar
      var wy = 5.92 + neckGeo.attributes.position.getY(ni), sh = lerp(0.4, 1.0, smooth(6.07, 5.86, wy));
      neckCol.push(sh, sh, sh);
    }
    neckGeo.setAttribute('color', new T.Float32BufferAttribute(neckCol, 3));
    var neckMat = M.bodySkin.clone(); neckMat.vertexColors = true; neckMat.color.set(0x9c6049);
    var neck = mesh(neckGeo, neckMat);
    neck.position.set(0, 5.92, -0.015); body.add(neck);
    var prof = [[0.5, 2.0], [0.54, 2.6], [0.62, 3.3], [0.58, 3.75], [0.42, 4.2], [0.48, 4.7], [0.6, 5.0], [0.72, 5.22], [0.77, 5.36], [0.72, 5.5], [0.58, 5.63], [0.42, 5.75], [0.3, 5.84], [0.248, 5.9]]
      .map(function (p) { return new T.Vector2(p[0], p[1]); });
    var dress = mesh(new T.LatheGeometry(prof, 72), M.dress);
    dress.scale.z = 0.55; body.add(dress);
    var collar = mesh(new T.TorusGeometry(0.25, 0.028, 16, 48), M.dress);
    collar.rotation.x = Math.PI / 2; collar.position.y = 5.895; collar.scale.set(1, 0.9, 1); body.add(collar);

    var arms = [];
    [-1, 1].forEach(function (s) {
      var sh = new T.Group(); sh.position.set(s * 0.8, 5.3, 0);
      sh.add(ell(0.185, 0.2, 0.18, M.dress));
      var up = mesh(new T.CylinderGeometry(0.175, 0.14, 0.9, 32), M.dress); up.position.y = -0.45; sh.add(up);
      var el = new T.Group(); el.position.y = -0.9; sh.add(el);
      el.add(ell(0.142, 0.145, 0.14, M.dress));
      var fo = mesh(new T.CylinderGeometry(0.138, 0.092, 0.85, 32), M.dress); fo.position.y = -0.425; el.add(fo);
      var hand = new T.Group(); hand.position.y = -0.86; el.add(hand);
      var palm = ell(0.085, 0.17, 0.055, M.bodySkin); palm.position.y = -0.14; hand.add(palm);
      for (var f = 0; f < 4; f++) {
        var fin = ell(0.018, 0.1 - Math.abs(f - 1.4) * 0.008, 0.017, M.bodySkin, 12); fin.position.set((f - 1.5) * 0.04, -0.3, 0.012); fin.rotation.x = -0.18; hand.add(fin);
      }
      var th = ell(0.02, 0.07, 0.02, M.bodySkin, 12); th.position.set(-s * 0.075, -0.15, 0.03); th.rotation.z = s * 0.4; hand.add(th);
      sh.rotation.z = s * 0.1; el.rotation.x = -0.5; hand.rotation.x = -0.15; hand.scale.setScalar(0.88);
      body.add(sh); arms.push({ s: s, sh: sh, el: el });
    });
    [-1, 1].forEach(function (s) {
      var legPts = [[0.07, 0.15], [0.085, 0.3], [0.115, 0.9], [0.12, 1.1], [0.105, 1.5], [0.13, 1.9], [0.14, 2.05]].map(function (p) { return new T.Vector2(p[0], p[1]); });
      var leg = mesh(new T.LatheGeometry(legPts, 28), M.hosiery); leg.position.set(s * 0.2, 0, 0); body.add(leg);
      var shoe = ell(0.1, 0.075, 0.26, M.shoe); shoe.position.set(s * 0.2, 0.09, 0.1); body.add(shoe);
    });

    var upperBody = new T.Group();      // everything that breathes together
    group.add(body); group.add(headPivot);
    var api = {
      group: group,
      attachTo: function (scene) { scene.add(group); },
      /* gaze in radians, + yaw looks to the right of the screen, + pitch looks up */
      setGaze: function (yaw, pitch, per) {
        for (var i = 0; i < eyes.length; i++) {
          // eyes[i].s < 0 is the eye on the screen's left, which is the subject's RIGHT eye
          if (per) { var right = eyes[i].s < 0; eyes[i].ball.rotation.set(-(right ? per.pitchR : per.pitchL), right ? per.yawR : per.yawL, 0); }
          else eyes[i].ball.rotation.set(-pitch, yaw, 0);
        }
      },

      /* face params: see ExpressionController for the meaning of each key */
      setFace: function (f) {
        var pos = headGeo.attributes.position.array;
        pos.set(basePos);
        function apply(inf, v) {
          if (!v) return;
          var idx = inf.idx, dx = inf.dx, dy = inf.dy, dz = inf.dz;
          for (var q = 0; q < idx.length; q++) { var i3 = idx[q] * 3; pos[i3] += v * dx[q]; pos[i3 + 1] += v * dy[q]; pos[i3 + 2] += v * dz[q]; }
        }
        apply(INF.browUpL, f.browUpL); apply(INF.browUpR, f.browUpR);
        apply(INF.browInnerL, f.browInnerL); apply(INF.browInnerR, f.browInnerR);
        apply(INF.browOuterL, f.browOuterL); apply(INF.browOuterR, f.browOuterR);
        apply(INF.cheekL, f.cheek * (0.5 + f.smileL * 0.5)); apply(INF.cheekR, f.cheek * (0.5 + f.smileR * 0.5));
        apply(INF.cornerL, f.smileL); apply(INF.cornerR, f.smileR);
        apply(INF.clenchL, f.clench); apply(INF.clenchR, f.clench);
        apply(INF.jaw, clamp(f.jaw, 0, 1.2));
        headGeo.attributes.position.needsUpdate = true;
        headGeo.computeVertexNormals();

        for (var i = 0; i < eyes.length; i++) {
          var e = eyes[i], open = e.s < 0 ? f.lidL : f.lidR;
          open = clamp(open * (1 - f.blink), 0, 1.15);
          var eUp = lerp(-0.5, 0.78, open) - 0.04;                       // edge elevation of the upper lid, radians
          var eLow = lerp(-0.3, -0.12, clamp(f.squint + f.blink * 0.8, 0, 1));
          e.upper.rotation.x = -eUp;
          e.lower.rotation.x = -eLow;
        }
        updateMouth(f);
      },

      /* pose in radians; breath 0..1; sway in head units */
      setPose: function (p) {
        headPivot.rotation.set(p.headPitch, p.headYaw, p.headRoll, 'YXZ');
        hairGroup.rotation.set(0, 0, 0);
        var lift = (p.breath || 0) * 0.016;
        headPivot.position.y = PIVOT_Y + lift + (p.chest || 0) * 0.02;
        body.position.set(p.sway || 0, 0, 0);
        body.rotation.set(0, p.bodyYaw || 0, p.bodyRoll || 0, 'YXZ');
        dress.scale.y = 1 + (p.breath || 0) * 0.004;
        headPivot.position.x = (p.sway || 0);
        arms.forEach(function (a) {
          a.sh.rotation.z = a.s * (0.1 + (p.breath || 0) * 0.008);
          a.el.rotation.x = -0.5 + (p.armSwing || 0) * a.s * 0.02;
        });
        hairGroup.rotation.x = -(p.headPitch || 0) * 0.15;
      },

      materials: M,
      landmarks: { headCenterY: HEAD_CENTER_Y, eyeY: HEAD_CENTER_Y + LM.eyeY, mouthY: HEAD_CENTER_Y + LM.mouthY }
    };
    return api;
  };
})(window);
