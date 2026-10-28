/* VOSAFRA CONNECT — filmes procedurais em Canvas 2D (sem arquivos de vídeo)
   API: VosafraFilm.hero(canvas) -> {setProgress, destroy}
        VosafraFilm.rota(canvas)  -> {play, reset, destroy}
        VosafraFilm.solar(canvas) -> {destroy} */
(function () {
  'use strict';
  var C = { fl: '#0C352D', li: '#BAEB49', off: '#F6F6F0', ca: '#202B27', sa: '#87A996' };
  var MONO = '"JetBrains Mono", ui-monospace, Consolas, monospace';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function off(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }

  // Palco comum: DPR, resize, pausa fora da tela / aba oculta, movimento reduzido
  function Stage(canvas, hooks) {
    var ctx = canvas.getContext('2d');
    var st = { ctx: ctx, w: 0, h: 0, dpr: 1, t: 0, mobile: false };
    var raf = 0, last = 0, visible = true, running = false, alive = true, ro = null, io = null;
    function paint(dt) { ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); hooks.draw(st, dt); }
    function resize() {
      var r = canvas.getBoundingClientRect();
      var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      var dpr = Math.min(window.devicePixelRatio || 1, w < 700 ? 1.5 : 2);
      if (w === st.w && h === st.h && dpr === st.dpr) return;
      st.w = w; st.h = h; st.dpr = dpr; st.mobile = w < 700;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      hooks.resize(st);
      if (reduce && hooks.warm) { for (var i = 0; i < hooks.warm; i++) hooks.draw(st, 1 / 30); }
      if (!running) paint(0);
    }
    function tick(now) {
      raf = 0; if (!running) return;
      var dt = last ? Math.min(.05, (now - last) / 1000) : 1 / 60; last = now; st.t += dt;
      paint(dt);
      raf = requestAnimationFrame(tick);
    }
    function update() {
      var go = alive && visible && !document.hidden && !reduce;
      if (go && !running) { running = true; last = 0; raf = requestAnimationFrame(tick); }
      else if (!go && running) { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    }
    if ('ResizeObserver' in window) { ro = new ResizeObserver(resize); ro.observe(canvas); }
    else window.addEventListener('resize', resize);
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; update(); }, { rootMargin: '80px' });
      io.observe(canvas);
    }
    document.addEventListener('visibilitychange', update);
    resize(); update();
    return {
      st: st,
      redraw: function () { if (!running) paint(0); },
      destroy: function () {
        alive = false; update();
        if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
        if (io) io.disconnect();
        document.removeEventListener('visibilitychange', update);
      }
    };
  }

  // Pool de partículas sem alocação por quadro
  function Pool(n) {
    return { n: n, x: new Float32Array(n), y: new Float32Array(n), vx: new Float32Array(n), vy: new Float32Array(n),
      life: new Float32Array(n), max: new Float32Array(n), s: new Float32Array(n), i: 0 };
  }
  function emit(p, x, y, vx, vy, life, size) {
    var k = p.i; p.i = (p.i + 1) % p.n;
    p.x[k] = x; p.y[k] = y; p.vx[k] = vx; p.vy[k] = vy; p.life[k] = life; p.max[k] = life; p.s[k] = size;
  }

  // Hexacóptero agrícola visto de cima
  function drawDrone(ctx, x, y, k, t, bank) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(bank || 0); ctx.scale(k, k);
    ctx.lineCap = 'round';
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 6 + i * Math.PI / 3, ax = Math.cos(a) * 25, ay = Math.sin(a) * 25 * .82;
      ctx.strokeStyle = '#2b3833'; ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ax, ay); ctx.stroke();
      ctx.fillStyle = 'rgba(246,246,240,.09)';
      ctx.beginPath(); ctx.ellipse(ax, ay, 11.5, 9.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(246,246,240,.28)'; ctx.lineWidth = .8; ctx.stroke();
      var r = t * 55 + i * 1.7;
      ctx.strokeStyle = 'rgba(246,246,240,.55)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(ax + Math.cos(r) * 10.5, ay + Math.sin(r) * 8.6); ctx.lineTo(ax - Math.cos(r) * 10.5, ay - Math.sin(r) * 8.6); ctx.stroke();
      ctx.fillStyle = '#1b2522'; ctx.beginPath(); ctx.arc(ax, ay, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#1d2724'; ctx.strokeStyle = '#3c4d46'; ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-9, -12, 18, 24, 5); else ctx.rect(-9, -12, 18, 24);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2e3d37'; ctx.beginPath(); ctx.arc(0, 1, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(246,246,240,.18)'; ctx.fillRect(-6, -10, 12, 2);
    var on = (Math.sin(t * 9) > .2);
    ctx.fillStyle = on ? C.li : 'rgba(186,235,73,.25)';
    ctx.beginPath(); ctx.arc(0, -8, 1.8, 0, Math.PI * 2); ctx.fill();
    if (on) { ctx.fillStyle = 'rgba(186,235,73,.25)'; ctx.beginPath(); ctx.arc(0, -8, 5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  function glowSprite(color, size) {
    var c = off(size, size), g = c.getContext('2d'), r = size / 2;
    var gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    return c;
  }

  /* ================= CENA 1 · HERO: amanhecer na serra de Santa Teresa ================= */
  function hero(canvas) {
    if (!canvas) return null;
    var W, H, layers = [], slope, treated, tctx, fog, lime, path, cum, total, sprayLen, sprayStart, sprayEnd;
    var parts = null, P = 0, Pt = 0, mx = 0, my = 0, mxT = 0, myT = 0;
    var s = 0, phase = 'run', fade = 0, prev = { x: 0, y: 0 }, emitAcc = 0;
    var SPEED = 1, margin = 60;

    function top(x) {
      var k = clamp((x - W * .16) / (W * .64), 0, 1);
      return H * (.6 + .5 * Math.pow(1 - k, 2)) + Math.sin(x * .006) * H * .012;
    }
    function rowY(x, d) { var t = top(x); return t + Math.pow(d, 1.45) * (H * 1.02 - t) + Math.sin(x * .0045 + d * 9) * 5 * (1 - d); }

    function build() {
      var R = rng(7);
      // camadas de montanha (fundo -> frente)
      var cols = ['#a9c1ad', '#87A996', '#5f8573', '#3a6555', '#1d4d3f'];
      layers = [];
      for (var L = 0; L < 5; L++) {
        var base = H * (.36 + L * .065), amp = H * (.12 - L * .012), pts = [], ph1 = R() * 6, ph2 = R() * 6, ph3 = R() * 6;
        for (var x = -margin; x <= W + margin; x += 6) {
          var y = base - amp * (.55 * Math.sin(x * .0042 / (1 + L * .25) + ph1) + .3 * Math.sin(x * .011 + ph2) + .15 * Math.sin(x * .027 + ph3));
          pts.push(x, y);
        }
        layers.push({ pts: pts, color: cols[L], par: .25 + L * .22 });
      }
      // encosta com fileiras de café em curva de nível (pré-renderizada)
      slope = off(W + margin * 2, H + margin);
      var g = slope.getContext('2d');
      g.translate(margin, 0);
      var gr = g.createLinearGradient(0, H * .55, 0, H);
      gr.addColorStop(0, '#1d5443'); gr.addColorStop(1, '#0a2e26');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(-margin, H + margin);
      for (var x2 = -margin; x2 <= W + margin; x2 += 6) g.lineTo(x2, top(x2));
      g.lineTo(W + margin, H + margin); g.closePath(); g.fill();
      // brilho da crista
      g.strokeStyle = 'rgba(186,235,73,.18)'; g.lineWidth = 1.2;
      g.beginPath(); for (var x3 = -margin; x3 <= W + margin; x3 += 6) { x3 === -margin ? g.moveTo(x3, top(x3)) : g.lineTo(x3, top(x3)); } g.stroke();
      var N = st0.mobile ? 16 : 22;
      for (var i = 0; i < N; i++) {
        var d = (i + .6) / N, rad = .9 + d * 4.2, step = 5 + d * 15;
        g.strokeStyle = 'rgba(8,36,30,' + (.35 + d * .3) + ')'; g.lineWidth = .6 + d * 2.2;
        g.beginPath();
        var started = false;
        for (var x4 = -margin; x4 <= W + margin; x4 += 8) { var y4 = rowY(x4, d); if (y4 > H + 20) { started = false; continue; } if (!started) { g.moveTo(x4, y4 + rad * .6); started = true; } else g.lineTo(x4, y4 + rad * .6); }
        g.stroke();
        for (var x5 = -margin + R() * step; x5 <= W + margin; x5 += step * (.85 + R() * .3)) {
          var y5 = rowY(x5, d); if (y5 > H + 10 || y5 < top(x5) + 1) continue;
          g.fillStyle = 'rgba(5,25,20,.35)'; g.beginPath(); g.ellipse(x5 + rad * .3, y5 + rad * .5, rad * 1.1, rad * .5, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#123f33'; g.beginPath(); g.arc(x5, y5 - rad * .2, rad, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(66,120,92,' + (.7 + d * .3) + ')'; g.beginPath(); g.arc(x5 - rad * .15, y5 - rad * .4, rad * .72, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(170,205,160,' + (.45 + d * .25) + ')'; g.beginPath(); g.arc(x5 - rad * .35, y5 - rad * .65, rad * .32, 0, Math.PI * 2); g.fill();
        }
      }
      // camada de área atendida
      treated = off(slope.width, slope.height); tctx = treated.getContext('2d');
      // neblina
      fog = off(640, 140); var f = fog.getContext('2d'), R2 = rng(11);
      for (var q = 0; q < 34; q++) {
        var fx = 30 + R2() * 580, fy = 62 + R2() * 16, fr = 26 + R2() * 34;
        var fg = f.createRadialGradient(fx, fy, 0, fx, fy, fr);
        fg.addColorStop(0, 'rgba(240,244,232,.35)'); fg.addColorStop(1, 'rgba(240,244,232,0)');
        f.fillStyle = fg; f.fillRect(0, 0, 640, 140);
      }
      lime = glowSprite('rgba(186,235,73,.9)', 64);
      // trajeto serpentina do drone sobre as fileiras
      var pick = st0.mobile ? [.5, .6, .7, .8] : [.42, .52, .62, .72, .82];
      var xa = W * (st0.mobile ? .45 : .55), xb = W * .96;
      path = []; var spr = [];
      path.push(W + 90, H * .18); spr.push(0);
      for (var r = 0; r < pick.length; r++) {
        var dir = r % 2 === 0 ? -1 : 1;
        var from = dir < 0 ? xb : xa, to = dir < 0 ? xa : xb;
        for (var u = 0; u <= 1.0001; u += .02) {
          var px = lerp(from, to, u), py = rowY(px, pick[r]);
          path.push(px, py); spr.push(1);
        }
      }
      path.push(W * .3, -120); spr.push(0);
      // densifica e mede
      cum = [0]; total = 0; sprayStart = -1; sprayEnd = 0;
      for (var k2 = 2; k2 < path.length; k2 += 2) {
        total += Math.hypot(path[k2] - path[k2 - 2], path[k2 + 1] - path[k2 - 1]);
        cum.push(total);
        if (spr[k2 / 2] && spr[k2 / 2 - 1]) { if (sprayStart < 0) sprayStart = cum[k2 / 2 - 1]; sprayEnd = total; }
      }
      sprayLen = sprayEnd - sprayStart;
      sprayFlags = spr;
      SPEED = Math.max(90, W * .1);
      parts = Pool(st0.mobile ? 140 : 360);
      s = 0; phase = 'run'; fade = 0;
    }
    var sprayFlags = [];
    function at(dist, out) {
      var lo = 0, hi = cum.length - 1;
      while (lo < hi - 1) { var m = (lo + hi) >> 1; if (cum[m] <= dist) lo = m; else hi = m; }
      var seg = cum[hi] - cum[lo] || 1, t = clamp((dist - cum[lo]) / seg, 0, 1);
      out.x = lerp(path[lo * 2], path[hi * 2], t); out.y = lerp(path[lo * 2 + 1], path[hi * 2 + 1], t);
      out.spray = sprayFlags[lo] && sprayFlags[hi];
      return out;
    }
    var pos = { x: 0, y: 0, spray: 0 };

    var st0 = { mobile: false };
    function onMove(e) { var r = canvas.getBoundingClientRect(); mxT = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1); myT = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1); }
    window.addEventListener('pointermove', onMove, { passive: true });

    function draw(st, dt) {
      var ctx = st.ctx, t = st.t;
      Pt = lerp(Pt, P, Math.min(1, dt * 6) || (dt === 0 ? 0 : 1)); if (dt === 0) Pt = P;
      mx = lerp(mx, mxT, Math.min(1, dt * 2.5)); my = lerp(my, myT, Math.min(1, dt * 2.5));
      var driftX = Math.sin(t * .07) * 14 + mx * 18, driftY = Math.sin(t * .05) * 6 + my * 8;

      // céu
      var sky = ctx.createLinearGradient(0, 0, 0, H * .72);
      sky.addColorStop(0, '#0a2b24'); sky.addColorStop(.42, '#24584a'); sky.addColorStop(.78, '#b9cfae'); sky.addColorStop(1, '#e8ead0');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      var sx = W * .7 - driftX * .2, sy = H * .44 - Pt * H * .05;
      var sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, W * .42);
      sun.addColorStop(0, 'rgba(252,248,220,.85)'); sun.addColorStop(.12, 'rgba(240,240,200,.4)'); sun.addColorStop(1, 'rgba(240,240,200,0)');
      ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);

      // montanhas + neblina entre camadas
      for (var L = 0; L < layers.length; L++) {
        var ly = layers[L], ox = -driftX * ly.par, oy = -driftY * ly.par * .5 - Pt * H * .12 * ly.par;
        ctx.save(); ctx.translate(ox, oy);
        ctx.fillStyle = ly.color; ctx.beginPath(); ctx.moveTo(ly.pts[0], H + 200);
        for (var i = 0; i < ly.pts.length; i += 2) ctx.lineTo(ly.pts[i], ly.pts[i + 1]);
        ctx.lineTo(ly.pts[ly.pts.length - 2], H + 200); ctx.closePath(); ctx.fill();
        ctx.restore();
        if (L < 4) {
          var fy = H * (.4 + L * .07) - Pt * H * .1 * ly.par, fw = W * 1.4, speed = 6 + L * 4;
          var fx = -((t * speed + L * 230) % fw);
          ctx.globalAlpha = .22 + .06 * Math.sin(t * .3 + L);
          ctx.drawImage(fog, fx, fy - 60, fw, 150); ctx.drawImage(fog, fx + fw, fy - 60, fw, 150);
          ctx.globalAlpha = 1;
        }
      }

      // encosta com fileiras
      var sox = -margin - driftX * 1.25, soy = -driftY * .7 - Pt * H * .2;
      ctx.drawImage(slope, sox, soy, slope.width, slope.height);

      // simulação do drone
      if (phase === 'run') {
        s += SPEED * dt;
        if (s >= total) { phase = 'fade'; fade = 0; }
      } else {
        fade += dt;
        if (fade > 1.6) { tctx.clearRect(0, 0, treated.width, treated.height); phase = 'run'; s = 0; }
      }
      at(Math.min(s, total), pos);
      var dpth = clamp((pos.y - H * .55) / (H * .45), 0, 1), k = (st.mobile ? .75 : 1) + dpth * (st.mobile ? .6 : 1);
      var alt = 46 * k + Math.sin(t * 2.1) * 3;
      var gx = pos.x, gy = pos.y;
      if (pos.spray && dt > 0) {
        tctx.globalAlpha = .06; var gs = 30 * k + 10;
        tctx.drawImage(lime, gx + margin - gs / 2, gy - gs / 2, gs, gs); tctx.globalAlpha = 1;
      }
      // área atendida brilha sobre as fileiras
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = phase === 'fade' ? Math.max(0, .6 * (1 - fade / 1.6)) : .6;
      ctx.drawImage(treated, sox, soy);
      ctx.restore();

      var dx = gx + sox + margin, dy = gy + soy - alt;
      var vx = (dx - prev.x) / (dt || 1); prev.x = dx; prev.y = dy;

      // partículas de névoa
      if (pos.spray && dt > 0) {
        emitAcc += dt * (st.mobile ? 90 : 220);
        while (emitAcc > 1) {
          emitAcc -= 1;
          var sp = (Math.random() - .5) * 34 * k;
          emit(parts, dx + sp, dy + 6 * k, (Math.random() - .5) * 18 - vx * .08, 40 + Math.random() * 50 * k, .7 + Math.random() * .6, (.8 + Math.random() * 1.4) * k);
        }
      }
      for (var p = 0; p < parts.n; p++) {
        if (parts.life[p] <= 0) continue;
        parts.life[p] -= dt;
        parts.vx[p] *= .985; parts.vy[p] *= .97;
        parts.x[p] += parts.vx[p] * dt; parts.y[p] += parts.vy[p] * dt;
        var a = parts.life[p] / parts.max[p];
        ctx.fillStyle = 'rgba(232,242,220,' + (a * .5).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(parts.x[p], parts.y[p], parts.s[p] * (1.6 - a * .6), 0, Math.PI * 2); ctx.fill();
      }
      // sombra e drone
      ctx.fillStyle = 'rgba(4,20,16,.35)';
      ctx.beginPath(); ctx.ellipse(gx + sox + margin + 8, gy + soy + 4, 26 * k, 10 * k, 0, 0, Math.PI * 2); ctx.fill();
      drawDrone(ctx, dx, dy, k, t, clamp(vx * .0012, -.18, .18));

      // HUD
      hud(ctx, st, t, dx, dy, k);

      // escurece ao rolar
      if (Pt > 0) { ctx.fillStyle = 'rgba(8,36,30,' + (Pt * .55).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    }

    function hud(ctx, st, t, dx, dy, k) {
      var x0 = W * (st.mobile ? .3 : .46);
      ctx.save();
      // grade de mapeamento
      ctx.strokeStyle = 'rgba(186,235,73,.05)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (var gx = x0 - (x0 % 56); gx < W; gx += 56) { ctx.moveTo(gx + .5, 0); ctx.lineTo(gx + .5, H); }
      for (var gy = 0; gy < H; gy += 56) { ctx.moveTo(x0, gy + .5); ctx.lineTo(W, gy + .5); }
      ctx.stroke();
      // linha de varredura
      var sy = (t * 60) % (H * 1.2) - H * .1;
      var sg = ctx.createLinearGradient(0, sy - 40, 0, sy);
      sg.addColorStop(0, 'rgba(186,235,73,0)'); sg.addColorStop(1, 'rgba(186,235,73,.12)');
      ctx.fillStyle = sg; ctx.fillRect(x0, sy - 40, W - x0, 40);
      ctx.fillStyle = 'rgba(186,235,73,.35)'; ctx.fillRect(x0, sy, W - x0, 1);
      // mira no drone
      var b = 40 * k, l = 9;
      ctx.strokeStyle = 'rgba(186,235,73,.9)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(dx - b, dy - b + l); ctx.lineTo(dx - b, dy - b); ctx.lineTo(dx - b + l, dy - b);
      ctx.moveTo(dx + b - l, dy - b); ctx.lineTo(dx + b, dy - b); ctx.lineTo(dx + b, dy - b + l);
      ctx.moveTo(dx - b, dy + b - l); ctx.lineTo(dx - b, dy + b); ctx.lineTo(dx - b + l, dy + b);
      ctx.moveTo(dx + b - l, dy + b); ctx.lineTo(dx + b, dy + b); ctx.lineTo(dx + b, dy + b - l);
      ctx.stroke();
      ctx.font = '500 10px ' + MONO; ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(246,246,240,.85)';
      ctx.fillText('DRONE 01 · ALT 3,5 m', dx + b + 8, dy - b);
      ctx.fillStyle = 'rgba(186,235,73,.9)';
      ctx.fillText(pos.spray ? '● APLICANDO' : '○ EM ROTA', dx + b + 8, dy - b + 14);
      // painel de status
      if (!st.mobile) {
        var cov = sprayLen > 0 ? clamp((Math.min(s, total) - sprayStart) / sprayLen, 0, 1) : 0;
        if (phase === 'fade') cov = 1;
        var px = W - 250, py = 96;
        ctx.fillStyle = 'rgba(8,36,30,.55)'; ctx.fillRect(px, py, 226, 108);
        ctx.strokeStyle = 'rgba(186,235,73,.35)'; ctx.strokeRect(px + .5, py + .5, 225, 107);
        ctx.fillStyle = 'rgba(135,169,150,1)'; ctx.fillText('SANTA TERESA-ES · 19°56\'S 40°36\'W', px + 12, py + 12);
        ctx.fillStyle = C.off; ctx.font = '600 12px ' + MONO; ctx.fillText('TALHÃO 03 · 8,0 ha', px + 12, py + 32);
        ctx.font = '500 10px ' + MONO; ctx.fillStyle = 'rgba(246,246,240,.7)';
        ctx.fillText('COBERTURA', px + 12, py + 56); ctx.fillText(Math.round(cov * 100) + '%', px + 190, py + 56);
        ctx.fillStyle = 'rgba(246,246,240,.12)'; ctx.fillRect(px + 12, py + 72, 202, 4);
        ctx.fillStyle = C.li; ctx.fillRect(px + 12, py + 72, 202 * cov, 4);
        ctx.fillStyle = C.li; ctx.fillText('JANELA OK · REGISTRO ATIVO', px + 12, py + 88);
      }
      ctx.restore();
    }

    var stage = Stage(canvas, {
      resize: function (st) { W = st.w; H = st.h; st0.mobile = st.mobile; build(); },
      draw: draw,
      warm: 260
    });
    return {
      setProgress: function (p) { P = clamp(p, 0, 1); if (reduce) { Pt = P; stage.redraw(); } },
      destroy: function () { window.removeEventListener('pointermove', onMove); stage.destroy(); }
    };
  }

  /* ================= CENA 2 · ROTA SAFRA: quatro sítios, uma rota ================= */
  function rota(canvas) {
    if (!canvas) return null;
    var W, H, bg, farms = [], base, route, rcum, rtotal, farmAt = [], lt = 0, playing = true, LOOP = 13.4, mob = false;
    var FARMS = [[.3, .3, -.25], [.64, .22, .2], [.8, .55, -.1], [.47, .64, .35]];

    function P(x, y) { return { x: x * W, y: y * H }; }
    function build() {
      var R = rng(23), m = Math.min(W, H);
      bg = off(W, H); var g = bg.getContext('2d');
      g.fillStyle = '#0a2c25'; g.fillRect(0, 0, W, H);
      // curvas de nível
      var hills = [[.36, .42, .5], [.78, .74, .38], [.84, .16, .3], [.08, .2, .25]];
      g.lineWidth = 1;
      hills.forEach(function (hl, hi) {
        for (var k = 1; k <= 9; k++) {
          var r0 = k * .055 * m * hl[2] * 2.2;
          g.strokeStyle = 'rgba(135,169,150,' + (k % 3 === 0 ? .2 : .1) + ')';
          g.beginPath();
          for (var a = 0; a <= Math.PI * 2 + .01; a += .08) {
            var rr = r0 * (1 + .14 * Math.sin(3 * a + k * .7 + hi) + .07 * Math.sin(5 * a + hi * 2));
            var x = hl[0] * W + Math.cos(a) * rr * 1.25, y = hl[1] * H + Math.sin(a) * rr;
            a === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
          }
          g.stroke();
        }
      });
      // estrada
      g.strokeStyle = '#174a3c'; g.lineWidth = Math.max(5, m * .016); g.lineCap = 'round';
      g.beginPath(); g.moveTo(-10, H * .93); g.bezierCurveTo(W * .3, H * .78, W * .25, H * .48, W * .55, H * .44); g.bezierCurveTo(W * .8, H * .4, W * .85, H * .25, W + 10, H * .12); g.stroke();
      g.setLineDash([6, 8]); g.strokeStyle = 'rgba(246,246,240,.18)'; g.lineWidth = 1; g.stroke(); g.setLineDash([]);
      // talhões
      farms = FARMS.map(function (f, i) {
        var c = P(f[0], f[1]), rw = m * (mob ? .17 : .15), rh = m * (mob ? .13 : .11), poly = [];
        var cs = Math.cos(f[2]), sn = Math.sin(f[2]);
        [[-1, -1], [1, -1.1], [1.1, 1], [-.9, 1.05]].forEach(function (q) {
          var x = q[0] * rw * (.9 + R() * .15), y = q[1] * rh * (.9 + R() * .15);
          poly.push(c.x + x * cs - y * sn, c.y + x * sn + y * cs);
        });
        return { c: c, poly: poly, ang: f[2], rw: rw, rh: rh, appear: .3 + i * .5, done: -1 };
      });
      farms.forEach(function (f) {
        g.save(); polyPath(g, f.poly); g.fillStyle = '#103d33'; g.fill(); g.clip();
        g.strokeStyle = 'rgba(135,169,150,.28)'; g.lineWidth = 1.2;
        g.translate(f.c.x, f.c.y); g.rotate(f.ang + .5);
        for (var yy = -f.rw * 2; yy < f.rw * 2; yy += 6) { g.beginPath(); g.moveTo(-f.rw * 2, yy); g.quadraticCurveTo(0, yy + 6, f.rw * 2, yy); g.stroke(); }
        g.restore();
        polyPath(g, f.poly); g.strokeStyle = 'rgba(135,169,150,.5)'; g.lineWidth = 1; g.stroke();
      });
      base = P(.13, .83);
      // rota: base -> sítios -> base (Catmull-Rom amostrada)
      var cps = [base].concat(farms.map(function (f) { return f.c; })).concat([base]);
      route = []; rcum = [0]; rtotal = 0; farmAt = [];
      for (var i = 0; i < cps.length - 1; i++) {
        var p0 = cps[Math.max(0, i - 1)], p1 = cps[i], p2 = cps[i + 1], p3 = cps[Math.min(cps.length - 1, i + 2)];
        for (var u = 0; u < 1; u += .025) {
          var u2 = u * u, u3 = u2 * u;
          var x = .5 * ((2 * p1.x) + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3);
          var y = .5 * ((2 * p1.y) + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3);
          if (route.length) { rtotal += Math.hypot(x - route[route.length - 2], y - route[route.length - 1]); rcum.push(rtotal); }
          route.push(x, y);
        }
        if (i < farms.length) farmAt.push(-1);
        if (i >= 0 && i < farms.length) farmAt[i] = rtotal + Math.hypot(p2.x - route[route.length - 2], p2.y - route[route.length - 1]);
      }
      route.push(base.x, base.y); rtotal += Math.hypot(base.x - route[route.length - 4], base.y - route[route.length - 3]); rcum.push(rtotal);
    }
    function polyPath(g, p) { g.beginPath(); g.moveTo(p[0], p[1]); for (var i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath(); }
    function pointAt(d, out) {
      var lo = 0, hi = rcum.length - 1;
      while (lo < hi - 1) { var m = (lo + hi) >> 1; if (rcum[m] <= d) lo = m; else hi = m; }
      var t = clamp((d - rcum[lo]) / ((rcum[hi] - rcum[lo]) || 1), 0, 1);
      out.x = lerp(route[lo * 2], route[hi * 2], t); out.y = lerp(route[lo * 2 + 1], route[hi * 2 + 1], t); out.i = lo;
      return out;
    }
    var vp = { x: 0, y: 0, i: 0 };

    function draw(st, dt) {
      var ctx = st.ctx;
      if (playing) lt += dt;
      if (lt > LOOP) lt = 0;
      var T = lt;
      ctx.drawImage(bg, 0, 0, W, H);
      var drawF = clamp((T - 2.6) / 2, 0, 1), travel = clamp((T - 4.8) / 6, 0, 1);
      var dist = ease(travel) * rtotal, served = 0;
      // talhões atendidos
      farms.forEach(function (f, i) {
        var hit = travel > 0 && dist >= farmAt[i];
        if (hit && f.done < 0) f.done = T;
        if (!hit && T < 4.8) f.done = -1;
        if (f.done >= 0) {
          served++;
          var a = clamp((T - f.done) / .7, 0, 1);
          ctx.save(); polyPath(ctx, f.poly);
          ctx.fillStyle = 'rgba(186,235,73,' + (.32 * a).toFixed(3) + ')'; ctx.fill();
          ctx.strokeStyle = 'rgba(186,235,73,' + (.9 * a).toFixed(3) + ')'; ctx.lineWidth = 1.6; ctx.stroke();
          ctx.restore();
        }
      });
      // rota desenhada
      if (drawF > 0) {
        var upto = ease(drawF) * rtotal;
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (var pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass ? C.li : 'rgba(186,235,73,.16)'; ctx.lineWidth = pass ? 2.2 : 9;
          ctx.beginPath(); ctx.moveTo(route[0], route[1]);
          for (var k = 1; k < rcum.length && rcum[k] <= upto; k++) ctx.lineTo(route[k * 2], route[k * 2 + 1]);
          var e = pointAt(upto, { x: 0, y: 0, i: 0 }); ctx.lineTo(e.x, e.y);
          ctx.stroke();
        }
        ctx.restore();
      }
      // base do operador
      ctx.fillStyle = C.off; ctx.fillRect(base.x - 7, base.y - 7, 14, 14);
      ctx.strokeStyle = C.li; ctx.lineWidth = 1.5; ctx.strokeRect(base.x - 11.5, base.y - 11.5, 23, 23);
      ctx.font = '500 ' + (mob ? 9 : 10) + 'px ' + MONO; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(246,246,240,.75)'; ctx.fillText('BASE DO OPERADOR', base.x + 18, base.y);
      // pinos dos pedidos
      farms.forEach(function (f, i) {
        var a = clamp((T - f.appear) / .45, 0, 1); if (a <= 0) return;
        var s = ease(a), pulse = (T * 1.2 + i * .3) % 1;
        ctx.strokeStyle = 'rgba(186,235,73,' + ((1 - pulse) * .6 * s).toFixed(3) + ')'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(f.c.x, f.c.y, 6 + pulse * 18, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = f.done >= 0 ? C.li : C.off;
        ctx.beginPath(); ctx.arc(f.c.x, f.c.y, 5.5 * s, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = s;
        var lbl = 'SÍTIO 0' + (i + 1) + ' · 8 ha', tw = ctx.measureText(lbl).width;
        var lx = f.c.x - tw / 2, ly = f.c.y - f.rh - 12;
        ctx.fillStyle = 'rgba(8,36,30,.8)'; ctx.fillRect(lx - 6, ly - 9, tw + 12, 18);
        ctx.fillStyle = f.done >= 0 ? C.li : C.off; ctx.fillText(lbl, lx, ly);
        ctx.globalAlpha = 1;
      });
      // drone percorrendo a rota
      if (travel > 0 && travel < 1) {
        pointAt(dist, vp);
        var tr = Math.max(0, dist - 70);
        ctx.save(); ctx.lineCap = 'round';
        for (var q = 0; q < 8; q++) {
          var d0 = lerp(tr, dist, q / 8), d1 = lerp(tr, dist, (q + 1) / 8), p0 = pointAt(d0, { x: 0, y: 0, i: 0 }), p1 = pointAt(d1, { x: 0, y: 0, i: 0 });
          ctx.strokeStyle = 'rgba(246,246,240,' + (q / 8 * .7).toFixed(3) + ')'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
        }
        ctx.restore();
        drawDrone(ctx, vp.x, vp.y, mob ? .42 : .52, st.t, 0);
      }
      // contador
      var target = served * 8;
      shown = lerp(shown, target, Math.min(1, dt * 6)); if (dt === 0) shown = target;
      if (T < 1) shown = 0;
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = C.off; ctx.font = '700 ' + (mob ? 26 : 34) + 'px Inter, Arial, sans-serif';
      ctx.fillText(Math.round(shown) + ' ha', 18, mob ? 40 : 50);
      ctx.font = '500 ' + (mob ? 9 : 10) + 'px ' + MONO; ctx.fillStyle = C.li;
      ctx.fillText('1 ROTA · ' + Math.max(served, farms.filter(function (f, i) { return T > f.appear; }).length) + ' PRODUTORES · 1 DESLOCAMENTO', 18, mob ? 58 : 70);
      ctx.fillStyle = 'rgba(135,169,150,.9)'; ctx.textAlign = 'right';
      ctx.fillText('EXEMPLO ILUSTRATIVO', W - 16, mob ? 24 : 28); ctx.textAlign = 'left';
      // fade de reinício
      if (T > LOOP - .7) { ctx.fillStyle = 'rgba(10,44,37,' + ((T - (LOOP - .7)) / .7).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    }
    var shown = 0;
    var stage = Stage(canvas, {
      resize: function (st) { W = st.w; H = st.h; mob = st.mobile; build(); if (reduce) lt = 11.5; },
      draw: function (st, dt) { if (reduce) { lt = 11.5; farms.forEach(function (f) { f.done = 0; }); } draw(st, dt); }
    });
    return {
      play: function () { playing = true; },
      reset: function () { lt = 0; farms.forEach(function (f) { f.done = -1; }); stage.redraw(); },
      destroy: function () { stage.destroy(); }
    };
  }

  /* ================= CENA 3 · PLACAS SOLARES: drone limpando ================= */
  function solar(canvas) {
    if (!canvas) return null;
    var W, H, panels = [], dirt, order = [], lt = 0, STEP = .32, HOLD = 2.4, REDIRTY = 1.2, parts = Pool(90), emitAcc = 0;
    function build(mob) {
      var cols = mob ? 5 : 6, rows = 3, zmax = 1 + rows * .6;
      function edgeY(e) { var z = 1 + (rows - e) * .6; return H * .22 + (H * .94 - H * .22) * (1 / z - 1 / zmax) / (1 - 1 / zmax); }
      function edgeHalf(e) { var z = 1 + (rows - e) * .6; return W * .56 / z; }
      function pt(c, e) { return { x: W * .5 + (c / cols - .5) * 2 * edgeHalf(e), y: edgeY(e) }; }
      panels = [];
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var g = .06, a = pt(c + g, r + g), b = pt(c + 1 - g, r + g), d = pt(c + 1 - g, r + 1 - g), e = pt(c + g, r + 1 - g);
        panels.push({ q: [a.x, a.y, b.x, b.y, d.x, d.y, e.x, e.y], cx: (a.x + b.x + d.x + e.x) / 4, cy: (a.y + b.y + d.y + e.y) / 4, k: (d.x - e.x) / (W * .2), r: r, c: c, clean: 0, at: -1 });
      }
      // ordem serpentina: fileira do fundo para a frente
      order = [];
      for (var r2 = 0; r2 < rows; r2++) for (var c2 = 0; c2 < cols; c2++) order.push(r2 * cols + (r2 % 2 ? cols - 1 - c2 : c2));
      dirt = off(160, 160); var dg = dirt.getContext('2d'), R = rng(5);
      for (var i = 0; i < 420; i++) {
        dg.fillStyle = 'rgba(' + (150 + R() * 40 | 0) + ',' + (140 + R() * 30 | 0) + ',' + (100 + R() * 20 | 0) + ',' + (.08 + R() * .25).toFixed(2) + ')';
        dg.beginPath(); dg.arc(R() * 160, R() * 160, .6 + R() * 3.2, 0, Math.PI * 2); dg.fill();
      }
      lt = 0;
    }
    function quad(ctx, q) { ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[2], q[3]); ctx.lineTo(q[4], q[5]); ctx.lineTo(q[6], q[7]); ctx.closePath(); }
    var pat = null;
    function draw(st, dt) {
      var ctx = st.ctx, t = st.t;
      lt += dt;
      var runT = order.length * STEP, LOOP = runT + HOLD + REDIRTY + .4;
      if (lt > LOOP) { lt = 0; panels.forEach(function (p) { p.clean = 0; p.at = -1; }); }
      var bgG = ctx.createLinearGradient(0, 0, 0, H);
      bgG.addColorStop(0, '#0d3a30'); bgG.addColorStop(1, '#082620');
      ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
      var sun = ctx.createRadialGradient(W * .85, H * .05, 0, W * .85, H * .05, W * .6);
      sun.addColorStop(0, 'rgba(246,246,240,.22)'); sun.addColorStop(1, 'rgba(246,246,240,0)');
      ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
      if (!pat) pat = ctx.createPattern(dirt, 'repeat');
      // posição do drone
      var idx = Math.min(order.length - 1, Math.floor(lt / STEP)), f = clamp(lt / STEP - idx, 0, 1);
      var flying = lt < runT;
      var cur = panels[order[idx]], nxt = panels[order[Math.min(order.length - 1, idx + 1)]];
      var dx, dy, k;
      if (flying) {
        if (cur.at < 0) cur.at = lt;
        dx = lerp(cur.cx, nxt.cx, ease(f)); dy = lerp(cur.cy, nxt.cy, ease(f)); k = lerp(cur.k, nxt.k, f);
      } else {
        var lastP = panels[order[order.length - 1]], u = clamp((lt - runT) / 1.4, 0, 1);
        dx = lerp(lastP.cx, W * 1.15, ease(u)); dy = lerp(lastP.cy, -H * .2, ease(u)); k = lastP.k;
      }
      var redirty = clamp((lt - runT - HOLD) / REDIRTY, 0, 1);
      panels.forEach(function (p) {
        if (p.at >= 0) p.clean = clamp((lt - p.at) / .35, 0, 1) * (1 - redirty);
        quad(ctx, p.q);
        var pg = ctx.createLinearGradient(p.q[0], p.q[1], p.q[4], p.q[5]);
        pg.addColorStop(0, '#16444a'); pg.addColorStop(1, '#0c2c31');
        ctx.fillStyle = pg; ctx.fill();
        // células
        ctx.save(); quad(ctx, p.q); ctx.clip();
        ctx.strokeStyle = 'rgba(135,169,150,.28)'; ctx.lineWidth = .8; ctx.beginPath();
        for (var i = 1; i < 4; i++) { var s = i / 4; ctx.moveTo(lerp(p.q[0], p.q[2], s), lerp(p.q[1], p.q[3], s)); ctx.lineTo(lerp(p.q[6], p.q[4], s), lerp(p.q[7], p.q[5], s)); }
        for (var j = 1; j < 3; j++) { var v = j / 3; ctx.moveTo(lerp(p.q[0], p.q[6], v), lerp(p.q[1], p.q[7], v)); ctx.lineTo(lerp(p.q[2], p.q[4], v), lerp(p.q[3], p.q[5], v)); }
        ctx.stroke();
        // sujeira
        ctx.globalAlpha = 1 - p.clean; ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(150,140,105,.22)'; ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
        // brilho que varre após limpar
        if (p.at >= 0 && redirty === 0) {
          var sw = (lt - p.at) / .9;
          if (sw > 0 && sw < 1.4) {
            var bx = lerp(p.q[6] - 40, p.q[2] + 40, sw);
            var sh = ctx.createLinearGradient(bx - 30, 0, bx + 30, 0);
            sh.addColorStop(0, 'rgba(246,246,240,0)'); sh.addColorStop(.5, 'rgba(246,246,240,.55)'); sh.addColorStop(1, 'rgba(246,246,240,0)');
            ctx.fillStyle = sh; ctx.fillRect(0, 0, W, H);
          }
          ctx.fillStyle = 'rgba(186,235,73,' + (.06 * p.clean).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
        }
        ctx.restore();
        quad(ctx, p.q); ctx.strokeStyle = 'rgba(200,214,205,.35)'; ctx.lineWidth = 1; ctx.stroke();
      });
      // gotas
      var alt = 34 * k + Math.sin(t * 2.4) * 2;
      if (flying && dt > 0) {
        emitAcc += dt * 70;
        while (emitAcc > 1) { emitAcc -= 1; emit(parts, dx + (Math.random() - .5) * 26 * k, dy - alt + 4, (Math.random() - .5) * 20, 50 + Math.random() * 40, .45 + Math.random() * .3, (.6 + Math.random()) * k); }
      }
      for (var n = 0; n < parts.n; n++) {
        if (parts.life[n] <= 0) continue;
        parts.life[n] -= dt; parts.x[n] += parts.vx[n] * dt; parts.y[n] += parts.vy[n] * dt;
        ctx.fillStyle = 'rgba(220,236,240,' + (parts.life[n] / parts.max[n] * .7).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(parts.x[n], parts.y[n], parts.s[n], 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(dx + 6, dy + 3, 24 * k, 9 * k, 0, 0, Math.PI * 2); ctx.fill();
      drawDrone(ctx, dx, dy - alt, k * .9, t, 0);
      // rótulo
      var done = panels.filter(function (p) { return p.clean > .9; }).length;
      ctx.font = '500 10px ' + MONO; ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(8,36,30,.7)'; ctx.fillRect(12, 12, 168, 22);
      ctx.fillStyle = C.li; ctx.fillText('LIMPEZA · ' + done + '/' + panels.length + ' PLACAS', 20, 18);
    }
    var stage = Stage(canvas, {
      resize: function (st) { W = st.w; H = st.h; pat = null; build(st.mobile); },
      draw: draw,
      warm: 200
    });
    return { destroy: function () { stage.destroy(); } };
  }

  window.VosafraFilm = { hero: hero, rota: rota, solar: solar };
})();
