(function(){
'use strict';
var LANGS=['en','fr','it','de'];
var SECTION_MAP={october:'october',history:'history',science:'science',learning:'women',women:'women',fame:'people',people:'people',curriculum:'curriculum',islamic:'islamic',readers:'people'};
var SECTION_NAMES={october:'حكايات أكتوبر 1973',history:'التاريخ والحضارات',science:'العلم والعلماء',women:'نساء خالدات',people:'أعلام الأدب والفنون والرياضة',curriculum:'شخصيات المناهج المصرية',islamic:'شخصيات إسلامية'};
var ACCENTS={october:'#d6ad55',history:'#d5b7ff',science:'#8ad9e8',women:'#d78bb2',people:'#e2b36d',curriculum:'#9bb7ff',islamic:'#78c59a'};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function xml(s){return esc(s)}
function paragraphs(s){return String(s||'').split(/\n{2,}/).map(function(x){return x.trim()}).filter(Boolean)}
function htmlParagraphs(s){return paragraphs(s).map(function(p){return '<p>'+esc(p).replace(/\n/g,'<br>')+'</p>'}).join('')}
function validate(d){
 var missing=[];
 if(!d||!d.title||d.title.trim().length<3)missing.push('العنوان غير مكتمل');
 if(!d.body||d.body.trim().length<50)missing.push('نص الراوي قصير أو غير موجود');
 if(!d.karma_text||!d.karma_text.trim())missing.push('مقاطع كارما غير موجودة');
 var urls=String(d.sources||'').match(/https?:\/\/[^\s)\]>]+/g)||[];
 var uniqueUrls=Array.from(new Set(urls.map(function(u){return u.replace(/[.,;:]+$/,'')})));if(uniqueUrls.length<2)missing.push('أضف مصدرين موثوقين مختلفين على الأقل بروابط فعلية');
 var tr=d.translations||{};
 LANGS.forEach(function(lang){
  var t=tr[lang]||{};
  ['title','subtitle','karma_text','body'].forEach(function(k){if(!String(t[k]||'').trim())missing.push(lang.toUpperCase()+': ناقص '+({title:'العنوان',subtitle:'النبذة',karma_text:'نص كارما',body:'نص الراوي'}[k]))});
  if(d.history_note&&!String(t.history_note||'').trim())missing.push(lang.toUpperCase()+': ترجمة السياق التاريخي ناقصة');
  if(d.images_note&&!String(t.images_note||'').trim())missing.push(lang.toUpperCase()+': ترجمة ملاحظات الصور وحقوقها ناقصة');
  if(paragraphs(d.body).length!==paragraphs(t.body).length)missing.push(lang.toUpperCase()+': عدد فقرات الراوي لا يطابق الأصل؛ لا يمكن ربط الترجمة فقرة بفقرة.');
  if(paragraphs(d.karma_text).length!==paragraphs(t.karma_text).length)missing.push(lang.toUpperCase()+': عدد فقرات كارما لا يطابق الأصل.');
  if(d.history_note&&paragraphs(d.history_note).length!==paragraphs(t.history_note).length)missing.push(lang.toUpperCase()+': عدد فقرات السياق التاريخي لا يطابق الأصل.');
  if(d.images_note&&paragraphs(d.images_note).length!==paragraphs(t.images_note).length)missing.push(lang.toUpperCase()+': عدد فقرات ملاحظات الصور لا يطابق الأصل.');
 });
 var q=null;try{q=typeof d.question_bank_json==='string'?JSON.parse(d.question_bank_json):d.question_bank_json}catch(e){missing.push('صيغة بنك الأسئلة JSON غير صحيحة')}
 if(!q||!Array.isArray(q.questions)||q.questions.length<5)missing.push('بنك الأسئلة يحتاج خمسة أسئلة على الأقل');
 if(q&&Array.isArray(q.questions))q.questions.forEach(function(item,i){
  if(!item||!String(item.q||'').trim()||!Array.isArray(item.o)||item.o.length<2||!Number.isInteger(item.a)||item.a<0||item.a>=item.o.length||!String(item.e||'').trim())missing.push('السؤال '+(i+1)+': النص والاختيارات والإجابة والتفسير مطلوبة');
  LANGS.forEach(function(lang){var t=item&&item.i18n&&item.i18n[lang];if(!t||!String(t.q||'').trim()||!Array.isArray(t.o)||!item.o||t.o.length!==item.o.length||t.o.some(function(v){return !String(v||'').trim()})||!String(t.e||'').trim())missing.push('السؤال '+(i+1)+': ترجمة '+lang.toUpperCase()+' غير مكتملة')});
 });
 return {ok:missing.length===0,missing:missing,quiz:q};
}
async function nextId(){
 var indexResponse;
 try{indexResponse=await fetch('../stories/index.json?bundle='+Date.now(),{cache:'no-store'})}catch(e){throw new Error('تعذر الاتصال بفهرس الحكايات؛ لم نخصص رقمًا لتجنب التكرار. أعد المحاولة عند استقرار الاتصال.')}
 if(!indexResponse||!indexResponse.ok)throw new Error('تعذر قراءة فهرس الحكايات الحالي؛ لم نخصص رقمًا لتجنب التكرار.');
 var storyIndex;try{storyIndex=await indexResponse.json()}catch(e){throw new Error('فهرس الحكايات ليس JSON صالحًا؛ لم نخصص رقمًا لتجنب التكرار.')}
 if(!Array.isArray(storyIndex))throw new Error('صيغة فهرس الحكايات غير متوقعة؛ لم نخصص رقمًا لتجنب التكرار.');
 var indexed={};storyIndex.forEach(function(x){var n=parseInt(String(x&&x.id||''),10);if(Number.isInteger(n)&&n>0)indexed[String(n).padStart(3,'0')]=true});
 var sections=['october','history','science','women','people','curriculum','islamic'];
 for(var id=1;id<=9999;id++){
  var name=String(id).padStart(3,'0');if(indexed[name])continue;
  var exists=false;
  for(var section of sections){
   var response;
   try{response=await fetch('../stories/'+section+'/'+name+'/index.html',{method:'HEAD',cache:'no-store'})}
   catch(e){throw new Error('تعذر التحقق من رقم '+name+' داخل قسم '+section+' بسبب فشل الاتصال؛ أوقفنا التجهيز لتجنب تكرار صفحة موجودة.')}
   if(response&&response.ok){exists=true;break}
   if(!response||response.status!==404)throw new Error('لم نستطع التأكد هل الرقم '+name+' مستخدم في قسم '+section+' (HTTP '+(response?response.status:'بدون استجابة')+'). لم نخصص رقمًا لتجنب التكرار.');
  }
  if(!exists)return name;
 }
 throw new Error('لم نعثر على رقم متاح بين 001 و9999؛ راجع فهرس الحكايات والمجلدات يدويًا.');
}
function sourceRows(s){
 var rows=[];String(s||'').split(/\r?\n/).map(function(line){return line.trim()}).filter(Boolean).forEach(function(line){
  var urls=line.match(/https?:\/\/[^\s)\]>]+/g)||[];
  if(!urls.length){rows.push({line:line,url:'',label:line});return}
  urls.forEach(function(raw){var url=raw.replace(/[.,;:]+$/,''),before=line.slice(0,line.indexOf(raw)).replace(/[|—–:-]+$/,'').trim(),label=before||('مصدر '+(rows.length+1));rows.push({line:line,url:url,label:label})});
 });var seen={};return rows.filter(function(x){if(!x.url)return true;if(seen[x.url])return false;seen[x.url]=true;return true})
}
function translatedRows(d,id){
 var rows={en:{},fr:{},it:{},de:{}},tr=d.translations||{};
 function add(lang,arabic,translated){if(arabic&&translated&&String(arabic).trim()!==String(translated).trim())rows[lang][String(arabic)]=String(translated)}
 function mapBlocks(arText,translatedText,lang){var a=paragraphs(arText),b=paragraphs(translatedText);a.forEach(function(x,i){if(b[i])add(lang,x,b[i])});if(a.length===1&&b.length===1)add(lang,arText,translatedText)}
 LANGS.forEach(function(lang){var t=tr[lang]||{};add(lang,d.title,t.title);add(lang,d.subtitle,t.subtitle);add(lang,d.narrator_name||d.student_name,t.student_name);add(lang,d.narrator_grade||d.grade,t.grade);mapBlocks(d.karma_text,t.karma_text,lang);mapBlocks(d.body,t.body,lang);mapBlocks(d.history_note,t.history_note,lang);mapBlocks(d.images_note,t.images_note,lang)});
 var labels={
  'كارما الطفلة':{en:'Karma, the curious child',fr:'Karma, l’enfant curieuse',it:'Karma, la bambina curiosa',de:'Karma, das neugierige Kind'},
  'حكاية بصوت جيل جديد':{en:'A story told by a new generation',fr:'Une histoire racontée par une nouvelle génération',it:'Una storia raccontata da una nuova generazione',de:'Eine Geschichte aus der Sicht einer neuen Generation'},
  'إغلاق':{en:'Close',fr:'Fermer',it:'Chiudi',de:'Schließen'},
  'ابدأ الحكاية ←':{en:'Start the story →',fr:'Commencer l’histoire →',it:'Inizia la storia →',de:'Geschichte starten →'},
  'كارما: فضول وأسئلة وملاحظات':{en:'Karma: curiosity, questions and observations',fr:'Karma : curiosité, questions et observations',it:'Karma: curiosità, domande e osservazioni',de:'Karma: Neugier, Fragen und Beobachtungen'},
  'الحكاية':{en:'The story',fr:'L’histoire',it:'La storia',de:'Die Geschichte'},
  'السياق والتحقق التاريخي':{en:'Historical context and verification',fr:'Contexte historique et vérification',it:'Contesto storico e verifica',de:'Historischer Kontext und Überprüfung'},
  'الصور وحقوق الاستخدام':{en:'Images and usage rights',fr:'Images et droits d’utilisation',it:'Immagini e diritti d’uso',de:'Bilder und Nutzungsrechte'},
  'النص تعليمي مبسط؛ يجب مراجعة المصادر والتمييز بين الوقائع الثابتة والروايات المختلف عليها.':{en:'This is an educational adaptation; check the sources and distinguish established facts from disputed accounts.',fr:'Ce texte est une adaptation éducative ; consultez les sources et distinguez les faits établis des récits contestés.',it:'Questo è un adattamento didattico; controlla le fonti e distingui i fatti accertati dai racconti controversi.',de:'Dies ist eine vereinfachte Lernfassung; prüfe die Quellen und unterscheide gesicherte Fakten von umstrittenen Überlieferungen.'},
  'العودة إلى خالدون عبر التاريخ':{en:'Back to Immortals Through History',fr:'Retour à Immortels à travers l’histoire',it:'Torna a Immortali attraverso la storia',de:'Zurück zu Unsterbliche durch die Geschichte'},
  'الراوي المعرفي':{en:'The knowledgeable narrator',fr:'Le narrateur connaisseur',it:'Il narratore esperto',de:'Der sachkundige Erzähler'},
  'في ضوء التاريخ':{en:'In historical context',fr:'Dans le contexte historique',it:'Nel contesto storico',de:'Im historischen Kontext'},
  'اختبر معلوماتك':{en:'Test your knowledge',fr:'Testez vos connaissances',it:'Verifica le tue conoscenze',de:'Teste dein Wissen'},
  'تحدّي خالدون':{en:'Khaledoon Challenge',fr:'Défi Khaledoon',it:'Sfida Khaledoon',de:'Khaledoon-Challenge'},
  'ابدأ الاختبار':{en:'Start the quiz',fr:'Commencer le quiz',it:'Inizia il quiz',de:'Quiz starten'},
  'المصادر والمراجعة':{en:'Sources and review',fr:'Sources et vérification',it:'Fonti e verifica',de:'Quellen und Überprüfung'},
  'رأيك يهمنا':{en:'Your feedback matters',fr:'Votre avis compte',it:'La tua opinione conta',de:'Deine Meinung zählt'},
  'ما رأيك في الحكاية؟':{en:'What do you think of this story?',fr:'Que pensez-vous de cette histoire ?',it:'Cosa ne pensi di questa storia?',de:'Wie findest du diese Geschichte?'},
  'اختَر الانطباع الذي يناسبك بعد القراءة.':{en:'Choose the reaction that fits after reading.',fr:'Choisissez la réaction qui vous correspond après la lecture.',it:'Scegli la reazione che meglio descrive la lettura.',de:'Wähle die passende Reaktion nach dem Lesen.'},
  '❤️ أعجبتني':{en:'❤️ I liked this story',fr:'❤️ J’ai aimé cette histoire',it:'❤️ Mi è piaciuta questa storia',de:'❤️ Diese Geschichte gefällt mir'},
  'حكاية ومجهود مميز':{en:'A special story and effort',fr:'Une histoire et un effort remarquables',it:'Una storia e un impegno speciali',de:'Eine besondere Geschichte und Mühe'},
  'حكاية لم أكن أعرفها من قبل':{en:'A story I did not know before',fr:'Une histoire que je ne connaissais pas',it:'Una storia che non conoscevo',de:'Eine Geschichte, die ich noch nicht kannte'},
  'حكاية ملهمة':{en:'An inspiring story',fr:'Une histoire inspirante',it:'Una storia stimolante',de:'Eine inspirierende Geschichte'},
  'أحب أقرأ حكايات تانية':{en:'I would like to read more stories',fr:'J’aimerais lire d’autres histoires',it:'Vorrei leggere altre storie',de:'Ich möchte weitere Geschichten lesen'},
  'يمكن تسجيل إعجاب واحد ورد فعل واحد لكل حكاية من المتصفح نفسه.':{en:'One like and one reaction can be recorded per story from the same browser.',fr:'Un J’aime et une réaction peuvent être enregistrés par histoire depuis le même navigateur.',it:'Dal medesimo browser è possibile registrare un Mi piace e una reazione per storia.',de:'Pro Geschichte können im selben Browser ein Like und eine Reaktion abgegeben werden.'},
  'شارك الحكاية':{en:'Share the story',fr:'Partager l’histoire',it:'Condividi la storia',de:'Geschichte teilen'},
  'مشاركة الحكاية':{en:'Share story',fr:'Partager',it:'Condividi',de:'Teilen'},
  '🖨️ اطبع الحكاية':{en:'🖨️ Print story',fr:'🖨️ Imprimer',it:'🖨️ Stampa',de:'🖨️ Geschichte drucken'},
  'كل حكاية تفتح بابًا جديدًا لفهم التاريخ':{en:'Every story opens a new door to history',fr:'Chaque histoire ouvre une nouvelle porte sur l’histoire',it:'Ogni storia apre una nuova porta sulla storia',de:'Jede Geschichte öffnet eine neue Tür zur Geschichte'},
  'خالدون عبر التاريخ':{en:'Immortals Through History',fr:'Immortels à travers l’histoire',it:'Immortali attraverso la storia',de:'Unsterbliche durch die Geschichte'},
  'مصادر الحكاية':{en:'Story sources',fr:'Sources de l’histoire',it:'Fonti della storia',de:'Quellen der Geschichte'}
 };
 var sectionLabels={october:{ar:'حكايات أكتوبر 1973',en:'October 1973 Stories',fr:'Récits d’octobre 1973',it:'Storie dell’ottobre 1973',de:'Geschichten zum Oktober 1973'},history:{ar:'التاريخ والحضارات',en:'History and Civilizations',fr:'Histoire et civilisations',it:'Storia e civiltà',de:'Geschichte und Zivilisationen'},science:{ar:'العلم والعلماء',en:'Science and Scientists',fr:'Sciences et scientifiques',it:'Scienza e scienziati',de:'Wissenschaft und Forschende'},women:{ar:'نساء خالدات',en:'Women Who Made History',fr:'Femmes qui ont marqué l’histoire',it:'Donne che hanno fatto la storia',de:'Frauen, die Geschichte schrieben'},people:{ar:'أعلام الأدب والفنون والرياضة',en:'Literature, Arts and Sports',fr:'Littérature, arts et sport',it:'Letteratura, arti e sport',de:'Literatur, Kunst und Sport'},curriculum:{ar:'شخصيات المناهج المصرية',en:'Egyptian Curriculum Figures',fr:'Personnages du programme égyptien',it:'Personaggi del programma egiziano',de:'Persönlichkeiten des ägyptischen Lehrplans'},islamic:{ar:'شخصيات إسلامية',en:'Islamic Figures',fr:'Personnalités islamiques',it:'Personaggi islamici',de:'Islamische Persönlichkeiten'}};
 LANGS.forEach(function(lang){Object.keys(labels).forEach(function(k){add(lang,k,labels[k][lang])});var section=d.section_key==='learning'?'women':d.section_key==='fame'?'people':d.section_key;if(sectionLabels[section]){add(lang,sectionLabels[section].ar,sectionLabels[section][lang]);add(lang,'← '+sectionLabels[section].ar,'← '+sectionLabels[section][lang])}});
 var meta={ar:[d.title||'',d.subtitle||'']};LANGS.forEach(function(lang){var t=tr[lang]||{};meta[lang]=[t.title||d.title||'',t.subtitle||d.subtitle||'']});
 return '(function(){\n"use strict";var S=window.StoryI18N=window.StoryI18N||{text:{},meta:{}};var rows='+JSON.stringify(rows)+';Object.keys(rows).forEach(function(lang){S.text[lang]=S.text[lang]||{};Object.assign(S.text[lang],rows[lang])});S.meta['+JSON.stringify(id)+']='+JSON.stringify(meta)+';})();\n';
}
function storyHtml(d,id,section,accent,baseUrl){
 var source=sourceRows(d.sources),sourceHtml=source.map(function(x){return '<li>'+(x.url?'<a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">'+esc(x.label)+'</a>':esc(x.line))+'</li>'}).join('');
 var title=esc(d.title),subtitle=esc(d.subtitle||''),figure=esc(d.figure_name||''),narrator=esc(d.narrator_name||d.student_name||'راوي من الجيل الجديد'),narratorGrade=esc(d.narrator_grade||d.grade||''),sectionTitle=SECTION_NAMES[section]||'خالدون عبر التاريخ';
 var collection=section==='october'?'october':section==='science'?'science':section==='women'?'women':section==='people'?'people':section==='curriculum'?'curriculum':section==='islamic'?'islamic':'history';
 return '<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#102b35">\n<title>'+title+' | خالدون عبر التاريخ</title><meta name="description" content="'+esc(d.subtitle||d.title)+'"><meta property="og:title" content="'+title+'"><meta property="og:description" content="'+subtitle+'"><meta property="og:image" content="'+baseUrl+'/stories/'+section+'/'+id+'/cover.svg">\n<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Marhey:wght@500;700&display=swap" rel="stylesheet">\n<link rel="stylesheet" href="../../../assets/shared/base.css"><link rel="stylesheet" href="theme.css"><link rel="stylesheet" href="../../../assets/shared/reactions.css"><link rel="stylesheet" href="../../../assets/shared/story-quiz.css">\n<script src="../../../assets/shared/home-language-only.js"><\/script>\n<style>.language-switch{display:flex;gap:6px;flex-wrap:wrap}.language-switch .lang-option{padding:6px 10px;border:1px solid #ffffff55;background:#102b35;color:#fff;border-radius:999px;font:700 .8rem Cairo;cursor:pointer}.language-switch .lang-option.is-active{background:'+accent+';color:#14202a}.cover-label{font-size:.85rem;opacity:.85}.story-body{line-height:2}.story-body p{margin:0 0 1rem}.source-note{font-size:.92rem}.share-actions{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}.story-quiz-section,.reactions-section,.sources,.end{margin:20px auto;max-width:1000px}</style>\n</head>\n<body data-story-slug="'+id+'">\n<header><a href="../../../khaledoon/collections/'+collection+'.html">← '+esc(sectionTitle)+'</a><a href="../../../index.html">خالدون عبر التاريخ</a><div class="language-switch" data-lang-switch role="group" aria-label="Language"></div></header>\n<div class="modal" id="intro" role="dialog" aria-modal="true" aria-labelledby="intro-title" aria-describedby="intro-desc"><button class="modal-close" id="close" aria-label="إغلاق">×</button><div class="modal-card"><div class="modal-art"><img src="cover-popup.svg" alt="رسم توضيحي للحكاية، وليس صورة تاريخية أرشيفية"></div><div class="modal-copy"><div class="eyebrow">خالدون عبر التاريخ · '+id+'</div><h2 id="intro-title">'+title+'</h2><p id="intro-desc">'+subtitle+'</p><button class="btn" id="start">ابدأ الحكاية ←</button></div></div></div>\n<main>\n<section class="hero"><div class="container"><div class="eyebrow">خالدون عبر التاريخ · '+id+'</div><h1>'+title+'</h1><p class="hero-subtitle">'+subtitle+'</p><div class="author"><span>حكاية بصوت جيل جديد</span><br><strong>'+narrator+'</strong>'+(narratorGrade?'<br><span>'+narratorGrade+'</span>':'')+'</div><div class="cover-label">غلاف توضيحي مولّد برمجيًا — ليس صورة تاريخية أرشيفية</div></div></section>\n<section class="story" id="begin"><div class="container"><div class="kicker">كارما الطفلة</div><h2>كارما: فضول وأسئلة وملاحظات</h2><div class="story-body">'+htmlParagraphs(d.karma_text)+'</div></div></section>\n<section class="story"><div class="container"><div class="kicker">الراوي المعرفي</div><h2>الحكاية</h2><div class="story-body">'+htmlParagraphs(d.body)+'</div></div></section>\n'+(d.history_note?'<section class="story"><div class="container"><div class="kicker">في ضوء التاريخ</div><h2>السياق والتحقق التاريخي</h2><div class="story-body">'+htmlParagraphs(d.history_note)+'</div></div></section>':'')+(d.images_note?'<section class="story"><div class="container"><div class="kicker">الصور وحقوق الاستخدام</div><h2>الصور وحقوق الاستخدام</h2><div class="story-body">'+htmlParagraphs(d.images_note)+'</div></div></section>':'')+'\n<section class="story"><div class="container"><div class="glass"><strong>شارك الحكاية</strong><p>لو عجبتك الحكاية، شاركها مع شخص مهتم بالتاريخ.</p><div class="share-actions"><button class="btn" id="share" type="button">مشاركة الحكاية</button><a class="btn" id="share-whatsapp" href="#" target="_blank" rel="noopener noreferrer">WhatsApp</a><a class="btn" id="share-facebook" href="#" target="_blank" rel="noopener noreferrer">Facebook</a><button class="print-btn" id="print-story" type="button">🖨️ اطبع الحكاية</button></div></div></div></section>\n<section class="story-quiz-section" aria-labelledby="story-quiz-heading"><div class="story-quiz-card"><div class="story-quiz-kicker">تحدّي خالدون</div><h2 id="story-quiz-heading">اختبر معلوماتك</h2><p class="story-quiz-intro">اختبر معلوماتك عن الشخصية وعصرها. يتضمن الاختبار أسئلة مع نتيجة ومراجعة للإجابات.</p><p class="story-quiz-language-note" id="story-quiz-language-note" hidden>الأسئلة متاحة بالعربية حاليًا.</p><button class="story-quiz-start" id="story-quiz-start" type="button">ابدأ الاختبار</button><div id="story-quiz-app" class="story-quiz-app" hidden aria-live="polite"></div></div></section>\n<section class="reactions-section"><div class="reactions-wrap"><div class="kicker" style="text-align:center">رأيك يهمنا</div><h2 class="reactions-title" id="reactions-title">ما رأيك في الحكاية؟</h2><p class="reactions-intro">اختَر الانطباع الذي يناسبك بعد القراءة.</p><div class="reaction-like-row"><button class="reaction-btn reaction-like" id="reaction-like" type="button" aria-pressed="false"><span class="reaction-label">❤️ أعجبتني</span><span class="reaction-count" data-reaction-count="like">0</span></button></div><div class="reaction-options" role="group" aria-label="اختَر رد فعلك على الحكاية"><button class="reaction-btn reaction-choice" type="button" data-reaction-choice="loved" aria-pressed="false"><span>حكاية ومجهود مميز</span><span class="reaction-count" data-reaction-count="loved">0</span></button><button class="reaction-btn reaction-choice" type="button" data-reaction-choice="unknown_before" aria-pressed="false"><span>حكاية لم أكن أعرفها من قبل</span><span class="reaction-count" data-reaction-count="unknown_before">0</span></button><button class="reaction-btn reaction-choice" type="button" data-reaction-choice="inspiring" aria-pressed="false"><span>حكاية ملهمة</span><span class="reaction-count" data-reaction-count="inspiring">0</span></button><button class="reaction-btn reaction-choice" type="button" data-reaction-choice="more_stories" aria-pressed="false"><span>أحب أقرأ حكايات تانية</span><span class="reaction-count" data-reaction-count="more_stories">0</span></button></div><p class="reaction-status" id="reaction-status" role="status" aria-live="polite"></p><span class="reaction-count-line">يمكن تسجيل إعجاب واحد ورد فعل واحد لكل حكاية من المتصفح نفسه.</span></div></section>\n<section class="sources" id="sources"><div class="container"><div class="kicker">المصادر والمراجعة</div><h2>مصادر الحكاية</h2><ol>'+sourceHtml+'</ol><p class="source-note">النص تعليمي مبسط؛ يجب مراجعة المصادر والتمييز بين الوقائع الثابتة والروايات المختلف عليها.</p></div></section>\n<section class="end"><h2>كل حكاية تفتح بابًا جديدًا لفهم التاريخ</h2><p>خالدون عبر التاريخ — حكاية التاريخ بعيون جيل جديد.</p><a class="btn" href="../../../index.html">العودة إلى خالدون عبر التاريخ</a></section></main>\n<script src="../../../assets/shared/i18n.js"><\/script><script src="../../../assets/i18n/common.js"><\/script><script src="../../../assets/i18n/story-common.js"><\/script><script src="./translations.js"><\/script><script src="../../../assets/shared/story-i18n.js"><\/script><script src="../../../assets/shared/story.js"><\/script><script src="../../../assets/shared/reactions.js"><\/script><script src="../../../assets/shared/story-quiz.js"><\/script><script src="../../../assets/shared/story-body-i18n.js"><\/script>\n</body></html>\n';
}
function dataJson(d,id,section){
 var tr=d.translations||{},i18n={};
 LANGS.forEach(function(lang){var t=tr[lang]||{};i18n[lang]={name:t.student_name||d.narrator_name||'',grade:t.grade||d.narrator_grade||'',className:t.grade||d.narrator_grade||'',title:t.title||'',subtitle:t.subtitle||'',person:d.figure_name||''}});
 return {name:d.narrator_name||'غير مسجل',grade:d.narrator_grade||'',className:d.narrator_grade||'',title:d.title,subtitle:d.subtitle||'',person:d.figure_name||'',color:ACCENTS[section]||'#d5b7ff',order:parseInt(id,10),published:true,i18n:i18n};
}
function svgCover(d,id,accent,popup){
 var w=popup?1200:900,h=popup?650:1100,fs=popup?52:40;
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" role="img" aria-labelledby="title desc"><title id="title">'+xml(d.title)+'</title><desc id="desc">رسم توضيحي تجريدي مولّد برمجيًا وليس صورة تاريخية أرشيفية</desc><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#071923"/><stop offset="1" stop-color="'+accent+'"/></linearGradient><radialGradient id="glow"><stop stop-color="'+accent+'" stop-opacity=".85"/><stop offset="1" stop-color="'+accent+'" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#bg)"/><circle cx="'+Math.round(w*.72)+'" cy="'+Math.round(h*.28)+'" r="'+Math.round(h*.3)+'" fill="url(#glow)"/><g fill="none" stroke="'+accent+'" stroke-opacity=".65"><circle cx="'+Math.round(w*.72)+'" cy="'+Math.round(h*.28)+'" r="'+Math.round(h*.18)+'" stroke-width="2"/><circle cx="'+Math.round(w*.72)+'" cy="'+Math.round(h*.28)+'" r="'+Math.round(h*.23)+'" stroke-width="1"/><path d="M '+Math.round(w*.12)+' '+Math.round(h*.78)+' Q '+Math.round(w*.5)+' '+Math.round(h*.65)+' '+Math.round(w*.88)+' '+Math.round(h*.78)+'" stroke-width="3"/></g><text x="50%" y="'+Math.round(h*.52)+'" text-anchor="middle" fill="#fff" font-family="Cairo,Arial,sans-serif" font-size="'+fs+'" font-weight="700">'+xml(d.title).slice(0,80)+'</text><text x="50%" y="'+Math.round(h*.60)+'" text-anchor="middle" fill="'+accent+'" font-family="Cairo,Arial,sans-serif" font-size="'+Math.round(fs*.45)+'">خالدون عبر التاريخ</text><text x="50%" y="'+Math.round(h*.91)+'" text-anchor="middle" fill="#fff" opacity=".85" font-family="Cairo,Arial,sans-serif" font-size="'+Math.round(fs*.32)+'">رسم توضيحي — ليس صورة تاريخية أرشيفية</text></svg>';
}
function zipFiles(files){
 var enc=new TextEncoder(),local=[],central=[],offset=0;
 function u16(n){return [n&255,(n>>>8)&255]}
 function u32(n){return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]}
 var crcTable=zipFiles.crcTable;if(!crcTable){crcTable=[];for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);crcTable[n]=c>>>0}zipFiles.crcTable=crcTable}
 function crc32(data){var c=0xffffffff;for(var i=0;i<data.length;i++)c=crcTable[(c^data[i])&255]^(c>>>8);return (c^0xffffffff)>>>0}
 files.forEach(function(file){
  var name=enc.encode(file.path),data=enc.encode(file.content),crc=crc32(data),flags=0x0800,time=0,date=0;
  var localHeader=[0x50,0x4b,0x03,0x04].concat(u16(20),u16(flags),u16(0),u16(time),u16(date),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),Array.from(name),Array.from(data));
  local.push.apply(local,localHeader);
  var centralHeader=[0x50,0x4b,0x01,0x02].concat(u16(20),u16(20),u16(flags),u16(0),u16(time),u16(date),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),Array.from(name));
  central.push.apply(central,centralHeader);offset+=localHeader.length;
 });
 var centralOffset=offset,centralSize=central.length;
 var end=[0x50,0x4b,0x05,0x06].concat(u16(0),u16(0),u16(files.length),u16(files.length),u32(centralSize),u32(centralOffset),u16(0));
 return new Blob([new Uint8Array(local.concat(central,end))],{type:'application/zip'});
}
async function download(draft,opts){
 opts=opts||{};var report=validate(draft);
 if(!report.ok)throw new Error('لا يمكن إنشاء حزمة نشر مكتملة قبل استكمال التالي:\n• '+report.missing.join('\n• '));
 var section=SECTION_MAP[draft.section_key]||'';
 if(!section)throw new Error('القسم غير معروف؛ لم أنشئ حزمة بمسار غير صحيح.');
 var priorMeta=draft.story_meta&&draft.story_meta.preview_review||{},priorPath=String(priorMeta.static_story_path||''),priorId=String(priorMeta.static_story_id||''),candidateId=String(draft.story_number||'').trim();
 var indexResponse=await fetch('../stories/index.json?bundle='+Date.now(),{cache:'no-store'});if(!indexResponse.ok)throw new Error('تعذر قراءة فهرس الحكايات الحالي؛ لم أنشئ حزمة قد تستبدل الفهرس ببيانات ناقصة.');
 var storyIndex=await indexResponse.json();if(!Array.isArray(storyIndex))throw new Error('صيغة فهرس الحكايات غير متوقعة؛ لم أنشئ الحزمة.');
 var id='',updatingExisting=false;
 if(priorPath){var priorParts=priorPath.split('/').filter(Boolean);if(priorParts.length<3||priorParts[0]!=='stories'||priorParts[1]!==section)throw new Error('القسم المختار يختلف عن قسم الحكاية المنشورة. غيّر القسم في مسار مراجعة منفصل حتى لا تترك نسخة قديمة في القسم السابق.');id=String(priorId||priorParts[2]).padStart(3,'0');if(id!==priorParts[2])throw new Error('معرّف الصفحة المحفوظ لا يطابق مسارها؛ أوقفنا التجهيز لحماية الرابط الحالي.');updatingExisting=true}
 else if(priorId){id=priorId.padStart(3,'0');updatingExisting=true}
 else if(section==='october'&&candidateId){var candidate=String(parseInt(candidateId,10)).padStart(3,'0');if(storyIndex.some(function(x){return String(x.id||'').padStart(3,'0')===candidate&&x.section===section})){id=candidate;updatingExisting=true}}
 if(!id)id=await nextId();
 var existingIndexAt=storyIndex.findIndex(function(x){return String(x.id||'').padStart(3,'0')===id});
 if(updatingExisting){if(existingIndexAt<0)throw new Error('الحكاية التي نحاول تعديلها غير موجودة في فهرس الموقع؛ لم أنشئ نسخة مكررة.');if(storyIndex[existingIndexAt].section!==section)throw new Error('رقم الحكاية مرتبط بقسم آخر؛ لم أغيّر الرابط أو أكرر الحكاية.')}
 else if(existingIndexAt>=0||storyIndex.some(function(x){return String(x.path||'').split('/').filter(Boolean).join('/')===('stories/'+section+'/'+id)}))throw new Error('رقم الحكاية ظهر في الفهرس أثناء التجهيز؛ أعد فتح المعاينة لتحديد رقم جديد.');
 var accent=ACCENTS[section]||'#d5b7ff',root='stories/'+section+'/'+id+'/',baseUrl=location.origin+'/nourdeen-october-1973';
 var data=dataJson(draft,id,section),quiz=report.quiz;quiz.id=id;quiz.title=draft.figure_name||draft.title;
 var indexEntry={name:data.name,grade:data.grade,className:data.className,title:data.title,subtitle:data.subtitle,person:data.person,color:data.color,order:parseInt(id,10),published:true,i18n:data.i18n,id:id,section:section,path:root};
 if(updatingExisting)storyIndex[existingIndexAt]=indexEntry;else storyIndex.push(indexEntry);
 var source=sourceRows(draft.sources),sourceMd='# مصادر الحكاية: '+draft.title+'\n\n'+source.map(function(x){return '- '+(x.url?'['+x.label+']('+x.url+')':x.line)}).join('\n')+'\n';
 var theme='';try{var tr=await fetch('../stories/history/005/theme.css',{cache:'no-store'});if(tr.ok)theme=await tr.text()}catch(e){}
 theme+='\n:root{--gold:'+accent+'!important;--accent:'+accent+'!important}\n.hero .eyebrow,.kicker,.story-quiz-kicker{color:var(--gold)}\n';
 var files=[
  {path:root+'index.html',content:storyHtml(draft,id,section,accent,baseUrl)},
  {path:root+'theme.css',content:theme},
  {path:root+'data.json',content:JSON.stringify(data,null,2)+'\n'},
  {path:'stories/index.json',content:JSON.stringify(storyIndex,null,2)+'\n'},
  {path:root+'translations.js',content:translatedRows(draft,id)},
  {path:root+'cover.svg',content:svgCover(draft,id,accent,false)},
  {path:root+'cover-popup.svg',content:svgCover(draft,id,accent,true)},
  {path:'stories/quizzes/'+id+'.json',content:JSON.stringify(quiz,null,2)+'\n'},
  {path:root+'sources.md',content:sourceMd},
  {path:root+'original.md',content:'# النص الأصلي كما وصل دون تعديل\n\n'+String(draft.original_body||'لم يُرفق النص الأصلي.')+'\n'},
  {path:root+'editorial-notes.md',content:'# ملاحظات التحرير والتحقق\n\n## السياق التاريخي والتحقق\n\n'+String(draft.history_note||'لم تُضف ملاحظات تحقق.')+'\n\n## الصور وحقوق الاستخدام\n\n'+String(draft.images_note||'لم تُسجل معلومات الصور وحقوقها؛ يلزم استكمالها قبل النشر.')+'\n'}
 ];
 var readme='# حزمة حكاية خالدون — '+draft.title+'\n\n'+
  '- المعرّف المقترح: '+id+'\n- القسم: '+section+'\n- المسار: '+root+'\n- الحالة في data.json: published=true لأن هذه الحزمة أُنشئت بعد قبول المعاينة.\n\n'+
  '## الرفع من GitHub\n1. افتح مستودع engmohamedgamalsaad-oss/nourdeen-october-1973.\n2. ارفع كل الملفات مع الحفاظ على المسارات داخل الحزمة؛ لا تضعها داخل مجلد ZIP إضافي.\n3. ارفع index.html وtheme.css وdata.json وtranslations.js وملفي الغلاف إلى '+root+'.\n4. ارفع ملف stories/index.json المرفق أيضًا حتى تظهر الحكاية في قسمها. هذا الملف مبني على الفهرس الذي قرأه النظام وقت إنشاء الحزمة؛ قبل استبداله افتح النسخة الحالية وتأكد أنها لم تتغير منذ ذلك الوقت، ولا تستبدل فهرسًا أحدث. إذا تغير، أضف فقط العنصر الجديد الذي يحمل id '+id+' إلى النسخة الحالية.\n5. ارفع بنك الأسئلة إلى stories/quizzes/'+id+'.json، والمصادر إلى '+root+'sources.md.\n6. انتظر GitHub Actions، وتحقق من صفحة الحكاية الحية وظهورها في القسم. لا تغيّر حالة سجل الإدارة إلى منشور قبل نجاح التحقق.\n7. ارجع إلى لوحة الإدارة واضغط «تأكيد النشر بعد الرفع».\n\n## تنبيهات\n- الغلافان رسوم توضيحية برمجية وليسا صورًا تاريخية أرشيفية. استبدلهما بصور موثقة فقط بعد التحقق من الترخيص.\n- عند مراجعة حكاية منشورة، يحافظ المولّد على رقمها ومسارها إذا كانا محفوظين في سجل المعاينة؛ ارفع الملفات داخل المجلد نفسه ولا تنشئ مجلدًا جديدًا للحكاية ذاتها.\n- راجع المسار والرقم مقابل stories/index.json قبل الرفع إذا جرى اعتماد حكاية أخرى بالتزامن، ولا تستبدل فهرسًا أحدث من الفهرس المرفق.\n- هذه الحزمة لا تعدّل قاعدة البيانات ولا تنشر بنفسها؛ الرفع إلى GitHub خطوة منفصلة.\n';
 files.push({path:root+'README-upload.md',content:readme});
 var blob=zipFiles(files),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='khaledoon-story-'+section+'-'+id+'.zip';a.click();setTimeout(function(){URL.revokeObjectURL(url)},2000);
 return {id:id,section:section,path:root,filename:a.download,files:files.map(function(f){return f.path}),published:opts.approved===true};
}
function renderPreviewHtml(d){
 var key=String(d&&d.section_key||'history'),section=SECTION_MAP[key]||'history',accent=ACCENTS[section]||'#d5b7ff',html=storyHtml(d,'preview',section,accent,'https://engmohamedgamalsaad-oss.github.io/nourdeen-october-1973');
 var base='<base href="https://engmohamedgamalsaad-oss.github.io/nourdeen-october-1973/stories/'+section+'/preview/">';
 html=html.replace('<head>','<head>\n'+base);
 /* Keep preview assets available while matching the generated publish template. */
 html=html.replace('<link rel="stylesheet" href="theme.css">','<link rel="stylesheet" href="https://engmohamedgamalsaad-oss.github.io/nourdeen-october-1973/stories/history/005/theme.css"><style>:root{--gold:'+accent+'!important;--accent:'+accent+'!important}.hero .eyebrow,.kicker,.story-quiz-kicker{color:var(--gold)}</style>');
 var popupSvg=encodeURIComponent(svgCover(d,'preview',accent,true));
 html=html.replace('src="cover-popup.svg"','src="data:image/svg+xml;charset=utf-8,'+popupSvg+'"');
 var trScript=translatedRows(d,'preview').replace(/<\/script/gi,'<\\/script');
 html=html.replace('<script src="./translations.js"></script>','<script>'+trScript+'</script>');
 html=html.replace('<script src="../../../assets/shared/reactions.js"></script>','');
 html=html.replace('<script src="../../../assets/shared/story-quiz.js"></script>','');
 html=html.replace('</head>','<style>.reactions-section button{pointer-events:none!important;opacity:.55!important;cursor:not-allowed!important}.reaction-status:after{content:"التفاعلات معطلة في المعاينة";display:block;color:#d6ad55;font-weight:700;margin-top:8px}</style></head>');
 var quiz={questions:[]};try{quiz=typeof d.question_bank_json==='string'?JSON.parse(d.question_bank_json):(d.question_bank_json||quiz)}catch(ignoreQuiz){}if(!quiz||!Array.isArray(quiz.questions))quiz={questions:[]};quiz.id='preview';quiz.title=d.figure_name||d.title||'حكاية المعاينة';
 var quizJson=JSON.stringify(quiz).replace(/</g,'\\u003c');
 var script='<script>(function(){var n=document.createElement("div");n.textContent="معاينة خاصة غير منشورة — الإعجابات والتفاعلات معطلة";n.setAttribute("role","status");n.style.cssText="position:sticky;top:0;z-index:2147483647;padding:8px 14px;text-align:center;background:#f0d8aa;color:#17232a;font:700 14px Cairo,Tahoma,sans-serif";document.body.insertBefore(n,document.body.firstChild);document.querySelectorAll(".reaction-btn").forEach(function(b){b.disabled=true});var data='+quizJson+',start=document.getElementById("story-quiz-start"),app=document.getElementById("story-quiz-app"),lang="ar",idx=0,score=0,chosen=null,answered=false;if(!start||!app)return;document.addEventListener("site-language-change",function(e){lang=((e.detail&&e.detail.lang)||"ar").slice(0,2)});function element(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}function render(){if(!data.questions||data.questions.length<5){start.disabled=true;start.textContent="الاختبار غير متاح في المعاينة";return}var q=data.questions[idx],t=q.i18n&&q.i18n[lang]||q;chosen=null;answered=false;app.textContent="";app.appendChild(element("p","story-quiz-progress","السؤال "+(idx+1)+" من "+Math.min(5,data.questions.length)));app.appendChild(element("h3","story-quiz-question",t.q));var options=element("div","story-quiz-options");(t.o||q.o||[]).forEach(function(v,i){var b=element("button","story-quiz-option",String(i+1)+". "+v);b.type="button";b.addEventListener("click",function(){if(answered)return;chosen=i;Array.prototype.forEach.call(options.children,function(x,j){x.setAttribute("aria-pressed",String(i===j))})});options.appendChild(b)});app.appendChild(options);var feedback=element("div","story-quiz-feedback");app.appendChild(feedback);var submit=element("button","story-quiz-action","تأكيد الإجابة");submit.type="button";submit.addEventListener("click",function(){if(!answered){if(chosen===null){feedback.textContent="اختر إجابة أولًا.";return}answered=true;var correct=chosen===q.a;if(correct)score++;Array.prototype.forEach.call(options.children,function(b){b.disabled=true});feedback.textContent=(correct?"إجابة صحيحة. ":"إجابة غير صحيحة. ")+"الإجابة الصحيحة: "+(t.o||q.o)[q.a]+". "+(t.e||q.e||"");submit.textContent=idx>=Math.min(5,data.questions.length)-1?"عرض النتيجة":"السؤال التالي";return}idx++;if(idx<Math.min(5,data.questions.length))render();else{app.textContent="";app.appendChild(element("h3","story-quiz-result","النتيجة: "+score+" / "+idx));var retry=element("button","story-quiz-action","إعادة الاختبار");retry.type="button";retry.addEventListener("click",function(){idx=0;score=0;render()});app.appendChild(retry)}});app.appendChild(submit);start.hidden=true;app.hidden=false}start.addEventListener("click",function(){idx=0;score=0;render()})})();<\/script>';
 html=html.replace('</body>',script+'</body>');
 return html;
}
window.KHStoryBundle={validate:validate,download:download,renderPreviewHtml:renderPreviewHtml,nextId:nextId};
})();
