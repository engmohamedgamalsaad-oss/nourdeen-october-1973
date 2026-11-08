(function(){
'use strict';
var params=new URLSearchParams(location.search);
if(params.get('draft')!=='1')return;
var SUPA='https://ypwprddkscnfblhftkeb.supabase.co';
var KEY='sb_publishable_JJnVwx8HQAJNxSok32L-qg_83fXk5Qn';
var panel=null,approve=null,reject=null,back=null,reason=null,status=null,gatePill=null,gateFill=null,gateText=null,busy=false,draft=null,ctx=null;
function $(id){return document.getElementById(id)}
function message(s,bad){if(status){status.textContent=s;status.dataset.tone=bad?'bad':'ok'}}
var PANEL_CSS=[
'#kh-preview-decision-panel{--ok:#2fbf80;--warn:#f0a53a;--bad:#ef6b6b;position:static;z-index:1000;display:grid;gap:12px;max-width:1100px;margin:12px auto;padding:14px 16px;border:1px solid rgba(215,173,102,.55);border-radius:22px;background:linear-gradient(160deg,rgba(18,40,50,.97),rgba(7,20,27,.97));color:#f5f0e6;box-shadow:0 14px 34px rgba(0,0,0,.4);font:600 14px/1.7 Cairo,Arial,sans-serif;backdrop-filter:blur(8px)}',
'#kh-preview-decision-panel .khd-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}',
'#kh-preview-decision-panel .khd-title{display:flex;align-items:center;gap:10px;font:800 16px/1.4 Cairo,Arial,sans-serif}',
'#kh-preview-decision-panel .khd-title i{display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:rgba(215,173,102,.2);border:1.5px solid #d7ad66;font-style:normal;font-size:18px}',
'#kh-preview-decision-panel .khd-pill{padding:4px 14px;border-radius:999px;border:1px solid var(--warn);background:rgba(240,165,58,.14);color:var(--warn);font:800 12px/1.5 Cairo,Arial,sans-serif;white-space:nowrap}',
'#kh-preview-decision-panel[data-gate="ok"] .khd-pill{border-color:var(--ok);background:rgba(47,191,128,.15);color:var(--ok)}',
'#kh-preview-decision-panel[data-gate="bad"] .khd-pill{border-color:var(--bad);background:rgba(239,107,107,.15);color:var(--bad)}',
'#kh-preview-decision-panel[data-gate="wait"] .khd-pill{border-color:#64748b;background:rgba(100,116,139,.2);color:#cbd5e1}',
'#kh-preview-decision-panel .khd-meter{height:8px;border-radius:999px;background:rgba(255,255,255,.12);overflow:hidden;direction:ltr}',
'#kh-preview-decision-panel .khd-meter span{display:block;height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,#2fbf80,#7fe0b4);transition:width .4s ease}',
'#kh-preview-decision-panel .khd-note{margin:0;font-size:12px;color:#aebcc2}',
'#kh-preview-decision-panel .khd-actions{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1.2fr) minmax(0,1fr);gap:10px}',
'#kh-preview-decision-panel button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:10px 16px;border:1.5px solid rgba(255,255,255,.18);border-radius:14px;background:transparent;color:#f5f0e6;font:800 14px/1.3 Cairo,Arial,sans-serif;cursor:pointer;transition:transform .12s ease,box-shadow .2s ease,opacity .2s ease}',
'#kh-preview-decision-panel button:hover:not(:disabled){transform:translateY(-1px)}',
'#kh-preview-decision-panel button:focus-visible{outline:3px solid rgba(215,173,102,.7);outline-offset:2px}',
'#kh-preview-decision-panel button:disabled{opacity:.5;cursor:wait}',
'#kh-preview-approve{border-color:transparent!important;background:linear-gradient(135deg,#2fbf80,#1f9d66)!important;color:#fff!important;font-size:15px!important;box-shadow:0 8px 20px rgba(47,191,128,.32)}',
'#kh-preview-decision-panel[data-gate="bad"] #kh-preview-approve,#kh-preview-decision-panel[data-gate="warn"] #kh-preview-approve,#kh-preview-decision-panel[data-gate="wait"] #kh-preview-approve{background:rgba(255,255,255,.06)!important;border:1.5px dashed rgba(255,255,255,.3)!important;color:#c7d2d6!important;box-shadow:none}',
'#kh-preview-reject{border-color:rgba(239,107,107,.75)!important;background:rgba(239,107,107,.1)!important;color:#ffb8b8!important}',
'#kh-preview-back{background:rgba(255,255,255,.06)!important}',
'#kh-preview-reason{display:none;box-sizing:border-box;width:100%;min-height:80px;padding:11px 13px;border-radius:14px;border:1.5px solid rgba(239,107,107,.6);background:#0e1a20;color:#fff;font:14px/1.8 Cairo,Arial,sans-serif;resize:vertical}',
'#kh-preview-reason:focus{outline:none;box-shadow:0 0 0 3px rgba(239,107,107,.3)}',
'#kh-preview-decision-status{font:13px/1.8 Cairo,Arial,sans-serif;color:#b9efc9}',
'#kh-preview-decision-status[data-tone="bad"]{color:#ffb8b8}',
'#kh-preview-decision-status:empty{display:none}',
'@media(max-width:640px){#kh-preview-decision-panel{top:4px;margin:8px;padding:12px;border-radius:18px}#kh-preview-decision-panel .khd-actions{grid-template-columns:minmax(0,1fr)}}',
'@media(min-width:900px) and (min-height:760px){#kh-preview-decision-panel{position:sticky;top:8px}}',
'@media print{#kh-preview-decision-panel{display:none!important}}'
].join('');
function addControls(){
 if($('kh-preview-decision-panel'))return;
 var style=document.createElement('style');
 style.textContent=PANEL_CSS;
 document.head.appendChild(style);
 panel=document.createElement('section');panel.id='kh-preview-decision-panel';panel.setAttribute('aria-label','قرارات مراجعة المعاينة');panel.dataset.gate='wait';
 var head=document.createElement('div');head.className='khd-head';
 var title=document.createElement('div');title.className='khd-title';
 var icon=document.createElement('i');icon.textContent='🛡️';
 var titleText=document.createElement('span');titleText.textContent='قرار مراجعة المعاينة';
 title.append(icon,titleText);
 gatePill=document.createElement('span');gatePill.className='khd-pill';gatePill.id='kh-preview-gate-pill';gatePill.textContent='جارٍ فحص الصوت…';
 head.append(title,gatePill);
 var meter=document.createElement('div');meter.className='khd-meter';gateFill=document.createElement('span');meter.appendChild(gateFill);
 gateText=document.createElement('p');gateText.className='khd-note';gateText.id='kh-preview-gate-note';
 var actions=document.createElement('div');actions.className='khd-actions';
 approve=document.createElement('button');approve.id='kh-preview-approve';approve.type='button';approve.textContent='✓ قبول المعاينة';
 reject=document.createElement('button');reject.id='kh-preview-reject';reject.type='button';reject.textContent='✕ رفض المعاينة';
 back=document.createElement('button');back.id='kh-preview-back';back.type='button';back.textContent='↩ الرجوع إلى لوحة الإدارة';
 actions.append(approve,reject,back);
 reason=document.createElement('textarea');reason.id='kh-preview-reason';reason.maxLength=1000;reason.placeholder='اكتب سبب رفض المعاينة (مطلوب قبل تسجيل الرفض)';
 status=document.createElement('div');status.id='kh-preview-decision-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 panel.append(head,meter,gateText,actions,reason,status);
 var header=document.querySelector('header');
 if(header&&header.parentNode)header.parentNode.insertBefore(panel,header.nextSibling);else document.body.insertBefore(panel,document.body.firstChild);
 approve.addEventListener('click',function(){decide(true)});
 reject.addEventListener('click',function(){if(reason.style.display==='block'){decide(false)}else{reason.style.display='block';reason.focus();message('اكتب سبب الرفض ثم اضغط «رفض المعاينة» مرة أخرى.')}});
 back.addEventListener('click',function(){var id=draft&&draft.submission_id?encodeURIComponent(draft.submission_id):'';location.href='../khaledoon/admin.html?returnfrompreview=1'+(id?'&submission='+id:'')});
}
/* يعكس حالة مراجعة الصوت على اللوحة: لا يغيّر منطق القرار، فقط العرض */
function refreshGate(){
 if(!panel)return;
 var api=window.KHStoryAudioReview,g=null;
 if(!api||typeof api.gate!=='function'){
  panel.dataset.gate='wait';gatePill.textContent='مدقق الصوت لم يُحمَّل بعد';gateFill.style.width='0%';
  gateText.textContent='لا يمكن قبول المعاينة قبل تحميل مدقق الصوت.';return;
 }
 try{g=api.gate()}catch(e){g=null}
 if(!g){panel.dataset.gate='bad';gatePill.textContent='تعذر فحص الصوت';gateText.textContent='تعذر قراءة حالة مراجعة الصوت.';return}
 var total=Number(g.total)||0,accepted=Number(g.accepted)||0;
 gateFill.style.width=(total?Math.round(accepted/total*100):0)+'%';
 if(g.loading){panel.dataset.gate='wait';gatePill.textContent='جارٍ فحص ملفات الصوت…'}
 else if(g.loadError){panel.dataset.gate='bad';gatePill.textContent='خطأ في تحميل الصوت'}
 else if(g.ok){panel.dataset.gate='ok';gatePill.textContent='الصوت: كل المقاطع مقبولة ✓ ('+accepted+'/'+total+')'}
 else{panel.dataset.gate='warn';gatePill.textContent='الصوت: '+accepted+'/'+total+' مقبول'}
 try{gateText.textContent=api.gateSummary()||''}catch(e){gateText.textContent=''}
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
refreshGate();
document.addEventListener('kh-audio-review-updated',refreshGate);
document.addEventListener('kh-story-audio-context',refreshGate);
setTimeout(refreshGate,1500);
if(!getContext()){
 approve.disabled=true;reject.disabled=true;message('لا توجد بيانات سجل مرتبطة بهذه المعاينة. افتح المعاينة من داخل لوحة الإدارة حتى تظهر أزرار القرار وتعمل.',true);
}
})();
