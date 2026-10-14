(function(){
  'use strict';
  var allowed=['ar','en','fr','it','de'];
  var dict={};
  var sharedLabels={
    ar:{s_like:'❤️ أعجبتني',s_liked:'تم تسجيل إعجابك',r_feedback_exists:'سجّلت رد فعل لهذه الحكاية بالفعل من هذا المتصفح.',r_like_exists:'سجّلت إعجابك بهذه الحكاية بالفعل.',r_saving:'جارٍ تسجيل اختيارك…',r_saved:'شكرًا لك! تم تسجيل اختيارك.',r_already_saved:'الاختيار مسجّل بالفعل لهذه الحكاية.',r_saved_count_error:'تعذر تسجيل رد الفعل.',r_save_error:'تعذر الاتصال. حاول مرة أخرى.',r_counts_error:'تعذر تحميل أعداد التفاعل.'},
    en:{s_like:'❤️ I liked this story',s_liked:'Your like has been recorded',r_feedback_exists:'You have already responded to this story from this browser.',r_like_exists:'You have already liked this story.',r_saving:'Saving your response…',r_saved:'Thank you! Your response has been recorded.',r_already_saved:'This response has already been recorded.',r_saved_count_error:'Could not record your response.',r_save_error:'Connection failed. Please try again.',r_counts_error:'Could not load reaction counts.'},
    fr:{s_like:'❤️ J’ai aimé ce récit',s_liked:'Votre appréciation a été enregistrée',r_feedback_exists:'Vous avez déjà réagi à ce récit depuis ce navigateur.',r_like_exists:'Vous avez déjà aimé ce récit.',r_saving:'Enregistrement de votre réaction…',r_saved:'Merci ! Votre réaction a été enregistrée.',r_already_saved:'Cette réaction a déjà été enregistrée.',r_saved_count_error:'Impossible d’enregistrer votre réaction.',r_save_error:'Connexion impossible. Veuillez réessayer.',r_counts_error:'Impossible de charger les nombres de réactions.'},
    it:{s_like:'❤️ Mi è piaciuta',s_liked:'Il tuo apprezzamento è stato registrato',r_feedback_exists:'Hai già reagito a questa storia da questo browser.',r_like_exists:'Hai già apprezzato questa storia.',r_saving:'Registrazione della tua reazione…',r_saved:'Grazie! La tua reazione è stata registrata.',r_already_saved:'Questa reazione è già stata registrata.',r_saved_count_error:'Impossibile registrare la tua reazione.',r_save_error:'Connessione non riuscita. Riprova.',r_counts_error:'Impossibile caricare i conteggi delle reazioni.'},
    de:{s_like:'❤️ I liked this story',s_liked:'Your like has been recorded',r_feedback_exists:'You have already responded to this story from this browser.',r_like_exists:'You have already liked this story.',r_saving:'Saving your response…',r_saved:'Thank you! Your response has been recorded.',r_already_saved:'This response has already been recorded.',r_saved_count_error:'Could not record your response.',r_save_error:'Connection failed. Please try again.',r_counts_error:'Could not load reaction counts.'}
  };
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
    if(query&&allowed.indexOf(value)>=0){try{localStorage.setItem('kh-lang',value);localStorage.setItem('lang',value)}catch(e){}}
    return allowed.indexOf(value)>=0?value:'ar';
  }
  function value(key){
    return (dict[current]&&dict[current][key]) || (sharedLabels[current]&&sharedLabels[current][key]) || (current==='de'&&dict.en&&dict.en[key]) || (dict.ar&&dict.ar[key]) || key;
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
