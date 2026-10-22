/* محرك ترجمة صفحات الحكايات: منطق فقط. النصوص تُسجَّل من assets/i18n/story-common.js ومن translations.js في كل حكاية. */
(function(){
'use strict';
var reg=window.StoryI18N=window.StoryI18N||{text:{},meta:{}};
var translations=reg.text;
var pageMeta=reg.meta;
/* Supports both shared dictionaries {Arabic: {en,fr,it,de}} and story-local
   language-first dictionaries {en: {Arabic: translation}, ...}. */
function findTranslation(source, lang){
 var normalized=String(source==null?'':source).replace(/\s+/g,' ').trim();
 var direct=translations[normalized]||translations[source];
 if(direct&&typeof direct==='object'&&direct[lang])return direct;
 var byLanguage={};
 Object.keys(translations).forEach(function(language){
  var dictionary=translations[language];
  if(dictionary&&typeof dictionary==='object'){
   var value=dictionary[normalized];
   if(typeof value==='string')byLanguage[language]=value;
  }
 });
 return Object.keys(byLanguage).length?byLanguage:null;
}
function applyPageMeta(){
 var slug=document.body.getAttribute('data-story-slug');
 var lang=(window.I18N&&window.I18N.lang())||'ar';
 var meta=pageMeta[slug]&&pageMeta[slug][lang];
 if(!meta)return;
 document.title=meta[0];
 [['meta[name="description"]',meta[1]],['meta[property="og:title"]',meta[0]],['meta[property="og:description"]',meta[1]]].forEach(function(pair){
  var node=document.querySelector(pair[0]);if(node)node.setAttribute('content',pair[1]);
 });
}
document.addEventListener('DOMContentLoaded',applyPageMeta);
document.addEventListener('site-language-change',applyPageMeta);
if(document.readyState!=='loading')applyPageMeta();

function applyTranslationNotice(lang){
 var existing=document.getElementById('ai-translation-notice');
 if(lang==='ar'){
  if(existing)existing.remove();
  return;
 }
 var copy={
  en:{
   title:'Translation notice',
   body:'This page was translated from Arabic with the assistance of artificial intelligence (AI). The translation is provided for general information and accessibility; it may contain errors or omissions. The original Arabic text is the reference version. Please consult the cited sources when checking historical details.'
  },
  fr:{
   title:'Avis de traduction',
   body:'Cette page a été traduite de l’arabe avec l’aide de l’intelligence artificielle (IA). Cette traduction est fournie à titre informatif et pour faciliter l’accès au contenu ; elle peut comporter des erreurs ou des omissions. Le texte arabe original fait foi. Veuillez consulter les sources citées pour vérifier les détails historiques.'
  },
  it:{
   title:'Avviso sulla traduzione',
   body:'Questa pagina è stata tradotta dall’arabo con l’aiuto dell’intelligenza artificiale (IA). La traduzione è fornita a scopo informativo e per facilitare l’accesso ai contenuti; potrebbe contenere errori o omissioni. Il testo originale in arabo è la versione di riferimento. Per verificare i dettagli storici, consulta le fonti citate.'
  },
  de:{
   title:'Hinweis zur Übersetzung',
   body:'Diese Seite wurde mit Unterstützung künstlicher Intelligenz (KI) aus dem Arabischen übersetzt. Die Übersetzung dient der allgemeinen Information und Barrierefreiheit; sie kann Fehler oder Auslassungen enthalten. Maßgeblich ist der arabische Originaltext. Bitte prüfe historische Einzelheiten anhand der angegebenen Quellen.'
  }
 };
 var text=copy[lang];
 if(!text)return;
 if(!existing){
  existing=document.createElement('aside');
  existing.id='ai-translation-notice';
  existing.setAttribute('role','note');
  existing.style.cssText='box-sizing:border-box;width:calc(100% - 32px);max-width:900px;margin:24px auto 30px;padding:16px 20px;border:1px solid rgba(227,189,120,.42);border-left:4px solid #e3bd78;border-radius:12px;background:linear-gradient(135deg,rgba(12,35,45,.96),rgba(3,13,19,.98));color:#d9e3e4;font:400 .88rem/1.8 Arial,sans-serif;direction:ltr;text-align:left;box-shadow:0 10px 28px rgba(0,0,0,.22);';
  var heading=document.createElement('strong');
  heading.style.cssText='display:block;margin-bottom:7px;font-weight:700;color:#e3bd78;font-size:.78rem;letter-spacing:.04em;text-transform:uppercase;';
  heading.setAttribute('data-notice-title','');
  var paragraph=document.createElement('p');
  paragraph.style.cssText='margin:0;color:#d9e3e4;';
  paragraph.setAttribute('data-notice-body','');
  existing.appendChild(heading);
  existing.appendChild(paragraph);
  var footer=document.querySelector('footer');
  if(footer&&footer.parentNode)footer.parentNode.insertBefore(existing,footer.nextSibling);
  else document.body.appendChild(existing);
 }
 existing.querySelector('[data-notice-title]').textContent=text.title;
 existing.querySelector('[data-notice-body]').textContent=text.body;
}
var original=new WeakMap();
function applyFooterText(lang){
 document.querySelectorAll('.author,footer').forEach(function(footer){
 Array.prototype.forEach.call(footer.childNodes,function(node){
  if(node.nodeType!==3)return;
  if(!node.__storyI18nOriginal)node.__storyI18nOriginal=node.nodeValue;
  var originalText=node.__storyI18nOriginal;
  var normalized=originalText.replace(/\s+/g,' ').trim();
  var item=findTranslation(originalText,lang);
  if(lang==='ar'){node.nodeValue=originalText;return;}
  if(!item||!item[lang])return;
  var leading=(originalText.match(/^\s*/)||[''])[0];
  var trailing=(originalText.match(/\s*$/)||[''])[0];
  node.nodeValue=leading+item[lang]+trailing;
 });
 });
}
function apply(){
 var lang=(window.I18N&&window.I18N.lang())||document.documentElement.lang||'ar';
 var digitMap={'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};
 function normalizeLocalizedText(){
  if(lang==='ar')return;
  var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null,false),node;
  while((node=walker.nextNode())){
   if(!node.nodeValue||!/[٠-٩۰-۹]/.test(node.nodeValue))continue;
   var parent=node.parentElement;
   if(parent&&/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|CODE|PRE)$/.test(parent.tagName))continue;
   node.nodeValue=node.nodeValue.replace(/[٠-٩۰-۹]/g,function(d){return digitMap[d]||d;});
  }
  document.querySelectorAll('[alt],[aria-label],[title]').forEach(function(el){
   ['alt','aria-label','title'].forEach(function(attr){
    if(el.hasAttribute(attr))el.setAttribute(attr,el.getAttribute(attr).replace(/[٠-٩۰-۹]/g,function(d){return digitMap[d]||d;}));
   });
  });
 }
 function translateRemainingTextNodes(){
  if(lang==='ar')return;
  var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null,false),node;
  while((node=walker.nextNode())){
   var parent=node.parentElement;
   if(!parent||/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|CODE|PRE)$/.test(parent.tagName))continue;
   if(!/[\u0600-\u06FF]/.test(node.nodeValue))continue;
   var source=node.nodeValue,normalized=source.replace(/\s+/g,' ').trim();
   var item=findTranslation(source,lang);
   if(item&&item[lang]){
    var leading=(source.match(/^\s*/)||[''])[0],trailing=(source.match(/\s*$/)||[''])[0];
    node.nodeValue=leading+item[lang]+trailing;
   }
  }
 }
 document.querySelectorAll('h1,h2,h3,h4,p,figcaption,li,a,summary,blockquote,dt,dd,caption,time,.kicker,.quote,.panel h4,.lesson h4,.event h4,.reaction-count-line,.author strong,footer strong,.timeline h4,.timeline p,.timeline li,.sources h3,.sources li,.sources a,.ending h2,.ending p,.ending li,.story-ending h2,.story-ending p,.story-ending li').forEach(function(el){
   if(!original.has(el)) original.set(el,el.textContent);
   var ar=original.get(el);
   if(el.querySelector && el.querySelector('a')) return;
   if(el.children && el.children.length && !el.matches('a,footer strong')) return;
   if(lang==='ar'){if(el.textContent!==ar)el.textContent=ar;return;}
   var normalized=ar.replace(/\s+/g,' ').trim();
   var item=findTranslation(ar,lang);
   if(item&&item[lang]){if(el.textContent!==item[lang])el.textContent=item[lang];}
 });
 applyFooterText(lang);
 applyTranslationNotice(lang);
 document.querySelectorAll('[alt],[aria-label],[title]').forEach(function(el){
  ['alt','aria-label','title'].forEach(function(attr){
   if(!el.hasAttribute(attr))return;
   var prop='__storyI18nOriginal_'+attr;
   if(!el[prop])el[prop]=el.getAttribute(attr);
   var source=el[prop];
   var normalized=source.replace(/\s+/g,' ').trim();
   var item=findTranslation(source,lang);
   if(lang==='ar'){el.setAttribute(attr,(item&&item.ar)||source);return;}
   if(item&&item[lang])el.setAttribute(attr,item[lang]);
  });
 });
 translateRemainingTextNodes();
 normalizeLocalizedText();
}
document.addEventListener('DOMContentLoaded',apply);
document.addEventListener('site-language-change',apply);
if(document.readyState!=='loading')apply();
})();