/* حركة غلاف خالدون على الموبايل:
   طبقة خلفية ثابتة تكبر أثناء مغادرة قسم المقدمة، ثم تبقى شبه ثابتة الشفافية (تخف 15% فقط) خلف بقية الصفحة. */
(function(){
  var hero=document.querySelector('.hero:not(.sub)');
  if(!hero)return;
  var root=document.documentElement;
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobile=window.matchMedia&&matchMedia('(max-width: 780px)').matches;
  var busy=false;
  var BG_FADE=0.08; // خفوت عام بسيط للصورة أثناء التمرير
  function update(){
    busy=false;
    var header=document.querySelector(".topbar");
    if(header){root.style.setProperty("--khaledoon-header-height",Math.ceil(header.getBoundingClientRect().height)+"px");}
    var h=hero.offsetHeight||1;
    var passed=reduce?0:Math.max(0,Math.min(1,-hero.getBoundingClientRect().top/h));
    root.style.setProperty('--hero-bg-progress',passed.toFixed(4));
    root.style.setProperty('--hero-bg-scale',(1+passed*(innerWidth>780?.15:.25)).toFixed(4));
    root.style.setProperty('--hero-bottom-fade',(38+passed*16)+'%');
    root.style.setProperty('--hero-bg-opacity',(1-passed*BG_FADE).toFixed(4));
  }
  function req(){if(!busy){busy=true;requestAnimationFrame(update)}}
  addEventListener('scroll',req,{passive:true});
  addEventListener('resize',req,{passive:true});
  addEventListener('orientationchange',req);
  addEventListener('load',req);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(req);
  var tb=document.querySelector('.topbar');
  if(tb&&window.ResizeObserver)new ResizeObserver(req).observe(tb);
  update();
})();

/* نقاط صغيرة على الصورة (موبايل وكمبيوتر):
   - كل نقطة تنوّر وتطفأ بهدوء، وفي كل مرة تعيد الظهور تظهر في مكان عشوائي جديد.
   - الأماكن العشوائية مائلة نحو الحواف: النقاط في المنتصف قليلة، وعند الحواف أكثر.
   - لونها يتحوّل بين الأبيض والذهبي. الحركة نفسها في khaledoon-mobile.css (khTwinkle).
   الضبط:
   N           = عدد النقاط (قلّله لتقليل النجوم).
   CENTER_KEEP = احتمال الظهور في قلب الصورة مقارنة بالحواف (0 = لا شيء في المنتصف، 1 = توزيع متساوٍ).
   EDGE_POWER  = قوة الميل للحواف (أكبر = تتركز النقاط عند الحواف أكثر). */
(function(){
  var layer=document.querySelector('.hero-background-layer');
  if(!layer)return;
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var wide=innerWidth>780;      // الكمبيوتر: عدد وأحجام أكبر قليلًا لأن الصورة أكبر
  var N=wide?56:30;
  var SIZE_MIN=wide?2.6:1.6;    // أصغر قطر للنقطة بالبكسل
  var SIZE_STEP=wide?1.0:0.6;   // الزيادة بين الأحجام (3 أحجام مختلفة)
  var CENTER_KEEP=0.10;
  var EDGE_POWER=1.6;
  var DUR_MIN=3.5, DUR_MAX=7.5; // مدة الدورة الواحدة بالثواني (عشوائية لكل نقطة)

  function rnd(a,b){return a+Math.random()*(b-a)}

  // يختار مكانًا عشوائيًا مع تفضيل الحواف (طريقة القبول بالاحتمال)
  function pickPos(){
    for(var t=0;t<30;t++){
      var x=Math.random(),y=Math.random();
      var d=Math.max(Math.abs(x-.5),Math.abs(y-.5))*2; // 0 في المنتصف ... 1 عند الحافة
      if(Math.random()<CENTER_KEEP+(1-CENTER_KEEP)*Math.pow(d,EDGE_POWER))return [x,y];
    }
    return [Math.random()<.5?rnd(0,.15):rnd(.85,1),Math.random()];
  }

  // يضع النقطة في مكان جديد بحجم وإضاءة جديدين
  function place(el){
    var p=pickPos();
    el.style.left=(p[0]*100).toFixed(1)+'%';
    el.style.top=(p[1]*100).toFixed(1)+'%';
    el.style.setProperty('--sz',(SIZE_MIN+Math.floor(Math.random()*3)*SIZE_STEP).toFixed(1)+'px');
    el.style.setProperty('--op',(0.75+Math.floor(Math.random()*3)*0.1).toFixed(2));
  }

  var box=document.createElement('div');
  box.className='hero-stars';
  box.setAttribute('aria-hidden','true');
  for(var i=0;i<N;i++){
    var d=document.createElement('i');
    place(d);
    d.style.setProperty('--dur',rnd(DUR_MIN,DUR_MAX).toFixed(1)+'s');
    d.style.setProperty('--dl','-'+rnd(0,DUR_MAX).toFixed(2)+'s');
    box.appendChild(d);
  }
  // مع بداية كل دورة جديدة تكون النقطة مطفأة تمامًا، فننقلها لمكان جديد دون أن يلاحظ أحد
  box.addEventListener('animationiteration',function(e){
    if(e.target&&e.target.tagName==='I')place(e.target);
  });
  layer.appendChild(box);
})();
