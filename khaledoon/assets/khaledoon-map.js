/* خالدون عبر التاريخ — خريطة الشخصيات (الصفحة الرئيسية).
   نقطة لكل شخصية لها مكان في stories/places.json (مفتاحه رقم الحكاية)، ولونها لون قسم الحكاية.
   الاسم والعنوان والقسم تُقرأ من stories/index.json، فأي حكاية جديدة لها person ومكان تظهر دون تعديل هذا الملف.
   بدون صورة (photo) يظهر ظل شخص موحّد بنفس الإطار. الصور تُقبل كمسار نسبي فقط. لا يستخدم innerHTML مع أي بيانات.
   Leaflet يُحمَّل عند الاقتراب من القسم فقط. لو تعذّر التحميل تظهر قائمة نصية بالأماكن. */
(function () {
  'use strict';
  if (window.__khMap) return;
  window.__khMap = true;
  var main = document.querySelector('main');
  if (!main) return;

  var LANGS = ['ar', 'en', 'fr', 'it', 'de'];
  var CDN = 'https://cdnjs.cloudflare.com/ajax/libs/';
  var SEC = {
    october:    { c: '#f0c878', t: { ar: 'حكايات أكتوبر 1973', en: 'October 1973 Stories', fr: 'Récits d’octobre 1973', it: 'Storie di ottobre 1973', de: 'Geschichten vom Oktober 1973' } },
    science:    { c: '#8ad9e8', t: { ar: 'العلم والعلماء', en: 'Science and Scientists', fr: 'Science et scientifiques', it: 'Scienza e scienziati', de: 'Wissenschaft und Wissenschaftler' } },
    knowledge:  { c: '#a9d9a6', t: { ar: 'التعليم والمعرفة', en: 'Education and Knowledge', fr: 'Éducation et savoir', it: 'Istruzione e conoscenza', de: 'Bildung und Wissen' } },
    people:     { c: '#f1a7c5', t: { ar: 'المشاهير والرياضة والفنون', en: 'Celebrities, Sports and Arts', fr: 'Célébrités, sport et arts', it: 'Celebrità, sport e arti', de: 'Prominente, Sport und Kunst' } },
    history:    { c: '#d4b7ff', t: { ar: 'التاريخ والحضارات', en: 'History and Civilizations', fr: 'Histoire et civilisations', it: 'Storia e civiltà', de: 'Geschichte und Zivilisationen' } },
    curriculum: { c: '#f5b37e', t: { ar: 'شخصيات المناهج المصرية', en: 'Egyptian Curriculum Figures', fr: 'Figures des programmes égyptiens', it: 'Personaggi dei programmi egiziani', de: 'Figuren der ägyptischen Lehrpläne' } }
  };
  var STR = {
    kicker: { ar: 'خريطة الشخصيات', en: 'Map of figures', fr: 'Carte des personnages', it: 'Mappa dei personaggi', de: 'Karte der Persönlichkeiten' },
    title:  { ar: 'من أين جاءت الحكايات؟', en: 'Where do the stories come from?', fr: 'D’où viennent les histoires ?', it: 'Da dove vengono le storie?', de: 'Woher kommen die Geschichten?' },
    lead:   { ar: 'كل نقطة ملوّنة شخصية من الحكايات، ولونها لون قسمها. اضغط على النقطة لتتعرّف عليها.', en: 'Each colored dot is a figure from the stories, colored by section. Tap a dot to meet them.', fr: 'Chaque point coloré est un personnage des histoires, selon sa rubrique. Touchez-le pour le découvrir.', it: 'Ogni punto colorato è un personaggio delle storie, colorato per sezione. Tocca un punto per conoscerlo.', de: 'Jeder farbige Punkt ist eine Persönlichkeit aus den Geschichten, gefärbt nach Rubrik. Tippe auf einen Punkt.' },
    born:   { ar: 'مكان الميلاد: ', en: 'Born in: ', fr: 'Lieu de naissance : ', it: 'Luogo di nascita: ', de: 'Geburtsort: ' },
    read:   { ar: 'اقرأ الحكاية', en: 'Read the story', fr: 'Lire l’histoire', it: 'Leggi la storia', de: 'Geschichte lesen' },
    err:    { ar: 'تعذّر تحميل الخريطة الآن. هذه قائمة بالأماكن:', en: 'The map could not be loaded right now. Here is the list of places:', fr: 'La carte n’a pas pu être chargée. Voici la liste des lieux :', it: 'Non è stato possibile caricare la mappa. Ecco l’elenco dei luoghi:', de: 'Die Karte konnte nicht geladen werden. Hier die Liste der Orte:' },
    credit: { ar: 'مصدر الصورة: ', en: 'Photo: ', fr: 'Photo : ', it: 'Foto: ', de: 'Foto: ' },
    legend: { ar: 'الأقسام', en: 'Sections', fr: 'Rubriques', it: 'Sezioni', de: 'Rubriken' }
  };
  function lang() {
    var l = (document.documentElement.lang || 'ar').slice(0, 2).toLowerCase();
    return LANGS.indexOf(l) >= 0 ? l : 'ar';
  }
  function T(k) { var o = STR[k]; return o[lang()] || o.ar; }
  function pick(obj, field, l) {
    var v = '';
    if (l !== 'ar' && obj.i18n && obj.i18n[l] && obj.i18n[l][field]) v = obj.i18n[l][field];
    return v || obj[field] || '';
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---------- هيكل القسم (يُدرج قبل قسم "كيف تشارك" إن وُجد) ---------- */
  var sec = el('section', 'section');
  sec.id = 'khMap';
  var wrap = el('div', 'wrap');
  var head = el('div', 'head');
  var hl = el('div');
  var kick = el('div', 'kicker');
  var h2 = el('h2');
  hl.appendChild(kick); hl.appendChild(h2);
  var lead = el('p');
  head.appendChild(hl); head.appendChild(lead);
  var box = el('div', 'khm-box');
  var canvas = el('div', 'khm-canvas');
  canvas.setAttribute('role', 'region');
  var legend = el('div', 'khm-legend');
  legend.setAttribute('role', 'group');
  box.appendChild(canvas); box.appendChild(legend);
  wrap.appendChild(head); wrap.appendChild(box);
  sec.appendChild(wrap);
  var anchor = document.getElementById('how');
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(sec, anchor);
  else main.appendChild(sec);

  /* ---------- البيانات ---------- */
  var points = [];
  var hidden = {};
  var map = null, group = null, markers = [];

  function validPhoto(p) { return typeof p === 'string' && /^[\w\-.\/]+\.(jpe?g|png|webp)$/i.test(p) && p.indexOf('..') < 0 && p.charAt(0) !== '/'; }
  function validNum(n, lim) { return typeof n === 'number' && isFinite(n) && Math.abs(n) <= lim; }

  function loadData() {
    function get(u) { return fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }); }
    return Promise.all([get('stories/index.json'), get('stories/places.json')]).then(function (r) {
      var stories = Array.isArray(r[0]) ? r[0] : [], places = r[1] || {};
      stories.forEach(function (s) {
        if (!s || s.published === false || !s.person) return;
        var p = places[String(s.id)];
        if (!p || !validNum(p.lat, 90) || !validNum(p.lng, 180) || !SEC[s.section]) return;
        points.push({ s: s, p: p, sec: s.section });
      });
    });
  }

  /* ---------- الواجهة ---------- */
  function silhouette() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('aria-hidden', 'true');
    var c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', '50'); c.setAttribute('cy', '37'); c.setAttribute('r', '17');
    var b = document.createElementNS(ns, 'path');
    b.setAttribute('d', 'M16 100c0-24 15-38 34-38s34 14 34 38z');
    c.setAttribute('fill', 'currentColor'); b.setAttribute('fill', 'currentColor');
    svg.appendChild(c); svg.appendChild(b);
    return svg;
  }
  function card(e) {
    var l = lang(), s = e.s, p = e.p;
    var c = el('div', 'khm-card');
    c.dir = document.documentElement.dir || 'rtl';
    var ph = el('div', 'khm-ph');
    ph.style.setProperty('--c', SEC[e.sec].c);
    if (validPhoto(p.photo)) {
      var img = el('img');
      img.alt = pick(s, 'person', l);
      img.loading = 'lazy';
      img.addEventListener('error', function () { ph.replaceChildren(silhouette()); });
      img.src = p.photo;
      ph.appendChild(img);
    } else { ph.appendChild(silhouette()); }
    c.appendChild(ph);
    c.appendChild(el('div', 'khm-name', pick(s, 'person', l)));
    var pl = (p.place && (p.place[l] || p.place.ar)) || '';
    if (pl) c.appendChild(el('div', 'khm-place', T('born') + pl));
    c.appendChild(el('div', 'khm-story', pick(s, 'title', l)));
    if (p.credit && validPhoto(p.photo)) c.appendChild(el('div', 'khm-credit', T('credit') + p.credit));
    var a = el('a', 'khm-go', T('read'));
    a.href = s.path || ('stories/' + s.section + '/' + s.id + '/');
    c.appendChild(a);
    return c;
  }
  function labels() {
    var l = lang();
    kick.textContent = T('kicker'); h2.textContent = T('title'); lead.textContent = T('lead');
    canvas.setAttribute('aria-label', T('title'));
    legend.setAttribute('aria-label', T('legend'));
    legend.querySelectorAll('.khm-chip').forEach(function (b) {
      var t = b.querySelector('span'); if (t) t.textContent = SEC[b.getAttribute('data-sec')].t[l];
    });
  }
  function buildLegend() {
    var seen = {};
    points.forEach(function (e) { seen[e.sec] = 1; });
    Object.keys(SEC).forEach(function (id) {
      if (!seen[id]) return;
      var b = el('button', 'khm-chip');
      b.type = 'button'; b.setAttribute('data-sec', id); b.setAttribute('aria-pressed', 'true');
      b.style.setProperty('--c', SEC[id].c);
      b.appendChild(el('i')); b.appendChild(el('span'));
      b.addEventListener('click', function () {
        hidden[id] = !hidden[id];
        b.setAttribute('aria-pressed', hidden[id] ? 'false' : 'true');
        refresh(false);
      });
      legend.appendChild(b);
    });
    labels();
  }

  function refresh(fit) {
    if (!map || !group) return;
    group.clearLayers();
    var vis = markers.filter(function (m) { return !hidden[m._sec]; });
    group.addLayers(vis);
    if (fit && vis.length) {
      if (vis.length === 1) map.setView(vis[0].getLatLng(), 6);
      else map.fitBounds(group.getBounds().pad(0.3), { maxZoom: 6 });
    }
  }
  function initMap() {
    var L = window.L;
    map = L.map(canvas, { worldCopyJump: true, minZoom: 2, scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(map);
    group = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 40 });
    points.forEach(function (e) {
      var dot = el('span', 'khm-dot');
      dot.style.background = SEC[e.sec].c;
      var m = L.marker([e.p.lat, e.p.lng], {
        icon: L.divIcon({ className: 'khm-pin', html: dot, iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -12] }),
        title: pick(e.s, 'person', lang()), keyboard: true
      });
      m._sec = e.sec;
      m.bindPopup(function () { return card(e); }, { className: 'khm-popup', maxWidth: 260 });
      markers.push(m);
    });
    map.addLayer(group);
    refresh(true);
    map.on('click', function () { map.scrollWheelZoom.enable(); });
    setTimeout(function () { map.invalidateSize(); }, 200);
  }

  function fallbackList() {
    canvas.style.height = 'auto';
    var l = lang();
    canvas.replaceChildren();
    canvas.dir = document.documentElement.dir || 'rtl';
    canvas.appendChild(el('div', 'khm-note', T('err')));
    var ul = el('ul', 'khm-list');
    points.forEach(function (e) {
      var li = el('li');
      var a = el('a', null, pick(e.s, 'person', l));
      a.href = e.s.path || ('stories/' + e.s.section + '/' + e.s.id + '/');
      li.appendChild(a);
      var pl = (e.p.place && (e.p.place[l] || e.p.place.ar)) || '';
      if (pl) li.appendChild(document.createTextNode(' — ' + pl));
      ul.appendChild(li);
    });
    canvas.appendChild(ul);
  }

  function css(href) { var k = document.createElement('link'); k.rel = 'stylesheet'; k.href = href; document.head.appendChild(k); }
  function js(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src; s.async = false;
      s.onload = res; s.onerror = function () { rej(new Error(src)); };
      document.head.appendChild(s);
    });
  }
  var started = false;
  function start() {
    if (started) return; started = true;
    loadData().then(function () {
      if (!points.length) { sec.hidden = true; return; }
      buildLegend();
      css(CDN + 'leaflet/1.9.4/leaflet.min.css');
      css(CDN + 'leaflet.markercluster/1.5.3/MarkerCluster.css');
      css(CDN + 'leaflet.markercluster/1.5.3/MarkerCluster.Default.css');
      return js(CDN + 'leaflet/1.9.4/leaflet.min.js')
        .then(function () { return js(CDN + 'leaflet.markercluster/1.5.3/leaflet.markercluster.js'); })
        .then(initMap)
        .catch(fallbackList);
    }).catch(function () { sec.hidden = true; });
  }

  labels();
  new MutationObserver(function () { labels(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (en) {
      if (en.some(function (x) { return x.isIntersecting; })) { io.disconnect(); start(); }
    }, { rootMargin: '400px' });
    io.observe(sec);
  } else { start(); }
})();
