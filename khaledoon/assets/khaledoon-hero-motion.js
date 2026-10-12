/* حركة غلاف خالدون على الموبايل:
   طبقة خلفية ثابتة تكبر أثناء مغادرة قسم المقدمة، ثم تبقى خافتة خلف بقية الصفحة. */
(function(){
  var hero=document.querySelector('.hero:not(.sub)');
  if(!hero)return;
  var root=document.documentElement;
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobile=window.matchMedia&&matchMedia('(max-width: 780px)').matches;
  var busy=false;
  function update(){
    busy=false;
    var header=document.querySelector(".topbar");
    if(header){root.style.setProperty("--khaledoon-header-height",Math.ceil(header.getBoundingClientRect().height)+"px");}
    var h=hero.offsetHeight||1;
    var passed=reduce?0:Math.max(0,Math.min(1,-hero.getBoundingClientRect().top/h));
    root.style.setProperty('--hero-bg-progress',passed.toFixed(4));
    root.style.setProperty('--hero-bg-scale',(1+passed*.72).toFixed(4));
    root.style.setProperty('--hero-bg-opacity',(1-passed*.78).toFixed(4));
  }
  function req(){if(!busy){busy=true;requestAnimationFrame(update)}}
  addEventListener('scroll',req,{passive:true});
  addEventListener('resize',req,{passive:true});
  addEventListener('orientationchange',req);
  update();
})();