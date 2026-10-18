/* خالدون عبر التاريخ — بحث الصفحة الرئيسية.
   زر "بحث" بجوار زر الفاتح/الداكن داخل شريط الهيدر العلوي (لا صف مستقل تحته)، فيقصر الهيدر وتصعد الصورة الرئيسية معه.
   يفتح لوحة تبحث في: اسم الحكاية، الشخصية التي تدور عنها الحكاية، واسم القسم.
   البيانات تُقرأ من stories/index.json (يُولَّد من data.json لكل حكاية)، فأي حكاية جديدة تظهر في البحث دون تعديل هذا الملف.
   اسم الشخصية يُقرأ من حقل person في data.json (وi18n.<lang>.person لكل لغة)، واختياريًا personAliases لأسماء وتهجئات بديلة.
   الترجمة ذاتية (ar/en/fr/it/de) حتى لا تعتمد على قواميس الصفحة. لا يستخدم innerHTML مع أي بيانات. */
(function () {
  'use strict';
  var ROW = document.getElementById('khSearchRow');
  if (!ROW) return;

  var DATA_URL = 'stories/index.json';
  var VISIBILITY_API = 'https://ypwprddkscnfblhftkeb.supabase.co/rest/v1/story_visibility?select=story_id';
  var VISIBILITY_KEY = 'sb_publishable_JJnVwx8HQAJNxSok32L-qg_83fXk5Qn';
  function loadHiddenIds() {
    if (!window.__khHiddenP) {
      window.__khHiddenP = fetch(VISIBILITY_API, {
        headers: { apikey: VISIBILITY_KEY, Authorization: 'Bearer ' + VISIBILITY_KEY },
        cache: 'no-store'
      }).then(function (r) {
        return r.ok ? r.json() : [];
      }).then(function (rows) {
        return Array.isArray(rows) ? rows.map(function (x) { return String(x.story_id); }) : [];
      }).catch(function () { return []; });
    }
    return window.__khHiddenP;
  }
  var LANGS = ['ar', 'en', 'fr', 'it', 'de'];

  var SECTIONS = [
    { id: 'islamic', href: 'khaledoon/collections/islamic.html', t: { ar: 'شخصيات إسلامية', en: 'Islamic Figures', fr: 'Figures de l’islam', it: 'Figure islamiche', de: 'Persönlichkeiten des Islam' } },
    { id: 'october', href: 'khaledoon/collections/october.html', t: { ar: 'حكايات أكتوبر 1973', en: 'October 1973 Stories', fr: 'Récits d’octobre 1973', it: 'Storie di ottobre 1973', de: 'Geschichten vom Oktober 1973' } },
    { id: 'science', href: 'khaledoon/collections/science.html', t: { ar: 'العلم والعلماء', en: 'Science and Scientists', fr: 'Science et scientifiques', it: 'Scienza e scienziati', de: 'Wissenschaft und Wissenschaftler' } },
    { id: 'women', href: 'khaledoon/collections/women.html', t: { ar: 'نساء خالدات', en: 'Women Who Made History', fr: 'Femmes qui ont marqué l’histoire', it: 'Donne che hanno fatto la storia', de: 'Frauen, die Geschichte schrieben' } },
    { id: 'people', href: 'khaledoon/collections/people.html', t: { ar: 'أعلام الأدب والفنون والرياضة', en: 'Figures in Literature, Arts and Sport', fr: 'Figures de la littérature, des arts et du sport', it: 'Protagonisti della letteratura, delle arti e dello sport', de: 'Persönlichkeiten aus Literatur, Kunst und Sport' } },
    { id: 'history', href: 'khaledoon/collections/history.html', t: { ar: 'التاريخ والحضارات', en: 'History and Civilizations', fr: 'Histoire et civilisations', it: 'Storia e civiltà', de: 'Geschichte und Zivilisationen' } },
    { id: 'curriculum', href: 'khaledoon/collections/curriculum.html', t: { ar: 'شخصيات المناهج المصرية', en: 'Egyptian Curriculum Figures', fr: 'Figures des programmes égyptiens', it: 'Personaggi dei programmi egiziani', de: 'Figuren der ägyptischen Lehrpläne' } }
  ];
  var SEC = {};
  SECTIONS.forEach(function (s) { SEC[s.id] = s; });
  /* Legacy stored IDs display the current collection names. */
  SEC.knowledge = SEC.women; SEC.learning = SEC.women; SEC.fame = SEC.people;

  var STR = {
    btn:   { ar: 'بحث', en: 'Search', fr: 'Rechercher', it: 'Cerca', de: 'Suchen' },
    ph:    { ar: 'ابحث باسم الحكاية أو الشخصية أو القسم…', en: 'Search by story, person or section…', fr: 'Chercher par histoire, personnage ou rubrique…', it: 'Cerca per storia, personaggio o sezione…', de: 'Nach Geschichte, Person oder Rubrik suchen…' },
    hint:  { ar: 'جرّب اسم حكاية أو شخصية، أو اختر قسمًا:', en: 'Try a story or person, or pick a section:', fr: 'Essayez une histoire ou un personnage, ou choisissez une rubrique :', it: 'Prova una storia o un personaggio, oppure scegli una sezione:', de: 'Versuche eine Geschichte oder Person, oder wähle eine Rubrik:' },
    none:  { ar: 'مش لاقي نتيجة بالكلمة دي. جرّب كلمة تانية.', en: 'No results for that word. Try another one.', fr: 'Aucun résultat pour ce mot. Essayez-en un autre.', it: 'Nessun risultato per questa parola. Provane un’altra.', de: 'Keine Treffer für dieses Wort. Versuche es mit einem anderen.' },
    err:   { ar: 'تعذّر تحميل قائمة الحكايات الآن. يمكنك البحث في الأقسام.', en: 'The story list could not be loaded right now. You can still search sections.', fr: 'La liste des histoires n’a pas pu être chargée. Vous pouvez chercher dans les rubriques.', it: 'Non è stato possibile caricare l’elenco delle storie. Puoi comunque cercare nelle sezioni.', de: 'Die Geschichtenliste konnte gerade nicht geladen werden. Du kannst trotzdem in den Rubriken suchen.' },
    load:  { ar: 'جارٍ التحميل…', en: 'Loading…', fr: 'Chargement…', it: 'Caricamento…', de: 'Wird geladen…' },
    close: { ar: 'إغلاق', en: 'Close', fr: 'Fermer', it: 'Chiudi', de: 'Schließen' },
    story: { ar: 'حكاية', en: 'Story', fr: 'Histoire', it: 'Storia', de: 'Geschichte' },
    sect:  { ar: 'قسم', en: 'Section', fr: 'Rubrique', it: 'Sezione', de: 'Rubrik' },
    count: { ar: ' نتيجة', en: ' result(s)', fr: ' résultat(s)', it: ' risultato/i', de: ' Treffer' }
  };

  function lang() {
    var l = (document.documentElement.lang || 'ar').slice(0, 2).toLowerCase();
    return LANGS.indexOf(l) >= 0 ? l : 'ar';
  }
  function T(key) { var o = STR[key]; return o[lang()] || o.ar; }

  /* توحيد النص للمقارنة: تحويل الأرقام الهندية إلى غربية أولًا (قبل حذف التشكيل لأن نطاق
     التشكيل \u064B-\u0670 يتداخل مع \u0660-\u0669)، ثم حذف التشكيل والتطويل وتوحيد الهمزات
     والياء/الألف المقصورة والتاء المربوطة، وحذف علامات اللاتينية. */
  function norm(s) {
    s = String(s == null ? '' : s).toLowerCase();
    try { s = s.normalize('NFKD'); } catch (e) {}
    return s
      .replace(/[\u0660-\u0669]/g, function (d) { return String(d.charCodeAt(0) - 0x660); })
      .replace(/[\u06F0-\u06F9]/g, function (d) { return String(d.charCodeAt(0) - 0x6F0); })
      .replace(/ß/g, 'ss')
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[\u0300-\u036F]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/[^a-z0-9\u0600-\u06FF\s]+/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function pick(obj, field, l) {
    var v = '';
    if (l !== 'ar' && obj.i18n && obj.i18n[l] && obj.i18n[l][field]) v = obj.i18n[l][field];
    return v || obj[field] || '';
  }
  function secName(id, l) { var s = SEC[id]; return s ? (s.t[l] || s.t.ar) : (id || ''); }
  function allLangs(fn) { return LANGS.map(fn).join(' '); }

  var stories = null;      /* null = لم تُحمَّل بعد، [] = فشل أو فارغ */
  var loadFailed = false;
  var loading = null;

  function prepare(list, hiddenIds) {
    hiddenIds = hiddenIds || [];
    return list.filter(function (s) { return s && s.published !== false && s.title && hiddenIds.indexOf(String(s.id || '')) < 0; }).map(function (s) {
      var id = String(s.id || '');
      var aliases = Array.isArray(s.personAliases) ? s.personAliases.join(' ') : '';
      return {
        raw: s,
        id: id,
        order: s.order || 0,
        title: norm(allLangs(function (l) { return pick(s, 'title', l); })),
        subtitle: norm(allLangs(function (l) { return pick(s, 'subtitle', l); })),
        subject: norm(allLangs(function (l) { return pick(s, 'person', l); }) + ' ' + aliases),
        section: norm(allLangs(function (l) { return secName(s.section, l); }) + ' ' + (s.section || ''))
      };
    });
  }

  function load() {
    if (loading) return loading;
    loading = Promise.all([
      fetch(DATA_URL, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }),
      loadHiddenIds()
    ]).then(function (data) {
      stories = prepare(Array.isArray(data[0]) ? data[0] : [], data[1] || []);
    }).catch(function () { stories = []; loadFailed = true; });
    return loading;
  }

  var SEC_INDEX = SECTIONS.map(function (s) {
    return { s: s, hay: norm(allLangs(function (l) { return s.t[l]; }) + ' ' + s.id) };
  });

  function search(q) {
    var tokens = norm(q).split(' ').filter(Boolean);
    if (!tokens.length) return null;
    var out = [];
    SEC_INDEX.forEach(function (e) {
      if (tokens.every(function (t) { return e.hay.indexOf(t) >= 0; })) out.push({ kind: 'section', sec: e.s, score: 100 });
    });
    (stories || []).forEach(function (e) {
      var score = 0;
      var ok = tokens.every(function (t) {
        if (e.title.indexOf(t) >= 0) { score += 3; return true; }
        if (e.subject.indexOf(t) >= 0) { score += 3; return true; }
        if (e.section.indexOf(t) >= 0) { score += 2; return true; }
        if (e.subtitle.indexOf(t) >= 0) { score += 1; return true; }
        return false;
      });
      if (ok) out.push({ kind: 'story', e: e, score: score });
    });
    out.sort(function (a, b) {
      return b.score - a.score || (a.kind === 'story' && b.kind === 'story' ? a.e.order - b.e.order : 0);
    });
    return out;
  }

  /* ---------- الواجهة ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var btn = el('button', 'khs-btn');
  btn.type = 'button';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'khsPanel');
  btn.setAttribute('aria-haspopup', 'dialog');

  var panel = el('div', 'khs-panel');
  panel.id = 'khsPanel';
  panel.setAttribute('role', 'search');
  panel.hidden = true;

  var head = el('div', 'khs-head');
  var input = el('input', 'khs-input');
  input.type = 'search';
  input.id = 'khsInput';
  input.autocomplete = 'off';
  input.setAttribute('enterkeyhint', 'search');
  var closeBtn = el('button', 'khs-close');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  head.appendChild(input);
  head.appendChild(closeBtn);

  var status = el('div', 'khs-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  var list = el('div', 'khs-list');

  panel.appendChild(head);
  panel.appendChild(status);
  panel.appendChild(list);

  /* الزر يدخل صف أزرار الهيدر بجوار زر الفاتح/الداكن؛ واللوحة تبقى في الصف الصفري الارتفاع أسفل الهيدر. */
  var ctl = document.querySelector('.topbar .ctl');
  var thm = document.getElementById('th');
  if (ctl) {
    if (thm && thm.parentNode === ctl) thm.insertAdjacentElement('afterend', btn);
    else ctl.appendChild(btn);
  } else {
    ROW.appendChild(btn);
  }
  ROW.appendChild(panel);

  function icon() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '15');
    svg.setAttribute('height', '15');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.4');
    svg.setAttribute('stroke-linecap', 'round');
    var c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', '10.5'); c.setAttribute('cy', '10.5'); c.setAttribute('r', '6.5');
    var p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M15.5 15.5 21 21');
    svg.appendChild(c); svg.appendChild(p);
    return svg;
  }

  /* نبني عقد النص من جديد في كل مرة (لا نعدّل data لعقدة قديمة) حتى لا يتعارض مع مترجم الصفحة. */
  function labelAll() {
    btn.replaceChildren(icon(), el('span', 'khs-lbl', T('btn')));
    btn.setAttribute('aria-label', T('btn'));
    input.placeholder = T('ph');
    input.setAttribute('aria-label', T('ph'));
    closeBtn.setAttribute('aria-label', T('close'));
    closeBtn.title = T('close');
  }

  function itemLink(href, color, tag, title, meta) {
    var a = el('a', 'khs-item');
    a.href = href;
    var dot = el('span', 'khs-dot');
    if (color && /^#[0-9a-f]{3,8}$/i.test(color)) dot.style.background = color;
    var body = el('span', 'khs-body');
    body.appendChild(el('span', 'khs-title', title));
    var m = el('span', 'khs-meta');
    m.appendChild(el('b', 'khs-tag', tag));
    if (meta) m.appendChild(document.createTextNode(' · ' + meta));
    body.appendChild(m);
    a.appendChild(dot);
    a.appendChild(body);
    return a;
  }

  function render() {
    var l = lang();
    var q = input.value;
    var frag = document.createDocumentFragment();
    list.replaceChildren();
    var res = search(q);

    if (res === null) {
      status.textContent = loading && stories === null ? T('load') : (loadFailed ? T('err') : T('hint'));
      var chips = el('div', 'khs-chips');
      SECTIONS.forEach(function (s) {
        var c = el('button', 'khs-chip', s.t[l] || s.t.ar);
        c.type = 'button';
        c.addEventListener('click', function () { input.value = s.t[l] || s.t.ar; render(); input.focus(); });
        chips.appendChild(c);
      });
      frag.appendChild(chips);
      list.appendChild(frag);
      return;
    }

    if (stories === null) { status.textContent = T('load'); }
    else if (!res.length) { status.textContent = T('none'); }
    else { status.textContent = res.length + T('count') + (loadFailed ? ' — ' + T('err') : ''); }

    res.forEach(function (r) {
      if (r.kind === 'section') {
        frag.appendChild(itemLink(r.sec.href, '', T('sect'), r.sec.t[l] || r.sec.t.ar, ''));
      } else {
        var s = r.e.raw;
        var person = pick(s, 'person', l);
        var meta = secName(s.section, l);
        if (person) meta = person + ' · ' + meta;
        frag.appendChild(itemLink(s.path || ('stories/' + (s.section || '') + '/' + r.e.id + '/'), s.color, T('story'), pick(s, 'title', l), meta));
      }
    });
    list.appendChild(frag);
  }

  /* فتح اللوحة يبدأ دائمًا بحقل فارغ (لا يُحتفظ بآخر بحث). */
  function open() {
    input.value = '';
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    load().then(render);
    render();
    setTimeout(function () { input.focus(); }, 0);
  }
  function close(refocus) {
    if (panel.hidden) return;
    panel.hidden = true;
    input.value = '';
    list.replaceChildren();
    btn.setAttribute('aria-expanded', 'false');
    if (refocus) btn.focus();
  }

  btn.addEventListener('click', function () { panel.hidden ? open() : close(true); });
  btn.addEventListener('pointerenter', load, { once: true });
  btn.addEventListener('focus', load, { once: true });
  closeBtn.addEventListener('click', function () { close(true); });
  input.addEventListener('input', render);

  function items() { return Array.prototype.slice.call(list.querySelectorAll('.khs-item')); }

  panel.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
    var its = items();
    if (e.key === 'Enter' && e.target === input && its.length) { e.preventDefault(); its[0].click(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!its.length) return;
      e.preventDefault();
      var i = its.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') its[Math.min(its.length - 1, i + 1)].focus();
      else if (i <= 0) input.focus();
      else its[i - 1].focus();
    }
  });

  /* الزر الآن خارج ROW، فنستثنيه حتى لا تُغلق اللوحة ثم تُفتح من جديد عند الضغط عليه. */
  document.addEventListener('pointerdown', function (e) {
    if (!panel.hidden && !ROW.contains(e.target) && !btn.contains(e.target)) close(false);
  });

  /* تغيّر اللغة من الصفحة الرئيسية يغيّر document.documentElement.lang */
  new MutationObserver(function () { labelAll(); if (!panel.hidden) render(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  labelAll();
})();

/* تحميل نجمة المفضلة وقسم "حكاياتي المفضلة" (khaledoon-favorites.js) من نفس المجلد على الصفحة الرئيسية. */
(function () {
  try {
    if (window.__khFavs || document.querySelector('script[data-khf-loader]')) return;
    var cs = document.currentScript;
    if (!cs || !cs.src) return;
    var s = document.createElement('script');
    s.src = new URL('khaledoon-favorites.js?v=20261018-collections', cs.src).href;
    s.async = true;
    s.setAttribute('data-khf-loader', '1');
    document.head.appendChild(s);
  } catch (e) {}
})();

/* تحميل خريطة الشخصيات (khaledoon-map.js + khaledoon-map.css) من نفس المجلد على الصفحة الرئيسية. */
(function () {
  try {
    if (window.__khMap || document.querySelector('script[data-khm-loader]')) return;
    var cs = document.currentScript;
    if (!cs || !cs.src) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('khaledoon-map.css?v=20261018-collections', cs.src).href;
    document.head.appendChild(l);
    var s = document.createElement('script');
    s.src = new URL('khaledoon-map.js?v=20261018-collections', cs.src).href;
    s.async = true;
    s.setAttribute('data-khm-loader', '1');
    document.head.appendChild(s);
  } catch (e) {}
})();
