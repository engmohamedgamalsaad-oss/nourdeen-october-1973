(function(){
  'use strict';
  /* القائمة المدعومة تأتي من assets/shared/home-language-only.js (KH_LANG)؛ النسخة هنا احتياطية فقط للصفحات التي لا تحمّله */
  var allowed=(window.KH_LANG&&window.KH_LANG.supported)?window.KH_LANG.supported.slice():['ar','en','fr','it','de'];
  var dict={};
  var current=readLang();
  /* ترجمات لعناصر ثابتة في صفحة أكتوبر (نص عربي أصلي → اللغات الأخرى) */
  var XT={
    '← خالدون عبر التاريخ':{en:'← Immortals Through History',fr:'← Immortels à travers l’histoire',it:'← Immortali attraverso la storia',de:'← Unsterbliche Persönlichkeiten der Geschichte'},
    'رابط مباشر لحكايات أكتوبر':{en:'Direct link to the October stories',fr:'Lien direct vers les récits d’octobre',it:'Link diretto alle storie di ottobre',de:'Direkter Link zu den Oktober-Geschichten'},
    'رمز QR مستقل للوصول إلى هذا القسم ومشاركته أو طباعته، مع بقاء الحكايات جزءًا من خالدون عبر التاريخ.':{en:'A standalone QR code to reach this section, share it or print it, while the stories remain part of Immortals Through History.',fr:'Un code QR indépendant pour accéder à cette rubrique, la partager ou l’imprimer, les histoires restant une partie d’Immortels à travers l’histoire.',it:'Un codice QR indipendente per accedere a questa sezione, condividerla o stamparla, mentre le storie restano parte di Immortali attraverso la storia.',de:'Ein eigenständiger QR-Code, um diesen Bereich zu erreichen, zu teilen oder auszudrucken, während die Geschichten Teil von „Unsterbliche Persönlichkeiten der Geschichte“ bleiben.'},
    'رمز QR للوصول المباشر إلى حكايات أكتوبر 1973':{en:'QR code for direct access to the October 1973 stories',fr:'Code QR pour accéder directement aux récits d’octobre 1973',it:'Codice QR per accedere direttamente alle storie di ottobre 1973',de:'QR-Code für den direkten Zugang zu den Oktober-Geschichten 1973'},
    'رمز QR المستقل لحكايات أكتوبر':{en:'Standalone QR code for the October stories',fr:'Code QR indépendant pour les récits d’octobre',it:'Codice QR indipendente per le storie di ottobre',de:'Eigenständiger QR-Code für die Oktober-Geschichten'},
    'السابق':{en:'Previous',fr:'Précédent',it:'Precedente',de:'Zurück'},
    'التالي':{en:'Next',fr:'Suivant',it:'Successivo',de:'Weiter'},
    'اختيار الشريحة':{en:'Choose slide',fr:'Choisir la diapositive',it:'Scegli la diapositiva',de:'Folie auswählen'},
    'معرض الوسائط':{en:'Media gallery',fr:'Galerie multimédia',it:'Galleria multimediale',de:'Mediengalerie'},
    'هل تعلم':{en:'Did you know',fr:'Le saviez-vous',it:'Lo sapevi',de:'Schon gewusst?'}
  };
  function extras(){
    if(current==='ar')return;
    document.querySelectorAll('.khaledoon-return,.october-qr h2,.october-qr p').forEach(function(el){
      var t=XT[el.textContent.trim()];if(t&&t[current])el.textContent=t[current];
    });
    document.querySelectorAll('[aria-label],[alt]').forEach(function(el){
      ['aria-label','alt'].forEach(function(a){
        var v=el.getAttribute(a),t=v&&XT[v.trim()];
        if(t&&t[current])el.setAttribute(a,t[current]);
      });
    });
  }
  function readLang(){
    /* الصفحات المقفولة: اللغة هي اختيار الصفحة الرئيسية فقط، ولا يتجاوزها ?lang= */
    if(window.KH_LANG&&window.KH_LANG.locked)return window.KH_LANG.current;
    var params=new URLSearchParams(location.search);
    var query=params.get('lang');
    var saved='';
    /* kh-lang هو المفتاح المشترك مع صفحات خالدون؛ lang للتوافق مع النظام القديم */
    try{saved=localStorage.getItem('kh-lang')||localStorage.getItem('lang')||'';}catch(e){}
    var value=(query||saved||document.documentElement.lang||'ar').toLowerCase();
    return allowed.indexOf(value)>=0?value:'ar';
  }
  var missingKeys={};
  function value(key){
    var localized=dict[current]&&dict[current][key];
    if(localized!==undefined&&localized!==null&&localized!=='')return localized;
    if(current!=='ar'&&dict.ar&&dict.ar[key]!==undefined){
      missingKeys[current]=missingKeys[current]||{};
      missingKeys[current][key]=true;
      return dict.ar[key];
    }
    return key;
  }
  function auditTranslations(){
    var report={supported:allowed.slice(),missing:{},counts:{}};
    allowed.forEach(function(locale){
      var base=dict.ar||{}, translated=dict[locale]||{}, keys=Object.keys(base);
      report.missing[locale]=keys.filter(function(key){
        return translated[key]===undefined||translated[key]===null||translated[key]==='';
      });
      report.counts[locale]={total:keys.length,translated:keys.length-report.missing[locale].length,missing:report.missing[locale].length};
    });
    report.fallbacks={};
    Object.keys(missingKeys).forEach(function(locale){
      report.fallbacks[locale]=Object.keys(missingKeys[locale]);
    });
    return report;
  }
  function apply(){
    document.documentElement.lang=current;
    document.documentElement.dir=current==='ar'?'rtl':'ltr';
    document.querySelectorAll('[data-i18n]').forEach(function(el){
      var key=el.getAttribute('data-i18n');
      var text=value(key);
      if(text!==key) el.textContent=text;
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(function(el){
      el.getAttribute('data-i18n-attr').split(',').forEach(function(pair){
        var parts=pair.split(':');
        if(parts.length===2){var text=value(parts[1]);if(text!==parts[1])el.setAttribute(parts[0],text);}
      });
    });
    document.querySelectorAll('[data-lang-switch]').forEach(function(host){
      host.innerHTML='';
      host.hidden=false;host.style.display='';
      var labels={ar:'العربية',en:'English',fr:'Français',it:'Italiano'};
      allowed.forEach(function(lang){
        var button=document.createElement('button');
        button.type='button';button.className='lang-option'+(lang===current?' is-active':'');
        button.textContent=labels[lang];button.setAttribute('aria-pressed',String(lang===current));
        button.addEventListener('click',function(){setLang(lang);});
        host.appendChild(button);
      });
    });
    document.querySelectorAll('[data-lang-label]').forEach(function(el){el.textContent=value(el.getAttribute('data-lang-label'));});
    extras();
    document.dispatchEvent(new CustomEvent('site-language-change',{detail:{lang:current}}));
  }
  function setLang(lang){
    if(window.KH_LANG&&window.KH_LANG.locked)return; /* تغيير اللغة من الصفحة الرئيسية فقط */
    if(allowed.indexOf(lang)<0)return;
    current=lang;
    try{localStorage.setItem('lang',lang);localStorage.setItem('kh-lang',lang);}catch(e){}
    var url=new URL(location.href);url.searchParams.set('lang',lang);
    location.href=url.pathname+url.search+url.hash;
  }
  window.I18N={
    register:function(locale,entries){dict[locale]=Object.assign(dict[locale]||{},entries||{});},
    apply:function(){current=readLang();apply();},
    setLang:setLang,
    lang:function(){return current;},
    t:value,
    audit:auditTranslations
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){current=readLang();apply();});
  else {current=readLang();apply();}
})();
