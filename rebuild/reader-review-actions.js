(function(){
'use strict';
var params=new URLSearchParams(location.search);
if(params.get('draft')!=='1')return;
var SUPA='https://ypwprddkscnfblhftkeb.supabase.co';
var KEY='sb_publishable_JJnVwx8HQAJNxSok32L-qg_83fXk5Qn';
var panel=null,approve=null,reject=null,back=null,reason=null,status=null,gatePill=null,gateFill=null,gateText=null,gateDetails=null,gateDetailsBody=null,bar=null,drop=null,flag=null,isOpen=false,pinned=false,closeTimer=null,busy=false,draft=null,ctx=null;
function $(id){return document.getElementById(id)}
function message(s,bad){if(status){status.textContent=s;status.dataset.tone=bad?'bad':'ok'}}
/* اللوحة شريط رفيع واحد ثابت أعلى الصفحة؛ تنفتح تفاصيلها وأزرارها عند تقريب الماوس منها (أو بالضغط عليها في الهاتف) وتنطوي ثانية عند الابتعاد.
   المحتوى المفتوح يطفو فوق الصفحة ولا يدفعها، فلا يحدث اهتزاز في التخطيط. */
var PANEL_CSS=[
'#kh-preview-decision-panel{--ok:#2fbf80;--warn:#f0a53a;--bad:#ef6b6b;position:sticky;top:8px;z-index:900;display:block;max-width:1100px;margin:8px auto;padding:0;color:#f5f0e6;font:600 14px/1.7 Cairo,Arial,sans-serif}',
'#kh-preview-decision-panel .khd-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:46px;padding:6px 8px 6px 14px;border:1px solid rgba(215,173,102,.55);border-radius:999px;background:linear-gradient(160deg,rgba(18,40,50,.97),rgba(7,20,27,.97));box-shadow:0 8px 22px rgba(0,0,0,.35);cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent}',
'#kh-preview-decision-panel .khd-bar:focus-visible{outline:3px solid rgba(215,173,102,.7);outline-offset:2px}',
'#kh-preview-decision-panel .khd-title{display:none}',
'#kh-preview-decision-panel .khd-bar{justify-content:center}',
'#kh-preview-decision-panel .khd-end{width:100%;justify-content:center;flex-wrap:nowrap;white-space:nowrap;gap:6px;min-width:0}',
'#kh-preview-decision-panel .khd-flag{flex:0 1 auto;min-width:0}',
'#kh-preview-decision-panel .khd-pill{flex:0 1 auto;min-width:0}',
'#kh-preview-decision-panel .khd-colab-link{flex:0 0 auto}',

'#kh-preview-decision-panel .khd-title i{display:grid;place-items:center;flex:none;width:30px;height:30px;border-radius:50%;background:rgba(215,173,102,.2);border:1.5px solid #d7ad66;font-style:normal;font-size:15px}',
'#kh-preview-decision-panel .khd-end{display:flex;align-items:center;gap:8px;min-width:0}',
'#kh-preview-decision-panel .khd-end{flex-wrap:nowrap;white-space:nowrap}',
'#kh-preview-decision-panel .khd-colab-link{display:inline-flex;align-items:center;justify-content:center;flex:none;padding:3px 10px;border:1px solid #d7ad66;border-radius:999px;background:rgba(215,173,102,.13);color:#f5dcae;text-decoration:none;font:800 11px/1.6 Cairo,Arial,sans-serif;white-space:nowrap}',
'#kh-preview-decision-panel .khd-colab-link:focus-visible{outline:2px solid #d7ad66;outline-offset:2px}',
'@media(max-width:600px){#kh-preview-decision-panel{margin:6px 5px}#kh-preview-decision-panel .khd-bar{justify-content:center;gap:3px;padding:5px 4px;min-height:42px}#kh-preview-decision-panel .khd-end{width:100%;justify-content:center;gap:3px;flex-wrap:nowrap;white-space:nowrap;overflow:hidden}#kh-preview-decision-panel .khd-flag{flex:0 1 auto;min-width:0;padding:2px 5px;font-size:9px}#kh-preview-decision-panel .khd-pill{flex:0 1 auto;min-width:0;max-width:48%;padding:2px 5px;font-size:9px}#kh-preview-decision-panel .khd-colab-link{flex:0 0 auto;padding:2px 6px;font-size:9px}#kh-preview-decision-panel .khd-chev{flex:0 0 18px;width:18px;height:22px}}',

'#kh-preview-decision-panel .khd-flag{display:none;padding:2px 10px;border-radius:999px;border:1px solid var(--bad);background:rgba(239,107,107,.15);color:#ffb8b8;font:800 11px/1.6 Cairo,Arial,sans-serif;white-space:nowrap}',
'#kh-preview-decision-panel[data-ctx="missing"] .khd-flag{display:inline-block}',
'#kh-preview-decision-panel .khd-pill{max-width:min(46vw,420px);overflow:hidden;text-overflow:ellipsis;padding:3px 14px;border-radius:999px;border:1px solid var(--warn);background:rgba(240,165,58,.14);color:var(--warn);font:800 12px/1.6 Cairo,Arial,sans-serif;white-space:nowrap}',
'#kh-preview-decision-panel[data-gate="ok"] .khd-pill{border-color:var(--ok);background:rgba(47,191,128,.15);color:var(--ok)}',
'#kh-preview-decision-panel[data-gate="bad"] .khd-pill{border-color:var(--bad);background:rgba(239,107,107,.15);color:var(--bad)}',
'#kh-preview-decision-panel[data-gate="wait"] .khd-pill{border-color:#64748b;background:rgba(100,116,139,.2);color:#cbd5e1}',
'#kh-preview-decision-panel .khd-chev{display:grid;place-items:center;flex:none;width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.08);font-size:12px;transition:transform .2s ease}',
'#kh-preview-decision-panel[data-open="1"] .khd-chev{transform:rotate(180deg)}',
'#kh-preview-decision-panel .khd-drop{position:absolute;top:calc(100% + 4px);inset-inline:0;display:grid;gap:12px;box-sizing:border-box;max-height:min(72vh,560px);overflow:auto;padding:14px 16px;border:1px solid rgba(215,173,102,.55);border-radius:20px;background:linear-gradient(160deg,rgba(18,40,50,.98),rgba(7,20,27,.98));box-shadow:0 18px 40px rgba(0,0,0,.5);visibility:hidden;opacity:0;transform:translateY(-6px);pointer-events:none;transition:opacity .18s ease,transform .18s ease,visibility 0s linear .18s}',
'#kh-preview-decision-panel[data-open="1"] .khd-drop{visibility:visible;opacity:1;transform:none;pointer-events:auto;transition:opacity .18s ease,transform .18s ease,visibility 0s}',
'#kh-preview-decision-panel .khd-meter{height:8px;border-radius:999px;background:rgba(255,255,255,.12);overflow:hidden;direction:ltr}',
'#kh-preview-decision-panel .khd-meter span{display:block;height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,#2fbf80,#7fe0b4);transition:width .4s ease}',
'#kh-preview-decision-panel .khd-note{margin:0;font-size:12px;color:#aebcc2}',
'#kh-preview-decision-panel .khd-note:empty{display:none}',
'#kh-preview-decision-panel .khd-details{margin:0;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(255,255,255,.04)}',
'#kh-preview-decision-panel .khd-details summary{cursor:pointer;padding:8px 12px;font:700 12px/1.6 Cairo,Arial,sans-serif;color:#d7ad66}',
'#kh-preview-decision-panel .khd-details div{max-height:140px;overflow:auto;padding:2px 12px 10px;font:500 12px/1.8 Cairo,Arial,sans-serif;color:#aebcc2;white-space:pre-wrap;overflow-wrap:anywhere}',
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
'.kh-audio-review-gate .kh-gate-message{max-height:110px;overflow:auto;overflow-wrap:anywhere}',
'@media(max-width:640px){#kh-preview-decision-panel{top:6px;margin:6px}#kh-preview-decision-panel .khd-actions{grid-template-columns:minmax(0,1fr)}}',
'@media(max-width:480px){#kh-preview-decision-panel .khd-title span{display:none}}',
'@media(prefers-reduced-motion:reduce){#kh-preview-decision-panel *{transition:none!important}}',
'@media print{#kh-preview-decision-panel{display:none!important}}'
].join('');
/* يبقى المحتوى مفتوحًا ما دام المسؤول يتعامل معه: مثبّت بالضغط، أو عملية حفظ جارية، أو خانة سبب الرفض ظاهرة، أو التركيز على عنصر داخله */
function holdOpen(){
 if(pinned||busy)return true;
 if(reason&&reason.style.display==='block')return true;
 var a=document.activeElement;
 return !!(a&&a!==bar&&panel&&panel.contains(a));
}
function setOpen(on){
 isOpen=!!on;
 if(panel)panel.dataset.open=isOpen?'1':'0';
 if(bar)bar.setAttribute('aria-expanded',isOpen?'true':'false');
}
function scheduleClose(){
 clearTimeout(closeTimer);
 closeTimer=setTimeout(function(){if(!holdOpen())setOpen(false)},280);
}
function togglePinned(){
 if(pinned){pinned=false;if(!busy)setOpen(false)}
 else{pinned=true;setOpen(true)}
}
function addControls(){
 if($('kh-preview-decision-panel'))return;
 var style=document.createElement('style');
 style.textContent=PANEL_CSS;
 document.head.appendChild(style);
 panel=document.createElement('section');panel.id='kh-preview-decision-panel';panel.setAttribute('aria-label','قرارات مراجعة المعاينة');panel.dataset.gate='wait';panel.dataset.open='0';panel.dataset.ctx='ok';
 bar=document.createElement('div');bar.className='khd-bar';bar.setAttribute('role','button');bar.tabIndex=0;bar.setAttribute('aria-expanded','false');bar.setAttribute('aria-controls','kh-preview-decision-drop');bar.setAttribute('aria-label','قرار مراجعة المعاينة — اضغط لفتح أو إغلاق التفاصيل');
 var title=document.createElement('div');title.className='khd-title';
 var icon=document.createElement('i');icon.textContent='🛡️';
 var titleText=document.createElement('span');titleText.textContent='قرار مراجعة المعاينة';
 title.append(icon,titleText);
 var end=document.createElement('div');end.className='khd-end';
 flag=document.createElement('span');flag.className='khd-flag';flag.id='kh-preview-ctx-flag';
 gatePill=document.createElement('span');gatePill.className='khd-pill';gatePill.id='kh-preview-gate-pill';gatePill.textContent='جارٍ فحص الصوت…';
 var colabLink=document.createElement('a');colabLink.className='khd-colab-link';colabLink.href='https://colab.research.google.com/github/engmohamedgamalsaad-oss/nourdeen-october-1973/blob/main/notebooks/Khaledoon_OmniVoice_Unified_Worker.ipynb';colabLink.target='_blank';colabLink.rel='noopener noreferrer';colabLink.textContent='تشغيل Colab';colabLink.setAttribute('aria-label','فتح دفتر Colab لإعادة تشغيل عامل الصوت');colabLink.addEventListener('click',function(event){event.stopPropagation()});

 var chev=document.createElement('span');chev.className='khd-chev';chev.setAttribute('aria-hidden','true');chev.textContent='▾';
 end.append(flag,gatePill,colabLink,chev);
 bar.append(title,end);
 drop=document.createElement('div');drop.className='khd-drop';drop.id='kh-preview-decision-drop';
 var meter=document.createElement('div');meter.className='khd-meter';gateFill=document.createElement('span');meter.appendChild(gateFill);
 gateText=document.createElement('p');gateText.className='khd-note';gateText.id='kh-preview-gate-note';
 gateDetails=document.createElement('details');gateDetails.className='khd-details';gateDetails.hidden=true;
 var detailsSummary=document.createElement('summary');detailsSummary.textContent='عرض تفاصيل مشكلة الصوت';
 gateDetailsBody=document.createElement('div');
 gateDetails.append(detailsSummary,gateDetailsBody);
 var actions=document.createElement('div');actions.className='khd-actions';
 approve=document.createElement('button');approve.id='kh-preview-approve';approve.type='button';approve.textContent='✓ قبول المعاينة';
 reject=document.createElement('button');reject.id='kh-preview-reject';reject.type='button';reject.textContent='✕ رفض المعاينة';
 back=document.createElement('button');back.id='kh-preview-back';back.type='button';back.textContent='↩ الرجوع إلى لوحة الإدارة';
 actions.append(approve,reject,back);
 reason=document.createElement('textarea');reason.id='kh-preview-reason';reason.maxLength=1000;reason.placeholder='اكتب سبب رفض المعاينة (مطلوب قبل تسجيل الرفض)';
 status=document.createElement('div');status.id='kh-preview-decision-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 drop.append(meter,gateText,gateDetails,actions,reason,status);
 panel.append(bar,drop);
 var header=document.querySelector('header');
 if(header&&header.parentNode)header.parentNode.insertBefore(panel,header.nextSibling);else document.body.insertBefore(panel,document.body.firstChild);
 /* فتح/إغلاق: ماوس (تقريب)، ضغط/لمس، لوحة مفاتيح، Escape، والضغط خارج اللوحة */
 panel.addEventListener('pointerenter',function(e){if(e.pointerType==='touch')return;clearTimeout(closeTimer);setOpen(true)});
 panel.addEventListener('pointerleave',function(e){if(e.pointerType==='touch')return;scheduleClose()});
 bar.addEventListener('click',togglePinned);
 bar.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();togglePinned()}});
 panel.addEventListener('keydown',function(e){if(e.key==='Escape'&&!busy){pinned=false;setOpen(false);try{bar.focus()}catch(x){}}});
 document.addEventListener('pointerdown',function(e){
  if(!panel||panel.contains(e.target)||!isOpen)return;
  pinned=false;
  if(!holdOpen())setOpen(false);
 });
 approve.addEventListener('click',function(){decide(true)});
 reject.addEventListener('click',function(){if(reason.style.display==='block'){decide(false)}else{reason.style.display='block';reason.focus();message('اكتب سبب الرفض ثم اضغط «رفض المعاينة» مرة أخرى.')}});
 back.addEventListener('click',function(){var id=draft&&draft.submission_id?encodeURIComponent(draft.submission_id):'';location.href='../khaledoon/admin.html?returnfrompreview=1'+(id?'&submission='+id:'')});
}
/* سطر قصير ظاهر + تفاصيل كاملة داخل عنصر قابل للطي، فلا يطول نص الخطأ اللوحة */
function setNote(short,full){
 gateText.textContent=short||'';
 if(full&&full!==short){gateDetails.hidden=false;gateDetailsBody.textContent=full}
 else{gateDetails.hidden=true;gateDetails.open=false;gateDetailsBody.textContent=''}
}
/* يعكس حالة مراجعة الصوت على اللوحة: لا يغيّر منطق القرار، فقط العرض */
function refreshGate(){
 if(!panel)return;
 var api=window.KHStoryAudioReview,g=null;
 if(!api||typeof api.gate!=='function'){
  panel.dataset.gate='wait';gatePill.textContent='مدقق الصوت لم يُحمَّل بعد';gateFill.style.width='0%';
  setNote('لا يمكن قبول المعاينة قبل تحميل مدقق الصوت.');return;
 }
 try{g=api.gate()}catch(e){g=null}
 if(!g){panel.dataset.gate='bad';gatePill.textContent='تعذر فحص الصوت';setNote('تعذر قراءة حالة مراجعة الصوت.');return}
 var total=Number(g.total)||0,accepted=Number(g.accepted)||0;
 gateFill.style.width=(total?Math.round(accepted/total*100):0)+'%';
 if(g.loading){panel.dataset.gate='wait';gatePill.textContent='جارٍ فحص ملفات الصوت…'}
 else if(g.loadError){panel.dataset.gate='bad';gatePill.textContent='خطأ في تحميل الصوت'}
 else if(g.ok){panel.dataset.gate='ok';gatePill.textContent='الصوت: كل المقاطع مقبولة ✓ ('+accepted+'/'+total+')'}
 else{panel.dataset.gate='warn';gatePill.textContent='الصوت: '+accepted+'/'+total+' مقبول'}
 var full='';
 try{full=String(api.gateSummary()||'')}catch(e){full=''}
 if(g.loadError){setNote('تعذر التحقق من ملفات الصوت، ولا يمكن قبول المعاينة قبل إصلاح المشكلة.',full)}
 else if(full.length>160){setNote(full.slice(0,157)+'…',full)}
 else{setNote(full)}
}
function getContext(){
 var params=new URLSearchParams(location.search),urlId=params.get('submission'),urlTable=params.get('table');
 function read(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch(e){return null}}
 var candidates=[read('kh-story-review-context'),read('kh-story-preview-context'),read('kh-story-preview-draft')];
 ctx=candidates.find(function(item){return item&&typeof item==='object'&&item.submission_id&&(!urlId||String(item.submission_id)===String(urlId))})||null;
 if(urlId&&(!ctx||String(ctx.submission_id)!==String(urlId))){
  ctx={submission_id:urlId,submission_table:urlTable==='submitted_stories'?'submitted_stories':'khaledoon_submissions',record_type:'modern'};
  try{localStorage.setItem('kh-story-review-context',JSON.stringify(ctx))}catch(e){}
 }
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
function setBusy(on){busy=on;[approve,reject].forEach(function(b){if(b)b.disabled=on});if(on)setOpen(true)}
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
 approve.disabled=true;reject.disabled=true;
 panel.dataset.ctx='missing';flag.textContent='غير مرتبطة بسجل';
 message('لا توجد بيانات سجل مرتبطة بهذه المعاينة. افتح المعاينة من داخل لوحة الإدارة حتى تظهر أزرار القرار وتعمل.',true);
}
})();
