/* خالدون — زر رجوع موحّد في أعلى كل صفحة من صفحات أدوات الأدمن (الأقسام، البرومبتات، الإنشاء اليدوي، المعاينة)
   يرجع إلى لوحة «أدوات تجهيز ومراجعة الموقع». لا يعمل داخل admin.html نفسها. */
(function () {
  'use strict';
  if (window.__khAdminNav) return;
  window.__khAdminNav = true;
  if (/(?:^|\/)admin\.html$/.test(location.pathname)) return;

  var LABEL = 'أدوات تجهيز ومراجعة الموقع';

  function build() {
    if (!document.body || document.getElementById('khBackBar')) return;
    var st = document.createElement('style');
    st.id = 'khBackBarStyle';
    st.textContent = '' +
      '#khBackBar{position:sticky;top:0;z-index:60;display:flex;align-items:center;gap:10px;padding:8px 14px;background:#0a1633;border-bottom:1px solid #2e4274;direction:rtl}' +
      '#khBackBar a{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:6px 16px;border:1px solid #d7ad66;border-radius:11px;background:#10204a;color:#d7ad66;font:800 .95rem/1.4 Cairo,Arial,sans-serif;text-decoration:none}' +
      '#khBackBar a:hover,#khBackBar a:focus-visible{background:#16295e;outline:none}' +
      '#khBackBar a:focus-visible{box-shadow:0 0 0 3px rgba(215,173,102,.5)}';
    document.head.appendChild(st);

    var bar = document.createElement('nav');
    bar.id = 'khBackBar';
    bar.setAttribute('aria-label', 'الرجوع إلى لوحة الأدمن');
    var a = document.createElement('a');
    a.href = 'admin.html';
    a.textContent = '→ ' + LABEL;
    bar.appendChild(a);
    document.body.insertBefore(bar, document.body.firstChild);

    // أزرار «العودة للأدمن» القديمة داخل الصفحات صارت مكررة، فنخفيها.
    var olds = document.querySelectorAll('a[href="admin.html"]');
    for (var i = 0; i < olds.length; i++) if (!bar.contains(olds[i])) olds[i].style.display = 'none';
  }

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();
