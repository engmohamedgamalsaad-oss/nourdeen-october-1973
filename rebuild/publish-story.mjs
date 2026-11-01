import { validateStory } from './validate-story.mjs?v=20261031-v2-publisher-1';

const LANGUAGES = ['ar', 'en', 'fr', 'it', 'de'];
const SECTIONS = ['october', 'history', 'science', 'women', 'people', 'curriculum', 'islamic', 'readers'];
const SITE_BASE = 'https://engmohamedgamalsaad-oss.github.io/nourdeen-october-1973/';
const REPO_ROOT = new URL('../', import.meta.url);

function fail(message) { throw new Error(message); }
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach(key => { out[key] = stableValue(value[key]); });
    return out;
  }
  return value;
}
function samePackage(a, b) {
  return JSON.stringify(stableValue(a)) === JSON.stringify(stableValue(b));
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
async function fetchRepo(path, options = {}) {
  const { cacheBust, ...requestOptions } = options;
  const url = new URL(path.replace(/^\//, ''), REPO_ROOT);
  if (cacheBust) url.searchParams.set('_story', String(Date.now()));
  return await fetch(url.href, { cache: 'no-store', ...requestOptions });
}
async function readJson(path, label) {
  const response = await fetchRepo(path, { cacheBust: true });
  if (!response.ok) fail('تعذر قراءة ' + label + ' الحالية (HTTP ' + response.status + ')؛ أوقفنا التجهيز لحماية بيانات الموقع.');
  try { return await response.json(); }
  catch { fail(label + ' ليست JSON صالحة؛ لم نخصص رقمًا أو نجهز ملفات.'); }
}
async function pathExists(path) {
  const response = await fetchRepo(path, { method: 'HEAD' });
  if (response.ok) return true;
  if (response.status === 404) return false;
  fail('تعذر التحقق من المسار ' + path + ' (HTTP ' + response.status + ')؛ أوقفنا التجهيز لتجنب استبدال ملف موجود.');
}
async function nextId(index) {
  const used = new Set(index.map(x => String(x?.id ?? '').padStart(3, '0')));
  for (let n = 1; n <= 9999; n++) {
    const id = String(n).padStart(3, '0');
    if (used.has(id)) continue;
    let found = await pathExists('stories/' + id + '/index.html') ||
      await pathExists('stories/quizzes/' + id + '.json');
    for (const section of SECTIONS) {
      if (found) break;
      const root = 'stories/' + section + '/' + id + '/';
      for (const file of ['index.html', 'data.json', 'story.json', 'data.v2.json']) {
        if (await pathExists(root + file)) { found = true; break; }
      }
    }
    if (!found) return id;
  }
  fail('لم نعثر على رقم حكاية متاح بين 001 و9999.');
}
function getSavedPackage(record, draft, meta) {
  const pending = meta.pending_draft && typeof meta.pending_draft === 'object' ? meta.pending_draft : null;
  return (pending?.story_only_draft ? (pending.story_package || pending.v2_package) : null) ||
    (pending?.v2_only_draft ? pending.v2_package : null) ||
    (draft?.story_only_draft ? (draft.story_package || draft.v2_package) : null) ||
    (draft?.v2_only_draft ? draft.v2_package : null) ||
    (meta.story_only_draft ? (meta.story_package || meta.v2_package) : null) ||
    (meta.v2_only_draft ? meta.v2_package : null) ||
    (record?.story_only_draft ? (record.story_package || record.v2_package) : null) ||
    (record?.v2_only_draft ? record.v2_package : null) || null;
}
function localizedIndexEntry(story, id, root) {
  const ar = story.i18n.ar;
  const person = ar.figure_name || ar.person || ar.title;
  const i18n = {};
  for (const lang of LANGUAGES) {
    const t = story.i18n[lang];
    i18n[lang] = {
      name: t.student_name || t.narrator_name || '',
      grade: t.grade || t.narrator_grade || '',
      className: t.grade || t.narrator_grade || '',
      title: t.title,
      subtitle: t.subtitle,
      person: t.figure_name || t.person || t.title
    };
  }
  return {
    name: ar.student_name || ar.narrator_name || 'خالدون عبر التاريخ',
    grade: ar.grade || ar.narrator_grade || '',
    className: ar.grade || ar.narrator_grade || '',
    title: ar.title,
    subtitle: ar.subtitle,
    person,
    color: story.design.accent,
    order: Number(id),
    published: true,
    i18n,
    id,
    section: story.section,
    path: root
  };
}
function makeReaderHtml(story, id, coverUrl) {
  const ar = story.i18n.ar;
  const section = story.section;
  let html = '<!doctype html>\n' +
    '<html lang="ar" dir="rtl">\n<head>\n<meta charset="utf-8">' +
    '<script>try{var d=document.documentElement,t=localStorage.getItem("kh-theme")||(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");d.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","dark")}</script>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<script src="../../../assets/shared/home-language-only.js?v=20261030-v2-language-fix"></script>\n' +
    '<meta name="description" content="' + esc(ar.summary) + '">\n' +
    '<title>' + esc(ar.title) + ' | خالدون عبر التاريخ</title>\n' +
    '<meta property="og:type" content="article"><meta property="og:title" content="' + esc(ar.title) + '">' +
    '<meta property="og:description" content="' + esc(ar.summary) + '"><meta property="og:image" content="' + esc(coverUrl) + '">\n' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Marhey:wght@500;700&display=swap" rel="stylesheet">\n' +
    '<link rel="stylesheet" href="../../../rebuild/reader-base.css?v=20261101-story-reader-1">\n</head>\n' +
    '<body data-story-slug="' + id + '" data-design="' + esc(story.design.variant) + '" data-section="' + section + '" data-start-only data-gallery="unplaced">\n' +
    '<header><div class="bar"><div class="brand" id="site-brand">خالدون عبر التاريخ</div><nav class="langs" aria-label="Language">' +
    '<button data-lang="ar" aria-pressed="true">العربية</button><button data-lang="en" aria-pressed="false">English</button><button data-lang="fr" aria-pressed="false">Français</button><button data-lang="it" aria-pressed="false">Italiano</button><button data-lang="de" aria-pressed="false">Deutsch</button>' +
    '</nav><button type="button" id="theme-toggle" aria-pressed="false">الوضع الفاتح</button></div></header>\n' +
    '<div id="story-intro-modal" class="story-intro-modal" hidden role="dialog" aria-modal="true" aria-labelledby="intro-title">' +
    '<div class="intro-card"><button id="intro-close" class="intro-close" type="button" aria-label="Close introduction">×</button>' +
    '<div class="intro-art"><img id="intro-cover" alt=""><div id="intro-cover-fallback" class="kh-image-fallback" hidden></div></div>' +
    '<div class="intro-copy"><p class="intro-kicker" id="intro-kicker">خالدون عبر التاريخ</p><h2 id="intro-title">ابدأ الحكاية</h2><p id="intro-subtitle"></p><p id="intro-summary"></p><button id="intro-start" class="start-story-btn" type="button">ابدأ الحكاية ←</button></div></div></div>\n' +
    '<main><div id="status" class="status">جاري تحميل حزمة الحكاية الموحدة…</div><article id="story" hidden>' +
    '<section class="hero"><div class="kicker" id="section-name"></div><h1 id="title"></h1><p class="subtitle" id="subtitle"></p><p class="summary" id="summary"></p><div id="cover"></div><p id="student" class="kicker"></p>' +
    '<div class="story-actions" id="story-actions" aria-label="Story actions"><button type="button" id="print-story">🖨️ طباعة / حفظ PDF</button><a id="share-whatsapp" target="_blank" rel="noopener noreferrer">واتساب</a><a id="share-facebook" target="_blank" rel="noopener noreferrer">فيسبوك</a><button type="button" id="share-copy">🔗 نسخ الرابط</button></div></section>' +
    '<section class="section"><h2 id="story-heading">الحكاية</h2><div id="blocks"></div></section>' +
    '<section class="section" id="gallery-section"><h2 id="gallery-heading">صور الحكاية</h2><div id="gallery"></div></section>' +
    '<section class="section" id="map-section" hidden><h2 id="map-heading">مكان الحكاية</h2><p id="map-place"></p><p><a id="map-link" target="_blank" rel="noopener noreferrer">افتح الموقع على الخريطة</a></p></section>' +
    '<section class="section" id="quiz-section"><h2 id="quiz-heading">اختبر فهمك</h2><div id="quiz"></div></section>' +
    '<section class="section reactions-section" id="reactions-section"><div class="reactions-wrap"><p class="kicker" id="reaction-kicker">رأيك يهمنا</p><h2 class="reactions-title" id="reaction-heading">ما رأيك في الحكاية؟</h2><p class="reactions-intro" id="reaction-intro">اختَر الانطباع الذي يناسبك بعد القراءة.</p>' +
    '<div class="reaction-like-row"><button class="reaction-btn reaction-like" id="reaction-like" type="button" aria-pressed="false"><span class="reaction-label" id="like-label">❤️ أعجبتني</span><span class="reaction-count" data-reaction-count="like">0</span></button></div>' +
    '<div class="reaction-options" role="group" id="reaction-options" aria-label="اختار رد فعلك على الحكاية"><button class="reaction-btn reaction-choice" type="button" data-reaction-choice="loved" aria-pressed="false"><span data-reaction-label="loved">حكاية ومجهود مميز</span><span class="reaction-count" data-reaction-count="loved">0</span></button><button class="reaction-btn reaction-choice" type="button" data-reaction-choice="unknown_before" aria-pressed="false"><span data-reaction-label="unknown_before">حكاية لم أكن أعرفها من قبل</span><span class="reaction-count" data-reaction-count="unknown_before">0</span></button><button class="reaction-btn reaction-choice" type="button" data-reaction-choice="inspiring" aria-pressed="false"><span data-reaction-label="inspiring">حكاية ملهمة</span><span class="reaction-count" data-reaction-count="inspiring">0</span></button><button class="reaction-btn reaction-choice" type="button" data-reaction-choice="more_stories" aria-pressed="false"><span data-reaction-label="more_stories">أحب أقرأ حكايات تانية</span><span class="reaction-count" data-reaction-count="more_stories">0</span></button></div>' +
    '<p class="reaction-status" id="reaction-status" role="status" aria-live="polite"></p><span class="reaction-count-line" id="reaction-limit">يمكن تسجيل إعجاب واحد ورد فعل واحد لكل حكاية من المتصفح نفسه.</span></div></section>' +
    '<section class="section sources"><h2 id="sources-heading">المصادر والتحقق</h2><ol id="sources"></ol><p id="history-note"></p></section></article></main>\n' +
    '<div id="image-lightbox" class="image-lightbox" hidden role="dialog" aria-modal="true" aria-label="عرض الصورة المكبرة"><button type="button" id="lightbox-close" aria-label="إغلاق الصورة">×</button><img id="lightbox-image" alt=""><p id="lightbox-caption"></p></div>\n' +
    '<script src="../../../rebuild/reader.js?v=20261101-story-reader-1" data-kh-story-reader data-story-path="story.json"></script>' +
    '<script src="../../../khaledoon/assets/khaledoon-story-map-link.js?v=20261030-map-link-1"></script></body></html>\n';
  return html;
}
function quizBank(story, id) {
  return {
    id,
    title: story.i18n.ar.figure_name || story.i18n.ar.person || story.i18n.ar.title,
    questions: story.quiz.map(q => {
      const ar = q.i18n.ar;
      const i18n = {};
      for (const lang of ['en', 'fr', 'it', 'de']) {
        const t = q.i18n[lang];
        i18n[lang] = { q: t.question, o: [...t.options], e: t.explanation };
      }
      return { q: ar.question, o: [...ar.options], a: q.correct_option, e: ar.explanation, i18n };
    })
  };
}
function localizedPlaces(story) {
  if (story.map_location === null) return null;
  const map = story.map_location;
  if (!map || typeof map !== 'object') fail('map_location يجب أن يكون كائن موقع موثق أو null صراحةً.');
  if (!map.source_name || typeof map.source_name !== 'object' || !/^https:\/\//i.test(String(map.source_url || ''))) fail('لا يمكن نشر علامة الخريطة دون اسم مصدر مترجم للغات الخمس ورابط HTTPS للمصدر.');
  return {
    lat: map.lat,
    lng: map.lng,
    place: map.place,
    ...(map.place_label ? { place_label: map.place_label } : {}),
    ...(map.approximate === true ? { approximate: true } : {}),
    source_name: map.source_name,
    source_url: map.source_url
  };
}
async function checkLocalImages(story) {
  for (const image of [story.cover, ...(story.images || [])]) {
    if (!image?.path) continue;
    const path = String(image.path);
    if (!/^(assets\/images|images|stories)\/[^\s"'<>]+$/.test(path) || path.split('/').some(x => x === '.' || x === '..')) fail('مسار صورة غير آمن: ' + path);
    const response = await fetchRepo(path, { method: 'HEAD' });
    if (!response.ok) fail('ملف الصورة المحلي غير موجود أو غير قابل للوصول (' + response.status + '): ' + path);
  }
}
export async function buildStoryFiles(story, options = {}) {
  story = JSON.parse(JSON.stringify(story));
  if (story.format === 'KHALEDOON_STORY_V2') story.format = 'KHALEDOON_STORY';
  const meta = options.storyMeta && typeof options.storyMeta === 'object' ? options.storyMeta : {};
  const savedPackageRaw = getSavedPackage(options.record, options.draft, meta);
  const savedPackage = savedPackageRaw ? JSON.parse(JSON.stringify(savedPackageRaw)) : null;
  if (savedPackage?.format === 'KHALEDOON_STORY_V2') savedPackage.format = 'KHALEDOON_STORY';
  if (!savedPackage || !samePackage(savedPackage, story)) fail('حزمة الحكاية التي ستُنشر لا تطابق النسخة المحفوظة في سجل الإدارة؛ أوقفنا النشر لحماية المحتوى المعتمد.');
  const problems = validateStory(story);
  if (problems.length) fail('حزمة القالب الموحد غير مكتملة:\n• ' + problems.join('\n• '));
  if (!Object.hasOwn(story, 'map_location')) fail('أضف map_location صراحةً: موقع موثق أو null إذا لم يتوفر موقع موثوق.');
  await checkLocalImages(story);
  const index = await readJson('stories/index.json', 'فهرس الحكايات');
  if (!Array.isArray(index)) fail('فهرس الحكايات ليس مصفوفة صالحة.');
  const places = await readJson('stories/places.json', 'ملف الخريطة');
  if (!places || typeof places !== 'object' || Array.isArray(places)) fail('ملف الخريطة ليس كائنًا صالحًا.');
  const review = meta.preview_review && typeof meta.preview_review === 'object' ? meta.preview_review : {};
  const previousPath = String(review.static_story_path || '').split('/').filter(Boolean).join('/');
  const previousId = String(review.static_story_id || '');
  let id = '';
  if (previousPath) {
    const match = previousPath.match(/^stories\/([a-z0-9-]+)\/([0-9]{3})$/);
    if (!match || match[1] !== story.section) fail('تغيير قسم حكاية منشورة يحتاج مسار نقل منفصلًا؛ أوقفنا العملية لحماية الرابط القديم.');
    id = match[2];
    if (previousId && previousId.padStart(3, '0') !== id) fail('رقم الحكاية المحفوظ لا يطابق مسارها السابق.');
  } else if (previousId) {
    id = previousId.padStart(3, '0');
    const existing = index.find(x => String(x.id || '').padStart(3, '0') === id);
    if (existing && existing.section !== story.section) fail('رقم الحكاية مرتبط بقسم آخر؛ لم نغيّر القسم أو الرابط.');
  } else {
    id = await nextId(index);
  }
  const root = 'stories/' + story.section + '/' + id + '/';
  const existingAt = index.findIndex(x => String(x.id || '').padStart(3, '0') === id);
  if (existingAt >= 0) {
    const current = index[existingAt];
    if (current.section !== story.section) fail('رقم الحكاية مستخدم في قسم آخر.');
    const currentPath = String(current.path || '').split('/').filter(Boolean).join('/');
    if (currentPath && currentPath !== root.replace(/\/$/, '')) fail('مسار الحكاية في الفهرس لا يطابق المسار المحفوظ.');
  } else if (await pathExists(root + 'index.html')) {
    fail('صفحة بهذا الرقم موجودة خارج الفهرس؛ لم نستبدلها.');
  }
  const entry = localizedIndexEntry(story, id, root);
  const duplicate = index.find(x => String(x.id || '').padStart(3, '0') !== id &&
    String(x.title || '').trim().toLocaleLowerCase() === entry.title.trim().toLocaleLowerCase() &&
    String(x.person || '').trim().toLocaleLowerCase() === entry.person.trim().toLocaleLowerCase());
  if (duplicate) fail('توجد حكاية منشورة بالعنوان والشخصية نفسيهما (ID ' + duplicate.id + ')؛ أوقفنا إنشاء نسخة مكررة.');
  if (existingAt >= 0) index[existingAt] = entry; else index.push(entry);
  const mapPlace = localizedPlaces(story);
  if (mapPlace === null) places[id] = null; else places[id] = mapPlace;
  const coverLocator = story.cover.url || story.cover.path;
  const coverUrl = /^https:\/\//i.test(coverLocator) ? coverLocator : new URL(coverLocator, REPO_ROOT).href;
  const data = {
    name: entry.name, grade: entry.grade, className: entry.className,
    title: entry.title, subtitle: entry.subtitle, person: entry.person,
    color: entry.color, order: entry.order, published: true,
    i18n: entry.i18n, id, section: story.section, path: root,
    cover: coverLocator
  };
  const sourceMarkdown = '# مصادر الحكاية: ' + story.i18n.ar.title + '\n\n' +
    story.sources.map(s => '- [' + (s.i18n?.ar?.title || s.title) + '](' + s.url + ') — ' + (s.i18n?.ar?.organization || s.organization)).join('\n') + '\n';
  const files = [
    { path: root + 'index.html', content: makeReaderHtml(story, id, coverUrl) },
    { path: root + 'story.json', content: JSON.stringify(story, null, 2) + '\n' },
    { path: root + 'data.json', content: JSON.stringify(data, null, 2) + '\n' },
    { path: root + 'sources.md', content: sourceMarkdown },
    { path: root + 'original.md', content: '# النص الأصلي كما وصل دون تعديل\n\n' + story.original_body + '\n' },
    { path: 'stories/quizzes/' + id + '.json', content: JSON.stringify(quizBank(story, id), null, 2) + '\n' },
    { path: 'stories/index.json', content: JSON.stringify(index, null, 2) + '\n' },
    { path: 'stories/places.json', content: JSON.stringify(places, null, 2) + '\n' }
  ];
  return { id, section: story.section, path: root, files, format: story.format };
}
window.KHStoryPublisher = { buildFiles: buildStoryFiles };
