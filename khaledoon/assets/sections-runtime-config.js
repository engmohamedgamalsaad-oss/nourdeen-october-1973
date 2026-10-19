/* Public runtime reader for the admin-approved section draft.
   Only the sections row is readable publicly; prompt records stay admin-only. */
(function(){
'use strict';
var API='https://ypwprddkscnfblhftkeb.supabase.co',KEY='sb_publishable_JJnVwx8HQAJNxSok32L-qg_83fXk5Qn';
var cache=null,styles=null;
function language(){var l=document.documentElement.lang||'ar';try{l=localStorage.getItem('kh-lang')||l}catch(e){}return ['ar','en','fr','it','de'].indexOf(l)>=0?l:'ar'}
function titleFor(s,l){return s&&s.i18n&&s.i18n[l]&&s.i18n[l].title||s.title||s.id}
function fetchConfig(){if(cache)return cache;cache=fetch(API+'/rest/v1/khaledoon_admin_config?config_key=eq.sections&select=config_value&limit=1',{headers:{apikey:KEY,Authorization:'Bearer '+KEY},cache:'no-store'}).then(function(r){return r.ok?r.json():[]}).then(function(rows){return rows&&rows[0]&&rows[0].config_value||null}).catch(function(){return null});return cache}
function customStyle(){if(styles)return;styles=document.createElement('style');styles.textContent='.gate[data-kh-custom-colors="true"]{background:var(--kh-section-inner)!important;border-color:var(--kh-section-outer)!important}.gate[data-kh-custom-colors="true"] .sym{color:var(--kh-section-outer)}';document.head.appendChild(styles)}
function apply(){
 if(!cache)return;
 fetchConfig().then(function(config){
  if(!config||!config.data||!Array.isArray(config.data.sections))return;
  var sections=config.data.sections,colors=config.colors||{},lang=language(),grid=document.querySelector('.gates'),active={};
  Array.prototype.forEach.call(document.querySelectorAll('.gate[href]'),function(card){var m=card.getAttribute('href').match(/khaledoon\/collections\/([a-z0-9-]+)\.html(?:[?#].*)?$/);if(m)card.setAttribute('data-kh-section',m[1])});
  sections.forEach(function(sec){
   if(!sec||!sec.id||!/^[-a-z0-9]{1,50}$/.test(sec.id))return;active[sec.id]=true;
   var href='khaledoon/collections/'+sec.id+'.html';
   var card=Array.prototype.find.call(document.querySelectorAll('.gate[href]'),function(a){return a.getAttribute('href')===href||a.getAttribute('data-kh-section')===sec.id});
   if(!card&&grid){
    card=document.createElement('a');card.className='gate reveal dynamic-section-card';card.setAttribute('data-kh-section',sec.id);card.setAttribute('data-m','✦');card.href='khaledoon/collections/dynamic.html?section='+encodeURIComponent(sec.id);
    var sym=document.createElement('span');sym.className='sym';sym.setAttribute('aria-hidden','true');sym.textContent='✦';
    var h=document.createElement('h3');var p=document.createElement('p');var go=document.createElement('span');go.className='go';go.textContent=({ar:'اكتشف الحكايات ←',en:'Explore stories →',fr:'Découvrir les récits →',it:'Scopri le storie →',de:'Geschichten entdecken →'})[lang];
    card.append(sym,h,p,go);grid.appendChild(card);
   }
   if(!card)return;
   card.setAttribute('data-kh-section',sec.id);
   var h3=card.querySelector('h3');if(h3)h3.textContent=titleFor(sec,lang);
   if(card.classList.contains('dynamic-section-card')){var p=card.querySelector('p');if(p)p.textContent=({ar:'حكايات هذا القسم تُضاف بعد المراجعة والتحقق من المصادر.',en:'Stories in this section are added after review and source checks.',fr:'Les récits sont ajoutés après vérification des sources.',it:'Le storie vengono aggiunte dopo la revisione delle fonti.',de:'Geschichten werden nach Prüfung der Quellen ergänzt.'})[lang]}
   var color=colors[sec.id],valid=function(x){return typeof x==='string'&&/^#[0-9a-f]{6}$/i.test(x)};
   if(color&&valid(color.outer)&&valid(color.inner)){customStyle();card.dataset.khCustomColors='true';card.style.setProperty('--kh-section-outer',color.outer);card.style.setProperty('--kh-section-inner',color.inner)}
  });
  if(grid){Array.prototype.forEach.call(grid.querySelectorAll('.gate[data-kh-section]'),function(card){if(!active[card.getAttribute('data-kh-section')])card.remove()})}
 });
}
fetchConfig().then(function(){apply()});
document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('.langs button'))requestAnimationFrame(apply)});
new MutationObserver(function(){apply()}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
window.addEventListener('storage',function(e){if(e.key==='kh-lang'||e.key==='lang')apply()});
})();