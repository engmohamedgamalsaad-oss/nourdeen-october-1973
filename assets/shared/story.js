
(function () {
  'use strict';

  /* إظهار العناصر عند دخولها الشاشة وإخفاؤها عند خروجها،
     بحيث تعود الحركة في الاتجاه العكسي عند الصعود */
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

  /* أوقف حركة الحاويات القديمة حتى تتحرك النصوص والصور منفردة */
  document.querySelectorAll('.reveal').forEach(function (el) {
    el.classList.add('show');
  });

  var targets = document.querySelectorAll(selectors.join(','));

  targets.forEach(function (el, index) {
    el.classList.add('scroll-reveal');
    el.style.transitionDelay = (index % 3) * 65 + 'ms';
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

  /* شاشة الغلاف الافتتاحية: cover-popup.jpg */
  var splashImage = document.body.getAttribute('data-splash');

  if (splashImage) {
    var splash = document.createElement('div');
    splash.className = 'story-splash';
    splash.setAttribute('role', 'dialog');
    splash.setAttribute('aria-modal', 'true');
    splash.setAttribute('aria-label', 'غلاف الحكاية');

    var topColor =
      document.body.getAttribute('data-splash-top') || '#17313a';

    var bottomColor =
      document.body.getAttribute('data-splash-bottom') || '#07151c';

    var altText =
      document.body.getAttribute('data-splash-alt') || 'غلاف الحكاية';

    splash.style.cssText =
      'position:fixed;inset:0;z-index:10000;' +
      'display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;gap:22px;padding:20px;' +
      'overflow:auto;text-align:center;' +
      'background:linear-gradient(180deg,' + topColor + ',' + bottomColor + ');' +
      'opacity:1;visibility:visible;' +
      'transition:opacity .45s ease,visibility .45s ease;';

    var art = document.createElement('img');
    art.alt = altText;
    art.src = splashImage;
    art.style.cssText =
      'display:block;width:auto;height:auto;' +
      'max-width:min(100%,1000px);max-height:76vh;' +
      'object-fit:contain;border-radius:5px;' +
      'box-shadow:0 18px 55px rgba(0,0,0,.4);';

    var errorMessage = document.createElement('div');
    errorMessage.textContent =
      'تعذّر تحميل صورة الغلاف. يمكنك بدء الحكاية.';
    errorMessage.hidden = true;
    errorMessage.style.color = '#fff';

    var startButton = document.createElement('button');
    startButton.type = 'button';
    startButton.textContent = 'ابدأ الحكاية ←';
    startButton.style.cssText =
      'font:700 1rem Cairo,Tahoma,sans-serif;' +
      'padding:13px 32px;border:1px solid #f0d59c;' +
      'border-radius:5px;color:#171006;' +
      'background:linear-gradient(145deg,#f0d59c,#b8874b);' +
      'cursor:pointer;';

    splash.appendChild(art);
    splash.appendChild(errorMessage);
    splash.appendChild(startButton);
    document.body.appendChild(splash);

    var oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    art.addEventListener('error', function () {
      art.hidden = true;
      errorMessage.hidden = false;
    });

    var splashClosed = false;

    function closeSplash() {
      if (splashClosed) return;
      splashClosed = true;

      splash.style.opacity = '0';
      splash.style.visibility = 'hidden';
      document.body.style.overflow = oldOverflow;

      window.setTimeout(function () {
        if (splash.parentNode) {
          splash.parentNode.removeChild(splash);
        }
      }, 500);
    }

    startButton.addEventListener('click', closeSplash);

    splash.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeSplash();
      }
    });

    startButton.focus();
  }

  /* تكبير الصور عند الضغط عليها */
  var lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  lightbox.setAttribute('aria-label', 'عرض الصورة بحجم كبير');

  var bigImage = document.createElement('img');
  bigImage.alt = '';
  lightbox.appendChild(bigImage);
  document.body.appendChild(lightbox);

  function closeLightbox() {
    lightbox.classList.remove('open');
    bigImage.removeAttribute('src');
  }

  document.addEventListener('click', function (event) {
    var target = event.target;

    if (!target || typeof target.closest !== 'function') {
      if (lightbox.classList.contains('open')) {
        closeLightbox();
      }
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
