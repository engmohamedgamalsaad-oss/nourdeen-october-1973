/* Client-side convenience gate for static admin tool pages.
   Authorization remains enforced by Supabase/RLS for any protected writes. */
(function(){
'use strict';
var API='https://ypwprddkscnfblhftkeb.supabase.co';
var KEY='sb_publishable_JJnVwx8HQAJNxSok32L-qg_83fXk5Qn';
var SK='kh_adm_session';
function go(){try{sessionStorage.removeItem(SK)}catch(e){}location.replace('admin.html')}
function reveal(){document.documentElement.style.visibility='visible'}
async function run(){
 var s=null;try{s=JSON.parse(sessionStorage.getItem(SK)||'null')}catch(e){}
 if(!s||!s.access_token||!s.refresh_token){go();return}
 if(Number(s.expires_at||0)-Date.now()/1000<60){
  var rr=await fetch(API+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:s.refresh_token})});
  if(!rr.ok){go();return}
  var d=await rr.json();s={access_token:d.access_token,refresh_token:d.refresh_token,expires_at:Math.floor(Date.now()/1000)+d.expires_in};
  sessionStorage.setItem(SK,JSON.stringify(s));
 }
 var r=await fetch(API+'/rest/v1/rpc/is_admin',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},body:'{}'});
 if(!r.ok||(await r.json())!==true){go();return}
 reveal();
}
run().catch(go);
})();