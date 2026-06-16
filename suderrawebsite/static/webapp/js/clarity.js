/* SUDERRA — Clarity redesign runtime
   Raw WebGL water caustics + 3D octagonal tank-in-tank (no libraries → CSP-safe).
   Plus scroll-clarity, live ticker, nav, reveal, contact + newsletter AJAX.        */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isRTL = document.documentElement.getAttribute('dir') === 'rtl';

  document.addEventListener('DOMContentLoaded', function () {
    initHeader();
    initReveal();
    initTicker();
    initTilt();
    initDash();
    initHeroVideo();
    initForms();
    var fl = document.getElementById('form_loaded');
    if (fl) fl.value = Date.now();
    try { initWater(); } catch (e) { fallbackCanvas(); }
  });

  /* ---------------- Header / nav ---------------- */
  function initHeader() {
    var head = document.getElementById('siteHead');
    var burger = document.getElementById('burger');
    function onScroll() { if (head) head.classList.toggle('scrolled', window.scrollY > 24); }
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(function () { onScroll(); updateClarity(); ticking = false; }); ticking = true; }
    }, { passive: true });
    onScroll();
    if (burger) {
      burger.addEventListener('click', function () {
        var open = document.body.classList.toggle('nav-open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.querySelectorAll('.nav a').forEach(function (a) {
        a.addEventListener('click', function () { document.body.classList.remove('nav-open'); burger.setAttribute('aria-expanded', 'false'); });
      });
    }
  }

  /* ---------------- Scroll → clarity (0 murky → 1 clear) ---------------- */
  var clarity = 0;
  function updateClarity() {
    var h = window.innerHeight || 800;
    clarity = Math.max(0, Math.min(1, window.scrollY / (h * 0.85)));
    document.documentElement.style.setProperty('--clarity', clarity.toFixed(3));
  }

  /* ---------------- Reveal on scroll ---------------- */
  function initReveal() {
    var els = document.querySelectorAll('.reveal');
    if (reduce || !('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------------- Live sensor ticker ---------------- */
  function initTicker() {
    var items = document.querySelectorAll('.t-val[data-metric]');
    if (!items.length) return;
    var dec = { do: 1, ph: 2, temp: 1, turb: 1 };
    var state = [];
    items.forEach(function (el) {
      state.push({ el: el, base: parseFloat(el.getAttribute('data-base')) || 0, range: parseFloat(el.getAttribute('data-range')) || 0.5, v: parseFloat(el.getAttribute('data-base')) || 0, m: el.getAttribute('data-metric') });
    });
    if (reduce) return;
    setInterval(function () {
      if (document.hidden) return;
      state.forEach(function (s) {
        var target = s.base + (Math.random() - 0.5) * s.range;
        s.v += (target - s.v) * 0.5;
        s.el.textContent = s.v.toFixed(dec[s.m] != null ? dec[s.m] : 1);
      });
    }, 1300);
  }

  /* ---------------- Hero video: load only on capable connections ---------------- */
  function initHeroVideo() {
    var v = document.querySelector('.hero-video');
    if (!v) return;
    var src = v.getAttribute('data-src');
    var saveData = navigator.connection && navigator.connection.saveData;
    if (!src || reduce || saveData || window.innerWidth < 900) return; // skip the heavy video on mobile/save-data/reduced-motion
    v.src = src;
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }

  /* ---------------- 3D cursor tilt on cards ---------------- */
  function initTilt() {
    if (reduce) return;
    var cards = document.querySelectorAll('.product-shot, .dash');  // tilt reserved for the two showpiece visuals
    cards.forEach(function (card) {
      card.classList.add('tilt-on');
      card.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transition = 'transform .1s ease-out';
        card.style.transform = 'perspective(900px) rotateY(' + (px * 6).toFixed(2) + 'deg) rotateX(' + (-py * 6).toFixed(2) + 'deg) translateY(-5px)';
      });
      card.addEventListener('pointerleave', function () {
        card.style.transition = 'transform .6s cubic-bezier(.16,1,.3,1)';
        card.style.transform = '';
      });
    });
  }

  /* ---------------- Dashboard: Deffeyes diagram + AI correction ---------------- */
  function initDash() {
    var dash = document.querySelector('.dash');
    var svg = dash && dash.querySelector('.deffeyes');
    if (!dash || !svg) return;
    var starEl = svg.querySelector('.dfx-star'),
        targetEl = svg.querySelector('.dfx-target'),
        arrowEl = svg.querySelector('.dfx-arrow'),
        aiText = dash.querySelector('.dash-ai-text'),
        chipDic = dash.querySelector('[data-chip="dic"]'),
        chipAlk = dash.querySelector('[data-chip="alk"]'),
        chipPh = dash.querySelector('[data-chip="ph"]');
    var msg = function (k, d) { return dash.getAttribute('data-ai-' + k) || d; };
    var safe = { x0: 122, y0: 66, x1: 214, y1: 120 }, center = { x: 168, y: 93 };
    var pos = { x: center.x, y: center.y }, goal = { x: center.x, y: center.y };

    function setStar() { starEl.setAttribute('transform', 'translate(' + pos.x.toFixed(1) + ',' + pos.y.toFixed(1) + ')'); }
    function showTarget(p) {
      if (targetEl) { targetEl.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')'); targetEl.style.opacity = '1'; }
      if (arrowEl) { arrowEl.setAttribute('x2', p.x); arrowEl.setAttribute('y2', p.y); arrowEl.style.opacity = '1'; }
    }
    function hideTarget() { if (targetEl) targetEl.style.opacity = '0'; if (arrowEl) arrowEl.style.opacity = '0'; }
    function updateChips() {
      if (chipDic) chipDic.textContent = (2.5 + (pos.x - 40) / 260 * 4).toFixed(1);
      if (chipAlk) chipAlk.textContent = (1.0 + (172 - pos.y) / 156 * 3).toFixed(1);
      if (chipPh) chipPh.textContent = (6.7 + (172 - pos.y) / 156 * 1.5 - (pos.x - 40) / 260 * 0.5).toFixed(1);
    }
    setStar(); updateChips();
    if (reduce) { if (aiText) aiText.textContent = msg('stable', 'AI: stable'); return; }

    var raf2 = null;
    function loop() {
      pos.x += (goal.x - pos.x) * 0.07; pos.y += (goal.y - pos.y) * 0.07;
      setStar(); updateChips();
      if (arrowEl && arrowEl.style.opacity === '1') { arrowEl.setAttribute('x1', pos.x.toFixed(1)); arrowEl.setAttribute('y1', pos.y.toFixed(1)); }
      raf2 = document.hidden ? null : requestAnimationFrame(loop);
    }
    function startDash() { if (!raf2 && !document.hidden) raf2 = requestAnimationFrame(loop); }
    startDash();

    function excursion() {
      return Math.random() < 0.5
        ? { x: safe.x0 - 26 - Math.random() * 22, y: safe.y0 - 16 - Math.random() * 16 }
        : { x: safe.x1 + 16 + Math.random() * 30, y: safe.y1 + 12 + Math.random() * 18 };
    }
    function setAI(k, alert) { if (aiText) aiText.textContent = msg(k, ''); dash.classList.toggle('alert', !!alert); }

    var steps = [
      function () { goal = { x: center.x, y: center.y }; hideTarget(); setAI('analyze', false); },
      function () { setAI('stable', false); },
      function () { goal = excursion(); setAI('drift', true); },                                   // drifts outside safe zone
      function () { showTarget(center); goal = { x: center.x, y: center.y }; setAI('dose', true); }, // AI targets + pulls back
      function () { hideTarget(); setAI('back', false); }
    ];
    var si = 0;
    (function sched() { if (!document.hidden) { steps[si % steps.length](); si++; } setTimeout(sched, 2900); })();
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { if (raf2) { cancelAnimationFrame(raf2); raf2 = null; } } else { startDash(); }
    });
  }

  /* ---------------- WebGL: water + 3D octagon ---------------- */
  function fallbackCanvas() {
    var c = document.getElementById('waterCanvas');
    if (c) c.style.background = 'radial-gradient(120% 90% at 70% 0%, #0a3242 0%, #082230 40%, #04141f 100%)';
  }

  function initWater() {
    var canvas = document.getElementById('waterCanvas');
    if (!canvas) return;
    var gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: false });
    if (!gl) { fallbackCanvas(); return; }

    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0;
    function resize() {
      W = canvas.clientWidth = window.innerWidth; H = canvas.clientHeight = window.innerHeight;
      canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    /* ---- shader helpers ---- */
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    function prog(vs, fs) {
      var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      return p;
    }

    /* ===== Pass 1: caustic water background (fullscreen) ===== */
    var bgP = prog(
      'attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }',
      'precision highp float; uniform vec2 uRes; uniform float uT; uniform float uClar; uniform vec2 uMouse;' +
      'float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }' +
      'float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);' +
      ' float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));' +
      ' return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }' +
      'float fbm(vec2 p){ float v=0.,a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.02; a*=.5;} return v; }' +
      'void main(){ vec2 uv=gl_FragCoord.xy/uRes.xy; vec2 q=uv; q.x*=uRes.x/uRes.y;' +
      ' float t=uT*0.04;' +
      ' vec2 w=q*3.0; w+=vec2(fbm(w+t),fbm(w-t))*0.6;' +
      ' float caust=fbm(w*1.6+t*1.5);' +
      ' caust=pow(abs(caust-0.5)*2.0,1.6);' +            // ridged caustic lines
      ' float clar=uClar;' +
      ' vec3 deep=vec3(0.016,0.078,0.122);' +            // abyss
      ' vec3 mid=vec3(0.039,0.196,0.255);' +             // ocean
      ' vec3 glow=mix(vec3(0.05,0.45,0.5), vec3(0.17,0.83,0.85), clar);' + // teal->cyan
      ' float depth=smoothstep(0.0,1.0,uv.y);' +
      ' vec3 col=mix(deep,mid,depth);' +
      ' float cl=caust*mix(0.12,0.5,clar);' +
      ' col+=glow*cl;' +
      ' float md=distance(uv,uMouse); col+=glow*0.18*smoothstep(0.35,0.0,md)*(0.4+clar);' +
      ' col+=fbm(uv*200.0)*0.015;' +                     // micro grain
      ' float vig=smoothstep(1.15,0.25,length(uv-0.5)); col*=mix(0.85,1.0,vig);' +
      ' gl_FragColor=vec4(col, 1.0); }'
    );
    var bgQuad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bgQuad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    var bg_p = gl.getAttribLocation(bgP, 'p');
    var bg_uRes = gl.getUniformLocation(bgP, 'uRes'), bg_uT = gl.getUniformLocation(bgP, 'uT'),
        bg_uClar = gl.getUniformLocation(bgP, 'uClar'), bg_uMouse = gl.getUniformLocation(bgP, 'uMouse');

    /* ===== Pass 2: 3D octagonal tank-in-tank ===== */
    // Build geometry: outer + inner octagon rings (top & bottom) + vertical edges.
    var lineVerts = [];
    function ring(radius, y, arr) { var pts = []; for (var i = 0; i < 8; i++) { var a = (i / 8) * Math.PI * 2 + Math.PI / 8; pts.push([Math.cos(a) * radius, y, Math.sin(a) * radius]); } return pts; }
    function ringEdges(pts) { for (var i = 0; i < 8; i++) { var a = pts[i], b = pts[(i + 1) % 8]; lineVerts.push(a[0],a[1],a[2], b[0],b[1],b[2]); } }
    var oTop = ring(1.0, 0.42, 1), oBot = ring(1.0, -0.42, 1), iTop = ring(0.62, 0.42, 1), iBot = ring(0.62, -0.42, 1);
    ringEdges(oTop); ringEdges(oBot); ringEdges(iTop); ringEdges(iBot);
    for (var i = 0; i < 8; i++) {            // verticals (outer + inner) + radial caps
      lineVerts.push(oTop[i][0],oTop[i][1],oTop[i][2], oBot[i][0],oBot[i][1],oBot[i][2]);
      lineVerts.push(iTop[i][0],iTop[i][1],iTop[i][2], iBot[i][0],iBot[i][1],iBot[i][2]);
      lineVerts.push(oTop[i][0],oTop[i][1],oTop[i][2], iTop[i][0],iTop[i][1],iTop[i][2]);
    }
    var lineBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lineVerts), gl.STATIC_DRAW);
    var lineCount = lineVerts.length / 3;

    // Bioluminescent particles inside the octagon volume.
    var N = 320, parts = [];
    for (var k = 0; k < N; k++) {
      var a = Math.random() * Math.PI * 2, rr = 0.62 * Math.sqrt(Math.random());
      parts.push(Math.cos(a) * rr, (Math.random() - 0.5) * 0.8, Math.sin(a) * rr, Math.random()); // x,y,z,seed
    }
    var partBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, partBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(parts), gl.STATIC_DRAW);

    var objVS =
      'attribute vec3 pos; attribute float seed; uniform mat4 uMVP; uniform float uT; uniform float uPt; varying float vDepth; varying float vSeed;' +
      'void main(){ vec3 p=pos;' +
      ' if(uPt>0.5){ p.y+=sin(uT*0.7+seed*6.28)*0.05; p.x+=cos(uT*0.5+seed*6.28)*0.03; }' +
      ' vec4 mp=uMVP*vec4(p,1.0); gl_Position=mp; vDepth=clamp((3.2 - mp.w)/2.6,0.0,1.0); vSeed=seed;' +
      ' gl_PointSize=(1.0+vDepth*3.0)* ' + DPR.toFixed(1) + '; }';
    var objFS =
      'precision mediump float; varying float vDepth; varying float vSeed; uniform float uPt; uniform float uAlpha; uniform float uClar;' +
      'void main(){ vec3 cyan=vec3(0.17,0.83,0.85); vec3 teal=vec3(0.05,0.42,0.5);' +
      ' vec3 c=mix(teal,cyan,vDepth);' +
      ' if(uPt>0.5){ vec2 d=gl_PointCoord-0.5; float r=length(d); if(r>0.5) discard; float g=smoothstep(0.5,0.0,r);' +
      '   gl_FragColor=vec4(c*(0.6+uClar),1.0)*g*uAlpha*(0.5+0.5*vDepth); }' +
      ' else { gl_FragColor=vec4(c, (0.25+0.45*vDepth)*uAlpha); } }';
    var objP = prog(objVS, objFS);
    var o_pos = gl.getAttribLocation(objP, 'pos'), o_seed = gl.getAttribLocation(objP, 'seed');
    var o_mvp = gl.getUniformLocation(objP, 'uMVP'), o_t = gl.getUniformLocation(objP, 'uT'),
        o_pt = gl.getUniformLocation(objP, 'uPt'), o_alpha = gl.getUniformLocation(objP, 'uAlpha'),
        o_clar = gl.getUniformLocation(objP, 'uClar');

    /* ---- mat4 ---- */
    function mul(a, b) { var o = new Float32Array(16); for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) { var s = 0; for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
    function persp(fov, asp, n, f) { var t = 1 / Math.tan(fov / 2); return new Float32Array([t / asp,0,0,0, 0,t,0,0, 0,0,(f + n) / (n - f),-1, 0,0,2 * f * n / (n - f),0]); }
    function trans(x, y, z) { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]); }
    function rotY(a) { var c = Math.cos(a), s = Math.sin(a); return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]); }
    function rotX(a) { var c = Math.cos(a), s = Math.sin(a); return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]); }
    function rotZ(a) { var c = Math.cos(a), s = Math.sin(a); return new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]); }

    var mouse = [0.7, 0.2], mt = [0.7, 0.2];
    window.addEventListener('pointermove', function (e) { mt = [e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight]; }, { passive: true });

    resize(); window.addEventListener('resize', resize); updateClarity();
    var start = performance.now();

    function frame(now) {
      var t = (now - start) / 1000;
      mouse[0] += (mt[0] - mouse[0]) * 0.05; mouse[1] += (mt[1] - mouse[1]) * 0.05;
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);

      // bg
      gl.disable(gl.BLEND); gl.useProgram(bgP);
      gl.bindBuffer(gl.ARRAY_BUFFER, bgQuad); gl.enableVertexAttribArray(bg_p); gl.vertexAttribPointer(bg_p, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(bg_uRes, canvas.width, canvas.height); gl.uniform1f(bg_uT, t);
      gl.uniform1f(bg_uClar, clarity); gl.uniform2f(bg_uMouse, mouse[0], mouse[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // octagon — fades out past the hero
      var heroFade = Math.max(0, 1 - window.scrollY / (window.innerHeight * 0.9));
      if (heroFade > 0.01) {
        var asp = canvas.width / canvas.height;
        var P = persp(0.95, asp, 0.1, 100);
        // place to the side; mouse parallax
        var offX = (isRTL ? -1 : 1) * (asp > 0.9 ? 0.9 : 0.0);
        var V = trans(offX, 0.05, -3.4);
        var M = mul(rotZ(0.5), mul(rotY(Math.sin(t * 0.16) * 0.5 + (mouse[0] - 0.5) * 0.6), rotX(-0.55 + (mouse[1] - 0.5) * -0.25)));
        var MVP = mul(P, mul(V, M));
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.useProgram(objP); gl.uniformMatrix4fv(o_mvp, false, MVP); gl.uniform1f(o_t, t); gl.uniform1f(o_clar, clarity); gl.uniform1f(o_alpha, heroFade);
        // lines
        gl.uniform1f(o_pt, 0.0); gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
        gl.enableVertexAttribArray(o_pos); gl.vertexAttribPointer(o_pos, 3, gl.FLOAT, false, 0, 0);
        gl.disableVertexAttribArray(o_seed); gl.vertexAttrib1f(o_seed, 0.0);
        gl.lineWidth(1); gl.drawArrays(gl.LINES, 0, lineCount);
        // particles
        gl.uniform1f(o_pt, 1.0); gl.bindBuffer(gl.ARRAY_BUFFER, partBuf);
        gl.enableVertexAttribArray(o_pos); gl.vertexAttribPointer(o_pos, 3, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(o_seed); gl.vertexAttribPointer(o_seed, 1, gl.FLOAT, false, 16, 12);
        gl.drawArrays(gl.POINTS, 0, N);
      }

      raf = (!reduce && inView && !document.hidden) ? window.requestAnimationFrame(frame) : null;
    }
    var inView = true, raf = null;
    function resume() { if (!raf && !reduce && inView && !document.hidden) raf = window.requestAnimationFrame(frame); }
    if (reduce) { clarity = 0.6; frame(start + 16); }   // single clarified frame, no loop
    else { raf = window.requestAnimationFrame(frame); }
    // Only render while a water-backed section (hero / feature hero / footer) is on screen.
    if ('IntersectionObserver' in window && !reduce) {
      var seen = new Set();
      var vo = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) seen.add(e.target); else seen.delete(e.target); });
        inView = seen.size > 0;
        if (inView) resume();
      }, { rootMargin: '140px' });
      document.querySelectorAll('.hero, .fhero, .site-foot').forEach(function (el) { vo.observe(el); });
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = null; } }
      else { resume(); }
    });
  }

  /* ---------------- Forms (contact + newsletter) ---------------- */
  function getCookie(name) {
    if (!document.cookie) return null;
    var parts = document.cookie.split(';');
    for (var i = 0; i < parts.length; i++) { var c = parts[i].trim(); if (c.indexOf(name + '=') === 0) return decodeURIComponent(c.substring(name.length + 1)); }
    return null;
  }
  function parseJSONSafe(resp) { return resp.json().catch(function () { return { status: resp.ok ? 'success' : 'error' }; }); }

  function initForms() {
    var cf = document.getElementById('contactForm');
    if (cf) {
      var fb = document.getElementById('formFeedback');
      var btn = cf.querySelector('button[type="submit"]');
      var btnText = btn ? btn.querySelector('.btn-text') : null;
      var d = function (k, f) { return cf.getAttribute('data-msg-' + k) || f; };
      function show(type, msg) { if (!fb) return; fb.className = 'form-feedback show ' + type; fb.textContent = msg; }
      cf.addEventListener('submit', function (e) {
        e.preventDefault();
        var g = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
        var name = g('name'), company = g('company'), email = g('email'), message = g('message');
        if (!name || !company || !email || !message) { show('error', d('required', 'Please fill in all required fields.')); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { show('error', d('email', 'Please enter a valid email address.')); return; }
        if (btn) btn.disabled = true; if (btnText) btnText.textContent = d('sending', 'Sending…');
        fetch(cf.getAttribute('data-ajax-url') || '/ajax/contact/', { method: 'POST', headers: { 'X-CSRFToken': getCookie('csrftoken') }, body: new FormData(cf) })
          .then(parseJSONSafe)
          .then(function (data) {
            if (data.status === 'success') { show('success', data.message || d('success', 'Sent!')); cf.reset(); }
            else { show('error', data.message || d('error', 'Something went wrong.')); }
          })
          .catch(function () { show('error', d('network-error', 'An error occurred. Please try again later.')); })
          .finally(function () { if (btn) btn.disabled = false; if (btnText) btnText.textContent = d('submit', 'Send message'); });
      });
    }

    var nf = document.getElementById('newsletterForm');
    if (nf) {
      var nfb = document.getElementById('newsletterFeedback');
      nf.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = nf.querySelector('input[name="email"]');
        var email = input ? input.value.trim() : '';
        if (!email) return;
        var sb = nf.querySelector('button'); if (sb) sb.disabled = true;
        fetch(nf.getAttribute('data-ajax-url') || '/ajax/newsletter/', { method: 'POST', headers: { 'X-CSRFToken': getCookie('csrftoken') }, body: new FormData(nf) })
          .then(parseJSONSafe)
          .then(function (data) {
            if (nfb) { nfb.textContent = data.message || ''; nfb.className = 'news-feedback ' + (data.status === 'success' ? 'success' : 'error'); }
            if (data.status === 'success' && input) input.value = '';
          })
          .catch(function () { if (nfb) { nfb.textContent = 'An error occurred. Please try again.'; nfb.className = 'news-feedback error'; } })
          .finally(function () { if (sb) sb.disabled = false; });
      });
    }
  }
})();
