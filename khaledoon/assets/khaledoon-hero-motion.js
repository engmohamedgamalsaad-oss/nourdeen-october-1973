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
  var ZONE=0.15;       // ارتفاع منطقة التلاشي تحت الصورة (نسبة من ارتفاع الشاشة)
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
    var zone=Math.max(96,ZONE*vh);
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
