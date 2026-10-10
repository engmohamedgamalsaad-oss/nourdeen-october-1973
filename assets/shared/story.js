(function () {
  'use strict';

  var body = document.body;

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* القصص التي تستخدم الغلاف الافتتاحي تحصل أيضًا على حركات الظهور أثناء التمرير. */
  var richStory = !!document.querySelector('.hero-photo') || !!body.getAttribute('data-splash');

  /* =========================================
     1) شاشة البداية (اختيارية)
     تُفعّل بوضع data-splash في وسم body
  ========================================= */

  var activeLang = window.I18N ? window.I18N.lang() : 'ar';
  var splashCopies = {
    '001': {
      ar: {title:'رجال البحر في أكتوبر', subtitle:'حكاية أبطال البحرية المصرية في حرب أكتوبر 1973', start:'ابدأ الحكاية ←'},
      en: {title:'Men of the Sea in October', subtitle:'The story of Egyptian Navy heroes in the 1973 October War', start:'Start the story →'},
      fr: {title:'Les hommes de la mer en octobre', subtitle:'L’histoire des héros de la marine égyptienne pendant la guerre d’octobre 1973', start:'Commencer le récit →'},
      it: {title:'Gli uomini del mare in ottobre', subtitle:'La storia degli eroi della Marina egiziana nella guerra dell’ottobre 1973', start:'Inizia il racconto →'}
    },
    '002': {
      ar: {title:'العقل قبل السلاح', subtitle:'حكاية كارما محمد جمال — كيف فتحت المياه طريق العبور', start:'ابدأ الحكاية ←'},
      en: {title:'Brains Before Weapons', subtitle:'Karma Mohamed Gamal tells how water opened a passage across the canal', start:'Start the story →'},
      fr: {title:'L’intelligence avant les armes', subtitle:'Karma Mohamed Gamal raconte comment l’eau a ouvert un passage à travers le canal', start:'Commencer le récit →'},
      it: {title:'L’ingegno prima delle armi', subtitle:'Karma Mohamed Gamal racconta come l’acqua ha aperto un varco attraverso il canale', start:'Inizia il racconto →'}
    },
    '003': {
      ar: {title:'لغة لا يفهمها العدو', subtitle:'حكاية مليكة محمد جمال — الشفرة النوبية في حرب أكتوبر', start:'ابدأ الحكاية ←'},
      en: {title:'A Language the Enemy Could Not Understand', subtitle:'Malika Mohamed Gamal tells the story of the Nubian code in the October War', start:'Start the story →'},
      fr: {title:'Une langue que l’ennemi ne comprenait pas', subtitle:'Malika Mohamed Gamal raconte le code nubien pendant la guerre d’octobre', start:'Commencer le récit →'},
      it: {title:'Una lingua che il nemico non capiva', subtitle:'Malika Mohamed Gamal racconta il codice nubiano nella guerra d’ottobre', start:'Inizia il racconto →'}
    },
    '004': {
      ar: {title:'سماء أكتوبر: شهداء الضربة الجوية الأولى', subtitle:'حكاية الطيارين الذين فتحوا الطريق للعبور', start:'ابدأ الحكاية ←'},
      en: {title:'October Skies: The Martyrs of the First Air Strike', subtitle:'The pilots who helped open a way across the canal', start:'Start the story →'},
      fr: {title:'Le ciel d’octobre : les martyrs de la première frappe aérienne', subtitle:'Les pilotes qui ont contribué à ouvrir une voie à travers le canal', start:'Commencer le récit →'},
      it: {title:'I cieli di ottobre: i martiri del primo attacco aereo', subtitle:'I piloti che contribuirono ad aprire una via attraverso il canale', start:'Inizia il racconto →'}
    }
  };
  var splashCopy = (splashCopies[body.getAttribute('data-story-slug')] || {})[activeLang] ||
    (splashCopies[body.getAttribute('data-story-slug')] || {}).ar;

  var splashImage = body.getAttribute('data-splash');

  if (splashImage) {
    var splash = document.createElement('div');
    splash.className = 'story-splash';
    splash.setAttribute('role', 'dialog');
    splash.setAttribute('aria-modal', 'true');
    splash.setAttribute('aria-label', (splashCopy && splashCopy.title) || body.getAttribute('data-splash-alt') || 'شاشة بداية الحكاية');

    Object.assign(splash.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '10000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      boxSizing: 'border-box',
      overflow: 'auto',
      backgroundColor: body.getAttribute('data-splash-bottom') || '#071c25',
      backgroundImage:
        'linear-gradient(180deg, rgba(0,0,0,.12), rgba(0,0,0,.72)), url("' +
        splashImage.replace(/"/g, '') +
        '")',
      backgroundPosition: 'center',
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat',
      textAlign: 'center',
      direction: activeLang === 'ar' ? 'rtl' : 'ltr',
      transition: reduceMotion ? 'none' : 'opacity .35s ease'
    });

    var splashContent = document.createElement('div');

    Object.assign(splashContent.style, {
      width: 'min(600px, 100%)',
      margin: 'auto',
      color: '#fff',
      textShadow: '0 2px 12px rgba(0,0,0,.8)'
    });

    var splashTitle = document.createElement('h1');
    splashTitle.textContent = (splashCopy && splashCopy.title) ||
      body.getAttribute('data-splash-title') || 'رجال البحر في أكتوبر';

    Object.assign(splashTitle.style, {
      fontFamily: '"Marhey", "Cairo", Tahoma, sans-serif',
      fontSize: 'clamp(2rem, 8vw, 4rem)',
      lineHeight: '1.5',
      color: '#f1d18d',
      margin: '0 0 18px'
    });

    var splashSubtitle = document.createElement('p');
    splashSubtitle.textContent = (splashCopy && splashCopy.subtitle) ||
      body.getAttribute('data-splash-subtitle') ||
      'حكاية أبطال البحرية المصرية في حرب أكتوبر 1973';

    Object.assign(splashSubtitle.style, {
      fontFamily: '"Cairo", Tahoma, sans-serif',
      fontSize: 'clamp(1rem, 3.5vw, 1.3rem)',
      lineHeight: '2',
      margin: '0 0 28px'
    });

    var startButton = document.createElement('button');
    startButton.type = 'button';
    startButton.textContent = (splashCopy && splashCopy.start) || 'ابدأ الحكاية ←';

    Object.assign(startButton.style, {
      fontFamily: '"Cairo", Tahoma, sans-serif',
      fontSize: '1rem',
      fontWeight: '800',
      padding: '13px 30px',
      border: '1px solid rgba(255,255,255,.4)',
      borderRadius: '5px',
      background: 'linear-gradient(145deg, #e3bd78, #a8753d)',
      color: '#171006',
      cursor: 'pointer',
      boxShadow: '0 8px 24px rgba(0,0,0,.3)'
    });

    splashContent.appendChild(splashTitle);
    splashContent.appendChild(splashSubtitle);
    splashContent.appendChild(startButton);
    splash.appendChild(splashContent);

    var previousOverflow = body.style.overflow;
    body.appendChild(splash);
    body.style.overflow = 'hidden';

    try { startButton.focus({ preventScroll: true }); } catch (e) {}

    var splashClosing = false;

    var closeSplash = function () {
      if (splashClosing || !splash.parentNode) { return; }
      splashClosing = true;

      body.style.overflow = previousOverflow;

      if (reduceMotion) {
        splash.remove();
        return;
      }

      splash.style.opacity = '0';
      splash.style.pointerEvents = 'none';
      setTimeout(function () { splash.remove(); }, 380);
    };

    startButton.addEventListener('click', closeSplash);
  }

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
      '.word',
      '.panel',
      '.event',
      '.lesson',
      '.sources li',
      'footer'
    ].join(',');

    var targets = document.querySelectorAll(selectors);

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
        'translate3d(0,' + (y * 0.25).toFixed(1) + 'px,0) scale(1.05)';

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
      it: { heading: 'Condividi il racconto:', whatsapp: 'WhatsApp', facebook: 'Facebook' }
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
    }

    makeShareLink(
      copy.whatsapp,
      'https://wa.me/?text=' + encodeURIComponent(shareText),
      '#168b55',
      '#ffffff',
      '☏'
    );
    makeShareLink(
      copy.facebook,
      'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(pageUrl),
      '#1877f2',
      '#ffffff',
      'f'
    );

    var subtitle = heroContent.querySelector('.hero-subtitle');
    if (subtitle && subtitle.parentNode === heroContent) {
      subtitle.insertAdjacentElement('afterend', bar);
    } else {
      heroContent.appendChild(bar);
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
    it: 'Visualizza l’immagine ingrandita'
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

/* ===== Wording corrections for EN / FR / IT =====
   Runs after story-body-i18n.js and replaces a few translated phrases with corrected ones.
   Each pair is [old text, corrected text]. Arabic pages are never touched. */
(function () {
  'use strict';

  if (!window.I18N || window.I18N.lang() === 'ar') { return; }

  var fixes = [
    ['pulled him to Jordan’s Port of Aqaba', 'pulled him to the Jordanian port of Aqaba'],
    ['Illustration of the nature of the sea passage.', 'Illustrative image of the sea passage.'],
    ['3rd Grade Primary', '3rd Grade (Primary)'],
    ['3e année primaire', '3e année du primaire'],
    ['1re année primaire', '1re année du primaire'],
    ['Logo de l’école de langues Al-Manar pour filles', 'Logo de l’École nationale de langues Al-Manar pour filles'],
    ['Scuola nazionale linguistica femminile Al-Manar', 'Scuola nazionale linguistica Al-Manar per ragazze'],
    ['Logo della Scuola linguistica Al-Manar per ragazze', 'Logo della Scuola nazionale linguistica Al-Manar per ragazze'],
    ['Prima classe della scuola preparatoria', '1ª media'],
    ['3ª primaria', '3ª elementare'],
    ['1ª primaria', '1ª elementare'],
    ['La battaglia che molti non videro', 'La battaglia che la maggior parte delle persone non ha visto']
  ];

  function fixText(value) {
    var out = value;
    for (var i = 0; i < fixes.length; i++) {
      if (out.indexOf(fixes[i][0]) !== -1) {
        out = out.split(fixes[i][0]).join(fixes[i][1]);
      }
    }
    return out;
  }

  function run() {
    try {
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      var nodes = [];
      while (walker.nextNode()) { nodes.push(walker.currentNode); }
      nodes.forEach(function (node) {
        if (/^(SCRIPT|STYLE|NOSCRIPT)$/.test(node.parentNode.nodeName)) { return; }
        var next = fixText(node.nodeValue);
        if (next !== node.nodeValue) { node.nodeValue = next; }
      });
      Array.prototype.forEach.call(document.body.querySelectorAll('[alt],[aria-label],[title]'), function (el) {
        ['alt', 'aria-label', 'title'].forEach(function (attr) {
          var current = el.getAttribute(attr);
          if (!current) { return; }
          var next = fixText(current);
          if (next !== current) { el.setAttribute(attr, next); }
        });
      });
    } catch (error) { /* never block the page */ }
  }

  document.addEventListener('DOMContentLoaded', run);
  document.addEventListener('site-language-change', run);
  window.addEventListener('load', run);
  setTimeout(run, 0);
  setTimeout(run, 400);
})();
