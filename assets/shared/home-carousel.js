(function(){
  'use strict';
  var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var intervalMs=7200;
  function init(grid){
    if(!grid||grid.dataset.carouselReady==='true')return;
    var slides=Array.prototype.slice.call(grid.children).filter(function(el){return el.nodeType===1;});
    if(slides.length<2)return;
    grid.dataset.carouselReady='true';
    grid.classList.add('horizontal-carousel');
    grid.setAttribute('role','region');
    grid.setAttribute('aria-roledescription','carousel');
    var section=grid.closest('section');
    var heading=section&&section.querySelector('h2');
    grid.setAttribute('aria-label',heading?heading.textContent.trim():'معرض متحرك');
    var current=0,timer=null,leavingTimer=null;
    slides.forEach(function(slide,i){
      slide.classList.add('carousel-slide');
      slide.setAttribute('role','group');
      slide.setAttribute('aria-roledescription','slide');
      slide.setAttribute('aria-label',(i+1)+' / '+slides.length);
      slide.setAttribute('aria-hidden','true');
    });
    function fitHeight(){
      var max=0;
      slides.forEach(function(slide){
        var old=slide.style.height;
        slide.style.height='auto';
        max=Math.max(max,slide.scrollHeight,slide.offsetHeight);
        slide.style.height=old;
      });
      if(max)grid.style.height=Math.ceil(max)+'px';
    }
    function setActive(next,initial){
      next=(next+slides.length)%slides.length;
      if(next===current&&!initial)return;
      if(leavingTimer)window.clearTimeout(leavingTimer);
      var old=slides[current];
      old.classList.remove('is-active');
      old.classList.add('is-leaving');
      old.setAttribute('aria-hidden','true');
      slides[next].classList.remove('is-leaving');
      slides[next].classList.add('is-active');
      slides[next].setAttribute('aria-hidden','false');
      current=next;
      dots.forEach(function(dot,i){dot.setAttribute('aria-current',i===current?'true':'false');});
      leavingTimer=window.setTimeout(function(){old.classList.remove('is-leaving');},reduced?0:760);
      window.requestAnimationFrame(fitHeight);
    }
    slides.forEach(function(slide,i){if(i===0){slide.classList.add('is-active');slide.setAttribute('aria-hidden','false');}});
    var controls=document.createElement('div');
    controls.className='carousel-controls';
    controls.setAttribute('aria-label','التحكم في العرض');
    var prev=document.createElement('button');
    prev.type='button';prev.className='carousel-control';prev.textContent='‹';prev.setAttribute('aria-label','الشريحة السابقة');
    var dotsWrap=document.createElement('div');dotsWrap.className='carousel-dots';
    var dots=slides.map(function(slide,i){
      var dot=document.createElement('button');dot.type='button';dot.className='carousel-dot';
      dot.setAttribute('aria-label','عرض الشريحة '+(i+1));dot.setAttribute('aria-current',i===0?'true':'false');
      dot.addEventListener('click',function(){setActive(i);restart();});dotsWrap.appendChild(dot);return dot;
    });
    var next=document.createElement('button');
    next.type='button';next.className='carousel-control';next.textContent='›';next.setAttribute('aria-label','الشريحة التالية');
    controls.appendChild(prev);controls.appendChild(dotsWrap);controls.appendChild(next);grid.insertAdjacentElement('afterend',controls);
    prev.addEventListener('click',function(){setActive(current-1);restart();});
    next.addEventListener('click',function(){setActive(current+1);restart();});
    function stop(){if(timer){window.clearInterval(timer);timer=null;}}
    function start(){stop();if(!reduced&&!document.hidden)timer=window.setInterval(function(){setActive(current+1);},intervalMs);}
    function restart(){stop();start();}
    grid.addEventListener('mouseenter',stop);
    grid.addEventListener('mouseleave',start);
    controls.addEventListener('mouseenter',stop);
    controls.addEventListener('mouseleave',start);
    grid.addEventListener('focusin',stop);
    grid.addEventListener('focusout',function(e){if(!grid.contains(e.relatedTarget))start();});
    controls.addEventListener('focusin',stop);
    controls.addEventListener('focusout',function(e){if(!controls.contains(e.relatedTarget))start();});
    document.addEventListener('visibilitychange',function(){document.hidden?stop():start();});
    grid.addEventListener('toggle',function(){window.requestAnimationFrame(fitHeight);},true);
    window.addEventListener('resize',fitHeight,{passive:true});
    window.setTimeout(function(){fitHeight();start();},80);
  }
  function boot(){
    init(document.querySelector('.media-grid'));
    init(document.querySelector('.facts-grid'));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();