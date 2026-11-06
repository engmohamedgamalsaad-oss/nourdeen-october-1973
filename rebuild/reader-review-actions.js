(function(){
'use strict';
var params=new URLSearchParams(location.search);
if(params.get('draft')!=='1')return;
var SUPA='https://ypwprddkscnfblhftkeb.supabase.co';
var KEY='sb_publishable_JJnVwx8HQAJNxSok32L-qg_83fXk5Qn';
var panel=null,approve=null,reject=null,back=null,reason=null,status=null,busy=false,draft=null,ctx=null;
function $(id){return document.getElementById(id)}
function message(s,bad){if(status){status.textContent=s;status.style.color=bad?'#ffb8b8':'#b9efc9'}}
function addControls(){
 if($('kh-preview-decision-panel'))return;
 var style=document.createElement('style');
 style.textContent='#kh-preview-decision-panel{position:sticky;top:8px;z-index:1000;display:flex;flex-wrap:wrap;gap:9px;align-items:center;padding:12px;margin:10px auto;max-width:1100px;border:1px solid #b8874b;border-radius:14px;background:rgba(7,20,27,.97);color:#f5f0e6;box-shadow:0 8px 24px #0005}#kh-preview-decision-panel button{font:700 15px Cairo,Arial,sans-serif;border:1px solid #6d7d80;border-radius:10px;padding:9px 16px;cursor:pointer;min-height:42px}#kh-preview-approve{background:#d7ad66;color:#17232a;border-color:#d7ad66!important}#kh-preview-reject{background:#34232a;color:#ffe6e6;border-color:#a85a5a!important}#kh-preview-reason{display:none;flex:1 1 100%;min-width:220px;min-height:66px;padding:9px;border-radius:9px;border:1px solid #8b6868;background:#101c22;color:#fff;font:14px Cairo,Arial,sans-serif}#kh-preview-decision-status{flex:1 1 100%;font:13px Cairo,Arial,sans-serif;line-height:1.7}#kh-preview-decision-panel button:disabled{opacity:.55;cursor:wait}';
 document.head.appendChild(style);
 panel=document.createElement('section');panel.id='kh-preview-decision-panel';panel.setAttribute('aria-label','قرارات مراجعة المعاينة');
 approve=document.createElement('button');approve.id='kh-preview-approve';approve.type='button';approve.textContent='قبول المعاينة';
 reject=document.createElement('button');reject.id='kh-preview-reject';reject.type='button';reject.textContent='رفض المعاينة';
 back=document.createElement('button');back.id='kh-preview-back';back.type='button';back.textContent='الرجوع إلى لوحة الإدارة';back.style.background='#17313a';back.style.color='#f5f0e6';
 reason=document.createElement('textarea');reason.id='kh-preview-reason';reason.maxLength=1000;reason.placeholder='اكتب سبب رفض المعاينة (مطلوب قبل تسجيل الرفض)';
 status=document.createElement('div');status.id='kh-preview-decision-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 panel.append(approve,reject,back,reason,status);
 var header=document.querySelector('header');
 if(header&&header.parentNode)header.parentNode.insertBefore(panel,header.nextSibling);else document.body.insertBefore(panel,document.body.firstChild);
 approve.addEventListener('click',function(){decide(true)});
 reject.addEventListener('click',function(){if(reason.style.display==='block'){decide(false)}else{reason.style.display='block';reason.focus();message('اكتب سبب الرفض ثم اضغط «رفض المعاينة» مرة أخرى.')}});
 back.addEventListener('click',function(){var id=draft&&draft.submission_id?encodeURIComponent(draft.submission_id):'';location.href='../khaledoon/admin.html?returnfrompreview=1'+(id?'&submission='+id:'')});
}
function getContext(){
 try{ctx=JSON.parse(localStorage.getItem('kh-story-review-context')||'null')}catch(e){ctx=null}
 if(!ctx){try{ctx=JSON.parse(localStorage.getItem('kh-story-preview-context')||localStorage.getItem('kh-story-preview-draft')||'null')}catch(e){ctx=null}}
 var params=new URLSearchParams(location.search),urlId=params.get('submission'),urlTable=params.get('table');
 if(urlId&&(!ctx||String(ctx.submission_id)!==String(urlId))){ctx={submission_id:urlId,submission_table:urlTable==='submitted_stories'?'submitted_stories':'khaledoon_submissions',record_type:'modern'};try{localStorage.setItem('kh-story-review-context',JSON.stringify(ctx))}catch(e){}}
 if(!ctx||!ctx.submission_id)return false;
 var source=ctx.record_data&&typeof ctx.record_data==='object'?ctx.record_data:ctx;
 draft=Object.assign({},source,{submission_id:ctx.submission_id,submission_table:ctx.submission_table||'khaledoon_submissions',record_type:ctx.record_type||'modern',story_meta:ctx.story_meta||source.story_meta||{}});
 return true;
}
async function adminToken(){
 var s=null;try{s=JSON.parse(localStorage.getItem('kh_adm_session')||sessionStorage.getItem('kh_adm_session')||'null')}catch(e){}
 if(!s||!s.access_token)throw new Error('سجّل الدخول إلى لوحة الإدارة على هذا الجهاز، ثم أعد فتح المعاينة من داخلها.');
 if(s.expires_at&&s.expires_at-Date.now()/1000<60&&s.refresh_token){
  var rr=await fetch(SUPA+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:s.refresh_token})});
  if(!rr.ok)throw new Error('انتهت جلسة المسؤول. سجّل الدخول مرة أخرى.');
  var rd=await rr.json();s={access_token:rd.access_token,refresh_token:rd.refresh_token,expires_at:Math.floor(Date.now()/1000)+rd.expires_in};
  try{localStorage.setItem('kh_adm_session',JSON.stringify(s));sessionStorage.setItem('kh_adm_session',JSON.stringify(s))}catch(e){}
 }
 return s.access_token;
}
function setBusy(on){busy=on;[approve,reject].forEach(function(b){if(b)b.disabled=on})}
async function decide(isApprove){
 if(busy)return;
 if(!draft||!draft.submission_id){message('لا يوجد رقم سجل مرتبط بهذه المعاينة. افتحها من لوحة الإدارة مرة أخرى.',true);return}
 if(isApprove){
  if(!window.KHStoryAudioReview){message('تعذر تحميل مدقق الصوت. أعد تحميل المعاينة؛ لا يمكن اعتمادها قبل التحقق من حالة الصوت.',true);return}
  if(!window.KHStoryAudioReview.canApprove()){message(window.KHStoryAudioReview.gateSummary()||'راجع واعتمد كل المقاطع الصوتية باللغات الخمس أولًا.',true);return}
 }
 var why=String(reason.value||'').trim();
 if(!isApprove&&!why){reason.style.display='block';reason.focus();message('سبب الرفض مطلوب.',true);return}
 setBusy(true);message(isApprove?'جارٍ حفظ الاعتماد والتحقق منه…':'جارٍ حفظ الرفض والتحقق منه…');
 try{
  if(!window.KHWorkflow)throw new Error('تعذر تحميل منطق سير العمل. أعد تحميل الصفحة.');
  var token=await adminToken(),table=draft.submission_table==='submitted_stories'?'submitted_stories':'khaledoon_submissions';
  var rowUrl=SUPA+'/rest/v1/'+table+'?id=eq.'+encodeURIComponent(draft.submission_id);
  var headers={apikey:KEY,Authorization:'Bearer '+token};
  var read=await fetch(rowUrl+'&select=*',{headers:headers,cache:'no-store'});
  if(!read.ok)throw new Error('تعذرت قراءة سجل الحكاية ('+read.status+').');
  var rows=await read.json();if(!rows.length)throw new Error('لم يُعثر على سجل الحكاية أو لا توجد صلاحية للوصول إليه.');
  var record=rows[0],meta=Object.assign({},record.story_meta||draft.story_meta||{}),payload={};
  if(isApprove){
   meta=window.KHWorkflow.markApproved(meta,{static_story_id:null,static_story_path:null,bundle_downloaded:false,prepared_page_url:''},new Date());
  }else{
   meta=window.KHWorkflow.markPreviewRejected(meta,why,new Date());
  }
  if(record.status!=='published')payload.status=isApprove?(table==='submitted_stories'?'pending':'review'):'pending';
  if(record.status==='published'){
   if(isApprove){
    var pending=Object.assign({},draft);['record_data','submission_id','submission_table','record_type','story_meta','audio_review'].forEach(function(k){delete pending[k]});
    var pendingMeta=Object.assign({},meta);delete pendingMeta.audio_review;
    pending.story_meta=pendingMeta;pending.status='pending';meta.pending_draft=pending;
   }else if(meta.pending_draft){
    meta.pending_draft.preview_review=meta.preview_review;meta.pending_draft.status='pending';
    delete meta.pending_draft.audio_review;
    if(meta.pending_draft.story_meta){meta.pending_draft.story_meta=Object.assign({},meta.pending_draft.story_meta);delete meta.pending_draft.story_meta.audio_review}
   }
  }
  payload.story_meta=meta;
  var save=await fetch(rowUrl,{method:'PATCH',headers:Object.assign({'Content-Type':'application/json',Prefer:'return=representation'},headers),body:JSON.stringify(payload)});
  if(!save.ok)throw new Error('تعذر حفظ القرار في قاعدة البيانات ('+save.status+'): '+(await save.text()).slice(0,240));
  var saved=await save.json();if(!saved.length)throw new Error('لم يؤكد الخادم حفظ القرار.');
  var expected=isApprove?window.KHWorkflow.DECISION.APPROVED:window.KHWorkflow.DECISION.REJECTED;
  var after=saved[0].story_meta&&saved[0].story_meta.preview_review;
  if(!after||after.decision!==expected)throw new Error('لم يؤكد رد الخادم تسجيل القرار.');
  var verify=await fetch(rowUrl+'&select=id,status,story_meta',{headers:headers,cache:'no-store'});
  if(!verify.ok)throw new Error('تم الحفظ لكن تعذر التحقق النهائي ('+verify.status+').');
  var checkRows=await verify.json(),check=checkRows[0],review=check&&check.story_meta&&check.story_meta.preview_review;
  if(!review||review.decision!==expected)throw new Error('فشل التحقق النهائي من القرار. لا تعتبر المعاينة معتمدة.');
  try{localStorage.removeItem('kh-story-review-context')}catch(e){}
  approve.disabled=true;reject.disabled=true;reason.disabled=true;back.disabled=false;
  if(isApprove){
   message('تم اعتماد المعاينة وحفظ القرار والتحقق منه. ستعود الآن إلى لوحة الإدارة لاستكمال النشر.');
   setTimeout(function(){location.href='../khaledoon/admin.html?returnfrompreview=1&submission='+encodeURIComponent(draft.submission_id)},1100);
  }else{
   message('تم رفض المعاينة وإعادة الحكاية للتحرير. سبب الرفض محفوظ. ستعود الآن إلى لوحة الإدارة.');
   setTimeout(function(){location.href='../khaledoon/admin.html?returnfrompreview=1&submission='+encodeURIComponent(draft.submission_id)},1100);
  }
 }catch(e){message('لم يتم تأكيد القرار: '+(e&&e.message||'خطأ غير معروف')+' — لم يتم اعتبار المعاينة معتمدة.',true);setBusy(false)}
}
addControls();
if(!getContext()){
 approve.disabled=true;reject.disabled=true;message('لا توجد بيانات سجل مرتبطة بهذه المعاينة. افتح المعاينة من داخل لوحة الإدارة حتى تظهر أزرار القرار وتعمل.',true);
}
})();