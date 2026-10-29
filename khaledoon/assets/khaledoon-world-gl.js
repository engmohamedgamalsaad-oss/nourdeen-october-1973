/* Khaledoon - WebGL layer for the homepage globe (#khWorld).
   Draws a lit 3D globe with raw WebGL: no library, no CDN. The land, borders and cities come from the bundled
   Natural Earth file that khaledoon-world.js already loads; story points, selection, cards, zoom buttons and the
   `kh:world-select` event all stay owned by khaledoon-world.js and are reached through window._khWorldApi.
   Zoom (up to 10x) is owned by this file while the WebGL globe is active.
   If WebGL (or anything else here) fails, this file removes itself and the original 2D globe resumes. */
(function () {
  'use strict';
  if (window._khGlobeGL) return;
  window._khGlobeGL = true;

  var DEG = Math.PI / 180, PI = Math.PI;
  var LANGS = ['ar', 'en', 'fr', 'it', 'de'];
  var HOME_LON = 29, HOME_LAT = 21, MAX_LAT = 75, MAX_POINTS = 1000;
  var MIN_Z = 0.78, MAX_Z = 10, SEL_Z = 6;

  var api = null, stage = null, oldCanvas = null;
  var wrap, canvas, over, octx, gl, styleEl;
  var progG, progM, bufQuad, bufMk, bufIdx, tex = null, texHi = null, hiTried = false, texBlank = null, hasTex = 0;

  var raf = 0, ready = false, dead = false, inView = true, pageVisible = !document.hidden, dirty = true;
  var lon = HOME_LON, lat = HOME_LAT, vLon = 0, vLat = 0, zoomNow = 1, zoomT = 1, fly = null, arriveT = 0;
  var autoPauseUntil = 0, lastT = 0, timeAcc = 0, moveT = 0;
  var drag = false, lastX = 0, lastY = 0, startX = 0, startY = 0, pointers = {}, pinch = null, hover = -1, lastSel = null;
  var geoBuilt = false, mk = { count: 0, dirty: true, sig: '', len: -1, sel: null, groups: [] };
  var observers = [], lastSig = '', cleanups = [], photos = {}, zBtn = null;
  var L = { w: 0, h: 0, dpr: 1, cx: 0, cy: 0, R: 0 };
  var V = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function reduced() { return !!(motionQuery && motionQuery.matches); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function lang() {
    var l = (document.documentElement.lang || 'ar').slice(0, 2).toLowerCase();
    return LANGS.indexOf(l) >= 0 ? l : 'ar';
  }
  function nameOf(p) {
    var s = (p && p.story) || {}, l = lang(), i = s.i18n && s.i18n[l];
    return (i && (i.person || i.title)) || s[l] || s.person || s.title || '';
  }
  function rgbOf(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ''), n = m ? parseInt(m[1], 16) : 0xb8874b;
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    cleanups.push(function () { try { target.removeEventListener(type, fn, opts); } catch (e) {} });
  }

  /* ---------- zoom (owned here: 0.78x - 10x) ---------- */
  function updateZoomButtons() {
    if (!zBtn) return;
    if (zBtn.out) zBtn.out.disabled = zoomT <= MIN_Z + 0.0005;
    if (zBtn.inn) zBtn.inn.disabled = zoomT >= MAX_Z - 0.0005;
    if (zBtn.reset) zBtn.reset.disabled = false;
  }
  function setZoomGL(v) {
    zoomT = clamp(v, MIN_Z, MAX_Z);
    updateZoomButtons();
    kick();
  }

  /* ---------- failure: hand control back to the 2D globe ---------- */
  function fail(reason) {
    if (dead) return;
    dead = true;
    try { if (raf) cancelAnimationFrame(raf); } catch (e) {}
    raf = 0;
    observers.forEach(function (o) { try { o.disconnect(); } catch (e) {} });
    cleanups.forEach(function (c) { c(); });
    try { if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap); } catch (e) {}
    try { if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl); } catch (e) {}
    if (stage) stage.classList.remove('is-three');
    window._khUseThree = false;
    try { if (api && api.setZoom) api.setZoom(api.getZoom()); } catch (e) {}
    try { if (gl) { var ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } } catch (e) {}
    try { if (api && api.redraw) api.redraw(); } catch (e) {}
    if (window.console) console.warn('[khaledoon] WebGL globe unavailable (' + reason + '); the 2D globe is used instead.');
  }

  /* ---------- styles (injected so only one script tag is needed) ---------- */
  var CSS = [
    '.kh-world-gl{display:none;position:relative;width:100%;height:390px;min-width:0;transform:scale(1);transform-origin:center;',
    'transition:transform .68s cubic-bezier(.2,.75,.25,1),filter .68s ease;filter:drop-shadow(0 10px 22px rgba(32,143,175,.2))}',
    '.kh-world-stage.is-three .kh-world-gl{display:block}',
    '.kh-world-stage.is-three .kh-world-canvas{display:none}',
    '.kh-world-gl canvas{position:absolute;left:0;top:0;width:100%;height:100%;display:block}',
    '.kh-world-gl .kh-gl-main{touch-action:pan-y;cursor:grab;outline:none}',
    '.kh-world-gl .kh-gl-main.is-dragging{cursor:grabbing}',
    '.kh-world-gl .kh-gl-main:focus-visible{outline:2px solid #f0c878;outline-offset:5px;border-radius:18px}',
    '.kh-world-gl .kh-gl-over{pointer-events:none}',
    '.kh-world.kh-world-leaving .kh-world-gl{transform:scale(1.22);filter:brightness(1.28) drop-shadow(0 0 28px rgba(83,190,214,.48))}',
    '@media(max-width:780px){.kh-world-gl{height:min(82vw,350px);min-height:260px}}',
    '@media(prefers-reduced-motion:reduce){.kh-world-gl{transition:none!important}}'
  ].join('');

  /* ---------- shaders ---------- */
  var PREC = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';

  var VS_GLOBE = [
    'attribute vec2 aPos;',
    'uniform vec2 uRes; uniform vec2 uC; uniform float uRad;',
    'varying vec2 vP;',
    'void main(){',
    '  float ext = 1.4;',
    '  vP = aPos * ext;',
    '  vec2 px = uC + aPos * uRad * ext;',
    '  gl_Position = vec4(px / uRes * 2.0 - 1.0, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FS_GLOBE = PREC + [
    'varying vec2 vP;',
    'uniform sampler2D uTex; uniform mat3 uV; uniform float uRad; uniform float uHas;',
    'const float PI = 3.14159265;',
    'float grid(float la, float lo, float z){',
    '  float st = PI / 12.0;',
    '  float w = 0.9 / (uRad * max(z, 0.18));',
    '  float dl = abs(fract(lo / st + 0.5) - 0.5) * st * cos(la);',
    '  float dp = abs(fract(la / st + 0.5) - 0.5) * st;',
    '  return max(1.0 - smoothstep(0.0, w, dl), 1.0 - smoothstep(0.0, w, dp));',
    '}',
    'void main(){',
    '  float d = length(vP);',
    '  if (d > 1.4) { gl_FragColor = vec4(0.0); return; }',
    '  vec3 L = normalize(vec3(-0.5, 0.5, 0.72));',
    '  float edge = 1.0 - smoothstep(1.0 - 1.2 / uRad, 1.0 + 0.4 / uRad, d);',
    '  vec3 col = vec3(0.0);',
    '  if (edge > 0.0) {',
    '    float z = sqrt(max(0.0, 1.0 - d * d));',
    '    vec3 n = vec3(vP, z);',
    '    vec3 w = n * uV;',
    '    float la = asin(clamp(w.y, -1.0, 1.0));',
    '    float lo = atan(w.x, w.z);',
    '    vec4 t = texture2D(uTex, vec2(lo / (2.0 * PI) + 0.5, 0.5 - la / PI));',
    '    float land = t.r * uHas;',
    '    float border = t.g * uHas;',
    '    float diff = clamp(dot(n, L), 0.0, 1.0);',
    '    float lit = 0.34 + 0.86 * diff;',
    '    vec3 ocean = mix(vec3(0.020, 0.095, 0.155), vec3(0.060, 0.255, 0.330), pow(z, 0.8));',
    '    vec3 ground = mix(vec3(0.290, 0.610, 0.545), vec3(0.470, 0.780, 0.690), diff * 0.7);',
    '    col = mix(ocean, ground, land) * lit;',
    '    col = mix(col, vec3(0.84, 0.92, 0.87) * (0.45 + 0.6 * diff), border * 0.5);',
    '    vec3 r = reflect(-L, n);',
    '    col += vec3(0.55, 0.82, 0.90) * pow(max(r.z, 0.0), 42.0) * (1.0 - land) * 0.40;',
    '    col += vec3(0.62, 0.86, 0.88) * grid(la, lo, z) * 0.075 * (1.0 - land * 0.4);',
    '    float rim = pow(1.0 - z, 2.8);',
    '    col += vec3(0.22, 0.58, 0.72) * rim * (0.35 + 0.65 * diff) * 0.8;',
    '  }',
    '  float gd = max(d - 1.0, 0.0);',
    '  float side = 0.5 + 0.5 * clamp(dot(normalize(vP + 0.0001), normalize(L.xy)), -1.0, 1.0);',
    '  float glow = exp(-gd * 12.0) * (0.22 + 0.4 * side) * (1.0 - smoothstep(1.2, 1.4, d));',
    '  float ga = glow * (1.0 - edge);',
    '  gl_FragColor = vec4(col * edge + vec3(0.26, 0.66, 0.80) * ga, edge + ga);',
    '}'
  ].join('\n');

  var VS_MARK = [
    'attribute vec2 aLL; attribute vec2 aCo; attribute vec3 aCol; attribute float aFlag;',
    'uniform mat3 uV; uniform vec2 uRes; uniform vec2 uC; uniform float uRad; uniform float uSize;',
    'varying vec2 vCo; varying vec3 vCol; varying float vFlag; varying float vFade;',
    'void main(){',
    '  float cl = cos(aLL.x);',
    '  vec3 w = vec3(cl * sin(aLL.y), sin(aLL.x), cl * cos(aLL.y));',
    '  vec3 v = uV * w;',
    '  vCo = aCo; vCol = aCol; vFlag = aFlag;',
    '  vFade = smoothstep(0.0, 0.22, v.z);',
    '  float sz = uSize * (aFlag > 1.5 ? 1.55 : (aFlag > 0.5 ? 1.25 : 1.0)) * (0.8 + 0.25 * v.z);',
    '  vec2 px = uC + v.xy * uRad * 1.004 + aCo * sz * 3.2;',
    '  gl_Position = v.z < 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(px / uRes * 2.0 - 1.0, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FS_MARK = PREC + [
    'varying vec2 vCo; varying vec3 vCol; varying float vFlag; varying float vFade;',
    'uniform float uTime;',
    'void main(){',
    '  float r = length(vCo);',
    '  if (r > 1.0) discard;',
    '  float sel = vFlag > 1.5 ? 1.0 : 0.0;',
    '  float core = 1.0 - smoothstep(0.30, 0.325, r);',
    '  float ring = (1.0 - smoothstep(0.335, 0.36, r)) - core;',
    '  float halo = (1.0 - r) * (1.0 - r) * 0.38 * (1.0 + 0.8 * sel);',
    '  float ph = fract(uTime * 0.7);',
    '  float pr = 0.33 + 0.62 * ph;',
    '  float pulse = sel * (1.0 - smoothstep(0.0, 0.05, abs(r - pr))) * (1.0 - ph) * 0.8;',
    '  vec3 base = mix(vCol, vec3(1.0, 0.957, 0.776), sel);',
    '  float free = clamp(1.0 - core - ring * 0.95, 0.0, 1.0);',
    '  float glowA = min(halo + pulse, 1.0) * free;',
    '  vec3 c = base * core + vec3(1.0, 0.96, 0.88) * ring * 0.95 + vCol * glowA;',
    '  float a = clamp(core + ring * 0.95 + glowA, 0.0, 1.0);',
    '  gl_FragColor = vec4(c * vFade, a * vFade);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader compile');
    return s;
  }
  function program(vs, fs, attrs, uniforms) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    attrs.forEach(function (a, i) { gl.bindAttribLocation(p, i, a); });
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'program link');
    p.u = {};
    uniforms.forEach(function (n) { p.u[n] = gl.getUniformLocation(p, n); });
    return p;
  }

  /* ---------- Natural Earth -> equirectangular mask texture (R = land, G = borders) ---------- */
  function makeTexture(geo, W) {
    var H = W / 2;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var x = c.getContext('2d');
    if (!x) throw new Error('2d canvas unavailable');
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    function X(lo) { return (lo + 180) / 360 * W; }
    function Y(la) { return (90 - la) / 180 * H; }
    /* Longitudes are unwrapped so rings crossing the antimeridian stay continuous; a ring that winds
       around a pole (Antarctica) is closed through the pole so the cap is filled. */
    function trace(ring, off, closeViaPole) {
      if (!ring || ring.length < 2) return;
      var prev = ring[0][0], lo = prev, i, d;
      x.moveTo(X(lo + off), Y(ring[0][1]));
      for (i = 1; i < ring.length; i++) {
        d = ring[i][0] - prev;
        if (d > 180) d -= 360; else if (d < -180) d += 360;
        lo += d; prev = ring[i][0];
        x.lineTo(X(lo + off), Y(ring[i][1]));
      }
      if (closeViaPole && Math.abs(lo - ring[0][0]) > 180) {
        var pole = ring[0][1] < 0 ? -90 : 90;
        x.lineTo(X(lo + off), Y(pole));
        x.lineTo(X(ring[0][0] + off), Y(pole));
      }
    }
    var offs = [-360, 0, 360];
    x.fillStyle = '#f00';
    (geo.land || []).forEach(function (g) {
      var polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      polys.forEach(function (poly) {
        offs.forEach(function (off) {
          x.beginPath();
          poly.forEach(function (ring, ri) { trace(ring, off, ri === 0); x.closePath(); });
          x.fill('evenodd');
        });
      });
    });
    x.globalCompositeOperation = 'lighter';
    x.strokeStyle = '#0f0';
    x.lineWidth = Math.max(1, W / 1500);
    x.lineJoin = 'round';
    (geo.borders || []).forEach(function (g) {
      var lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
      lines.forEach(function (ln) {
        offs.forEach(function (off) { x.beginPath(); trace(ln, off, false); x.stroke(); });
      });
    });
    var t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function buildTexture(geo) {
    var maxT = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
    var t = makeTexture(geo, Math.min(2048, maxT));
    if (tex) gl.deleteTexture(tex);
    tex = t; hasTex = 1; geoBuilt = true; lastSig = ''; dirty = true;
  }
  /* A sharper 4096px map is built once, the first time the camera zooms in close. */
  function ensureHiTexture() {
    if (texHi || hiTried || !geoBuilt) return;
    hiTried = true;
    try {
      var maxT = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
      var lowMem = window.navigator && navigator.deviceMemory && navigator.deviceMemory <= 2;
      var geo = api.getGeography && api.getGeography();
      if (geo && maxT >= 4096 && !lowMem) texHi = makeTexture(geo, 4096);
    } catch (e) { texHi = null; }
  }

  /* ---------- view math ---------- */
  function setV() {
    var la = lat * DEG, lo = lon * DEG, cl = Math.cos(lo), sl = Math.sin(lo), cp = Math.cos(la), sp = Math.sin(la);
    /* rows: [cl,0,-sl], [-sp*sl, cp, -sp*cl], [cp*sl, sp, cp*cl]; stored column-major for GLSL */
    V = [cl, -sp * sl, cp * sl, 0, cp, sp, -sl, -sp * cl, cp * cl];
  }
  function project(la, lo) {
    var a = la * DEG, b = lo * DEG, ca = Math.cos(a);
    var wx = ca * Math.sin(b), wy = Math.sin(a), wz = ca * Math.cos(b);
    return {
      x: L.cx + (V[0] * wx + V[3] * wy + V[6] * wz) * L.R,
      y: L.cy - (V[1] * wx + V[4] * wy + V[7] * wz) * L.R,
      z: V[2] * wx + V[5] * wy + V[8] * wz
    };
  }
  function layout() {
    var rect = wrap.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(200, rect.width), h = Math.max(200, rect.height);
    var cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw; canvas.height = ch; over.width = cw; over.height = ch; lastSig = ''; dirty = true;
    }
    L.w = w; L.h = h; L.dpr = dpr; L.cx = w * 0.5; L.cy = h * 0.5;
    L.R = Math.min(w * 0.40, h * 0.41) * zoomNow;
  }

  /* ---------- story markers ---------- */
  function syncMarkers() {
    var pts = api.getPoints() || [], sel = api.getSelected();
    if (!mk.dirty && pts.length === mk.len && sel === mk.sel) return;
    var order = [], i, si = sel ? pts.indexOf(sel) : -1;
    for (i = 0; i < pts.length && order.length < MAX_POINTS - 2; i++) if (i !== hover && i !== si) order.push(i);
    if (hover >= 0 && hover < pts.length && hover !== si) order.push(hover);
    if (si >= 0) order.push(si);
    var f = new Float32Array(order.length * 4 * 8), k = 0, c, p, col, flag, j;
    var corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]], groups = {}, gl_ = [];
    for (i = 0; i < order.length; i++) {
      p = pts[order[i]];
      col = rgbOf(api.sectionColor(p.story && p.story.section));
      flag = order[i] === si ? 2 : (order[i] === hover ? 1 : 0);
      for (j = 0; j < 4; j++) {
        f[k++] = p.lat * DEG; f[k++] = p.lng * DEG;
        f[k++] = corners[j][0]; f[k++] = corners[j][1];
        f[k++] = col[0]; f[k++] = col[1]; f[k++] = col[2];
        f[k++] = flag;
      }
      var key = p.lat.toFixed(2) + ',' + p.lng.toFixed(2);
      if (!groups[key]) { groups[key] = { lat: p.lat, lng: p.lng, n: 0 }; gl_.push(groups[key]); }
      groups[key].n++;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, bufMk);
    gl.bufferData(gl.ARRAY_BUFFER, f, gl.DYNAMIC_DRAW);
    mk.count = order.length; mk.len = pts.length; mk.sel = sel; mk.dirty = false;
    mk.groups = gl_.filter(function (g) { return g.n > 1; });
    lastSig = '';
  }
  function pointsSig() {
    var pts = api.getPoints() || [];
    return pts.length + ':' + pts.map(function (p) { return api.sectionColor(p.story && p.story.section); }).join(',');
  }

  /* ---------- picking ---------- */
  function candidates(x, y, radius) {
    var pts = api.getPoints() || [], out = [], i, q, d;
    for (i = 0; i < pts.length; i++) {
      q = project(pts[i].lat, pts[i].lng);
      if (q.z < 0.05) continue;
      d = Math.hypot(q.x - x, q.y - y);
      if (d <= radius) out.push({ i: i, d: d });
    }
    return out;
  }
  function pickAt(x, y, touch) {
    var list = candidates(x, y, touch ? 20 : 12);
    if (!list.length) return -1;
    var sel = api.getSelected(), pts = api.getPoints(), selI = sel ? pts.indexOf(sel) : -1;
    var byIndex = list.slice().sort(function (a, b) { return a.i - b.i; }), k;
    for (k = 0; k < byIndex.length; k++) if (byIndex[k].i === selI) break;
    /* several stories on the same spot: each tap moves to the next one */
    if (k < byIndex.length && byIndex.length > 1) return byIndex[(k + 1) % byIndex.length].i;
    list.sort(function (a, b) { return a.d - b.d; });
    return list[0].i;
  }
  function selectIndex(i) {
    var pts = api.getPoints();
    if (pts && pts[i]) api.select(pts[i]);
  }

  /* ---------- camera ---------- */
  function flyTo(la, lo) {
    var d = ((lo - lon + 540) % 360) - 180;
    var dur = reduced() ? 0 : 700 + Math.min(700, Math.abs(d) * 4);
    fly = { t0: nowMs(), dur: dur, l0: lon, a0: lat, dl: d, da: clamp(la, -MAX_LAT, MAX_LAT) - lat };
    vLon = vLat = 0;
    kick();
  }
  function resetView() { arriveT = 0; flyTo(HOME_LAT, HOME_LON); autoPauseUntil = nowMs() + 4500; }
  function rotateBy(dx, dy) {
    var k = 57.2958 / Math.max(80, L.R);
    lon -= dx * k; lat = clamp(lat + dy * k, -MAX_LAT, MAX_LAT);
    if (lon > 180) lon -= 360; if (lon < -180) lon += 360;
  }

  function onApiRedraw() {
    if (dead) return;
    try {
      if (!geoBuilt && api.getGeography && api.getGeography()) buildTexture(api.getGeography());
      var al = oldCanvas.getAttribute('aria-label');
      if (al && canvas.getAttribute('aria-label') !== al) canvas.setAttribute('aria-label', al);
      var s = pointsSig();
      if (s !== mk.sig) { mk.sig = s; mk.dirty = true; }
      var sel = api.getSelected();
      if (sel !== lastSel) {
        lastSel = sel; arriveT = 0;
        if (sel) { flyTo(sel.lat, sel.lng); if (zoomT < SEL_Z) setZoomGL(SEL_Z); }
      }
    } catch (e) { fail('redraw hook: ' + (e && e.message)); return; }
    lastSig = '';
    kick();
  }

  /* ---------- frame loop ---------- */
  function wantLoop() {
    if (dead || !ready || !inView || !pageVisible) return false;
    if (!reduced()) return true;
    return dirty || !!fly || drag || Math.abs(vLon) > 0.05 || Math.abs(vLat) > 0.05 || Math.abs(zoomNow - zoomT) > 0.002;
  }
  function kick() {
    dirty = true;
    if (!raf && !dead && inView && pageVisible) raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    raf = 0;
    if (dead) return;
    var dt = lastT ? Math.min(0.05, Math.max(0.001, (now - lastT) / 1000)) : 0.016;
    lastT = now;
    if (reduced()) zoomNow = zoomT;
    else zoomNow = Math.exp(Math.log(zoomNow) + (Math.log(zoomT) - Math.log(zoomNow)) * Math.min(1, dt * 6));
    if (Math.abs(zoomNow - zoomT) < 0.0005 * zoomT) zoomNow = zoomT;
    if (fly) {
      var kk = fly.dur > 0 ? Math.min(1, (nowMs() - fly.t0) / fly.dur) : 1;
      var e = kk < 0.5 ? 4 * kk * kk * kk : 1 - Math.pow(-2 * kk + 2, 3) / 2;
      lon = fly.l0 + fly.dl * e; lat = fly.a0 + fly.da * e;
      if (lon > 180) lon -= 360; if (lon < -180) lon += 360;
      if (kk >= 1) fly = null;
    } else if (!drag) {
      if (vLon || vLat) {
        lon += vLon * dt; lat = clamp(lat + vLat * dt, -MAX_LAT, MAX_LAT);
        if (lon > 180) lon -= 360; if (lon < -180) lon += 360;
        var decay = Math.exp(-dt * 3.2);
        vLon *= decay; vLat *= decay;
        if (Math.abs(vLon) < 0.4) vLon = 0;
        if (Math.abs(vLat) < 0.4) vLat = 0;
      } else if (!reduced() && !api.getSelected() && nowMs() > autoPauseUntil) {
        lon -= 2 * dt;
        if (lon < -180) lon += 360;
      }
    }
    if (!reduced()) timeAcc += dt;
    try { render(); } catch (err) { fail('render: ' + (err && err.message)); return; }
    dirty = false;
    if (wantLoop()) raf = requestAnimationFrame(frame); else lastT = 0;
  }

  function render() {
    layout(); setV(); syncMarkers();
    if (zoomNow > 2.2) ensureHiTexture();
    var W = canvas.width, H = canvas.height, d = L.dpr;
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    var cx = L.cx * d, cy = H - L.cy * d, rad = L.R * d, i;

    gl.useProgram(progG);
    gl.uniform2f(progG.u.uRes, W, H);
    gl.uniform2f(progG.u.uC, cx, cy);
    gl.uniform1f(progG.u.uRad, rad);
    gl.uniformMatrix3fv(progG.u.uV, false, new Float32Array(V));
    gl.uniform1f(progG.u.uHas, hasTex);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, (zoomNow > 2.2 && texHi) ? texHi : (tex || texBlank));
    gl.uniform1i(progG.u.uTex, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufQuad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (mk.count) {
      gl.useProgram(progM);
      gl.uniform2f(progM.u.uRes, W, H);
      gl.uniform2f(progM.u.uC, cx, cy);
      gl.uniform1f(progM.u.uRad, rad);
      gl.uniform1f(progM.u.uSize, 4 * d);
      gl.uniform1f(progM.u.uTime, timeAcc);
      gl.uniformMatrix3fv(progM.u.uV, false, new Float32Array(V));
      gl.bindBuffer(gl.ARRAY_BUFFER, bufMk);
      var sizes = [2, 2, 3, 1], off = 0;
      for (i = 0; i < 4; i++) {
        gl.enableVertexAttribArray(i);
        gl.vertexAttribPointer(i, sizes[i], gl.FLOAT, false, 32, off * 4);
        off += sizes[i];
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufIdx);
      gl.drawElements(gl.TRIANGLES, mk.count * 6, gl.UNSIGNED_SHORT, 0);
      for (i = 1; i < 4; i++) gl.disableVertexAttribArray(i);
    }
    drawOverlay();
  }

  /* ---------- 2D overlay: city dots and labels, story pin + name card, orbit accents ---------- */
  function getPhoto(url) {
    url = String(url || '');
    if (!url || /^\s*javascript:/i.test(url)) return null;
    var e = photos[url];
    if (!e) {
      e = photos[url] = { ok: false, img: new Image() };
      e.img.onload = function () { e.ok = true; lastSig = ''; kick(); };
      e.img.onerror = function () { e.ok = false; };
      e.img.src = url;
    }
    return e.ok ? e : null;
  }
  function easeBack(x) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }
  /* The name card: bottom-center sits at (x, ay); it pops open from that point. */
  function pill(text, x, ay, color, prog, photo) {
    octx.save();
    octx.font = '600 12px Cairo, Tahoma, sans-serif';
    var ph = photo ? 34 : 0, h = photo ? 44 : 24;
    var tw = Math.min(190, octx.measureText(text).width);
    var w = tw + 18 + (photo ? ph + 6 : 0);
    var px = clamp(x - w / 2, 4, L.w - w - 4), py = clamp(ay - h, 4, L.h - h - 4);
    var s = prog >= 1 ? 1 : Math.max(0, easeBack(prog));
    octx.translate(x, ay); octx.scale(s, s); octx.translate(-x, -ay);
    octx.globalAlpha = clamp(prog * 2, 0, 1);
    octx.beginPath();
    if (octx.roundRect) octx.roundRect(px, py, w, h, photo ? 16 : 12); else octx.rect(px, py, w, h);
    octx.fillStyle = 'rgba(5,14,29,.9)'; octx.fill();
    octx.strokeStyle = color; octx.lineWidth = 1; octx.stroke();
    var tx = px + 9 + tw / 2;
    if (photo) {
      var pcx = px + 8 + ph / 2, pcy = py + h / 2, im = photo.img;
      var iw = im.naturalWidth || ph, ih = im.naturalHeight || ph, sq = Math.min(iw, ih);
      octx.save();
      octx.beginPath(); octx.arc(pcx, pcy, ph / 2, 0, PI * 2); octx.clip();
      try { octx.drawImage(im, (iw - sq) / 2, (ih - sq) / 2, sq, sq, pcx - ph / 2, pcy - ph / 2, ph, ph); } catch (e) {}
      octx.restore();
      octx.beginPath(); octx.arc(pcx, pcy, ph / 2, 0, PI * 2);
      octx.strokeStyle = color; octx.lineWidth = 1.5; octx.stroke();
      tx = px + 8 + ph + 6 + tw / 2 + 2;
    }
    octx.fillStyle = '#fff4dc'; octx.textAlign = 'center'; octx.textBaseline = 'middle';
    octx.fillText(text, tx, py + h / 2 + 0.5, tw);
    octx.restore();
  }
  /* Location pin: a circle on a downward point (its tip is the exact spot), glowing and fading. */
  function pin(x, y, color, pulse) {
    var r = 10, d = 26, th = Math.acos(r / d), hx = x, hy = y - d;
    octx.save();
    octx.beginPath(); octx.ellipse(x, y, 8 + 12 * pulse, 3 + 4 * pulse, 0, 0, PI * 2);
    octx.globalAlpha = 0.7 * (1 - pulse); octx.strokeStyle = color; octx.lineWidth = 1.5; octx.stroke();
    octx.globalAlpha = 1;
    octx.shadowColor = color; octx.shadowBlur = 6 + 18 * pulse;
    octx.beginPath();
    octx.moveTo(x, y);
    octx.arc(hx, hy, r, PI / 2 - th, PI / 2 + th, true);
    octx.closePath();
    octx.fillStyle = color; octx.fill();
    octx.shadowBlur = 0;
    octx.lineWidth = 1.5; octx.strokeStyle = 'rgba(255,248,230,.95)'; octx.stroke();
    octx.beginPath(); octx.arc(hx, hy, 3.6, 0, PI * 2);
    octx.fillStyle = 'rgba(255,255,255,' + (0.55 + 0.45 * pulse).toFixed(2) + ')'; octx.fill();
    octx.restore();
  }
  function drawOverlay() {
    var geo = api.getGeography && api.getGeography(), sel = api.getSelected(), pts = api.getPoints() || [];
    var selI = sel ? pts.indexOf(sel) : -1;
    var tNow = nowMs();
    if (selI >= 0) {
      if (!fly && !arriveT && Math.abs(zoomNow - zoomT) <= 0.04 * zoomT) arriveT = tNow;
    } else arriveT = 0;
    var prog = (selI >= 0 && arriveT) ? (reduced() ? 1 : clamp((tNow - arriveT) / 420, 0, 1)) : 0;
    var pulse = selI >= 0 ? 0.5 + 0.5 * Math.sin(timeAcc * 3.4) : 0;
    var sig = [lon.toFixed(2), lat.toFixed(2), L.R.toFixed(1), L.w, L.h, hover, mk.count, lang(), geo ? 1 : 0, selI, prog.toFixed(2), pulse.toFixed(2)].join('|');
    if (sig === lastSig) return;
    lastSig = sig;
    octx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    octx.clearRect(0, 0, L.w, L.h);
    var cx = L.cx, cy = L.cy, R = L.R, i, q;
    octx.direction = document.documentElement.dir || 'rtl';
    if (zoomNow < 2.5) {
      octx.beginPath(); octx.arc(cx, cy, R + 1, 0, PI * 2);
      octx.strokeStyle = 'rgba(240,200,120,.45)'; octx.lineWidth = 1; octx.stroke();
      octx.beginPath(); octx.ellipse(cx, cy, R * 1.18, R * 0.2, -0.35, 0, PI * 2);
      octx.strokeStyle = 'rgba(240,200,120,.28)'; octx.stroke();
      octx.beginPath(); octx.ellipse(cx, cy, R * 1.11, R * 0.16, -0.35, 0, PI * 2);
      octx.strokeStyle = 'rgba(240,200,120,.14)'; octx.stroke();
    }

    if (geo && Array.isArray(geo.cities)) {
      var close = zoomNow > 3, grow = 1 + Math.min(1.5, (zoomNow - 1) * 0.2);
      octx.font = (close ? '11px' : '10px') + ' Cairo, Tahoma, sans-serif';
      octx.textAlign = 'left'; octx.textBaseline = 'middle';
      geo.cities.forEach(function (city) {
        var c = project(city.lat, city.lng);
        if (c.z <= 0.04) return;
        if (c.x < -20 || c.x > L.w + 20 || c.y < -20 || c.y > L.h + 20) return;
        octx.beginPath();
        octx.arc(c.x, c.y, (city.population >= 5000000 ? 1.7 : 1.1) * grow, 0, PI * 2);
        octx.fillStyle = 'rgba(230,241,238,' + (0.72 * clamp(c.z * 4, 0, 1)).toFixed(2) + ')';
        octx.fill();
        if ((city.label || close) && R > 150 && c.z > 0.32) {
          var txt = api.cityLabel ? api.cityLabel(city.name) : '';
          if (txt) { octx.fillStyle = 'rgba(238,246,243,.88)'; octx.fillText(txt, c.x + 4 + grow, c.y - 4, 72); }
        }
      });
    }
    mk.groups.forEach(function (g) {
      var c = project(g.lat, g.lng);
      if (c.z < 0.25) return;
      octx.beginPath(); octx.arc(c.x + 9, c.y - 9, 7, 0, PI * 2);
      octx.fillStyle = '#07151f'; octx.fill();
      octx.strokeStyle = 'rgba(240,200,120,.9)'; octx.lineWidth = 1; octx.stroke();
      octx.fillStyle = '#f6dca8'; octx.font = '700 9px Cairo, Tahoma, sans-serif';
      octx.textAlign = 'center'; octx.textBaseline = 'middle';
      octx.fillText(String(g.n), c.x + 9, c.y - 8.5);
    });
    var labelFor = function (idx, selected) {
      if (idx < 0 || !pts[idx]) return;
      q = project(pts[idx].lat, pts[idx].lng);
      if (q.z < 0.1) return;
      var col = api.sectionColor(pts[idx].story && pts[idx].story.section), t = nameOf(pts[idx]);
      if (selected) {
        pin(q.x, q.y, col, pulse);
        if (t && prog > 0) pill(t, q.x, q.y - 44, col, prog, getPhoto(pts[idx].photo));
      } else if (t) pill(t, q.x, q.y - 10, col, 1, getPhoto(pts[idx].photo));
    };
    if (hover >= 0 && hover !== selI) labelFor(hover, false);
    labelFor(selI, true);
  }

  /* ---------- input ---------- */
  function localXY(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function pinchDist() {
    var ids = Object.keys(pointers);
    if (ids.length < 2) return 0;
    var a = pointers[ids[0]], b = pointers[ids[1]];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  function bindInput() {
    on(canvas, 'pointerdown', function (e) {
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      if (Object.keys(pointers).length === 2) {
        pinch = { d: pinchDist() || 1, z: zoomT }; drag = false;
      } else {
        drag = true; startX = lastX = e.clientX; startY = lastY = e.clientY; moveT = nowMs();
        vLon = vLat = 0; fly = null;
      }
      autoPauseUntil = nowMs() + 4500;
      canvas.classList.add('is-dragging');
      kick();
    });
    on(canvas, 'pointermove', function (e) {
      if (pointers[e.pointerId]) { pointers[e.pointerId].x = e.clientX; pointers[e.pointerId].y = e.clientY; }
      if (pinch && Object.keys(pointers).length >= 2) {
        setZoomGL(pinch.z * pinchDist() / pinch.d);
        return;
      }
      if (drag) {
        var dx = e.clientX - lastX, dy = e.clientY - lastY, t = nowMs(), dtm = Math.max(8, t - moveT);
        var k = 57.2958 / Math.max(80, L.R);
        rotateBy(dx, dy);
        vLon = clamp(vLon * 0.5 + (-dx * k / (dtm / 1000)) * 0.5, -240, 240);
        vLat = clamp(vLat * 0.5 + (dy * k / (dtm / 1000)) * 0.5, -240, 240);
        lastX = e.clientX; lastY = e.clientY; moveT = t;
        kick();
      } else if (e.pointerType === 'mouse') {
        var p = localXY(e), c = candidates(p.x, p.y, 12), h = -1;
        if (c.length) { c.sort(function (a, b) { return a.d - b.d; }); h = c[0].i; }
        if (h !== hover) { hover = h; mk.dirty = true; canvas.style.cursor = h >= 0 ? 'pointer' : ''; kick(); }
      }
    });
    function end(e) {
      var wasDrag = drag, moved = Math.hypot(e.clientX - startX, e.clientY - startY);
      delete pointers[e.pointerId];
      if (Object.keys(pointers).length < 2) pinch = null;
      if (!Object.keys(pointers).length) { drag = false; canvas.classList.remove('is-dragging'); }
      if (nowMs() - moveT > 90) vLon = vLat = 0;
      if (e.type === 'pointerup' && wasDrag && moved < 7) {
        vLon = vLat = 0;
        var p = localXY(e), idx = pickAt(p.x, p.y, e.pointerType !== 'mouse');
        if (idx >= 0) selectIndex(idx);
      }
      kick();
    }
    on(canvas, 'pointerup', end);
    on(canvas, 'pointercancel', end);
    on(canvas, 'pointerleave', function (e) {
      if (e.pointerType === 'mouse' && hover !== -1) { hover = -1; mk.dirty = true; canvas.style.cursor = ''; kick(); }
    });
    on(canvas, 'wheel', function (e) {
      e.preventDefault();
      setZoomGL(zoomT * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
    }, { passive: false });
    on(canvas, 'keydown', function (e) {
      var handled = true;
      autoPauseUntil = nowMs() + 4500; fly = null;
      if (e.key === 'ArrowLeft') lon -= 8;
      else if (e.key === 'ArrowRight') lon += 8;
      else if (e.key === 'ArrowUp') lat = clamp(lat + 6, -MAX_LAT, MAX_LAT);
      else if (e.key === 'ArrowDown') lat = clamp(lat - 6, -MAX_LAT, MAX_LAT);
      else if (e.key === '+' || e.key === '=') setZoomGL(zoomT * 1.25);
      else if (e.key === '-') setZoomGL(zoomT / 1.25);
      else if (e.key === 'Enter' || e.key === ' ') {
        var pts = api.getPoints() || [], best = -1, bz = 0.2, i, q;
        for (i = 0; i < pts.length; i++) { q = project(pts[i].lat, pts[i].lng); if (q.z > bz) { bz = q.z; best = i; } }
        if (best >= 0) selectIndex(best);
      } else handled = false;
      if (handled) { e.preventDefault(); if (lon > 180) lon -= 360; if (lon < -180) lon += 360; kick(); }
    });
    /* The side zoom buttons: take them over (capture phase) so they can reach 10x. */
    var ctrl = stage.querySelector('.kh-world-zoom-controls');
    if (ctrl) {
      zBtn = {
        inn: ctrl.querySelector('[data-world-zoom="in"]'),
        out: ctrl.querySelector('[data-world-zoom="out"]'),
        reset: ctrl.querySelector('[data-world-zoom="reset"]')
      };
      on(ctrl, 'click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('button[data-world-zoom]') : null;
        if (!b) return;
        e.stopPropagation();
        var k = b.dataset.worldZoom;
        if (k === 'in') setZoomGL(zoomT * 1.5);
        else if (k === 'out') setZoomGL(zoomT / 1.5);
        else { setZoomGL(1); resetView(); }
      }, true);
    }
  }

  /* ---------- start ---------- */
  function start() {
    api = window._khWorldApi;
    stage = api.stage; oldCanvas = api.canvas;
    try {
      canvas = document.createElement('canvas'); canvas.className = 'kh-gl-main';
      over = document.createElement('canvas'); over.className = 'kh-gl-over';
      octx = over.getContext('2d');
      if (!octx) throw new Error('2d overlay unavailable');
      var opts = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false };
      gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
      if (!gl) throw new Error('WebGL not supported');
      on(canvas, 'webglcontextlost', function (e) { e.preventDefault(); fail('context lost'); });

      progG = program(VS_GLOBE, FS_GLOBE, ['aPos'], ['uRes', 'uC', 'uRad', 'uV', 'uTex', 'uHas']);
      progM = program(VS_MARK, FS_MARK, ['aLL', 'aCo', 'aCol', 'aFlag'], ['uV', 'uRes', 'uC', 'uRad', 'uSize', 'uTime']);
      bufQuad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, bufQuad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      bufMk = gl.createBuffer();
      bufIdx = gl.createBuffer();
      var idx = new Uint16Array(MAX_POINTS * 6), n;
      for (n = 0; n < MAX_POINTS; n++) idx.set([n * 4, n * 4 + 1, n * 4 + 2, n * 4, n * 4 + 2, n * 4 + 3], n * 6);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufIdx);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      texBlank = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texBlank);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      styleEl = document.createElement('style');
      styleEl.id = 'khGlobeGLStyle';
      styleEl.textContent = CSS;
      document.head.appendChild(styleEl);

      wrap = document.createElement('div');
      wrap.className = 'kh-world-gl';
      canvas.tabIndex = 0;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', oldCanvas.getAttribute('aria-label') || '');
      wrap.appendChild(canvas); wrap.appendChild(over);
      stage.insertBefore(wrap, oldCanvas);
      stage.classList.add('is-three');

      bindInput();
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (en) {
          inView = !!(en[0] && en[0].isIntersecting);
          if (inView) kick();
        }, { threshold: 0.01 });
        io.observe(stage); observers.push(io);
      }
      if ('ResizeObserver' in window) {
        var ro = new ResizeObserver(function () { lastSig = ''; kick(); });
        ro.observe(wrap); observers.push(ro);
      } else on(window, 'resize', function () { lastSig = ''; kick(); });
      var mo = new MutationObserver(function () { lastSig = ''; mk.dirty = true; kick(); });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir'] });
      observers.push(mo);
      on(document, 'visibilitychange', function () { pageVisible = !document.hidden; if (pageVisible) kick(); });
      on(window, 'pagehide', function (e) {
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        if (!e.persisted) { try { var x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (_) {} }
      });
      on(window, 'pageshow', function (e) { if (e.persisted) kick(); });

      api.onRedraw(onApiRedraw);
      api.onReset(resetView);
      ready = true;
      if (api.getGeography && api.getGeography()) buildTexture(api.getGeography());
      mk.sig = pointsSig();
      lastSel = api.getSelected();
      zoomT = 1; zoomNow = 1;
      render();
      var err = gl.getError();
      if (err !== gl.NO_ERROR && err !== gl.CONTEXT_LOST_WEBGL) throw new Error('GL error ' + err);
      window._khUseThree = true;
      api.setZoom(api.getZoom());
      updateZoomButtons();
      kick();
    } catch (e) {
      fail((e && e.message) || 'init');
    }
  }

  var tries = 0;
  function boot() {
    if (dead) return;
    if (window._khWorldApi && window._khWorldApi.stage && window._khWorldApi.canvas) { start(); return; }
    if (++tries < 60) setTimeout(boot, 100);
    else if (window.console) console.warn('[khaledoon] _khWorldApi not found; WebGL globe skipped.');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
