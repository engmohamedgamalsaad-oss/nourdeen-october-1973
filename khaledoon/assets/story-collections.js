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

  function buildSectionGallery(entries) {
    if (!entries || !entries.length) return;
    var labelsByLang = {
      ar: { title: 'صور من حكايات القسم', region: 'معرض صور حكايات هذا القسم' },
      en: { title: 'Stories in pictures', region: 'Image gallery for this section' },
      fr: { title: 'Les récits en images', region: 'Galerie d’images de cette rubrique' },
      it: { title: 'Le storie in immagini', region: 'Galleria immagini di questa sezione' },
      de: { title: 'Geschichten in Bildern', region: 'Bildergalerie dieses Bereichs' }
    };
    var copy = labelsByLang[lang] || labelsByLang.ar;
    var section = node('section', 'kh-section-gallery');
    section.setAttribute('aria-label', copy.region);
    var shell = node('div', 'kh-section-gallery-shell');
    var heading = node('div', 'kh-section-gallery-heading');
    heading.appendChild(node('span', 'kh-section-gallery-kicker', 'KHALEDOON • STORIES'));
    heading.appendChild(node('h2', '', copy.title));
    var viewport = node('div', 'kh-section-gallery-viewport');
    viewport.setAttribute('role', 'region');
    viewport.setAttribute('aria-label', copy.region);
    viewport.setAttribute('tabindex', '0');
    var track = node('div', 'kh-section-gallery-track');
    var firstGroup = node('div', 'kh-section-gallery-group');
    var count = 0;
    function attachCoverFallback(target, paths) {
      var candidateIndex = 0;
      target.onerror = function () {
        candidateIndex += 1;
        if (candidateIndex < paths.length) target.src = paths[candidateIndex];
        else { var item = target.closest('.kh-section-gallery-item'); if (item) item.remove(); }
      };
      target.src = paths[0];
    }
    /* صور مرتبطة بالحكايات: صور من صفحات الحكايات نفسها، حتى لو لم تكن صورة الغلاف.
       تظل صورة الغلاف بديلًا تلقائيًا لأي حكاية لا تتوفر لها صور إضافية. */
    var STORY_GALLERY_PHOTOS = {
      '001': ['stories/october/001/Egyptian_soldiers_raising_flag.webp','stories/october/001/bab-el-mandeb-map.webp','stories/october/001/bab-el-mandeb-satellite.jpg','stories/october/001/nabil-01.jpg'],
      '002': ['stories/october/002/Crossing_the_Bar_Lev_Line,_October_War.jpg'],
      '003': ['stories/october/003/cover.jpg'],
      '004': ['stories/october/004/Atef_El_Sadat.jpg'],
      '005': ['assets/images/stories/Portrait_of_Avicenna.jpg'],
      '006': ['assets/images/stories/Portrait_of_Ahmed_Orabi.jpg'],
      '007': ['assets/images/stories/500px-Ahmed_Zewail__2010.jpg'],
      '008': ['assets/images/stories/Tawfiq_al-Hakim.jpg','assets/images/stories/img-f9fc402a87.jpg'],
      '009': ['assets/images/stories/Naguib_Mahfouz_HR.jpg','assets/images/stories/Naguib_Mahfouz_in_1960s.jpg','assets/images/stories/Naguib_Mahfouz_in_cafe.jpg'],
      '010': ['assets/images/stories/SameeraMoussa.jpg','assets/images/stories/img-45f23418d6.jpg'],
      '011': ['assets/images/stories/Mosque_of_Amr_ibn_al-As__8591305436.jpg','assets/images/stories/Mosque_of_Amr_Interior.jpg','assets/images/stories/Mosque_of_Amr_ibn_al-As_-_Cairo.jpg'],
      '012': ['assets/images/stories/s76-20263_large.jpg','assets/images/stories/s69-38669.jpg'],
      '013': ['assets/images/stories/500px-The_Female_Pharaoh_Hatshepsut_MET_DT534.jpg','assets/images/stories/Thebes__Luxor__Egypt__Panoramic_view_of_Deir_el-Bahari__Temple_of_Hatshepsut.jpg','assets/images/stories/DT534.jpg'],
      '015': ['assets/images/stories/M_Yacoub.jpg']
    };
    entries.forEach(function (entry, index) {
      var source = entry.card && entry.card.querySelector('img.story-index-cover');
      if (!source || !source.getAttribute('src')) return;
      var story = entry.story;
      var path = validPath(story.path) ? story.path : ('stories/' + story.section + '/' + story.id + '/');
      if (!validPath(path)) return;
      var candidates = [];
      try { candidates = JSON.parse(source.getAttribute('data-cover-candidates') || '[]'); } catch (_) {}
      if (!Array.isArray(candidates) || !candidates.length) candidates = [source.currentSrc || source.src];
      var related = STORY_GALLERY_PHOTOS[String(story.id || '')] || [];
      var gallerySources = related.map(function (photo) { return root + photo; });
      if (!gallerySources.length) gallerySources = [candidates[0]];
      gallerySources.slice(0, 4).forEach(function (photoUrl, photoIndex) {
        var item = node('div', 'kh-section-gallery-item');
        item.setAttribute('role', 'img');
        item.setAttribute('aria-label', localized(story, 'title') || localized(story, 'person') || ui.read);
        var image = node('img', '');
        image.alt = (localized(story, 'title') || localized(story, 'person') || '') + (gallerySources.length > 1 ? ' — ' + (photoIndex + 1) : '');
        /* A moving gallery must not defer off-screen cards: the next duplicated group
           enters the viewport continuously, so lazy loading can leave blank frames. */
        image.loading = 'eager';
        image.setAttribute('fetchpriority', index < 2 ? 'high' : 'low');
        image.decoding = 'async';
        var imageCandidates = photoIndex === 0 ? [photoUrl].concat(candidates) : [photoUrl, candidates[0]];
        image.setAttribute('data-cover-candidates', JSON.stringify(imageCandidates));
        attachCoverFallback(image, imageCandidates);
        var caption = node('span', 'kh-section-gallery-caption');
        caption.appendChild(node('strong', '', localized(story, 'title') || localized(story, 'person') || story.id));
        var person = localized(story, 'person');
        if (person && person !== localized(story, 'title')) caption.appendChild(node('small', '', person));
        item.append(image, caption);
        firstGroup.appendChild(item);
        count += 1;
      });
    });
    /* صور نساء أخريات من القسم، مستقلة عن حكاية حتشبسوت وبعناوينها الصحيحة. */
    if (sectionId === 'women') {
      [
        { src: 'assets/images/stories/250px-Nefertiti_Bust.png', title: 'الملكة نفرتيتي', alt: 'رأس تمثال الملكة نفرتيتي من مجموعة متحف برلين المصري' },
        { src: 'assets/images/stories/500px-Retrato_femenino__26771127162.jpg', title: 'كليوباترا السابعة', alt: 'لوحة جدارية رومانية يُحتمل أنها تمثل كليوباترا السابعة' }
      ].forEach(function (photo) {
        var item = node('div', 'kh-section-gallery-item');
        item.setAttribute('role', 'img');
        item.setAttribute('aria-label', photo.title);
        var image = node('img', '');
        image.alt = photo.alt;
        /* Keep standalone gallery images eager too; they may move into view before
           the browser's lazy-load threshold is recalculated. */
        image.loading = 'eager';
        image.setAttribute('fetchpriority', 'low');
        image.decoding = 'async';
        var photoCandidates = [root + photo.src];
        image.setAttribute('data-cover-candidates', JSON.stringify(photoCandidates));
        attachCoverFallback(image, photoCandidates);
        var caption = node('span', 'kh-section-gallery-caption');
        caption.appendChild(node('strong', '', photo.title));
        item.append(image, caption);
        firstGroup.appendChild(item);
        count += 1;
      });
    }
    if (!count) return;
    track.appendChild(firstGroup);
    if (count > 1) {
      var secondGroup = firstGroup.cloneNode(true);
      secondGroup.setAttribute('aria-hidden', 'true');
      secondGroup.querySelectorAll('a').forEach(function (link) { link.tabIndex = -1; });
      /* cloneNode does not copy JavaScript event handlers: restore image fallback
         on the duplicated, initially visible half of the moving gallery. */
      secondGroup.querySelectorAll('img').forEach(function (image) {
        var paths = [];
        try { paths = JSON.parse(image.getAttribute('data-cover-candidates') || '[]'); } catch (_) {}
        if (Array.isArray(paths) && paths.length) attachCoverFallback(image, paths);
      });
      track.appendChild(secondGroup);
      track.classList.add('is-moving');
    } else {
      track.classList.add('is-static');
    }
    viewport.appendChild(track);
    shell.append(heading, viewport);
    section.appendChild(shell);
    var hero = document.querySelector('.hero, .hero-home');
    if (hero && hero.parentNode) hero.parentNode.insertBefore(section, hero);
    else if (box && box.parentNode) box.parentNode.insertBefore(section, box);
  }
  /* GitHub Pages project root: keep collection assets anchored under the repository site path. */
  var root = '/nourdeen-october-1973/';
  /* غلاف البطاقة = صورة حقيقية موثقة (مسارها من جذر الموقع، وكلها في assets/images/stories وموثقة في MANIFEST.md).
     الصورة هي الأساس، والـSVG احتياطي لو فشل تحميلها. مكان مؤقت واحد؛ الجزء 7 ينقل الحقل إلى data.json لكل حكاية.
     011 (عمرو بن العاص): لا توجد صورة موثقة للشخصية، فنستخدم صورة المكان (جامع عمرو بن العاص) حسب الاتفاق.
     013 (حتشبسوت) و012 (فاروق الباز): لم تُضف بعد. */
  var COVER_PHOTOS = {
    'stories/october/003': 'stories/october/003/cover.jpg',
    'stories/science/015': 'assets/images/stories/M_Yacoub.jpg',
    'stories/science/007': 'assets/images/stories/500px-Ahmed_Zewail__2010.jpg',
    'stories/women/010': 'assets/images/stories/SameeraMoussa.jpg',
    'stories/islamic/011': 'assets/images/stories/Mosque_of_Amr_ibn_al-As__8591305436.jpg'
  };
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
      ? [root + 'assets/images/stories/Tawfiq_al-Hakim.jpg', root + path + 'cover.svg', root + path + 'cover.jpg', root + path + 'cover.webp', root + path + 'cover-popup.svg', root + path + 'cover-popup.jpg', root + path + 'cover-popup.webp']
      : isNaguibMahfouzCard
        ? (String(story.id || '') === '009' ? [root + 'assets/images/stories/Naguib_Mahfouz_HR.jpg', root + 'assets/images/stories/Naguib_Mahfouz_in_cafe.jpg'] : [root + 'assets/images/stories/Naguib_Mahfouz_in_cafe.jpg', root + 'assets/images/stories/Naguib_Mahfouz_HR.jpg']).concat([root + path + 'cover.svg', root + path + 'cover.jpg', root + path + 'cover.webp', root + path + 'cover-popup.svg', root + path + 'cover-popup.jpg', root + path + 'cover-popup.webp'])
        : (String(story.id || '') === '013' && /^stories\/women\/013\/?$/.test(path) ? [root + 'assets/images/stories/500px-The_Female_Pharaoh_Hatshepsut_MET_DT534.jpg', root + 'assets/images/stories/DT534.jpg', root + path + 'cover.svg', root + path + 'cover.jpg', root + path + 'cover.webp'] : (['011', '012'].indexOf(String(story.id || '')) >= 0 ? [root + path + 'cover-popup.svg', root + path + 'cover.svg', root + path + 'cover.jpg', root + path + 'cover.webp'] : [root + path + 'cover.svg', root + path + 'cover.jpg', root + path + 'cover.webp', root + path + 'cover-popup.svg', root + path + 'cover-popup.jpg', root + path + 'cover-popup.webp']));
    var coverData = story.cover && typeof story.cover === 'object' ? story.cover : null;
    var coverUrl = coverData ? String(coverData.url || coverData.path || '').trim() : '';
    if (coverUrl) {
      var resolvedCoverUrl = /^https:\/\//i.test(coverUrl) ? coverUrl
        : (/^(?:assets\/images\/|images\/|stories\/)/i.test(coverUrl) ? root + coverUrl.replace(/^\/+/, '') : root + path + coverUrl);
      candidates = [resolvedCoverUrl].concat(candidates);
      var coverI18n = coverData.i18n && coverData.i18n[lang];
      cover.alt = (coverI18n && coverI18n.alt) || coverData.alt || localized(story, 'title') || ui.read;
    }
    var coverPhoto = COVER_PHOTOS[path.replace(/\/+$/, '')];
    if (coverPhoto && !coverUrl) candidates = [root + coverPhoto].concat(candidates);
    cover.setAttribute('data-cover-candidates', JSON.stringify(candidates));
    var candidateIndex = 0;
    cover.onerror = function () {
      candidateIndex += 1;
      if (candidateIndex < candidates.length) cover.src = candidates[candidateIndex];
      else { cover.onerror = null; var fallback = node('div', 'story-index-cover story-index-cover-fallback', localized(story, 'title') || ui.read); cover.replaceWith(fallback); }
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
      return Promise.all([
        fetch(root + 'stories/index.json', { cache: 'no-cache' }).then(function (response) { if (!response.ok) throw new Error('index'); return response.json(); }),
        loadHiddenIds()
      ]).then(function (data) {
          var stories = data[0], hiddenIds = data[1] || [];
          var list = (Array.isArray(stories) ? stories : [])
            .filter(function (story) { return story && story.published !== false && story.section === sectionId && hiddenIds.indexOf(String(story.id)) < 0; })
            .sort(function (a, b) { return (Number(a.order) || 9999) - (Number(b.order) || 9999); });
          if (!box) {
            var standaloneGalleryEntries = list.map(function (story) {
              return { story: story, card: renderCard(story) };
            }).filter(function (entry) { return !!entry.card; });
            buildSectionGallery(standaloneGalleryEntries);
            return;
          }
          box.replaceChildren();
          if (!list.length) {
            box.appendChild(node('div', 'empty story-index-empty', ui.empty));
            return;
          }
          var galleryEntries = [];
          list.forEach(function (story) {
            var card = renderCard(story);
            if (card) {
              box.appendChild(card);
              galleryEntries.push({ story: story, card: card });
            }
          });
          buildSectionGallery(galleryEntries);
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
