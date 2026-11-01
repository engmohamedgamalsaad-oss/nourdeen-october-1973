/* Story extras: print / save-as-PDF button and a clean print stylesheet.
   The old "test your knowledge" link and the dark box behind this section were removed:
   the quiz already appears in the story itself, and the section now sits on the page background. */
(function () {
  'use strict';
  if (document.querySelector('.story-extras')) return;

  var lang = (window.I18N && window.I18N.lang && window.I18N.lang()) || document.documentElement.lang || 'ar';
  var copy = {
    ar: { heading: 'خد الحكاية معاك', print: 'اطبع الحكاية أو احفظها PDF', hint: 'من نافذة الطباعة اختر «حفظ كملف PDF».' },
    en: { heading: 'Take this story with you', print: 'Print or save as PDF', hint: 'In the print window, choose “Save as PDF”.' },
    fr: { heading: 'Emportez ce récit', print: 'Imprimer ou enregistrer en PDF', hint: 'Dans la fenêtre d’impression, choisissez « Enregistrer en PDF ».' },
    it: { heading: 'Porta con te questo racconto', print: 'Stampa o salva in PDF', hint: 'Nella finestra di stampa scegli «Salva come PDF».' },
    de: { heading: 'Nimm diese Geschichte mit', print: 'Drucken oder als PDF speichern', hint: 'Wähle im Druckfenster „Als PDF speichern“.' }
  };
  var t = copy[lang] || copy.ar;

  var style = document.createElement('style');
  style.textContent = [
    '.story-extras{padding:34px 20px;text-align:center;background:transparent;border:0}',
    '.story-extras h2{margin:0 0 16px;color:var(--accent,#e3bd78);font-family:"Marhey","Cairo",sans-serif;font-size:clamp(1.3rem,3.5vw,1.8rem)}',
    '.story-extras-row{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}',
    '.story-extras a,.story-extras button{font:700 1rem "Cairo",sans-serif;cursor:pointer;text-decoration:none;border-radius:10px;padding:12px 20px;min-height:44px;display:inline-flex;align-items:center;justify-content:center}',
    '.story-extras .se-print{background:var(--accent,#e3bd78);color:#171006;border:0}',
    '.story-extras a:focus-visible,.story-extras button:focus-visible{outline:3px solid var(--accent,#fff);outline-offset:3px}',
    '.story-extras p{margin:14px 0 0;color:var(--muted,#b7c9cc);font-size:.9rem}',
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

  var hint = document.createElement('p');
  hint.textContent = t.hint;

  row.appendChild(printBtn);
  section.appendChild(h);
  section.appendChild(row);
  section.appendChild(hint);

  function curLang() { return (window.I18N && window.I18N.lang && window.I18N.lang()) || document.documentElement.lang || 'ar'; }
  function applyLang() {
    var c = copy[curLang()] || copy.ar;
    h.textContent = c.heading;
    printBtn.textContent = '🖨️ ' + c.print;
    hint.textContent = c.hint;
  }
  document.addEventListener('site-language-change', function () { setTimeout(applyLang, 0); });

  var anchor = document.querySelector('.reactions-section');
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(section, anchor);
  else document.body.appendChild(section);
})();

/* Khaledoon unified theme: loads the light/dark toggle + saved-choice sync (additive; does not touch the code above). */
(function (src) {
  try {
    if (window.__khTheme || document.querySelector('script[data-kh-theme]')) return;
    var s = document.createElement('script');
    s.src = src ? new URL('../../khaledoon/assets/khaledoon-theme.js?v=2', src).href : '../../khaledoon/assets/khaledoon-theme.js?v=2';
    s.defer = true;
    s.setAttribute('data-kh-theme', '');
    document.head.appendChild(s);
  } catch (e) {}
})(document.currentScript && document.currentScript.src);
