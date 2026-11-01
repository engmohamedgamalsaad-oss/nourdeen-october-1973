#!/usr/bin/env node
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { validateStory, validateLocalImagePaths } from './validate-story.mjs';
import { normalizeStoryFormat } from './adapters/story-package-adapter.mjs';

const fail = message => { console.error(message); process.exitCode = 1; };
const [inputFile, storyId] = process.argv.slice(2);
if (!inputFile || !storyId) {
  console.error('Usage: node rebuild/build-story.mjs <story.json> <three-digit-story-id>');
  process.exit(2);
}
if (!/^\d{3}$/.test(storyId)) {
  console.error('Story ID must be exactly three digits, chosen after checking the current story index.');
  process.exit(2);
}
const root = process.cwd();
let story;
try { story = JSON.parse(await readFile(path.resolve(inputFile), 'utf8')); }
catch (error) { console.error('Cannot read valid JSON: ' + error.message); process.exit(2); }
story = normalizeStoryFormat(story);
const problems = [
  ...validateStory(story),
  ...await validateLocalImagePaths(story, root)
];
if (problems.length) {
  console.error('unified story package rejected (' + problems.length + ' problems):\\n- ' + problems.join('\\n- '));
  process.exit(1);
}
const outDir = path.join(root, 'stories', story.section, storyId);
for (const file of ['index.html', 'story.json']) {
  try { await access(path.join(outDir, file)); console.error('Refusing to overwrite existing ' + path.relative(root, path.join(outDir, file))); process.exit(1); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const ar = story.i18n.ar;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Shared page shell: keep identical to rebuild/publish-story.mjs (makeReaderHtml).
// Per-section colour and design differences live in reader-base.css / reader-enhance.css,
// keyed by body[data-section] and body[data-design]; never in the page itself.
const page = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><script>(function(){try{var d=document.documentElement,t=localStorage.getItem("kh-theme")||(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"),l=localStorage.getItem("kh-lang")||localStorage.getItem("lang")||"ar";d.setAttribute("data-theme",t==="light"?"light":"dark");if(["en","fr","it","de"].indexOf(l)>=0){d.lang=l;d.dir="ltr"}else{d.lang="ar";d.dir="rtl"}}catch(e){document.documentElement.setAttribute("data-theme","dark")}})();</script><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="../../../assets/shared/home-language-only.js?v=20261030-v2-language-fix"></script>
<title>${escape(ar.title)} | خالدون عبر التاريخ</title>
<meta name="description" content="${escape(ar.summary)}">
<meta property="og:type" content="article"><meta property="og:title" content="${escape(ar.title)}"><meta property="og:description" content="${escape(ar.summary)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Marhey:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../../../rebuild/reader-base.css?v=20261101-story-reader-1"><link rel="stylesheet" href="../../../rebuild/reader-enhance.css?v=20261101-story-reader-1"><style>:root{--accent:${story.design.accent}}</style>
</head><body data-story-slug="${storyId}" data-design="${story.design.variant}" data-section="${story.section}" data-start-only data-disable-story-extras><script>document.body.setAttribute("data-theme",document.documentElement.getAttribute("data-theme")||"dark");</script>
<header><div class="bar"><div class="brand" id="site-brand">خالدون عبر التاريخ</div><nav class="langs" aria-label="Language"><button data-lang="ar" aria-pressed="true">العربية</button><button data-lang="en" aria-pressed="false">English</button><button data-lang="fr" aria-pressed="false">Français</button><button data-lang="it" aria-pressed="false">Italiano</button><button data-lang="de" aria-pressed="false">Deutsch</button></nav><button type="button" id="theme-toggle" aria-pressed="false">الوضع الفاتح</button></div></header>
<div id="story-intro-modal" class="story-intro-modal" hidden role="dialog" aria-modal="true" aria-labelledby="intro-title">
<div class="intro-card"><button id="intro-close" class="intro-close" type="button" aria-label="Close introduction">×</button><div class="intro-art"><img id="intro-cover" alt=""><div id="intro-cover-fallback" class="kh-image-fallback" hidden></div></div>
<div class="intro-copy"><p class="intro-kicker" id="intro-kicker">خالدون عبر التاريخ</p><h2 id="intro-title">ابدأ الحكاية</h2><p id="intro-subtitle"></p><p id="intro-summary"></p><button id="intro-start" class="start-story-btn" type="button">ابدأ الحكاية ←</button></div></div></div>
<main><div id="status" class="status">جاري تحميل حزمة الحكاية الموحدة…</div><article id="story" hidden>
<section class="hero"><div class="kicker" id="section-name"></div><h1 id="title"></h1><p class="subtitle" id="subtitle"></p><p class="summary" id="summary"></p><div id="cover"></div><p id="student" class="kicker"></p>
<div class="story-actions" id="story-actions" aria-label="Story actions"><button type="button" id="print-story">🖨️ طباعة / حفظ PDF</button><a id="share-whatsapp" target="_blank" rel="noopener noreferrer">واتساب</a><a id="share-facebook" target="_blank" rel="noopener noreferrer">فيسبوك</a><button type="button" id="share-copy">🔗 نسخ الرابط</button></div></section>
<section class="section"><h2 id="story-heading">الحكاية</h2><div id="blocks"></div></section>
<section class="section" id="gallery-section"><h2 id="gallery-heading">صور الحكاية</h2><div id="gallery"></div></section>
<section class="section" id="map-section" hidden><h2 id="map-heading">مكان الحكاية</h2><p id="map-place"></p><p><a id="map-link" target="_blank" rel="noopener noreferrer">افتح الموقع على الخريطة</a></p></section>
<section class="section" id="quiz-section"><h2 id="quiz-heading">اختبر فهمك</h2><div id="quiz"></div></section>
<section class="section reactions-section" id="reactions-section"><div class="reactions-wrap"><p class="kicker" id="reaction-kicker">رأيك يهمنا</p><h2 class="reactions-title" id="reaction-heading">ما رأيك في الحكاية؟</h2><p class="reactions-intro" id="reaction-intro">اختَر الانطباع الذي يناسبك بعد القراءة.</p>
<div class="reaction-like-row"><button class="reaction-btn reaction-like" id="reaction-like" type="button" aria-pressed="false"><span class="reaction-label" id="like-label">❤️ أعجبتني</span><span class="reaction-count" data-reaction-count="like">0</span></button></div>
<div class="reaction-options" role="group" id="reaction-options" aria-label="اختار رد فعلك على الحكاية"><button class="reaction-btn reaction-choice" type="button" data-reaction-choice="loved" aria-pressed="false"><span data-reaction-label="loved">حكاية ومجهود مميز</span><span class="reaction-count" data-reaction-count="loved">0</span></button><button class="reaction-btn reaction-choice" type="button" data-reaction-choice="unknown_before" aria-pressed="false"><span data-reaction-label="unknown_before">حكاية لم أكن أعرفها من قبل</span><span class="reaction-count" data-reaction-count="unknown_before">0</span></button><button class="reaction-btn reaction-choice" type="button" data-reaction-choice="inspiring" aria-pressed="false"><span data-reaction-label="inspiring">حكاية ملهمة</span><span class="reaction-count" data-reaction-count="inspiring">0</span></button><button class="reaction-btn reaction-choice" type="button" data-reaction-choice="more_stories" aria-pressed="false"><span data-reaction-label="more_stories">أحب أقرأ حكايات تانية</span><span class="reaction-count" data-reaction-count="more_stories">0</span></button></div>
<p class="reaction-status" id="reaction-status" role="status" aria-live="polite"></p><span class="reaction-count-line" id="reaction-limit">يمكن تسجيل إعجاب واحد ورد فعل واحد لكل حكاية من المتصفح نفسه.</span></div></section>
<section class="section sources"><h2 id="sources-heading">المصادر والتحقق</h2><ol id="sources"></ol><p id="history-note"></p></section>
</article></main>
<div id="image-lightbox" class="image-lightbox" hidden role="dialog" aria-modal="true" aria-label="عرض الصورة المكبرة"><button type="button" id="lightbox-close" aria-label="إغلاق الصورة">×</button><img id="lightbox-image" alt=""><p id="lightbox-caption"></p></div>
<script src="../../../rebuild/reader.js?v=20261101-story-reader-1" data-kh-story-reader data-story-path="story.json"></script>
<script src="../../../khaledoon/assets/khaledoon-story-map-link.js?v=20261030-map-link-1"></script>
</body></html>`;
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'story.json'), JSON.stringify(story, null, 2) + '\n', { flag: 'wx' });
await writeFile(path.join(outDir, 'index.html'), page, { flag: 'wx' });
console.log('Built unified story page: ' + path.relative(root, path.join(outDir, 'index.html')));
console.log('Package: ' + path.relative(root, path.join(outDir, 'story.json')));
console.log('Not published: add the page to the review branch, run checks, and review before merge.');
