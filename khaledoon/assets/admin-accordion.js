/* خالدون — أزرار فتح/إغلاق لأقسام لوحة الأدمن.
   لا يغيّر منطق الحفظ ولا الحقول: ينقل العناصر الموجودة فقط إلى مجموعات قابلة للفتح، فتبقى كل أحداثها كما هي. */
(function () {
  'use strict';
  if (window.__khAdminAccordion) return;
  window.__khAdminAccordion = true;

  var css = '' +
    'details.kh-acc{border:1px solid var(--line);border-radius:14px;background:var(--panel);margin:0 0 10px;overflow:hidden}' +
    'details.kh-acc>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;padding:12px 14px;min-height:48px;font-weight:800;color:var(--gold);user-select:none}' +
    'details.kh-acc>summary::-webkit-details-marker{display:none}' +
    'details.kh-acc>summary::after{content:"▾";margin-inline-start:auto;transition:transform .2s}' +
    'details.kh-acc[open]>summary::after{transform:rotate(180deg)}' +
    'details.kh-acc[open]>summary{border-bottom:1px solid var(--line)}' +
    'details.kh-acc>summary:focus-visible{outline:3px solid var(--gold);outline-offset:-3px}' +
    'details.kh-acc>.kh-acc-body{padding:14px}' +
    'details.kh-acc>.kh-acc-body>:last-child{margin-bottom:0}' +
    '.kh-acc-tools{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 12px}' +
    'details.kh-acc>summary .kh-acc-title{display:flex;flex-direction:column;min-width:0;flex:1}' +
    'details.kh-acc>summary .kh-acc-title small{color:var(--muted);font-weight:400;font-size:.8rem}' +
    'details.kh-acc>summary .kh-acc-count{flex:none;padding:2px 12px;border:1px solid var(--line);border-radius:99px;font-size:.85rem;color:var(--gold)}' +
    'details.kh-sec{border-inline-start:5px solid var(--c,var(--line))}' +
    'details.kh-sec>summary{font-size:1.05rem}' +
    'details.kh-sec>.kh-acc-body{padding:10px}' +
    'details.kh-sec>.kh-acc-body>:last-child{margin-bottom:0}' +
    '.kh-help-group{display:flex;gap:8px;flex-wrap:wrap;margin-inline-start:auto}' +
    '.kh-help-group .btn{background:rgba(120,140,220,.12);border:1px dashed rgba(150,170,235,.5);color:#c9d3f5;font-size:.9rem}' +
    '.kh-help-group .btn:hover,.kh-help-group .btn[aria-expanded="true"]{background:rgba(120,140,220,.24)}' +
    '.kh-help-panel{margin:12px 0 0;margin-inline-start:auto;max-width:520px;padding:12px 14px;border:1px dashed rgba(150,170,235,.5);border-radius:12px;background:rgba(120,140,220,.09);color:#c9d3f5}' +
    '.kh-help-panel[hidden]{display:none}' +
    '@media(prefers-reduced-motion:reduce){details.kh-acc>summary::after{transition:none}}';
  var st = document.createElement('style');
  st.id = 'kh-acc-style';
  st.textContent = css;
  document.head.appendChild(st);

  // عند أي scrollIntoView على عنصر داخل مجموعة مغلقة، نفتح المجموعة أولًا حتى لا تضيع رسائل مثل «حدّد المرحلة والصف».
  var nativeScroll = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function () {
    var p = this.parentElement;
    while (p) {
      if (p.tagName === 'DETAILS' && p.classList.contains('kh-acc')) p.open = true;
      p = p.parentElement;
    }
    return nativeScroll.apply(this, arguments);
  };

  function labelText(node) {
    if (!node || node.tagName !== 'LABEL' || !node.classList.contains('fl')) return '';
    var t = node.firstChild;
    return t && t.nodeType === 3 ? String(t.nodeValue || '').trim() : '';
  }

  // اسم المجموعة لكل عنصر مباشر داخل محرر الحكاية؛ أي عنصر غير معروف يبقى مكانه كما هو.
  function groupOf(node) {
    var cls = node.classList;
    if (node.tagName === 'DETAILS' && cls.contains('translation-panel')) return 'translations';
    if (cls.contains('fgrid') || cls.contains('fchk')) return 'basic';
    if (node.tagName === 'DIV' && !node.className && node.querySelector('.fgrid')) return 'basic';
    var t = labelText(node);
    if (!t) return '';
    if (t.indexOf('صوت كارما') === 0 || t.indexOf('بصوت الراوي') === 0 || t.indexOf('في ضوء التاريخ') === 0) return 'texts';
    if (t.indexOf('بنك الأسئلة') === 0) return 'quiz';
    if (t.indexOf('المصادر') === 0 || t.indexOf('الصور') === 0 || t.indexOf('رابط صفحة الحكاية') === 0) return 'sources';
    if (t.indexOf('ملاحظات الأدمن') === 0) return 'notes';
    return '';
  }

  var TITLES = {
    basic: 'البيانات الأساسية',
    texts: 'النصوص: كارما والراوي وفي ضوء التاريخ',
    quiz: 'بنك الأسئلة',
    translations: 'الترجمات ومراجعتها',
    sources: 'المصادر والصور ورابط المعاينة',
    notes: 'ملاحظات الأدمن (خاصة)'
  };

  function makeGroup(key) {
    var d = document.createElement('details');
    d.className = 'kh-acc';
    d.setAttribute('data-kh-group', key);
    var s = document.createElement('summary');
    s.textContent = TITLES[key];
    d.appendChild(s);
    var b = document.createElement('div');
    b.className = 'kh-acc-body';
    d.appendChild(b);
    return d;
  }

  function isEditor(box) {
    if (!box || box.tagName !== 'ARTICLE' || !box.classList.contains('fcard')) return false;
    var kids = box.children, hasGrid = false, hasText = false;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].classList.contains('fgrid')) hasGrid = true;
      if (labelText(kids[i]).indexOf('بصوت الراوي') === 0) hasText = true;
    }
    return hasGrid && hasText;
  }

  function enhanceEditor(box) {
    if (box.getAttribute('data-kh-acc')) return;
    if (!isEditor(box)) return;
    box.setAttribute('data-kh-acc', '1');
    var kids = Array.prototype.slice.call(box.children), groups = {}, order = [];
    kids.forEach(function (node) {
      var key = groupOf(node);
      if (!key) return;
      if (key === 'translations') {
        // لوحة الترجمات فيها زر فتح خاص بها؛ نكتفي بتوحيد شكلها مع باقي الأزرار.
        node.classList.add('kh-acc');
        node.setAttribute('data-kh-group', key);
        var sm = node.querySelector(':scope > summary');
        if (sm) sm.textContent = TITLES.translations;
        var inner = document.createElement('div');
        inner.className = 'kh-acc-body';
        Array.prototype.slice.call(node.children).forEach(function (c) { if (c !== sm) inner.appendChild(c); });
        node.appendChild(inner);
        groups[key] = node;
        order.push(key);
        return;
      }
      var g = groups[key];
      if (!g) {
        g = makeGroup(key);
        groups[key] = g;
        order.push(key);
        box.insertBefore(g, node);
      }
      g.querySelector(':scope > .kh-acc-body').appendChild(node);
    });
    if (!order.length) return;
    var first = groups[order[0]];
    var tools = document.createElement('div');
    tools.className = 'kh-acc-tools';
    [['فتح كل الأقسام', true], ['إغلاق كل الأقسام', false]].forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ghost';
      b.textContent = p[0];
      b.addEventListener('click', function () {
        order.forEach(function (k) { groups[k].open = p[1]; });
      });
      tools.appendChild(b);
    });
    box.insertBefore(tools, first);
  }

  // بطاقة «أدوات تجهيز ومراجعة الموقع»: أزرار الصفحات على اليمين، والتعليمات فقط (شرح أدوات الأدمن + شرح الدمج في GitHub)
  // تنزل بجانب بعض على الشمال بلون مختلف شوية، وشرح الأدوات يفتح تحتها عند الضغط.
  function enhanceTools() {
    var card = document.getElementById('adminTools');
    if (!card || card.getAttribute('data-kh-acc')) return;
    var note = card.querySelector(':scope > p.fnote'), row = card.querySelector(':scope > .admin-tool-links');
    if (!note || !row) return;
    card.setAttribute('data-kh-acc', '1');
    if (!row.querySelector('a[href="preview.html"]')) {
      var pv = document.createElement('a');
      pv.className = 'btn ghost';
      pv.href = 'preview.html';
      pv.textContent = 'المعاينة المرئية';
      row.appendChild(pv);
    }
    var help = document.createElement('div');
    help.className = 'kh-help-group';
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'btn ghost';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = 'ℹ️ شرح أدوات الأدمن';
    help.appendChild(toggle);
    var gh = row.querySelector('a[href*="GITHUB-MERGE-GUIDE"]');
    if (gh) help.appendChild(gh);
    row.appendChild(help);
    note.classList.add('kh-help-panel');
    note.hidden = true;
    card.appendChild(note);
    toggle.addEventListener('click', function () {
      note.hidden = !note.hidden;
      toggle.setAttribute('aria-expanded', note.hidden ? 'false' : 'true');
    });
  }

  // تفاعلات الحكايات: كل حكاية تصبح زرًا فيه العنوان وإجمالي التفاعلات، وتفتح لتعرض الأعداد التفصيلية.
  function enhanceReaction(box) {
    if (box.getAttribute('data-kh-acc')) return;
    box.setAttribute('data-kh-acc', '1');
    var head = box.querySelector(':scope > .reaction-review-head'), grid = box.querySelector(':scope > .reaction-count-grid');
    if (!head || !grid || !box.parentNode) return;
    var h3 = head.querySelector('h3'), meta = head.querySelector('.reaction-review-meta');
    var total = 0, nums = grid.querySelectorAll('strong');
    for (var i = 0; i < nums.length; i++) total += Number(nums[i].textContent) || 0;
    var d = document.createElement('details');
    d.className = 'kh-acc kh-react';
    d.setAttribute('data-meta', meta ? meta.textContent : '');
    var s = document.createElement('summary');
    var t = document.createElement('span');
    t.className = 'kh-acc-title';
    t.appendChild(document.createTextNode(h3 ? h3.textContent : ''));
    if (meta && meta.textContent) { var sm = document.createElement('small'); sm.textContent = meta.textContent; t.appendChild(sm); }
    s.appendChild(t);
    var c = document.createElement('span');
    c.className = 'kh-acc-count';
    c.textContent = total + ' تفاعل';
    s.appendChild(c);
    d.appendChild(s);
    var b = document.createElement('div');
    b.className = 'kh-acc-body';
    b.appendChild(grid);
    d.appendChild(b);
    box.parentNode.insertBefore(d, box);
    box.parentNode.removeChild(box);
  }

  // ===== التدرج: قسم ← حكاية ← خيارات الحكاية =====
  var SEC_ALIAS = { learning: 'women', knowledge: 'women', fame: 'people' };
  var secTitle = {}, secOrder = [], idSec = {}, secLoaded = null, secOpen = {}, gPending = false;
  var SEARCH_OF = { list: 'search', vlist: 'vsearch', rlist: 'rsearch' };

  function fetchJson(u) {
    try {
      return fetch(u, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }
  function loadSecData() {
    if (secLoaded) return secLoaded;
    secLoaded = Promise.all([fetchJson('../stories/sections.json'), fetchJson('../stories/index.json')]).then(function (a) {
      var secs = a[0] && a[0].sections;
      if (Array.isArray(secs)) secs.forEach(function (x) { if (x && x.id) { secTitle[x.id] = x.title || x.id; secOrder.push(x.id); } });
      if (Array.isArray(a[1])) a[1].forEach(function (x) { if (x && x.id != null) idSec[String(x.id)] = x.section || ''; });
    });
    return secLoaded;
  }
  function secLabel(key) {
    if (key === 'other') return 'أقسام أخرى';
    return secTitle[key] || secTitle[SEC_ALIAS[key]] || key;
  }
  function idFromText(txt) {
    var m = /رقم\s+(\S+)/.exec(txt || '');
    return m ? m[1] : '';
  }
  // كل صف يُصنَّف لقسمه: الحكايات المرسلة من اللون sec-xxx في الصف نفسه، والباقي من رقم الحكاية في ملف الموقع.
  var KINDS = {
    list: { rows: 'details.pubrow', key: function (r) { var m = /(?:^|\s)sec-([a-z0-9-]+)/.exec(r.className); return m ? m[1] : 'other'; } },
    vlist: { rows: 'div.vrow', key: function (r) { var sm = r.querySelector('small'); return idSec[idFromText(sm && sm.textContent)] || 'other'; } },
    rlist: { rows: 'details.kh-react', key: function (r) { return idSec[idFromText(r.getAttribute('data-meta'))] || 'other'; } }
  };

  function ensureTools(list) {
    var id = 'khTools-' + list.id;
    if (document.getElementById(id) || !list.parentNode) return;
    var tools = document.createElement('div');
    tools.id = id;
    tools.className = 'kh-acc-tools';
    [['فتح كل الأقسام', function () { var a = list.querySelectorAll('details.kh-sec'); for (var i = 0; i < a.length; i++) a[i].open = true; }],
     ['إغلاق الكل', function () { var a = list.querySelectorAll('details'); for (var i = 0; i < a.length; i++) a[i].open = false; }]].forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ghost';
      b.textContent = p[0];
      b.addEventListener('click', p[1]);
      tools.appendChild(b);
    });
    list.parentNode.insertBefore(tools, list);
  }

  function groupList(list, kind) {
    var rows = Array.prototype.filter.call(list.children, function (n) { return n.matches(kind.rows); });
    if (!rows.length) return;
    var groups = {}, order = [];
    rows.forEach(function (r) {
      var k = kind.key(r), g = groups[k];
      if (!g) { g = groups[k] = { key: k, rows: [], idx: order.length }; order.push(g); }
      g.rows.push(r);
    });
    function rank(g) { var i = secOrder.indexOf(g.key); if (i < 0) i = secOrder.indexOf(SEC_ALIAS[g.key]); return i < 0 ? 1000 + g.idx : i; }
    order.sort(function (a, b) { return rank(a) - rank(b); });
    var si = document.getElementById(SEARCH_OF[list.id]);
    var searching = !!(si && String(si.value || '').trim());
    order.forEach(function (g) {
      var d = document.createElement('details');
      d.className = 'kh-acc kh-sec' + (/^[a-z0-9-]+$/.test(g.key) ? ' sec-' + g.key : '');
      d.setAttribute('data-kh-sec', g.key);
      var s = document.createElement('summary');
      var t = document.createElement('span');
      t.className = 'kh-acc-title';
      t.textContent = secLabel(g.key);
      s.appendChild(t);
      var c = document.createElement('span');
      c.className = 'kh-acc-count';
      c.textContent = g.rows.length + ' حكاية';
      s.appendChild(c);
      d.appendChild(s);
      var b = document.createElement('div');
      b.className = 'kh-acc-body';
      g.rows.forEach(function (r) { b.appendChild(r); });
      d.appendChild(b);
      var memo = list.id + ':' + g.key;
      var hasOpenRow = g.rows.some(function (r) { return r.open; });
      if (secOpen[memo] || hasOpenRow || searching) d.open = true;
      s.addEventListener('click', function () { setTimeout(function () { secOpen[memo] = d.open; }, 0); });
      list.appendChild(d);
    });
    ensureTools(list);
  }

  function groupAll() {
    gPending = false;
    Object.keys(KINDS).forEach(function (id) {
      var list = document.getElementById(id);
      if (list) groupList(list, KINDS[id]);
    });
  }
  function scheduleGroup() {
    if (gPending) return;
    gPending = true;
    loadSecData().then(groupAll, groupAll);
  }

  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches && root.matches('article.reaction-review-card')) enhanceReaction(root);
    else if (root.matches && root.matches('article.fcard')) enhanceEditor(root);
    var found = root.querySelectorAll ? root.querySelectorAll('article.fcard:not([data-kh-acc])') : [];
    for (var i = 0; i < found.length; i++) enhanceEditor(found[i]);
    var rx = root.querySelectorAll ? root.querySelectorAll('article.reaction-review-card:not([data-kh-acc])') : [];
    for (var j = 0; j < rx.length; j++) enhanceReaction(rx[j]);
    enhanceTools();
    scheduleGroup();
  }

  var pending = false, queue = [];
  function flush() {
    pending = false;
    var q = queue; queue = [];
    q.forEach(scan);
  }
  var mo = new MutationObserver(function (records) {
    records.forEach(function (r) {
      for (var i = 0; i < r.addedNodes.length; i++) if (r.addedNodes[i].nodeType === 1) queue.push(r.addedNodes[i]);
    });
    if (queue.length && !pending) { pending = true; Promise.resolve().then(flush); }
  });
  mo.observe(document.body || document.documentElement, { childList: true, subtree: true });
  scan(document.body);
})();
