/* خالدون — تبويب «ظهور الحكايات على الموقع»: قسم ← حكاية ← خيارات الحكاية.
   admin-accordion.js يجمّع الصفوف تحت زر القسم؛ هذا الملف يحوّل كل حكاية داخل القسم إلى زر
   (العنوان + الحالة)، وتحته الخيارات: إخفاء/إظهار، نقل إلى قسم آخر، طلب حذف نهائي.
   لا يغيّر منطق الحفظ: ينقل الأزرار الموجودة كما هي فتبقى أحداثها شغالة. */
(function () {
  'use strict';
  if (window.__khVisStories) return;
  window.__khVisStories = true;

  var css = '' +
    'details.kh-vrow{border:1px solid var(--line);border-radius:12px;background:var(--panel);margin:0 0 8px;overflow:hidden}' +
    'details.kh-vrow.off{opacity:.8;border-style:dashed}' +
    'details.kh-vrow>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;padding:10px 12px;min-height:48px;user-select:none}' +
    'details.kh-vrow>summary::-webkit-details-marker{display:none}' +
    'details.kh-vrow>summary::after{content:"▾";margin-inline-start:6px;color:var(--gold);transition:transform .2s}' +
    'details.kh-vrow[open]>summary::after{transform:rotate(180deg)}' +
    'details.kh-vrow[open]>summary{border-bottom:1px solid var(--line)}' +
    'details.kh-vrow>summary:focus-visible{outline:3px solid var(--gold);outline-offset:-3px}' +
    'details.kh-vrow .kh-vt{flex:1;min-width:0}' +
    'details.kh-vrow .kh-vt b{display:block;color:var(--gold);line-height:1.6}' +
    'details.kh-vrow .kh-vt small{color:var(--muted)}' +
    'details.kh-vrow .vs{flex:none;font-size:.78rem;font-weight:800;padding:2px 10px;border-radius:99px;border:1px solid var(--line)}' +
    'details.kh-vrow.off .vs{color:#e07a7a;border-color:#e07a7a}' +
    'details.kh-vrow>.kh-vbody{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px}' +
    '@media(prefers-reduced-motion:reduce){details.kh-vrow>summary::after{transition:none}}';
  var st = document.createElement('style');
  st.id = 'kh-vis-style';
  st.textContent = css;
  document.head.appendChild(st);

  var openIds = {};

  function idOf(row) {
    var sm = row.querySelector('.vt small');
    var m = /رقم\s+(\S+)/.exec(sm ? sm.textContent : '');
    return m ? m[1] : '';
  }

  function convert(row) {
    var tx = row.querySelector(':scope > .vt'), vs = row.querySelector(':scope > .vs');
    if (!tx) return;
    var id = idOf(row);
    var d = document.createElement('details');
    d.className = 'kh-vrow' + (row.classList.contains('off') ? ' off' : '');
    d.setAttribute('data-id', id);
    var s = document.createElement('summary');
    var t = document.createElement('div');
    t.className = 'kh-vt';
    while (tx.firstChild) t.appendChild(tx.firstChild);
    s.appendChild(t);
    if (vs) s.appendChild(vs);
    d.appendChild(s);
    var b = document.createElement('div');
    b.className = 'kh-vbody';
    while (row.firstChild) b.appendChild(row.firstChild);
    d.appendChild(b);
    if (id && openIds[id]) d.open = true;
    s.addEventListener('click', function () { setTimeout(function () { if (id) openIds[id] = d.open; }, 0); });
    row.parentNode.replaceChild(d, row);
  }

  function run() {
    var rows = document.querySelectorAll('#vlist details.kh-sec > .kh-acc-body > div.vrow');
    for (var i = 0; i < rows.length; i++) convert(rows[i]);
  }

  var pending = false;
  new MutationObserver(function () {
    if (pending) return;
    pending = true;
    Promise.resolve().then(function () { pending = false; run(); });
  }).observe(document.body || document.documentElement, { childList: true, subtree: true });
  run();
})();
