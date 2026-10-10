(function () {
  'use strict';

  function initFeatureCarousels() {
    document.querySelectorAll('[data-feature-carousel]').forEach(function (carousel) {
      if (carousel.dataset.carouselReady === 'true') return;

      var track = carousel.querySelector('.feature-track');
      var slides = track ? Array.prototype.slice.call(track.children) : [];
      var dots = carousel.querySelector('.feature-dots');
      var prev = carousel.querySelector('.feature-prev');
      var next = carousel.querySelector('.feature-next');
      if (slides.length < 2 || !dots || !prev || !next) return;

      carousel.dataset.carouselReady = 'true';
      var index = 0;
      var timer = null;
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var labels = {
        ar: { previous: 'الشريحة السابقة', next: 'الشريحة التالية', slide: 'الشريحة', media: 'معرض الوسائط', facts: 'هل تعلم' },
        en: { previous: 'Previous slide', next: 'Next slide', slide: 'Slide', media: 'Media gallery', facts: 'Did you know?' },
        fr: { previous: 'Diapositive précédente', next: 'Diapositive suivante', slide: 'Diapositive', media: 'Galerie multimédia', facts: 'Le saviez-vous ?' },
        it: { previous: 'Diapositiva precedente', next: 'Diapositiva successiva', slide: 'Diapositiva', media: 'Galleria multimediale', facts: 'Lo sapevi?' }
      };

      function language() {
        return window.I18N ? window.I18N.lang() : 'ar';
      }

      function setLabels() {
        var words = labels[language()] || labels.ar;
        prev.setAttribute('aria-label', words.previous);
        next.setAttribute('aria-label', words.next);
        dots.setAttribute('aria-label', words.slide);
        var kind = carousel.getAttribute('data-feature-carousel');
        if (words[kind]) carousel.setAttribute('aria-label', words[kind]);
      }

      function syncDots() {
        Array.prototype.forEach.call(dots.children, function (dot, i) {
          dot.setAttribute('aria-current', i === index ? 'true' : 'false');
        });
      }

      function syncHidden() {
        slides.forEach(function (slide, i) {
          slide.setAttribute('aria-hidden', i === index ? 'false' : 'true');
        });
      }

      var transitionTimer = null;

      function show(nextIndex) {
        nextIndex = (nextIndex + slides.length) % slides.length;
        var oldIndex = index;
        if (nextIndex === oldIndex) return;

        /* Cancel any previous cleanup and clear stale transition classes first.
           This prevents multiple old cards from remaining visible during rapid navigation. */
        if (transitionTimer !== null) {
          window.clearTimeout(transitionTimer);
          transitionTimer = null;
        }
        slides.forEach(function (slide) {
          slide.classList.remove('is-leaving');
        });

        slides[oldIndex].classList.remove('is-active');
        slides[oldIndex].classList.add('is-leaving');
        index = nextIndex;
        slides[index].classList.remove('is-leaving');
        slides[index].classList.add('is-active');
        syncDots();
        syncHidden();

        var leavingSlide = slides[oldIndex];
        transitionTimer = window.setTimeout(function () {
          if (!leavingSlide.classList.contains('is-active')) {
            leavingSlide.classList.remove('is-leaving');
          }
          transitionTimer = null;
        }, 760);
      }

      function stop() {
        if (timer) {
          window.clearInterval(timer);
          timer = null;
        }
      }

      function start() {
        stop();
        if (!reduced && !document.hidden) {
          timer = window.setInterval(function () {
            show(index + 1);
          }, 9000);
        }
      }

      function restart() {
        start();
      }

      /* لا نفعّل تراكب الشرائح إلا بعد تجهيز أدوات التنقل؛ في حالة تعطل JavaScript تظل البطاقات مقروءة. */
      track.classList.add('carousel-ready');
      slides.forEach(function (slide, i) {
        slide.classList.remove('is-active', 'is-leaving');
        slide.classList.toggle('is-active', i === 0);
        slide.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');
      });

      slides.forEach(function (_, i) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'feature-dot';
        dot.setAttribute('aria-label', ((labels[language()] || labels.ar).slide) + ' ' + (i + 1));
        dot.setAttribute('aria-current', i === 0 ? 'true' : 'false');
        dot.addEventListener('click', function () {
          show(i);
          restart();
        });
        dots.appendChild(dot);
      });

      prev.addEventListener('click', function () {
        show(index - 1);
        restart();
      });
      next.addEventListener('click', function () {
        show(index + 1);
        restart();
      });
      carousel.addEventListener('mouseenter', stop);
      carousel.addEventListener('mouseleave', start);
      carousel.addEventListener('focusin', stop);
      carousel.addEventListener('focusout', function (event) {
        if (!carousel.contains(event.relatedTarget)) start();
      });
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) stop();
        else start();
      });
      document.addEventListener('site-language-change', setLabels);

      setLabels();
      start();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFeatureCarousels);
  } else {
    initFeatureCarousels();
  }
})();

/* Loads the homepage quiz call-to-action (kept in its own file). */
(function () {
  var s = document.createElement('script');
  s.src = 'assets/shared/home-extras.js?v=20261010-1';
  s.defer = true;
  document.head.appendChild(s);
})();
