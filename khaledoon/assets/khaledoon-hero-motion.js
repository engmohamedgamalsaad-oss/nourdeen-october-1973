/* khaledoon/assets/khaledoon-hero-motion.js
   حركة صورة غلاف الصفحة الرئيسية على الموبايل: النص يصعد بسرعة التمرير،
   والصورة تصعد أبطأ بكثير (حوالي 28% من سرعة النص) وهي تكبر شوية وتخفت تدريجياً.
   بيضبط متغيرات CSS فقط؛ الشكل نفسه في khaledoon-mobile.css. */
(function(){
  var hero=document.querySelector('.hero:not(.sub)');
  if(!hero||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))return;
  var busy=false;
  function update(){
    busy=false;
    var h=hero.offsetHeight||1;
    var s=Math.max(0,Math.min(h,-hero.getBoundingClientRect().top));
    hero.style.setProperty('--hm-y',(s*0.72).toFixed(1)+'px');
    hero.style.setProperty('--hm-p',(s/h).toFixed(4));
  }
  function req(){if(!busy){busy=true;requestAnimationFrame(update)}}
  addEventListener('scroll',req,{passive:true});
  addEventListener('resize',req,{passive:true});
  addEventListener('orientationchange',req);
  update();
})();
