#!/usr/bin/env node
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { validateStory, validateLocalImagePaths } from './validate-story.mjs';

const fail = message => { console.error(message); process.exitCode = 1; };
const [inputFile, storyId] = process.argv.slice(2);
if (!inputFile || !storyId) {
  console.error('Usage: node rebuild/build-story.mjs <v2-story.json> <three-digit-story-id>');
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
const problems = [
  ...validateStory(story),
  ...await validateLocalImagePaths(story, root)
];
if (problems.length) {
  console.error('V2 package rejected (' + problems.length + ' problems):\\n- ' + problems.join('\\n- '));
  process.exit(1);
}
const outDir = path.join(root, 'stories', story.section, storyId);
for (const file of ['index.html', 'data.v2.json']) {
  try { await access(path.join(outDir, file)); console.error('Refusing to overwrite existing ' + path.relative(root, path.join(outDir, file))); process.exit(1); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const ar = story.i18n.ar;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const page = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">

<title>${escape(ar.title)} | خالدون عبر التاريخ</title>
<meta name="description" content="${escape(ar.summary)}">
<meta property="og:type" content="article"><meta property="og:title" content="${escape(ar.title)}"><meta property="og:description" content="${escape(ar.summary)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Marhey:wght@500;700&display=swap" rel="stylesheet">
<style>:root{--accent:${story.design.accent};--bg:#08161c;--panel:#10252d;--line:#31505a;--text:#f6f0e4;--muted:#bdc9c8}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.9 Cairo,Arial,sans-serif}header{position:sticky;top:0;z-index:5;background:#08161cf2;border-bottom:1px solid var(--line)}.bar{max-width:1000px;margin:auto;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.brand{font:700 1.15rem Marhey,Cairo,sans-serif;color:var(--accent)}.langs{display:flex;gap:6px;flex-wrap:wrap}button{font:inherit;cursor:pointer;border:1px solid var(--line);border-radius:999px;background:#10252d;color:var(--text);padding:6px 12px}button[aria-pressed=true]{background:var(--accent);color:#19160e;border-color:var(--accent);font-weight:800}main{max-width:900px;margin:24px auto;padding:0 16px 60px}.hero,.section{border:1px solid var(--line);border-radius:18px;background:var(--panel);overflow:hidden;margin-bottom:16px}.hero{padding:clamp(20px,5vw,44px);background:radial-gradient(ellipse at top,var(--accent)22,transparent 65%),var(--panel)}.kicker{color:var(--accent);font-size:.9rem;font-weight:800}.hero h1{font:800 clamp(1.8rem,5vw,3rem)/1.4 Marhey,Cairo,sans-serif;margin:8px 0}.subtitle{font-size:1.15rem;color:var(--muted);margin:0}.section{padding:clamp(16px,4vw,28px);scroll-margin-top:100px}h2{color:var(--accent);font:700 1.35rem Marhey,Cairo,sans-serif;margin:0 0 12px}.block{padding:14px 16px;margin:12px 0;border:1px solid var(--line);border-radius:14px;background:#0b1d24}.block[data-speaker=karma]{border-inline-start:4px solid var(--accent);background:#152b31}.speaker{font-weight:800;color:var(--accent);margin-bottom:5px}.block p{margin:0;white-space:pre-wrap}figure{margin:16px 0}figure img{display:block;width:100%;max-height:520px;object-fit:contain;background:#071116;border-radius:12px}figcaption{font-size:.9rem;color:var(--muted);padding:6px 2px}.sources a{color:#f1cc82;overflow-wrap:anywhere}.sources li{margin:8px 0}.q{padding:14px 0;border-bottom:1px solid var(--line)}.options{display:grid;gap:8px;margin:10px 0}.options button{border-radius:10px;text-align:start}.options button.correct{border-color:#7ec99c;background:#163c30}.options button.wrong{border-color:#df8d83;background:#3b2424}.explain{color:var(--muted);margin:8px 0}.status{padding:14px;border:1px solid #956c36;border-radius:12px;background:#332a1b;white-space:pre-wrap}body[data-theme=light]{--bg:#f5f0e6;--panel:#fffdf7;--line:#d5c8b1;--text:#27241f;--muted:#61594e}body[data-theme=light] header{background:#fffdf7f2}body[data-theme=light] .block{background:#f5f0e6}body[data-theme=light] .block[data-speaker=karma]{background:#f4e9cf}body[data-theme=light] figure img{background:#e8e0d2}body[data-theme=light] button{background:#fffdf7;color:#27241f}body[data-theme=light] button[aria-pressed=true]{background:var(--accent);color:#19160e}body[data-theme=light] .sources a{color:#79551d}body[data-design=ancient-civilization]{--bg:#21180f;--panel:#342519;--line:#705336}body[data-design=science-lab]{--bg:#081a24;--panel:#102d3b;--line:#28566a}body[data-design=women-leadership]{--bg:#211521;--panel:#342337;--line:#69465f}body[data-design=arts-culture]{--bg:#191923;--panel:#292a3b;--line:#555577}body[data-design=islamic-heritage]{--bg:#0b201a;--panel:#14372b;--line:#356a53}body[data-design=curriculum]{--bg:#101d2c;--panel:#1a2d43;--line:#3c5d7e}body[data-design=reader-story]{--bg:#1e1b16;--panel:#302b22;--line:#635440}body[data-design=portrait-biography]{--bg:#171d20;--panel:#263136;--line:#4a6068}[hidden]{display:none!important}</style>
</head><body data-story-slug="${storyId}" data-design="${story.design.variant}">
<header><div class="bar"><div class="brand">خالدون عبر التاريخ</div><nav class="langs" aria-label="Language"><button data-lang="ar" aria-pressed="true">العربية</button><button data-lang="en" aria-pressed="false">English</button><button data-lang="fr" aria-pressed="false">Français</button><button data-lang="it" aria-pressed="false">Italiano</button><button data-lang="de" aria-pressed="false">Deutsch</button></nav><button type="button" id="theme-toggle" aria-pressed="false">الوضع الفاتح</button></div></header>
<main><div id="status" class="status">جاري تحميل حزمة الحكاية الموحدة…</div><article id="story" hidden>
<section class="hero"><div class="kicker" id="section-name"></div><h1 id="title"></h1><p class="subtitle" id="subtitle"></p><p id="summary"></p><div id="cover"></div><div class="start-row"><button type="button" id="start-story" class="primary start-button">ابدأ الحكاية</button></div><p id="student" class="kicker"></p></section>
<section class="section"><h2 id="story-heading">الحكاية</h2><div id="blocks"></div></section>
<section class="section" id="gallery-section"><h2 id="gallery-heading">صور الحكاية</h2><div id="gallery"></div></section>
<section class="section" id="map-section" hidden><h2 id="map-heading">مكان الحكاية</h2><p id="map-place"></p><p><a id="map-link" target="_blank" rel="noopener noreferrer">افتح الموقع على الخريطة</a></p></section>
<section class="section"><h2 id="quiz-heading">اختبر فهمك</h2><div id="quiz"></div></section>
<section class="section sources"><h2 id="sources-heading">المصادر والتحقق</h2><ol id="sources"></ol><p id="history-note"></p></section>
</article></main>
<script src="../../../rebuild/reader.js?v=20261028-v2-reader-3" data-kh-v2-reader data-story-path="data.v2.json"></script>
</body></html>`;
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'data.v2.json'), JSON.stringify(story, null, 2) + '\n', { flag: 'wx' });
await writeFile(path.join(outDir, 'index.html'), page, { flag: 'wx' });
console.log('Built V2 story page: ' + path.relative(root, path.join(outDir, 'index.html')));
console.log('Package: ' + path.relative(root, path.join(outDir, 'data.v2.json')));
console.log('Not published: add the page to the review branch, run checks, and review before merge.');
