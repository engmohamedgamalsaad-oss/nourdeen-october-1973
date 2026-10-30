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

  /* ===== صور من حكايات القسم =====
     معرض صور تاريخية حقيقية داخل ترويسة القسم (وبعد الغلاف في قسم أكتوبر)، وليس شريطًا متحركًا.
     صورة كل حكاية منشورة تُأخذ تلقائيًا بالترتيب:
       1) صور مختارة موثّقة لها في STORY_GALLERY_PHOTOS (تسبق كل شيء)،
       2) لو لم توجد: بحث تلقائي عن صورة الشخصية في ويكيبيديا (العربية ثم الإنجليزية) وتحميلها من ويكيميديا كومنز،
          مع قبول الصور الحرة الترخيص فقط (CC0 / CC BY / CC BY-SA / ملكية عامة) وعرض المصدر والترخيص تحت المعرض،
       3) لا تُستخدم صور الغلاف ولا رسوم SVG ولا بطاقات بديلة: حكاية لا تجد لها صورة تاريخية لا تظهر في المعرض.
     لإيقاف البحث التلقائي عن حكاية بعينها (مثلًا لو جاءت صورة غير مناسبة) ضع رقمها في AUTO_PHOTO_BLOCKLIST أو ضع صورها في STORY_GALLERY_PHOTOS.
     التنسيق في khaledoon/assets/section-photos.css ويُحمَّل من هنا تلقائيًا. */
  var MOSAIC_MAX = 5; /* أكثر من هذا العدد من الحكايات يتحول المعرض إلى صف أفقي يُسحب */
  var AUTO_PHOTO_BLOCKLIST = {}; /* مثال: { '014': true } */
  /* صور تاريخية مختارة (خفيفة الحجم، مسجلة مصادرها في assets/images/stories/MANIFEST.md أو في مجلد الحكاية). */
  var STORY_GALLERY_PHOTOS = {
    '001': ['stories/october/001/Egyptian_soldiers_raising_flag.webp','stories/october/001/bab-el-mandeb-map.webp','stories/october/001/nabil-01.jpg'],
    '002': ['stories/october/002/Crossing_the_Bar_Lev_Line,_October_War.jpg'],
    '004': ['stories/october/004/Atef_El_Sadat.jpg'],
    '005': ['assets/images/stories/Portrait_of_Avicenna.jpg'],
    '006': ['assets/images/stories/Portrait_of_Ahmed_Orabi.jpg'],
    '007': ['assets/images/stories/500px-Ahmed_Zewail__2010.jpg'],
    '008': ['assets/images/stories/Tawfiq_al-Hakim.jpg'],
    '009': ['assets/images/stories/Naguib_Mahfouz_HR.jpg','assets/images/stories/Naguib_Mahfouz_in_1960s.jpg','assets/images/stories/Naguib_Mahfouz_in_cafe.jpg'],
    '010': ['assets/images/stories/SameeraMoussa.jpg','assets/images/stories/img-45f23418d6.jpg'],
    '011': ['assets/images/stories/Mosque_of_Amr_ibn_al-As__8591305436.jpg','assets/images/stories/Mosque_of_Amr_Interior.jpg'],
    '012': ['assets/images/stories/s76-20263_large.jpg','assets/images/stories/s69-38669.jpg'],
    '013': ['assets/images/stories/500px-The_Female_Pharaoh_Hatshepsut_MET_DT534.jpg'],
    '015': ['assets/images/stories/M_Yacoub.jpg']
  };
  /* صور إضافية لقسم بعينه، ليست مرتبطة بحكاية (تظهر بلا رابط، وفقط لو عدد الحكايات لا يملأ المعرض). */
  var EXTRA_SECTION_PHOTOS = {
    women: [
      { src: 'assets/images/stories/250px-Nefertiti_Bust.png', title: 'الملكة نفرتيتي', alt: 'رأس تمثال الملكة نفرتيتي من مجموعة متحف برلين المصري' },
      { src: 'assets/images/stories/500px-Retrato_femenino__26771127162.jpg', title: 'كليوباترا السابعة', alt: 'لوحة جدارية رومانية يُحتمل أنها تمثل كليوباترا السابعة' }
    ]
  };

  function ensurePhotoStyles() {
    return new Promise(function (resolve) {
      if (document.getElementById('khSectionPhotosCss')) { resolve(); return; }
      var link = document.createElement('link');
      link.id = 'khSectionPhotosCss';
      link.rel = 'stylesheet';
      link.href = root + 'khaledoon/assets/section-photos.css?v=20261030-3';
      link.onload = link.onerror = function () { resolve(); };
      document.head.appendChild(link);
      setTimeout(resolve, 2500);
    });
  }
  function withTimeout(promise, ms, fallback) {
    return new Promise(function (resolve) {
      var timer = setTimeout(function () { resolve(fallback); }, ms);
      promise.then(function (value) { clearTimeout(timer); resolve(value); }, function () { clearTimeout(timer); resolve(fallback); });
    });
  }
  function probeImage(url) {
    return new Promise(function (resolve) {
      var probe = new Image();
      probe.onload = function () { resolve(url); };
      probe.onerror = function () { resolve(null); };
      probe.src = url;
    });
  }

  /* ---- بحث تلقائي عن صورة الشخصية في ويكيبيديا / ويكيميديا كومنز ---- */
  var FREE_LICENSE = /^(CC0|CC[ -]BY|Public domain|PD[ -]|No restrictions|Attribution)/i;
  var WIKI_CACHE_DAYS = 7;
  function wikiJson(url) {
    return fetch(url).then(function (response) { if (!response.ok) throw new Error('wiki'); return response.json(); });
  }
  function nameTokens(text) {
    return String(text || '').toLowerCase().split(/[\s\-\u2013\u2014\u060c,.()]+/).filter(function (token) { return token.length > 2; });
  }
  function plainText(html) {
    try { return (new DOMParser().parseFromString(String(html || ''), 'text/html').body.textContent || '').trim(); } catch (_) { return ''; }
  }
  function wikiLookup(host, query) {
    var url = 'https://' + host + '.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=0&gsrlimit=3&prop=pageimages&piprop=name&gsrsearch=' + encodeURIComponent(query);
    return wikiJson(url).then(function (data) {
      var pages = data && data.query && data.query.pages ? Object.keys(data.query.pages).map(function (key) { return data.query.pages[key]; }) : [];
      pages.sort(function (a, b) { return (a.index || 0) - (b.index || 0); });
      /* نأخذ أول نتيجة فقط ونتأكد أن عنوانها يطابق اسم الشخصية، حتى لا تظهر صورة شخص آخر. */
      var page = pages[0];
      if (!page || !page.pageimage) return null;
      var tokens = nameTokens(query), title = String(page.title || '').toLowerCase();
      var matches = tokens.filter(function (token) { return title.indexOf(token) >= 0; }).length;
      if (!tokens.length || matches < Math.min(2, tokens.length)) return null;
      var infoUrl = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=extmetadata%7Curl%7Cmime&iiurlwidth=640&titles=' + encodeURIComponent('File:' + page.pageimage);
      return wikiJson(infoUrl).then(function (info) {
        var pagesById = info && info.query && info.query.pages;
        var filePage = pagesById && pagesById[Object.keys(pagesById)[0]];
        var image = filePage && filePage.imageinfo && filePage.imageinfo[0];
        if (!image || !/^image\/(jpeg|png|webp)/i.test(image.mime || '')) return null;
        var meta = image.extmetadata || {};
        var license = meta.LicenseShortName && meta.LicenseShortName.value || '';
        if (!FREE_LICENSE.test(license)) return null;
        if (meta.NonFree && String(meta.NonFree.value).toLowerCase() === 'true') return null;
        var artist = plainText(meta.Artist && meta.Artist.value).slice(0, 70);
        return { src: image.thumburl || image.url, page: image.descriptionurl, license: license, artist: artist };
      });
    });
  }
  function wikiPortrait(story) {
    var key = 'kh-sp-wiki-v1:' + story.section + '/' + story.id;
    try {
      var cached = JSON.parse(localStorage.getItem(key) || 'null');
      if (cached && Date.now() - cached.t < WIKI_CACHE_DAYS * 864e5) return Promise.resolve(cached.v);
    } catch (_) {}
    var english = story.i18n && story.i18n.en && story.i18n.en.person;
    var attempts = [['ar', story.person], ['en', english]].filter(function (attempt) { return !!attempt[1]; });
    return attempts.reduce(function (chain, attempt) {
      return chain.then(function (found) { return found || wikiLookup(attempt[0], attempt[1]); });
    }, Promise.resolve(null)).then(function (result) {
      try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: result })); } catch (_) {}
      return result;
    });
  }
  function storyPhotos(entry) {
    var story = entry.story;
    var curated = (STORY_GALLERY_PHOTOS[String(story.id || '')] || []).map(function (photo) { return root + photo; });
    return Promise.all(curated.map(function (url) { return probeImage(url); })).then(function (found) {
      found = found.filter(Boolean);
      if (found.length) return found.map(function (url) { return { src: url }; });
      if (AUTO_PHOTO_BLOCKLIST[String(story.id || '')]) return [];
      return withTimeout(wikiPortrait(story), 8000, null).then(function (portrait) {
        if (!portrait || !portrait.src) return [];
        return probeImage(portrait.src).then(function (ok) { return ok ? [{ src: ok, credit: portrait }] : []; });
      });
    });
  }
  function mountPhotos(section) {
    var hero = document.querySelector('.hero, .hero-home');
    if (!hero) {
      var main = document.querySelector('main');
      section.classList.add('is-band');
      if (main && main.parentNode) main.parentNode.insertBefore(section, main);
      else document.body.insertBefore(section, document.body.firstChild);
      return;
    }
    var wrap = hero.classList.contains('hero-home') ? null : hero.querySelector('.wrap');
    if (wrap) {
      wrap.classList.add('kh-sp-host');
      wrap.appendChild(section);
    } else {
      section.classList.add('is-band');
      hero.parentNode.insertBefore(section, hero.nextSibling);
    }
  }
  function buildSectionGallery(entries) {
    if (!entries || !entries.length || document.querySelector('.kh-sp')) return;
    var copyByLang = {
      ar: 'صور من حكايات القسم',
      en: 'Stories in pictures',
      fr: 'Les récits en images',
      it: 'Le storie in immagini',
      de: 'Geschichten in Bildern'
    };
    var navByLang = {
      ar: ['السابق', 'التالي'],
      en: ['Previous', 'Next'],
      fr: ['Précédent', 'Suivant'],
      it: ['Precedente', 'Successivo'],
      de: ['Zurück', 'Weiter']
    };
    var creditsByLang = {
      ar: 'مصدر الصور: ويكيميديا كومنز —',
      en: 'Images: Wikimedia Commons —',
      fr: 'Images : Wikimedia Commons —',
      it: 'Immagini: Wikimedia Commons —',
      de: 'Bilder: Wikimedia Commons —'
    };
    var heading = copyByLang[lang] || copyByLang.ar;
    var navLabels = navByLang[lang] || navByLang.ar;
    var creditsLabel = creditsByLang[lang] || creditsByLang.ar;
    var storyEntries = entries.slice();
    var extras = EXTRA_SECTION_PHOTOS[sectionId] || [];
    Promise.all([
      ensurePhotoStyles(),
      Promise.all(storyEntries.map(function (entry) { return withTimeout(storyPhotos(entry), 14000, []); })),
      Promise.all(extras.map(function (extra) { return withTimeout(probeImage(root + extra.src), 9000, null); }))
    ]).then(function (result) {
      var photoLists = result[1], extraPhotos = result[2];
      var firsts = [], standalone = [], seconds = [];
      storyEntries.forEach(function (entry, storyIndex) {
        var story = entry.story;
        var path = validPath(story.path) ? story.path : ('stories/' + story.section + '/' + story.id + '/');
        var href = validPath(path) ? root + path : '';
        (photoLists[storyIndex] || []).slice(0, 3).forEach(function (photo, photoIndex) {
          var tile = { order: storyIndex * 10 + photoIndex, src: photo.src, credit: photo.credit, story: story, href: href };
          (photoIndex === 0 ? firsts : seconds).push(tile);
        });
      });
      extras.forEach(function (extra, index) {
        if (extraPhotos[index]) standalone.push({ order: 1000 + index, src: extraPhotos[index], title: extra.title, alt: extra.alt });
      });
      /* صورة واحدة على الأقل لكل حكاية لها صورة تاريخية؛ الصور الإضافية تملأ الفسيفساء فقط لو لم تمتلئ. */
      var scrolling = firsts.length > MOSAIC_MAX;
      var picked = scrolling ? firsts : firsts.concat(standalone, seconds).slice(0, MOSAIC_MAX);
      if (!picked.length) return;
      picked.sort(function (a, b) { return a.order - b.order; });

      var section = node('section', 'kh-sp');
      section.setAttribute('aria-labelledby', 'khSpTitle');
      var inner = node('div', 'kh-sp-inner');
      var title = node('h2', 'kh-sp-title', heading);
      title.id = 'khSpTitle';
      var grid = node('ul', 'kh-sp-grid ' + (scrolling ? 'kh-sp-scroll' : 'kh-sp-n' + picked.length));
      picked.forEach(function (tile, index) {
        var item = node('li', 'kh-sp-item');
        item.style.setProperty('--i', String(Math.min(index, 8)));
        var link = tile.href ? node('a', 'kh-sp-tile') : node('div', 'kh-sp-tile');
        if (tile.href) link.href = tile.href;
        tile.label = tile.story ? (localized(tile.story, 'title') || localized(tile.story, 'person') || '') : tile.title;
        var visual = node('img', '');
        visual.src = tile.src;
        /* الصورة المرتبطة بحكاية يصفها نص الرابط نفسه، فلا نكرر الوصف. */
        visual.alt = tile.story ? '' : (tile.alt || tile.label);
        visual.decoding = 'async';
        visual.onerror = function () { item.style.visibility = 'hidden'; };
        var caption = node('span', 'kh-sp-cap');
        caption.appendChild(node('strong', '', tile.label));
        var person = tile.story ? localized(tile.story, 'person') : '';
        if (person && person !== tile.label) caption.appendChild(node('small', '', person));
        link.append(visual, caption);
        item.appendChild(link);
        grid.appendChild(item);
      });
      inner.append(title, grid);
      if (scrolling) {
        var rtl = document.documentElement.dir === 'rtl';
        var nav = node('div', 'kh-sp-nav');
        [[-1, navLabels[0], rtl ? '›' : '‹'], [1, navLabels[1], rtl ? '‹' : '›']].forEach(function (def) {
          var button = node('button', '', def[2]);
          button.type = 'button';
          button.setAttribute('aria-label', def[1]);
          button.addEventListener('click', function () {
            var flip = getComputedStyle(grid).direction === 'rtl' ? -1 : 1;
            grid.scrollBy({ left: def[0] * flip * grid.clientWidth * 0.8, behavior: 'smooth' });
          });
          nav.appendChild(button);
        });
        inner.appendChild(nav);
      }
      /* نسبة الصور المجلوبة تلقائيًا: المصور والترخيص ورابط صفحة الملف. */
      var credited = picked.filter(function (tile) { return tile.credit && tile.credit.page; });
      if (credited.length) {
        var credits = node('p', 'kh-sp-credits');
        credits.appendChild(document.createTextNode(creditsLabel + ' '));
        credited.forEach(function (tile, index) {
          if (index) credits.appendChild(document.createTextNode(' · '));
          var detail = [tile.credit.artist, tile.credit.license].filter(Boolean).join('، ');
          var anchor = node('a', '', tile.label + (detail ? ' (' + detail + ')' : ''));
          anchor.href = tile.credit.page;
          anchor.target = '_blank';
          anchor.rel = 'noopener';
          credits.appendChild(anchor);
        });
        inner.appendChild(credits);
      }
      section.appendChild(inner);
      mountPhotos(section);
      if ('IntersectionObserver' in window) {
        var watcher = new IntersectionObserver(function (changes) {
          if (changes.some(function (change) { return change.isIntersecting; })) {
            section.classList.add('is-in');
            watcher.disconnect();
          }
        }, { threshold: 0.15 });
        watcher.observe(section);
      } else {
        section.classList.add('is-in');
      }
    });
  }
  /* GitHub Pages project root: keep collection assets anchored under the repository site path. */
  var root = '/nourdeen-october-1973/';
  /* غلاف البطاقة = صورة حقيقية موثقة (مسارها من جذر الموقع، وكلها في assets/images/stories وموثقة في MANIFEST.md).
     الصورة هي الأساس، والـSVG احتياطي لو فشل تحميلها. مكان مؤقت واحد؛ الجزء 7 ينقل الحقل إلى data.json لكل حكاية.
     011 (عمرو بن العاص): لا توجد صورة موثقة للشخصية، فنستخدم صورة المكان (جامع عمرو بن العاص) حسب الاتفاق.
     013 (حتشبسوت) و012 (فاروق الباز): لم تُضف بعد. */
  var COVER_PHOTOS = {
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
