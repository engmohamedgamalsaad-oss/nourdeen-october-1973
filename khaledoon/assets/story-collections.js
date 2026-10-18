/* Khaledoon story collection renderer.
   Story metadata is authored once in each stories/<section>/<id>/data.json.
   stories/index.json is generated from those files; collection pages never duplicate story cards. */
(function () {
  'use strict';
  var box = document.querySelector('[data-story-collection]');
  var sectionId = document.body.getAttribute('data-story-section') || (box && box.getAttribute('data-story-collection'));
  if (!sectionId) return;

  var lang = 'ar';
  try { lang = (localStorage.getItem('kh-lang') || localStorage.getItem('lang') || document.documentElement.lang || 'ar').toLowerCase(); } catch (_) {}
  if (['ar','en','fr','it','de'].indexOf(lang) < 0) lang = 'ar';

  var labels = {
    ar: { read: 'اقرأ الحكاية ←', empty: 'لا توجد حكايات منشورة في هذا القسم حتى الآن.', error: 'تعذر تحميل الحكايات الآن. حاول تحديث الصفحة.' },
    en: { read: 'Read the story →', empty: 'No published stories in this section yet.', error: 'Stories could not be loaded. Please refresh the page.' },
    fr: { read: 'Lire l’histoire →', empty: 'Aucune histoire publiée dans cette section pour le moment.', error: 'Impossible de charger les histoires. Actualisez la page.' },
    it: { read: 'Leggi la storia →', empty: 'Non ci sono ancora storie pubblicate in questa sezione.', error: 'Impossibile caricare le storie. Aggiorna la pagina.' },
    de: { read: 'Geschichte lesen →', empty: 'In diesem Bereich gibt es noch keine veröffentlichten Geschichten.', error: 'Die Geschichten konnten nicht geladen werden. Bitte aktualisiere die Seite.' }
  };
  var ui = labels[lang] || labels.ar;
  var root = '../../';

  function node(tag, className, value) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined) el.textContent = value;
    return el;
  }
  function localized(item, key) {
    var translation = item && item.i18n && item.i18n[lang];
    return (translation && translation[key]) || (item && item[key]) || '';
  }
  function validPath(path) {
    return typeof path === 'string' && /^stories\/[a-z0-9-]+\/[0-9]{3}\/\/?$/.test(path);
  }
  function renderCard(story) {
    var path = validPath(story.path) ? story.path : ('stories/' + story.section + '/' + story.id + '/');
    if (!validPath(path)) return null;
    var card = node('a', 'card story-index-card');
    card.href = root + path;
    card.style.setProperty('--story-color', /^#[0-9a-f]{6}$/i.test(story.color || '') ? story.color : '#b8874b');

    var cover = node('img', 'story-index-cover');
    cover.alt = localized(story, 'title') || ui.read;
    cover.loading = 'lazy';
    cover.decoding = 'async';
    var candidates = [root + path + 'cover.svg', root + path + 'cover.jpg', root + path + 'cover.webp', root + path + 'cover-popup.svg', root + path + 'cover-popup.jpg', root + path + 'cover-popup.webp'];
    var candidateIndex = 0;
    cover.onerror = function () {
      candidateIndex += 1;
      if (candidateIndex < candidates.length) cover.src = candidates[candidateIndex];
      else cover.remove();
    };
    cover.src = candidates[candidateIndex];
    card.appendChild(cover);

    var number = node('div', 'num', story.id || '');
    card.appendChild(number);
    var content = node('div', 'story-index-copy');
    content.appendChild(node('h3', '', localized(story, 'title') || ui.read));
    var subtitle = localized(story, 'subtitle');
    if (subtitle) content.appendChild(node('p', '', subtitle));
    content.appendChild(node('span', '', ui.read));
    card.appendChild(content);
    return card;
  }
  function setSectionTitle(section) {
    if (!section) return;
    var title = localized(section, 'title');
    var h1 = document.querySelector('.hero h1');
    if (h1 && title) h1.textContent = title;
    if (title) document.title = title + (lang === 'ar' ? ' | خالدون عبر التاريخ' : ' | Khaledoon Through History');
  }

  fetch(root + 'stories/sections.json', { cache: 'no-cache' })
    .then(function (response) { if (!response.ok) throw new Error('sections'); return response.json(); })
    .then(function (config) {
      var sections = Array.isArray(config.sections) ? config.sections : [];
      setSectionTitle(sections.find(function (item) { return item.id === sectionId; }));
      if (!box) return null;
      return fetch(root + 'stories/index.json', { cache: 'no-cache' })
        .then(function (response) { if (!response.ok) throw new Error('index'); return response.json(); })
        .then(function (stories) {
          var list = (Array.isArray(stories) ? stories : [])
            .filter(function (story) { return story && story.published !== false && story.section === sectionId; })
            .sort(function (a, b) { return (Number(a.order) || 9999) - (Number(b.order) || 9999); });
          box.replaceChildren();
          if (!list.length) {
            box.appendChild(node('div', 'empty story-index-empty', ui.empty));
            return;
          }
          list.forEach(function (story) {
            var card = renderCard(story);
            if (card) box.appendChild(card);
          });
          if (!box.children.length) box.appendChild(node('div', 'empty story-index-empty', ui.empty));
          if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            var cards = box.querySelectorAll('.card');
            cards.forEach(function (card) { card.classList.add('reveal'); });
            var observer = new IntersectionObserver(function (entries) {
              entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                  entry.target.classList.add('in');
                  observer.unobserve(entry.target);
                }
              });
            }, { threshold: 0.1 });
            cards.forEach(function (card) { observer.observe(card); });
          }
        });
    })
    .catch(function () {
      if (box) box.replaceChildren(node('div', 'empty story-index-empty', ui.error));
    });
})();
