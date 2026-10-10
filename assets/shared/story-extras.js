/* Story extras: print / save-as-PDF button, quiz link, and a clean print stylesheet. */
(function () {
  'use strict';
  if (document.querySelector('.story-extras')) return;

  var lang = (window.I18N && window.I18N.lang && window.I18N.lang()) || document.documentElement.lang || 'ar';
  var copy = {
    ar: { heading: 'خد الحكاية معاك', print: 'اطبع الحكاية أو احفظها PDF', quiz: 'اختبر معلوماتك في حرب أكتوبر', hint: 'من نافذة الطباعة اختر «حفظ كملف PDF».' },
    en: { heading: 'Take this story with you', print: 'Print or save as PDF', quiz: 'Test your knowledge of the October War', hint: 'In the print window, choose “Save as PDF”.' },
    fr: { heading: 'Emportez ce récit', print: 'Imprimer ou enregistrer en PDF', quiz: 'Testez vos connaissances sur la guerre d’octobre', hint: 'Dans la fenêtre d’impression, choisissez « Enregistrer en PDF ».' },
    it: { heading: 'Porta con te questo racconto', print: 'Stampa o salva in PDF', quiz: 'Metti alla prova ciò che sai sulla guerra d’ottobre', hint: 'Nella finestra di stampa scegli «Salva come PDF».' }
  };
  var t = copy[lang] || copy.ar;

  var style = document.createElement('style');
  style.textContent = [
    '.story-extras{padding:44px 20px;text-align:center;background:rgba(2,8,12,.96);border-top:1px solid rgba(227,189,120,.22)}',
    '.story-extras h2{margin:0 0 16px;color:#e3bd78;font-family:"Marhey","Cairo",sans-serif;font-size:clamp(1.3rem,3.5vw,1.8rem)}',
    '.story-extras-row{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}',
    '.story-extras a,.story-extras button{font:700 1rem "Cairo",sans-serif;cursor:pointer;text-decoration:none;border-radius:10px;padding:12px 20px;min-height:44px;display:inline-flex;align-items:center;justify-content:center}',
    '.story-extras .se-print{background:#e3bd78;color:#171006;border:0}',
    '.story-extras .se-quiz{background:transparent;color:#f4e5c8;border:1px solid rgba(227,189,120,.6)}',
    '.story-extras a:focus-visible,.story-extras button:focus-visible{outline:3px solid #fff;outline-offset:3px}',
    '.story-extras p{margin:14px 0 0;color:#b7c9cc;font-size:.9rem}',
    '@media print{',
    '@page{margin:16mm}',
    'html,body{background:#fff!important}',
    'body::before{display:none!important}',
    '.topbar,.language-strip,.scroll,.reactions-section,.story-extras,.story-share-bar,.story-splash,.home-button,.flight-mark,.hero-band,[data-lang-switch]{display:none!important}',
    '*{color:#111!important;background:transparent!important;box-shadow:none!important;text-shadow:none!important;animation:none!important;transition:none!important}',
    '.reveal,.float-up{opacity:1!important;transform:none!important}',
    '.hero{min-height:0!important;height:auto!important;padding:0 0 12px!important}',
    '.story,.end,.sources{padding:10px 0!important;break-inside:auto}',
    'h1{font-size:26pt!important}h2{font-size:17pt!important;break-after:avoid}h3{break-after:avoid}',
    'p,li{font-size:11.5pt!important;line-height:1.8!important;orphans:3;widows:3}',
    'figure,.panel,.lesson,.event,.quote,.note{break-inside:avoid}',
    'img,svg{max-width:100%!important;height:auto!important}',
    '.sources a{word-break:break-all}',
    '.sources a::after{content:" (" attr(href) ")";font-size:8pt}',
    '}'
  ].join('\n');
  document.head.appendChild(style);

  var section = document.createElement('section');
  section.className = 'story-extras';
  section.setAttribute('aria-labelledby', 'story-extras-title');

  var h = document.createElement('h2');
  h.id = 'story-extras-title';
  h.textContent = t.heading;

  var row = document.createElement('div');
  row.className = 'story-extras-row';

  var printBtn = document.createElement('button');
  printBtn.type = 'button';
  printBtn.className = 'se-print';
  printBtn.textContent = '🖨️ ' + t.print;
  printBtn.addEventListener('click', function () { window.print(); });

  var quiz = document.createElement('a');
  quiz.className = 'se-quiz';
  quiz.href = '../../quiz.html';
  quiz.textContent = '📝 ' + t.quiz;

  var hint = document.createElement('p');
  hint.textContent = t.hint;

  row.appendChild(printBtn);
  row.appendChild(quiz);
  section.appendChild(h);
  section.appendChild(row);
  section.appendChild(hint);

  var anchor = document.querySelector('.reactions-section');
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(section, anchor);
  else document.body.appendChild(section);
})();
