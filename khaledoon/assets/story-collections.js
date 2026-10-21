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
  var API = 'https://ypwprddkscnfblhftkeb.supabase.co';
  var ANON = 'sb_publishable_JJnVwx8HQAJNxSok32L-qg_83fXk5Qn';
  function loadHiddenIds() {
    if (!window.__khHiddenP) {
      window.__khHiddenP = fetch(API + '/rest/v1/story_visibility?select=story_id', {
        headers: { apikey: ANON, Authorization: 'Bearer ' + ANON },
        cache: 'no-store'
      }).then(function (r) {
        return r.ok ? r.json() : [];
      }).then(function (rows) {
        return Array.isArray(rows) ? rows.map(function (x) { return String(x.story_id); }) : [];
      }).catch(function () { return []; });
    }
    return window.__khHiddenP;
  }

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
    var isTawfiqHakimCard = String(story.id || '') === '008' && /^stories\/people\/008\/?$/.test(path);
    var isNaguibMahfouzCard = ['009', '012'].indexOf(String(story.id || '')) >= 0 && /^stories\/people\/(009|012)\/?$/.test(path);
    var candidates = isTawfiqHakimCard
      ? ['https://commons.wikimedia.org/wiki/Special:FilePath/Tawfiq_al-Hakim.jpg', root + path + 'cover.svg', root + path + 'cover.jpg', root + path + 'cover.webp', root + path + 'cover-popup.svg', root + path + 'cover-popup.jpg', root + path + 'cover-popup.webp']
      : isNaguibMahfouzCard
        ? (String(story.id || '') === '009' ? ['https://commons.wikimedia.org/wiki/Special:FilePath/Naguib_Mahfouz_HR.jpg', 'https://commons.wikimedia.org/wiki/Special:FilePath/Naguib_Mahfouz_in_cafe.jpg'] : ['https://commons.wikimedia.org/wiki/Special:FilePath/Naguib_Mahfouz_in_cafe.jpg', 'https://commons.wikimedia.org/wiki/Special:FilePath/Naguib_Mahfouz_HR.jpg']).concat([root + path + 'cover.svg', root + path + 'cover.jpg', root + path + 'cover.webp', root + path + 'cover-popup.svg', root + path + 'cover-popup.jpg', root + path + 'cover-popup.webp'])
        : [root + path + 'cover.svg', root + path + 'cover.jpg', root + path + 'cover.webp', root + path + 'cover-popup.svg', root + path + 'cover-popup.jpg', root + path + 'cover-popup.webp'];
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
    if (['008', '009'].indexOf(String(story.id || '')) >= 0 && /^stories\/people\/(008|009)\/?$/.test(path)) {
      var person = localized(story, 'person');
      if (person) content.appendChild(node('span', 'story-index-person', person));
    }
    content.appendChild(node('h3', '', localized(story, 'title') || ui.read));
    var subtitle = localized(story, 'subtitle');
    if (subtitle) content.appendChild(node('p', '', subtitle));
    content.appendChild(node('span', '', ui.read));
    card.appendChild(content);
    return card;
  }
  function applyCentralSectionConfig() {
    fetch(API + '/rest/v1/khaledoon_admin_config?config_key=eq.sections&select=config_value&limit=1', {
      headers: { apikey: ANON, Authorization: 'Bearer ' + ANON }, cache: 'no-store'
    }).then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) {
      var value = rows && rows[0] && rows[0].config_value;
      if (!value || !value.data || !Array.isArray(value.data.sections)) return;
      var section = value.data.sections.find(function (item) { return item && item.id === sectionId; });
      if (section) setSectionTitle(section);
      var color = value.colors && value.colors[sectionId];
      function validColor(v) { return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v); }
      if (color && validColor(color.outer) && validColor(color.inner)) {
        document.documentElement.style.setProperty('--kh-section-outer', color.outer);
        document.documentElement.style.setProperty('--kh-section-inner', color.inner);
        var style = document.getElementById('khCentralSectionStyle');
        if (!style) {
          style = document.createElement('style');
          style.id = 'khCentralSectionStyle';
          style.textContent = '.story-index-card{border-color:var(--kh-section-outer)}.story-index-empty{border-color:var(--kh-section-outer)}.hero .eyebrow{color:var(--kh-section-outer)}';
          document.head.appendChild(style);
        }
      }
    }).catch(function () {});
  }

  function setSectionTitle(section) {
    if (!section) return;
    var title = localized(section, 'title');
    var h1 = document.querySelector('.hero h1');
    if (h1 && title) h1.textContent = title;
    if (title) document.title = title + (lang === 'ar' ? ' | خالدون عبر التاريخ' : ' | Khaledoon Through History');
  }

  applyCentralSectionConfig();

  fetch(root + 'stories/sections.json', { cache: 'no-cache' })
    .then(function (response) { if (!response.ok) throw new Error('sections'); return response.json(); })
    .then(function (config) {
      var sections = Array.isArray(config.sections) ? config.sections : [];
      setSectionTitle(sections.find(function (item) { return item.id === sectionId; }));
      if (!box) return null;
      return Promise.all([
        fetch(root + 'stories/index.json', { cache: 'no-cache' }).then(function (response) { if (!response.ok) throw new Error('index'); return response.json(); }),
        loadHiddenIds()
      ]).then(function (data) {
          var stories = data[0], hiddenIds = data[1] || [];
          var list = (Array.isArray(stories) ? stories : [])
            .filter(function (story) { return story && story.published !== false && story.section === sectionId && hiddenIds.indexOf(String(story.id)) < 0; })
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
