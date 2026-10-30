/* خالدون عبر التاريخ — طبقة الخريطة الحقيقية تحت الكرة ثلاثية الأبعاد.
   عند وصول زوم الكرة إلى 10x (حدث kh:globe-maxzoom من khaledoon-world-gl.js) تظهر من تحتها خريطة Leaflet حقيقية
   بأسماء الدول والمحافظات، في نفس المكان وبنفس مستوى التقريب (يُحسب من نصف قطر الكرة)، بينما يتلاشى سطح الكرة بتأثير
   سحاب وتوهج. التصغير على الخريطة، أو زر الرجوع، أو النقر على الدبوس المفتوح مرة ثانية يعيد الكرة.
   لا يغيّر البيانات ولا Supabase. Leaflet يُحمَّل من cdnjs عند الحاجة فقط؛ لو تعذّر التحميل تبقى الكرة كما هي. */
(function () {
  'use strict';
  if (window.__khGlMapLayer) return;
  window.__khGlMapLayer = true;

  var CDN = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
  var EXTRA_ZOOM = 1.7;      /* بعد التسليم نقترب قليلًا حتى تظهر أسماء المحافظات */
  var EXIT_MARGIN = 0.35;    /* التصغير بأكثر من هذا الفرق عن مستوى التسليم يعيد الكرة */
  var LANGS = ['ar', 'en', 'fr', 'it', 'de'];
  var TXT = {
    back: { ar: 'رجوع للكرة', en: 'Back to globe', fr: 'Retour au globe', it: 'Torna al globo', de: 'Zurück zum Globus' },
    open: { ar: 'افتح الحكاية', en: 'Open the story', fr: 'Ouvrir l’histoire', it: 'Apri la storia', de: 'Geschichte öffnen' }
  };
  var map = null, tiles = null, wrap = null, mapEl = null, haze = null, backBtn = null;
  var open = false, busy = false, zMatch = 0, base = null, active = null, markers = [], timers = [], loader = null;

  function lang() { var l = (document.documentElement.lang || 'ar').slice(0, 2).toLowerCase(); return LANGS.indexOf(l) >= 0 ? l : 'ar'; }
  function reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function later(fn, ms) { timers.push(window.setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(window.clearTimeout); timers = []; }
  function api() { return window._khWorldApi; }
  function gl() { return window._khGL; }

  var CSS = [
    '.kh-gl-map{position:absolute;inset:0;z-index:1;opacity:0;visibility:hidden;pointer-events:none;overflow:hidden;border-radius:18px;background:#0a2230}',
    '.kh-world-gl.kh-gl-hasmap .kh-gl-map{visibility:visible;opacity:1}',
    '.kh-world-gl.kh-gl-hasmap .kh-gl-main{z-index:2}.kh-world-gl.kh-gl-hasmap .kh-gl-over{z-index:3}',
    '.kh-world-gl.kh-gl-hasmap canvas{transition:opacity 1.25s ease,filter 1.25s ease,transform 1.25s ease}',
    '.kh-world-gl canvas.kh-gl-away{opacity:0;filter:blur(6px) brightness(1.7);transform:scale(1.09)}',
    '.kh-world-gl canvas.kh-gl-gone{visibility:hidden}',
    '.kh-world-gl.kh-gl-maplive .kh-gl-map{z-index:6;pointer-events:auto}',
    '[data-theme="dark"] .kh-gl-map .leaflet-tile-pane{filter:brightness(.82) contrast(1.05) saturate(.92)}',
    '.kh-gl-haze{position:absolute;inset:-12%;z-index:4;pointer-events:none;opacity:0}',
    '.kh-gl-haze i{position:absolute;border-radius:50%;filter:blur(30px);background:radial-gradient(circle,rgba(236,248,255,.95),rgba(150,205,230,.55) 55%,transparent 72%)}',
    '.kh-gl-haze i:nth-child(1){left:6%;top:18%;width:58%;height:46%}',
    '.kh-gl-haze i:nth-child(2){right:2%;top:40%;width:62%;height:50%}',
    '.kh-gl-haze i:nth-child(3){left:24%;top:2%;width:50%;height:40%;background:radial-gradient(circle,rgba(255,236,190,.8),rgba(240,200,120,.4) 55%,transparent 72%)}',
    '.kh-gl-haze.is-on{animation:khHaze 1.9s ease both}.kh-gl-haze.is-on i:nth-child(1){animation:khCloudA 1.9s ease-in-out both}',
    '.kh-gl-haze.is-on i:nth-child(2){animation:khCloudB 1.9s ease-in-out both}',
    '@keyframes khHaze{0%{opacity:0}35%{opacity:.95}70%{opacity:.8}100%{opacity:0}}',
    '@keyframes khCloudA{from{transform:translate(-12%,6%) scale(.8)}to{transform:translate(14%,-8%) scale(1.25)}}',
    '@keyframes khCloudB{from{transform:translate(12%,-4%) scale(.85)}to{transform:translate(-14%,8%) scale(1.3)}}',
    '.kh-gl-mapback{position:absolute;top:10px;inset-inline-end:10px;z-index:8;display:none;cursor:pointer;border:1px solid rgba(240,200,120,.65);',
    'background:rgba(6,24,38,.9);color:#f0c878;border-radius:999px;padding:7px 14px;font:700 .8rem Cairo,Tahoma,sans-serif}',
    '.kh-world-gl.kh-gl-maplive .kh-gl-mapback{display:block}',
    '.kh-gl-mapback:hover,.kh-gl-mapback:focus-visible{background:#f0c878;color:#061826;outline:none}',
    '.kh-gl-card{min-width:150px;max-width:220px;line-height:1.5;font-family:Cairo,Tahoma,sans-serif}',
    '.kh-gl-card strong{display:block;font-size:14px}.kh-gl-card small{display:block;font-size:11px;opacity:.75;margin:1px 0 6px}',
    '.kh-gl-card a{font-weight:700;font-size:12px}',
    '@media(prefers-reduced-motion:reduce){.kh-gl-haze,.kh-world-gl.kh-gl-hasmap canvas{transition:none!important;animation:none!important}.kh-gl-haze.is-on,.kh-gl-haze.is-on i{animation:none!important}}'
  ].join('');

  function addStyle() {
    if (document.getElementById('kh-gl-map-style')) return;
    var st = document.createElement('style'); st.id = 'kh-gl-map-style'; st.textContent = CSS; document.head.appendChild(st);
  }

  function loadLeaflet() {
    if (window.L && window.L.map) return Promise.resolve();
    if (loader) return loader;
    loader = new Promise(function (res, rej) {
      var k = document.createElement('link'); k.rel = 'stylesheet'; k.href = CDN + 'leaflet.min.css'; document.head.appendChild(k);
      var s = document.createElement('script'); s.src = CDN + 'leaflet.min.js'; s.async = true;
      s.onload = function () { window.L && window.L.map ? res() : rej(new Error('leaflet')); };
      s.onerror = function () { loader = null; rej(new Error('leaflet load')); };
      document.head.appendChild(s);
    });
    return loader;
  }

  function nameOf(p) {
    var s = (p && p.story) || {}, l = lang(), i = s.i18n && s.i18n[l];
    return (i && (i.person || i.title)) || s.person || s.title || '';
  }
  function placeOf(p) {
    var l = lang(), v = p && p.place, lb = p && p.place_label;
    var a = typeof v === 'string' ? v : (v && (v[l] || v.ar)) || '';
    var b = typeof lb === 'string' ? lb : (lb && (lb[l] || lb.ar)) || '';
    return a ? (String(b || '') + a).trim() : '';
  }
  function hrefOf(s) {
    var path = String(s && s.path || '');
    if (/^stories\/[a-z0-9-]+\/[0-9]{3}\/$/.test(path)) return path;
    var sec = String(s && s.section || ''), id = String(s && s.id || '');
    while (id.length < 3) id = '0' + id;
    return /^[a-z0-9-]+$/.test(sec) && /^\d{3}$/.test(id) ? 'stories/' + sec + '/' + id + '/' : '';
  }
  function card(p) {
    var d = document.createElement('div'); d.className = 'kh-gl-card';
    var n = document.createElement('strong'); n.textContent = nameOf(p); d.appendChild(n);
    var pl = placeOf(p); if (pl) { var sm = document.createElement('small'); sm.textContent = pl; d.appendChild(sm); }
    var h = hrefOf(p.story);
    if (h) { var a = document.createElement('a'); a.href = h; a.textContent = TXT.open[lang()]; d.appendChild(a); }
    return d;
  }

  function ensureDom() {
    if (mapEl) return true;
    wrap = gl() && gl().wrap && gl().wrap();
    if (!wrap) return false;
    addStyle();
    mapEl = document.createElement('div'); mapEl.className = 'kh-gl-map'; wrap.insertBefore(mapEl, wrap.firstChild);
    haze = document.createElement('div'); haze.className = 'kh-gl-haze'; haze.setAttribute('aria-hidden', 'true');
    haze.appendChild(document.createElement('i')); haze.appendChild(document.createElement('i')); haze.appendChild(document.createElement('i'));
    wrap.appendChild(haze);
    backBtn = document.createElement('button'); backBtn.type = 'button'; backBtn.className = 'kh-gl-mapback'; backBtn.textContent = TXT.back[lang()];
    backBtn.addEventListener('click', function () { exit(false); });
    wrap.appendChild(backBtn);
    new MutationObserver(function () { if (backBtn) backBtn.textContent = TXT.back[lang()]; }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return true;
  }

  function createMap() {
    var L = window.L;
    map = L.map(mapEl, { zoomControl: false, zoomSnap: 0, zoomDelta: 0.5, minZoom: 2, maxZoom: 18, worldCopyJump: true, tap: false });
    tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>' }).addTo(map);
    var pts = (api() && api().getPoints && api().getPoints()) || [];
    pts.forEach(function (p) {
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return;
      var color = api().sectionColor(p.story && p.story.section);
      var m = L.circleMarker([p.lat, p.lng], { radius: 8, color: '#fff4dc', weight: 2, fillColor: color, fillOpacity: 1 }).addTo(map);
      m.on('click', function () { onMarker(m, p); });
      markers.push({ m: m, p: p });
    });
    map.on('zoomend', function () {
      if (open && !busy && zMatch && map.getZoom() < zMatch - EXIT_MARGIN) exit(false);
    });
  }

  function openCard(m, p) {
    active = m;
    L_popup(m.getLatLng(), p);
  }
  function L_popup(latlng, p) {
    window.L.popup({ closeButton: false, offset: [0, -6], autoPan: true }).setLatLng(latlng).setContent(card(p)).openOn(map);
  }
  /* نقرة على دبوس مفتوح مرة ثانية = رجوع للكرة في وضعها الأساسي (زوم أوت) */
  function onMarker(m, p) {
    if (!open || busy) return;
    if (active === m) { exit(true); return; }
    openCard(m, p);
  }

  function setAway(on) {
    var cs = wrap.querySelectorAll('canvas');
    for (var i = 0; i < cs.length; i++) { cs[i].classList[on ? 'add' : 'remove']('kh-gl-away'); }
  }
  function setGone(on) {
    var cs = wrap.querySelectorAll('canvas');
    for (var i = 0; i < cs.length; i++) { cs[i].classList[on ? 'add' : 'remove']('kh-gl-gone'); }
  }
  function pulseHaze() {
    if (reduced()) return;
    haze.classList.remove('is-on'); void haze.offsetWidth; haze.classList.add('is-on');
  }

  /* نصف قطر الكرة R (بكسل/راديان) يساوي مقياس ميركاتور المحلي: 256·2^Z / (2π·cosφ) */
  function zoomFor(R, lat) {
    var c = Math.max(0.2, Math.cos(lat * Math.PI / 180));
    return Math.max(2, Math.min(17, Math.log(2 * Math.PI * R * c / 256) / Math.LN2));
  }
  function radiusFor(Z, lat) {
    return 256 * Math.pow(2, Z) / (2 * Math.PI * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
  }

  function enter(d) {
    if (open || busy) return;
    busy = true; clearTimers();
    if (!ensureDom()) { busy = false; return; }
    loadLeaflet().then(function () {
      if (!map) createMap();
      base = d; zMatch = zoomFor(d.R, d.lat);
      wrap.classList.add('kh-gl-hasmap');
      map.invalidateSize(false);
      map.setView([d.lat, d.lon], zMatch, { animate: false });
      var started = false;
      function go() {
        if (started) return; started = true;
        pulseHaze(); setAway(true);
        var target = zMatch + EXTRA_ZOOM;
        if (reduced()) map.setView([d.lat, d.lon], target, { animate: false });
        else later(function () { map.flyTo([d.lat, d.lon], target, { duration: 1.7, easeLinearity: 0.3 }); }, 350);
        later(function () {
          setGone(true); wrap.classList.add('kh-gl-maplive');
          var inn = document.querySelector('#khWorld [data-world-zoom="in"]'); if (inn) inn.disabled = false;
          open = true; busy = false;
          var sel = api() && api().getSelected && api().getSelected();
          if (sel) for (var i = 0; i < markers.length; i++) if (markers[i].p === sel) { openCard(markers[i].m, sel); break; }
        }, reduced() ? 50 : 2100);
      }
      var fired = false;
      tiles.once('load', function () { fired = true; go(); });
      later(function () { if (!fired) go(); }, 1600);
    }).catch(function () {
      /* لا إنترنت أو CDN محجوب: تبقى الكرة، ونرجّعها خطوة للخلف كي لا تتكرر المحاولة */
      busy = false; if (gl()) gl().resume(d.lon, d.lat, 8);
    });
  }

  function exit(home) {
    if (!open || busy) return;
    busy = true; clearTimers();
    try { map.closePopup(); } catch (e) {}
    var c = map.getCenter(), lo = ((c.lng + 540) % 360) - 180, la = c.lat;
    var zoomGlobe = base ? 10 * radiusFor(map.getZoom(), la) / base.R : 8;
    wrap.classList.remove('kh-gl-maplive');
    setGone(false); void wrap.offsetWidth; setAway(false); pulseHaze();
    if (home && gl()) gl().home();
    else if (gl()) gl().resume(lo, la, Math.min(zoomGlobe, 9));
    active = null;
    later(function () {
      wrap.classList.remove('kh-gl-hasmap');
      open = false; busy = false;
    }, reduced() ? 50 : 1300);
  }

  document.addEventListener('kh:globe-maxzoom', function (e) { if (e && e.detail) enter(e.detail); });

  /* أزرار التكبير الجانبية تتحكم بالخريطة وهي مفتوحة (الزر الأخير = رجوع للكرة) */
  document.addEventListener('click', function (e) {
    if (!(open || busy) || !e.target || !e.target.closest) return;
    var b = e.target.closest('#khWorld button[data-world-zoom]');
    if (!b) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (!open || !map) return;
    var k = b.dataset.worldZoom;
    if (k === 'in') map.zoomIn(1); else if (k === 'out') map.zoomOut(1); else exit(true);
  }, true);
  document.addEventListener('keydown', function (e) { if (open && e.key === 'Escape') exit(false); });
})();
