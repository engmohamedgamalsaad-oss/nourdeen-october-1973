/* محرك ترجمة صفحات الحكايات: منطق فقط. النصوص تُسجَّل من assets/i18n/story-common.js ومن translations.js في كل حكاية. */
(function(){
'use strict';
var reg=window.StoryI18N=window.StoryI18N||{text:{},meta:{}};
var translations=reg.text;
var pageMeta=reg.meta;
/* Supports both shared dictionaries {Arabic: {en,fr,it,de}} and story-local
   language-first dictionaries {en: {Arabic: translation}, ...}. */
var svgArtworkTranslations={"en":{"رسم توضيحي عن سميرة موسى والعلم":"Illustration about Sameera Moussa and science","رسم فني رمزي لدفتر علمي ونموذج ذرة. ليس صورة أرشيفية أو صورة شخصية لسميرة موسى.":"Symbolic artwork of a science notebook and an atomic model. Not an archival image or a portrait of Sameera Moussa.","رسم توضيحي — ليس صورة أرشيفية":"Illustration — not an archival image","حلم العلم للجميع":"A Dream of Science for Everyone","رسم توضيحي رمزي لكتاب علمي ونموذج ذرة، وليس صورة أرشيفية أو صورة شخصية للعالمة.":"Symbolic illustration of a science book and an atomic model, not an archival image or a portrait of the scientist.","سميرة موسى — حلم العلم للجميع":"Sameera Moussa — A Dream of Science for Everyone","رسم توضيحي، وليس صورة تاريخية":"Illustration, not a historical image","عمرو بن العاص — فتح مصر":"Amr ibn al-As — The Conquest of Egypt","غلاف توضيحي أصلي مستوحى من أروقة العمارة الإسلامية وجامع عمرو بن العاص، وليس صورة تاريخية أو بورتريه للشخصية.":"Original illustrative cover inspired by Islamic architecture and the Mosque of Amr ibn al-As; not a historical image or portrait of the figure.","خالدون عبر التاريخ":"Immortals Through History","عمرو بن العاص":"Amr ibn al-As","فتح مصر":"The Conquest of Egypt","غلاف توضيحي — ليس صورة تاريخية للشخصية":"Illustrative cover — not a historical portrait","رسم توضيحي لأروقة العمارة الإسلامية بألوان خضراء وذهبية، وليس صورة أرشيفية.":"Illustration of Islamic architectural arcades in green and gold; not an archival image.","رسم توضيحي — ليس صورة تاريخية أرشيفية":"Illustration — not a historical archival image","فاروق الباز":"Farouk El-Baz","رسم توضيحي لسطح القمر والصحراء ومسارات الاستكشاف، وليس صورة أرشيفية.":"Illustration of the lunar surface, desert, and exploration routes; not an archival photograph.","العالم الذي قرأ القمر والصحراء":"The Scientist Who Read the Moon and the Desert","حتشبسوت: الفرعون الذهبي على عرش النيل":"Hatshepsut: The Golden Pharaoh on the Nile","حتشبسوت":"Hatshepsut","رسم فني تخيلي مستوحى من معبد حتشبسوت والنقوش المصرية القديمة، وليس صورة أثرية.":"Imagined artwork inspired by Hatshepsut’s temple and ancient Egyptian inscriptions; not an archaeological photograph.","ملكة صنعت أثرًا خالدًا":"A Queen Who Left a Lasting Legacy","أبو بكر الخوارزمي: حكاية شاعر رحّالة":"Abu Bakr al-Khwarizmi: The Story of a Traveling Poet","رسم توضيحي لمخطوطات وكتابة بالحبر وطريق سفر في العصر العباسي، وليس صورة أرشيفية.":"Illustration of manuscripts, ink writing, and a travel route in the Abbasid era; not an archival image.","قصائد وكتب وطرق بين المدن":"Poems, Books, and Roads Between Cities","مجدي يعقوب":"Magdi Yacoub","رسم توضيحي لقلب بشري وخط نبض ورموز طبية، وليس صورة فوتوغرافية أو تصويرًا طبيًا حقيقيًا.":"Illustration of a human heart, heartbeat line, and medical symbols; not a photograph or real medical imaging.","قلب يمنح الأمل":"A Heart That Gives Hope","خالدون عبر التاريخ · رسم توضيحي":"Immortals Through History · Illustration"},"fr":{"رسم توضيحي عن سميرة موسى والعلم":"Illustration sur Sameera Moussa et la science","رسم فني رمزي لدفتر علمي ونموذج ذرة. ليس صورة أرشيفية أو صورة شخصية لسميرة موسى.":"Illustration symbolique d’un carnet scientifique et d’un modèle atomique. Ce n’est ni une archive ni un portrait de Sameera Moussa.","رسم توضيحي — ليس صورة أرشيفية":"Illustration — pas une image d’archive","حلم العلم للجميع":"Un rêve de science pour tous","رسم توضيحي رمزي لكتاب علمي ونموذج ذرة، وليس صورة أرشيفية أو صورة شخصية للعالمة.":"Illustration symbolique d’un livre scientifique et d’un modèle atomique, ni archive ni portrait de la scientifique.","سميرة موسى — حلم العلم للجميع":"Sameera Moussa — Un rêve de science pour tous","رسم توضيحي، وليس صورة تاريخية":"Illustration, pas une image historique","عمرو بن العاص — فتح مصر":"Amr ibn al-As — La conquête de l’Égypte","غلاف توضيحي أصلي مستوحى من أروقة العمارة الإسلامية وجامع عمرو بن العاص، وليس صورة تاريخية أو بورتريه للشخصية.":"Couverture illustrée originale inspirée de l’architecture islamique et de la mosquée d’Amr ibn al-As ; ni image historique ni portrait du personnage.","خالدون عبر التاريخ":"Les immortels à travers l’histoire","عمرو بن العاص":"Amr ibn al-As","فتح مصر":"La conquête de l’Égypte","غلاف توضيحي — ليس صورة تاريخية للشخصية":"Couverture illustrée — pas un portrait historique","رسم توضيحي لأروقة العمارة الإسلامية بألوان خضراء وذهبية، وليس صورة أرشيفية.":"Illustration d’arcades d’architecture islamique en vert et or ; pas une image d’archives.","رسم توضيحي — ليس صورة تاريخية أرشيفية":"Illustration — pas une image historique d’archives","فاروق الباز":"Farouk El-Baz","رسم توضيحي لسطح القمر والصحراء ومسارات الاستكشاف، وليس صورة أرشيفية.":"Illustration de la surface lunaire, du désert et des itinéraires d’exploration ; pas une photographie d’archives.","العالم الذي قرأ القمر والصحراء":"Le scientifique qui a lu la Lune et le désert","حتشبسوت: الفرعون الذهبي على عرش النيل":"Hatchepsout : le pharaon d’or sur le Nil","حتشبسوت":"Hatchepsout","رسم فني تخيلي مستوحى من معبد حتشبسوت والنقوش المصرية القديمة، وليس صورة أثرية.":"Illustration imaginaire inspirée du temple d’Hatchepsout et des inscriptions égyptiennes anciennes ; pas une photo archéologique.","ملكة صنعت أثرًا خالدًا":"Une reine au legs durable","أبو بكر الخوارزمي: حكاية شاعر رحّالة":"Abu Bakr al-Khwarizmi : l’histoire d’un poète voyageur","رسم توضيحي لمخطوطات وكتابة بالحبر وطريق سفر في العصر العباسي، وليس صورة أرشيفية.":"Illustration de manuscrits, d’écriture à l’encre et d’un itinéraire de voyage à l’époque abbasside ; pas une image d’archives.","قصائد وكتب وطرق بين المدن":"Poèmes, livres et routes entre les villes","مجدي يعقوب":"Magdi Yacoub","رسم توضيحي لقلب بشري وخط نبض ورموز طبية، وليس صورة فوتوغرافية أو تصويرًا طبيًا حقيقيًا.":"Illustration d’un cœur humain, d’un tracé de pouls et de symboles médicaux ; ni photographie ni imagerie médicale réelle.","قلب يمنح الأمل":"Un cœur qui donne de l’espoir","خالدون عبر التاريخ · رسم توضيحي":"Les immortels à travers l’histoire · Illustration"},"it":{"رسم توضيحي عن سميرة موسى والعلم":"Illustrazione su Sameera Moussa e la scienza","رسم فني رمزي لدفتر علمي ونموذج ذرة. ليس صورة أرشيفية أو صورة شخصية لسميرة موسى.":"Illustrazione simbolica di un quaderno scientifico e di un modello atomico. Non è una foto d’archivio né un ritratto di Sameera Moussa.","رسم توضيحي — ليس صورة أرشيفية":"Illustrazione — non è una foto d’archivio","حلم العلم للجميع":"Un sogno di scienza per tutti","رسم توضيحي رمزي لكتاب علمي ونموذج ذرة، وليس صورة أرشيفية أو صورة شخصية للعالمة.":"Illustrazione simbolica di un libro scientifico e di un modello atomico, non è una foto d’archivio né un ritratto della scienziata.","سميرة موسى — حلم العلم للجميع":"Sameera Moussa — Un sogno di scienza per tutti","رسم توضيحي، وليس صورة تاريخية":"Illustrazione, non un’immagine storica","عمرو بن العاص — فتح مصر":"Amr ibn al-As — La conquista dell’Egitto","غلاف توضيحي أصلي مستوحى من أروقة العمارة الإسلامية وجامع عمرو بن العاص، وليس صورة تاريخية أو بورتريه للشخصية.":"Copertina illustrata originale ispirata all’architettura islamica e alla moschea di Amr ibn al-As; non è un’immagine storica né un ritratto del personaggio.","خالدون عبر التاريخ":"Immortali attraverso la storia","عمرو بن العاص":"Amr ibn al-As","فتح مصر":"La conquista dell’Egitto","غلاف توضيحي — ليس صورة تاريخية للشخصية":"Copertina illustrata — non è un ritratto storico","رسم توضيحي لأروقة العمارة الإسلامية بألوان خضراء وذهبية، وليس صورة أرشيفية.":"Illustrazione di arcate dell’architettura islamica in verde e oro; non è una foto d’archivio.","رسم توضيحي — ليس صورة تاريخية أرشيفية":"Illustrazione — non è un’immagine storica d’archivio","فاروق الباز":"Farouk El-Baz","رسم توضيحي لسطح القمر والصحراء ومسارات الاستكشاف، وليس صورة أرشيفية.":"Illustrazione della superficie lunare, del deserto e dei percorsi di esplorazione; non è una foto d’archivio.","العالم الذي قرأ القمر والصحراء":"Lo scienziato che ha letto la Luna e il deserto","حتشبسوت: الفرعون الذهبي على عرش النيل":"Hatshepsut: il faraone dorato sul Nilo","حتشبسوت":"Hatshepsut","رسم فني تخيلي مستوحى من معبد حتشبسوت والنقوش المصرية القديمة، وليس صورة أثرية.":"Illustrazione immaginaria ispirata al tempio di Hatshepsut e alle antiche iscrizioni egizie; non è una foto archeologica.","ملكة صنعت أثرًا خالدًا":"Una regina che ha lasciato un’eredità duratura","أبو بكر الخوارزمي: حكاية شاعر رحّالة":"Abu Bakr al-Khwarizmi: la storia di un poeta viaggiatore","رسم توضيحي لمخطوطات وكتابة بالحبر وطريق سفر في العصر العباسي، وليس صورة أرشيفية.":"Illustrazione di manoscritti, scrittura a inchiostro e un itinerario di viaggio nell’epoca abbaside; non è una foto d’archivio.","قصائد وكتب وطرق بين المدن":"Poesie, libri e strade tra le città","مجدي يعقوب":"Magdi Yacoub","رسم توضيحي لقلب بشري وخط نبض ورموز طبية، وليس صورة فوتوغرافية أو تصويرًا طبيًا حقيقيًا.":"Illustrazione di un cuore umano, una linea del battito e simboli medici; non è una fotografia né un’immagine medica reale.","قلب يمنح الأمل":"Un cuore che dà speranza","خالدون عبر التاريخ · رسم توضيحي":"Immortali attraverso la storia · Illustrazione"},"de":{"رسم توضيحي عن سميرة موسى والعلم":"Illustration über Sameera Moussa und die Wissenschaft","رسم فني رمزي لدفتر علمي ونموذج ذرة. ليس صورة أرشيفية أو صورة شخصية لسميرة موسى.":"Symbolische Illustration eines wissenschaftlichen Notizbuchs und eines Atommodells. Kein Archivbild und kein Porträt von Sameera Moussa.","رسم توضيحي — ليس صورة أرشيفية":"Illustration — kein Archivbild","حلم العلم للجميع":"Ein Traum von Wissenschaft für alle","رسم توضيحي رمزي لكتاب علمي ونموذج ذرة، وليس صورة أرشيفية أو صورة شخصية للعالمة.":"Symbolische Illustration eines Wissenschaftsbuchs und eines Atommodells, kein Archivbild und kein Porträt der Wissenschaftlerin.","سميرة موسى — حلم العلم للجميع":"Sameera Moussa — Ein Traum von Wissenschaft für alle","رسم توضيحي، وليس صورة تاريخية":"Illustration, kein historisches Bild","عمرو بن العاص — فتح مصر":"Amr ibn al-As — Die Eroberung Ägyptens","غلاف توضيحي أصلي مستوحى من أروقة العمارة الإسلامية وجامع عمرو بن العاص، وليس صورة تاريخية أو بورتريه للشخصية.":"Originale Illustrationsgrafik, inspiriert von islamischer Architektur und der Amr-ibn-al-As-Moschee; kein historisches Bild und kein Porträt der Person.","خالدون عبر التاريخ":"Unsterbliche durch die Geschichte","عمرو بن العاص":"Amr ibn al-As","فتح مصر":"Die Eroberung Ägyptens","غلاف توضيحي — ليس صورة تاريخية للشخصية":"Illustrativer Einband — kein historisches Porträt","رسم توضيحي لأروقة العمارة الإسلامية بألوان خضراء وذهبية، وليس صورة أرشيفية.":"Illustration islamischer Arkaden in Grün und Gold; kein Archivbild.","رسم توضيحي — ليس صورة تاريخية أرشيفية":"Illustration — kein historisches Archivbild","فاروق الباز":"Farouk El-Baz","رسم توضيحي لسطح القمر والصحراء ومسارات الاستكشاف، وليس صورة أرشيفية.":"Illustration der Mondoberfläche, der Wüste und von Erkundungsrouten; kein Archivfoto.","العالم الذي قرأ القمر والصحراء":"Der Wissenschaftler, der Mond und Wüste zu lesen wusste","حتشبسوت: الفرعون الذهبي على عرش النيل":"Hatschepsut: Der goldene Pharao am Nil","حتشبسوت":"Hatschepsut","رسم فني تخيلي مستوحى من معبد حتشبسوت والنقوش المصرية القديمة، وليس صورة أثرية.":"Fantasievolle Illustration, inspiriert von Hatschepsuts Tempel und altägyptischen Inschriften; kein archäologisches Foto.","ملكة صنعت أثرًا خالدًا":"Eine Königin mit bleibendem Vermächtnis","أبو بكر الخوارزمي: حكاية شاعر رحّالة":"Abu Bakr al-Khwarizmi: Die Geschichte eines reisenden Dichters","رسم توضيحي لمخطوطات وكتابة بالحبر وطريق سفر في العصر العباسي، وليس صورة أرشيفية.":"Illustration von Manuskripten, Tuscheschrift und einer Reiseroute aus der Abbasidenzeit; kein Archivbild.","قصائد وكتب وطرق بين المدن":"Gedichte, Bücher und Wege zwischen Städten","مجدي يعقوب":"Magdi Yacoub","رسم توضيحي لقلب بشري وخط نبض ورموز طبية، وليس صورة فوتوغرافية أو تصويرًا طبيًا حقيقيًا.":"Illustration eines menschlichen Herzens, einer Pulslinie und medizinischer Symbole; weder Foto noch echte medizinische Aufnahme.","قلب يمنح الأمل":"Ein Herz, das Hoffnung schenkt","خالدون عبر التاريخ · رسم توضيحي":"Unsterbliche durch die Geschichte · Illustration"}};
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
 /* Story-specific and shared SVG artwork dictionaries are both valid translation sources. */
 var storyText=window.StoryI18N&&window.StoryI18N.text;
 [storyText,svgArtworkTranslations].forEach(function(source){
  if(!source||typeof source!=='object')return;
  Object.keys(source).forEach(function(language){
   var dictionary=source[language];
   if(dictionary&&typeof dictionary[normalized]==='string')byLanguage[language]=dictionary[normalized];
  });
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

/* Localize text embedded in same-origin SVG artwork used by <img> and CSS backgrounds.
   Original URLs are retained so switching back to Arabic restores the exact source asset. */
var localizedSvgUrls=Object.create(null);
var localizedSvgOriginalUrls=Object.create(null);
function currentStoryLanguage(){return (window.I18N&&window.I18N.lang())||document.documentElement.lang||'ar';}
function localizeSvgAsset(url,lang){
 if(lang==='ar')return Promise.resolve(url);
 var absolute;
 try{absolute=new URL(url,document.baseURI).href;}catch(e){return Promise.resolve(url);}
 if(!/^https?:$/.test(new URL(absolute).protocol)||new URL(absolute).origin!==window.location.origin||!/\.svg(?:[?#]|$)/i.test(absolute))return Promise.resolve(url);
 var cacheKey=lang+'|'+absolute;
 if(localizedSvgUrls[cacheKey])return Promise.resolve(localizedSvgUrls[cacheKey]);
 return fetch(absolute,{credentials:'same-origin'}).then(function(response){if(!response.ok)throw new Error('SVG fetch failed');return response.text();}).then(function(source){
  var parsed=new DOMParser().parseFromString(source,'image/svg+xml');
  if(parsed.querySelector('parsererror'))return url;
  var changed=false;
  parsed.querySelectorAll('text,tspan,title,desc').forEach(function(el){
   if(el.tagName.toLowerCase()==='text'&&el.querySelector('tspan'))return;
   var original=el.textContent||'';
   var item=findTranslation(original,lang);
   if(item&&item[lang]&&item[lang]!==original){el.textContent=item[lang];changed=true;}
  });
  parsed.querySelectorAll('[aria-label],[title]').forEach(function(el){
   ['aria-label','title'].forEach(function(attr){
    if(!el.hasAttribute(attr))return;
    var original=el.getAttribute(attr),item=findTranslation(original,lang);
    if(item&&item[lang]&&item[lang]!==original){el.setAttribute(attr,item[lang]);changed=true;}
   });
  });
  if(!changed)return url;
  var blob=new Blob([new XMLSerializer().serializeToString(parsed)],{type:'image/svg+xml;charset=utf-8'});
  var localizedUrl=URL.createObjectURL(blob);
  localizedSvgUrls[cacheKey]=localizedUrl;
  localizedSvgOriginalUrls[localizedUrl]=absolute;
  return localizedUrl;
 }).catch(function(){return url;});
}
function translateSvgArtwork(lang){
 var splashNodes=Array.prototype.slice.call(document.querySelectorAll('[data-splash]'));
 splashNodes.forEach(function(el){
  var source=el.__storySvgOriginalSplash||el.getAttribute('data-splash');
  if(!/\.svg(?:[?#]|$)/i.test(source))return;
  if(!el.__storySvgOriginalSplash)el.__storySvgOriginalSplash=source;
  if(lang==='ar'){if(el.getAttribute('data-splash')!==source)el.setAttribute('data-splash',source);return;}
  localizeSvgAsset(source,lang).then(function(localized){
   if(currentStoryLanguage()===lang&&el.isConnected&&el.getAttribute('data-splash')!==localized)el.setAttribute('data-splash',localized);
  });
 });
 var imgs=Array.prototype.slice.call(document.querySelectorAll('img[src]'));
 imgs.forEach(function(img){
  var currentSrc=img.getAttribute('src');
  var source=img.__storySvgOriginalSrc||(localizedSvgOriginalUrls[currentSrc]||currentSrc);
  if(!/\.svg(?:[?#]|$)/i.test(source)&&!localizedSvgOriginalUrls[currentSrc])return;
  if(!img.__storySvgOriginalSrc)img.__storySvgOriginalSrc=source;
  if(lang==='ar'){if(img.getAttribute('src')!==source)img.setAttribute('src',source);return;}
  localizeSvgAsset(source,lang).then(function(localized){
   if(currentStoryLanguage()===lang&&img.isConnected&&img.getAttribute('src')!==localized)img.setAttribute('src',localized);
  });
 });
 var bgCandidates=Array.prototype.slice.call(document.querySelectorAll('body *'));
 bgCandidates.forEach(function(el){
  var current=el.style.backgroundImage||window.getComputedStyle(el).backgroundImage||'';
  var source=el.__storySvgOriginalBackground;
  if(source===undefined){
   if(!/\.svg(?:[?#][^)]*)?["']?\s*\)/i.test(current))return;
   source=current;el.__storySvgOriginalBackground=source;
  }
  if(!/\.svg(?:[?#][^)]*)?["']?\s*\)/i.test(source))return;
  if(lang==='ar'){if(el.style.backgroundImage!==source)el.style.backgroundImage=source;return;}
  var urls=source.match(/url\((['"]?)(.*?)\1\)/g)||[];
  if(!urls.length)return;
  Promise.all(urls.map(function(entry){
   var match=entry.match(/url\((['"]?)(.*?)\1\)/);if(!match)return Promise.resolve(entry);
   return localizeSvgAsset(match[2],lang).then(function(localized){return 'url("'+localized.replace(/"/g,'%22')+'")';});
  })).then(function(replacements){
   if(currentStoryLanguage()!==lang||!el.isConnected)return;
   var next=source;urls.forEach(function(old,i){next=next.replace(old,replacements[i]);});
   el.style.backgroundImage=next;
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
 translateSvgArtwork(lang);
}
document.addEventListener('DOMContentLoaded',apply);
document.addEventListener('site-language-change',apply);
if(document.readyState!=='loading')apply();
})();