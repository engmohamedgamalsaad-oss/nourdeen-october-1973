/* خالدون عبر التاريخ — رابط الحكاية بالخريطة التفاعلية.
   يضيف قسم «على الخريطة» في صفحات الحكايات 005–015 عندما يكون للحكاية مكان موثق في stories/places.json،
   وفيه رابط يفتح خريطة الصفحة الرئيسية (#khMap). لا يمس حكايات أكتوبر (001–004).
   إن كان في الصفحة رابط للخريطة بالفعل (.interactive-map-link) لا يضيف شيئًا؛ وإن كان فيها قسم .story-map-link بدون رابط يضيف الرابط فيه فقط.
   لا يستخدم innerHTML مع أي بيانات. يتبع لغة الصفحة (html lang) ويتحدّث عند تغييرها.
   ملاحظة: يحمّل أيضًا khaledoon-story-nav.js (أزرار «رجوع» و«الرئيسية» في الهيدر) من نفس المجلد،
   لأن هذا الملف تحمّله كل صفحات الحكايات المبنية على القالب الموحّد. */
(function () {
  'use strict';
  if (window.__khStoryMap) return;
  window.__khStoryMap = true;
  var cs = document.currentScript;
  try {
    if (cs && cs.src && !window.__khStoryNav) {
      var navScript = document.createElement('script');
      navScript.src = new URL('khaledoon-story-nav.js?v=20261031-nav-1', cs.src).href;
      document.head.appendChild(navScript);
    }
    if (cs && cs.src && !window.__khMotion) {
      var motionScript = document.createElement('script');
      motionScript.src = new URL('khaledoon-story-motion.js?v=20261031-motion-1', cs.src).href;
      document.head.appendChild(motionScript);
    }
  } catch (e) {}
  var LANGS = ['ar', 'en', 'fr', 'it', 'de'];
  var STR = {
    kicker: { ar: 'على الخريطة', en: 'On the map', fr: 'Sur la carte', it: 'Sulla mappa', de: 'Auf der Karte' },
    title: { ar: 'مكان مرتبط بالحكاية', en: 'A place linked to the story', fr: 'Un lieu lié à l’histoire', it: 'Un luogo legato alla storia', de: 'Ein Ort, der mit der Geschichte verbunden ist' },
    born: { ar: 'مكان الميلاد: ', en: 'Born in: ', fr: 'Lieu de naissance : ', it: 'Luogo di nascita: ', de: 'Geburtsort: ' },
    approx: { ar: 'الموقع تقريبي ويحتاج إلى مراجعة', en: 'Approximate location; verification needed', fr: 'Emplacement approximatif à vérifier', it: 'Posizione approssimativa da verificare', de: 'Ungefähre Lage; noch zu überprüfen' },
    link: { ar: '⌖ اعرض الحكاية على الكرة الأرضية التفاعلية ثلاثية الأبعاد ←', en: '⌖ Show this story on the interactive 3D globe →', fr: '⌖ Voir cette histoire sur le globe interactif 3D →', it: '⌖ Mostra la storia sul globo interattivo 3D →', de: '⌖ Diese Geschichte auf dem interaktiven 3D-Globus zeigen →' }
  };
  var refs = null;

  function lang() {
    var l = (document.documentElement.lang || 'ar').slice(0, 2).toLowerCase();
    return LANGS.indexOf(l) >= 0 ? l : 'ar';
  }
  function T(k) { var o = STR[k]; return o[lang()] || o.ar; }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function ok(n, lim) { return typeof n === 'number' && isFinite(n) && Math.abs(n) <= lim; }
  function siteRoot() {
    try { if (cs && cs.src) return new URL('../../', cs.src).href; } catch (e) {}
    return new URL('../../../', location.href).href;
  }

  function addStyle() {
    if (document.getElementById('khm-story-map-style')) return;
    var st = document.createElement('style');
    st.id = 'khm-story-map-style';
    st.textContent = '.interactive-map-link{display:inline-flex;align-items:center;gap:8px;margin-top:6px;padding:10px 20px;border:1px solid currentColor;border-radius:999px;font-weight:800;text-decoration:none;line-height:1.7}.interactive-map-link:hover{text-decoration:underline}.interactive-map-link:focus-visible{outline:3px solid currentColor;outline-offset:3px}@media print{.story-map-link .interactive-map-link{display:none}}';
    document.head.appendChild(st);
  }

  function placeText(p) {
    var l = lang();
    var name = p.place && (p.place[l] || p.place.ar);
    if (!name) return '';
    var label = (p.place_label && (p.place_label[l] || p.place_label.ar)) || T('born');
    return label + name;
  }

  function render() {
    if (!refs) return;
    if (refs.kicker) refs.kicker.textContent = T('kicker');
    if (refs.title) refs.title.textContent = T('title');
    if (refs.place) refs.place.textContent = placeText(refs.p);
    if (refs.approx) refs.approx.textContent = T('approx');
    refs.link.textContent = T('link');
  }

  function build(p, href) {
    var existing = document.querySelector('.story-map-link');
    var link = el('a', 'interactive-map-link');
    link.href = href;
    var linkWrap = el('p');
    linkWrap.appendChild(link);
    refs = { p: p, link: link };
    if (existing) {
      var box = existing.querySelector('.container') || existing;
      box.appendChild(linkWrap);
      render();
      return;
    }
    var sec = el('section', 'story story-map-link');
    sec.setAttribute('aria-labelledby', 'story-map-title');
    var c = el('div', 'container');
    refs.kicker = el('div', 'kicker');
    refs.title = el('h2');
    refs.title.id = 'story-map-title';
    refs.place = el('p');
    c.appendChild(refs.kicker); c.appendChild(refs.title); c.appendChild(refs.place);
    if (p.approximate === true) { refs.approx = el('p'); c.appendChild(refs.approx); }
    c.appendChild(linkWrap);
    sec.appendChild(c);
    var host = document.querySelector('main');
    if (!host) return;
    var end = host.querySelector('section.end');
    if (end) host.insertBefore(sec, end); else host.appendChild(sec);
    render();
  }

  function init() {
    var slug = document.body && document.body.getAttribute('data-story-slug');
    if (!slug || !/^0(0[5-9]|1[0-6])$/.test(slug)) return;
    if (document.querySelector('.interactive-map-link')) return;
    var root = siteRoot();
    fetch(new URL('stories/places.json', root).href, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (places) {
        var p = places && places[slug];
        if (!p || !ok(p.lat, 90) || !ok(p.lng, 180)) return;
        addStyle();
        build(p, new URL('index.html#khWorld', root).href);
        new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
