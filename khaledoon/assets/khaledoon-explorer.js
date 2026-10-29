/* خالدون عبر التاريخ — مستكشف واحد: الكرة الأرضية والخريطة التفاعلية في مشهد واحد.
   عند اختيار نقطة على الكرة تظهر طبقة انتقال مؤقتة (توهج + شبكة + حلقة تتسع من موضع الكرة)،
   وأثناء تغطيتها للشاشة ننتقل إلى الخريطة الحقيقية ونركّزها على موقع الحكاية، ثم تتلاشى الطبقة
   فتبدو الخريطة وكأنها خرجت من الكرة. زر «العودة إلى الكرة» يعكس المشهد.
   لا يغيّر البيانات ولا Supabase ولا يضيف مكتبات. يحترم تقليل الحركة (انتقال فوري بلا طبقة). */
(function () {
  'use strict';
  if (window.__khExplorer) return;
  window.__khExplorer = true;

  var LABELS = { ar: 'العودة إلى الكرة الأرضية', en: 'Back to the globe', fr: 'Retour au globe', it: 'Torna al globo', de: 'Zurück zum Globus' };
  var COVER_MS = 620, FADE_MS = 560;
  var state = 'idle', timers = [], overlay = null, backBtn = null;

  function reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function lang() { var l = (document.documentElement.lang || 'ar').slice(0, 2).toLowerCase(); return LABELS[l] ? l : 'ar'; }
  function later(fn, ms) { timers.push(window.setTimeout(fn, ms)); }

  function addStyle() {
    if (document.getElementById('kh-explorer-style')) return;
    var st = document.createElement('style');
    st.id = 'kh-explorer-style';
    st.textContent =
      '.kh-dive{position:fixed;inset:0;z-index:900;pointer-events:none;opacity:0;overflow:hidden;' +
      'background:radial-gradient(circle at var(--ox,50%) var(--oy,50%),rgba(83,190,214,.5),rgba(6,24,38,.97) 52%,#030b14 100%)}' +
      '.kh-dive:before{content:"";position:absolute;inset:-40%;transform-origin:var(--ox,50%) var(--oy,50%);transform:scale(.45);' +
      'background-image:linear-gradient(rgba(240,200,120,.22) 1px,transparent 1px),linear-gradient(90deg,rgba(240,200,120,.22) 1px,transparent 1px);background-size:64px 64px}' +
      '.kh-dive:after{content:"";position:absolute;left:var(--ox,50%);top:var(--oy,50%);width:30vmin;height:30vmin;margin:-15vmin 0 0 -15vmin;border-radius:50%;' +
      'border:2px solid rgba(240,200,120,.85);box-shadow:0 0 60px rgba(240,200,120,.45);transform:scale(.2)}' +
      '.kh-dive.is-in{opacity:1;transition:opacity .42s ease}' +
      '.kh-dive.is-in:before{transform:scale(2.6);transition:transform 1.15s cubic-bezier(.2,.7,.2,1)}' +
      '.kh-dive.is-in:after{transform:scale(8);transition:transform 1.15s cubic-bezier(.2,.7,.2,1)}' +
      '.kh-dive.is-out{opacity:0;transition:opacity ' + FADE_MS + 'ms ease}' +
      '.kh-back-globe{position:absolute;top:10px;inset-inline-end:12px;z-index:5;cursor:pointer;border:1px solid rgba(240,200,120,.6);background:rgba(6,24,38,.88);color:#f0c878;border-radius:999px;padding:8px 16px;font:700 .85rem Cairo,sans-serif}' +
      '.kh-back-globe:hover,.kh-back-globe:focus-visible{background:#f0c878;color:#061826;outline:none}' +
      '@media(prefers-reduced-motion:reduce){.kh-dive{display:none!important}}';
    document.head.appendChild(st);
  }

  function originOf(el) {
    var r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if (!r || !r.width) return ['50%', '50%'];
    return [Math.round(r.left + r.width / 2) + 'px', Math.round(r.top + r.height / 2) + 'px'];
  }

  function makeOverlay(origin) {
    removeOverlay();
    overlay = document.createElement('div');
    overlay.className = 'kh-dive';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.setProperty('--ox', origin[0]);
    overlay.style.setProperty('--oy', origin[1]);
    document.body.appendChild(overlay);
    void overlay.offsetWidth; /* reflow so the transition starts */
    overlay.classList.add('is-in');
  }
  function removeOverlay() { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); overlay = null; }

  function jump(target) { if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'auto', block: 'start' }); }

  /* opts: {storyId, from:'globe'|'map', origin:[x,y]} */
  function run(opts) {
    var toMap = opts.from !== 'map';
    var target = document.getElementById(toMap ? 'khMap' : 'khWorld');
    if (!target) return false;
    if (state !== 'idle') return true; /* ignore repeated clicks while a transition runs */
    var mapEl = document.getElementById('khMap');
    function arrive() {
      if (toMap && opts.storyId) document.dispatchEvent(new CustomEvent('kh:world-select', { detail: { storyId: String(opts.storyId) } }));
      if (mapEl && toMap) { mapEl.classList.remove('kh-map-arriving'); mapEl.classList.add('kh-map-arrived'); }
    }
    if (reduced()) { jump(target); arrive(); return true; }
    state = 'diving';
    if (mapEl && toMap) { mapEl.classList.remove('kh-map-arrived'); mapEl.classList.add('kh-map-arriving'); }
    makeOverlay(opts.origin || ['50%', '50%']);
    later(function () { jump(target); arrive(); }, COVER_MS);
    later(function () { if (overlay) { overlay.classList.remove('is-in'); overlay.classList.add('is-out'); } }, COVER_MS + 80);
    later(function () { removeOverlay(); state = 'idle'; }, COVER_MS + 80 + FADE_MS + 40);
    return true;
  }

  /* نعترض نقرة زر «افتح خريطة الشخصيات» في مرحلة الالتقاط، فلا نحتاج لتعديل khaledoon-world.js.
     معرّف الحكاية المختارة يُقرأ من رابطها الظاهر في لوحة الكرة (stories/القسم/000/). */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('#khWorld a.btn.ghost') : null;
    if (!a || !document.getElementById('khMap')) return;
    var chosen = document.querySelector('#khWorld .kh-world-side > a.kh-world-chip:not([hidden])');
    var m = chosen && /\/(\d{3})\/?$/.exec(chosen.getAttribute('href') || '');
    var canvas = document.querySelector('#khWorld canvas');
    if (run({ storyId: m ? m[1] : '', from: 'globe', origin: originOf(canvas) })) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  function ensureBack() {
    var mapEl = document.getElementById('khMap');
    if (!mapEl || backBtn) return;
    backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'kh-back-globe';
    backBtn.textContent = LABELS[lang()];
    if (getComputedStyle(mapEl).position === 'static') mapEl.style.position = 'relative';
    mapEl.insertBefore(backBtn, mapEl.firstChild);
    backBtn.addEventListener('click', function () { run({ from: 'map', origin: originOf(backBtn) }); });
  }
  function syncLabel() { if (backBtn) backBtn.textContent = LABELS[lang()]; }

  function init() {
    addStyle();
    ensureBack();
    if (!backBtn) {
      var mo = new MutationObserver(function () { ensureBack(); if (backBtn) mo.disconnect(); });
      mo.observe(document.body, { childList: true, subtree: true });
    }
    new MutationObserver(syncLabel).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
