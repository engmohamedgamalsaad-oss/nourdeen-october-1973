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
    '.kh-gl-pop .leaflet-popup-content-wrapper{background:rgba(5,14,29,.92);color:#fff4dc;border:1px solid var(--c,#b8874b);border-radius:16px;padding:0;',
    'box-shadow:0 0 18px color-mix(in srgb,var(--c,#b8874b) 38%,transparent);animation:khPopIn .38s cubic-bezier(.2,.9,.3,1.2) both}',
    '.kh-gl-pop .leaflet-popup-content{margin:7px 12px 7px 9px}',
    '.kh-gl-pop .leaflet-popup-tip{background:rgba(5,14,29,.92);box-shadow:none;border:1px solid var(--c,#b8874b)}',
    '.kh-gl-card{display:flex;align-items:center;gap:8px;min-width:120px;max-width:230px;line-height:1.35;font-family:Cairo,Tahoma,sans-serif;color:#fff4dc;text-decoration:none}',
    '.kh-gl-card .ph{display:grid;place-items:center;flex:none;width:34px;height:34px;border-radius:50%;overflow:hidden;border:1.5px solid var(--c,#b8874b);background:rgba(255,255,255,.06);font:800 15px/1 Cairo,Tahoma,sans-serif;color:var(--c,#b8874b)}',
    '.kh-gl-card .ph img{width:100%;height:100%;object-fit:cover;display:block}',
    '.kh-gl-card .tx{display:flex;flex-direction:column;min-width:0}',
    '.kh-gl-card strong{font:600 12.5px/1.35 Cairo,Tahoma,sans-serif;color:#fff4dc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.kh-gl-card small{font:500 10.5px/1.35 Cairo,Tahoma,sans-serif;color:rgba(243,207,133,.95);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    'a.kh-gl-card:hover strong,a.kh-gl-card:focus-visible strong{text-decoration:underline}',
    '.kh-gl-pin{background:none;border:0;filter:drop-shadow(0 0 5px rgba(0,0,0,.55));transition:transform .25s ease}',
    '.kh-gl-pin.is-active{transform:translateY(-3px) scale(1.2);filter:drop-shadow(0 0 10px #f0c878)}',
    '@keyframes khPopIn{from{opacity:0;transform:translateY(8px) scale(.92)}to{opacity:1;transform:none}}',
    '@media(prefers-reduced-motion:reduce){.kh-gl-pop .leaflet-popup-content-wrapper{animation:none!important}.kh-gl-haze,.kh-world-gl.kh-gl-hasmap canvas{transition:none!important;animation:none!important}.kh-gl-haze.is-on,.kh-gl-haze.is-on i{animation:none!important}}'
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
  function hex(c) { return /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#b8874b'; }
  function colorOf(p) { try { return hex(api().sectionColor(p.story && p.story.section)); } catch (e) { return '#b8874b'; } }
  function card(p) {
    var h = hrefOf(p.story), d = document.createElement(h ? 'a' : 'div'); d.className = 'kh-gl-card';
    if (h) d.href = h;
    d.style.setProperty('--c', colorOf(p));
    var nm = nameOf(p), ph = document.createElement('span'); ph.className = 'ph';
    var url = String(p.photo || '');
    if (url && !/^\s*javascript:/i.test(url)) {
      var im = new Image(); im.alt = ''; im.onerror = function () { ph.textContent = Array.from(nm || '\u2605')[0] || '\u2605'; }; im.src = url; ph.appendChild(im);
    } else ph.textContent = Array.from(nm || '\u2605')[0] || '\u2605';
    d.appendChild(ph);
    var tx = document.createElement('span'); tx.className = 'tx';
    var n = document.createElement('strong'); n.textContent = nm; tx.appendChild(n);
    var pl = placeOf(p); if (pl) { var sm = document.createElement('small'); sm.textContent = pl; tx.appendChild(sm); }
    d.appendChild(tx);
    return d;
  }
  function pinIcon(color) {
    var L = window.L, el = document.createElement('div');
    el.innerHTML = '<svg viewBox="0 0 24 34" width="24" height="34" aria-hidden="true"><path d="M12 33C12 33 2 20 2 12a10 10 0 1 1 20 0c0 8-10 21-10 21z" fill="' + color + '" stroke="#fff8e6" stroke-width="1.6"/><circle cx="12" cy="12" r="3.8" fill="#fff"/></svg>';
    return L.divIcon({ className: 'kh-gl-pin', html: el.innerHTML, iconSize: [24, 34], iconAnchor: [12, 33] });
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
      var m = L.marker([p.lat, p.lng], { icon: pinIcon(colorOf(p)), keyboard: true, title: nameOf(p) }).addTo(map);
      m.on('click', function () { onMarker(m, p); });
      markers.push({ m: m, p: p });
    });
    map.on('zoomend', function () {
      if (open && !busy && zMatch && map.getZoom() < zMatch - EXIT_MARGIN) exit(false);
    });
  }

  function setActive(m) {
    markers.forEach(function (x) { var el = x.m.getElement && x.m.getElement(); if (el) el.classList[x.m === m ? 'add' : 'remove']('is-active'); });
    active = m;
  }
  function openCard(m, p) {
    setActive(m);
    var pop = window.L.popup({ closeButton: false, offset: [0, -30], autoPan: true, className: 'kh-gl-pop', maxWidth: 260 }).setLatLng(m.getLatLng()).setContent(card(p));
    pop.openOn(map);
    var el = pop.getElement && pop.getElement();
    if (el) el.style.setProperty('--c', colorOf(p));
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
    setActive(null);
    later(function () {
      wrap.classList.remove('kh-gl-hasmap');
      open = false; busy = false;
    }, reduced() ? 50 : 1300);
  }

  function openFromButton() {
    if (open || busy) return;
    var wr = gl() && gl().wrap && gl().wrap(); if (!wr) return;
    var sel = api() && api().getSelected && api().getSelected(), r = wr.getBoundingClientRect();
    enter({ lon: sel ? sel.lng : 29, lat: sel ? sel.lat : 21, R: Math.min(r.width * 0.40, r.height * 0.41) * 10, w: r.width, h: r.height });
  }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('#khWorld a.btn.ghost') : null;
    if (!a || !(gl() && gl().wrap && gl().wrap())) return;
    e.preventDefault(); e.stopImmediatePropagation(); openFromButton();
  }, true);

  /* روابط الحكايات القديمة تشير إلى #khMap: نُبقي مرساة صغيرة غير مرئية داخل قسم الكرة كي تصل إليه. */
  function ensureAnchor() {
    var w = document.getElementById('khWorld');
    if (!w || document.getElementById('khMap')) return;
    var a = document.createElement('span'); a.id = 'khMap'; a.setAttribute('aria-hidden', 'true');
    a.style.cssText = 'display:block;position:relative;height:0;overflow:hidden;pointer-events:none';
    w.insertBefore(a, w.firstChild);
    if (location.hash === '#khMap') a.scrollIntoView();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureAnchor); else ensureAnchor();
  setTimeout(ensureAnchor, 1500);

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
