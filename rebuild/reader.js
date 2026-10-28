(function(){
'use strict';
var langs=['ar','en','fr','it','de'],labels={ar:'الراوي',en:'Narrator',fr:'Narrateur',it:'Narratore',de:'Erzähler'};
var ui={ar:{section:'الحكاية',story:'الحكاية',gallery:'صور الحكاية',quiz:'اختبر فهمك',sources:'المصادر والتحقق',map:'مكان الحكاية',mapOpen:'افتح الموقع على الخريطة',start:'ابدأ الحكاية',karma:'كارما',narrator:'الراوي',student:'إعداد وتقديم',answer:'تحقق من الإجابة',themeLight:'الوضع الفاتح',themeDark:'الوضع الداكن',missing:'الحزمة ناقصة أو غير متوافقة مع KHALEDOON_STORY_V2.'},
en:{section:'Story',story:'The story',gallery:'Story images',quiz:'Check your understanding',sources:'Sources and verification',map:'Story location',mapOpen:'Open map location',start:'Start story',karma:'Karma',narrator:'Narrator',student:'Prepared and presented by',answer:'Check answer',themeLight:'Light mode',themeDark:'Dark mode',missing:'Package is incomplete or does not match KHALEDOON_STORY_V2.'},
fr:{section:'Récit',story:'Le récit',gallery:'Images du récit',quiz:'Vérifiez votre compréhension',sources:'Sources et vérification',map:'Lieu du récit',mapOpen:'Ouvrir la carte',start:'Commencer le récit',karma:'Karma',narrator:'Narrateur',student:'Préparé et présenté par',answer:'Vérifier la réponse',themeLight:'Mode clair',themeDark:'Mode sombre',missing:'Le dossier est incomplet ou incompatible avec KHALEDOON_STORY_V2.'},
it:{section:'Racconto',story:'Il racconto',gallery:'Immagini del racconto',quiz:'Verifica la comprensione',sources:'Fonti e verifica',map:'Luogo del racconto',mapOpen:'Apri la mappa',start:'Inizia il racconto',karma:'Karma',narrator:'Narratore',student:'Preparato e presentato da',answer:'Verifica la risposta',themeLight:'Tema chiaro',themeDark:'Tema scuro',missing:'Il pacchetto è incompleto o non corrisponde a KHALEDOON_STORY_V2.'},
de:{section:'Geschichte',story:'Die Geschichte',gallery:'Bilder zur Geschichte',quiz:'Verständnis prüfen',sources:'Quellen und Überprüfung',map:'Ort der Geschichte',mapOpen:'Kartenstandort öffnen',start:'Geschichte starten',karma:'Karma',narrator:'Erzähler',student:'Erstellt und vorgestellt von',answer:'Antwort prüfen',themeLight:'Heller Modus',themeDark:'Dunkler Modus',missing:'Das Paket ist unvollständig oder entspricht nicht KHALEDOON_STORY_V2.'}};
var sectionLabels={ar:{october:'حكايات أكتوبر 1973',history:'التاريخ والحضارات',science:'العلم والعلماء',women:'المرأة والقيادة',people:'الشخصيات',curriculum:'المناهج الدراسية',islamic:'التاريخ الإسلامي',readers:'اقتراحات القراء'},en:{october:'October 1973 stories',history:'History and civilizations',science:'Science and scientists',women:'Women and leadership',people:'People',curriculum:'School curriculum',islamic:'Islamic history',readers:'Reader suggestions'},fr:{october:'Récits d’octobre 1973',history:'Histoire et civilisations',science:'Sciences et scientifiques',women:'Femmes et leadership',people:'Personnalités',curriculum:'Programme scolaire',islamic:'Histoire islamique',readers:'Suggestions des lecteurs'},it:{october:'Storie dell’ottobre 1973',history:'Storia e civiltà',science:'Scienza e scienziati',women:'Donne e leadership',people:'Personaggi',curriculum:'Programma scolastico',islamic:'Storia islamica',readers:'Suggerimenti dei lettori'},de:{october:'Geschichten zum Oktober 1973',history:'Geschichte und Zivilisationen',science:'Wissenschaft und Forschende',women:'Frauen und Führung',people:'Persönlichkeiten',curriculum:'Schullehrplan',islamic:'Islamische Geschichte',readers:'Leservorschläge'}};
var current='ar',story=null;
var readerScript=document.currentScript;
var ROOT=new URL('../',readerScript.src);
var enhanceCss=document.createElement('link');enhanceCss.rel='stylesheet';enhanceCss.href=new URL('rebuild/reader-enhance.css?v=20261028-v2-enhance-2',ROOT).href;document.head.appendChild(enhanceCss);
function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function rootPath(){return ROOT}
function asset(value){if(!value)return '';if(/^https:\/\//i.test(value))return value;return new URL(value.replace(/^\.\//,''),ROOT).href}
function locale(obj){return obj&&obj[current]||null}
function localizedImage(im){var t=locale(im.i18n)||{};return {src:asset(im.url||im.path),alt:t.alt||'',caption:t.caption||'',source:t.source_name||im.source_name||'',rights:t.rights||im.rights||''}}
function makeImage(im,altOnly){var d=localizedImage(im);var fig=document.createElement('figure'),img=document.createElement('img');img.src=d.src;img.alt=d.alt;img.loading='lazy';fig.appendChild(img);if(!altOnly){var cap=document.createElement('figcaption');cap.textContent=[d.caption,d.source,d.rights].filter(Boolean).join(' — ');fig.appendChild(cap)}return fig}
var SECTION_MOTIF={october:'dots',history:'steps',science:'arrows',women:'halo',people:'square',curriculum:'num',islamic:'diamonds',readers:'dots'};
var REVEALS={october:['slide','wipe'],history:['drop','wipe'],science:['zoom','slide'],women:['wipe','slide'],people:['zoom','drop'],curriculum:['slide','drop'],islamic:['zoom','slide'],readers:['drop','zoom']};
var statLabels={ar:['سؤالًا','لغات','مصادر'],en:['questions','languages','sources'],fr:['questions','langues','sources'],it:['domande','lingue','fonti'],de:['Fragen','Sprachen','Quellen']};
var motionObserver=null,motionTimer=0,enhanceShown=false,progressListenerAdded=false;
function hashText(x){var h=0;for(var i=0;i<x.length;i++)h=(h*31+x.charCodeAt(i))>>>0;return h}
function enhance(t){
var section=SECTION_MOTIF[story.section]?story.section:'october',h=hashText(String(story.slug||section)),opts=REVEALS[section],body=document.body;
body.dataset.reveal=opts[h%opts.length];body.style.setProperty('--kh-dur',(0.55+(h%3)*0.1).toFixed(2)+'s');$('blocks').dataset.motif=SECTION_MOTIF[section];
var boxes=$('blocks').querySelectorAll('.block');
t.blocks.forEach(function(b,i){if(boxes[i])boxes[i].dataset.type=b.type||''});
var old=$('kh-hexes');if(old)old.remove();
var hex=document.createElement('div');hex.id='kh-hexes';hex.className='kh-hexes';
[story.quiz.length,langs.length,story.sources.length].forEach(function(n,i){var d=document.createElement('div'),b=document.createElement('b');b.textContent=n.toLocaleString(current);d.append(b,document.createTextNode(' '+statLabels[current][i]));hex.appendChild(d)});
$('summary').after(hex);
var hd=document.querySelector('header');
if(hd&&!$('kh-progress')){var pr=document.createElement('div');pr.id='kh-progress';pr.className='kh-progress';pr.setAttribute('aria-hidden','true');hd.appendChild(pr)}
if(!progressListenerAdded){window.addEventListener('scroll',function(){var d=document.documentElement,m=d.scrollHeight-d.clientHeight,pr=$('kh-progress');if(pr)pr.style.setProperty('--kh-p',m>0?Math.min(1,d.scrollTop/m):0)},{passive:true});progressListenerAdded=true}
if(enhanceShown){body.classList.remove('kh-motion');return}
enhanceShown=true;
if(motionObserver)motionObserver.disconnect();clearTimeout(motionTimer);
var targets=[].slice.call(document.querySelectorAll('#blocks .block,.kh-hexes'));
var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(reduce||!('IntersectionObserver' in window)){body.classList.remove('kh-motion');return}
targets.forEach(function(e){e.classList.add('kh-pending')});body.classList.add('kh-motion');
var observer=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.remove('kh-pending');x.target.classList.add('kh-in');observer.unobserve(x.target)}})},{threshold:.12});
motionObserver=observer;targets.forEach(function(e){observer.observe(e)});
motionTimer=setTimeout(function(){targets.forEach(function(e){e.classList.remove('kh-pending');e.classList.add('kh-in')});observer.disconnect()},6000);
}
function show(){
if(!story)return;var t=story.i18n[current];if(!t){$('status').textContent=ui[current].missing;return}
document.documentElement.lang=current;document.documentElement.dir=current==='ar'?'rtl':'ltr';document.title=t.title+' | خالدون عبر التاريخ';
document.querySelectorAll('[data-lang]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.lang===current))});
var themeButton=$('theme-toggle');if(themeButton){var light=document.body.dataset.theme==='light';themeButton.textContent=light?ui[current].themeDark:ui[current].themeLight;themeButton.setAttribute('aria-pressed',String(light))}
$('section-name').textContent=sectionLabels[current][story.section]||ui[current].section;$('start-story').textContent=ui[current].start;$('title').textContent=t.title;$('subtitle').textContent=t.subtitle;$('summary').textContent=t.summary;
$('story-heading').textContent=ui[current].story;$('gallery-heading').textContent=ui[current].gallery;$('quiz-heading').textContent=ui[current].quiz;$('sources-heading').textContent=ui[current].sources;
$('map-heading').textContent=ui[current].map;$('map-link').textContent=ui[current].mapOpen;
var map=story.map_location;$('map-section').hidden=!map;
if(map){$('map-place').textContent=map.place[current];$('map-link').href='https://www.openstreetmap.org/?mlat='+encodeURIComponent(map.lat)+'&mlon='+encodeURIComponent(map.lng)+'#map=13/'+encodeURIComponent(map.lat)+'/'+encodeURIComponent(map.lng)}else{$('map-link').removeAttribute('href')}
$('student').textContent=t.student_name?ui[current].student+': '+t.student_name+(t.grade?' · '+t.grade:''):'';
$('cover').replaceChildren(makeImage(story.cover,false));$('blocks').replaceChildren();
t.blocks.forEach(function(b){var box=document.createElement('div');box.className='block';box.dataset.speaker=b.speaker;var who=document.createElement('div');who.className='speaker';who.textContent=b.speaker==='karma'?ui[current].karma:ui[current].narrator;var p=document.createElement('p');p.textContent=b.text;box.append(who,p);$('blocks').appendChild(box);if(b.image_after){var im=story.images.find(function(x){return x.id===b.image_after});if(im)$('blocks').appendChild(makeImage(im,false))}});
$('gallery').replaceChildren();story.images.forEach(function(im){$('gallery').appendChild(makeImage(im,false))});$('gallery-section').hidden=!story.images.length;
$('sources').replaceChildren();story.sources.forEach(function(s){var li=document.createElement('li'),a=document.createElement('a');a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';var localized=s.i18n&&s.i18n[current]||s;a.textContent=localized.title+' — '+localized.organization;li.appendChild(a);$('sources').appendChild(li)});
$('history-note').textContent=t.history_note||'';
$('quiz').replaceChildren();story.quiz.forEach(function(q,index){var lang=q.i18n[current],wrap=document.createElement('div');wrap.className='q';var title=document.createElement('strong');title.textContent=(index+1)+'. '+lang.question;wrap.appendChild(title);var opts=document.createElement('div');opts.className='options';lang.options.forEach(function(option,oi){var b=document.createElement('button');b.type='button';b.textContent=option;b.addEventListener('click',function(){opts.querySelectorAll('button').forEach(function(x,j){x.disabled=true;if(j===q.correct_option)x.classList.add('correct')});if(oi!==q.correct_option)b.classList.add('wrong');var exp=document.createElement('p');exp.className='explain';exp.textContent=(oi===q.correct_option?'✓ ':'✗ ')+(oi===q.correct_option?'':ui[current].answer+': '+lang.options[q.correct_option]+' — ')+lang.explanation;wrap.appendChild(exp)});opts.appendChild(b)});wrap.appendChild(opts);$('quiz').appendChild(wrap)});
$('status').hidden=true;$('story').hidden=false;enhance(t);
}
document.querySelectorAll('[data-lang]').forEach(function(b){b.addEventListener('click',function(){current=b.dataset.lang;show()})});
var themeButton=$('theme-toggle');if(themeButton)themeButton.addEventListener('click',function(){document.body.dataset.theme=document.body.dataset.theme==='light'?'dark':'light';show()});
var startButton=$('start-story');if(startButton)startButton.addEventListener('click',function(){var target=$('story-heading');target.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});});
var path=new URLSearchParams(location.search).get('story')||readerScript.dataset.storyPath;
if(!path||path.startsWith('/')||path.split('/').some(function(p){return p==='..'||p==='.'})||!path.endsWith('.json')){$('status').textContent='حدد حزمة JSON صالحة عبر ?story=PATH.json داخل المستودع.';return}
fetch(new URL(path,readerScript.dataset.storyPath?document.baseURI:ROOT)).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}).then(function(data){
if(data.format!=='KHALEDOON_STORY_V2'||!data.i18n||!langs.every(function(l){return data.i18n[l]&&data.i18n[l].title&&Array.isArray(data.i18n[l].blocks)})||!data.cover||!Array.isArray(data.images)||!Array.isArray(data.quiz)||!Array.isArray(data.sources))throw new Error(ui.ar.missing);
story=data;document.body.dataset.design=data.design&&data.design.variant||'military-history';document.body.dataset.section=data.section||'';document.documentElement.style.setProperty('--accent',data.design&&data.design.accent||'#d6ad55');show();
}).catch(function(e){$('status').textContent='تعذّر تحميل حزمة V2: '+e.message+'\nلم يتم الرجوع تلقائيًا إلى أي صيغة قديمة.'});
})();