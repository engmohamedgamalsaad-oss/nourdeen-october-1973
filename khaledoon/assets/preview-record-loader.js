/* تحميل المعاينة من السجل المحفوظ في Supabase بدل الاعتماد على ذاكرة المتصفح فقط.
   الاستخدام: preview.html?record=<رقم السجل>&table=k
   table=k  ← khaledoon_submissions (الافتراضي) ، table=o ← submitted_stories (حكايات أكتوبر القديمة)
   قراءة فقط بجلسة الأدمن (GET)؛ لا كتابة في قاعدة البيانات ولا نشر ولا تغيير في الحالة.
   بعد القراءة تُجهَّز المسودة بنفس الشكل الذي تجهزه لوحة الإدارة، ثم تُفتح المعاينة العادية. */
(function(){
'use strict';
var params=new URLSearchParams(location.search),recordId=params.get('record');
var KEY_DRAFT='kh-story-preview-draft',KEY_CTX='kh-story-preview-context';
var LABEL='مسودة — معاينة غير منشورة';
var SEC={october:'حكايات أكتوبر 1973',science:'العلم والعلماء',learning:'نساء خالدات',fame:'أعلام الأدب والفنون والرياضة',history:'التاريخ والحضارات',curriculum:'شخصيات المناهج المصرية',islamic:'شخصيات إسلامية',readers:'اقتراحات القرّاء'};

function obj(v){return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}

function whenTools(){
 return new Promise(function(resolve,reject){
  if(window.KHAdminTools)return resolve(window.KHAdminTools);
  window.addEventListener('kh-admin-tools-ready',function(){resolve(window.KHAdminTools)},{once:true});
  setTimeout(function(){reject(new Error('انتهت مهلة التحقق من جلسة الأدمن. افتح لوحة الإدارة وسجّل الدخول ثم أعد المحاولة.'))},20000);
 });
}

/* حكايات خالدون (khaledoon_submissions): نفس منطق بطاقة الإدارة، والحكاية المنشورة تُعرض بمسودتها المعلّقة إن وُجدت. */
function buildModern(row){
 var meta=obj(row.story_meta),pend=row.status==='published'&&meta.pending_draft&&typeof meta.pending_draft==='object'?meta.pending_draft:null;
 var s=pend?Object.assign({},row,pend):row;
 var karma=(pend&&pend.karma_text)||meta.karma_text||'',quiz=(pend&&pend.question_bank_json)||meta.question_bank_json||'',source=(pend&&pend.preview_source_url)||meta.preview_source_url||'';
 var d={section:s.section,stage:s.stage||null,school_grade:s.school_grade||null,subject:s.subject||null,figure_name:s.figure_name||'',narrator_name:s.narrator_name||'',narrator_grade:s.narrator_grade||null,title:s.title||'',subtitle:s.subtitle||null,body:s.body||'',original_body:row.original_body||s.body||'',history_note:s.history_note||null,sources:s.sources||null,images_note:s.images_note||null,admin_notes:s.admin_notes||null,translations:obj(s.translations),consent:!!s.consent,status:row.status==='published'?'published':'pending',story_meta:Object.assign({},meta,{karma_text:karma,question_bank_json:quiz,preview_source_url:source})};
 return {title:d.title,subtitle:d.subtitle||'',section_label:SEC[d.section]||d.section||'',section_key:d.section,figure_name:d.figure_name,body:d.body,karma_text:karma,question_bank_json:quiz,preview_source_url:source,history_note:d.history_note||'',sources:d.sources||'',images_note:d.images_note||'',original_body:d.original_body||'',translations:d.translations,status_label:LABEL,submission_id:row.id,submission_table:'khaledoon_submissions',record_type:'modern',record_data:d,story_meta:d.story_meta,provider_key:'chatgpt'};
}

/* حكايات أكتوبر القديمة (submitted_stories). */
function buildLegacy(row){
 var meta=obj(row.story_meta),saved=Object.assign({},row,obj(meta.pending_draft));
 var karma=saved.karma_text||meta.karma_text||'',quiz=saved.question_bank_json||meta.question_bank_json||'';
 var tr=obj(saved.translations);if(!Object.keys(tr).length)tr=obj(meta.translations);
 var original=saved.original_body||meta.original_body||row.original_body||row.body||'';
 var m=Object.assign({},meta,{karma_text:karma,question_bank_json:quiz,translations:tr});
 return {title:saved.title||'',subtitle:saved.subtitle||'',section_label:SEC.october,section_key:'october',figure_name:saved.title||'',student_name:saved.student_name||'',grade:saved.grade||'',narrator_name:saved.student_name||'',narrator_grade:saved.grade||'',body:saved.body||'',history_note:saved.history_note||meta.history_note||'',sources:saved.sources||'',images_note:saved.images_note||meta.images_note||'',karma_text:karma,question_bank_json:quiz,original_body:original,translations:tr,status_label:LABEL,submission_id:row.id,submission_table:'submitted_stories',record_type:'legacy',record_data:{student_name:saved.student_name||'',grade:saved.grade||'',title:saved.title||'',subtitle:saved.subtitle||'',body:saved.body||'',sources:saved.sources||'',status:row.status==='published'?'published':'pending',story_number:row.story_number||null,story_meta:m},story_meta:m};
}

function showError(message){
 var d=document;
 d.documentElement.style.visibility='visible';
 ['siteView','storyView'].forEach(function(id){var e=d.getElementById(id);if(e)e.hidden=true});
 var nav=d.querySelector('nav.tabs');if(nav)nav.hidden=true;
 var rv=d.getElementById('reviewView');if(!rv)return;
 rv.hidden=false;
 /* لا نعرض أي مسودة قديمة من المتصفح تحت رسالة الخطأ. */
 var pp=rv.querySelector('.publish-preview');if(pp)pp.hidden=true;
 var ap=d.getElementById('actualPagePreviewWrap');if(ap)ap.hidden=true;
 var note=d.createElement('div');note.className='note';note.textContent=message;rv.insertBefore(note,rv.firstChild);
 ['approveStoryBtn','rejectStoryBtn'].forEach(function(id){var b=d.getElementById(id);if(b)b.disabled=true});
 var back=d.getElementById('returnToEditBtn');if(back)back.onclick=function(){location.href='admin.html'};
}

async function hydrate(){
 var tools=await whenTools();
 /* أخفِ الصفحة حتى لا تظهر مسودة قديمة من المتصفح لحظة قبل التحويل. */
 document.documentElement.style.visibility='hidden';
 var table=params.get('table')==='o'?'submitted_stories':'khaledoon_submissions';
 var response=await tools.request(table+'?id=eq.'+encodeURIComponent(recordId)+'&select=*&limit=1');
 var rows=await response.json();
 if(!rows||!rows.length)throw new Error('لم يُعثر على سجل الحكاية في قاعدة البيانات. تأكد من الرابط ومن أن الحكاية لم تُحذف.');
 var draft=table==='submitted_stories'?buildLegacy(rows[0]):buildModern(rows[0]);
 try{
  localStorage.setItem(KEY_DRAFT,JSON.stringify(draft));
  localStorage.setItem(KEY_CTX,JSON.stringify(draft));
 }catch(e){throw new Error('تعذر تجهيز المعاينة في هذا المتصفح: التخزين المحلي غير متاح.')}
 location.replace(location.pathname+'?story=1');
}

if(recordId){
 hydrate().catch(function(error){showError('تعذر فتح المعاينة من السجل المحفوظ: '+(error&&error.message?error.message:'خطأ غير معروف'))});
}

/* عند عرض مسودة، أظهر رابطًا يفتح المعاينة نفسها من السجل المحفوظ. */
document.addEventListener('DOMContentLoaded',function(){
 if(recordId)return;
 var draft=null;try{draft=JSON.parse(localStorage.getItem(KEY_DRAFT)||'null')}catch(e){}
 var rv=document.getElementById('reviewView');
 if(!draft||!draft.submission_id||!rv||rv.hidden)return;
 var actions=rv.querySelector('.pub-actions');if(!actions||actions.parentNode!==rv)return;
 var link=location.pathname+'?record='+encodeURIComponent(draft.submission_id)+(draft.submission_table==='submitted_stories'?'&table=o':'&table=k');
 var note=document.createElement('div');note.className='note';
 note.appendChild(document.createTextNode('هذه المعاينة محفوظة أيضًا في قاعدة البيانات، ويمكن فتحها من السجل نفسه بدل ذاكرة المتصفح. الرابط يتطلب جلسة الأدمن؛ إن لم تكن مسجّلًا سيحوّلك إلى لوحة الإدارة، سجّل الدخول ثم افتح الرابط مرة أخرى: '));
 var a=document.createElement('a');a.href=link;a.textContent='فتح المعاينة من السجل المحفوظ';a.style.color='inherit';a.style.fontWeight='800';
 note.appendChild(a);rv.insertBefore(note,actions);
});
})();
