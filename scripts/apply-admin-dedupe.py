#!/usr/bin/env python3
"""Temporary one-shot patch for khaledoon/admin.html (dedupe buttons + record preview stage).
Every replacement asserts it matches exactly once; the script fails loudly otherwise."""
P='khaledoon/admin.html'
s=open(P,encoding='utf-8').read()
def rep(old,new,count=1):
    global s
    n=s.count(old)
    assert n==count,('count',n,old[:90])
    s=s.replace(old,new)

helpers=r'''/* مساعدات مشتركة للمعاينة والاعتماد (بدل نسخ الكود في كل زر). */
function storyReviewPackageOf(it){var m=it.story_meta||{},p=m.pending_draft&&typeof m.pending_draft==='object'?m.pending_draft:null;return p&&(p.story_only_draft||p.v2_only_draft)?(p.story_package||p.v2_package):((m.story_only_draft||m.v2_only_draft)?(m.story_package||m.v2_package):null)}
function stageStoryReview(it,pkg){var meta=it.story_meta||{},pending=meta.pending_draft&&typeof meta.pending_draft==='object'?meta.pending_draft:null;try{localStorage.setItem('kh-story-review-package',JSON.stringify(pkg));localStorage.setItem('kh-story-review-context',JSON.stringify({submission_id:it.id||null,submission_table:it._t==='o'?'submitted_stories':'khaledoon_submissions',record_type:'modern',status:it.status||'pending',story_meta:meta,record_data:Object.assign({},pending||it)}));var bank=(pending&&pending.question_bank_json)||meta.question_bank_json||pkg.question_bank_json||'';if(bank)localStorage.setItem('kh-story-preview-bank',typeof bank==='string'?bank:JSON.stringify(bank));else localStorage.removeItem('kh-story-preview-bank')}catch(ignoreStoryReviewStore){}}
function shouldRecordPreview(it){var st=window.KHWorkflow.stateOf(it).state;return st!=='preview_sent'&&st!=='awaiting_publish'}
async function recordPreviewSent(it){
 var table=it._t==='o'?'submitted_stories':'khaledoon_submissions',meta=Object.assign({},it.story_meta||{});
 if(it.status==='published'){var pending=Object.assign({},meta.pending_draft||it);pending.story_meta=window.KHWorkflow.markPreviewSent(pending.story_meta||meta,new Date());pending.status='pending';delete pending._t;meta.pending_draft=pending}else meta=window.KHWorkflow.markPreviewSent(meta,new Date());
 var payload={story_meta:meta};if(it.status!=='published')payload.status=it.status==='rejected'?'pending':it.status;
 var saved=await rest(table+'?id=eq.'+encodeURIComponent(it.id),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
 if(!saved.ok)throw new Error('تعذر تسجيل إرسال المعاينة ('+saved.status+').');
 var rows=await saved.json();if(!rows.length)throw new Error('لم يرجع الخادم سجل الحكاية بعد إرسال المعاينة.');
 if(rows[0])Object.assign(it,rows[0]);return rows[0];
}
/* تعديل نص بعد اعتماد المعاينة يُسقط الاعتماد (markEdited)؛ الحفظ بلا تغيير في النص لا يمسّه. */
function dropApprovalIfEdited(it,fields,meta){
 var pr=it.story_meta&&it.story_meta.preview_review;if(!pr||pr.decision!=='approved_waiting_for_github_upload')return meta;
 var m=it.story_meta||{},p=m.pending_draft&&typeof m.pending_draft==='object'?m.pending_draft:{},base=Object.assign({},it,p),dm=fields.story_meta||{};
 function norm(x){return String(x==null?'':x).trim()}
 function oldOf(k){return norm(base[k]!=null?base[k]:m[k])}
 function newOf(k){return norm(fields[k]!=null?fields[k]:dm[k])}
 var changed=['title','subtitle','body','sources','history_note','images_note','karma_text','question_bank_json'].some(function(k){return oldOf(k)!==newOf(k)});
 return changed?window.KHWorkflow.markEdited(meta||m,new Date()):meta;
}
function legacyCard(it){'''
rep('function legacyCard(it){',helpers)

rep("""var sendPR=el('button','btn primary',it.story_meta&&it.story_meta.preview_review&&(it.story_meta.preview_review.publish_commit_sha||it.story_meta.preview_review.published_to_main_at)?'التحقق من النشر':'نشر الحكاية');""","""var sendPR=el('button','btn primary','نشر الحكاية');""")
rep("pubBtn=el('button','btn ghost','نشر وحفظ')","pubBtn=el('button','btn ghost','معاينة قبل النشر')")
rep("storyMeta.translations=translations;\n","storyMeta.translations=translations;storyMeta=dropApprovalIfEdited(it,{title:title.value,subtitle:subtitle.value,body:body.value,sources:sources.value,history_note:hist.value,images_note:imagesNote.value,karma_text:karma.value,question_bank_json:quizJson.value},storyMeta);\n")
rep("popup.location.href='preview.html?story=1'}catch(e)","if(shouldRecordPreview(it))await recordPreviewSent(it);popup.location.href='preview.html?story=1'}catch(e)")
i=s.index("delBtn.addEventListener('click',async function(){")
j=s.index("return box;",i)
s=s[:i]+"delBtn.addEventListener('click',function(){if(!confirmDelete(it))return;removeItem(it,delBtn)});\n  "+s[j:]

rep(" var bPub=el('button','btn ghost','نشر وحفظ');bPub.type='button';\n","")
rep("bar.appendChild(bSave);if(it.status!=='published')bar.appendChild(bPub);","bar.appendChild(bSave);")
rep(" bPub.title='لا ينشر مباشرة؛ يحفظ المسودة ثم يفتح المعاينة للموافقة قبل أي نشر.';\n bPub.addEventListener('click',function(){openPreviewAfterSave(bPub)});\n","")
rep("bSave.disabled=true;bPub.disabled=true;","bSave.disabled=true;")
rep("if(confirm('حذف هذه الحكاية نهائيًا؟'))remove(it,bd)","if(confirmDelete(it))removeItem(it,bd)")
i=s.index("async function remove(it,btn){");j=s.index("function copyKey(it)",i)
s=s[:i]+s[j:]
rep("  var d=collect(status);\n  saveMsg.hidden=true;","  var d=collect(status);if(!sendingToPreview)d.story_meta=dropApprovalIfEdited(it,d,d.story_meta);\n  saveMsg.hidden=true;")

a=s.index("if(storyPackageDirect){try{localStorage.setItem('kh-story-review-package'")
b=s.index("return}",a)+len("return}")
new_direct="""if(storyPackageDirect){var directStoryWindow=window.open('about:blank','_blank');if(!directStoryWindow){say('err','المعاينة لم تُفتح لأن المتصفح منع النافذة المنبثقة. افتح صفحة معاينة الحزمة الموحدة يدويًا.');return}directStoryWindow.opener=null;(async function(){try{if(shouldRecordPreview(it))await recordPreviewSent(it);stageStoryReview(it,storyPackageDirect);directStoryWindow.location.href='../rebuild/package-review.html?draft=1&v=20261102-unified-reader-preview-3'}catch(directError){try{directStoryWindow.close()}catch(ignoreDirectClose){}say('err',directError.message||'تعذر تسجيل إرسال المعاينة.')}})();return}"""
s=s[:a]+new_direct+s[b:]
rep("if(storyPackageForPreview){localStorage.setItem('kh-story-review-package'","if(storyPackageForPreview){stageStoryReview(it,storyPackageForPreview);localStorage.setItem('kh-story-review-package'")

a=s.index("preview.addEventListener('click',async function(ev){")
b=s.index("});actions.appendChild(preview);",a)
new_list="""preview.addEventListener('click',async function(ev){ev.preventDefault();var storyReviewPackage=storyReviewPackageOf(it);var popup=window.open('about:blank','_blank');if(!popup){say('err','المعاينة لم تُفتح لأن المتصفح منع النافذة المنبثقة.');return}try{popup.document.write('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><body style="font-family:Arial;padding:24px;background:#07141b;color:#f5f0e6">جارٍ إرسال الحكاية إلى المعاينة…</body></html>');popup.document.close()}catch(ignorePopup){}try{if(shouldRecordPreview(it))await recordPreviewSent(it);if(storyReviewPackage){stageStoryReview(it,storyReviewPackage);popup.location.href='../rebuild/package-review.html?draft=1&submission='+encodeURIComponent(String(it.id||''))+'&table='+encodeURIComponent(it._t==='o'?'submitted_stories':'khaledoon_submissions')+'&v=20261102-unified-reader-preview-4'}else popup.location.href=preview.href;await loadList()}catch(error){try{popup.close()}catch(ignoreClose){}say('err',error.message||'تعذر إرسال الحكاية إلى المعاينة.')}"""
s=s[:a]+new_list+s[b:]

rep("if(storyOnlyDraft){try{localStorage.setItem('kh-story-review-package',JSON.stringify(storyPackageRaw))}catch(ignoreStoryReviewStore){}}if(aiPreviewPopup){","if(storyOnlyDraft){if(shouldRecordPreview(it)){try{await recordPreviewSent(it)}catch(recordError){aiSay('err','حُفظت الحكاية لكن تعذر تسجيل مرحلة المعاينة: '+(recordError.message||''))}}stageStoryReview(it,storyPackageRaw)}if(aiPreviewPopup){")
open(P,'w',encoding='utf-8').write(s)

T='khaledoon/tests/story-workflow-integration.test.js'
t=open(T,encoding='utf-8').read()
old="if(!isOctoberLegacyRecord(it)){bSave.disabled=true;bPub.disabled=true;"
assert t.count(old)==1
open(T,'w',encoding='utf-8').write(t.replace(old,"if(!isOctoberLegacyRecord(it)){bSave.disabled=true;"))
print('patched ok')
