/* Khaledoon homepage cover accents.
   The magnetic/pinned scroll choreography has been removed.
   Keep only the original gentle star twinkles on the normal hero cover. */
(function(){
  var hero=document.querySelector('.hero:not(.sub)');
  if(!hero)return;
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var wide=innerWidth>780;
  var N=wide?56:30;
  var SIZE_MIN=wide?2.6:1.6;
  var SIZE_STEP=wide?1.0:0.6;
  var CENTER_KEEP=0.10;
  var EDGE_POWER=1.6;
  var DUR_MIN=3.5,DUR_MAX=7.5;
  function rnd(a,b){return a+Math.random()*(b-a)}
  function pickPos(){
    for(var t=0;t<30;t++){
      var x=Math.random(),y=Math.random();
      var d=Math.max(Math.abs(x-.5),Math.abs(y-.5))*2;
      if(Math.random()<CENTER_KEEP+(1-CENTER_KEEP)*Math.pow(d,EDGE_POWER))return [x,y];
    }
    return [Math.random()<.5?rnd(0,.15):rnd(.85,1),Math.random()];
  }
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
  box.addEventListener('animationiteration',function(e){
    if(e.target&&e.target.tagName==='I')place(e.target);
  });
  hero.appendChild(box);
})();
