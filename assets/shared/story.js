(function () {
'use strict';

/* =========================================
حركة محتوى القصة مع التمرير
========================================= */

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

/* إلغاء تأثير الحركة القديم على الحاويات */
document.querySelectorAll('.reveal').forEach(function (el) {
el.classList.add('show');
});

var targets = document.querySelectorAll(selectors.join(','));

targets.forEach(function (el, index) {
el.classList.add('scroll-reveal');
el.style.transitionDelay = (index % 3) * 50 + 'ms';
});

/* إظهار العناصر عند النزول وإخفاؤها عند الرجوع */
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

/* =========================================
حركة خلفية الغلاف مع تمرير الصفحة فقط
========================================= */

var hero = document.querySelector('.hero');
var heroPhoto = document.querySelector('.hero-photo');
var heroContent = document.querySelector('.hero-content');

var scrollFramePending = false;

function updateHeroOnScroll() {
scrollFramePending = false;

if (!hero || !heroPhoto || !heroContent) {
  return;
}

var scrollY = Math.max(0, window.scrollY || 0);
var heroHeight = hero.offsetHeight || window.innerHeight;
var progress = Math.min(scrollY, heroHeight);

/* الخلفية تتحرك بمقدار أقل من حركة الصفحة */
heroPhoto.style.transform =
  'translate3d(0,' + (-progress * 0.12) + 'px,0) scale(1.06)';

/* العنوان يتحرك بهدوء مع التمرير */
heroContent.style.transform =
  'translate3d(0,' + (-progress * 0.045) + 'px,0)';

}

function requestHeroUpdate() {
if (scrollFramePending) {
return;
}

scrollFramePending = true;
window.requestAnimationFrame(updateHeroOnScroll);

}

window.addEventListener('scroll', requestHeroUpdate, {
passive: true
});

window.addEventListener('resize', requestHeroUpdate);

updateHeroOnScroll();

/* =========================================
تكبير الصور عند الضغط عليها
========================================= */

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