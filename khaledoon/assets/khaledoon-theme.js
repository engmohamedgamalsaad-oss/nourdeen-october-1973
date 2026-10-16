/* khaledoon-theme.js — تطبيق اختيار الفاتح/الداكن المحفوظ (kh-theme) على الصفحات التي لا تملك زرًا،
   مع زر عائم، ومزامنة بين التبويبات، وتحديث theme-color. لا يغيّر الصفحات التي فيها #th (الرئيسية/المناهج). */
(function () {
  'use strict';
  if (window.__khTheme) return;
  window.__khTheme = true;
  var KEY = 'kh-theme', root = document.documentElement, timer;
  function sys() { try { return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; } catch (e) { return 'dark'; } }
  function saved() { try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; } catch (e) { return null; } }
  function cur() { return root.getAttribute('data-theme') || saved() || sys(); }

  var meta = document.querySelector('meta[name="theme-color"]');
  var origColor = meta ? meta.getAttribute('content') : null;
  var btn = null;

  var LABELS = {
    ar: ['التبديل إلى الوضع الفاتح', 'التبديل إلى الوضع الداكن'],
    en: ['Switch to light mode', 'Switch to dark mode'],
    fr: ['Passer en mode clair', 'Passer en mode sombre'],
    it: ['Passa alla modalità chiara', 'Passa alla modalità scura'],
    de: ['Zum hellen Modus wechseln', 'Zum dunklen Modus wechseln']
  };
  function label(t) {
    var l = (root.lang || 'ar').slice(0, 2);
    return (LABELS[l] || LABELS.ar)[t === 'dark' ? 0 : 1];
  }
  function paint(t) {
    if (meta && origColor) meta.setAttribute('content', t === 'light' ? '#fbf7ec' : origColor);
    if (btn) { btn.textContent = t === 'dark' ? '☀️' : '🌙'; btn.setAttribute('aria-label', label(t)); btn.title = label(t); }
  }
  function apply(t, persist) {
    root.classList.add('kh-theme-anim');
    root.setAttribute('data-theme', t);
    if (persist) { try { localStorage.setItem(KEY, t); } catch (e) {} }
    paint(t);
    clearTimeout(timer);
    timer = setTimeout(function () { root.classList.remove('kh-theme-anim'); }, 450);
  }

  var s = saved();
  if (s) root.setAttribute('data-theme', s);

  function init() {
    if (!document.getElementById('th') && !document.querySelector('.kh-fab')) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'kh-fab';
      btn.addEventListener('click', function () { apply(cur() === 'dark' ? 'light' : 'dark', true); });
      document.body.appendChild(btn);
    }
    paint(cur());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.addEventListener('storage', function (e) {
    if (e.key === KEY && (e.newValue === 'light' || e.newValue === 'dark')) { root.setAttribute('data-theme', e.newValue); paint(e.newValue); }
  });
  try {
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () { if (!saved()) paint(cur()); });
  } catch (e) {}
})();
