/* VOSAFRA CONNECT — interações da landing page (vanilla, sem dependências) */
(function () {
  'use strict';

  // ===== Configuração =====
  // Número do WhatsApp Business com DDI+DDD, só dígitos (ex.: "5527999990000").
  // Vazio = o WhatsApp abre e a pessoa escolhe o contato.
  var WA_NUMBER = '5527981816871';
  var SITE_URL = location.origin && location.origin !== 'null' ? location.origin + location.pathname : '';

  var WA_MSG = {
    produtor: 'Olá, VOSAFRA! Sou produtor e quero um orçamento. Cultura: ___. Área: ___ ha. Município: ___.',
    operador: 'Olá, VOSAFRA! Sou operador de drone e quero ser parceiro. Minha base é em ___.',
    cooperativa: 'Olá, VOSAFRA! Falo em nome de uma cooperativa e quero conversar sobre um piloto.',
    solar: 'Olá, VOSAFRA! Quero orçamento de limpeza de placas solares com drone. Município: ___.',
    vizinhos: 'Tô entrando na Rota Safra de Santa Teresa. Quanto mais sítio perto, melhor a rota. Veja: ' + (SITE_URL || 'VOSAFRA CONNECT')
  };

  function waLink(text, toVosafra) {
    var base = toVosafra && WA_NUMBER ? 'https://wa.me/' + WA_NUMBER : 'https://wa.me/';
    return base + '?text=' + encodeURIComponent(text);
  }

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js');

  // ===== Links de WhatsApp =====
  $$('[data-wa]').forEach(function (a) {
    var k = a.getAttribute('data-wa');
    a.href = waLink(WA_MSG[k] || WA_MSG.produtor, k !== 'vizinhos');
    a.target = '_blank';
    a.rel = 'noopener';
  });

  // ===== Navegação =====
  var nav = $('#nav'), waBar = $('#waBar'), hero = $('.hero');
  function onScroll() {
    var y = window.scrollY;
    nav.classList.toggle('is-solid', y > 40);
    var hh = hero ? hero.offsetHeight : 600;
    var orc = $('#orcamento').getBoundingClientRect();
    var inForm = orc.top < window.innerHeight * .6 && orc.bottom > 0;
    waBar.classList.toggle('is-on', y > hh * .7 && !inForm);
    if (heroFilm && heroFilm.setProgress) heroFilm.setProgress(Math.min(1, Math.max(0, y / hh)));
  }

  var drawer = $('#drawer'), menuBtn = $('#menuBtn');
  function setDrawer(open) {
    if (open) drawer.hidden = false;
    requestAnimationFrame(function () { drawer.classList.toggle('is-open', open); });
    menuBtn.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (!open) setTimeout(function () { if (!drawer.classList.contains('is-open')) drawer.hidden = true; }, 500);
  }
  menuBtn.addEventListener('click', function () { setDrawer(true); });
  $('#menuClose').addEventListener('click', function () { setDrawer(false); });
  $$('a', drawer).forEach(function (a) { a.addEventListener('click', function () { setDrawer(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawer.classList.contains('is-open')) setDrawer(false); });

  // ===== Revelação ao rolar (só para o que está abaixo da dobra) =====
  if ('IntersectionObserver' in window && !reduce) {
    var rvObs = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.remove('is-pending'); rvObs.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.rv').forEach(function (el) {
      if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add('is-pending'); rvObs.observe(el); }
    });
  }

  // ===== Cenas 3D (WebGL) com recuo para os filmes 2D =====
  var heroFilm = null, S3 = window.VosafraScenes, F = window.VosafraFilm;
  function tryScene(fn3, fn2, canvas, opts, name) {
    var s = null;
    if (S3) { try { s = S3[fn3](canvas, opts); } catch (err) { console.warn('3D ' + name, err); } }
    if (s) { document.documentElement.classList.add('is-3d-' + name); return s; }
    if (F) { try { s = F[fn2](canvas, {}); if (s && s.play) s.play(); } catch (err) { console.warn('2D ' + name, err); } }
    return s;
  }
  var hudPct = $('#hudPct'), hudBar = $('#hudBar'), hudState = $('#hudState');
  heroFilm = tryScene('hero', 'hero', $('#filmHero'), {
    onCoverage: function (pct, spraying) {
      hudPct.textContent = pct + '%'; hudBar.style.width = pct + '%';
      hudState.textContent = spraying ? '● APLICANDO · JANELA OK' : '○ EM ROTA';
    }
  }, 'hero');
  tryScene('rota', 'rota', $('#filmRota'), {
    onUpdate: function (ha, prod) { $('#rotaHa').textContent = ha + ' ha'; $('#rotaProd').textContent = prod; }
  }, 'rota');
  tryScene('solar', 'solar', $('#filmSolar'), {
    onUpdate: function (done, total) { $('#solarHud').textContent = 'LIMPEZA · ' + done + '/' + total + ' PLACAS'; }
  }, 'solar');
  if (S3) { try { S3.cursor(); } catch (err) { console.warn('cursor 3D', err); } }

  // Vídeo da abertura: quando carrega, assume o lugar da cena 3D (que fica de reserva)
  var heroV = $('#heroVideo');
  if (heroV) {
    if (reduce) { heroV.removeAttribute('autoplay'); try { heroV.pause(); } catch (e) {} }
    heroV.addEventListener('loadeddata', function () {
      hero.classList.add('has-video');
      if (heroFilm && heroFilm.destroy) { heroFilm.destroy(); heroFilm = null; }
    });
  }

  // ===== Vídeo real em moldura 3D que "deita" e endireita com a rolagem =====
  var campoV = $('#campoVideo'), campoF = $('#campoFrame');
  if (campoV) {
    if ('IntersectionObserver' in window && !reduce) {
      new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { var p = campoV.play(); if (p && p.catch) p.catch(function () {}); } else campoV.pause();
      }, { threshold: .15 }).observe(campoV);
    }
  }
  function campoTilt() {
    if (!campoF || reduce) return;
    var r = campoF.getBoundingClientRect(), vh = window.innerHeight;
    var k = Math.max(0, Math.min(1, (vh - r.top) / (vh * .9)));
    campoF.style.transform = 'rotateX(' + ((1 - k) * 28).toFixed(2) + 'deg) scale(' + (.86 + k * .14).toFixed(3) + ')';
  }

  // ===== Inclinação 3D em cards (desktop) =====
  if (!reduce && window.matchMedia('(pointer: fine)').matches) {
    $$('.pain, .svc, .plan, .report, .aud__panel, .comp > div, .st__card, .form, .phone, .calc').forEach(function (el) {
      el.classList.add('tilt');
      var max = el.classList.contains('phone') ? 16 : el.classList.contains('form') || el.classList.contains('aud__panel') ? 3 : 9;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--rx', ((.5 - y) * max).toFixed(2) + 'deg');
        el.style.setProperty('--ry', ((x - .5) * max).toFixed(2) + 'deg');
        el.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
        el.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
        el.classList.add('is-tilting');
      });
      el.addEventListener('pointerleave', function () {
        el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); el.classList.remove('is-tilting');
      });
    });
  }

  var _onScroll = onScroll;
  onScroll = function () { _onScroll(); campoTilt(); };
  window.addEventListener('scroll', function () { onScroll(); }, { passive: true });
  onScroll();

  // ===== Como funciona: passos + conversa ilustrativa =====
  var CHAT = [
    [['me', 'Bom dia! Tenho 8 ha de café conilon em Santa Teresa. Preciso pulverizar nas próximas semanas.'],
     ['v', 'Bom dia! Já anotei. Em qual talhão? Você tem o receituário do produto?']],
    [['me', 'Talhão de cima, na encosta. Tenho sim, mando a foto.'],
     ['v', 'Receituário conferido. Sua área pode ser atendida com drone. ✓']],
    [['card', '<span class="mono">ROTA SAFRA · SANTA TERESA</span><br><b>4 sítios na mesma janela</b><br>Operador verificado · Previsão: terça, de manhã']],
    [['v', 'Equipe no talhão. Vento e umidade dentro do limite. Iniciando a aplicação.']],
    [['card', '<span class="mono">VOSAFRA REGISTRA</span><br><b>Comprovante de execução</b><br>8,0 ha · registro completo · PDF'],
     ['me', 'Recebi. Obrigado! Já deixa a próxima aplicação combinada.']]
  ];
  var steps = $$('#steps .step'), chat = $('#chat'), cur = -1, timer = null, chatVisible = false, busy = false;

  function hhmm(i) { var m = 7 * 60 + 12 + i * 9; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  function addMsg(kind, html, idx) {
    var d = document.createElement('div');
    d.className = 'msg' + (kind === 'me' ? ' msg--me' : kind === 'card' ? ' msg--card' : '');
    d.innerHTML = html + '<time>' + hhmm(idx) + '</time>';
    chat.appendChild(d);
    while (chat.children.length > 7) chat.removeChild(chat.firstChild);
  }
  function playStep(i) {
    if (busy) return;
    if (i === 0 || i < cur) chat.innerHTML = '';
    cur = i;
    steps.forEach(function (s, k) { s.classList.toggle('is-on', k === i); });
    var msgs = CHAT[i], delay = 0; busy = true;
    msgs.forEach(function (m, k) {
      var isUs = m[0] !== 'me';
      if (isUs && !reduce) {
        setTimeout(function () {
          var t = document.createElement('div'); t.className = 'typing'; t.innerHTML = '<i></i><i></i><i></i>';
          chat.appendChild(t);
          setTimeout(function () { t.remove(); addMsg(m[0], m[1], i * 2 + k); }, 900);
        }, delay);
        delay += 1300;
      } else {
        setTimeout(function () { addMsg(m[0], m[1], i * 2 + k); }, delay);
        delay += reduce ? 0 : 700;
      }
    });
    setTimeout(function () { busy = false; }, delay);
  }
  function loop() {
    clearTimeout(timer);
    if (!chatVisible || reduce) return;
    timer = setTimeout(function () { playStep((cur + 1) % CHAT.length); loop(); }, cur === CHAT.length - 1 ? 4200 : 3400);
  }
  steps.forEach(function (s, k) {
    s.addEventListener('mouseenter', function () { if (!busy && k !== cur) { playStep(k); loop(); } });
  });
  if (reduce) { CHAT.forEach(function (_, i) { playStep(i); busy = false; }); }
  else if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      chatVisible = es[0].isIntersecting;
      if (chatVisible && cur === -1) playStep(0);
      loop();
    }, { threshold: .25 }).observe($('.how'));
  } else playStep(0);

  // ===== Calculadora da Rota Safra =====
  var cViz = $('#cViz'), cHa = $('#cHa');
  function fmt(n) { return n.toLocaleString('pt-BR'); }
  function calc() {
    var v = +cViz.value, h = +cHa.value;
    $('#oViz').textContent = v;
    $('#oHa').textContent = h + ' ha';
    $('#rHa').textContent = fmt(v * h) + ' ha';
    $('#rSolo').textContent = v;
    $('#rProd').textContent = v;
    [cViz, cHa].forEach(function (r) { r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); });
  }
  cViz.addEventListener('input', calc); cHa.addEventListener('input', calc); calc();

  // ===== Abas de público =====
  var tabs = $$('[role="tab"]');
  function selectTab(t) {
    tabs.forEach(function (x) {
      var on = x === t;
      x.setAttribute('aria-selected', String(on));
      x.tabIndex = on ? 0 : -1;
      $('#' + x.getAttribute('aria-controls')).hidden = !on;
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { var n = tabs[(i + d + tabs.length) % tabs.length]; selectTab(n); n.focus(); }
    });
  });

  // ===== Formulário em etapas =====
  var form = $('#form'), err = $('#err'), back = $('#back'), next = $('#next');
  var FLOW = {
    produtor: ['perfil', 'lavoura', 'servico', 'local', 'contato'],
    operador: ['perfil', 'operador', 'contato'],
    cooperativa: ['perfil', 'cooperativa', 'contato'],
    solar: ['perfil', 'solar', 'contato']
  };
  var pos = 0;
  function perfil() { return (form.querySelector('input[name="perfil"]:checked') || {}).value || 'produtor'; }
  function flow() { return FLOW[perfil()]; }
  function show() {
    var f = flow(), name = f[pos];
    $$('.fstep', form).forEach(function (fs) { fs.hidden = fs.getAttribute('data-s') !== name; });
    $$('#prog i').forEach(function (b, k) { b.hidden = k >= f.length; b.classList.toggle('on', k <= pos); });
    $('#stepn').textContent = 'Etapa ' + (pos + 1) + ' de ' + f.length;
    back.hidden = pos === 0;
    next.textContent = pos === f.length - 1 ? 'Gerar meu pedido' : 'Continuar';
    next.className = pos === f.length - 1 ? 'btn' : 'btn btn--dark';
    err.textContent = '';
  }
  function current() { return form.querySelector('.fstep[data-s="' + flow()[pos] + '"]'); }
  function validate(fs) {
    var name = fs.getAttribute('data-s');
    if (name === 'lavoura' && !form.querySelector('input[name="cultura"]:checked')) return { m: 'Escolha a cultura principal.' };
    if (name === 'servico' && !form.querySelector('input[name="servico"]:checked')) return { m: 'Marque pelo menos um serviço (ou "Ainda não sei").' };
    var bad = null;
    $$('[data-req]', fs).some(function (el) {
      var t = el.getAttribute('data-req'), v = (el.value || '').trim();
      if (t === 'ok' && !el.checked) bad = { el: el, m: 'Precisamos do seu ok para falar com você pelo WhatsApp.' };
      else if (t === 'area' && !/^\d+([.,]\d+)?$/.test(v)) bad = { el: el, m: 'Coloque só o número de hectares. Ex.: 8.' };
      else if (t === 'phone' && v.replace(/\D/g, '').length < 10) bad = { el: el, m: 'Confira o número com DDD. Ex.: (27) 9 0000-0000.' };
      else if (t === 'text' && !v) bad = { el: el, m: 'Falta preencher: ' + (fs.querySelector('label[for="' + el.id + '"]') || {}).textContent + '.' };
      return !!bad;
    });
    return bad;
  }
  function val(n) { var el = form.elements[n]; return el ? (el.value || '').trim() : ''; }
  function buildMsg() {
    var p = perfil(), L = [];
    if (p === 'produtor') {
      var cult = (form.querySelector('input[name="cultura"]:checked') || {}).value;
      if (cult === 'Outra' && val('outra')) cult = val('outra');
      var serv = $$('input[name="servico"]:checked', form).map(function (c) { return c.value; });
      L.push('Olá, VOSAFRA! Quero um orçamento.');
      L.push('Cultura: ' + cult);
      L.push('Área: ' + val('area') + ' ha' + (val('talhoes') ? ' · ' + val('talhoes') + ' talhão(ões)' : ''));
      L.push('Serviço: ' + serv.join(', '));
      if (serv.indexOf('Pulverização com drone') > -1) L.push('Receituário: ' + val('receita'));
      L.push('Quando: ' + val('janela'));
      L.push('Local: ' + val('municipio') + (val('comunidade') ? ' · ' + val('comunidade') : '') + (val('referencia') ? ' (' + val('referencia') + ')' : ''));
      if ($('#fRota').checked) L.push('Quero entrar na Rota Safra com meus vizinhos.');
    } else if (p === 'operador') {
      L.push('Olá, VOSAFRA! Sou operador de drone e quero ser parceiro.');
      L.push('Base: ' + val('opBase') + (val('opDrone') ? ' · Drone: ' + val('opDrone') : ''));
      L.push('Registro Idaf: ' + val('opIdaf') + ' · ANAC/DECEA: ' + val('opAnac'));
    } else if (p === 'cooperativa') {
      L.push('Olá, VOSAFRA! Quero conversar sobre um piloto.');
      L.push('Organização: ' + val('coOrg') + (val('coCargo') ? ' · ' + val('coCargo') : ''));
      if (val('coMun')) L.push('Atuação: ' + val('coMun'));
      if (val('coN')) L.push('Produtores atendidos: cerca de ' + val('coN'));
    } else {
      L.push('Olá, VOSAFRA! Quero orçamento de limpeza de placas solares com drone.');
      L.push('Local: ' + val('soMun') + ' · ' + val('soTipo') + (val('soQtd') ? ' · cerca de ' + val('soQtd') + ' placas' : ''));
    }
    L.push('Nome: ' + val('nome') + ' · WhatsApp: ' + val('whatsapp') + ' · Melhor horário: ' + val('horario'));
    if (val('obs')) L.push('Obs.: ' + val('obs'));
    return L.join('\n');
  }
  var DONE = {
    produtor: ['Pedido pronto, {n}!', 'Toque em "Enviar pelo WhatsApp" para mandar o pedido. A gente avalia sua área e explica o melhor caminho.'],
    rota: ['Pedido pronto, {n}!', 'Envie pelo WhatsApp para entrar na lista da Rota Safra de Santa Teresa. Quanto mais vizinhos, mais fácil montar a rota.'],
    operador: ['Cadastro pronto, {n}!', 'Envie pelo WhatsApp. Vamos conferir seus documentos e chamar você para conversar sobre a rede de Santa Teresa.'],
    cooperativa: ['Obrigado pelo interesse, {n}!', 'Envie pelo WhatsApp. Alguém do time entra em contato para desenhar um piloto junto com vocês.'],
    solar: ['Pedido pronto, {n}!', 'Envie pelo WhatsApp para receber o orçamento de limpeza.']
  };
  function finish() {
    var p = perfil(), key = p === 'produtor' && $('#fRota').checked ? 'rota' : p, msg = buildMsg(), n = val('nome').split(' ')[0];
    $$('.fstep', form).forEach(function (fs) { fs.hidden = true; });
    $('#fnav').hidden = true; $('#prog').hidden = true; $('#stepn').hidden = true;
    $('#doneTitle').textContent = DONE[key][0].replace('{n}', n);
    $('#doneText').textContent = DONE[key][1];
    $('#doneMsg').textContent = msg;
    $('#doneWa').href = waLink(msg, true);
    $('#done').hidden = false;
    try { localStorage.removeItem('vosafra-form'); } catch (e) {}
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var bad = validate(current());
    if (bad) { err.textContent = bad.m; if (bad.el) bad.el.focus(); return; }
    if (pos < flow().length - 1) { pos++; show(); var first = current().querySelector('input,select,textarea'); if (first && pos > 0) first.focus({ preventScroll: true }); }
    else finish();
  });
  back.addEventListener('click', function () { if (pos > 0) { pos--; show(); } });
  form.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'perfil') { pos = 0; show(); }
    if (t.name === 'cultura') $('#outraWrap').hidden = t.value !== 'Outra';
    if (t.name === 'servico') $('#receitaWrap').hidden = !form.querySelector('input[name="servico"][value="Pulverização com drone"]:checked');
  });
  $('#doneCopy').addEventListener('click', function () {
    var b = this, txt = $('#doneMsg').textContent;
    function ok() { b.textContent = 'Mensagem copiada'; setTimeout(function () { b.textContent = 'Copiar mensagem'; }, 2200); }
    function sel() { var r = document.createRange(); r.selectNodeContents($('#doneMsg')); var s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'Texto selecionado'; }
    try { navigator.clipboard.writeText(txt).then(ok, sel); } catch (e) { sel(); }
  });

  // CTAs que já escolhem perfil / serviço / rota
  $$('[data-perfil]').forEach(function (a) {
    a.addEventListener('click', function () {
      var p = a.getAttribute('data-perfil'), r = form.querySelector('input[name="perfil"][value="' + p + '"]');
      if ($('#done').hidden === false) return;
      if (r) r.checked = true;
      var s = a.getAttribute('data-servico');
      if (s) { var c = form.querySelector('input[name="servico"][value="' + s + '"]'); if (c) { c.checked = true; form.dispatchEvent(new Event('change')); c.dispatchEvent(new Event('change', { bubbles: true })); } }
      if (a.hasAttribute('data-rota')) $('#fRota').checked = true;
      pos = p === 'produtor' ? 0 : 1;
      show();
    });
  });
  show();
})();
