/* Khaledoon: scroll-reveal motion for cards and images on every V2 story page.
   Loaded from khaledoon-story-map-link.js. Skipped on pages that already ship their own motion.css (story 016). */
(function(){
if(window.__khMotion||!document.body||!document.body.getAttribute('data-story-slug')||!document.getElementById('blocks'))return;
if(document.querySelector('link[href*="motion.css"]'))return;
window.__khMotion=true;
try{var cs=document.currentScript;if(cs&&cs.src){var l=document.createElement('link');l.rel='stylesheet';l.href=new URL('khaledoon-story-motion.css?v=20261031-motion-1',cs.src).href;document.head.appendChild(l)}}catch(e){}
var st=document.getElementById('story'),khIO=null,khRerun=0;
function khReveal(el,k,instant){
  if(khIO)khIO.unobserve(el);
  if(el.classList.contains('kh-card-in')||el.classList.contains('kh-card-done'))return;
  if(instant)el.classList.add('kh-card-instant');
  else if(k)el.style.setProperty('--kh-d',(Math.min(k,3)*0.08).toFixed(2)+'s');
  el.classList.remove('kh-card-pending');
  el.classList.add('kh-card-in');
  setTimeout(function(){el.classList.add('kh-card-done');el.classList.remove('kh-card-instant');el.style.removeProperty('--kh-d')},instant?80:2400);
}
function khObserver(){
  if(khIO)return khIO;
  khIO=new IntersectionObserver(function(entries){
    var k=0;
    entries.forEach(function(en){
      var el=en.target;
      if(!el.isConnected){khIO.unobserve(el);return}
      if(en.isIntersecting){khReveal(el,k++,false)}
      else if(en.boundingClientRect.bottom<0){khReveal(el,0,true)}
    });
  },{threshold:.06,rootMargin:'0px 0px -6% 0px'});
  return khIO;
}
function addStoryMotion(){
  try{
    var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduce||!('IntersectionObserver' in window))return;
    var io=khObserver(),vh=window.innerHeight||document.documentElement.clientHeight||700,
        list=[].slice.call(document.querySelectorAll('#blocks > .block,#blocks > figure,#gallery > figure,#map-section,#quiz-section,#reactions-section,.sources'));
    list.forEach(function(el){
      var c=el.classList;
      if(c.contains('kh-card-in')||c.contains('kh-card-done'))return;
      if(!c.contains('kh-card-pending')){
        if(el.hidden||!el.getClientRects().length)return;
        if(el.getBoundingClientRect().top<vh*.92){c.add('kh-card-done');return}
        c.add('kh-card-pending');
        [].forEach.call(el.querySelectorAll('.block-timeline > li'),function(li,i){li.style.setProperty('--i',Math.min(i,14))});
      }
      io.observe(el);
    });
  }catch(e){
    [].forEach.call(document.querySelectorAll('.kh-card-pending'),function(el){el.classList.remove('kh-card-pending')});
  }
}
function khSchedule(){
  if(khRerun)cancelAnimationFrame(khRerun);
  khRerun=requestAnimationFrame(function(){khRerun=0;if(st&&!st.hidden)addStoryMotion()});
}
if(window.MutationObserver){
  ['blocks','gallery'].forEach(function(id){var n=document.getElementById(id);if(n)new MutationObserver(khSchedule).observe(n,{childList:true})});
  if(st)new MutationObserver(function(){if(!st.hidden)addStoryMotion()}).observe(st,{attributes:true,attributeFilter:['hidden']});
}
/* The story may already be rendered when this file loads (it is added after the reader), so run once now. */
khSchedule();
window.addEventListener('load',khSchedule);
})();
