(function () {
  'use strict';

  var body = document.body;

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- شاشة البداية الموحدة: التقاط بيانات #intro المكتوب يدويًا (إن وُجد) وترجمتها ---- */
  function readIntro(intro) {
    var q = function (sel) { var e = intro.querySelector(sel); return e ? e.textContent.trim() : ''; };
    return {
      name: q('.person-name'), role: q('.popup-role'), eyebrow: q('.eyebrow, .intro-kicker'),
      title: q('#intro-title'), sub: q('#intro-desc, .intro-copy > p:not(.intro-kicker)'),
      start: q('#start, #start-story')
    };
  }

  function captureIntro() {
    var intro = document.getElementById('intro') || document.getElementById('story-intro-modal');
    if (!intro) { return; }
    var img = intro.querySelector('.modal-art img, .intro-art img');
    if (!img || !img.getAttribute('src')) { return; }
    window.__khIntroEl = intro;
    window.__khStartData = readIntro(intro);
    if (!body.getAttribute('data-splash')) {
      body.setAttribute('data-splash', img.getAttribute('src'));
      body.setAttribute('data-splash-alt', img.getAttribute('alt') || '');
      body.setAttribute('data-splash-title', window.__khStartData.title || document.title || '');
      body.setAttribute('data-splash-subtitle', window.__khStartData.sub || '');
    }
  }

  var SECTION_ACCENTS = {october:'#d6ad55',history:'#d5b7ff',science:'#8ad9e8',women:'#d78bb2',people:'#e2b36d',curriculum:'#9bb7ff',islamic:'#78c59a'};
  var secMatch = (window.location.pathname || '').match(/\/stories\/([a-z]+)\/[^\/]+/);
  var sectionAccent = body.getAttribute('data-section-accent') ||
    (secMatch && SECTION_ACCENTS[secMatch[1]]) || '#e2b36d';
  /* لون القسم متاح لكل صفحة حكاية كمتغير CSS، ليأخذ الغلاف والعناصر لون قسمها لا لون حكاية بعينها. */
  document.documentElement.style.setProperty('--section-accent', sectionAccent);
  /* كل حكاية تأخذ لون قسمها في الوضع الداكن: نستبدل --accent، وكذلك --gold حين تستخدمه الحكاية كلون إبراز
     (أي حين يساوي --accent). الوضع الفاتح يحتفظ بألوانه المضبوطة للتباين. */
  try {
    var rootStyle = window.getComputedStyle(document.documentElement);
    var themeAccent = (rootStyle.getPropertyValue('--accent') || '').trim().toLowerCase();
    var themeGold = (rootStyle.getPropertyValue('--gold') || '').trim().toLowerCase();
    var accentRule = 'html:not([data-theme="light"]) body[data-story-slug]{--accent:var(--section-accent)' +
      ((themeAccent && themeAccent === themeGold) ? ';--gold:var(--section-accent)' : '') + '}';
    if (!document.getElementById('story-section-accent-style')) {
      var accentStyle = document.createElement('style');
      accentStyle.id = 'story-section-accent-style';
      accentStyle.textContent = accentRule;
      document.head.appendChild(accentStyle);
    }
  } catch (e) {}

  function translateAr(text, lang) {
    if (!text || !lang || lang === 'ar') { return text; }
    var reg = window.StoryI18N && window.StoryI18N.text;
    if (!reg) { return text; }
    var n = String(text).replace(/\s+/g, ' ').trim();
    var d = reg[n];
    if (d && typeof d === 'object' && typeof d[lang] === 'string') { return d[lang]; }
    var l = reg[lang];
    if (l && typeof l === 'object' && typeof l[n] === 'string') { return l[n]; }
    return text;
  }

  /* =========================================
     0) تهيئة صفحات القالب المولّد من لوحة الإدارة (body.story-design-*)
     هذه الصفحات تُبنى بقالب يختلف عن الحكايات المرجعية: نافذة #intro ثابتة، وغلاف hero بلا
     .hero-content، وفقرات داخل .story-body، وأزرار مشاركة بلا ربط. نكيّفها هنا حتى تحصل على
     شاشة البداية والحركة والمشاركة والهوامش نفسها، دون المساس بالحكايات القديمة.
  ========================================= */
  var keepIntroModal = body.hasAttribute('data-keep-intro-modal');
  var generatedStory = !keepIntroModal && /(^|\s)story-design-/.test(body.className || '');

  function adaptGeneratedStory() {
    var intro = document.getElementById('intro');
    if (intro) {
      captureIntro();
      /* النافذة القديمة لا يفتحها ولا يغلقها أي كود مشترك؛ تُستبدل بشاشة البداية القياسية. */
      intro.remove();
    }

    var heroBox = document.querySelector('.hero > .container');
    if (heroBox && !document.querySelector('.hero-content')) {
      heroBox.classList.add('hero-content');
    }

    var fix = document.createElement('style');
    fix.setAttribute('data-generated-story-fixes', '1');
    fix.textContent = [
      /* هوامش جانبية ثابتة على الموبايل (بعض التصاميم كانت تصفّرها) وعمود قراءة أضيق */
      'body[class*="story-design-"] .story{padding-left:clamp(18px,5vw,32px)!important;padding-right:clamp(18px,5vw,32px)!important}',
      'body[class*="story-design-"] .story .container{width:min(720px,100%)}',
      'body[class*="story-design-"] .story-body p{margin:0 0 1.1rem;line-height:2.1}',
      /* أزرار المشاركة */
      '.share-actions .btn,.share-actions .print-btn{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:9px 18px;border-radius:999px;text-decoration:none;font:800 .9rem "Cairo",Tahoma,sans-serif;cursor:pointer}',
      '#share-whatsapp{background:#168b55!important;color:#fff!important;border:1px solid rgba(255,255,255,.24)}',
      '#share-facebook{background:#1877f2!important;color:#fff!important;border:1px solid rgba(255,255,255,.24)}',
      /* الطباعة: العنوان والمتن والصور والمصادر فقط */
      '@media print{body[class*="story-design-"]{background:#fff!important;color:#000!important}',
      'body[class*="story-design-"] header,.topbar,.language-switch,.share-actions,.story-share-bar,.reactions-section,.story-quiz-section,.story-splash,.lightbox,.story-visual-gallery .container>.kicker{display:none!important}',
      'body[class*="story-design-"] p,body[class*="story-design-"] h1,body[class*="story-design-"] h2,body[class*="story-design-"] h3,body[class*="story-design-"] li{color:#000!important}',
      'body[class*="story-design-"] .story,body[class*="story-design-"] .hero{background:#fff!important;border:0!important;transform:none!important}}'
    ].join('');
    document.head.appendChild(fix);

    /* ربط أزرار المشاركة والطباعة الموجودة في القالب (كانت href="#" بلا كود). */
    var pageUrl = window.location.href.split('#')[0];
    var pageTitle = document.title || '';
    var whatsapp = document.getElementById('share-whatsapp');
    var facebook = document.getElementById('share-facebook');
    var nativeShare = document.getElementById('share');
    var printButton = document.getElementById('print-story');
    if (whatsapp) {
      whatsapp.href = 'https://wa.me/?text=' + encodeURIComponent(pageTitle + ' — ' + pageUrl);
    }
    if (facebook) {
      facebook.href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(pageUrl);
    }
    if (nativeShare) {
      nativeShare.addEventListener('click', function () {
        if (navigator.share) {
          navigator.share({ title: pageTitle, url: pageUrl }).catch(function () {});
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(pageUrl).catch(function () {});
        }
      });
    }
    if (printButton) {
      printButton.addEventListener('click', function () { window.print(); });
    }
  }

  if (generatedStory) { adaptGeneratedStory(); }

  /* الحكايات ذات data-keep-intro-modal (008/009) صارت تستخدم شاشة البداية الموحدة نفسها:
     نلتقط بيانات النافذة اليدوية ثم نزيلها، فيرسمها منشئ الشاشة أدناه. */
  if (keepIntroModal) {
    captureIntro();
    var handIntro = document.getElementById('intro');
    if (handIntro) { handIntro.remove(); }
  }

  /* القصص التي تستخدم الغلاف الافتتاحي تحصل أيضًا على حركات الظهور أثناء التمرير. */
  var richStory = !!document.querySelector('.hero-photo') || !!body.getAttribute('data-splash');

  /* =========================================
     1) شاشة البداية (اختيارية)
     تُفعّل بوضع data-splash في وسم body
  ========================================= */

  var activeLang = window.I18N ? window.I18N.lang() : 'ar';
  var lightTheme = document.documentElement.getAttribute('data-theme') === 'light';
  try { lightTheme = lightTheme || window.localStorage.getItem('kh-theme') === 'light'; } catch (e) {}
  var splashCopies = {
    '001': {
      ar: {title:'رجال البحر في أكتوبر', subtitle:'حكاية أبطال البحرية المصرية في حرب أكتوبر 1973', start:'ابدأ الحكاية ←'},
      en: {title:'Men of the Sea in October', subtitle:'The story of Egyptian Navy heroes in the 1973 October War', start:'Start the story →'},
      fr: {title:'Les hommes de la mer en octobre', subtitle:'L’histoire des héros de la marine égyptienne pendant la guerre d’octobre 1973', start:'Commencer le récit →'},
      it: {title:'Gli uomini del mare in ottobre', subtitle:'La storia degli eroi della Marina egiziana nella guerra dell’ottobre 1973', start:'Inizia il racconto →'},
      de: {title:'Männer der See im Oktober', subtitle:'Die Geschichte der Helden der ägyptischen Marine im Oktoberkrieg 1973', start:'Die Geschichte beginnen →'}
    },
    '002': {
      ar: {title:'العقل قبل السلاح', subtitle:'حكاية كارما محمد جمال — كيف فتحت المياه طريق العبور', start:'ابدأ الحكاية ←'},
      en: {title:'Brains Before Weapons', subtitle:'Karma Mohamed Gamal tells how water opened a passage across the canal', start:'Start the story →'},
      fr: {title:'L’intelligence avant les armes', subtitle:'Karma Mohamed Gamal raconte comment l’eau a ouvert un passage à travers le canal', start:'Commencer le récit →'},
      it: {title:'L’ingegno prima delle armi', subtitle:'Karma Mohamed Gamal racconta come l’acqua ha aperto un passaggio attraverso il canale', start:'Inizia il racconto →'},
      de: {title:'Verstand vor Waffen', subtitle:'Karma Mohamed Gamal erzählt, wie Wasser einen Weg über den Kanal öffnete', start:'Die Geschichte beginnen →'}
    },
    '003': {
      ar: {title:'لغة لا يفهمها العدو', subtitle:'حكاية مليكة محمد جمال — الشفرة النوبية في حرب أكتوبر', start:'ابدأ الحكاية ←'},
      en: {title:'A Language the Enemy Could Not Understand', subtitle:'Malika Mohamed Gamal tells the story of the Nubian code in the October War', start:'Start the story →'},
      fr: {title:'Une langue que l’ennemi ne comprenait pas', subtitle:'Malika Mohamed Gamal raconte le code nubien pendant la guerre d’octobre', start:'Commencer le récit →'},
      it: {title:'Una lingua che il nemico non capiva', subtitle:'Malika Mohamed Gamal racconta il codice nubiano nella guerra d’ottobre', start:'Inizia il racconto →'},
      de: {title:'Eine Sprache, die der Feind nicht verstand', subtitle:'Malika Mohamed Gamal erzählt die Geschichte des nubischen Codes im Oktoberkrieg', start:'Die Geschichte beginnen →'}
    },
    '004': {
      ar: {title:'سماء أكتوبر: شهداء الضربة الجوية الأولى', subtitle:'حكاية الطيارين الذين فتحوا الطريق للعبور', start:'ابدأ الحكاية ←'},
      en: {title:'October Skies: The Martyrs of the First Air Strike', subtitle:'The pilots who helped open a way across the canal', start:'Start the story →'},
      fr: {title:'Le ciel d’octobre : les martyrs de la première frappe aérienne', subtitle:'Les pilotes qui ont contribué à ouvrir une voie à travers le canal', start:'Commencer le récit →'},
      it: {title:'I cieli di ottobre: i martiri del primo attacco aereo', subtitle:'I piloti che contribuirono ad aprire una via attraverso il canale', start:'Inizia il racconto →'},
      de: {title:'Oktoberhimmel: Die Gefallenen des ersten Luftschlags', subtitle:'Die Piloten, die den Weg über den Kanal öffnen halfen', start:'Die Geschichte beginnen →'}
    }
  };
  var splashCopy = (splashCopies[body.getAttribute('data-story-slug')] || {})[activeLang] ||
    (splashCopies[body.getAttribute('data-story-slug')] || {}).ar;

  if (!splashCopy && window.I18N && window.I18N.t('s_start') !== 's_start') {
    splashCopy = {title: window.I18N.t('s_title'), subtitle: window.I18N.t('s_subtitle'), start: window.I18N.t('s_start')};
  }

  var startOnly = body.hasAttribute('data-start-only');
  var startLive = body.hasAttribute('data-start-live');
  if (startOnly) {
    /* صفحات لها سلوكها الخاص (006 و007): نستخدم شاشة البداية الموحدة فقط ثم نترك بقية الصفحة لسكربتها.
       مع data-start-live تبقى نافذة الصفحة مخفية كمصدر نصوص تترجمه الصفحة بنفسها، ونقرأ منها عند تغيير اللغة. */
    captureIntro();
    var legacyIntro = window.__khIntroEl || document.getElementById('intro');
    if (legacyIntro) {
      if (startLive) { legacyIntro.hidden = true; } else { legacyIntro.remove(); }
    }
  }

  var splashImage = body.getAttribute('data-splash');

  if (splashImage) {
    var sd = window.__khStartData || {};
    var slugCopies = splashCopies[body.getAttribute('data-story-slug')] || null;
    var curLang = function () {
      if (window.I18N && window.I18N.lang) { return window.I18N.lang() || 'ar'; }
      var l = document.documentElement.getAttribute('lang');
      if (!l) { try { l = window.localStorage.getItem('kh-lang'); } catch (e) {} }
      return l || 'ar';
    };

    if (!document.getElementById('story-start-style')) {
      var st = document.createElement('style');
      st.id = 'story-start-style';
      /* مظهر الشاشة: خلفية متوسطة الإضاءة بلون قسم الحكاية (لا سواد)، وخلف البطاقة صورة الغلاف مموّهة
         تتحرك ببطء. الحركة تتوقف عند تفضيل تقليل الحركة. */
      st.textContent = [
        '.story-splash{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;overflow:auto;background:linear-gradient(165deg,color-mix(in srgb,var(--start-accent) 46%,#2a5b73) 0%,color-mix(in srgb,var(--start-accent) 22%,#224a5e) 100%);transition:opacity .35s ease}',
        '.story-splash-bg{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0}',
        '.story-splash-bg img{position:absolute;inset:-8%;width:116%;height:116%;max-width:none;object-fit:cover;filter:blur(20px) saturate(1.2);opacity:.5;animation:story-splash-pan 22s ease-in-out infinite alternate}',
        '.story-splash-bg:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 18% 22%,color-mix(in srgb,var(--start-accent) 42%,transparent),transparent 46%),radial-gradient(circle at 84% 80%,rgba(255,255,255,.16),transparent 42%);background-size:150% 150%;animation:story-splash-glow 14s ease-in-out infinite alternate}',
        '@keyframes story-splash-pan{from{transform:scale(1.04) translate3d(-1.5%,-1%,0)}to{transform:scale(1.14) translate3d(1.5%,1%,0)}}',
        '@keyframes story-splash-glow{from{background-position:0% 0%}to{background-position:100% 100%}}',
        '.story-start-card{position:relative;z-index:1;width:min(900px,100%);max-height:94dvh;overflow:auto;display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);border:1px solid color-mix(in srgb,var(--start-accent) 65%,transparent);border-radius:24px;background:linear-gradient(135deg,rgba(33,68,86,.84),rgba(24,50,64,.88));-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);color:#fff;box-shadow:0 24px 70px rgba(10,30,44,.38)}',
        '.story-start-art{margin:0;box-sizing:border-box;padding:14px;height:clamp(230px,52vh,420px);display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.07)}',
        '.story-start-art img{display:block;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;border-radius:12px;border:1px solid color-mix(in srgb,var(--start-accent) 55%,transparent)}',
        '.story-start-copy{padding:clamp(22px,4.5vw,46px);align-self:center;text-align:start}',
        '.story-start-eyebrow{margin:0 0 4px;color:var(--start-accent);font-weight:900;font-size:.85rem}',
        '.story-start-name{margin:0;color:var(--start-accent);font-weight:900;font-size:1.15rem}',
        '.story-start-title{margin:6px 0 10px;font:700 clamp(1.5rem,4vw,2.4rem)/1.5 Marhey,Cairo,serif;color:#fff0d7}',
        '.story-start-role,.story-start-sub{margin:0 0 12px;line-height:1.9;color:#e6eef4}',
        '.story-start-role{font-weight:700}',
        '.story-splash-start{margin-top:8px;padding:13px 30px;border:1px solid rgba(255,255,255,.4);border-radius:999px;background:linear-gradient(145deg,var(--start-accent),color-mix(in srgb,var(--start-accent) 60%,#000));color:#14202a;font:800 1rem Cairo,Tahoma,sans-serif;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.3)}',
        '.story-start-close{position:absolute;top:10px;inset-inline-start:10px;z-index:2;width:40px;height:40px;border-radius:50%;border:1px solid var(--start-accent);background:#1d4357;color:#fff;font-size:1.4rem;cursor:pointer}',
        'html[data-theme="light"] .story-splash{background:linear-gradient(165deg,color-mix(in srgb,var(--start-accent) 26%,#fffaf0) 0%,color-mix(in srgb,var(--start-accent) 12%,#f6efdf) 100%)}',
        'html[data-theme="light"] .story-splash-bg img{opacity:.3}',
        'html[data-theme="light"] .story-start-card{background:rgba(255,253,248,.94);color:#263746;border-color:var(--start-accent);box-shadow:0 20px 60px rgba(61,48,25,.25)}',
        'html[data-theme="light"] .story-start-art{background:color-mix(in srgb,var(--start-accent) 12%,#fffdf8)}',
        'html[data-theme="light"] .story-start-title,html[data-theme="light"] .story-start-name,html[data-theme="light"] .story-start-eyebrow{color:color-mix(in srgb,var(--start-accent) 45%,#1d2a36)}',
        'html[data-theme="light"] .story-start-role,html[data-theme="light"] .story-start-sub{color:#263746}',
        'html[data-theme="light"] .story-start-close{background:#fffdf8;color:#263746}',
        '@media(max-width:700px){.story-start-card{grid-template-columns:1fr}.story-start-art{height:clamp(180px,34dvh,260px);padding:10px}.story-start-copy{padding:20px}}',
        '.story-start-card{animation:story-start-in .5s cubic-bezier(.2,.7,.2,1) both;transition:opacity .4s ease,transform .4s ease}',
        '@keyframes story-start-in{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}',
        '.story-splash.is-closing{opacity:0;pointer-events:none}',
        '.story-splash.is-closing .story-start-card{opacity:0;transform:translateY(-10px) scale(.97)}',
        '@media(prefers-reduced-motion:reduce){.story-splash,.story-start-card{transition:none;animation:none}.story-splash-bg img,.story-splash-bg:after{animation:none}}'
      ].join('\n');
      document.head.appendChild(st);
    }

    var splash = document.createElement('div');
    splash.className = 'story-splash';
    splash.setAttribute('role', 'dialog');
    splash.setAttribute('aria-modal', 'true');
    splash.style.setProperty('--start-accent', sectionAccent);

    var splashBg = document.createElement('div');
    splashBg.className = 'story-splash-bg';
    splashBg.setAttribute('aria-hidden', 'true');
    var splashBgImg = document.createElement('img');
    splashBgImg.src = splashImage.replace(/"/g, '');
    splashBgImg.alt = '';
    splashBgImg.decoding = 'async';
    splashBg.appendChild(splashBgImg);
    splash.appendChild(splashBg);

    var card = document.createElement('div'); card.className = 'story-start-card';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button'; closeBtn.className = 'story-start-close'; closeBtn.textContent = '\u00d7';
    var art = document.createElement('figure'); art.className = 'story-start-art';
    var img = document.createElement('img');
    img.src = splashImage.replace(/"/g, ''); img.alt = body.getAttribute('data-splash-alt') || '';
    img.decoding = 'async'; art.appendChild(img);
    var copyBox = document.createElement('div'); copyBox.className = 'story-start-copy';
    var elEyebrow = document.createElement('p'); elEyebrow.className = 'story-start-eyebrow';
    var elName = document.createElement('p'); elName.className = 'story-start-name';
    var splashTitle = document.createElement('h1'); splashTitle.className = 'story-start-title';
    var elRole = document.createElement('p'); elRole.className = 'story-start-role';
    var splashSubtitle = document.createElement('p'); splashSubtitle.className = 'story-start-sub';
    var startButton = document.createElement('button');
    startButton.type = 'button'; startButton.className = 'story-splash-start';
    [elEyebrow, elName, splashTitle, elRole, splashSubtitle, startButton].forEach(function (e) { copyBox.appendChild(e); });
    card.appendChild(closeBtn); card.appendChild(art); card.appendChild(copyBox); splash.appendChild(card);

    var renderStart = function () {
      var lang = curLang();
      if (startLive && window.__khIntroEl) { sd = readIntro(window.__khIntroEl); }
      var c = (slugCopies && (slugCopies[lang] || slugCopies.ar)) || null;
      if (!c && window.I18N && window.I18N.t && window.I18N.t('s_start') !== 's_start') {
        c = {title: window.I18N.t('s_title'), subtitle: window.I18N.t('s_subtitle'), start: window.I18N.t('s_start')};
      }
      splash.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
      splash.style.direction = lang === 'ar' ? 'rtl' : 'ltr';
      var title = (c && c.title) || translateAr(sd.title || body.getAttribute('data-splash-title') || '', lang);
      splashTitle.textContent = title;
      splashSubtitle.textContent = (c && c.subtitle) || translateAr(sd.sub || body.getAttribute('data-splash-subtitle') || '', lang);
      startButton.textContent = ((c && c.start) || translateAr(sd.start || '\u0627\u0628\u062f\u0623 \u0627\u0644\u062d\u0643\u0627\u064a\u0629 \u2190', lang)).replace(/\s*[\u2190\u2192]\s*$/, lang === 'ar' ? ' \u2190' : ' \u2192');
      elName.textContent = translateAr(sd.name || '', lang); elName.hidden = !sd.name;
      elEyebrow.textContent = translateAr(sd.eyebrow || '', lang); elEyebrow.hidden = !sd.eyebrow;
      elRole.textContent = translateAr(sd.role || '', lang); elRole.hidden = !sd.role;
      splash.setAttribute('aria-label', title || body.getAttribute('data-splash-alt') || '');
      closeBtn.setAttribute('aria-label', lang === 'ar' ? '\u0625\u063a\u0644\u0627\u0642' : 'Close');
    };
    renderStart();
    var onLang = function () { if (splash.parentNode) { renderStart(); } };
    document.addEventListener('site-language-change', onLang);

    var previousOverflow = body.style.overflow;
    body.appendChild(splash);
    body.style.overflow = 'hidden';

    try { startButton.focus({ preventScroll: true }); } catch (e) {}

    var splashClosing = false;

    var closeSplash = function (andScroll) {
      if (splashClosing || !splash.parentNode) { return; }
      splashClosing = true;
      document.removeEventListener('site-language-change', onLang);
      document.removeEventListener('keydown', onKey);
      body.style.overflow = previousOverflow;
      /* الانتقال: بعد زر «ابدأ» ننزل إلى بداية الحكاية (#begin) إن وُجدت، وإلا نبقى عند الغلاف. */
      var target = document.getElementById('begin');
      var finish = function () {
        splash.remove();
        if (andScroll === true && target && target.scrollIntoView) {
          target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        }
        var focusEl = target || document.querySelector('h1');
        if (focusEl) {
          if (!focusEl.hasAttribute('tabindex')) { focusEl.setAttribute('tabindex', '-1'); }
          try { focusEl.focus({ preventScroll: true }); } catch (e) {}
        }
      };
      if (reduceMotion) { finish(); return; }
      splash.classList.add('is-closing');
      setTimeout(finish, 420);
    };
    var onKey = function (event) { if (event.key === 'Escape') { closeSplash(false); } };
    document.addEventListener('keydown', onKey);

    startButton.addEventListener('click', function () { closeSplash(true); });
    closeBtn.addEventListener('click', function () { closeSplash(false); });
    splash.addEventListener('click', function (event) { if (event.target === splash) { closeSplash(false); } });
  }

  if (startOnly) { return; }

  /* =========================================
     2) الحركة القديمة: الرئيسية وبقية القصص
  ========================================= */
  var legacy = document.querySelectorAll('.reveal');

  function showAll(list) {
    list.forEach(function (el) { el.classList.add('show'); });
  }

  if (richStory || reduceMotion || !('IntersectionObserver' in window)) {
    showAll(legacy);
  } else {
    var legacyObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('show');
          legacyObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    legacy.forEach(function (el) { legacyObserver.observe(el); });
  }

  /* =========================================
     3) ظهور المحتوى في الاتجاهين (قصة نوردين)
  ========================================= */
  function initScrollReveal() {
    if (!('IntersectionObserver' in window)) { return; }

    var selectors = [
      '.container > .kicker',
      '.container > h2',
      '.container > p',
      '.container > figure',
      '.container > .quote',
      '.container > .home-button',
      '.container > h3',
      '.container > ul',
      '.container > .timeline',
      '.container > .note',
      '.story-body > p',
      '.story-image-card',
      '.word',
      '.panel',
      '.event',
      '.lesson',
      '.sources li',
      'footer'
    ].join(',');

    var targets = Array.prototype.slice.call(document.querySelectorAll(selectors));

    /* الحكاية 004 فيها بطاقات معلومات ومعرض صور؛ أضف عناصرها لحركة الصعود أثناء التمرير. */
    if (body.getAttribute('data-story-slug') === '004') {
      document.querySelectorAll('.story .container > *, .memorial-gallery .container > *, .fact-grid > *, .memorial-card, .memorial-caption > *').forEach(function (el) {
        if (targets.indexOf(el) === -1) targets.push(el);
      });
    }

    targets.forEach(function (el) {
      el.classList.add('scroll-reveal');
    });

    var observer = new IntersectionObserver(function (entries) {
      var order = 0;

      entries.forEach(function (entry) {
        var el = entry.target;

        if (entry.isIntersecting) {
          el.style.transitionDelay = Math.min(order, 4) * 70 + 'ms';
          order++;
          el.classList.add('is-visible');
        } else if (entry.boundingClientRect.top > 0) {
          /* أصبح أسفل الشاشة (المستخدم صعد): يختفي ليظهر مجددًا عند النزول */
          el.style.transitionDelay = '0ms';
          el.classList.remove('is-visible');
        }
        /* لو خرج من أعلى الشاشة نتركه ظاهرًا لتفادي الرجفة */
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -4% 0px'
    });

    targets.forEach(function (el) { observer.observe(el); });
  }

  /* =========================================
     4) Parallax لخلفية الغلاف
  ========================================= */
  function initHeroParallax() {
    var hero = document.querySelector('.hero');
    var photo = document.querySelector('.hero-photo');
    var content = document.querySelector('.hero-content');

    if (!hero || !photo) { return; }

    var pending = false;

    function update() {
      pending = false;

      var y = window.pageYOffset || 0;
      var h = hero.offsetHeight || window.innerHeight;

      if (y > h) { return; }

      photo.style.transform =
        'translate3d(0,' + (y * 0.045).toFixed(1) + 'px,0) scale(1.05)';

      if (content) {
        content.style.transform =
          'translate3d(0,' + (y * -0.05).toFixed(1) + 'px,0)';
      }
    }

    function request() {
      if (pending) { return; }
      pending = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    update();
  }

  if (richStory && !reduceMotion) {
    initScrollReveal();
    initHeroParallax();
  }

  /* =========================================
     5) أزرار المشاركة السريعة للحكاية
  ========================================= */
  (function addStoryShareButtons() {
    var heroContent = document.querySelector('.hero-content');
    if (!heroContent || heroContent.querySelector('.story-share-bar')) { return; }

    var labels = {
      ar: { heading: 'شارك الحكاية:', whatsapp: 'واتساب', facebook: 'فيسبوك' },
      en: { heading: 'Share this story:', whatsapp: 'WhatsApp', facebook: 'Facebook' },
      fr: { heading: 'Partager ce récit :', whatsapp: 'WhatsApp', facebook: 'Facebook' },
      it: { heading: 'Condividi il racconto:', whatsapp: 'WhatsApp', facebook: 'Facebook' },
      de: { heading: 'Diese Geschichte teilen:', whatsapp: 'WhatsApp', facebook: 'Facebook' }
    };
    var copy = labels[activeLang] || labels.ar;
    var pageUrl = window.location.href.split('#')[0];
    var shareText = (document.title || copy.heading) + ' — ' + pageUrl;

    var bar = document.createElement('div');
    bar.className = 'story-share-bar';
    bar.setAttribute('aria-label', copy.heading);
    Object.assign(bar.style, {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '10px',
      margin: '18px auto 0',
      width: '100%'
    });

    var heading = document.createElement('span');
    heading.textContent = copy.heading;
    Object.assign(heading.style, {
      color: '#f1d18d',
      fontFamily: '"Cairo", Tahoma, sans-serif',
      fontSize: '.88rem',
      fontWeight: '700',
      width: '100%',
      textAlign: 'center',
      marginBottom: '2px'
    });
    bar.appendChild(heading);

    function makeShareLink(label, href, background, foreground, iconText) {
      var link = document.createElement('a');
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = iconText + ' ' + label;
      link.setAttribute('aria-label', copy.heading + ' ' + label);
      Object.assign(link.style, {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '7px',
        minHeight: '42px',
        padding: '9px 18px',
        borderRadius: '999px',
        border: '1px solid rgba(255,255,255,.24)',
        background: background,
        color: foreground,
        textDecoration: 'none',
        fontFamily: '"Cairo", Tahoma, sans-serif',
        fontSize: '.9rem',
        fontWeight: '800',
        lineHeight: '1.4',
        boxShadow: '0 5px 18px rgba(0,0,0,.2)',
        transition: 'transform .2s ease, filter .2s ease'
      });
      link.addEventListener('mouseenter', function () { link.style.filter = 'brightness(1.08)'; });
      link.addEventListener('mouseleave', function () { link.style.filter = 'none'; });
      bar.appendChild(link);
      return link;
    }

    var whatsappLink = makeShareLink(
      copy.whatsapp,
      'https://wa.me/?text=' + encodeURIComponent(shareText),
      '#168b55',
      '#ffffff',
      '☏'
    );
    var facebookLink = makeShareLink(
      copy.facebook,
      'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(pageUrl),
      '#1877f2',
      '#ffffff',
      'f'
    );

    function syncShareBar() {
      var lang = window.I18N ? window.I18N.lang() : 'ar';
      var currentCopy = labels[lang] || labels.ar;
      var shareText = (document.title || currentCopy.heading) + ' — ' + pageUrl;

      bar.setAttribute('aria-label', currentCopy.heading);
      heading.textContent = currentCopy.heading;
      whatsappLink.href = 'https://wa.me/?text=' + encodeURIComponent(shareText);
      whatsappLink.textContent = '☏ ' + currentCopy.whatsapp;
      whatsappLink.setAttribute('aria-label', currentCopy.heading + ' ' + currentCopy.whatsapp);
      facebookLink.textContent = 'f ' + currentCopy.facebook;
      facebookLink.setAttribute('aria-label', currentCopy.heading + ' ' + currentCopy.facebook);
    }

    document.addEventListener('site-language-change', syncShareBar);
    syncShareBar();

    var storySlug = body.getAttribute('data-story-slug');
    var heroSection = document.querySelector('.hero');
    if (storySlug === '004' && heroSection) {
      bar.classList.add('story-share-bar--below-hero');
      heroSection.appendChild(bar);
    } else {
      var subtitle = heroContent.querySelector('.hero-subtitle');
      if (subtitle && subtitle.parentNode === heroContent) {
        subtitle.insertAdjacentElement('afterend', bar);
      } else {
        heroContent.appendChild(bar);
      }
    }
  })();

  /* =========================================
     6) تكبير الصور عند الضغط عليها
  ========================================= */
  var lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  var lightboxLabels = {
    ar: 'عرض الصورة بحجم كبير',
    en: 'View image enlarged',
    fr: 'Afficher l’image en grand',
    it: 'Visualizza l’immagine ingrandita',
    de: 'Bild vergrößert anzeigen'
  };
  function syncLightboxLabel() {
    var lang = window.I18N ? window.I18N.lang() : 'ar';
    lightbox.setAttribute('aria-label', lightboxLabels[lang] || lightboxLabels.ar);
  }
  syncLightboxLabel();
  document.addEventListener('site-language-change', syncLightboxLabel);

  var bigImage = document.createElement('img');
  bigImage.alt = '';

  lightbox.appendChild(bigImage);
  body.appendChild(lightbox);

  function closeLightbox() {
    lightbox.classList.remove('open');
    bigImage.removeAttribute('src');
  }

  document.addEventListener('click', function (event) {
    var target = event.target;

    if (!target || typeof target.closest !== 'function') { return; }

    var image = target.closest('.image-frame img');

    if (image) {
      bigImage.src = image.src;
      bigImage.alt = image.alt || '';
      lightbox.classList.add('open');
    } else if (lightbox.contains(target)) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { closeLightbox(); }
  });
})();

;(function(){
try{if('scrollRestoration' in history)history.scrollRestoration='manual'}catch(e){}
function khTop(){if(location.hash)return;try{window.scrollTo(0,0)}catch(e){}}
khTop();
window.addEventListener('DOMContentLoaded',khTop);
window.addEventListener('load',function(){khTop();requestAnimationFrame(function(){requestAnimationFrame(khTop)})});
window.addEventListener('pageshow',khTop);
})();