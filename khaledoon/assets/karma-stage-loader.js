// khaledoon/assets/karma-stage-loader.js
// Wires the Karma stage into the page. Never blocks the page, never throws.
// On by default on the pages that include this script (branch instinct/karma-rig-animation-integration only;
// not merged, not deployed). Opt out with ?karma=0 or window.KARMA_STAGE = false before this script runs.
// ?glb=<url> or window.KARMA_GLB_URL override the model. Default model: Muse B33b (EXPERIMENT_NOT_FINAL),
// the MOBILE build (about 1.4 MB) on small/coarse-pointer screens, the full build (about 10 MB) otherwise.
// Fallback: the B29 builds in assets/3d/karma/muse_B29_2026-11-27/ stay available via ?glb=.
// three.js base: window.KARMA_THREE_BASE (default jsDelivr three@0.170.0).
(function () {
  try {
    var q = new URLSearchParams(location.search);
    if (q.get('karma') === '0' || window.KARMA_STAGE === false) return;
    var here = document.currentScript ? document.currentScript.src : '';
    var mobile = (matchMedia('(max-width: 700px)').matches || matchMedia('(pointer: coarse)').matches);
    var rel = mobile
      ? '../../assets/3d/karma/muse_B33b_2026-11-27/karma_hyper3d_fullbody_MOBILE_EXPERIMENT_NOT_FINAL_B33b.glb'
      : '../../assets/3d/karma/muse_B33b_2026-11-27/karma_hyper3d_fullbody_MASTER_EXPERIMENT_NOT_FINAL_B33b.glb';
    var glb = q.get('glb') || window.KARMA_GLB_URL || (here ? new URL(rel, here).href : rel);
    var base = window.KARMA_THREE_BASE || 'https://cdn.jsdelivr.net/npm/three@0.170.0';
    var im = document.createElement('script'); im.type = 'importmap';
    im.textContent = JSON.stringify({ imports: { three: base + '/build/three.module.js', 'three/addons/': base + '/examples/jsm/' } });
    document.head.appendChild(im);
    var src = here ? new URL('karma-stage.js', here).href : 'karma-stage.js';
    var go = function () { import(src).then(function (m) { return m.startKarmaStage({ glbUrl: glb }); }).catch(function (e) { console.warn('karma-stage disabled:', e && e.message || e); }); };
    if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 3000 }); else setTimeout(go, 1500);
  } catch (e) { /* never break the page */ }
})();
