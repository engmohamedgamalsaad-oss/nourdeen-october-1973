'use strict';
/* Real-browser regression for the shared five-language flow across all pages (Playwright + Chromium).
   Run from the repository root:   node scripts/e2e-language-flow.cjs [--out report.json]

   Needs Playwright with a Chromium build. CI installs Playwright and Chromium on pull requests; local runs can use an existing
   Playwright installation.

   External requests (fonts, Supabase, CDNs) are blocked on purpose, so this test cannot say anything
   about reactions/likes (Supabase), web fonts, or the live deployment.

   Two parts:
   1. FLOW  - per language x viewport: homepage choose -> section -> story -> reload -> other story ->
              back -> home -> direct open in a new tab -> a conflicting ?lang= override.
   2. SWEEP - every visitor page x language x viewport loaded directly with a saved language.

   HARD failures (exit code 1): wrong html lang/dir, missing/broken five-language switcher on the October section,
   a broken language-switch action, ?lang= left in the URL, a same-origin 404 / failed request, a page error.
   WARNINGS (reported, do not fail): horizontal overflow, body direction differing from <html>,
   a high share of Arabic text on a non-Arabic page (= untranslated fallback). */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const LANGS = ['ar', 'en', 'fr', 'it', 'de'];
const HOME_BUTTON = { ar: 0, en: 1, fr: 2, it: 3, de: 4 };
const ADMIN = new Set(['admin.html', 'admin-all.html', 'khaledoon/admin.html']);
const out = (() => { const i = process.argv.indexOf('--out'); return i > 0 ? process.argv[i + 1] : ''; })();
const screenshotDir = path.join(ROOT, 'language-audit-screenshots');
fs.mkdirSync(screenshotDir, { recursive: true });

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_MODULE_PATH, '/opt/npm-tools/node_modules', '/home/claude/.npm-global/lib/node_modules', path.join(ROOT, 'node_modules')].filter(Boolean);
  for (const p of tries) { try { return require(require.resolve('playwright', { paths: [p] })); } catch (e) { /* next */ } }
  throw new Error('Playwright not found. Set PLAYWRIGHT_MODULE_PATH to a node_modules folder that contains it.');
}
const { chromium, devices } = loadPlaywright();

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };
/* The site is published under /nourdeen-october-1973/ (GitHub Pages project path) and some pages
   hard-code that prefix, so the test serves the repository under the same prefix. */
const PREFIX = '/nourdeen-october-1973';
function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        if (p !== PREFIX && !p.startsWith(PREFIX + '/')) { res.writeHead(404).end('outside prefix'); return; }
        p = p.slice(PREFIX.length) || '/';
        let file = path.normalize(path.join(ROOT, p));
        if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
        if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
        if (!fs.existsSync(file)) { res.writeHead(404).end('not found'); return; }
        res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
      } catch (e) { res.writeHead(500).end(); }
    }).listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}`, base: `http://127.0.0.1:${server.address().port}${PREFIX}` }));
  });
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) walk(rel, acc); else acc.push(rel);
  }
  return acc;
}
function visitorPages() {
  return walk('').filter((f) => f.endsWith('.html') && f !== 'index.html' && !ADMIN.has(f)).filter((f) => {
    const h = fs.readFileSync(path.join(ROOT, f), 'utf8');
    return !/<meta[^>]+http-equiv=["']refresh["']/i.test(h); /* skip pure redirect stubs */
  }).sort();
}

const expectedDir = (l) => (l === 'ar' ? 'rtl' : 'ltr');
const PRINT_RE = /طباع|اطبع|print|imprim|stamp|druck/i;

const INSPECT = () => {
  const root = document.documentElement;
  const sel = '.lang-switch,.language-switch,.langs,[data-lang-switch],[data-lang],[data-l],.lang-option,.language-selector,.lang-selector';
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const text = document.body ? (document.body.innerText || '') : '';
  const arabic = (text.match(/[؀-ۿ]/g) || []).length;
  const latin = (text.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  return {
    url: location.href, title: document.title, lang: root.lang, dir: root.dir,
    bodyDir: document.body ? getComputedStyle(document.body).direction : '',
    switchers: [...document.querySelectorAll(sel)].filter(visible).map((e) => (e.className && String(e.className)) || e.tagName),
    overflow: Math.round(root.scrollWidth - innerWidth),
    arabic, latin,
    stored: (() => { try { return localStorage.getItem('kh-lang'); } catch (e) { return 'ERR'; } })()
  };
};


/* Measure only after the document finished loading AND the shared language script ran
   (it is a parser-blocking script in <head>). If it never defines KH_LANG the page is reported. */
async function inspect(page) {
  await page.waitForLoadState('load');
  try { await page.waitForFunction(() => !!window.KH_LANG, null, { timeout: 8000 }); }
  catch (e) { const s = await page.evaluate(INSPECT); s.noKhLang = true; return s; }
  return page.evaluate(INSPECT);
}

/* No known same-origin resource failures are currently waived. Keep this list empty
   unless a reproducible failure is verified and explicitly documented. */
const KNOWN_RESOURCE_ISSUES = [];
function watch(page, origin, sink) {
  const rel = (u) => u.replace(origin, '');
  page.on('pageerror', (e) => sink.push({ kind: 'pageerror', msg: String(e.message || e).slice(0, 160), url: page.url() }));
  page.on('response', (r) => {
    const u = r.url();
    if (u.startsWith(origin) && r.status() >= 400) sink.push({ kind: 'http', msg: `${r.status()} ${rel(u)}`, path: rel(u), url: page.url() });
  });
  page.on('requestfailed', (r) => {
    const u = r.url();
    const err = (r.failure() && r.failure().errorText) || '';
    if (u.startsWith(origin) && !/ERR_ABORTED/.test(err)) sink.push({ kind: 'requestfailed', msg: `${rel(u)} (${err})`, path: rel(u), url: page.url() });
  });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
}
function classify(res, hard, warn, label, base) {
  for (const r of res) {
    const known = r.path && KNOWN_RESOURCE_ISSUES.find((k) => k.re.test(r.path));
    const msg = `${label}: ${r.kind} ${r.msg} (on ${r.url.replace(base, '')})`;
    if (known) warn.push(`KNOWN ${r.kind} ${r.path.split('?')[0]} - ${known.note}`); else hard.push(msg);
  }
}

async function newContext(browser, origin, viewport) {
  const ctx = await browser.newContext(viewport === 'mobile' ? { ...devices['Pixel 5'] } : { viewport: { width: 1366, height: 768 } });
  await ctx.route((u) => !String(u).startsWith(origin), (r) => r.abort());
  return ctx;
}

function judgeInner(label, s, lang, hard, warn, { requireClean = true } = {}) {
  const where = `${label} @ ${s.url.replace(/^https?:\/\/[^/]+/, '')}`;
  if (s.noKhLang) hard.push(`${where}: the shared language script never ran (KH_LANG undefined)`);
  if (s.lang !== lang) hard.push(`${where}: html lang=${s.lang}, expected ${lang}`);
  if (s.dir !== expectedDir(lang)) hard.push(`${where}: html dir=${s.dir}, expected ${expectedDir(lang)}`);
  if (requireClean && /[?&]lang=/.test(s.url)) hard.push(`${where}: ?lang= left in URL`);
  if (s.overflow > 1) warn.push(`${where}: horizontal overflow ${s.overflow}px`);
  if (s.bodyDir && s.bodyDir !== s.dir) warn.push(`${where}: body direction ${s.bodyDir} differs from html dir ${s.dir}`);
  if (lang !== 'ar') {
    const total = s.arabic + s.latin;
    if (total > 0 && s.arabic / total > 0.15) warn.push(`${where}: ${(100 * s.arabic / total).toFixed(0)}% of visible letters are Arabic on a ${lang} page (untranslated fallback)`);
  }
}

async function flow(browser, base, origin, lang, viewport) {
  const hard = [], warn = [], steps = [], res = [];
  const label = `FLOW ${lang}/${viewport}`;
  const ctx = await newContext(browser, origin, viewport);
  const page = await ctx.newPage();
  watch(page, origin, res);
  const step = (name, ok, detail = '') => { steps.push({ name, ok, detail }); if (!ok) hard.push(`${label}: step "${name}" failed ${detail}`); };
  try {
    /* 1. homepage + choose */
    await page.goto(base + '/', { waitUntil: 'load' });
    const btn = page.locator(`.langs button[data-l="${HOME_BUTTON[lang]}"]`);
    const chooserVisible = await btn.isVisible().catch(() => false);
    step('homepage chooser visible', chooserVisible, `(${viewport})`);
    if (chooserVisible) { await btn.click(); await page.waitForTimeout(400); }
    let s = await inspect(page);
    step('homepage applies chosen language', s.lang === lang && s.dir === expectedDir(lang) && (lang === 'ar' ? true : s.stored === lang), `lang=${s.lang} dir=${s.dir} stored=${s.stored}`);
    const pressed = await page.locator(`.langs button[data-l="${HOME_BUTTON[lang]}"]`).getAttribute('aria-pressed').catch(() => null);
    step('homepage marks chosen button pressed', pressed === 'true', `aria-pressed=${pressed}`);
    if (lang === 'ar') await page.screenshot({ path: path.join(screenshotDir, `home-${viewport}.png`), animations: 'disabled' });
    const homeOptions = await page.locator('.langs button[data-l]').count();
    step('homepage offers exactly the supported languages (ar/en/fr/it/de)', homeOptions === LANGS.length, `count=${homeOptions}`);

    /* 2. section */
    const sectionLink = page.locator('.gate[href="khaledoon/collections/october.html"]').first();
    try { await sectionLink.scrollIntoViewIfNeeded(); await Promise.all([page.waitForURL(/collections\/october\.html/, { timeout: 8000 }), sectionLink.click({ timeout: 5000 })]); }
    catch (e) { await page.goto(base + '/khaledoon/collections/october.html', { waitUntil: 'load' }); warn.push(`${label}: section link not clickable from the homepage, opened directly`); }
    await page.waitForTimeout(300);
    s = await inspect(page); judgeInner(label + ' section', s, lang, hard, warn);
    step('section keeps language', s.lang === lang, `lang=${s.lang}`);
    const sectionOptions = await page.locator('.lang-option').count();
    step('section exposes all five language options', sectionOptions === LANGS.length, `count=${sectionOptions}`);
    if (sectionOptions === LANGS.length) {
      const labels = { ar: 'العربية', en: 'English', fr: 'Français', it: 'Italiano', de: 'Deutsch' };
      const alternate = LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length];
      await page.locator('.lang-option').filter({ hasText: labels[alternate] }).click();
      await page.waitForFunction((expected) => document.documentElement.lang === expected, alternate, { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(250);
      let switched = await inspect(page);
      step('section language switcher changes language and saves it', switched.lang === alternate && switched.stored === alternate && !/[?&]lang=/.test(switched.url), `lang=${switched.lang} stored=${switched.stored}`);
      await page.locator('.lang-option').filter({ hasText: labels[lang] }).click();
      await page.waitForFunction((expected) => document.documentElement.lang === expected, lang, { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(250);
      s = await inspect(page);
      step('section language can be restored without losing navigation', s.lang === lang && !/[?&]lang=/.test(s.url), `lang=${s.lang}`);
    }
    if (lang === 'ar') await page.screenshot({ path: path.join(screenshotDir, `october-${viewport}.png`), animations: 'disabled' });

    /* 3. story from the section */
    const storyLink = page.locator('a[href*="stories/october/001/"]').first();
    try { await storyLink.scrollIntoViewIfNeeded(); await Promise.all([page.waitForURL(/stories\/october\/001/, { timeout: 8000 }), storyLink.click({ timeout: 5000 })]); }
    catch (e) { await page.goto(base + '/stories/october/001/', { waitUntil: 'load' }); warn.push(`${label}: story link not clickable from the section, opened directly`); }
    await page.waitForLoadState('load'); await page.waitForTimeout(500);
    s = await inspect(page); judgeInner(label + ' story001', s, lang, hard, warn);
    step('story opened from section keeps language', s.lang === lang, `lang=${s.lang}`);
    if (lang === 'ar') await page.screenshot({ path: path.join(screenshotDir, `story001-${viewport}.png`), animations: 'disabled' });

    /* share + print controls */
    const share = await page.evaluate(() => {
      const links = [...document.querySelectorAll('a[href]')].map((a) => a.href);
      return { wa: links.find((h) => h.startsWith('https://wa.me/')) || '', fb: links.find((h) => h.startsWith('https://www.facebook.com/sharer/')) || '' };
    });
    step('story has WhatsApp + Facebook share links', !!share.wa && !!share.fb);
    if (share.wa || share.fb) step('share links do not carry ?lang=', !/lang%3D|lang=/.test(decodeURIComponent(share.wa + share.fb).replace(/[?&]text=/, '')), '');
    const printCount = await page.evaluate((src) => {
      const re = new RegExp(src, 'i');
      return [...document.querySelectorAll('button,a')].filter((e) => re.test(e.textContent || '') && e.getClientRects().length).length;
    }, PRINT_RE.source);
    step('print control present on story001', printCount > 0, `count=${printCount}`);
    const reactionUi = await page.evaluate(() => ({
      like: !!document.querySelector('#reaction-like'),
      choices: document.querySelectorAll('[data-reaction-choice]').length,
      counts: document.querySelectorAll('[data-reaction-count]').length
    }));
    step('story has like and reaction controls', reactionUi.like && reactionUi.choices > 0 && reactionUi.counts > 0, JSON.stringify(reactionUi));

    /* 4. reload */
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(400);
    s = await inspect(page); judgeInner(label + ' story001 reload', s, lang, hard, warn);
    step('reload keeps language', s.lang === lang, `lang=${s.lang}`);

    /* 5. another story */
    await page.goto(base + '/stories/october/002/', { waitUntil: 'load' }); await page.waitForTimeout(400);
    s = await inspect(page); judgeInner(label + ' story002', s, lang, hard, warn);
    step('other story keeps language', s.lang === lang, `lang=${s.lang}`);

    /* 6. back to section, then home */
    await page.goBack({ waitUntil: 'load' }).catch(() => {}); await page.waitForTimeout(200);
    await page.goBack({ waitUntil: 'load' }).catch(() => {}); await page.waitForTimeout(300);
    s = await inspect(page);
    step('back to the section keeps language', s.lang === lang, `url=${s.url.replace(base, '')} lang=${s.lang}`);
    await page.goto(base + '/', { waitUntil: 'load' }); await page.waitForTimeout(500);
    s = await inspect(page);
    const pressedAfter = await page.locator(`.langs button[data-l="${HOME_BUTTON[lang]}"]`).getAttribute('aria-pressed').catch(() => null);
    step('home remembers the choice after the round trip', s.lang === lang && pressedAfter === 'true', `lang=${s.lang} pressed=${pressedAfter}`);

    /* 7. direct open in a new tab of the same browser */
    const tab = await ctx.newPage(); watch(tab, origin, res);
    await tab.goto(base + '/stories/october/003/', { waitUntil: 'load' }); await tab.waitForTimeout(400);
    s = await inspect(tab); judgeInner(label + ' direct story003', s, lang, hard, warn);
    step('direct link in a new tab keeps language', s.lang === lang, `lang=${s.lang}`);

    /* 8. conflicting ?lang= override must be ignored and removed */
    const other = LANGS.find((l) => l !== lang);
    await tab.goto(`${base}/stories/october/003/?lang=${other}&x=1#top`, { waitUntil: 'load' }); await tab.waitForTimeout(400);
    s = await inspect(tab);
    step(`?lang=${other} override ignored and removed (x=1 and #top kept)`, s.lang === lang && !/[?&]lang=/.test(s.url) && /x=1/.test(s.url) && /#top$/.test(s.url), `lang=${s.lang} url=${s.url.replace(base, '')}`);
    await tab.goto(`${base}/stories/october/003/?lang=es`, { waitUntil: 'load' }); await tab.waitForTimeout(300);
    s = await inspect(tab);
    step('?lang=es (unsupported) is ignored and removed', s.lang === lang && !/[?&]lang=/.test(s.url), `lang=${s.lang}`);
  } catch (e) { hard.push(`${label}: crashed - ${String(e.message).split('\n')[0]}`); }
  finally { await ctx.close(); }
  classify(res, hard, warn, label, base);
  return { label, steps, hard, warn };
}

async function sweep(browser, base, origin, lang, viewport, pages) {
  const hard = [], warn = [], res = [];
  const label = `SWEEP ${lang}/${viewport}`;
  const ctx = await newContext(browser, origin, viewport);
  const page = await ctx.newPage();
  watch(page, origin, res);
  /* seed the saved language as the homepage would have */
  await page.goto(base + '/assets/shared/home-language-only.js');
  await page.evaluate((l) => localStorage.setItem('kh-lang', l), lang);
  const rows = [];
  for (const rel of pages) {
    const before = res.length;
    try {
      await page.goto(`${base}/${rel}`, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(350);
      const s = await inspect(page);
      judgeInner(`${label} ${rel}`, s, lang, hard, warn);
      rows.push({ rel, lang: s.lang, dir: s.dir, overflow: s.overflow, arabicShare: s.arabic + s.latin ? +(s.arabic / (s.arabic + s.latin)).toFixed(2) : 0 });
    } catch (e) { hard.push(`${label} ${rel}: could not load - ${String(e.message).split('\n')[0]}`); }
    classify(res.slice(before), hard, warn, `${label} ${rel}`, base);
  }
  await ctx.close();
  return { label, rows, hard, warn };
}

(async () => {
  const { server, origin, base } = await serve();
  const browser = await chromium.launch({ headless: true });
  const pages = visitorPages();
  const results = { generated: new Date().toISOString(), pages: pages.length, flow: [], sweep: [] };
  try {
    for (const viewport of ['desktop', 'mobile']) {
      results.flow.push(...await Promise.all(LANGS.map((l) => flow(browser, base, origin, l, viewport))));
      results.sweep.push(...await Promise.all(LANGS.map((l) => sweep(browser, base, origin, l, viewport, pages))));
    }
  } finally { await browser.close(); server.close(); }

  const dedupe = (a) => [...new Set(a)];
  const hard = dedupe([...results.flow, ...results.sweep].flatMap((r) => r.hard));
  const warn = dedupe([...results.flow, ...results.sweep].flatMap((r) => r.warn));
  results.summary = { hard: hard.length, warnings: warn.length };
  results.hardFailures = hard; results.warnings = warn;
  if (out) fs.writeFileSync(out, JSON.stringify(results, null, 1));

  const stepCount = results.flow.reduce((n, r) => n + r.steps.length, 0);
  const stepOk = results.flow.reduce((n, r) => n + r.steps.filter((s) => s.ok).length, 0);
  console.log(`FLOW: ${stepOk}/${stepCount} steps passed across ${results.flow.length} language/viewport runs.`);
  console.log(`SWEEP: ${pages.length} visitor pages x ${LANGS.length} languages x 2 viewports = ${pages.length * LANGS.length * 2} loads.`);
  console.log(`HARD failures: ${hard.length}   WARNINGS: ${warn.length}`);
  hard.slice(0, 60).forEach((m) => console.log('  FAIL ' + m));
  if (hard.length > 60) console.log(`  ... ${hard.length - 60} more (see --out report)`);
  process.exitCode = hard.length ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
