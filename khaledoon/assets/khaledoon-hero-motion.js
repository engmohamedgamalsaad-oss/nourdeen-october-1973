/* حركة غلاف خالدون على الموبايل:
   طبقة خلفية ثابتة تكبر أثناء مغادرة قسم المقدمة، ثم تبقى شبه ثابتة الشفافية (تخف 15% فقط) خلف بقية الصفحة. */
(function(){
  var hero=document.querySelector('.hero:not(.sub)');
  if(!hero)return;
  var root=document.documentElement;
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobile=window.matchMedia&&matchMedia('(max-width: 1024px)').matches;
  var busy=false;
  var BG_FADE=0.08; // خفوت عام بسيط للصورة أثناء التمرير
  function update(){
    busy=false;
    var header=document.querySelector(".topbar");
    if(header){root.style.setProperty("--khaledoon-header-height",Math.ceil(header.getBoundingClientRect().height)+"px");}
    var h=hero.offsetHeight||1;
    var passed=reduce?0:Math.max(0,Math.min(1,-hero.getBoundingClientRect().top/h));
    root.style.setProperty('--hero-bg-progress',passed.toFixed(4));
    root.style.setProperty('--hero-bg-scale',(1+passed*(innerWidth>1024?.12:.22)).toFixed(4));
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

/* حركة التمرير الجديدة (موبايل وكمبيوتر، وتُعطَّل مع تقليل الحركة):
   - نصوص الواجهة تصعد أسرع من التمرير ثم تتلاشى.
   - أقسام الصفحة تمر من خلف الصورة وتتلاشى تدريجيًا قرب حافتها السفلى.
   تعتمد على الكلاس hm على <html> (يُضاف مبكرًا من index.html ويُحدَّث هنا). */
(function(){
  var hero=document.querySelector('.hero:not(.sub)');
  var layer=document.querySelector('.hero-background-layer');
  var hi=hero&&hero.querySelector('.hero-in');
  if(!hero||!layer||!hi)return;
  var root=document.documentElement;
  var FAST=0.9;        // سرعة إضافية للنصوص: 0.9 تعني أنها تصعد بنحو 1.9 ضعف سرعة التمرير
  var FADE_START=0.02; // بداية التلاشي (نسبة من ارتفاع الشاشة)
  var FADE_LEN=0.32;   // مسافة التمرير حتى يختفي النص تمامًا
  var ZONE=0.035;      // تقليل منطقة إخفاء المحتوى أسفل الصورة لإبقاء الحكايات أوضح
  var ZONE_MIN=48;     // أقل ارتفاع لمنطقة التلاشي بالبكسل
  var langrow=document.querySelector('.topbar .langrow');
  var targets=[].slice.call(document.querySelectorAll('main .section,footer'));
  var hits=[].slice.call(document.querySelectorAll('main .section a,main .section button,footer a'));
  var maskCache=new Array(targets.length),hitCache=new Array(hits.length);
  var isOn=false,busy=false;
  function clamp(v){return v<0?0:v>1?1:v}
  function active(){
    var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    var landscapeShort=innerWidth<=1024&&innerWidth>innerHeight&&innerHeight<=520;
    return !reduce&&!landscapeShort;
  }
  function reset(){
    hi.style.translate='';hi.style.filter='';hi.style.pointerEvents='';
    if(langrow){langrow.style.opacity='';langrow.style.visibility=''}
    targets.forEach(function(el,i){el.style.webkitMaskImage='';el.style.maskImage='';maskCache[i]=''});
    hits.forEach(function(el,i){el.style.pointerEvents='';hitCache[i]=false});
  }
  function update(){
    busy=false;
    var on=active();
    if(on!==isOn){isOn=on;root.classList.toggle('hm',on);if(!on)reset()}
    if(!isOn)return;
    var vh=innerHeight||1;
    var s=Math.max(0,window.pageYOffset||0);
    var p=clamp((s-FADE_START*vh)/(FADE_LEN*vh));
    hi.style.translate='0 '+(-s*FAST).toFixed(1)+'px';
    hi.style.filter=p>0?'opacity('+(1-p).toFixed(3)+')':'';
    hi.style.pointerEvents=p>.85?'none':'';
    if(langrow){langrow.style.opacity=p>0?(1-p).toFixed(3):'';langrow.style.visibility=p>=1?'hidden':''}
    var edge=layer.getBoundingClientRect().bottom;
    var zone=Math.max(ZONE_MIN,ZONE*vh);
    var rects=targets.map(function(el){return el.getBoundingClientRect()});
    var hrects=hits.map(function(el){return el.getBoundingClientRect()});
    targets.forEach(function(el,i){
      var r=rects[i],g='';
      if(r.top<edge+zone){
        g='linear-gradient(180deg,transparent '+(edge-r.top).toFixed(1)+'px,#000 '+(edge+zone-r.top).toFixed(1)+'px)';
      }
      if(g!==maskCache[i]){maskCache[i]=g;el.style.webkitMaskImage=g;el.style.maskImage=g}
    });
    hits.forEach(function(el,i){
      var covered=hrects[i].bottom<edge+zone*.6;
      if(covered!==hitCache[i]){hitCache[i]=covered;el.style.pointerEvents=covered?'none':''}
    });
  }
  function req(){if(!busy){busy=true;requestAnimationFrame(update)}}
  addEventListener('scroll',req,{passive:true});
  addEventListener('resize',req,{passive:true});
  addEventListener('orientationchange',req);
  isOn=root.classList.contains('hm');
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
  var wide=innerWidth>1024;      // الكمبيوتر: عدد وأحجام أكبر قليلًا لأن الصورة أكبر
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
