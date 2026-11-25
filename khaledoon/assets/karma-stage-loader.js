// khaledoon/assets/karma-stage-loader.js
// Opt-in loader. Does nothing unless the page URL has ?karma=1 (or window.KARMA_STAGE is set). Never blocks the page, never throws.
// ?karma=1&glb=<url>   model URL (default window.KARMA_GLB_URL). three.js base: window.KARMA_THREE_BASE (default jsDelivr three@0.170.0).
(function () {
  try {
    var q = new URLSearchParams(location.search);
    if (q.get('karma') !== '1' && !window.KARMA_STAGE) return;
    var glb = q.get('glb') || window.KARMA_GLB_URL; if (!glb) { console.warn('karma-stage: no glb url'); return; }
    var base = window.KARMA_THREE_BASE || 'https://cdn.jsdelivr.net/npm/three@0.170.0';
    var im = document.createElement('script'); im.type = 'importmap';
    im.textContent = JSON.stringify({ imports: { three: base + '/build/three.module.js', 'three/addons/': base + '/examples/jsm/' } });
    document.head.appendChild(im);
    var src = document.currentScript ? new URL('karma-stage.js', document.currentScript.src).href : 'karma-stage.js';
    var go = function () { import(src).then(function (m) { return m.startKarmaStage({ glbUrl: glb }); }).catch(function (e) { console.warn('karma-stage disabled:', e && e.message || e); }); };
    if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 3000 }); else setTimeout(go, 1500);
  } catch (e) { /* never break the page */ }
})();
