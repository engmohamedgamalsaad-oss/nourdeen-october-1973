/* Homepage extras: a call-to-action card that links to the quiz. */
(function () {
  'use strict';
  if (document.querySelector('.quiz-cta')) return;

  function init() {
    var cards = document.getElementById('cards');
    if (!cards || document.querySelector('.quiz-cta')) return;
    var host = cards.parentNode;

    var lang = (window.I18N && window.I18N.lang && window.I18N.lang()) || document.documentElement.lang || 'ar';
    var copy = {
      ar: { title: 'اختبر معلوماتك في حرب أكتوبر', text: '١٢ سؤالًا من الحكايات الأربع، والنتيجة تظهر فورًا.', btn: 'ابدأ الاختبار' },
      en: { title: 'Test your knowledge of the October War', text: '12 questions from the four stories, with an instant score.', btn: 'Start the quiz' },
      fr: { title: 'Testez vos connaissances sur la guerre d’octobre', text: '12 questions tirées des quatre récits, avec un score immédiat.', btn: 'Commencer le quiz' },
      it: { title: 'Metti alla prova ciò che sai sulla guerra d’ottobre', text: '12 domande tratte dai quattro racconti, con punteggio immediato.', btn: 'Inizia il quiz' }
    };
    var t = copy[lang] || copy.ar;

    if (!document.getElementById('quiz-cta-style')) {
      var style = document.createElement('style');
      style.id = 'quiz-cta-style';
      style.textContent = [
        '.quiz-cta{margin:34px auto 0;max-width:820px;padding:26px 22px;text-align:center;border:1px solid rgba(227,189,120,.45);border-radius:12px;background:linear-gradient(145deg,rgba(8,62,76,.55),rgba(2,12,18,.92))}',
        '.quiz-cta h3{margin:0 0 8px;color:#e3bd78;font-family:"Marhey","Cairo",sans-serif;font-size:clamp(1.2rem,3.5vw,1.6rem);line-height:1.7}',
        '.quiz-cta p{margin:0 0 16px;color:#d8e1e2;line-height:1.9}',
        '.quiz-cta a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:11px 24px;border-radius:8px;background:linear-gradient(145deg,#e3bd78,#a8753d);color:#171006;font:800 1rem "Cairo",sans-serif;text-decoration:none}',
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
    var a = document.createElement('a');
    a.href = 'quiz.html';
    a.textContent = t.btn;
    box.appendChild(h);
    box.appendChild(p);
    box.appendChild(a);

    if (cards.nextSibling) host.insertBefore(box, cards.nextSibling);
    else host.appendChild(box);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
