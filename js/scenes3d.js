/* VOSAFRA CONNECT — cenas 3D em WebGL (Three.js r128)
   API: VosafraScenes.hero(canvas, {onCoverage})       -> {setProgress, destroy}
        VosafraScenes.rota(canvas, {onUpdate})         -> {destroy}
        VosafraScenes.solar(canvas, {onUpdate})        -> {destroy}
        VosafraScenes.cursor()                         -> drone 3D no lugar do mouse
   Se WebGL falhar, cada função devolve null e o site usa os filmes 2D (films.js). */
(function () {
  'use strict';
  if (!window.THREE) return;
  var T = window.THREE;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LIMA = 0xBAEB49, OFF = 0xF6F6F0, FLORESTA = 0x0C352D, SALVIA = 0x87A996;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  /* ---------- palco WebGL: tamanho, DPR, pausa fora da tela ---------- */
  function Stage3(canvas, o) {
    var r;
    try { r = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
    catch (e) { return null; }
    if (!r.getContext()) return null;
    r.setClearColor(0x000000, 0);
    var st = { w: 0, h: 0, t: 0 }, raf = 0, last = 0, running = false, visible = true, alive = true, ro = null, io = null;
    function frame(dt) { o.update(dt, st.t); r.render(o.scene, o.camera); }
    function size() {
      var b = canvas.getBoundingClientRect(), w = Math.max(1, Math.round(b.width)), h = Math.max(1, Math.round(b.height));
      if (w === st.w && h === st.h) return;
      st.w = w; st.h = h;
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 700 ? 1.5 : (o.maxDpr || 2)));
      r.setSize(w, h, false);
      o.camera.aspect = w / h; o.camera.updateProjectionMatrix();
      if (o.resize) o.resize(w, h);
      if (!running) frame(0);
    }
    function tick(now) {
      raf = 0; if (!running) return;
      var dt = last ? Math.min(.05, (now - last) / 1000) : 1 / 60; last = now; st.t += dt;
      frame(dt);
      raf = requestAnimationFrame(tick);
    }
    function update() {
      var go = alive && visible && !document.hidden && !reduce;
      if (go && !running) { running = true; last = 0; raf = requestAnimationFrame(tick); }
      else if (!go && running) { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    }
    if ('ResizeObserver' in window) { ro = new ResizeObserver(size); ro.observe(canvas); } else window.addEventListener('resize', size);
    if ('IntersectionObserver' in window) { io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; update(); }, { rootMargin: '100px' }); io.observe(canvas); }
    document.addEventListener('visibilitychange', update);
    size();
    if (reduce && o.warm) { for (var i = 0; i < o.warm; i++) { st.t += 1 / 30; o.update(1 / 30, st.t); } frame(0); }
    update();
    return {
      renderer: r, st: st,
      redraw: function () { if (!running) frame(0); },
      destroy: function () {
        alive = false; update();
        if (ro) ro.disconnect(); else window.removeEventListener('resize', size);
        if (io) io.disconnect();
        document.removeEventListener('visibilitychange', update);
        r.dispose();
      }
    };
  }

  /* ---------- drone agrícola 3D (hexacóptero com tanque e barra de bicos) ---------- */
  function makeDrone() {
    var g = new T.Group();
    var dark = new T.MeshStandardMaterial({ color: 0x1f2a26, roughness: .45, metalness: .5 });
    var mid = new T.MeshStandardMaterial({ color: 0x34443d, roughness: .6, metalness: .3 });
    var light = new T.MeshStandardMaterial({ color: OFF, roughness: .4, metalness: .1 });
    var body = new T.Mesh(new T.BoxGeometry(.95, .32, 1.25), dark); g.add(body);
    var cap = new T.Mesh(new T.BoxGeometry(.7, .12, .9), light); cap.position.y = .21; g.add(cap);
    var tank = new T.Mesh(new T.CylinderGeometry(.34, .28, .5, 18), mid); tank.position.y = -.38; g.add(tank);
    var bar = new T.Mesh(new T.CylinderGeometry(.035, .035, 2.1, 8), mid); bar.rotation.z = Math.PI / 2; bar.position.set(0, -.62, .1); g.add(bar);
    for (var n = -1; n <= 1; n += 2) {
      var skid = new T.Mesh(new T.CylinderGeometry(.04, .04, 1.4, 8), dark); skid.rotation.x = Math.PI / 2; skid.position.set(n * .55, -.85, 0); g.add(skid);
      var leg = new T.Mesh(new T.CylinderGeometry(.035, .035, .7, 6), dark); leg.position.set(n * .5, -.5, 0); leg.rotation.z = n * .2; g.add(leg);
    }
    var rotors = [];
    var discMat = new T.MeshBasicMaterial({ color: OFF, transparent: true, opacity: .13, depthWrite: false, side: T.DoubleSide });
    var bladeMat = new T.MeshStandardMaterial({ color: 0x111816, roughness: .5 });
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 6 + i * Math.PI / 3, arm = new T.Group();
      arm.rotation.y = -a;
      var tube = new T.Mesh(new T.CylinderGeometry(.06, .06, 1.35, 8), dark); tube.rotation.z = Math.PI / 2; tube.position.x = .72; arm.add(tube);
      var motor = new T.Mesh(new T.CylinderGeometry(.13, .13, .22, 12), mid); motor.position.set(1.4, .08, 0); arm.add(motor);
      var prop = new T.Group(); prop.position.set(1.4, .22, 0);
      var b1 = new T.Mesh(new T.BoxGeometry(1.15, .02, .1), bladeMat); prop.add(b1);
      var disc = new T.Mesh(new T.CircleGeometry(.6, 28), discMat); disc.rotation.x = -Math.PI / 2; prop.add(disc);
      arm.add(prop); rotors.push(prop);
      g.add(arm);
    }
    var led = new T.Mesh(new T.SphereGeometry(.07, 10, 8), new T.MeshBasicMaterial({ color: LIMA }));
    led.position.set(0, .1, -.64); g.add(led);
    g.userData = { rotors: rotors, led: led };
    return g;
  }
  function animDrone(d, t, dt) {
    var u = d.userData;
    for (var i = 0; i < u.rotors.length; i++) u.rotors[i].rotation.y += dt * (i % 2 ? 38 : -38);
    u.led.visible = Math.sin(t * 9) > -.2;
  }

  function textSprite(text, color, w) {
    var c = document.createElement('canvas'); c.width = w || 320; c.height = 64;
    var g = c.getContext('2d');
    g.fillStyle = 'rgba(8,36,30,.86)';
    if (g.roundRect) { g.beginPath(); g.roundRect(4, 8, c.width - 8, 48, 10); g.fill(); } else g.fillRect(4, 8, c.width - 8, 48);
    g.font = '600 26px "JetBrains Mono", ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = color || '#F6F6F0'; g.fillText(text, c.width / 2, 33);
    var tex = new T.CanvasTexture(c);
    var s = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    s.scale.set(c.width / 64 * 1.35, 1.35, 1);
    s.userData.canvas = c; s.userData.text = text;
    return s;
  }
  function glowTexture(inner, outer) {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, inner); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(c);
  }

  // partículas de calda / gotas (pool fixo, sem alocação por quadro)
  function Spray(n, color, size) {
    var pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), life = new Float32Array(n), k = 0;
    for (var i = 0; i < n; i++) pos[i * 3 + 1] = -999;
    var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    var pts = new T.Points(geo, new T.PointsMaterial({ color: color, size: size, transparent: true, opacity: .75, depthWrite: false, sizeAttenuation: true }));
    pts.frustumCulled = false;
    return {
      obj: pts,
      emit: function (x, y, z, vx, vy, vz, l) { var j = k * 3; pos[j] = x; pos[j + 1] = y; pos[j + 2] = z; vel[j] = vx; vel[j + 1] = vy; vel[j + 2] = vz; life[k] = l; k = (k + 1) % n; },
      step: function (dt) {
        for (var i = 0; i < n; i++) {
          if (life[i] <= 0) continue;
          var j = i * 3; life[i] -= dt;
          if (life[i] <= 0) { pos[j + 1] = -999; continue; }
          vel[j + 1] -= 6 * dt; vel[j] *= .98; vel[j + 2] *= .98;
          pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
        }
        geo.attributes.position.needsUpdate = true;
      }
    };
  }

  /* ================= ABERTURA: serra de Santa Teresa em 3D ================= */
  function hero(canvas, opts) {
    if (!canvas) return null;
    opts = opts || {};
    var mob = window.innerWidth < 700;
    var HX = mob ? 14 : 21, HZ = 5, HR = 19, HH = 8;
    function hill(x, z) { var dx = (x - HX) / HR, dz = (z - HZ) / (HR * .75), d = dx * dx + dz * dz; return d < 1 ? (1 - d) * (1 - d) * HH : 0; }
    function H(x, z) {
      var far = clamp((-z + 6) / 115, 0, 1);
      var r = Math.sin(x * .05 + 1.3) * .55 + Math.sin(x * .12 - z * .04) * .25 + Math.sin(x * .021 + z * .035 + 2) * .6 + Math.sin(x * .27 + z * .2) * .08;
      return (r + 1.5) / 3 * (4 + far * 36) * Math.pow(far, .75) + hill(x, z) - 1.5 + Math.sin(x * .9) * Math.cos(z * .8) * .12;
    }

    var scene = new T.Scene();
    scene.fog = new T.Fog(0xc3d4b6, 30, 185);
    var camera = new T.PerspectiveCamera(mob ? 58 : 42, 1, .1, 500);
    scene.add(new T.HemisphereLight(0xe8efdc, 0x0c352d, 1.05));
    var sun = new T.DirectionalLight(0xfff0cf, 1.15); sun.position.set(50, 45, -70); scene.add(sun);

    // relevo low-poly com cor por altitude
    var seg = mob ? [110, 80] : [180, 130];
    var geo = new T.PlaneGeometry(340, 240, seg[0], seg[1]); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, -78);
    var pos = geo.attributes.position, cols = new Float32Array(pos.count * 3), c = new T.Color();
    var cLow = new T.Color(0x15473a), cMid = new T.Color(0x386a55), cHigh = new T.Color(0x9bb8a3);
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i), y = H(x, z); pos.setY(i, y);
      var t = clamp((y + 1) / 34, 0, 1);
      c.copy(cLow).lerp(cMid, clamp(t * 2.2, 0, 1)).lerp(cHigh, clamp(t * 2 - 1, 0, 1));
      if (hill(x, z) > .2) c.lerp(new T.Color(0x1f5a45), .5);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new T.BufferAttribute(cols, 3)); geo.computeVertexNormals();
    scene.add(new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 })));

    // pés de café em curvas de nível na encosta
    var plants = [], ks = [];
    for (var k = .2; k <= .97; k += .045) ks.push(k);
    ks.forEach(function (k) {
      var rx = k * HR, rz = k * HR * .75, step = .9 / rx;
      for (var a = -.25; a <= Math.PI + .25; a += step) {
        var px = HX + Math.cos(a) * rx, pz = HZ + Math.sin(a) * rz;
        plants.push(px, H(px, pz) + .38, pz);
      }
    });
    var NP = plants.length / 3;
    var bush = new T.IcosahedronGeometry(.5, 0); bush.scale(1, .85, 1);
    var bushes = new T.InstancedMesh(bush, new T.MeshStandardMaterial({ flatShading: true, roughness: .9 }), NP);
    var m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), v3 = new T.Vector3(), base = [], treated = new Float32Array(NP);
    var lime = new T.Color(LIMA);
    for (var p = 0; p < NP; p++) {
      var s = .8 + Math.random() * .35;
      q.setFromAxisAngle(new T.Vector3(0, 1, 0), Math.random() * 6);
      sc.set(s, s, s); v3.set(plants[p * 3], plants[p * 3 + 1], plants[p * 3 + 2]);
      m4.compose(v3, q, sc); bushes.setMatrixAt(p, m4);
      var bc = new T.Color().setHSL(.36 + Math.random() * .04, .45, .2 + Math.random() * .07);
      base.push(bc); bushes.setColorAt(p, bc);
    }
    bushes.instanceColor.needsUpdate = true;
    scene.add(bushes);

    // neblina em camadas + brilho do sol
    var fogTex = glowTexture('rgba(242,246,234,.75)', 'rgba(242,246,234,0)'), mists = [];
    for (var f = 0; f < (mob ? 9 : 16); f++) {
      var mist = new T.Sprite(new T.SpriteMaterial({ map: fogTex, transparent: true, opacity: .32 + Math.random() * .2, depthWrite: false }));
      mist.position.set(-120 + Math.random() * 240, 5 + Math.random() * 12, -25 - Math.random() * 110);
      mist.scale.set(60 + Math.random() * 50, 9 + Math.random() * 7, 1);
      mist.userData.v = 1 + Math.random() * 2; mists.push(mist); scene.add(mist);
    }
    var glow = new T.Sprite(new T.SpriteMaterial({ map: glowTexture('rgba(255,250,222,.95)', 'rgba(255,250,222,0)'), transparent: true, depthWrite: false, fog: false }));
    glow.position.set(70, 34, -230); glow.scale.set(170, 170, 1); scene.add(glow);

    // drone em serpentina sobre as fileiras
    var drone = makeDrone(); drone.scale.setScalar(mob ? 1.15 : 1); scene.add(drone);
    var shadow = new T.Mesh(new T.CircleGeometry(1.6, 24), new T.MeshBasicMaterial({ color: 0x041a14, transparent: true, opacity: .35, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
    var rows = [.86, .74, .62, .5, .38], pts = [new T.Vector3(70, 26, -25)];
    rows.forEach(function (k, r) {
      var rx = k * HR, rz = k * HR * .75;
      for (var u = 0; u <= 1.0001; u += .05) {
        var a = r % 2 === 0 ? lerp(Math.PI + .15, -.15, u) : lerp(-.15, Math.PI + .15, u);
        var px = HX + Math.cos(a) * rx, pz = HZ + Math.sin(a) * rz;
        pts.push(new T.Vector3(px, H(px, pz) + 3.1, pz));
      }
    });
    pts.push(new T.Vector3(-35, 30, -50));
    var path = new T.CatmullRomCurve3(pts, false, 'catmullrom', .25), LEN = path.getLength();
    var spray = Spray(mob ? 260 : 650, 0xeef6e8, .22); scene.add(spray.obj);

    var P = 0, Pt = 0, mx = 0, my = 0, mxT = 0, myT = 0, dist = 0, pause = 0, cov = 0, lastCov = -1;
    var tan = new T.Vector3(), here = new T.Vector3(), look = new T.Vector3();
    function onMove(e) { mxT = e.clientX / window.innerWidth * 2 - 1; myT = e.clientY / window.innerHeight * 2 - 1; }
    window.addEventListener('pointermove', onMove, { passive: true });

    var camA = mob ? [new T.Vector3(10, 13, 58), new T.Vector3(13, 5, 2)] : [new T.Vector3(-3, 11, 47), new T.Vector3(7, 5, -10)];
    var camB = mob ? [new T.Vector3(14, 8, 36), new T.Vector3(15, 5, 8)] : [new T.Vector3(9, 7.5, 30), new T.Vector3(14, 5, 4)];

    function update(dt, t) {
      Pt = dt ? lerp(Pt, P, Math.min(1, dt * 5)) : P;
      mx = lerp(mx, mxT, Math.min(1, dt * 2)); my = lerp(my, myT, Math.min(1, dt * 2));
      var e = ease(Pt);
      camera.position.lerpVectors(camA[0], camB[0], e);
      camera.position.x += mx * 2.6 + Math.sin(t * .1) * 1.2; camera.position.y += -my * 1.2 + Math.sin(t * .13) * .4;
      look.lerpVectors(camA[1], camB[1], e); camera.lookAt(look);

      for (var i = 0; i < mists.length; i++) { var m = mists[i]; m.position.x += m.userData.v * dt; if (m.position.x > 140) m.position.x = -140; }

      // voo
      if (pause > 0) {
        pause -= dt;
        if (pause <= 0) { dist = 0; for (var j = 0; j < NP; j++) { treated[j] = 0; bushes.setColorAt(j, base[j]); } bushes.instanceColor.needsUpdate = true; }
      } else {
        dist += dt * 8.5;
        if (dist >= LEN) { dist = LEN; pause = 2.2; }
      }
      var u = clamp(dist / LEN, 0, 1);
      path.getPointAt(u, here); path.getTangentAt(u, tan);
      drone.position.copy(here); drone.position.y += Math.sin(t * 2.2) * .12;
      drone.rotation.set(.12, Math.atan2(tan.x, tan.z), -tan.x * .08);
      animDrone(drone, t, dt);
      var gy = H(here.x, here.z);
      shadow.position.set(here.x + .6, gy + .25, here.z + .4);
      shadow.visible = here.y - gy < 8;

      var spraying = hill(here.x, here.z) > .4 && pause <= 0 && here.y - gy < 4.5;
      if (spraying && dt) {
        var n = Math.round(dt * (mob ? 140 : 320));
        for (var s2 = 0; s2 < n; s2++) {
          spray.emit(here.x + (Math.random() - .5) * 2, here.y - .7, here.z + (Math.random() - .5) * 1.2,
            (Math.random() - .5) * .8, -1.5 - Math.random() * 2, (Math.random() - .5) * .8, .5 + Math.random() * .5);
        }
        var changed = false;
        for (var p2 = 0; p2 < NP; p2++) {
          if (treated[p2] >= 1) continue;
          var dx = plants[p2 * 3] - here.x, dz = plants[p2 * 3 + 2] - here.z;
          if (dx * dx + dz * dz < 4.4) {
            treated[p2] = Math.min(1, treated[p2] + dt * 3);
            c.copy(base[p2]).lerp(lime, treated[p2] * .62); bushes.setColorAt(p2, c); changed = true;
          }
        }
        if (changed) bushes.instanceColor.needsUpdate = true;
      }
      spray.step(dt);

      if (opts.onCoverage) {
        var done = 0; for (var p3 = 0; p3 < NP; p3 += 4) if (treated[p3] > .5) done++;
        cov = Math.min(1, done / (NP / 4) * 1.25);
        var pct = Math.round(cov * 100);
        if (pct !== lastCov) { lastCov = pct; opts.onCoverage(pct, spraying); }
      }
    }

    var stage = Stage3(canvas, { scene: scene, camera: camera, update: update, warm: 300, maxDpr: 1.75 });
    if (!stage) return null;
    return {
      setProgress: function (p) { P = clamp(p, 0, 1); if (reduce) stage.redraw(); },
      destroy: function () { window.removeEventListener('pointermove', onMove); stage.destroy(); }
    };
  }

  /* ================= ROTA SAFRA: maquete 3D com 4 sítios ================= */
  function rota(canvas, opts) {
    if (!canvas) return null;
    opts = opts || {};
    function h(x, z) { return 1.1 * Math.sin(x * .22) * Math.cos(z * .19) + .7 * Math.sin(x * .1 + z * .16) + .4 * Math.cos(z * .35 + 1); }
    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(36, 1, .1, 300);
    scene.add(new T.HemisphereLight(0xe6eed8, 0x062019, 1));
    var dl = new T.DirectionalLight(0xfff3d6, .9); dl.position.set(-20, 40, 25); scene.add(dl);

    var W = 38, D = 30;
    var g = new T.PlaneGeometry(W, D, 76, 60); g.rotateX(-Math.PI / 2);
    var ps = g.attributes.position, cl = new Float32Array(ps.count * 3), cc = new T.Color();
    for (var i = 0; i < ps.count; i++) {
      var x = ps.getX(i), z = ps.getZ(i), y = h(x, z); ps.setY(i, y);
      cc.set(0x174a3c).lerp(new T.Color(0x3b6c58), clamp((y + 2) / 4.5, 0, 1));
      cl[i * 3] = cc.r; cl[i * 3 + 1] = cc.g; cl[i * 3 + 2] = cc.b;
    }
    g.setAttribute('color', new T.BufferAttribute(cl, 3)); g.computeVertexNormals();
    scene.add(new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })));
    var slab = new T.Mesh(new T.BoxGeometry(W, 4, D), new T.MeshStandardMaterial({ color: 0x072720, roughness: 1 }));
    slab.position.y = -4.1; scene.add(slab);
    var edge = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(W, 4, D)), new T.LineBasicMaterial({ color: SALVIA, transparent: true, opacity: .35 }));
    edge.position.y = -4.1; scene.add(edge);

    // estrada de chão
    var road = new T.CatmullRomCurve3([[-19, 12], [-10, 8], [-6, 0], [2, -1], [10, -4], [19, -11]].map(function (p) { return new T.Vector3(p[0], h(p[0], p[1]) + .12, p[1]); }));
    scene.add(new T.Mesh(new T.TubeGeometry(road, 80, .32, 5, false), new T.MeshStandardMaterial({ color: 0x8a7f62, roughness: 1 })));

    var FARMS = [[-9, -6, .3], [5, -8.5, -.2], [11.5, 3, .25], [-1, 6.5, -.35]], farms = [];
    FARMS.forEach(function (f, i) {
      var gy = h(f[0], f[1]), grp = new T.Group();
      grp.position.set(f[0], gy + .25, f[1]); grp.rotation.y = f[2];
      var mat = new T.MeshStandardMaterial({ color: 0x0f3c31, roughness: .9, emissive: 0x000000 });
      grp.add(new T.Mesh(new T.BoxGeometry(6.4, .35, 4.6), mat));
      var rowMat = new T.MeshStandardMaterial({ color: 0x3f7a5f, roughness: .8, emissive: 0x000000 });
      for (var r = -2; r <= 2; r++) { var row = new T.Mesh(new T.BoxGeometry(5.8, .3, .38), rowMat); row.position.set(0, .3, r * .85); grp.add(row); }
      scene.add(grp);
      var pin = new T.Group();
      var cone = new T.Mesh(new T.ConeGeometry(.42, 1.1, 14), new T.MeshStandardMaterial({ color: OFF, emissive: 0x000000 })); cone.rotation.x = Math.PI; pin.add(cone);
      var ball = new T.Mesh(new T.SphereGeometry(.5, 16, 12), cone.material); ball.position.y = .7; pin.add(ball);
      pin.position.set(f[0], gy + 3.2, f[1]); pin.scale.setScalar(.001); scene.add(pin);
      var label = textSprite('SÍTIO 0' + (i + 1) + ' · 8 ha', '#F6F6F0', 340); label.position.set(f[0], gy + 5.2, f[1]); label.material.opacity = 0; scene.add(label);
      farms.push({ x: f[0], z: f[1], y: gy, mat: mat, rowMat: rowMat, pin: pin, pinMat: cone.material, label: label, appear: .3 + i * .5, done: -1 });
    });
    var bx = -14.5, bz = 11, by = h(bx, bz);
    var baseBox = new T.Mesh(new T.BoxGeometry(1.6, 1.2, 1.6), new T.MeshStandardMaterial({ color: OFF })); baseBox.position.set(bx, by + .6, bz); scene.add(baseBox);
    var ring = new T.Mesh(new T.TorusGeometry(1.8, .08, 8, 40), new T.MeshBasicMaterial({ color: LIMA })); ring.rotation.x = Math.PI / 2; ring.position.set(bx, by + .15, bz); scene.add(ring);
    var bl = textSprite('BASE DO OPERADOR', '#BAEB49', 380); bl.position.set(bx, by + 3, bz); scene.add(bl);

    // rota aérea
    var rp = [new T.Vector3(bx, by + 2.2, bz)];
    farms.forEach(function (f) { rp.push(new T.Vector3(f.x, f.y + 2.4, f.z)); });
    rp.push(new T.Vector3(bx, by + 2.2, bz));
    var curve = new T.CatmullRomCurve3(rp, false, 'catmullrom', .5);
    var tube = new T.TubeGeometry(curve, 420, .14, 6, false), TOT = tube.index.count;
    var route = new T.Mesh(tube, new T.MeshBasicMaterial({ color: LIMA }));
    tube.setDrawRange(0, 0); scene.add(route);
    var halo = new T.Mesh(new T.TubeGeometry(curve, 420, .42, 6, false), new T.MeshBasicMaterial({ color: LIMA, transparent: true, opacity: .14, depthWrite: false }));
    halo.geometry.setDrawRange(0, 0); scene.add(halo);
    var farmU = farms.map(function (f) {
      var best = 0, bd = 1e9, pt = new T.Vector3();
      for (var s = 0; s <= 400; s++) { curve.getPointAt(s / 400, pt); var d = (pt.x - f.x) * (pt.x - f.x) + (pt.z - f.z) * (pt.z - f.z); if (d < bd) { bd = d; best = s / 400; } }
      return best;
    });
    var drone = makeDrone(); drone.scale.setScalar(.55); scene.add(drone);
    var limeC = new T.Color(LIMA), cTmp = new T.Color(), tan = new T.Vector3(), lt = 0, LOOP = 13.5, shownHa = -1, shownProd = -1;

    function update(dt, t) {
      if (reduce) lt = 11.6; else { lt += dt; if (lt > LOOP) lt = 0; }
      var T0 = lt;
      var ang = Math.sin(t * .12) * .35 + .5;
      camera.position.set(Math.sin(ang) * 31, 27, Math.cos(ang) * 31); camera.lookAt(0, -1.5, 1);
      var draw = ease(clamp((T0 - 2.6) / 2, 0, 1)), travel = clamp((T0 - 4.8) / 6.2, 0, 1), u = ease(travel);
      var cnt = Math.floor(draw * TOT / 3) * 3;
      tube.setDrawRange(0, cnt); halo.geometry.setDrawRange(0, Math.floor(draw * halo.geometry.index.count / 3) * 3);
      var served = 0, visibleN = 0;
      farms.forEach(function (f, i) {
        var a = ease(clamp((T0 - f.appear) / .5, 0, 1));
        if (a > 0) visibleN++;
        f.pin.scale.setScalar(Math.max(.001, a)); f.pin.position.y = f.y + 3.2 + Math.sin(t * 2 + i) * .25;
        f.label.material.opacity = a;
        if (travel > 0 && u >= farmU[i]) { if (f.done < 0) f.done = T0; } else if (T0 < 4.8) f.done = -1;
        var k = f.done >= 0 ? clamp((T0 - f.done) / .7, 0, 1) : 0;
        if (reduce && T0 > 11) k = 1;
        if (k > 0) served++;
        f.mat.color.set(0x0f3c31).lerp(limeC, k * .45); f.mat.emissive.set(0x000000).lerp(cTmp.set(0x2c4a10), k);
        f.rowMat.color.set(0x3f7a5f).lerp(limeC, k * .85);
        f.pinMat.color.set(k > 0 ? LIMA : OFF);
      });
      if (travel > 0 && travel < 1) {
        drone.visible = true;
        curve.getPointAt(u, drone.position); curve.getTangentAt(u, tan);
        drone.rotation.set(.15, Math.atan2(tan.x, tan.z), 0);
        animDrone(drone, t, dt || .016);
      } else drone.visible = false;
      ring.scale.setScalar(1 + Math.sin(t * 3) * .06);
      var fade = T0 > LOOP - .6 ? 1 - (T0 - (LOOP - .6)) / .6 : 1;
      route.material.opacity = fade; route.material.transparent = fade < 1;
      var ha = served * 8, prod = Math.max(served, visibleN);
      if (opts.onUpdate && (ha !== shownHa || prod !== shownProd)) { shownHa = ha; shownProd = prod; opts.onUpdate(ha, prod); }
    }
    var stage = Stage3(canvas, { scene: scene, camera: camera, update: update, warm: 1 });
    if (!stage) return null;
    return { destroy: function () { stage.destroy(); } };
  }

  /* ================= PLACAS SOLARES: limpeza com drone ================= */
  function solar(canvas, opts) {
    if (!canvas) return null;
    opts = opts || {};
    var mob = window.innerWidth < 700;
    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(38, 1, .1, 200);
    scene.add(new T.HemisphereLight(0xeaf2e4, 0x062019, .95));
    var dl = new T.DirectionalLight(0xfff4dc, 1.2); dl.position.set(8, 14, 6); scene.add(dl);
    var ground = new T.Mesh(new T.PlaneGeometry(60, 60), new T.MeshStandardMaterial({ color: 0x0f3a30, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -.8; scene.add(ground);

    var cells = document.createElement('canvas'); cells.width = 256; cells.height = 160;
    var cg = cells.getContext('2d'); cg.fillStyle = '#ffffff'; cg.fillRect(0, 0, 256, 160);
    cg.strokeStyle = 'rgba(40,60,70,.55)'; cg.lineWidth = 3;
    for (var cx = 0; cx <= 256; cx += 32) { cg.beginPath(); cg.moveTo(cx, 0); cg.lineTo(cx, 160); cg.stroke(); }
    for (var cy = 0; cy <= 160; cy += 40) { cg.beginPath(); cg.moveTo(0, cy); cg.lineTo(256, cy); cg.stroke(); }
    var cellTex = new T.CanvasTexture(cells);

    var COLS = mob ? 4 : 5, ROWS = 3, panels = [], DIRTY = new T.Color(0x8a8263), CLEAN = new T.Color(0x1e5868);
    var frameMat = new T.MeshStandardMaterial({ color: 0xa9b6ae, metalness: .7, roughness: .35 });
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var grp = new T.Group();
      grp.position.set((c - (COLS - 1) / 2) * 2.05, 0, (r - (ROWS - 1) / 2) * 1.75);
      var tilt = new T.Group(); tilt.rotation.x = -.42; tilt.position.y = .3; grp.add(tilt);
      tilt.add(new T.Mesh(new T.BoxGeometry(1.9, .07, 1.25), frameMat));
      var mat = new T.MeshStandardMaterial({ map: cellTex, color: DIRTY.clone(), metalness: .3, roughness: .85, emissive: 0x000000 });
      var glass = new T.Mesh(new T.BoxGeometry(1.8, .08, 1.15), mat); glass.position.y = .02; tilt.add(glass);
      var post = new T.Mesh(new T.CylinderGeometry(.05, .05, 1.1, 6), frameMat); post.position.y = -.25; grp.add(post);
      scene.add(grp);
      panels.push({ g: grp, mat: mat, at: -1, clean: 0 });
    }
    var order = [];
    for (var r2 = 0; r2 < ROWS; r2++) for (var c2 = 0; c2 < COLS; c2++) order.push(r2 * COLS + (r2 % 2 ? COLS - 1 - c2 : c2));
    var drone = makeDrone(); drone.scale.setScalar(.42); scene.add(drone);
    var drops = Spray(mob ? 120 : 260, 0xdcecf2, .09); scene.add(drops.obj);
    var STEP = .5, RUN = order.length * STEP, HOLD = 2.6, LOOP = RUN + HOLD + 1.6, lt = 0, lastDone = -1, pa = new T.Vector3(), pb = new T.Vector3();

    function update(dt, t) {
      if (reduce) { lt = RUN + .5; } else { lt += dt; if (lt > LOOP) { lt = 0; panels.forEach(function (p) { p.at = -1; }); } }
      var ang = Math.sin(t * .15) * .25;
      camera.position.set(Math.sin(ang) * 11.5, 7.6, Math.cos(ang) * 11.5); camera.lookAt(0, -.3, .2);
      var idx = Math.min(order.length - 1, Math.floor(lt / STEP)), f = clamp(lt / STEP - idx, 0, 1), flying = lt < RUN;
      var a = panels[order[idx]], b = panels[order[Math.min(order.length - 1, idx + 1)]];
      if (flying) {
        if (a.at < 0) a.at = lt;
        pa.copy(a.g.position); pb.copy(b.g.position);
        drone.position.lerpVectors(pa, pb, ease(f)); drone.position.y = 1.65 + Math.sin(t * 3) * .05;
        drone.rotation.set(.1, Math.atan2(pb.x - pa.x, pb.z - pa.z) || 0, 0);
      } else {
        var u = clamp((lt - RUN) / 1.5, 0, 1), last = panels[order[order.length - 1]].g.position;
        drone.position.set(lerp(last.x, 9, ease(u)), lerp(1.65, 7, ease(u)), lerp(last.z, -6, ease(u)));
      }
      if (reduce) panels.forEach(function (p) { p.at = 0; });
      animDrone(drone, t, dt || .016);
      if (flying && dt) {
        for (var n = 0; n < Math.round(dt * 70); n++) drops.emit(drone.position.x + (Math.random() - .5) * .8, drone.position.y - .4, drone.position.z + (Math.random() - .5) * .5, (Math.random() - .5) * .4, -1.2, (Math.random() - .5) * .4, .35 + Math.random() * .2);
      }
      drops.step(dt);
      var redirty = clamp((lt - RUN - HOLD) / 1.4, 0, 1), done = 0;
      panels.forEach(function (p) {
        var k = p.at >= 0 ? clamp((lt - p.at) / .4, 0, 1) * (1 - redirty) : 0;
        if (reduce) k = 1;
        if (k > .9) done++;
        p.mat.color.copy(DIRTY).lerp(CLEAN, k);
        p.mat.roughness = lerp(.85, .18, k); p.mat.metalness = lerp(.3, .75, k);
        var flash = p.at >= 0 && redirty === 0 ? Math.max(0, 1 - (lt - p.at) / .8) : 0;
        p.mat.emissive.setRGB(flash * .45, flash * .5, flash * .45);
      });
      if (opts.onUpdate && done !== lastDone) { lastDone = done; opts.onUpdate(done, panels.length); }
    }
    var stage = Stage3(canvas, { scene: scene, camera: camera, update: update, warm: 1 });
    if (!stage) return null;
    return { destroy: function () { stage.destroy(); } };
  }

  /* ================= CURSOR: drone 3D seguindo o mouse ================= */
  function cursor() {
    if (reduce || !window.matchMedia || !matchMedia('(pointer: fine)').matches) return null;
    var SIZE = 120;
    var cv = document.createElement('canvas'); cv.className = 'drone-cursor'; cv.setAttribute('aria-hidden', 'true');
    var dot = document.createElement('div'); dot.className = 'drone-cursor__dot'; dot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv); document.body.appendChild(dot);
    var r;
    try { r = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); } catch (e) { cv.remove(); dot.remove(); return null; }
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.setSize(SIZE, SIZE, false); r.setClearColor(0, 0);
    var scene = new T.Scene(), cam = new T.PerspectiveCamera(32, 1, .1, 50);
    cam.position.set(0, 6.4, 4.6); cam.lookAt(0, 0, 0);
    scene.add(new T.HemisphereLight(0xffffff, 0x0c352d, 1.2));
    var dl = new T.DirectionalLight(0xffffff, .8); dl.position.set(3, 8, 4); scene.add(dl);
    var drone = makeDrone(); scene.add(drone);
    var glowS = new T.Sprite(new T.SpriteMaterial({ map: glowTexture('rgba(186,235,73,.55)', 'rgba(186,235,73,0)'), transparent: true, depthWrite: false }));
    glowS.scale.set(5, 5, 1); glowS.position.y = -1.2; glowS.material.opacity = 0; scene.add(glowS);
    document.documentElement.classList.add('has-drone-cursor');

    var mx = -200, my = -200, x = mx, y = my, vx = 0, vy = 0, hot = false, shown = false, scale = 1, t = 0, last = 0, raf = 0;
    var SEL = 'a, button, summary, label, [role="tab"], input[type="range"], .opt';
    function move(e) {
      mx = e.clientX; my = e.clientY;
      if (!shown) { x = mx; y = my; shown = true; cv.style.opacity = dot.style.opacity = '1'; }
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      var el = e.target && e.target.closest ? e.target.closest(SEL) : null;
      hot = !!el; dot.classList.toggle('is-hot', hot);
      if (!raf) raf = requestAnimationFrame(loop);
    }
    function leave() { shown = false; cv.style.opacity = dot.style.opacity = '0'; }
    function loop(now) {
      raf = 0;
      var dt = last ? Math.min(.05, (now - last) / 1000) : 1 / 60; last = now; t += dt;
      var nx = lerp(x, mx, Math.min(1, dt * 14)), ny = lerp(y, my, Math.min(1, dt * 14));
      vx = lerp(vx, (nx - x) / dt, .2); vy = lerp(vy, (ny - y) / dt, .2); x = nx; y = ny;
      scale = lerp(scale, hot ? 1.3 : 1, Math.min(1, dt * 10));
      drone.scale.setScalar(scale);
      drone.rotation.z = clamp(-vx * .0009, -.55, .55);
      drone.rotation.x = clamp(vy * .0009, -.55, .55);
      drone.position.y = Math.sin(t * 3) * .08;
      glowS.material.opacity = lerp(glowS.material.opacity, hot ? 1 : 0, Math.min(1, dt * 8));
      animDrone(drone, t, dt);
      r.render(scene, cam);
      cv.style.transform = 'translate3d(' + (x - SIZE / 2) + 'px,' + (y - SIZE / 2) + 'px,0)';
      if (shown && !document.hidden) raf = requestAnimationFrame(loop);
    }
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('mouseleave', leave);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && shown && !raf) raf = requestAnimationFrame(loop); });
    return { el: cv };
  }

  window.VosafraScenes = { hero: hero, rota: rota, solar: solar, cursor: cursor };
})();
