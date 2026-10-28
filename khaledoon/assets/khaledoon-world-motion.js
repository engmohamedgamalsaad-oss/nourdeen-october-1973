/* Lightweight homepage reveal effects. No dependency; gracefully disabled without IntersectionObserver. */
(function(){
 'use strict';
 var root=document.documentElement;
 if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 if(!('IntersectionObserver' in window))return;
 var items=document.querySelectorAll('#gateways .gate, #how .step, .kh-world-stage, .khm-box, #gateways .info, .section-visual-gallery figure, .hero-home-image-wrap, .card, .story-card, .collection-card');
 if(!items.length)return;
 items.forEach(function(n,i){n.classList.add('kh-reveal-item');n.style.setProperty('--kh-reveal-delay',Math.min(i%4,3)*65+'ms')});
 root.classList.add('kh-world-motion-ready');
 var io=new IntersectionObserver(function(entries){
   entries.forEach(function(entry){
     if(entry.isIntersecting){entry.target.classList.add('kh-reveal-visible');io.unobserve(entry.target)}
   });
 },{threshold:.12,rootMargin:'0px 0px -32px 0px'});
 items.forEach(function(n){io.observe(n)});
})();
