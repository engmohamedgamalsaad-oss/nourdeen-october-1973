/* حركة غلاف خالدون على الموبايل:
   طبقة خلفية ثابتة تكبر أثناء مغادرة قسم المقدمة، ثم تبقى شبه ثابتة الشفافية (تخف 15% فقط) خلف بقية الصفحة. */
(function(){
  var hero=document.querySelector('.hero:not(.sub)');
  if(!hero)return;
  var root=document.documentElement;
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobile=window.matchMedia&&matchMedia('(max-width: 780px)').matches;
  var busy=false;
  var BG_FADE=0.15; // مقدار خفوت الصورة الكلي أثناء التمرير: 0.15 = 15%
  function update(){
    busy=false;
    var header=document.querySelector(".topbar");
    if(header){root.style.setProperty("--khaledoon-header-height",Math.ceil(header.getBoundingClientRect().height)+"px");}
    var h=hero.offsetHeight||1;
    var passed=reduce?0:Math.max(0,Math.min(1,-hero.getBoundingClientRect().top/h));
    root.style.setProperty('--hero-bg-progress',passed.toFixed(4));
    root.style.setProperty('--hero-bg-scale',(1+passed*.72).toFixed(4));
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

/* حركة التمرير الجديدة (الموبايل فقط، وتُعطَّل مع تقليل الحركة):
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
  var ZONE=0.07;       // ارتفاع منطقة التلاشي تحت الصورة (نسبة من ارتفاع الشاشة)
  var ZONE_MIN=48;     // أقل ارتفاع لمنطقة التلاشي بالبكسل
  var targets=[].slice.call(document.querySelectorAll('main .section,footer'));
  var hits=[].slice.call(document.querySelectorAll('main .section a,main .section button,footer a'));
  var maskCache=new Array(targets.length),hitCache=new Array(hits.length);
  var isOn=false,busy=false;
  function clamp(v){return v<0?0:v>1?1:v}
  function active(){
    var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    var narrow=innerWidth<=780;
    var landscapeShort=innerWidth>innerHeight&&innerHeight<=520;
    return narrow&&!reduce&&!landscapeShort;
  }
  function reset(){
    hi.style.translate='';hi.style.filter='';hi.style.pointerEvents='';
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

/* نقاط صغيرة موزّعة على كل مساحة الصورة: كل نقطة تنوّر بهدوء وتطفأ بهدوء في مكانها،
   ولونها يتحوّل بين الأبيض والذهبي (الموبايل فقط).
   N = عدد النقاط. الحركة نفسها في khaledoon-mobile.css (khTwinkle). */
(function(){
  var layer=document.querySelector('.hero-background-layer');
  if(!layer)return;
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  if(innerWidth>780)return;
  var N=28;
  var SIZE_MIN=1.2;   // أصغر قطر للنقطة بالبكسل
  var SIZE_STEP=0.5;  // الزيادة بين الأحجام (3 أحجام مختلفة)
  var box=document.createElement('div');
  box.className='hero-stars';
  box.setAttribute('aria-hidden','true');
  for(var i=0;i<N;i++){
    var d=document.createElement('i');
    d.style.left=(((i+1)*0.618034)%1*100).toFixed(1)+'%';
    d.style.top=(((i+1)*0.754877)%1*100).toFixed(1)+'%';
    d.style.setProperty('--sz',(SIZE_MIN+((i*5)%3)*SIZE_STEP).toFixed(1)+'px');
    d.style.setProperty('--op',(0.6+((i*3)%4)*0.1).toFixed(1));
    d.style.setProperty('--dur',(4+(((i*7)%30)/10)).toFixed(1)+'s');
    d.style.setProperty('--dl','-'+(((i*0.83)%6.5)).toFixed(2)+'s');
    box.appendChild(d);
  }
  layer.appendChild(box);
})();
