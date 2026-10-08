(function () {
  var els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach(function (e) { e.classList.add('show'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('show'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    els.forEach(function (e) { io.observe(e); });
  }

  var box = document.createElement('div');
  box.className = 'lightbox';
  box.innerHTML = '<img alt="">';
  document.body.appendChild(box);
  var big = box.querySelector('img');
  function close() { box.classList.remove('open'); }
  document.addEventListener('click', function (e) {
    var img = e.target.closest('.image-frame img');
    if (img) { big.src = img.src; big.alt = img.alt; box.classList.add('open'); }
    else if (box.contains(e.target)) { close(); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();