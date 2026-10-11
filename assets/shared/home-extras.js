/* Homepage extras: quiz + "write your story" call-to-action, and cards for stories published from the database. */
(function () {
  'use strict';
  var API = 'https://ypwprddkscnfblhftkeb.supabase.co';
  var KEY = 'sb_publishable_JJnVwx8HQAJNxSok32L-qg_83fXk5Qn';

  var lang = (window.I18N && window.I18N.lang && window.I18N.lang()) || document.documentElement.lang || 'ar';
  var copy = {
    ar: { title: 'اختبر معلوماتك في حرب أكتوبر', text: '١٢ سؤالًا من الحكايات الأربع، والنتيجة تظهر فورًا.', btn: 'ابدأ الاختبار', write: 'اكتب حكايتك', open: 'افتح الحكاية' },
    en: { title: 'Test your knowledge of the October War', text: '12 questions from the four stories, with an instant score.', btn: 'Start the quiz', write: 'Write your story', open: 'Open the story' },
    fr: { title: 'Testez vos connaissances sur la guerre d’octobre', text: '12 questions tirées des quatre récits, avec un score immédiat.', btn: 'Commencer le quiz', write: 'Écrivez votre récit', open: 'Ouvrir le récit' },
    it: { title: 'Metti alla prova ciò che sai sulla guerra d’ottobre', text: '12 domande tratte dai quattro racconti, con punteggio immediato.', btn: 'Inizia il quiz', write: 'Scrivi il tuo racconto', open: 'Apri il racconto' }
  };
  var t = copy[lang] || copy.ar;

  function addCta() {
    var cards = document.getElementById('cards');
    if (!cards || document.querySelector('.quiz-cta')) return;
    var host = cards.parentNode;

    if (!document.getElementById('quiz-cta-style')) {
      var style = document.createElement('style');
      style.id = 'quiz-cta-style';
      style.textContent = [
        '.quiz-cta{margin:34px auto 0;max-width:820px;padding:26px 22px;text-align:center;border:1px solid rgba(227,189,120,.45);border-radius:12px;background:linear-gradient(145deg,rgba(8,62,76,.55),rgba(2,12,18,.92))}',
        '.quiz-cta h3{margin:0 0 8px;color:#e3bd78;font-family:"Marhey","Cairo",sans-serif;font-size:clamp(1.2rem,3.5vw,1.6rem);line-height:1.7}',
        '.quiz-cta p{margin:0 0 16px;color:#d8e1e2;line-height:1.9}',
        '.quiz-cta .cta-row{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}',
        '.quiz-cta a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:11px 24px;border-radius:8px;background:linear-gradient(145deg,#e3bd78,#a8753d);color:#171006;font:800 1rem "Cairo",sans-serif;text-decoration:none}',
        '.quiz-cta a.alt{background:transparent;color:#f4e5c8;border:1px solid rgba(227,189,120,.6)}',
        '.quiz-cta a:focus-visible{outline:3px solid #fff;outline-offset:3px}'
      ].join('\n');
      document.head.appendChild(style);
    }

    var box = document.createElement('div');
    box.className = 'quiz-cta';
    var h = document.createElement('h3');
    h.textContent = '📝 ' + t.title;
    var p = document.createElement('p');
    p.textContent = t.text;
    var row = document.createElement('div');
    row.className = 'cta-row';
    var a = document.createElement('a');
    a.href = 'quiz.html';
    a.textContent = t.btn;
    var b = document.createElement('a');
    b.className = 'alt';
    b.href = 'submit.html';
    b.textContent = '✍️ ' + t.write;
    row.appendChild(a);
    row.appendChild(b);
    box.appendChild(h);
    box.appendChild(p);
    box.appendChild(row);

    if (cards.nextSibling) host.insertBefore(box, cards.nextSibling);
    else host.appendChild(box);
  }

  function makeCard(s) {
    /* في اللغات غير العربية نستخدم الترجمة إن وُجدت، وإلا يبقى النص العربي */
    var tr = (lang !== 'ar' && s.translations && typeof s.translations === 'object') ? s.translations[lang] : null;
    function pick(k) {
      return (tr && typeof tr[k] === 'string' && tr[k].trim()) ? tr[k] : (s[k] || '');
    }
    var nameText = pick('student_name');
    var first = Array.from(String(nameText || '؟'))[0];
    var color = /^#[0-9a-fA-F]{6}$/.test(s.color || '') ? s.color : '#b8874b';

    var a = document.createElement('a');
    a.className = 'card float-up is-visible';
    a.setAttribute('data-db-card', s.id);
    a.href = 'read.html?id=' + encodeURIComponent(s.id);
    a.style.setProperty('--c', color);

    var photo = document.createElement('div');
    photo.className = 'card-photo';
    var letter = document.createElement('span');
    letter.className = 'card-photo-letter';
    letter.textContent = first;
    photo.appendChild(letter);

    var body = document.createElement('div');
    body.className = 'card-body';
    var rowEl = document.createElement('div');
    rowEl.className = 'card-student-row';
    var wrap = document.createElement('span');
    wrap.className = 'student-avatar-wrap';
    var fb = document.createElement('span');
    fb.className = 'student-avatar-fallback';
    fb.textContent = first;
    wrap.appendChild(fb);
    var nm = document.createElement('div');
    nm.className = 'card-name';
    nm.textContent = nameText;
    rowEl.appendChild(wrap);
    rowEl.appendChild(nm);

    var gr = document.createElement('div');
    gr.className = 'card-grade';
    gr.textContent = pick('grade');
    var ti = document.createElement('div');
    ti.className = 'card-title';
    ti.textContent = pick('title');
    var bottom = document.createElement('div');
    bottom.className = 'card-bottom-row';
    var btn = document.createElement('span');
    btn.className = 'card-btn';
    btn.textContent = t.open;
    bottom.appendChild(btn);

    body.appendChild(rowEl);
    body.appendChild(gr);
    body.appendChild(ti);
    body.appendChild(bottom);
    a.appendChild(photo);
    a.appendChild(body);
    return a;
  }

  function fetchStories(withTr) {
    var fields = 'id,student_name,grade,title,color' + (withTr ? ',translations' : '');
    return fetch(API + '/rest/v1/submitted_stories?status=eq.published&select=' + fields + '&order=created_at.asc', {
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, Accept: 'application/json' }
    }).then(function (r) {
      /* إن لم يكن عمود الترجمات موجودًا بعد نعيد المحاولة بدونه */
      if (!r.ok) { if (withTr) return fetchStories(false); throw new Error(String(r.status)); }
      return r.json();
    });
  }

  function addDbStories() {
    var cards = document.getElementById('cards');
    if (!cards) return;
    fetchStories(true)
      .then(function (rows) {
        if (!Array.isArray(rows) || !rows.length) return;
        var tries = 0;
        (function place() {
          var ready = cards.querySelector('.card') || tries > 40;
          if (!ready) { tries++; window.setTimeout(place, 250); return; }
          var empty = cards.querySelector('.empty');
          if (empty && !cards.querySelector('.card')) empty.parentNode.removeChild(empty);
          rows.forEach(function (s) {
            if (!s || !s.id || cards.querySelector('[data-db-card="' + s.id + '"]')) return;
            cards.appendChild(makeCard(s));
          });
        })();
      })
      .catch(function () { /* الجدول غير مجهز بعد أو لا يوجد اتصال: تبقى الحكايات الأساسية ظاهرة */ });
  }

  function init() {
    addCta();
    addDbStories();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
