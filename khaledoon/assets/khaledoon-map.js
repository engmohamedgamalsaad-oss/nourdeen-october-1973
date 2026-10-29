/* خالدون عبر التاريخ — خريطة الشخصيات (الصفحة الرئيسية).
   نقطة لكل شخصية لها مكان في stories/places.json (مفتاحه رقم الحكاية)، ولونها لون قسم الحكاية.
   الاسم والعنوان والقسم تُقرأ من stories/index.json، فأي حكاية جديدة لها person ومكان تظهر دون تعديل هذا الملف.
   بدون صورة (photo) يظهر ظل شخص موحّد بنفس الإطار. الصور تُقبل كمسار نسبي فقط. لا يستخدم innerHTML مع أي بيانات.
   الحكايات التي أخفاها الأدمن (جدول story_visibility في Supabase، من صفحة khaledoon/admin-visibility.html) تُستثنى من الخريطة. لو فشل الطلب تظهر كل النقاط.
   Leaflet يُحمّل عند الاقتراب من القسم فقط. لو تعذّر التحميل تظهر قائمة نصية بالأماكن. */
(function () {
  'use strict';
  if (window.__khMap) return;
  window.__khMap = true;
  var main = document.querySelector('main');
  if (!main) return;

  var LANGS = ['ar', 'en', 'fr', 'it', 'de'];
  var CDN = 'https://cdnjs.cloudflare.com/ajax/libs/';
  var API = 'https://ypwprddkscnfblhftkeb.supabase.co';
  var ANON = 'sb_publishable_JJnVwx8HQAJNxSok32L-qg_83fXk5Qn';
  var SEC = {
    islamic:    { c: '#78c59a', t: { ar: 'شخصيات إسلامية', en: 'Islamic Figures', fr: 'Figures de l’islam', it: 'Figure islamiche', de: 'Persönlichkeiten des Islam' } },
    october:    { c: '#f0c878', t: { ar: 'حكايات أكتوبر 1973', en: 'October 1973 Stories', fr: 'Récits d’octobre 1973', it: 'Storie di ottobre 1973', de: 'Geschichten vom Oktober 1973' } },
    science:    { c: '#8ad9e8', t: { ar: 'العلم والعلماء', en: 'Science and Scientists', fr: 'Science et scientifiques', it: 'Scienza e scienziati', de: 'Wissenschaft und Wissenschaftler' } },
    women:      { c: '#d78bb2', t: { ar: 'نساء خالدات', en: 'Women Who Made History', fr: 'Femmes qui ont marqué l’histoire', it: 'Donne che hanno fatto la storia', de: 'Frauen, die Geschichte schrieben' } },
    people:     { c: '#e2b36d', t: { ar: 'أعلام الأدب والفنون والرياضة', en: 'Figures in Literature, Arts and Sport', fr: 'Figures de la littérature, des arts et du sport', it: 'Protagonisti della letteratura, delle arti e dello sport', de: 'Persönlichkeiten aus Literatur, Kunst und Sport' } },
    history:    { c: '#d4b7ff', t: { ar: 'التاريخ والحضارات', en: 'History and Civilizations', fr: 'Histoire et civilisations', it: 'Storia e civiltà', de: 'Geschichte und Zivilisationen' } },
    curriculum: { c: '#f5b37e', t: { ar: 'شخصيات المناهج المصرية', en: 'Egyptian Curriculum Figures', fr: 'Figures des programmes égyptiens', it: 'Personaggi dei programmi egiziani', de: 'Figuren der ägyptischen Lehrpläne' } }
  };
  var STR = {
    kicker: { ar: 'خريطة الشخصيات', en: 'Story map', fr: 'Carte des histoires', it: 'Mappa delle storie', de: 'Geschichtenkarte' },
    title:  { ar: 'كل الحكايات على الخريطة', en: 'All stories connected', fr: 'Toutes les histoires reliées', it: 'Tutte le storie collegate', de: 'Alle Geschichten verknüpft' },
    lead:   { ar: 'تظهر الشخصيات على الخريطة عند توفر إحداثيات موثقة؛ لا نضع مواقع تخمينية.', en: 'Characters appear on the map when verified coordinates are available; locations are never guessed.', fr: 'Les personnages apparaissent sur la carte lorsque des coordonnées vérifiées sont disponibles ; aucun lieu n’est deviné.', it: 'I personaggi appaiono sulla mappa quando sono disponibili coordinate verificate; nessuna posizione viene inventata.', de: 'Figuren erscheinen auf der Karte, wenn verifizierte Koordinaten vorliegen; Standorte werden nicht geraten.' },
    noPlace: { ar: 'الموقع غير مسجل بعد', en: 'Location not recorded yet', fr: 'Lieu pas encore enregistré', it: 'Luogo non ancora registrato', de: 'Standort noch nicht eingetragen' },
    born:   { ar: 'مكان الميلاد: ', en: 'Born in: ', fr: 'Lieu de naissance : ', it: 'Luogo di nascita: ', de: 'Geburtsort: ' },
    approx: { ar: 'الموقع تقريبي ويحتاج إلى مراجعة', en: 'Approximate location; verification needed', fr: 'Emplacement approximatif à vérifier', it: 'Posizione approssimativa da verificare', de: 'Ungefähre Lage; noch zu überprüfen' },
    read:   { ar: 'اقرأ الحكاية', en: 'Read the story', fr: 'Lire l’histoire', it: 'Leggi la storia', de: 'Geschichte lesen' },
    err:    { ar: 'تعذّر تحميل الخريطة الآن. هذه قائمة بالأماكن:', en: 'The map could not be loaded right now. Here is the list of places:', fr: 'La carte n’a pas pu être chargée. Voici la liste des lieux :', it: 'Non è stato possibile caricare la mappa. Ecco l’elenco dei luoghi:', de: 'Die Karte konnte nicht geladen werden. Hier die Liste der Orte:' },
    credit: { ar: 'مصدر الصورة: ', en: 'Photo: ', fr: 'Photo : ', it: 'Foto: ', de: 'Foto: ' },
    source: { ar: 'المصدر: ', en: 'Source: ', fr: 'Source : ', it: 'Fonte: ', de: 'Quelle: ' },
    legend: { ar: 'الأقسام', en: 'Sections', fr: 'Rubriques', it: 'Sezioni', de: 'Rubriken' },
  };
  function loadSectionConfig() {
    return fetch(API + '/rest/v1/khaledoon_admin_config?config_key=eq.sections&select=config_value&limit=1', {
      headers: { apikey: ANON, Authorization: 'Bearer ' + ANON }, cache: 'no-store'
    }).then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) {
      var value = rows && rows[0] && rows[0].config_value;
      if (!value || !value.data || !Array.isArray(value.data.sections)) return;
      var colors = value.colors || {}, active = {};
      value.data.sections.forEach(function (section) {
        if (!section || !/^[a-z0-9-]{1,50}$/.test(section.id)) return;
        active[section.id] = true;
        var old = SEC[section.id] || { c: '#b8874b', t: {} };
        var t = Object.assign({}, old.t || {});
        t.ar = section.title || t.ar || section.id;
        ['en','fr','it','de'].forEach(function (l) {
          if (section.i18n && section.i18n[l] && section.i18n[l].title) t[l] = section.i18n[l].title;
        });
        var color = colors[section.id] && colors[section.id].outer;
        SEC[section.id] = { c: /^#[0-9a-f]{6}$/i.test(color || '') ? color : old.c, t: t };
      });
      Object.keys(SEC).forEach(function (id) { if (!active[id]) delete SEC[id]; });
    }).catch(function () {});
  }

  function lang() {
    var l = (document.documentElement.lang || 'ar').slice(0, 2).toLowerCase();
    return LANGS.indexOf(l) >= 0 ? l : 'ar';
  }
  function T(k) { var o = STR[k]; return o[lang()] || o.ar; }
  function srcName(p) { var n = p && p.source_name; if (n && typeof n === 'object') { return n[lang()] || n.ar || p.source_url || ''; } return n || (p && p.source_url) || ''; }
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
  var storiesAll = [];
  var hidden = {};
  var map = null, group = null, markers = [];

  function validPhoto(p) { return typeof p === 'string' && /^[\w\-.\/]+\.(jpe?g|png|webp|svg)$/i.test(p) && p.indexOf('..') < 0 && p.charAt(0) !== '/'; }
  function validNum(n, lim) { return typeof n === 'number' && isFinite(n) && Math.abs(n) <= lim; }

  /* الحكايات التي أخفاها الأدمن: طلب واحد مشترك مع khaledoon-favorites.js، وعند الفشل لا يُخفى شيء. */
  function loadHidden() {
    if (!window.__khHiddenP) {
      var hiddenRequest = fetch(API + '/rest/v1/story_visibility?select=story_id', { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON }, cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (a) { return Array.isArray(a) ? a.map(function (x) { return String(x.story_id); }) : []; })
        .catch(function () { return []; });
      /* لا نسمح بطلب إخفاء القصص أن يمنع ظهور الخريطة إذا تأخر الاتصال. */
      window.__khHiddenP = Promise.race([
        hiddenRequest,
        new Promise(function (resolve) { setTimeout(function () { resolve([]); }, 1800); })
      ]);
    }
    return window.__khHiddenP;
  }

  function loadData() {
    function get(u) { return fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }); }
    return Promise.all([get('stories/index.json'), get('stories/places.json'), loadHidden()]).then(function (r) {
      var stories = Array.isArray(r[0]) ? r[0] : [], places = r[1] || {}, off = r[2] || [];
      stories.forEach(function (s) {
        if (!s || s.published === false || !s.title || off.indexOf(String(s.id)) >= 0) return;
        var section = s.section;
        if (section === 'knowledge' || section === 'learning') section = 'women';
        if (section === 'fame') section = 'people';
        var entry = { s: s, p: places[String(s.id)] || null, sec: section };
        storiesAll.push(entry);
        if (!SEC[section]) return;
        var p = entry.p;
        if (p && validNum(p.lat, 90) && validNum(p.lng, 180)) points.push(entry);
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
  function storyHref(s) {
    var path = String(s && s.path || '');
    if (/^stories\/[a-z0-9-]+\/[0-9]{3}\/$/.test(path)) return path;
    var section = String(s && s.section || ''), id = String(s && s.id || '').padStart(3, '0');
    if (/^[a-z0-9-]+$/.test(section) && /^[0-9]{3}$/.test(id)) return 'stories/' + section + '/' + id + '/';
    return 'stories/';
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
    if (pl) c.appendChild(el('div', 'khm-place', ((p.place_label && (p.place_label[l] || p.place_label.ar)) || T('born')) + pl));
    if (p.source_url && /^https:\/\//i.test(p.source_url)) {
      var source = el('a', 'khm-source', T('source') + srcName(p));
      source.href = p.source_url; source.target = '_blank'; source.rel = 'noopener noreferrer';
      c.appendChild(source);
    }
    if (p.approximate === true) c.appendChild(el('div', 'khm-approx', T('approx')));
    c.appendChild(el('div', 'khm-story', (SEC[e.sec] && SEC[e.sec].t[l]) || SEC[e.sec].t.ar));
    if (p.credit && validPhoto(p.photo)) c.appendChild(el('div', 'khm-credit', T('credit') + p.credit));
    var a = el('a', 'khm-go', T('read'));
    a.href = storyHref(s);
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
    setTimeout(function () { map.invalidateSize(); }, 200);
  }

  function fallbackList() {
    usingFallback = true;
    canvas.style.height = 'auto';
    var l = lang();
    canvas.replaceChildren();
    canvas.dir = document.documentElement.dir || 'rtl';
    canvas.appendChild(el('div', 'khm-note', T('err')));
    var ul = el('ul', 'khm-list');
    storiesAll.forEach(function (e) {
      var li = el('li');
      var a = el('a', null, pick(e.s, 'title', l) || pick(e.s, 'person', l) || String(e.s.id));
      a.href = storyHref(e.s);
      li.appendChild(a);
      var person = pick(e.s, 'person', l);
      if (person && person !== a.textContent) li.appendChild(document.createTextNode(' — ' + person));
      var pl = e.p && e.p.place && (e.p.place[l] || e.p.place.ar);
      if (pl) li.appendChild(document.createTextNode(' — ' + ((e.p.place_label && (e.p.place_label[l] || e.p.place_label.ar)) || T('born')) + pl));
      else li.appendChild(document.createTextNode(' — ' + T('noPlace')));
      if (e.p && e.p.source_url && /^https:\/\//i.test(e.p.source_url)) {
        var sourceLink = el('a', null, T('source') + srcName(e.p));
        sourceLink.href = e.p.source_url; sourceLink.target = '_blank'; sourceLink.rel = 'noopener noreferrer';
        li.appendChild(document.createTextNode(' — ')); li.appendChild(sourceLink);
      }
      if (e.p && e.p.approximate === true) li.appendChild(document.createTextNode(' — ' + T('approx')));
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
  var usingFallback = false;
  function start() {
    if (started) return; started = true;
    loadSectionConfig().then(function () { return loadData(); }).then(function () {
      if (!points.length) { fallbackList(); return; }
      buildLegend();
      css(CDN + 'leaflet/1.9.4/leaflet.min.css');
      css(CDN + 'leaflet.markercluster/1.5.3/MarkerCluster.css');
      css(CDN + 'leaflet.markercluster/1.5.3/MarkerCluster.Default.css');
      return js(CDN + 'leaflet/1.9.4/leaflet.min.js')
        .then(function () { return js(CDN + 'leaflet.markercluster/1.5.3/leaflet.markercluster.js'); })
        .then(initMap)
        .catch(fallbackList);
    }).catch(function () { fallbackList(); });
  }

  labels();
  new MutationObserver(function () { labels(); if (usingFallback) fallbackList(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  /* شغّل الخريطة فورًا؛ لا تربط إنشاءها بوصول المستخدم إلى موضعها في الصفحة. */
  start();
})();
