
(function () {
  'use strict';

  /* 1) إظهار عناصر الحكاية أثناء التمرير */
  var els = document.querySelectorAll('.reveal');

  if (!('IntersectionObserver' in window)) {
    els.forEach(function (el) {
      el.classList.add('show');
    });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('show');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    els.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* 2) شاشة افتتاحية اختيارية من إعدادات الصفحة */
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

    splash.innerHTML =
      '<style>' +
      '.story-splash{' +
        'position:fixed;inset:0;z-index:9999;' +
        'display:flex;flex-direction:column;align-items:center;' +
        'justify-content:center;gap:22px;padding:24px 16px;' +
        'overflow:auto;text-align:center;' +
        'background:linear-gradient(180deg,' + topColor + ',' + bottomColor + ');' +
        'opacity:1;visibility:visible;' +
        'transition:opacity .45s ease,visibility .45s ease;' +
      '}' +
      '.story-splash.is-closing{' +
        'opacity:0;visibility:hidden;pointer-events:none;' +
      '}' +
      '.story-splash img{' +
        'display:block;width:auto;height:auto;' +
        'max-width:min(100%,1000px);max-height:76vh;' +
        'object-fit:contain;border-radius:5px;' +
        'box-shadow:0 18px 55px rgba(0,0,0,.4);' +
      '}' +
      '.story-splash button{' +
        'font:700 1rem Cairo,Tahoma,sans-serif;' +
        'padding:13px 32px;border:1px solid #f0d59c;' +
        'border-radius:5px;color:#171006;' +
        'background:linear-gradient(145deg,#f0d59c,#b8874b);' +
        'box-shadow:0 8px 24px rgba(0,0,0,.25);cursor:pointer;' +
      '}' +
      '.story-splash button:focus-visible{' +
        'outline:3px solid white;outline-offset:4px;' +
      '}' +
      '.story-splash .splash-error{' +
        'color:#fff;padding:20px;line-height:1.9;' +
      '}' +
      '@media(max-width:600px){' +
        '.story-splash{gap:18px;padding:16px 12px;}' +
        '.story-splash img{max-height:72vh;max-width:100%;}' +
      '}' +
      '@media(prefers-reduced-motion:reduce){' +
        '.story-splash{transition:none;}' +
      '}' +
      '</style>' +
      '<img class="splash-art" alt="">' +
      '<div class="splash-error" hidden>' +
        'تعذّر تحميل صورة الغلاف. يمكنك بدء الحكاية.' +
      '</div>' +
      '<button type="button" class="splash-start">ابدأ الحكاية ←</button>';

    document.body.appendChild(splash);

    var splashArt = splash.querySelector('.splash-art');
    var splashError = splash.querySelector('.splash-error');
    var startButton = splash.querySelector('.splash-start');
    var previousOverflow = document.body.style.overflow;

    splashArt.alt = altText;
    splashArt.src = splashImage;

    splashArt.addEventListener('error', function () {
      splashArt.hidden = true;
      splashError.hidden = false;
    });

    document.body.style.overflow = 'hidden';

    function closeSplash() {
      splash.classList.add('is-closing');
      document.body.style.overflow = previousOverflow;

      window.setTimeout(function () {
        if (splash.parentNode) {
          splash.parentNode.removeChild(splash);
        }
      }, 500);
    }

    startButton.addEventListener('click', closeSplash);

    document.addEventListener('keydown', function onSplashKey(event) {
      if (event.key === 'Escape' && splash.parentNode) {
        closeSplash();
        document.removeEventListener('keydown', onSplashKey);
      }
    });

    startButton.focus();
  }

  /* 3) تكبير الصور عند الضغط عليها */
  var lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.innerHTML = '<img alt="">';
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  lightbox.setAttribute('aria-label', 'عرض الصورة بحجم كبير');
  document.body.appendChild(lightbox);

  var bigImage = lightbox.querySelector('img');

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
