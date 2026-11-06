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

  // الملاحظة الطويلة في أدوات الأدمن تصبح زرًا بدل أن تحتل أعلى الصفحة.
  function enhanceTools() {
    var card = document.getElementById('adminTools');
    if (!card || card.getAttribute('data-kh-acc')) return;
    var note = card.querySelector(':scope > p.fnote');
    if (!note) return;
    card.setAttribute('data-kh-acc', '1');
    var d = document.createElement('details');
    d.className = 'kh-acc';
    var s = document.createElement('summary');
    s.textContent = 'ℹ️ شرح أدوات الأدمن';
    var b = document.createElement('div');
    b.className = 'kh-acc-body';
    note.parentNode.insertBefore(d, note);
    d.appendChild(s);
    d.appendChild(b);
    b.appendChild(note);
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
    var list = d.parentNode;
    if (list && list.id === 'rlist' && !document.getElementById('khReactTools')) {
      var tools = document.createElement('div');
      tools.id = 'khReactTools';
      tools.className = 'kh-acc-tools';
      [['فتح الكل', true], ['إغلاق الكل', false]].forEach(function (p) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn ghost';
        btn.textContent = p[0];
        btn.addEventListener('click', function () {
          var all = list.querySelectorAll('details.kh-react');
          for (var k = 0; k < all.length; k++) all[k].open = p[1];
        });
        tools.appendChild(btn);
      });
      list.parentNode.insertBefore(tools, list);
    }
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
