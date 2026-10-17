/* خالدون عبر التاريخ — ترجمة aria-label ووصف الصفحة (meta description) في صفحة شخصيات المناهج.
   khaledoon.js يترجم نصوص الصفحة فقط، فكانت قيم aria-label ووصف الصفحة تبقى بالعربية في كل اللغات.
   هذا الملف يقرأ اللغة من <html lang> (التي يضبطها khaledoon.js) ويطبّق الترجمة عند التحميل وعند كل تغيير للغة.
   الإنجليزية والفرنسية والإيطالية هنا؛ الألمانية من القاموس الموحد window.KH_DE (khaledoon-de.js).
   أي نص بلا ترجمة يبقى بالعربية ولا يظهر "undefined". */
(function () {
  'use strict';
  var LG = ['ar', 'en', 'fr', 'it', 'de'];
  var T = {
    'التنقل': ['Navigation', 'Navigation', 'Navigazione'],
    'خالدون عبر التاريخ': ['Immortals Through History', 'Immortels à travers l’histoire', 'Immortali attraverso la storia'],
    'حكايات ممتعة وموثقة لشخصيات مختارة وردت في المناهج المصرية، مصنفة حسب المرحلة والصف والمادة.': [
      'Enjoyable, documented stories of selected figures from the Egyptian curricula, organized by stage, grade and subject.',
      'Des histoires captivantes et documentées de personnages choisis dans les programmes égyptiens, classées par cycle, classe et matière.',
      'Storie piacevoli e documentate di personaggi scelti dai programmi egiziani, organizzate per ciclo, classe e materia.'
    ]
  };
  var de = document.documentElement;
  var md = document.querySelector('meta[name=description]');

  function tx(s, i) {
    var k = (s || '').trim();
    if (!k || i <= 0) return s;
    if (i === 4) return (window.KH_DE && window.KH_DE[k]) || s;
    var r = T[k];
    return (r && r[i - 1]) || s;
  }

  function apply() {
    var i = Math.max(LG.indexOf(de.lang), 0);
    Array.prototype.forEach.call(document.querySelectorAll('[aria-label]'), function (el) {
      if (el.__khAria === undefined) el.__khAria = el.getAttribute('aria-label');
      el.setAttribute('aria-label', tx(el.__khAria, i));
    });
    if (md) {
      /* khaledoon.js يحفظ الوصف الأصلي في md.__o قبل أن يغيّره؛ نبدأ منه كي لا نترجم نصًا مترجمًا */
      var orig = md.__o !== undefined ? md.__o : md.getAttribute('content');
      if (md.__khDesc === undefined) md.__khDesc = orig;
      md.setAttribute('content', tx(md.__khDesc, i));
    }
  }

  new MutationObserver(apply).observe(de, { attributes: true, attributeFilter: ['lang'] });
  apply();
})();
