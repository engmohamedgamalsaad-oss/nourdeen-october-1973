/* Runtime for the generic collection page used by admin-created sections. */
(function(){
'use strict';
var API='https://ypwprddkscnfblhftkeb.supabase.co',KEY='sb_publishable_JJnVwx8HQAJNxSok32L-qg_83fXk5Qn';
var params=new URLSearchParams(location.search),id=params.get('section')||'';
if(!/^[a-z0-9-]{1,50}$/.test(id)){id='';}
if(id)document.body.setAttribute('data-story-section',id);
var box=document.querySelector('[data-story-collection]');if(box&&id)box.setAttribute('data-story-collection',id);
function lang(){var l=document.documentElement.lang||'ar';try{l=localStorage.getItem('kh-lang')||l}catch(e){}return ['ar','en','fr','it','de'].indexOf(l)>=0?l:'ar'}
function titleFor(s,l){return s&&s.i18n&&s.i18n[l]&&s.i18n[l].title||s.title||s.id}
function apply(){
 if(!id)return;
 fetch(API+'/rest/v1/khaledoon_admin_config?config_key=eq.sections&select=config_value&limit=1',{headers:{apikey:KEY,Authorization:'Bearer '+KEY},cache:'no-store'})
 .then(function(r){if(!r.ok)throw Error('config');return r.json()})
 .then(function(rows){
  var value=rows&&rows[0]&&rows[0].config_value,config=value&&value.data,sections=config&&config.sections;
  var section=Array.isArray(sections)&&sections.find(function(s){return s&&s.id===id});
  if(!section){document.querySelector('.hero .lead').textContent='هذا القسم غير موجود في الإعدادات المعتمدة.';return}
  var l=lang(),title=titleFor(section,l),h=document.querySelector('.hero h1'),lead=document.querySelector('.hero .lead');
  if(h)h.textContent=title;
  if(lead)lead.textContent=({ar:'حكايات هذا القسم تُعرض بعد مراجعة المحتوى والتحقق من المصادر.',en:'Stories in this section appear after content review and source verification.',fr:'Les récits de cette rubrique sont affichés après révision et vérification des sources.',it:'Le storie di questa sezione vengono mostrate dopo la revisione e la verifica delle fonti.',de:'Geschichten in diesem Bereich erscheinen nach Prüfung des Inhalts und der Quellen.'})[l];
  document.title=title+' | خالدون عبر التاريخ';
  var color=value.colors&&value.colors[id],valid=function(x){return typeof x==='string'&&/^#[0-9a-f]{6}$/i.test(x)};
  if(color&&valid(color.outer)&&valid(color.inner)){
   document.documentElement.style.setProperty('--kh-section-outer',color.outer);
   document.documentElement.style.setProperty('--kh-section-inner',color.inner);
   var style=document.getElementById('khDynamicSectionStyle');
   if(!style){style=document.createElement('style');style.id='khDynamicSectionStyle';style.textContent='.history-page .hero .eyebrow{color:var(--kh-section-outer)}.story-index-card{border-color:var(--kh-section-outer)}.story-index-empty{border-color:var(--kh-section-outer)}';document.head.appendChild(style)}
  }
 }).catch(function(){});
}
apply();
document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('.langs button'))requestAnimationFrame(apply)});
new MutationObserver(function(){apply()}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();