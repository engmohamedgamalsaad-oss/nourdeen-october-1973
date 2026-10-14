(function(){
  'use strict';
  var allowed=['ar','en','fr','it','de'];
  var dict={};
  var current=readLang();
  /* ترجمات لعناصر ثابتة في صفحة أكتوبر (نص عربي أصلي → اللغات الأخرى) */
  var XT={
    '← خالدون عبر التاريخ':{en:'← Immortals Through History',fr:'← Immortels à travers l’histoire',it:'← Immortali attraverso la storia'},
    'رابط مباشر لحكايات أكتوبر':{en:'Direct link to the October stories',fr:'Lien direct vers les récits d’octobre',it:'Link diretto alle storie di ottobre'},
    'رمز QR مستقل للوصول إلى هذا القسم ومشاركته أو طباعته، مع بقاء الحكايات جزءًا من خالدون عبر التاريخ.':{en:'A standalone QR code to reach this section, share it or print it, while the stories remain part of Immortals Through History.',fr:'Un code QR indépendant pour accéder à cette rubrique, la partager ou l’imprimer, les histoires restant une partie d’Immortels à travers l’histoire.',it:'Un codice QR indipendente per accedere a questa sezione, condividerla o stamparla, mentre le storie restano parte di Immortali attraverso la storia.'},
    'رمز QR للوصول المباشر إلى حكايات أكتوبر 1973':{en:'QR code for direct access to the October 1973 stories',fr:'Code QR pour accéder directement aux récits d’octobre 1973',it:'Codice QR per accedere direttamente alle storie di ottobre 1973'},
    'رمز QR المستقل لحكايات أكتوبر':{en:'Standalone QR code for the October stories',fr:'Code QR indépendant pour les récits d’octobre',it:'Codice QR indipendente per le storie di ottobre'},
    'السابق':{en:'Previous',fr:'Précédent',it:'Precedente'},
    'التالي':{en:'Next',fr:'Suivant',it:'Successivo'},
    'اختيار الشريحة':{en:'Choose slide',fr:'Choisir la diapositive',it:'Scegli la diapositiva'},
    'معرض الوسائط':{en:'Media gallery',fr:'Galerie multimédia',it:'Galleria multimediale'},
    'هل تعلم':{en:'Did you know',fr:'Le saviez-vous',it:'Lo sapevi'}
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
    var params=new URLSearchParams(location.search);
    var query=params.get('lang');
    var saved='';
    /* kh-lang هو المفتاح المشترك مع صفحات خالدون؛ lang للتوافق مع النظام القديم */
    try{saved=localStorage.getItem('kh-lang')||localStorage.getItem('lang')||'';}catch(e){}
    var value=(query||saved||document.documentElement.lang||'ar').toLowerCase();
    return allowed.indexOf(value)>=0?value:'ar';
  }
  function value(key){
    return (dict[current]&&dict[current][key]) || (current==='de'&&dict.en&&dict.en[key]) || (dict.ar&&dict.ar[key]) || key;
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
      var labels={ar:'العربية',en:'English',fr:'Français',it:'Italiano',de:'Deutsch'};
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
    t:value
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){current=readLang();apply();});
  else {current=readLang();apply();}
})();
