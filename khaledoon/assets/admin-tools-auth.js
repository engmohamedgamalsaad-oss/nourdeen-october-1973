/* Admin-only access helper for static Khaledoon tools.
   RLS remains the authority for central config reads/writes. */
(function(){
'use strict';
var API='https://ypwprddkscnfblhftkeb.supabase.co';
var KEY='sb_publishable_JJnVwx8HQAJNxSok32L-qg_83fXk5Qn';
var SK='kh_adm_session', refreshing=null;
function readSession(){try{return JSON.parse(localStorage.getItem(SK)||sessionStorage.getItem(SK)||'null')}catch(e){return null}}
function writeSession(s){try{sessionStorage.setItem(SK,JSON.stringify(s));localStorage.setItem(SK,JSON.stringify(s))}catch(e){}}
function go(){try{sessionStorage.removeItem(SK);localStorage.removeItem(SK)}catch(e){}location.replace('admin.html')}
async function sessionToken(){
 var s=readSession();
 if(!s||!s.access_token||!s.refresh_token)throw new Error('جلسة الأدمن غير موجودة. سجّل الدخول من لوحة الإدارة.');
 if(Number(s.expires_at||0)-Date.now()/1000<60){
  if(!refreshing)refreshing=(async function(){
   var rr=await fetch(API+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:s.refresh_token})});
   if(!rr.ok)throw new Error('انتهت جلسة الأدمن. سجّل الدخول مرة أخرى.');
   var d=await rr.json();s={access_token:d.access_token,refresh_token:d.refresh_token,expires_at:Math.floor(Date.now()/1000)+d.expires_in};writeSession(s);return s;
  })().finally(function(){refreshing=null});
  s=await refreshing;
 }
 return s.access_token;
}
async function request(path,options){
 var token=await sessionToken(),o=options||{},headers={apikey:KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'};
 if(o.headers)Object.keys(o.headers).forEach(function(k){headers[k]=o.headers[k]});
 var response=await fetch(API+'/rest/v1/'+path,{method:o.method||'GET',headers:headers,body:o.body});
 if(response.status===401||response.status===403)throw new Error('رفض الخادم الطلب. تأكد من حساب الأدمن وصلاحيات قاعدة البيانات.');
 if(!response.ok){var detail='';try{detail=(await response.text()).slice(0,300)}catch(e){}throw new Error('تعذر الاتصال بمخزن الإعدادات ('+response.status+'). '+detail)}
 return response;
}
async function getConfig(key){
 var r=await request('khaledoon_admin_config?config_key=eq.'+encodeURIComponent(key)+'&select=config_key,config_value,updated_at&limit=1');
 var rows=await r.json();return rows&&rows.length?rows[0]:null;
}
async function saveConfig(key,value){
 var r=await request('khaledoon_admin_config?on_conflict=config_key',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({config_key:key,config_value:value})});
 var rows=await r.json();return rows&&rows[0]?rows[0]:null;
}
async function run(){
 var token=await sessionToken();
 var r=await fetch(API+'/rest/v1/rpc/is_admin',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});
 if(!r.ok||(await r.json())!==true){go();return}
 window.KHAdminTools={getConfig:getConfig,saveConfig:saveConfig,request:request};
 document.documentElement.style.visibility='visible';
 window.dispatchEvent(new CustomEvent('kh-admin-tools-ready'));
}
run().catch(function(){go()});
})();