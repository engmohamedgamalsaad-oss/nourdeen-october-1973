/* حركة غلاف خالدون الرئيسية على الموبايل: تكبير تدريجي وتلاشي هادئ بلا إزاحة لأعلى.
   يظل موضع الأشخاص ثابتًا أثناء التمرير؛ لا يؤثر على صفحات حكايات أكتوبر. */
(function(){
  var hero=document.querySelector('.hero:not(.sub)');
  if(!hero)return;
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var busy=false;
  function update(){
    busy=false;
    var h=hero.offsetHeight||1;
    var passed=Math.max(0,Math.min(1,-hero.getBoundingClientRect().top/h));
    hero.style.setProperty('--hm-p',reduce?'0':passed.toFixed(4));
    hero.style.setProperty('--hm-y','0px');
  }
  function req(){if(!busy){busy=true;requestAnimationFrame(update)}}
  addEventListener('scroll',req,{passive:true});
  addEventListener('resize',req,{passive:true});
  addEventListener('orientationchange',req);
  update();
})();