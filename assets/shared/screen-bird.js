(function () {
  'use strict';
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (document.getElementById('history-bird')) return;

  var style = document.createElement('style');
  style.textContent = [
    '#history-bird{position:fixed;left:0;top:0;width:clamp(42px,5.2vw,66px);height:auto;z-index:9000;pointer-events:none;overflow:visible;will-change:transform;filter:drop-shadow(0 5px 5px rgba(0,0,0,.28));transform:translate3d(-100px,-100px,0)}',
    '#history-bird .bird-wing{transform-box:fill-box;transform-origin:78% 38%;animation:hb-flap .34s ease-in-out infinite alternate}',
    '#history-bird .bird-tail{transform-box:fill-box;transform-origin:0% 50%;animation:hb-tail .8s ease-in-out infinite alternate}',
    '#history-bird .bird-body{transform-box:fill-box;transform-origin:50% 50%;animation:hb-bob 1.7s ease-in-out infinite}',
    '#history-bird .bird-eye-glint{animation:hb-glint 3.8s ease-in-out infinite}',
    '@keyframes hb-flap{from{transform:rotate(-16deg) scaleY(.84)}to{transform:rotate(27deg) scaleY(1.08)}}',
    '@keyframes hb-tail{from{transform:rotate(-5deg)}to{transform:rotate(7deg)}}',
    '@keyframes hb-bob{0%,100%{translate:0 0}50%{translate:0 -2px}}',
    '@keyframes hb-glint{0%,88%,100%{opacity:1}91%,96%{opacity:.05}}',
    '@media(max-width:600px){#history-bird{width:46px}}'
  ].join('');
  document.head.appendChild(style);

  var bird = document.createElement('div');
  bird.id = 'history-bird';
  bird.setAttribute('aria-hidden', 'true');
  bird.innerHTML = '<svg viewBox="0 0 120 105" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">' +
    '<defs>' +
      '<radialGradient id="hb-body" cx="30%" cy="20%" r="85%"><stop offset="0" stop-color="#9af8f0"/><stop offset=".35" stop-color="#24c5d2"/><stop offset=".76" stop-color="#087aab"/><stop offset="1" stop-color="#06466f"/></radialGradient>' +
      '<linearGradient id="hb-wing" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#72f2e4"/><stop offset=".52" stop-color="#168dbd"/><stop offset="1" stop-color="#174b9d"/></linearGradient>' +
      '<radialGradient id="hb-belly" cx="45%" cy="25%" r="80%"><stop stop-color="#fff0a6"/><stop offset=".7" stop-color="#ffc54c"/><stop offset="1" stop-color="#f18a25"/></radialGradient>' +
      '<linearGradient id="hb-beak" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffe17b"/><stop offset="1" stop-color="#ff7c24"/></linearGradient>' +
      '<linearGradient id="hb-feather" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d7fffa"/><stop offset="1" stop-color="#1687bd"/></linearGradient>' +
    '</defs>' +
    '<g class="bird-body">' +
      '<path class="bird-tail" d="M34 64 Q12 53 9 36 Q29 43 43 54 Q25 52 20 43 Q35 48 45 57" fill="url(#hb-feather)" stroke="#075b8b" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<ellipse cx="61" cy="60" rx="35" ry="32" fill="url(#hb-body)" stroke="#075783" stroke-width="1.5"/>' +
      '<ellipse cx="65" cy="69" rx="23" ry="21" fill="url(#hb-belly)"/>' +
      '<path d="M35 53 Q29 29 52 24 Q73 20 82 40 Q63 33 48 43Z" fill="#0c8fc0" opacity=".85"/>' +
      '<path class="bird-wing" d="M47 48 Q63 30 82 42 Q98 54 82 72 Q68 81 50 65 Q64 63 69 53 Q58 59 47 58Z" fill="url(#hb-wing)" stroke="#075783" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<path d="M54 52 Q65 45 77 48 M57 59 Q67 52 78 54 M59 65 Q67 59 75 60" fill="none" stroke="#9cf7eb" stroke-width="2" stroke-linecap="round" opacity=".65"/>' +
      '<ellipse cx="68" cy="38" rx="23" ry="22" fill="url(#hb-body)" stroke="#075783" stroke-width="1.4"/>' +
      '<ellipse cx="76" cy="43" rx="8.5" ry="10.5" fill="#fffdf2"/>' +
      '<ellipse cx="79" cy="44" rx="5.4" ry="7" fill="#122b45"/>' +
      '<ellipse class="bird-eye-glint" cx="81" cy="41.5" rx="2.1" ry="2.4" fill="#fff"/>' +
      '<path d="M88 45 Q105 42 111 49 Q103 57 89 53Z" fill="url(#hb-beak)" stroke="#c86a20" stroke-width="1.2" stroke-linejoin="round"/>' +
      '<path d="M52 20 Q57 10 64 17 Q71 7 76 20" fill="none" stroke="#ffd65d" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M53 87 L51 94 M70 89 L72 95" stroke="#ff9c38" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M45 95 L54 95 M67 96 L76 96" stroke="#ffb348" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="44" cy="44" r="3" fill="#ffb4a1" opacity=".75"/>' +
    '</g></svg>';
  document.body.appendChild(bird);

  var x = Math.max(8, innerWidth * .18), y = Math.max(80, innerHeight * .25);
  var vx = 0.8, vy = 0.42, last = 0, pauseUntil = 0, nextPause = 0;
  var width = 60, height = 54;
  function dimensions() {
    var r = bird.getBoundingClientRect();
    width = r.width || 60;
    height = r.height || 54;
    x = Math.max(0, Math.min(x, innerWidth - width));
    y = Math.max(8, Math.min(y, innerHeight - height));
  }
  function chooseFlight() {
    vx = (Math.random() < .5 ? -1 : 1) * (.45 + Math.random() * .8);
    vy = (Math.random() < .5 ? -1 : 1) * (.18 + Math.random() * .58);
    pauseUntil = performance.now() + 900 + Math.random() * 1700;
    nextPause = pauseUntil + 2400 + Math.random() * 4000;
  }
  function frame(now) {
    if (!last) last = now;
    var dt = Math.min(2.2, (now - last) / 16.67);
    last = now;
    if (now >= nextPause && now >= pauseUntil) chooseFlight();
    if (now >= pauseUntil) {
      x += vx * dt * 2.25;
      y += vy * dt * 2.05;
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
  chooseFlight();
  requestAnimationFrame(frame);
})();