
(function () {
  'use strict';

  /* الغلاف: حركة مستمرة للصورة والعنوان */
  var heroContent = document.querySelector('.hero-content');
  if (heroContent) heroContent.classList.add('show');

  /* إزالة الحركة من الحاويات الكبيرة، لتتحرك العناصر منفردة */
  document.querySelectorAll('.container.reveal').forEach(function (el) {
    el.classList.remove('reveal', 'show');
  });

  /* تحديد النصوص والصور والتواريخ */
  var selectors = [
    '.story .container > .kicker',
    '.story .container > h2',
    '.story .container > p',
    '.story .container > figure',
    '.story .container > .quote',
    '.story .container > .panel',
    '.story .timeline > .event',
    '.story .two > .panel',
    '.story .lessons > .lesson',
    '.end .container > *',
    '.sources .container > *',
    'footer'
  ];

  var items = document.querySelectorAll(selectors.join(','));

  items.forEach(function (el, index) {
    el.classList.add('reveal');
    el.classList.remove('show');
    el.style.transitionDelay = (index % 3) * 80 + 'ms';
  });

  /* الدخول إلى الشاشة = ظهور، الخروج منها = اختفاء.
     وده اللي يسمح بالحركة العكسية عند الصعود. */
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('show');
        } else {
          entry.target.classList.remove('show');
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -4% 0px'
    });

    items.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    items.forEach(function (el) {
      el.classList.add('show');
    });
  }

  /* غلاف الافتتاح */
  var splashImage = document.body.getAttribute('data-splash');

  if (splashImage) {
    var splash = document.createElement('div');
    splash.className = 'story-splash';
    splash.setAttribute('role', 'dialog');
    splash.setAttribute('aria-modal', 'true');

    splash.style.cssText =
      'position:fixed;inset:0;z-index:10000;' +
      'display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;gap:22px;padding:18px;' +
      'overflow:auto;text-align:center;' +
      'background:linear-gradient(180deg,' +
      (document.body.getAttribute('data-splash-top') || '#705d4b') +
      ',' +
      (document.body.getAttribute('data-splash-bottom') || '#564132') +
      ');';

    var art = document.createElement('img');
    art.src = splashImage;
    art.alt = document.body.getAttribute('data-splash-alt') || 'غلاف الحكاية';
    art.style.cssText =
      'display:block;width:auto;height:auto;max-width:100%;' +
      'max-height:76vh;object-fit:contain;' +
      'box-shadow:0 18px 55px rgba(0,0,0,.4);';

    var error = document.createElement('p');
    error.textContent = 'تعذّر تحميل صورة الغلاف، يمكنك بدء الحكاية.';
    error.hidden = true;
    error.style.color = '#fff';

    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'ابدأ الحكاية ←';
    button.style.cssText =
      'font:700 1rem Cairo,Tahoma,sans-serif;padding:13px 30px;' +
      'border:1px solid #f0d59c;border-radius:5px;' +
      'color:#171006;background:linear-gradient(145deg,#f0d59c,#b8874b);';

    art.addEventListener('error', function () {
      art.hidden = true;
      error.hidden = false;
    });

    splash.append(art, error, button);
    document.body.appendChild(splash);

    var oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    var closed = false;

    function closeSplash() {
      if (closed) return;
      closed = true;
      splash.style.transition = 'opacity .45s ease';
      splash.style.opacity = '0';

      window.setTimeout(function () {
        splash.remove();
        document.body.style.overflow = oldOverflow;
      }, 460);
    }

    button.addEventListener('click', closeSplash);
    button.focus();
  }

  /* تكبير الصور عند الضغط عليها */
  var lightbox = document.querySelector('.lightbox');

  if (!lightbox) {
    lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = '<img alt="">';
    document.body.appendChild(lightbox);
  }

  var bigImage = lightbox.querySelector('img');

  function closeLightbox() {
    lightbox.classList.remove('open');
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;

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
    if (event.key === 'Escape') closeLightbox();
  });
})();
