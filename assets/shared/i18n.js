(function(){
  'use strict';
  var allowed=['ar','en','fr','it'];
  var dict={};
  var current='ar';
  function readLang(){
    var params=new URLSearchParams(location.search);
    var query=params.get('lang');
    var saved='';
    try{saved=localStorage.getItem('lang')||'';}catch(e){}
    var value=(query||saved||document.documentElement.lang||'ar').toLowerCase();
    return allowed.indexOf(value)>=0?value:'ar';
  }
  function value(key){
    return (dict[current]&&dict[current][key]) || (dict.ar&&dict.ar[key]) || key;
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
    document.dispatchEvent(new CustomEvent('site-language-change',{detail:{lang:current}}));
  }
  function setLang(lang){
    if(allowed.indexOf(lang)<0)return;
    current=lang;
    try{localStorage.setItem('lang',lang);}catch(e){}
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