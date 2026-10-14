/* خالدون عبر التاريخ — اللغة تُختار من الصفحة الرئيسية فقط.
   يحتفظ الموقع باللغة بين الأقسام والحكايات، ويخفي مبدلات اللغة الداخلية. */
(function(){
  'use strict';
  var lang='ar';
  try { lang=localStorage.getItem('kh-lang') || localStorage.getItem('lang') || 'ar'; } catch(e) {}
  if(['ar','en','fr','it'].indexOf(lang)<0) lang='ar';
  document.documentElement.lang=lang;
  document.documentElement.dir=lang==='ar'?'rtl':'ltr';
  var style=document.createElement('style');
  style.setAttribute('data-home-language-only','true');
  style.textContent='.lang-switch,.language-switch,.langs,[data-lang-switch],.language-selector,.lang-selector{display:none!important;visibility:hidden!important}';
  (document.head||document.documentElement).appendChild(style);
  try {
    var url=new URL(location.href);
    if(url.searchParams.has('lang')) {
      url.searchParams.delete('lang');
      history.replaceState(null,'',url.pathname+url.search+url.hash);
    }
  } catch(e) {}
})();
