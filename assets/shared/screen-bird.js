(function () {
  'use strict';
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (document.getElementById('history-bird')) return;

  var style = document.createElement('style');
  style.textContent = [
    '#history-bird{position:fixed;left:0;top:0;width:clamp(58px,6.5vw,82px);height:auto;z-index:9000;pointer-events:none;overflow:visible;will-change:transform;filter:drop-shadow(0 6px 5px rgba(0,0,0,.25));transform:translate3d(-120px,-120px,0)}',
    '#history-bird svg{display:block;overflow:visible}',
    '#history-bird .bird-wing-back{transform-box:fill-box;transform-origin:88% 82%;animation:hb-back-flap .34s ease-in-out infinite alternate}',
    '#history-bird .bird-wing-front{transform-box:fill-box;transform-origin:82% 80%;animation:hb-front-flap .34s ease-in-out infinite alternate}',
    '#history-bird .bird-tail{transform-box:fill-box;transform-origin:8% 50%;animation:hb-tail .9s ease-in-out infinite alternate}',
    '#history-bird .bird-head{transform-box:fill-box;transform-origin:40% 78%;animation:hb-head-flight 2.4s ease-in-out infinite}',
    '#history-bird .bird-body{transform-box:fill-box;transform-origin:50% 55%;animation:hb-bob 1.1s ease-in-out infinite}',
    '#history-bird .bird-eye-glint{animation:hb-glint 4.2s ease-in-out infinite}',
    '#history-bird .bird-blink{transform-box:fill-box;transform-origin:center;animation:hb-blink 5.4s infinite}',
    '#history-bird.perched .bird-wing-back{animation:hb-fold-back .6s ease-out forwards}',
    '#history-bird.perched .bird-wing-front{animation:hb-fold-front .6s ease-out forwards}',
    '#history-bird.perched .bird-head{animation:hb-head-perched 3.2s ease-in-out infinite}',
    '#history-bird.perched .bird-body{animation:hb-perch 2.3s ease-in-out infinite}',
    '#history-bird.perched .bird-tail{animation:hb-tail-perched 2s ease-in-out infinite alternate}',
    '@keyframes hb-back-flap{from{transform:rotate(-42deg) scaleY(.8)}to{transform:rotate(35deg) scaleY(1.08)}}',
    '@keyframes hb-front-flap{from{transform:rotate(38deg) scaleY(.82)}to{transform:rotate(-38deg) scaleY(1.08)}}',
    '@keyframes hb-fold-back{to{transform:rotate(-9deg) scaleY(.92)}}',
    '@keyframes hb-fold-front{to{transform:rotate(7deg) scaleY(.96)}}',
    '@keyframes hb-tail{from{transform:rotate(-6deg)}to{transform:rotate(8deg)}}',
    '@keyframes hb-tail-perched{from{transform:rotate(-2deg)}to{transform:rotate(3deg)}}',
    '@keyframes hb-bob{0%,100%{translate:0 0}50%{translate:0 -2px}}',
    '@keyframes hb-perch{0%,100%{translate:0 0}50%{translate:0 -1px}}',
    '@keyframes hb-head-flight{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(3deg)}}',
    '@keyframes hb-head-perched{0%,30%,100%{transform:rotate(0deg)}42%{transform:rotate(-9deg)}54%{transform:rotate(-9deg)}68%{transform:rotate(5deg)}80%{transform:rotate(0deg)}}',
    '@keyframes hb-glint{0%,87%,100%{opacity:1}90%,94%{opacity:.05}}',
    '@keyframes hb-blink{0%,44%,47%,100%{transform:scaleY(1)}45%,46%{transform:scaleY(.08)}}',
    '@media(max-width:600px){#history-bird{width:60px}}'
  ].join('');
  document.head.appendChild(style);

  var bird = document.createElement('div');
  bird.id = 'history-bird';
  bird.setAttribute('aria-hidden', 'true');
  bird.innerHTML = '<svg viewBox="0 0 150 132" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">' +
    '<defs>' +
      '<radialGradient id="hb-body" cx="28%" cy="18%" r="88%"><stop stop-color="#b5fff4"/><stop offset=".24" stop-color="#52e1d9"/><stop offset=".55" stop-color="#16a8c4"/><stop offset=".82" stop-color="#0875a5"/><stop offset="1" stop-color="#063b67"/></radialGradient>' +
      '<linearGradient id="hb-wing" x1=".05" y1=".05" x2=".9" y2="1"><stop stop-color="#a5fff0"/><stop offset=".25" stop-color="#39d9d2"/><stop offset=".62" stop-color="#168bc5"/><stop offset="1" stop-color="#253f98"/></linearGradient>' +
      '<linearGradient id="hb-wing2" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff0a5"/><stop offset=".22" stop-color="#ffb84b"/><stop offset=".55" stop-color="#e65d75"/><stop offset="1" stop-color="#7849a5"/></linearGradient>' +
      '<radialGradient id="hb-belly" cx="40%" cy="20%" r="85%"><stop stop-color="#fff9d6"/><stop offset=".45" stop-color="#ffe18a"/><stop offset=".8" stop-color="#ffb943"/><stop offset="1" stop-color="#e87530"/></radialGradient>' +
      '<linearGradient id="hb-beak" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff1a0"/><stop offset=".48" stop-color="#ffb52f"/><stop offset="1" stop-color="#e76520"/></linearGradient>' +
      '<linearGradient id="hb-feather" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b7fff1"/><stop offset=".5" stop-color="#21b7cb"/><stop offset="1" stop-color="#24529a"/></linearGradient>' +
      '<radialGradient id="hb-cheek" cx="30%" cy="20%" r="90%"><stop stop-color="#ffbdc2"/><stop offset="1" stop-color="#ef7195"/></radialGradient>' +
      '<linearGradient id="hb-claw" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffda77"/><stop offset="1" stop-color="#df7830"/></linearGradient>' +
    '</defs>' +
    '<g class="bird-body">' +
      '<path class="bird-tail" d="M43 82 Q16 80 8 57 Q31 59 51 70 Q25 68 18 60 Q39 65 54 75" fill="url(#hb-feather)" stroke="#075783" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<path d="M39 77 Q21 70 17 62 M45 81 Q29 78 23 70" fill="none" stroke="#c2fff1" stroke-width="1.7" stroke-linecap="round" opacity=".75"/>' +
      '<ellipse cx="73" cy="78" rx="39" ry="37" fill="url(#hb-body)" stroke="#075783" stroke-width="1.6"/>' +
      '<ellipse cx="78" cy="87" rx="27" ry="25" fill="url(#hb-belly)"/>' +
      '<path d="M55 73 Q68 62 84 70 M52 81 Q65 72 82 78 M58 91 Q68 84 81 88" fill="none" stroke="#fff2c3" stroke-width="1.5" stroke-linecap="round" opacity=".45"/>' +
      '<path d="M45 61 Q39 37 62 31 Q84 25 99 48 Q77 41 59 53Z" fill="#1388b5" opacity=".9"/>' +
      '<path class="bird-wing-back" d="M56 66 Q38 41 49 22 Q73 29 89 52 Q78 47 69 43 Q83 60 78 76 Q65 75 56 66Z" fill="url(#hb-wing2)" stroke="#774e91" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<path d="M50 29 Q63 43 70 61 M58 31 Q72 43 78 57 M67 37 Q78 47 83 58" fill="none" stroke="#ffe8bb" stroke-width="2" stroke-linecap="round" opacity=".8"/>' +
      '<path class="bird-wing-front" d="M48 67 Q47 42 71 38 Q101 36 115 59 Q122 74 103 88 Q85 98 62 81 Q78 80 88 66 Q68 76 48 75Z" fill="url(#hb-wing)" stroke="#075783" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<path d="M57 66 Q77 51 101 55 M59 73 Q80 60 105 63 M65 79 Q83 69 105 71 M75 84 Q91 77 102 78" fill="none" stroke="#c1fff2" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>' +
      '<g class="bird-head">' +
        '<ellipse cx="83" cy="43" rx="27" ry="26" fill="url(#hb-body)" stroke="#075783" stroke-width="1.5"/>' +
        '<path d="M62 27 Q69 12 80 22 Q88 10 97 24" fill="none" stroke="#ffe18a" stroke-width="5" stroke-linecap="round"/>' +
        '<ellipse cx="93" cy="46" rx="10" ry="12" fill="#fffdf5"/>' +
        '<g class="bird-blink"><ellipse cx="95" cy="47" rx="6.4" ry="8.2" fill="#14243a"/><ellipse class="bird-eye-glint" cx="97" cy="43.5" rx="2.5" ry="2.8" fill="#fff"/><circle cx="92" cy="49.5" r="1.1" fill="#92d7f2"/></g>' +
        '<path d="M101 49 Q119 43 131 51 Q122 63 102 58Z" fill="url(#hb-beak)" stroke="#bd6425" stroke-width="1.3" stroke-linejoin="round"/>' +
        '<path d="M104 54 Q117 55 128 52" fill="none" stroke="#b95024" stroke-width="1" opacity=".8"/>' +
        '<ellipse cx="74" cy="57" rx="5.8" ry="3.5" fill="url(#hb-cheek)" opacity=".82"/>' +
        '<path d="M69 29 Q77 23 84 27" fill="none" stroke="#e4fffa" stroke-width="2.2" stroke-linecap="round" opacity=".6"/>' +
      '</g>' +
      '<path d="M63 109 L61 117 M82 111 L84 118" stroke="url(#hb-claw)" stroke-width="4.5" stroke-linecap="round"/>' +
      '<path d="M53 119 L64 119 M76 120 L88 120" stroke="#ffb348" stroke-width="4.5" stroke-linecap="round"/>' +
      '<path d="M55 119 l-2 -3 M59 119 l0 -3 M80 120 l-1 -3 M84 120 l1 -3" stroke="#e47c2c" stroke-width="1.5" stroke-linecap="round"/>' +
      '<ellipse cx="47" cy="63" rx="3.2" ry="2.4" fill="#b6fff2" opacity=".65"/>' +
    '</g></svg>';
  document.body.appendChild(bird);

  var x = Math.max(8, innerWidth * .18), y = Math.max(80, innerHeight * .25);
  var vx = .8, vy = .42, last = 0, pauseUntil = 0, nextPause = 0;
  var width = 78, height = 69, perched = false;
  function dimensions() {
    var r = bird.getBoundingClientRect();
    width = r.width || 78;
    height = r.height || 69;
    x = Math.max(0, Math.min(x, innerWidth - width));
    y = Math.max(8, Math.min(y, innerHeight - height));
  }
  function chooseFlight(now) {
    perched = false;
    bird.classList.remove('perched');
    vx = (Math.random() < .5 ? -1 : 1) * (.65 + Math.random() * 1.0);
    vy = (Math.random() < .5 ? -1 : 1) * (.2 + Math.random() * .6);
    pauseUntil = now + 1800 + Math.random() * 2600;
    nextPause = pauseUntil + 2600 + Math.random() * 4300;
  }
  function frame(now) {
    if (!last) last = now;
    var dt = Math.min(2.2, (now - last) / 16.67);
    last = now;
    if (now >= nextPause && now >= pauseUntil) {
      perched = true;
      bird.classList.add('perched');
      nextPause = now + 1800 + Math.random() * 2400;
      pauseUntil = now + 1400 + Math.random() * 1800;
    }
    if (now >= pauseUntil && perched) chooseFlight(now);
    if (!perched) {
      x += vx * dt * 2.4;
      y += vy * dt * 2.0;
      if (x <= 0) { x = 0; vx = Math.abs(vx); }
      if (x >= innerWidth - width) { x = innerWidth - width; vx = -Math.abs(vx); }
      if (y <= 8) { y = 8; vy = Math.abs(vy); }
      if (y >= innerHeight - height - 4) { y = innerHeight - height - 4; vy = -Math.abs(vy); }
    }
    bird.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scaleX(' + (vx < 0 ? '-1' : '1') + ')';
    requestAnimationFrame(frame);
  }
  addEventListener('resize', dimensions, { passive: true });
  dimensions();
  chooseFlight(performance.now());
  requestAnimationFrame(frame);
})();