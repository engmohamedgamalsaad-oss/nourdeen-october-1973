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
const ADMIN = new Set(['admin.html', 'admin-all.html', 'khaledoon/admin.html', 'khaledoon/preview.html', 'khaledoon/prompts-admin.html', 'khaledoon/sections-admin.html', 'khaledoon/story-builder.html', 'rebuild/reader.html', 'rebuild/package-review.html']);
const out = (() => { const i = process.argv.indexOf('--out'); return i > 0 ? process.argv[i + 1] : ''; })();
const screenshotDir = path.join(ROOT, 'language-audit-screenshots');
fs.mkdirSync(screenshotDir, { recursive: true });

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_MODULE_PATH, '/opt/npm-tools/node_modules', '/home/claude/.npm-global/lib/node_modules', path.join(ROOT, 'node_modules')].filter(Boolean);
  for (const p of tries) { try { return require(require.resolve('playwright', { paths: [p] })); } catch (e) { /* next */ } }
  throw new Error('Playwright not found. Set PLAYWRIGHT_MODULE_PATH to a node_modules folder that contains it.');
}
const { chromium, devices } = loadPlaywright();

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };
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
    arabicSamples: (() => { const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode); return nodes.filter((n) => /[\u0600-\u06FF]/.test(n.nodeValue || '') && n.parentElement && !/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|CODE|PRE)$/.test(n.parentElement.tagName) && n.nodeValue.trim()).map((n) => n.nodeValue.replace(/\s+/g, ' ').trim().slice(0, 150)).slice(0, 12); })(),
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
  /* The site intentionally uses smooth scrolling. Disable it only in automated tests so
     Playwright does not race an in-progress scroll when clicking language buttons.
     Init scripts can run before <head> exists, so wait until DOMContentLoaded. */
  await ctx.addInitScript(() => {
    const disableSmoothScroll = () => {
      if (document.documentElement) {
        document.documentElement.style.setProperty('scroll-behavior', 'auto', 'important');
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', disableSmoothScroll, { once: true });
    } else {
      disableSmoothScroll();
    }
  });
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
    if (total > 0 && s.arabic / total > 0.15) warn.push(`${where}: ${(100 * s.arabic / total).toFixed(0)}% of visible letters are Arabic on a ${lang} page (untranslated fallback); samples=${JSON.stringify(s.arabicSamples || [])}`);
  }
}

async function cinematicGlobeRegression(browser, base, origin) {
  const hard = [], checks = [];
  const label = 'CINEMATIC GLOBE';
  const check = (name, ok, detail = '') => {
    checks.push({ name, ok, detail });
    if (!ok) hard.push(label + ': ' + name + (detail ? ' — ' + detail : ''));
  };
  const titles = {
    ar: 'اكتشف العالم من خلال حكاياته',
    en: 'Explore the world through its stories',
    fr: 'Explorez le monde à travers ses récits',
    it: 'Esplora il mondo attraverso le sue storie',
    de: 'Entdecke die Welt durch ihre Geschichten'
  };
  const desktop = await newContext(browser, origin, 'desktop');
  try {
    const page = await desktop.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(base + '/', { waitUntil: 'load' });
    const globe = page.locator('#khWorld');
    await globe.waitFor({ state: 'attached', timeout: 10000 });
    await globe.scrollIntoViewIfNeeded();
    const canvas = page.locator('#khWorld .kh-world-canvas');
    await canvas.waitFor({ state: 'visible', timeout: 10000 });
    const zoomIn = page.locator('#khWorld .kh-world-zoom-button[data-world-zoom="in"]');
    const zoomOut = page.locator('#khWorld .kh-world-zoom-button[data-world-zoom="out"]');
    const zoomReset = page.locator('#khWorld .kh-world-zoom-button[data-world-zoom="reset"]');
    check('zoom controls are visible and accessible', await zoomIn.isVisible() && await zoomOut.isVisible() && await zoomReset.isVisible() &&
      !!(await zoomIn.getAttribute('aria-label')) && !!(await zoomOut.getAttribute('aria-label')), 'in/out/reset controls must be visible with accessible labels');
    check('globe starts at its default zoom', await zoomReset.isDisabled(), 'reset control should start disabled at the default scale');
    await zoomIn.click(); await zoomIn.click();
    check('zoom-in control reaches its bounded maximum', await zoomIn.isDisabled(), 'zoom-in should disable at the maximum scale');
    await zoomOut.click();
    check('zoom-out control reverses the scale', !(await zoomIn.isDisabled()), 'zoom-in should be available after zooming out');
    await canvas.dispatchEvent('wheel', { deltaY: -120, bubbles: true, cancelable: true });
    check('mouse-wheel zoom is wired to the globe', !(await zoomReset.isDisabled()), 'wheel interaction should change zoom away from the reset scale');
    await zoomReset.click();
    check('reset control returns the globe to its default scale', await zoomReset.isDisabled(), 'reset should disable at the default scale');
    await page.waitForFunction(() => !!document.querySelector('#khWorld .kh-world-list .kh-world-chip'), { timeout: 10000 });

    const data = await page.evaluate(async () => {
      const [geo, stories, places] = await Promise.all([
        fetch('khaledoon/assets/geo/natural-earth-110m.json').then(r => r.json()),
        fetch('stories/index.json').then(r => r.json()),
        fetch('stories/places.json').then(r => r.json())
      ]);
      const eligible = (Array.isArray(stories) ? stories : []).filter(s => {
        const p = places[String(s.id).padStart(3, '0')];
        return s && s.published !== false && p && Number.isFinite(Number(p.lat)) &&
          Number.isFinite(Number(p.lng)) && /^https:\/\//i.test(String(p.source_url || '')) &&
          p.source_name && ['ar','en','fr','it','de'].every(l => typeof p.source_name[l] === 'string' && p.source_name[l].trim());
      });
      return { land: geo.land && geo.land.length, borders: geo.borders && geo.borders.length,
        cities: geo.cities && geo.cities.length, eligible: eligible.length,
        listed: document.querySelectorAll('#khWorld .kh-world-list .kh-world-chip').length,
        status: document.querySelector('#khWorld .kh-world-status')?.textContent || '' };
    });
    check('real Natural Earth land, borders and cities load', data.land >= 100 && data.borders >= 100 && data.cities >= 100,
      'land=' + data.land + ', borders=' + data.borders + ', cities=' + data.cities);
    check('sourced story locations populate the globe list', data.eligible > 0 && data.listed > 0,
      'eligible=' + data.eligible + ', visible list chips=' + data.listed + ', status=' + data.status);
    const hiddenControls = await page.locator('#khWorld [hidden]').evaluateAll(nodes => nodes.map(n => getComputedStyle(n).display));
    check('hidden globe controls stay hidden', hiddenControls.every(display => display === 'none'), JSON.stringify(hiddenControls));

    const target = await page.evaluate(async () => {
      const [stories, places] = await Promise.all([
        fetch('stories/index.json').then(r => r.json()),
        fetch('stories/places.json').then(r => r.json())
      ]);
      const canvas = document.querySelector('#khWorld .kh-world-canvas');
      const rect = canvas.getBoundingClientRect(), w = rect.width, h = Math.max(250, Math.min(480, rect.height || 360));
      const r = Math.min(w * .40, h * .41), cx = w * .49, cy = h * .5, tilt = -.16;
      for (const s of stories) {
        if (!s || s.published === false) continue;
        const p = places[String(s.id).padStart(3, '0')];
        if (!p || !Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lng)) ||
            !/^https:\/\//i.test(String(p.source_url || '')) || !p.source_name ||
            !['ar','en','fr','it','de'].every(l => typeof p.source_name[l] === 'string' && p.source_name[l].trim())) continue;
        const la = Number(p.lat) * Math.PI / 180, lo = Number(p.lng) * Math.PI / 180;
        const x = Math.cos(la) * Math.sin(lo);
        const y = Math.sin(la) * Math.cos(tilt) - Math.cos(la) * Math.cos(lo) * Math.sin(tilt);
        const z = Math.sin(la) * Math.sin(tilt) + Math.cos(la) * Math.cos(lo) * Math.cos(tilt);
        if (z > .2) return { x: rect.left + cx + x * r, y: rect.top + cy - y * r, id: String(s.id), z };
      }
      return null;
    });
    check('a documented story marker is available on the visible hemisphere', !!target,
      target ? 'story=' + target.id + ', z=' + target.z.toFixed(3) : 'no visible sourced point found');
    if (target) {
      await page.mouse.click(target.x, target.y);
      const card = page.locator('#khWorld .kh-world-story-card .khm-card');
      await card.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      const cardState = await page.evaluate(() => {
        const root = document.querySelector('#khWorld .kh-world-story-card');
        const card = root && root.querySelector('.khm-card');
        const source = card && card.querySelector('.khm-source');
        const go = card && card.querySelector('.khm-go');
        return { visible: !!card && !root.hidden, name: card && card.querySelector('.khm-go')?.textContent.trim() || '',
          category: card && card.querySelector('.khm-story')?.textContent.trim() || '',
          source: source && source.textContent.trim() || '', sourceUrl: source && source.href || '',
          storyHref: go && go.getAttribute('href') || '', className: card && card.className || '' };
      });
      check('clicking a globe marker opens the existing interactive-map card structure',
        cardState.visible && cardState.className.includes('khm-card') && !!cardState.name && !!cardState.category,
        JSON.stringify(cardState));
      check('the globe card includes a sourced link and a story-reading link',
        /^https:\/\//i.test(cardState.sourceUrl) && /^stories\/[a-z0-9-]+\/[0-9]{3}\/$/.test(cardState.storyHref),
        JSON.stringify(cardState));
      await page.screenshot({ path: path.join(screenshotDir, 'globe-desktop.png'), animations: 'disabled' });
      for (const locale of LANGS) {
        await page.evaluate((l) => {
          document.documentElement.lang = l;
          document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
        }, locale);
        await page.waitForFunction((title) => document.querySelector('#khWorld h2')?.textContent.trim() === title,
          titles[locale], { timeout: 4000 }).catch(() => {});
        const localized = await page.evaluate(async ({ locale, targetId }) => {
          const stories = await fetch('stories/index.json').then(r => r.json());
          const story = stories.find(s => String(s.id).padStart(3, '0') === String(targetId).padStart(3, '0'));
          return {
            title: document.querySelector('#khWorld h2')?.textContent.trim() || '',
            dir: document.querySelector('#khWorld').dir,
            card: !!document.querySelector('#khWorld .kh-world-story-card .khm-card'),
            source: document.querySelector('#khWorld .kh-world-story-card .khm-source')?.textContent.trim() || '',
            chips: [...document.querySelectorAll('#khWorld .kh-world-list .kh-world-chip')].map(a => a.textContent.trim()),
            expectedPerson: story && (story.i18n?.[locale]?.person || story.person) || ''
          };
        }, { locale, targetId: target.id });
        check('globe heading and selected card survive language ' + locale,
          localized.title === titles[locale] && localized.dir === (locale === 'ar' ? 'rtl' : 'ltr') && localized.card && !!localized.source,
          JSON.stringify(localized));
        check('globe story chips show the localized character name in ' + locale,
          !!localized.expectedPerson && localized.chips.includes(localized.expectedPerson), JSON.stringify(localized));
      }
    }
  } catch (e) {
    hard.push(label + ': browser regression could not complete — ' + String(e.message || e).split('\n')[0]);
  } finally {
    await desktop.close();
  }

  const mobile = await newContext(browser, origin, 'mobile');
  try {
    const page = await mobile.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(base + '/', { waitUntil: 'load' });
    const globe = page.locator('#khWorld');
    await globe.waitFor({ state: 'attached', timeout: 10000 });
    await globe.scrollIntoViewIfNeeded();
    await page.locator('#khWorld .kh-world-canvas').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForFunction(() => !!document.querySelector('#khWorld .kh-world-list .kh-world-chip'), null, { timeout: 10000 });
    const state = await page.evaluate(() => ({
      width: document.querySelector('#khWorld').getBoundingClientRect().width,
      viewport: document.documentElement.clientWidth,
      canvas: !!document.querySelector('#khWorld canvas'),
      list: document.querySelectorAll('#khWorld .kh-world-list .kh-world-chip').length,
      overflow: (() => { const el = document.querySelector('#khWorld'); const r = el.getBoundingClientRect(); return el.scrollWidth > el.clientWidth + 1 || r.left < -1 || r.right > document.documentElement.clientWidth + 1; })()
    }));
    check('globe remains visible and usable on mobile without horizontal overflow',
      state.canvas && state.list > 0 && state.width > 0 && !state.overflow, JSON.stringify(state));
    await globe.screenshot({ path: path.join(screenshotDir, 'globe-mobile.png'), animations: 'disabled' });
  } catch (e) {
    hard.push(label + ': mobile browser regression could not complete — ' + String(e.message || e).split('\n')[0]);
  } finally {
    await mobile.close();
  }
  return { label, checks, hard, warn: [] };
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

    /* The map intentionally falls back to a text list when external Leaflet CDN requests are blocked. */
    if (lang === 'ar' && viewport === 'desktop') {
      try {
        await page.locator('#khMap').scrollIntoViewIfNeeded({ timeout: 8000 });
        await page.waitForFunction(() => !!document.querySelector('#khMap .khm-canvas .khm-list li'), null, { timeout: 10000 });
        let mapState = await page.evaluate(() => ({
          title: document.querySelector('#khMap h2')?.textContent.trim() || '',
          items: document.querySelectorAll('#khMap .khm-canvas .khm-list li').length,
          approximate: document.querySelector('#khMap .khm-canvas .khm-list')?.innerText || '',
          direction: document.querySelector('#khMap .khm-canvas .khm-list') ? getComputedStyle(document.querySelector('#khMap .khm-canvas .khm-list')).direction : ''
        }));
        step('homepage map loads story locations and preserves the fallback list', !!mapState.title && mapState.items >= 5 && mapState.approximate.includes('الموقع تقريبي'), JSON.stringify(mapState));
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(100);
        await page.locator('.langs button[data-l="4"]').click();
        await page.waitForFunction(() => document.documentElement.lang === 'de', null, { timeout: 5000 });
        await page.waitForTimeout(150);
        mapState = await page.evaluate(() => ({
          title: document.querySelector('#khMap h2')?.textContent.trim() || '',
          approximate: document.querySelector('#khMap .khm-canvas .khm-list')?.innerText || '',
          direction: document.querySelector('#khMap .khm-canvas .khm-list') ? getComputedStyle(document.querySelector('#khMap .khm-canvas .khm-list')).direction : ''
        }));
        step('map fallback and approximate location follow German', mapState.title === 'Alle Geschichten verknüpft' && mapState.approximate.includes('Ungefähre Lage') && mapState.direction === 'ltr', JSON.stringify(mapState));
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(100);
        await page.locator('.langs button[data-l="0"]').click();
        await page.waitForFunction(() => document.documentElement.lang === 'ar', null, { timeout: 5000 });
        await page.waitForTimeout(150);
        const restored = await page.locator('#khMap .khm-canvas .khm-list').innerText().catch(() => '');
        step('map fallback restores Arabic after German', restored.includes('الموقع تقريبي'), restored.slice(-160));
      } catch (e) {
        step('homepage map fallback and language switch', false, String(e.message || e).split('\\n')[0].slice(0, 500));
      }
    }

    /* 2. section */
    const sectionLink = page.locator('.gate[href="khaledoon/collections/october.html"]').first();
    try { await sectionLink.scrollIntoViewIfNeeded(); await Promise.all([page.waitForURL(/collections\/october\.html/, { timeout: 8000 }), sectionLink.click({ timeout: 5000 })]); }
    catch (e) { await page.goto(base + '/khaledoon/collections/october.html', { waitUntil: 'load' }); warn.push(`${label}: section link not clickable from the homepage, opened directly`); }
    await page.waitForTimeout(300);
    s = await inspect(page); judgeInner(label + ' section', s, lang, hard, warn);
    step('section keeps language', s.lang === lang, `lang=${s.lang}`);
    const sectionOptions = await page.locator('.lang-option').count();
    step('section exposes all five language options', sectionOptions === LANGS.length, `count=${sectionOptions}`);
    if (lang === 'ar') await page.screenshot({ path: path.join(screenshotDir, `october-${viewport}.png`), animations: 'disabled' });
    if (sectionOptions === LANGS.length) {
      const currentIndex = LANGS.indexOf(lang);
      const alternate = LANGS[(currentIndex + 1) % LANGS.length];
      let clickDiagnostics = 'not collected';
      try {
        const alternateButton = page.locator('.lang-option').nth(LANGS.indexOf(alternate));
        await alternateButton.scrollIntoViewIfNeeded({ timeout: 5000 });
        clickDiagnostics = JSON.stringify(await alternateButton.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const x = r.left + r.width / 2, y = r.top + r.height / 2;
          const hit = document.elementFromPoint(x, y);
          const cs = getComputedStyle(el);
          return {
            viewport: { width: innerWidth, height: innerHeight },
            buttonRect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
            hitTarget: hit ? { tag: hit.tagName, id: hit.id, className: String(hit.className || '') } : null,
            hitIsButton: !!hit && (hit === el || el.contains(hit)),
            buttonPosition: cs.position, buttonZIndex: cs.zIndex, pointerEvents: cs.pointerEvents,
            scrollY, scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior
          };
        }));
        await alternateButton.click({ timeout: 8000 });
        await page.waitForFunction((expected) => document.documentElement.lang === expected, alternate, { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(250);
        let switched = await inspect(page);
        step('section language switcher changes language and saves it', switched.lang === alternate && switched.stored === alternate && !/[?&]lang=/.test(switched.url), `lang=${switched.lang} stored=${switched.stored}`);
        const originalButton = page.locator('.lang-option').nth(currentIndex);
        await originalButton.scrollIntoViewIfNeeded({ timeout: 5000 });
        await originalButton.click({ timeout: 8000 });
        await page.waitForFunction((expected) => document.documentElement.lang === expected, lang, { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(250);
        s = await inspect(page);
        step('section language can be restored without losing navigation', s.lang === lang && !/[?&]lang=/.test(s.url), `lang=${s.lang}`);
      } catch (e) {
        step('section language switcher interaction completes', false, (String(e.message || e).split('\\n')[0] + ' | hit-test=' + clickDiagnostics).slice(0, 900));
        try { await page.evaluate((value) => { localStorage.setItem('kh-lang', value); localStorage.setItem('lang', value); }, lang); await page.reload({ waitUntil: 'load' }); } catch (_) {}
      }
    }

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



/* Focused diagnostic: list every visible Arabic-containing text fragment on the three
   stories that still showed 7–9% Arabic. This is diagnostic evidence, not an automatic
   translation failure: names, historical terms, and quotations need human classification. */
async function targetArabicTextAudit(browser, base, origin) {
  const cases = [
    { slug: 'stories/islamic/011/', person: 'Amr ibn al-As' },
    { slug: 'stories/science/012/', person: 'Farouk El-Baz' },
    { slug: 'stories/women/013/', person: 'Hatshepsut' },
    { slug: 'stories/history/014/', person: 'Abu Bakr al-Khwarizmi' },
    { slug: 'stories/science/015/', person: 'Magdi Yacoub' }
  ];
  const languages = ['en', 'fr', 'it', 'de'];
  const rows = [];
  const hard = [];
  const ctx = await newContext(browser, origin, 'desktop');
  const page = await ctx.newPage();
  try {
    await page.goto(base + '/assets/shared/home-language-only.js', { waitUntil: 'load' });
    for (const item of cases) {
      for (const lang of languages) {
        await page.evaluate((l) => localStorage.setItem('kh-lang', l), lang);
        try {
          await page.goto(base + '/' + item.slug, { waitUntil: 'load', timeout: 20000 });
          await page.waitForTimeout(450);
          await page.waitForFunction(() => !!window.KH_LANG, null, { timeout: 8000 });
          /* SVGs with translatable text become blob URLs; artwork without embedded text may remain at its source URL. In either case, wait until the payload contains no Arabic text. */
          await page.waitForFunction(async () => {
            const images = Array.from(document.querySelectorAll('img[src]'));
            const covers = images.filter((img) => /cover(?:-popup)?\.svg(?:$|[?#])/i.test(img.__storySvgOriginalSrc || img.getAttribute('src') || ''));
            const splash = document.querySelector('.story-start-art img');
            const candidates = Array.from(new Set(covers.concat(splash ? [splash] : [])));
            if (!covers.length || !candidates.length) return false;
            for (const img of candidates) {
              const src = img.getAttribute('src') || '';
              if (!src) return false;
              try {
                const resolved = src.startsWith('blob:') ? src : new URL(src, document.baseURI).href;
                const svg = await (await fetch(resolved)).text();
                if (/[\u0600-\u06FF]/.test(svg)) return false;
              } catch (_) { return false; }
            }
            return true;
          }, null, { timeout: 12000 }).catch(() => {});
          await page.waitForTimeout(150);
          const found = await page.evaluate(async () => {
            const isArabic = /[\u0600-\u06FF]/;
            const excluded = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|CODE|PRE)$/;
            const fragments = [];
            const addText = (text, source, element) => {
              const value = String(text || '').replace(/\s+/g, ' ').trim();
              if (value && isArabic.test(value)) fragments.push({
                source, tag: element && element.tagName ? element.tagName.toLowerCase() : '',
                id: element && element.id || '',
                className: element && typeof element.className === 'string' ? element.className : '',
                src: source === 'svg-image' && element && element.getAttribute ? (element.getAttribute('src') || '') : '',
                text: value.slice(0, 400)
              });
            };
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
              const node = walker.currentNode;
              if (!node.parentElement || excluded.test(node.parentElement.tagName)) continue;
              if (!node.nodeValue.trim()) continue;
              const style = getComputedStyle(node.parentElement);
              if (style.display === 'none' || style.visibility === 'hidden') continue;
              addText(node.nodeValue, 'html-text', node.parentElement);
            }
            /* Inspect SVG payloads too, including localized blob URLs used by <img>. */
            for (const img of document.querySelectorAll('img[src]')) {
              const src = img.getAttribute('src') || '';
              if (!/\.svg(?:$|[?#])|^blob:/i.test(src)) continue;
              try {
                const response = await fetch(src);
                if (!response.ok) continue;
                const xml = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
                for (const el of xml.querySelectorAll('text,tspan,title,desc')) {
                  addText(el.textContent, 'svg-image', img);
                }
              } catch (_) { /* report visible HTML fragments even if an SVG cannot be read */ }
            }
            for (const el of document.querySelectorAll('svg text,svg tspan,svg title,svg desc')) {
              const style = getComputedStyle(el);
              if (style.display !== 'none' && style.visibility !== 'hidden') addText(el.textContent, 'inline-svg', el);
            }
            return {
              title: document.title,
              htmlLang: document.documentElement.lang,
              fragments,
              uniqueFragments: [...new Set(fragments.map((x) => x.text))]
            };
          });
          const row = { person: item.person, slug: item.slug, language: lang, ...found };
          rows.push(row);
          console.log('ARABIC TEXT AUDIT ' + JSON.stringify({
            person: row.person, language: row.language, count: row.uniqueFragments.length,
            fragments: row.uniqueFragments
          }));
          if (found.htmlLang !== lang) hard.push('Arabic text audit: ' + item.slug + ' expected html lang=' + lang + ', got ' + found.htmlLang);
          for (const fragment of found.fragments) {
            if (fragment.source === 'svg-image') {
              hard.push('Untranslated Arabic SVG text: ' + item.slug + ' [' + lang + '] ' + fragment.text + ' (' + fragment.src + ')');
            } else if (fragment.source === 'html-text' && fragment.text !== 'العربية') {
              hard.push('Untranslated Arabic HTML text: ' + item.slug + ' [' + lang + '] ' + fragment.text);
            }
          }
        } catch (e) {
          hard.push('Arabic text audit failed for ' + item.slug + ' [' + lang + ']: ' + String(e.message || e).split('\n')[0]);
        }
      }
    }
  } finally {
    await ctx.close();
  }
  return { rows, hard };
}

async function introPopupRegression(browser, base, origin) {
  const hard = [];
  const checks = [];
  for (const viewport of ['desktop', 'mobile']) {
    const ctx = await newContext(browser, origin, viewport);
    /* Use a deterministic local test image: external requests are blocked by this suite. */
    await ctx.route((url) => String(url).includes('commons.wikimedia.org'), (route) => route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"><rect width="600" height="800" fill="#d8c6a4"/></svg>'
    }));
    const page = await ctx.newPage();
    try {
      for (const slug of ['008', '009']) {
        const rel = `stories/people/${slug}/`;
        await page.goto(`${base}/${rel}`, { waitUntil: 'load', timeout: 20000 });
        await page.waitForTimeout(1200);
        const state = await page.evaluate(() => {
          const splash = document.querySelector('.story-splash');
          const image = splash && splash.querySelector('.story-start-art img');
          const rect = image ? image.getBoundingClientRect() : { width: 0, height: 0 };
          return {
            splashConnected: !!splash && splash.isConnected,
            imageConnected: !!image && image.isConnected,
            splashCount: document.querySelectorAll('.story-splash').length,
            splashDisplay: splash ? getComputedStyle(splash).display : 'missing',
            imageFit: image ? getComputedStyle(image).objectFit : 'missing',
            imageWidth: Math.round(rect.width),
            imageHeight: Math.round(rect.height),
            title: splash?.querySelector('.story-start-title')?.textContent?.trim() || '',
            startButton: !!splash?.querySelector('.story-splash-start'),
            closeButton: !!splash?.querySelector('.story-start-close')
          };
        });
        const ok = state.splashConnected && state.imageConnected && state.splashCount === 1 &&
          state.splashDisplay !== 'none' && state.imageFit === 'contain' &&
          state.imageWidth > 0 && state.imageHeight > 0 && state.title &&
          state.startButton && state.closeButton;
        checks.push({ viewport, slug, stage: 'unified-splash-after-delay', ok, state });
        if (!ok) hard.push(`Unified intro splash ${slug}/${viewport} missing or invalid after load: ${JSON.stringify(state)}`);

        await page.locator('.story-splash-start').click({ timeout: 5000 });
        await page.waitForFunction(() => !document.querySelector('.story-splash'), null, { timeout: 5000 }).catch(() => {});
        const startClosed = await page.evaluate(() => !document.querySelector('.story-splash'));
        checks.push({ viewport, slug, stage: 'start-button-closes-splash', ok: startClosed });
        if (!startClosed) hard.push(`Unified intro splash ${slug}/${viewport}: start button did not close it`);

        await page.reload({ waitUntil: 'load', timeout: 20000 });
        await page.locator('.story-start-close').click({ timeout: 5000 });
        await page.waitForFunction(() => !document.querySelector('.story-splash'), null, { timeout: 5000 }).catch(() => {});
        const closeClosed = await page.evaluate(() => !document.querySelector('.story-splash'));
        checks.push({ viewport, slug, stage: 'close-button-closes-splash', ok: closeClosed });
        if (!closeClosed) hard.push(`Unified intro splash ${slug}/${viewport}: close button did not close it`);
      }
    } catch (e) {
      hard.push(`Intro popup regression ${viewport}: ${String(e.message || e).split('\\n')[0]}`);
    } finally {
      await ctx.close();
    }
  }
  return { checks, hard };
}

async function svgArtworkRegression(browser, base, origin) {
  const hard = [];
  const checks = [];
  const cases = [
    { slug: 'stories/science/015/', selector: '.story-visual-gallery figure:nth-of-type(2) img', decorative: true },
    { slug: 'stories/science/007/', decorative: true },
    { slug: 'stories/women/013/', decorative: true },
    { slug: 'stories/islamic/011/', decorative: true },
    { slug: 'stories/history/014/', decorative: true },
    { slug: 'stories/science/012/', decorative: true },
    { slug: 'stories/women/010/', decorative: true },
    { slug: 'stories/science/007/', asset: 'stories/science/007/cover.svg', decorative: true },
    { slug: 'stories/women/010/', asset: 'stories/women/010/cover.svg', decorative: true },
    { slug: 'stories/islamic/011/', asset: 'stories/islamic/011/cover.svg', decorative: true },
    { slug: 'stories/science/012/', asset: 'stories/science/012/cover.svg', decorative: true },
    { slug: 'stories/women/013/', asset: 'stories/women/013/cover.svg', decorative: true },
    { slug: 'stories/history/014/', asset: 'stories/history/014/cover.svg', decorative: true },
    { slug: 'stories/science/015/', asset: 'stories/science/015/cover.svg', decorative: true }
  ];
  const ctx = await newContext(browser, origin, 'desktop');
  const page = await ctx.newPage();
  try {
    await page.goto(base + '/assets/shared/home-language-only.js');
    for (const item of cases) {
      await page.evaluate(() => localStorage.setItem('kh-lang', 'en'));
      await page.goto(base + '/' + item.slug, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(900);
      const en = await page.evaluate(async ({ selector, asset, base }) => {
        const img = asset ? null : document.querySelector(selector || '.story-start-art img');
        if (!asset && !img) return { found: false, src: '', svg: '' };
        const src = asset || (img.getAttribute('src') || '');
        let svg = '';
        try { svg = await (await fetch(asset ? base + '/' + asset : src)).text(); } catch (_) {}
        return { found: true, src, svg };
      }, { selector: item.selector || '', asset: item.asset || '', base });
      const enOk = item.decorative ? (en.found && !en.src.startsWith('blob:') && !/<text\b/i.test(en.svg) && !/[؀-ۿ]/.test(en.svg)) : (en.found && en.src.startsWith('blob:') && en.svg.includes(item.expected) && !en.svg.includes(item.arabic));
      checks.push({ slug: item.slug, language: 'en', ok: enOk, src: en.src, expected: item.expected });
      if (!enOk) hard.push('SVG artwork did not localize in English: ' + item.slug + ' (expected ' + item.expected + ')');

      await page.evaluate(() => localStorage.setItem('kh-lang', 'ar'));
      await page.reload({ waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(250);
      const ar = await page.evaluate(async ({ selector, asset, base }) => {
        const img = asset ? null : document.querySelector(selector || '.story-start-art img');
        if (!asset && !img) return { found: false, src: '', svg: '' };
        const src = asset || (img.getAttribute('src') || '');
        let svg = '';
        try { svg = await (await fetch(asset ? base + '/' + asset : src)).text(); } catch (_) {}
        return { found: true, src, svg };
      }, { selector: item.selector || '', asset: item.asset || '', base });
      const arOk = item.decorative ? (ar.found && ar.src === en.src && !/<text\b/i.test(ar.svg) && !/[؀-ۿ]/.test(ar.svg)) : (ar.found && !ar.src.startsWith('blob:') && ar.svg.includes(item.arabic));
      checks.push({ slug: item.slug, language: 'ar', ok: arOk, src: ar.src, expected: item.arabic });
      if (!arOk) hard.push('SVG artwork did not restore Arabic source: ' + item.slug + ' (expected ' + item.arabic + ')');
    }
  } catch (e) {
    hard.push('SVG artwork regression: ' + String(e.message || e).split('\\n')[0]);
  } finally {
    await ctx.close();
  }
  return { checks, hard };
}


async function adminV2ActualImportRegression(browser, base, origin) {
  const hard = [];
  const ctx = await newContext(browser, origin, 'desktop');
  const seed = {
    id: 'e2e00000-0000-4000-8000-000000000001',
    status: 'pending',
    section: 'history',
    title: 'Existing E2E Draft',
    subtitle: 'Existing subtitle',
    figure_name: 'شخصية اختبار',
    narrator_name: 'كارما',
    narrator_grade: 'الصف الأول الإعدادي',
    body: 'نص سابق للحكاية.',
    original_body: 'نص أصلي سابق.',
    sources: 'مصدر سابق https://example.org/old',
    translations: {},
    story_meta: {},
    created_at: '2026-10-27T00:00:00Z'
  };
  let savedRecord = { ...seed };
  const apiCalls = [];
  const langs = ['ar', 'en', 'fr', 'it', 'de'];
  const localizedImage = (name) => ({
    url: 'https://example.org/' + name + '.jpg',
    kind: 'illustration',
    source_name: 'المصدر الأصلي',
    source_url: 'https://example.org/archive/' + name,
    rights: 'Illustration rights',
    i18n: Object.fromEntries(langs.map((lang) => [lang, {
      alt: name + ' alt ' + lang,
      caption: name + ' caption ' + lang,
      source_name: lang === 'ar' ? 'المصدر الأصلي' : 'Source ' + lang,
      rights: lang === 'ar' ? 'Illustration rights' : 'Rights ' + lang
    }]))
  });
  const packageV2 = {
    format: 'KHALEDOON_STORY_V2',
    slug: 'e2e-v2-import-story',
    section: 'history',
    design: { variant: 'portrait-biography', accent: '#d5b7ff' },
    original_body: 'النص الأصلي الذي وصل من صاحب الاقتراح دون تغيير.',
    i18n: Object.fromEntries(langs.map((lang) => [lang, {
      title: 'V2 Import Test ' + lang,
      subtitle: 'A test subtitle ' + lang,
      summary: 'A test subtitle ' + lang,
      student_name: 'Student ' + lang,
      narrator_name: 'Karma ' + lang,
      figure_name: 'Historical figure ' + lang,
      person: 'Historical figure ' + lang,
      grade: 'Grade 7',
      narrator_grade: 'Grade 7',
      history_note: 'Historical note ' + lang,
      images_note: 'Image rights note ' + lang,
      blocks: [
        { type: 'paragraph', speaker: 'karma', text: 'Karma asks a question ' + lang + '.' },
        { type: 'paragraph', speaker: 'narrator', text: 'A verified historical fact ' + lang + '.' },
        { type: 'did_you_know', speaker: 'narrator', text: ({ ar: 'هل تعلم؟ معلومة موثقة أولى ', en: 'Did you know? First verified fact ', fr: 'Le saviez-vous ? Premier fait vérifié ', it: 'Lo sapevi? Primo fatto verificato ', de: 'Wusstest du? Erste geprüfte Tatsache ' }[lang]) + lang + '.' },
        { type: 'did_you_know', speaker: 'narrator', text: ({ ar: 'هل تعلم؟ معلومة موثقة ثانية ', en: 'Did you know? Second verified fact ', fr: 'Le saviez-vous ? Deuxième fait vérifié ', it: 'Lo sapevi? Secondo fatto verificato ', de: 'Wusstest du? Zweite geprüfte Tatsache ' }[lang]) + lang + '.' },
        { type: 'did_you_know', speaker: 'narrator', text: ({ ar: 'هل تعلم؟ معلومة موثقة ثالثة ', en: 'Did you know? Third verified fact ', fr: 'Le saviez-vous ? Troisième fait vérifié ', it: 'Lo sapevi? Terzo fatto verificato ', de: 'Wusstest du? Dritte geprüfte Tatsache ' }[lang]) + lang + '.' }
      ]
    }])),
    cover: localizedImage('cover'),
    images: [{ ...localizedImage('gallery-one'), id: 'image-1' }, { ...localizedImage('gallery-two'), id: 'image-2' }],
    sources: [
      { title: 'Archive reference one', organization: 'المتحف القومي للتاريخ', url: 'https://example.org/archive/one', i18n: Object.fromEntries(langs.map((lang) => [lang, { title: 'Archive reference one', organization: 'المتحف القومي للتاريخ' }])) },
      { title: 'Archive reference two', organization: 'جامعة القاهرة', url: 'https://example.org/archive/two', i18n: Object.fromEntries(langs.map((lang) => [lang, { title: 'Archive reference two', organization: 'جامعة القاهرة' }])) }
    ],
    quiz: Array.from({ length: 5 }, (_, i) => ({
      id: 'question-' + (i + 1),
      correct_option: 1,
      i18n: Object.fromEntries(langs.map((lang) => [lang, {
        question: 'Question ' + (i + 1) + ' ' + lang,
        options: ['A ' + lang, 'B ' + lang, 'C ' + lang, 'D ' + lang],
        explanation: 'Explanation ' + lang
      }]))
    })),
    map_location: null
  };
  const routeApi = async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    apiCalls.push({ method, path, search: url.search });
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'apikey,authorization,content-type,prefer',
      'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
      'content-type': 'application/json'
    };
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (path.endsWith('/rest/v1/rpc/is_admin')) return route.fulfill({ status: 200, headers, body: 'true' });
    if (path.endsWith('/rest/v1/khaledoon_submissions')) {
      if (method === 'PATCH' || method === 'POST') {
        let payload = {};
        try { payload = request.postDataJSON() || {}; } catch (_) {}
        savedRecord = { ...savedRecord, ...payload, id: seed.id };
        return route.fulfill({ status: 200, headers, body: JSON.stringify([savedRecord]) });
      }
      return route.fulfill({ status: 200, headers, body: JSON.stringify([savedRecord]) });
    }
    return route.fulfill({ status: 200, headers, body: '[]' });
  };
  await ctx.addInitScript(() => {
    const session = { access_token: 'e2e-token', refresh_token: 'e2e-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600 };
    localStorage.setItem('kh_adm_session', JSON.stringify(session));
    sessionStorage.setItem('kh_adm_session', JSON.stringify(session));
  });
  const validFixturePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/k0cAAAAASUVORK5CYII=', 'base64');
  await ctx.route(/^https:\/\/example\.org\/.*/, async (route) => route.fulfill({ status: 200, contentType: 'image/png', body: validFixturePng }));
  await ctx.route(/^https:\/\/ypwprddkscnfblhftkeb\.supabase\.co\/.*/, routeApi);
  const page = await ctx.newPage();
  const failedRequests = [];
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText || '' }));
  try {
    await page.goto(base + '/khaledoon/admin.html', { waitUntil: 'load', timeout: 20000 });
    await page.waitForFunction(() => !!document.querySelector('details.pubrow'), null, { timeout: 15000 });
    const card = page.locator('details.pubrow').filter({ hasText: 'Existing E2E Draft' }).first();
    await card.locator('summary').click();
    const textarea = page.locator('textarea[aria-label="الصق ناتج الذكاء الاصطناعي JSON"]');
    await textarea.waitFor({ state: 'visible', timeout: 10000 });
    await textarea.fill(JSON.stringify(packageV2));
    const importButton = page.getByRole('button', { name: 'تعديل ناتج الذكاء الاصطناعي أو تطبيقه وقفل الخانة' });
    const popupPromise = page.waitForEvent('popup', { timeout: 20000 }).catch(() => null);
    await importButton.click();
    try {
      await page.waitForFunction(() => { const el = document.querySelector('.ai-status[role="status"]'); return !!el && !el.hidden && /تم تنفيذ الكود وحُفظت المسودة|❌ لم يُنفَّذ التعديل\./.test(el.textContent); }, null, { timeout: 30000 });
    } catch (waitError) {
      throw new Error('Timed out waiting for final import status; current status=' + await page.locator('.ai-status[role="status"]').innerText().catch(() => '(missing)') + '; API calls=' + JSON.stringify(apiCalls) + '; failed requests=' + JSON.stringify(failedRequests));
    }
    const importStatus = await page.locator('.ai-status[role="status"]').innerText();
    if (!/تم تنفيذ الكود وحُفظت المسودة/.test(importStatus)) throw new Error('V2 import was rejected: ' + importStatus.slice(-900));
    if (!String(savedRecord.sources || '').includes('[org:المتحف القومي للتاريخ]')) {
      hard.push('V2 import did not preserve a readable Arabic source organization in the saved draft.');
    }
    if (String(savedRecord.sources || '').includes('%D8%')) {
      hard.push('V2 source organization was percent-encoded in Arabic instead of remaining readable.');
    }
    if (savedRecord.status === 'published') hard.push('V2 import unexpectedly published the story instead of saving a draft.');
    const popup = await popupPromise;
    if (popup) await popup.waitForURL(/preview\.html/, { timeout: 15000 }).catch(() => {});
    if (popup) {
      await popup.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
      await popup.waitForFunction(() => document.readyState === 'complete' && document.body, null, { timeout: 10000 }).catch(() => {});
      const visibleText = await popup.locator('body').innerText().catch(() => '');
      if (visibleText.includes('[org:')) hard.push('Reader preview leaked the internal [org: source marker.');
      if (!visibleText.includes('V2 Import Test')) hard.push('V2 draft preview did not render the imported title.');
    } else {
      hard.push('V2 import saved but did not open its expected preview popup.');
    }
    return { checks: [{ ok: hard.length === 0, savedAsDraft: savedRecord.status !== 'published', sourceMarkerReadable: !String(savedRecord.sources || '').includes('%D8%'), previewOpened: !!popup }], hard };
  } catch (e) {
    hard.push('Actual V2 paste/import browser flow failed: ' + String(e.message || e).slice(0,1800));
    return { checks: [{ ok: false }], hard };
  } finally {
    await ctx.close();
  }
}

async function adminV2ModuleRegression(browser, base, origin) {
  const hard = [];
  const ctx = await newContext(browser, origin, 'desktop');
  const page = await ctx.newPage();
  try {
    await page.goto(base + '/khaledoon/admin.html', { waitUntil: 'load', timeout: 20000 });
    await page.waitForFunction(() => {
      const a = window.KHStoryV2Adapter;
      return !!a && a.V2_FORMAT === 'KHALEDOON_STORY_V2' &&
        typeof a.validateForAdminBridge === 'function' && typeof a.v2ToV1 === 'function';
    }, null, { timeout: 10000 });
    return { checks: [{ ok: true, moduleLoaded: true }], hard };
  } catch (e) {
    hard.push('Admin V2 import module did not load: ' + String(e.message || e).split('\\n')[0]);
    return { checks: [{ ok: false, moduleLoaded: false }], hard };
  } finally {
    await ctx.close();
  }
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
    results.cinematicGlobe = await cinematicGlobeRegression(browser, base, origin);
    results.introPopup = await introPopupRegression(browser, base, origin);
    results.svgArtwork = await svgArtworkRegression(browser, base, origin);
    results.targetArabicAudit = await targetArabicTextAudit(browser, base, origin);
    results.adminV2Import = await adminV2ModuleRegression(browser, base, origin);
    results.adminV2ActualImport = await adminV2ActualImportRegression(browser, base, origin);
  } finally { await browser.close(); server.close(); }

  const dedupe = (a) => [...new Set(a)];
  const hard = dedupe([...results.flow, ...results.sweep].flatMap((r) => r.hard).concat(results.introPopup ? results.introPopup.hard : [], results.svgArtwork ? results.svgArtwork.hard : [], results.targetArabicAudit ? results.targetArabicAudit.hard : [], results.adminV2Import ? results.adminV2Import.hard : [], results.adminV2ActualImport ? results.adminV2ActualImport.hard : [], results.cinematicGlobe ? results.cinematicGlobe.hard : []));
  const warn = dedupe([...results.flow, ...results.sweep].flatMap((r) => r.warn));
  results.summary = { hard: hard.length, warnings: warn.length };
  results.hardFailures = hard; results.warnings = warn;
  if (out) fs.writeFileSync(out, JSON.stringify(results, null, 1));

  const stepCount = results.flow.reduce((n, r) => n + r.steps.length, 0);
  const stepOk = results.flow.reduce((n, r) => n + r.steps.filter((s) => s.ok).length, 0);
  console.log(`FLOW: ${stepOk}/${stepCount} steps passed across ${results.flow.length} language/viewport runs.`);
  console.log(`SWEEP: ${pages.length} visitor pages x ${LANGS.length} languages x 2 viewports = ${pages.length * LANGS.length * 2} loads.`);
  console.log(`CINEMATIC GLOBE: ${results.cinematicGlobe ? results.cinematicGlobe.checks.filter((c) => c.ok).length : 0}/${results.cinematicGlobe ? results.cinematicGlobe.checks.length : 0} checks passed.`);
  console.log(`INTRO POPUP: ${results.introPopup ? results.introPopup.checks.filter((c) => c.ok).length : 0}/${results.introPopup ? results.introPopup.checks.length : 0} checks passed.`);
  console.log(`SVG ARTWORK: ${results.svgArtwork ? results.svgArtwork.checks.filter((c) => c.ok).length : 0}/${results.svgArtwork ? results.svgArtwork.checks.length : 0} checks passed.`);
  console.log(`TARGET ARABIC TEXT AUDIT: ${results.targetArabicAudit ? results.targetArabicAudit.rows.length : 0} page/language samples recorded; see report.targetArabicAudit for each Arabic fragment.`);
  console.log(`ADMIN V2 IMPORT MODULE: ${results.adminV2Import ? results.adminV2Import.checks.filter((c) => c.ok).length : 0}/1 module checks passed.`);
  console.log(`ADMIN V2 ACTUAL IMPORT: ${results.adminV2ActualImport ? results.adminV2ActualImport.checks.filter((c) => c.ok).length : 0}/1 real paste/save/preview checks passed.`);
  console.log(`HARD failures: ${hard.length}   WARNINGS: ${warn.length}`);
  hard.slice(0, 60).forEach((m) => console.log('  FAIL ' + m));
  if (hard.length > 60) console.log(`  ... ${hard.length - 60} more (see --out report)`);
  process.exitCode = hard.length ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
