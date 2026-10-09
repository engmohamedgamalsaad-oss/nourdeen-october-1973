(function () {
  'use strict';

  /* ===== شاشة البداية ===== */
  var body = document.body;
  var splashImage = body.getAttribute('data-splash');

  if (splashImage) {
    var splash = document.createElement('div');
    splash.className = 'story-splash';

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
      direction: 'rtl'
    });

    var splashContent = document.createElement('div');

    Object.assign(splashContent.style, {
      width: 'min(600px, 100%)',
      margin: 'auto',
      color: '#fff',
      textShadow: '0 2px 12px rgba(0,0,0,.8)'
    });

    var splashTitle = document.createElement('h1');
    splashTitle.textContent = 'رجال البحر في أكتوبر';

    Object.assign(splashTitle.style, {
      fontFamily: '"Marhey", "Cairo", Tahoma, sans-serif',
      fontSize: 'clamp(2rem, 8vw, 4rem)',
      lineHeight: '1.5',
      color: '#f1d18d',
      margin: '0 0 18px'
    });

    var splashSubtitle = document.createElement('p');
    splashSubtitle.textContent = 'حكاية أبطال البحرية المصرية في حرب أكتوبر 1973';

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

    function closeSplash() {
      if (!splash.parentNode) return;

      splash.remove();
      body.style.overflow = previousOverflow;
    }

    startButton.addEventListener('click', closeSplash);
  }

  /* ===== ظهور عناصر القصة مع التمرير ===== */
  var selectors = [
    '.story .kicker',
    '.story h2',
    '.story p',
    '.story figure',
    '.story .event',
    '.story .panel',
    '.story .quote',
    '.story .lesson',
    '.end .kicker',
    '.end h2',
    '.end p',
    '.end .quote',
    '.end .home-button',
    '.sources .kicker',
    '.sources h2',
    '.sources li',
    '.sources > .container > p',
    'footer'
  ];

  document.querySelectorAll('.reveal').forEach(function (el) {
    el.classList.add('show');
  });

  var targets = document.querySelectorAll(selectors.join(','));

  targets.forEach(function (el, index) {
    el.classList.add('scroll-reveal');
    el.style.transitionDelay = (index % 3) * 50 + 'ms';
  });

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        } else {
          entry.target.classList.remove('is-visible');
        }
      });
    }, {
      threshold: 0.08,
      rootMargin: '0px 0px -3% 0px'
    });

    targets.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    targets.forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  /* ===== تكبير الصور عند الضغط ===== */
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

    if (!target || typeof target.closest !== 'function') {
      return;
    }

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
    if (event.key === 'Escape') {
      closeLightbox();
    }
  });
})();