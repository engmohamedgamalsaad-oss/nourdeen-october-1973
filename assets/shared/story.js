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
  var splashImage = body.getAttribute('data-splash');

  if (splashImage) {
    var splash = document.createElement('div');
    splash.className = 'story-splash';
    splash.setAttribute('role', 'dialog');
    splash.setAttribute('aria-modal', 'true');
    splash.setAttribute('aria-label', body.getAttribute('data-splash-alt') || 'شاشة بداية الحكاية');

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
      direction: 'rtl',
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
    splashTitle.textContent =
      body.getAttribute('data-splash-title') || 'رجال البحر في أكتوبر';

    Object.assign(splashTitle.style, {
      fontFamily: '"Marhey", "Cairo", Tahoma, sans-serif',
      fontSize: 'clamp(2rem, 8vw, 4rem)',
      lineHeight: '1.5',
      color: '#f1d18d',
      margin: '0 0 18px'
    });

    var splashSubtitle = document.createElement('p');
    splashSubtitle.textContent =
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
    startButton.textContent = 'ابدأ الحكاية ←';

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
     5) تكبير الصور عند الضغط عليها
  ========================================= */
  var lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  lightbox.setAttribute('aria-label', 'عرض الصورة بحجم كبير');

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