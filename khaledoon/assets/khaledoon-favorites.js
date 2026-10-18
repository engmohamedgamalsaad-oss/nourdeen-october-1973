/* خالدون عبر التاريخ — المفضّلة: نجمة على كل كارت حكاية + زر داخل صفحة الحكاية + قسم "حكاياتي المفضلة" في الرئيسية.
   - المفضلة تُحفظ في متصفح الزائر (localStorage، المفتاح kh-favs) دون تسجيل دخول.
   - النجمة تُضاف تلقائيًا لأي كارت <a class="card"> يربط بصفحة حكاية (stories/<قسم>/<رقم>/)، حتى لو أُنشئ لاحقًا بالجافاسكربت.
   - في صفحة الحكاية نفسها يُضاف زر بالنجمة والنص في شريط المشاركة (.story-share-bar)، أو في .hero-content إن لم يوجد الشريط.
   - قسم المفضلة يقرأ stories/index.json، فأي حكاية جديدة تدخله دون تعديل هذا الملف.
   - الحكايات التي أخفاها الأدمن (صفحة khaledoon/admin-visibility.html، جدول story_visibility في Supabase) تختفي من الكروت ومن المفضلة،
     والزائر لا يملك أي زر لذلك. لو فشل الطلب تظهر كل الحكايات كالمعتاد.
   - يُحمّل من khaledoon-theme.js (الأقسام والحكايات) ومن khaledoon-search.js (الرئيسية).
   - لا يستخدم innerHTML مع أي بيانات. */
(function () {
  'use strict';
  if (window.__khFavs) return;
  window.__khFavs = true;

  var SRC = (document.currentScript && document.currentScript.src) || '';
  function U(rel) { try { return new URL(rel, SRC || location.href).href; } catch (e) { return rel; } }

  var KEY = 'kh-favs';
  var API = 'https://ypwprddkscnfblhftkeb.supabase.co';
  var ANON = 'sb_publishable_JJnVwx8HQAJNxSok32L-qg_83fXk5Qn';
  var LANGS = ['ar', 'en', 'fr', 'it', 'de'];
  var STORY_RE = /\/stories\/[a-z0-9_-]+\/(\d{3,})(?:[\/?#]|$)/i;
  var PAGE_RE = /\/stories\/[a-z0-9_-]+\/(\d{3,})\/?(?:index\.html)?$/i;

  var STR = {
    add:    { ar: 'أضف إلى المفضلة', en: 'Add to favorites', fr: 'Ajouter aux favoris', it: 'Aggiungi ai preferiti', de: 'Zu Favoriten hinzufügen' },
    remove: { ar: 'إزالة من المفضلة', en: 'Remove from favorites', fr: 'Retirer des favoris', it: 'Rimuovi dai preferiti', de: 'Aus Favoriten entfernen' },
    saved:  { ar: 'في المفضلة', en: 'In favorites', fr: 'Dans les favoris', it: 'Nei preferiti', de: 'In den Favoriten' },
    title:  { ar: 'حكاياتي المفضلة', en: 'My favorite stories', fr: 'Mes histoires favorites', it: 'Le mie storie preferite', de: 'Meine Lieblingsgeschichten' },
    kicker: { ar: 'اللي اخترتها بنجمة', en: 'The ones you starred', fr: 'Celles que vous avez étoilées', it: 'Quelle che hai contrassegnato', de: 'Die, die du mit einem Stern markiert hast' }
  };

  var SEC = {
    islamic:    { ar: 'شخصيات إسلامية', en: 'Islamic Figures', fr: 'Figures de l’islam', it: 'Figure islamiche', de: 'Persönlichkeiten des Islam' },
    october:    { ar: 'حكايات أكتوبر 1973', en: 'October 1973 Stories', fr: 'Récits d’octobre 1973', it: 'Storie di ottobre 1973', de: 'Geschichten vom Oktober 1973' },
    science:    { ar: 'العلم والعلماء', en: 'Science and Scientists', fr: 'Science et scientifiques', it: 'Scienza e scienziati', de: 'Wissenschaft und Wissenschaftler' },
    women:      { ar: 'نساء خالدات', en: 'Women Who Made History', fr: 'Femmes qui ont marqué l’histoire', it: 'Donne che hanno fatto la storia', de: 'Frauen, die Geschichte schrieben' },
    knowledge:  { ar: 'نساء خالدات', en: 'Women Who Made History', fr: 'Femmes qui ont marqué l’histoire', it: 'Donne che hanno fatto la storia', de: 'Frauen, die Geschichte schrieben' },
    learning:   { ar: 'نساء خالدات', en: 'Women Who Made History', fr: 'Femmes qui ont marqué l’histoire', it: 'Donne che hanno fatto la storia', de: 'Frauen, die Geschichte schrieben' },
    people:     { ar: 'أعلام الأدب والفنون والرياضة', en: 'Figures in Literature, Arts and Sport', fr: 'Figures de la littérature, des arts et du sport', it: 'Protagonisti della letteratura, delle arti e dello sport', de: 'Persönlichkeiten aus Literatur, Kunst und Sport' },
    fame:       { ar: 'أعلام الأدب والفنون والرياضة', en: 'Figures in Literature, Arts and Sport', fr: 'Figures de la littérature, des arts et du sport', it: 'Protagonisti della letteratura, delle arti e dello sport', de: 'Persönlichkeiten aus Literatur, Kunst und Sport' },
    history:    { ar: 'التاريخ والحضارات', en: 'History and Civilizations', fr: 'Histoire et civilisations', it: 'Storia e civiltà', de: 'Geschichte und Zivilisationen' },
    curriculum: { ar: 'شخصيات المناهج المصرية', en: 'Egyptian Curriculum Figures', fr: 'Figures des programmes égyptiens', it: 'Personaggi dei programmi egiziani', de: 'Figuren der ägyptischen Lehrpläne' }
  };

  function lang() {
    var l = (document.documentElement.lang || 'ar').slice(0, 2).toLowerCase();
    return LANGS.indexOf(l) >= 0 ? l : 'ar';
  }
  function T(key) { var o = STR[key]; return o[lang()] || o.ar; }
  function secName(id, l) { var s = SEC[id]; return s ? (s[l] || s.ar) : (id || ''); }
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

  /* ---------- التخزين ---------- */
  function readFavs() {
    try {
      var a = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(a) ? a.filter(function (x) { return typeof x === 'string' && /^\d{3,}$/.test(x); }) : [];
    } catch (e) { return []; }
  }
  var favs = readFavs();
  function writeFavs() { try { localStorage.setItem(KEY, JSON.stringify(favs)); } catch (e) {} }
  function isFav(id) { return favs.indexOf(id) >= 0; }
  function toggle(id) {
    var i = favs.indexOf(id);
    if (i >= 0) favs.splice(i, 1); else favs.push(id);
    writeFavs();
    refresh();
  }

  /* ---------- الحكايات التي أخفاها الأدمن (تُقرأ من Supabase، وتُشارك مع الخريطة) ---------- */
  var hiddenIds = [];
  function isHidden(id) { return hiddenIds.indexOf(id) >= 0; }
  function loadHidden() {
    if (!window.__khHiddenP) {
      window.__khHiddenP = fetch(API + '/rest/v1/story_visibility?select=story_id', { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (a) { return Array.isArray(a) ? a.map(function (x) { return String(x.story_id); }) : []; })
        .catch(function () { return []; });
    }
    return window.__khHiddenP;
  }

  /* ---------- التنسيق ---------- */
  if (!document.querySelector('link[data-khf-css]')) {
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = U('khaledoon-favorites.css?v=4');
    css.setAttribute('data-khf-css', '1');
    document.head.appendChild(css);
  }

  /* ---------- النجمة ---------- */
  function icon() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M12 2.8l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.35 6.3 20.36l1.09-6.35-4.62-4.5 6.38-.93z');
    svg.appendChild(p);
    return svg;
  }
  function paintOne(b) {
    var on = isFav(b.getAttribute('data-id'));
    var t = T(on ? 'remove' : 'add');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('aria-label', t);
    b.title = t;
    var txt = b.querySelector('.khf-pill-text');
    if (txt) txt.textContent = T(on ? 'saved' : 'add');
  }
  function paintAll() {
    var all = document.querySelectorAll('.khf-star, .khf-pill');
    for (var i = 0; i < all.length; i++) paintOne(all[i]);
  }
  function makeStar(id) {
    var b = el('button', 'khf-star');
    b.type = 'button';
    b.setAttribute('data-id', id);
    b.appendChild(icon());
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); toggle(id); });
    paintOne(b);
    return b;
  }
  function makePill(id) {
    var b = el('button', 'khf-pill');
    b.type = 'button';
    b.setAttribute('data-id', id);
    b.appendChild(icon());
    b.appendChild(el('span', 'khf-pill-text'));
    b.addEventListener('click', function (e) { e.preventDefault(); toggle(id); });
    paintOne(b);
    return b;
  }

  /* كل كارت حكاية (رابط بصفحة stories/…/NNN/) يأخذ نجمة، حتى الكروت التي تُبنى لاحقًا بالجافاسكربت.
     الكارت المخفي من الأدمن يُوسم data-khf-hidden فيستخفي بالـ CSS. */
  function processCards() {
    var cards = document.querySelectorAll('a.card[href]');
    for (var i = 0; i < cards.length; i++) {
      var a = cards[i];
      if (a.getAttribute('data-khf')) continue;
      var m = STORY_RE.exec(a.getAttribute('href') || '');
      if (!m) continue;
      a.setAttribute('data-khf', '1');
      a.setAttribute('data-khf-id', m[1]);
      a.classList.add('kh-fav-host');
      a.appendChild(makeStar(m[1]));
      if (isHidden(m[1])) a.setAttribute('data-khf-hidden', '1');
    }
  }
  function paintHidden() {
    var cards = document.querySelectorAll('a.card[data-khf-id]');
    for (var i = 0; i < cards.length; i++) {
      if (isHidden(cards[i].getAttribute('data-khf-id'))) cards[i].setAttribute('data-khf-hidden', '1');
      else cards[i].removeAttribute('data-khf-hidden');
    }
  }

  /* صفحة الحكاية نفسها: زر بالنجمة والنص في شريط المشاركة. */
  function processStoryPage() {
    if (document.querySelector('.khf-pill')) return;
    var m = PAGE_RE.exec(location.pathname);
    if (!m) return;
    var host = document.querySelector('.story-share-bar') || document.querySelector('.hero-content');
    if (!host) return;
    host.appendChild(makePill(m[1]));
  }

  /* ---------- قسم "حكاياتي المفضلة" في الرئيسية ---------- */
  var sec = null, grid = null, kickerEl = null, titleEl = null;
  var stories = null, loadingStories = false;

  function buildHome() {
    var gate = document.getElementById('gateways');
    if (!gate || !gate.parentNode) return;
    sec = el('section', 'section khf-section');
    sec.id = 'khFavs';
    sec.hidden = true;
    sec.setAttribute('aria-labelledby', 'khFavsTitle');
    var wrap = el('div', 'wrap');
    var head = el('div', 'head');
    var box = el('div');
    kickerEl = el('div', 'kicker');
    titleEl = el('h2');
    titleEl.id = 'khFavsTitle';
    box.appendChild(kickerEl);
    box.appendChild(titleEl);
    head.appendChild(box);
    grid = el('div', 'khf-grid');
    wrap.appendChild(head);
    wrap.appendChild(grid);
    sec.appendChild(wrap);
    gate.parentNode.insertBefore(sec, gate);
  }

  function loadStories() {
    if (loadingStories) return;
    loadingStories = true;
    fetch(U('../../stories/index.json'), { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { stories = Array.isArray(j) ? j.filter(function (s) { return s && s.published !== false && s.title; }) : []; })
      .catch(function () { stories = []; })
      .then(function () { loadingStories = false; renderHome(); });
  }

  function renderHome() {
    if (!sec) return;
    if (!favs.length) { sec.hidden = true; grid.replaceChildren(); return; }
    if (stories === null) { loadStories(); return; }
    var l = lang();
    var items = stories.filter(function (s) { return isFav(String(s.id)) && !isHidden(String(s.id)); })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    grid.replaceChildren();
    if (!items.length) { sec.hidden = true; return; }
    kickerEl.textContent = T('kicker');
    titleEl.textContent = T('title');
    items.forEach(function (s) {
      var a = el('a', 'khf-card kh-fav-host');
      a.href = U('../../' + (s.path || ('stories/' + (s.section || '') + '/' + s.id + '/')));
      var dot = el('span', 'khf-dot');
      if (s.color && /^#[0-9a-f]{3,8}$/i.test(s.color)) dot.style.background = s.color;
      var body = el('span', 'khf-body');
      body.appendChild(el('span', 'khf-title', pick(s, 'title', l)));
      var person = pick(s, 'person', l);
      var meta = secName(s.section, l);
      body.appendChild(el('span', 'khf-meta', person ? person + ' · ' + meta : meta));
      a.appendChild(dot);
      a.appendChild(body);
      a.appendChild(makeStar(String(s.id)));
      grid.appendChild(a);
    });
    sec.hidden = false;
  }

  function refresh() { paintAll(); paintHidden(); renderHome(); }

  function init() {
    processCards();
    processStoryPage();
    buildHome();
    renderHome();
    loadHidden().then(function (a) { hiddenIds = a; refresh(); });
    var raf = 0;
    new MutationObserver(function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = 0; processCards(); processStoryPage(); });
    }).observe(document.body, { childList: true, subtree: true });
    new MutationObserver(refresh)
      .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    window.addEventListener('storage', function (e) {
      if (e.key === KEY) { favs = readFavs(); refresh(); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
