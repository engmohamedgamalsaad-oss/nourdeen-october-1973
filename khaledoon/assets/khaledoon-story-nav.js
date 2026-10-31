/* خالدون عبر التاريخ — أزرار التنقل في هيدر الحكايات: «رجوع» و«الرئيسية».
   تُضاف داخل الهيدر الموحّد (header .bar) في صفحات الحكايات المبنية على القالب الموحّد.
   لا تغيّر شكل الهيدر: الاسم وأزرار اللغة وزر الفاتح/الداكن كما هي، والأزرار الجديدة بجوار الاسم فقط.
   لا تعمل إن كان في الهيدر رابط بالفعل (حكايات أكتوبر 001–004 وأي صفحة اسم الموقع فيها رابط).
   «رجوع»: يرجع للصفحة السابقة إن جاء القارئ من صفحة في نفس الموقع، وإلا يفتح صفحة قسم الحكاية.
   «الرئيسية»: تفتح الصفحة الرئيسية للموقع. الأسماء تتبع لغة الصفحة (html lang) وتتحدّث عند تغييرها.
   على الموبايل (عرض 700px أو أقل) تظهر الأزرار أيقونات فقط حتى يبقى الهيدر في الحجم نفسه.
   لا يستخدم innerHTML. يُحمَّل من khaledoon-story-map-link.js (نفس المجلد). */
(function () {
  'use strict';
  if (window.__khStoryNav) return;
  window.__khStoryNav = true;
  var cs = document.currentScript;
  var LANGS = ['ar', 'en', 'fr', 'it', 'de'];
  var STR = {
    back: { ar: 'رجوع', en: 'Back', fr: 'Retour', it: 'Indietro', de: 'Zurück' },
    home: { ar: 'الرئيسية', en: 'Home', fr: 'Accueil', it: 'Home', de: 'Startseite' },
    nav: { ar: 'التنقل', en: 'Navigation', fr: 'Navigation', it: 'Navigazione', de: 'Navigation' }
  };
  /* صفحات الأقسام الموجودة في khaledoon/collections */
  var SECTIONS = ['october', 'history', 'science', 'women', 'people', 'islamic', 'curriculum'];
  var NS = 'http://www.w3.org/2000/svg';
  var ICON_BACK = 'M5 12h14M13 6l6 6-6 6';
  var ICON_HOME = 'M3 11.5 12 4l9 7.5M5.5 10v9.5H10V14h4v5.5h4.5V10';
  var refs = null;

  function lang() {
    var l = (document.documentElement.lang || 'ar').slice(0, 2).toLowerCase();
    return LANGS.indexOf(l) >= 0 ? l : 'ar';
  }
  function T(k) { var o = STR[k]; return o[lang()] || o.ar; }
  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }
  function siteRoot() {
    try { if (cs && cs.src) return new URL('../../', cs.src).href; } catch (e) {}
    return new URL('../../../', location.href).href;
  }
  function homeUrl() { return new URL('index.html', siteRoot()).href; }
  function sectionUrl() {
    var s = (document.body && document.body.getAttribute('data-section')) || '';
    if (SECTIONS.indexOf(s) >= 0) return new URL('khaledoon/collections/' + s + '.html', siteRoot()).href;
    return homeUrl();
  }
  /* هل جاء القارئ من صفحة أخرى داخل هذا الموقع نفسه؟ */
  function cameFromSite() {
    try {
      if (!document.referrer || history.length < 2) return false;
      var r = new URL(document.referrer);
      var base = new URL(siteRoot());
      return r.origin === base.origin &&
        r.pathname.indexOf(base.pathname) === 0 &&
        r.href.split('#')[0] !== location.href.split('#')[0];
    } catch (e) { return false; }
  }
  function icon(d) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', '18');
    s.setAttribute('height', '18');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '2');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    s.appendChild(p);
    return s;
  }
  function button(cls, iconPath) {
    var a = el('a', 'kh-nav-btn ' + cls);
    var label = el('span', 'kh-nav-label');
    a.appendChild(icon(iconPath));
    a.appendChild(label);
    return { a: a, label: label };
  }

  function addStyle() {
    if (document.getElementById('kh-story-nav-style')) return;
    var st = document.createElement('style');
    st.id = 'kh-story-nav-style';
    st.textContent =
      '.kh-start{display:flex;align-items:center;gap:10px;min-width:0;flex:0 1 auto}' +
      '.kh-nav{display:flex;align-items:center;gap:6px;flex:0 0 auto}' +
      'header .kh-nav-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:36px;padding:6px 13px;font:700 .85rem Cairo,Arial,sans-serif;line-height:1;white-space:nowrap;text-decoration:none;color:var(--text);background:color-mix(in srgb,var(--accent) 5%,var(--panel));border:1px solid color-mix(in srgb,var(--accent) 40%,var(--line));border-radius:999px;cursor:pointer;transition:transform .18s ease,border-color .18s ease}' +
      'header .kh-nav-btn:hover{transform:translateY(-1px);border-color:var(--accent)}' +
      'header .kh-nav-btn svg{flex:0 0 auto}' +
      'html[dir=ltr] header .kh-nav-back svg{transform:scaleX(-1)}' +
      'body[data-theme=light] header .kh-nav-btn{background:var(--panel);color:var(--text);border-color:var(--line)}' +
      '@media(max-width:700px){' +
        '.kh-start{grid-area:brand;gap:8px}' +
        '.kh-start .brand{flex:1 1 auto;min-width:0}' +
        'header .kh-nav-btn{width:34px;min-height:34px;padding:0}' +
        'header .kh-nav-label{display:none}' +
      '}' +
      '@media(prefers-reduced-motion:reduce){header .kh-nav-btn{transition:none!important;transform:none!important}}' +
      '@media print{.kh-nav{display:none!important}}';
    document.head.appendChild(st);
  }

  function render() {
    if (!refs) return;
    refs.nav.setAttribute('aria-label', T('nav'));
    refs.back.label.textContent = T('back');
    refs.back.a.setAttribute('aria-label', T('back'));
    refs.back.a.title = T('back');
    refs.home.label.textContent = T('home');
    refs.home.a.setAttribute('aria-label', T('home'));
    refs.home.a.title = T('home');
  }

  function build(header) {
    var bar = header.querySelector('.bar') || header;
    var brand = bar.querySelector('.brand');
    var nav = el('nav', 'kh-nav');
    var back = button('kh-nav-back', ICON_BACK);
    var home = button('kh-nav-home', ICON_HOME);
    back.a.href = sectionUrl();
    home.a.href = homeUrl();
    back.a.addEventListener('click', function (e) {
      back.a.href = sectionUrl();
      if (cameFromSite()) { e.preventDefault(); history.back(); }
    });
    nav.appendChild(back.a);
    nav.appendChild(home.a);
    refs = { nav: nav, back: back, home: home };
    if (brand && brand.parentNode === bar) {
      /* الاسم والأزرار في مجموعة واحدة حتى يبقى توزيع الهيدر (الاسم | اللغات | الفاتح) كما هو */
      var start = el('div', 'kh-start');
      bar.insertBefore(start, brand);
      start.appendChild(nav);
      start.appendChild(brand);
    } else {
      bar.insertBefore(nav, bar.firstChild);
    }
    render();
  }

  function init() {
    var header = document.querySelector('body > header');
    if (!header || header.querySelector('.kh-nav') || header.querySelector('a[href]')) return;
    addStyle();
    build(header);
    new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
