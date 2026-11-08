#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const { chromium } = require('playwright');

const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'khaledoon-story-browser-'));
const artifactDir = process.env.KH_STORY_ARTIFACT_DIR || process.env.KH_V2_ARTIFACT_DIR || path.join(root, 'artifacts/story-preview');
fs.mkdirSync(artifactDir, { recursive: true });
let server, browser;
const errors = [];
function mime(file) {
  return ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'})[path.extname(file).toLowerCase()] || 'application/octet-stream';
}
async function main() {
  fs.mkdirSync(path.join(temp, 'rebuild'), { recursive: true });
  fs.copyFileSync(path.join(root, 'rebuild/reader.js'), path.join(temp, 'rebuild/reader.js'));
  fs.copyFileSync(path.join(root, 'rebuild/reader-base.css'), path.join(temp, 'rebuild/reader-base.css'));
  fs.copyFileSync(path.join(root, 'rebuild/reader-enhance.css'), path.join(temp, 'rebuild/reader-enhance.css'));
  fs.copyFileSync(path.join(root, 'rebuild/package-review.html'), path.join(temp, 'rebuild/package-review.html'));
  fs.copyFileSync(path.join(root, 'rebuild/reader.html'), path.join(temp, 'rebuild/reader.html'));
  fs.copyFileSync(path.join(root, 'rebuild/validate-story.mjs'), path.join(temp, 'rebuild/validate-story.mjs'));
  fs.copyFileSync(path.join(root, 'rebuild/reader-review-actions.js'), path.join(temp, 'rebuild/reader-review-actions.js'));
  fs.mkdirSync(path.join(temp, 'khaledoon/assets'), { recursive: true });
  fs.copyFileSync(path.join(root, 'khaledoon/assets/khaledoon-story-map-link.js'), path.join(temp, 'khaledoon/assets/khaledoon-story-map-link.js'));
  fs.copyFileSync(path.join(root, 'khaledoon/assets/khaledoon-story-nav.js'), path.join(temp, 'khaledoon/assets/khaledoon-story-nav.js'));
  fs.copyFileSync(path.join(root, 'khaledoon/assets/story-workflow.js'), path.join(temp, 'khaledoon/assets/story-workflow.js'));
  fs.mkdirSync(path.join(temp, 'stories'), { recursive: true });
  fs.copyFileSync(path.join(root, 'stories/places.json'), path.join(temp, 'stories/places.json'));
  const urabiDir = path.join(temp, 'stories/history/006');
  fs.mkdirSync(urabiDir, { recursive: true });
  for (const file of ['index.html', 'story.json', 'cover.svg', 'urabi-timeline.svg']) {
    fs.copyFileSync(path.join(root, 'stories/history/006', file), path.join(urabiDir, file));
  }
  const urabiImageDir = path.join(temp, 'assets/images/stories');
  fs.mkdirSync(urabiImageDir, { recursive: true });
  fs.copyFileSync(path.join(root, 'assets/images/stories/Portrait_of_Ahmed_Orabi.jpg'), path.join(urabiImageDir, 'Portrait_of_Ahmed_Orabi.jpg'));
  fs.mkdirSync(path.join(temp, 'assets/shared'), { recursive: true });
  for (const asset of ['home-language-only.js', 'story-audio.js']) {
    fs.copyFileSync(path.join(root, 'assets/shared', asset), path.join(temp, 'assets/shared', asset));
  }
  fs.mkdirSync(path.join(temp, 'assets/shared'), { recursive: true });
  fs.copyFileSync(path.join(root, 'assets/shared/reactions.js'), path.join(temp, 'assets/shared/reactions.js'));
  fs.copyFileSync(path.join(root, 'assets/shared/reactions.css'), path.join(temp, 'assets/shared/reactions.css'));
  fs.copyFileSync(path.join(root, 'assets/shared/story-quiz.js'), path.join(temp, 'assets/shared/story-quiz.js'));
  fs.copyFileSync(path.join(root, 'assets/shared/story-quiz.css'), path.join(temp, 'assets/shared/story-quiz.css'));
  const packageFile = path.join(root, 'rebuild/story-packages/october-sea-men.v2.json');
  const testImageSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#183b45"/><stop offset="1" stop-color="#081b22"/></linearGradient></defs><rect width="640" height="400" fill="url(#sky)"/><path d="M0 290 Q90 260 180 292 T360 292 T540 292 T720 292 V400 H0Z" fill="#1c5860"/><path d="M0 330 Q100 300 200 330 T400 330 T600 330 T800 330 V400 H0Z" fill="#0b303a"/><path d="M150 250 L490 250 L430 305 L205 305Z" fill="#d6ad55"/><path d="M220 240 L220 135 L310 230Z" fill="#e7d7ad"/><path d="M325 235 L325 155 L395 235Z" fill="#b8874b"/><path d="M135 315 H510" stroke="#e6d09a" stroke-width="4" opacity=".8"/><text x="320" y="80" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#f4e8c8">unified story layout test image</text></svg>';
  const build = spawnSync(process.execPath, [path.join(root, 'rebuild/build-story.mjs'), packageFile, '016'], { cwd: temp, encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr || build.stdout || 'unified story story build failed');
  const story = JSON.parse(fs.readFileSync(path.join(temp, 'stories/october/016/story.json'), 'utf8'));
  server = http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
      const file = path.resolve(temp, '.' + pathname);
      if (file !== temp && !file.startsWith(temp + path.sep)) { res.writeHead(403).end('forbidden'); return; }
      let target = file;
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'content-type': mime(target), 'cache-control': 'no-store' });
      fs.createReadStream(target).pipe(res);
    } catch (error) { res.writeHead(500).end('server error'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/stories/october/016/';
  const urabiBase = 'http://127.0.0.1:' + server.address().port + '/stories/history/006/';
  browser = await chromium.launch({ headless: true });
  // The story page follows the visitor's system colour scheme until a theme is saved
  // (same early script as the published pages). Pin the scheme so the theme assertions
  // below start from dark mode deterministically instead of depending on the browser default.
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, colorScheme: 'dark' });
  await context.route(url => !String(url).startsWith('http://127.0.0.1:' + server.address().port), async route => {
    if (route.request().resourceType() === 'image') { await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: testImageSvg }); return; }
    await route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error.message || error)));
  await page.goto(base, { waitUntil: 'load' });
  await page.locator('#story').waitFor({ state: 'visible', timeout: 10000 });
  assert.equal(await page.locator('body').getAttribute('data-theme'), 'dark', 'the page should start in dark mode for a dark-preferring visitor');
  assert.equal(await page.locator('#title').textContent(), story.i18n.ar.title);
  assert.equal(await page.locator('#story-intro-modal').isVisible(), true, 'the story should open on a dedicated start screen');
  assert.equal(await page.locator('#intro-title').textContent(), story.i18n.ar.title, 'start screen title should be localized');
  await page.screenshot({ path: path.join(artifactDir, 'story-start-ar.png'), fullPage: false, animations: 'disabled' });
  await page.locator('#intro-start').click();
  await page.locator('#story-intro-modal').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#cover img').getAttribute('alt'), story.cover.i18n.ar.alt, 'cover alt text should be localized');
  assert.equal(await page.locator('#reaction-like').count(), 1, 'like control should exist');
  assert.equal(await page.locator('[data-reaction-choice]').count(), 4, 'all reaction choices should exist');
  assert.equal(await page.locator('#print-story').count(), 1, 'print control should exist');
  assert.match(await page.locator('#share-whatsapp').getAttribute('href'), /wa\.me/);
  assert.match(await page.locator('#share-facebook').getAttribute('href'), /facebook\.com\/sharer/);
  assert.equal(await page.locator('#quiz .q').count(), 1, 'the quiz should reveal only one question at a time');
  const galleryImages = story.images.filter(image => String(image.url || image.path || '') !== String(story.cover.url || story.cover.path || ''));
  assert.equal(await page.locator('#gallery figure').count(), galleryImages.length, 'the gallery should not repeat the cover image');
  assert.equal(await page.locator('#map-section').isVisible(), true, 'verified map location should render');
  assert.match(await page.locator('#map-link').getAttribute('href'), /openstreetmap\.org/);
  await page.screenshot({ path: path.join(artifactDir, 'story-desktop-ar.png'), fullPage: true, animations: 'disabled' });

  await page.locator('[data-lang="en"]').click();
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  assert.equal(await page.locator('#title').textContent(), story.i18n.en.title);
  assert.equal(await page.locator('html').getAttribute('dir'), 'ltr');
  assert.ok((await page.locator('#gallery figcaption').first().textContent()).includes(galleryImages[0].i18n.en.caption), 'gallery caption should switch to English');
  assert.ok((await page.locator('#sources a').first().textContent()).includes(story.sources[0].i18n.en.title), 'source title should switch to English');
  assert.equal(await page.locator('#quiz .q').count(), 1, 'English should still show one quiz question at a time');
  for (const lang of ['it', 'de']) {
    await page.locator('[data-lang="' + lang + '"]').click();
    await page.waitForFunction(expected => document.documentElement.lang === expected, lang);
    assert.equal(await page.locator('#title').textContent(), story.i18n[lang].title, lang + ' title should be localized');
    assert.equal(await page.locator('html').getAttribute('dir'), 'ltr', lang + ' should use LTR');
    assert.ok((await page.locator('#gallery figcaption').first().textContent()).includes(galleryImages[0].i18n[lang].caption), lang + ' gallery caption should be localized');
    assert.ok((await page.locator('#sources a').first().textContent()).includes(story.sources[0].i18n[lang].title), lang + ' source title should be localized');
    assert.equal(await page.locator('#quiz .q').count(), 1, lang + ' should show one quiz question at a time');
  }
  await page.locator('[data-lang="en"]').click();
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  await page.locator('#gallery img').first().click();
  assert.equal(await page.locator('#image-lightbox').isVisible(), true, 'gallery image should open a lightbox');
  await page.locator('#lightbox-close').click();
  assert.equal(await page.locator('#image-lightbox').isVisible(), false, 'lightbox should close');
  const firstCorrect = story.quiz[0].correct_option;
  await page.locator('#quiz .q').first().locator('.options button').nth(firstCorrect).click();
  assert.equal(await page.locator('#quiz .q').first().locator('.explain').count(), 1, 'quiz answer feedback should render');
  await page.locator('#quiz .quiz-next').click();
  assert.equal(await page.locator('#quiz .q').count(), 1, 'next question should replace the previous question');
  assert.ok((await page.locator('#quiz .q').first().textContent()).includes(story.quiz[1].i18n.en.question), 'next question should appear after answering the first');
  await page.locator('#theme-toggle').click();
  assert.equal(await page.locator('body').getAttribute('data-theme'), 'light', 'theme toggle should switch to light mode');
  assert.equal(await page.locator('#sources a').count(), story.sources.length, 'all sources should render');
  assert.equal(await page.locator('#title').textContent(), story.i18n.en.title);
  const lightPalette = await page.evaluate(() => {
    const s = getComputedStyle(document.body);
    return {
      theme: document.body.dataset.theme,
      scheme: s.colorScheme,
      text: s.getPropertyValue('--text').trim(),
      panel: s.getPropertyValue('--panel').trim(),
      muted: s.getPropertyValue('--muted').trim(),
      title: getComputedStyle(document.querySelector('#title')).color,
      link: getComputedStyle(document.querySelector('#sources a')).color
    };
  });
  assert.equal(lightPalette.theme, 'light');
  assert.equal(lightPalette.scheme, 'light', 'native controls must follow light mode');
  assert.notEqual(lightPalette.text, '#f6f0e4', 'light mode must not retain dark-mode text tokens');
  assert.notEqual(lightPalette.panel, '#17232e', 'light mode must not retain dark-mode surface tokens');
  assert.notEqual(lightPalette.link, 'rgb(227, 189, 120)', 'light-mode links must not retain the gold-on-dark link color');
  await page.locator('#theme-toggle').click();
  assert.equal(await page.locator('body').getAttribute('data-theme'), 'dark', 'theme toggle should switch back to dark mode');
  const darkPalette = await page.evaluate(() => {
    const s = getComputedStyle(document.body);
    return { scheme: s.colorScheme, text: s.getPropertyValue('--text').trim(), panel: s.getPropertyValue('--panel').trim() };
  });
  assert.equal(darkPalette.scheme, 'dark', 'native controls must follow dark mode');
  assert.notEqual(darkPalette.text, lightPalette.text, 'text palette must change when returning to dark mode');
  assert.notEqual(darkPalette.panel, lightPalette.panel, 'surface palette must change when returning to dark mode');
  await page.locator('#theme-toggle').click();
  assert.equal(await page.locator('body').getAttribute('data-theme'), 'light', 'light mode should remain selectable after round trip');
  await page.screenshot({ path: path.join(artifactDir, 'story-desktop-en-light.png'), fullPage: true, animations: 'disabled' });

  // Exercise the actual read-only package reviewer used by the unified story admin draft path.
  const reviewContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
  await reviewContext.route(url => !String(url).startsWith('http://127.0.0.1:' + server.address().port), async route => {
    if (route.request().resourceType() === 'image') { await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: testImageSvg }); return; }
    await route.abort();
  });
  const reviewer = await reviewContext.newPage();
  reviewer.on('pageerror', error => errors.push(String(error.message || error)));
  await reviewer.goto(base, { waitUntil: 'load' });
  const unifiedReviewPackage = { ...story, section: 'people' }; // October remains on its isolated legacy preview path.
  await reviewer.evaluate(pkg => localStorage.setItem('kh-story-review-package', JSON.stringify(pkg)), unifiedReviewPackage);
  await reviewer.goto('http://127.0.0.1:' + server.address().port + '/rebuild/package-review.html?draft=1', { waitUntil: 'load' });
  await reviewer.waitForURL(/reader\.html\?draft=1/, { timeout: 10000 });
  await reviewer.locator('#story').waitFor({ state: 'visible', timeout: 10000 });
  await reviewer.locator('#preview-banner').waitFor({ state: 'visible', timeout: 10000 });
  await reviewer.locator('#story-intro-modal').waitFor({ state: 'visible', timeout: 10000 });
  assert.equal(await reviewer.locator('#title').textContent(), story.i18n.ar.title, 'read-only reviewer must render the saved package in the actual shared reader');
  assert.equal(await reviewer.locator('#preview-return').isVisible(), true, 'shared reader preview must provide a route back to the admin');
  assert.equal(await reviewer.locator('#reactions-section').isVisible(), false, 'draft preview must not expose live reaction controls');
  assert.equal(await reviewer.locator('#share-whatsapp').isVisible(), false, 'draft preview must suppress external sharing');
  await reviewer.locator('#intro-start').click();
  await reviewer.locator('#story-intro-modal').waitFor({ state: 'hidden' });
  assert.equal(await reviewer.locator('#cover img').getAttribute('alt'), story.cover.i18n.ar.alt, 'shared reader preview must localize the cover');
  await reviewer.locator('#story-quiz-start').waitFor({ state: 'visible', timeout: 10000 });
  await reviewer.locator('#story-quiz-start').click();
  await reviewer.locator('#story-quiz-app .story-quiz-question').waitFor({ state: 'visible', timeout: 10000 });
  assert.equal(await reviewer.locator('#story-quiz-app .story-quiz-question').count(), 1, 'shared reader preview must use the same one-question-at-a-time quiz');
  for (const lang of ['en', 'fr', 'it', 'de']) {
    await reviewer.locator('[data-lang="' + lang + '"]').click();
    await reviewer.waitForFunction(expected => document.documentElement.lang === expected, lang);
    assert.equal(await reviewer.locator('#title').textContent(), story.i18n[lang].title, 'shared reader preview must localize ' + lang);
    assert.equal(await reviewer.locator('html').getAttribute('dir'), 'ltr', lang + ' preview must use LTR');
  }
  await reviewer.locator('[data-lang="en"]').click();
  await reviewer.screenshot({ path: path.join(artifactDir, 'story-package-review-en.png'), fullPage: true, animations: 'disabled' });
  await reviewContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  await mobileContext.route(url => !String(url).startsWith('http://127.0.0.1:' + server.address().port), async route => {
    if (route.request().resourceType() === 'image') { await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: testImageSvg }); return; }
    await route.abort();
  });
  const mobile = await mobileContext.newPage();
  mobile.on('pageerror', error => errors.push(String(error.message || error)));
  await mobile.goto(base, { waitUntil: 'load' });
  await mobile.locator('#story').waitFor({ state: 'visible', timeout: 10000 });
  assert.equal(await mobile.locator('#story-intro-modal').isVisible(), true, 'mobile should show the start screen');
  await mobile.locator('#intro-start').click();
  await mobile.locator('[data-lang="fr"]').click();
  await mobile.waitForFunction(() => document.documentElement.lang === 'fr');
  assert.equal(await mobile.locator('#title').textContent(), story.i18n.fr.title);
  assert.equal(await mobile.locator('html').getAttribute('dir'), 'ltr');
  assert.ok((await mobile.locator('#gallery figcaption').first().textContent()).includes(galleryImages[0].i18n.fr.caption), 'gallery caption should switch to French');
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, 'mobile story page must not overflow horizontally; measured ' + overflow + 'px');
  await mobile.screenshot({ path: path.join(artifactDir, 'story-mobile-fr.png'), fullPage: true, animations: 'disabled' });

  // Review Ahmed Urabi 006 from its real page, using the exact story package and local assets.
  const urabiContext = await browser.newContext({ viewport: { width: 1366, height: 900 }, colorScheme: 'dark' });
  await urabiContext.route(url => !String(url).startsWith('http://127.0.0.1:' + server.address().port), async route => {
    if (route.request().resourceType() === 'image') { await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: testImageSvg }); return; }
    await route.abort();
  });
  const urabiPage = await urabiContext.newPage();
  urabiPage.on('pageerror', error => errors.push(String(error.message || error)));
  await urabiPage.goto(urabiBase, { waitUntil: 'load' });
  await urabiPage.locator('#story').waitFor({ state: 'visible', timeout: 10000 });
  const urabiStory = JSON.parse(fs.readFileSync(path.join(urabiDir, 'story.json'), 'utf8'));
  assert.equal(await urabiPage.locator('#title').textContent(), urabiStory.i18n.ar.title);
  assert.equal(await urabiPage.locator('#story-intro-modal').isVisible(), true, 'Ahmed Urabi should open on its own start screen');
  const urabiIntroCover = await urabiPage.locator('#intro-cover').getAttribute('src');
  const urabiHeroCover = await urabiPage.locator('#cover img').getAttribute('src');
  assert.ok(urabiIntroCover.endsWith('/stories/history/006/cover.svg'), 'start screen must use the canonical story cover');
  assert.equal(urabiHeroCover, urabiIntroCover, 'hero and start screen must use the same canonical cover');
  await urabiPage.locator('#intro-start').click();
  await urabiPage.locator('#story-intro-modal').waitFor({ state: 'hidden' });
  assert.equal(await urabiPage.locator('#blocks .block').count(), 20, 'Ahmed Urabi should render all 20 Arabic story blocks');
  assert.equal(await urabiPage.locator('#blocks .block').last().getAttribute('data-speaker'), 'karma', 'Karma must remain the final story speaker');
  assert.equal(await urabiPage.locator('#blocks .ai-disclosure').count(), 1, 'the fixed AI disclosure should appear once after the story');
  assert.equal(await urabiPage.locator('#blocks .block').last().evaluate(node => node.nextElementSibling.className), 'ai-disclosure',
    'the AI disclosure must be a separate interface element immediately after Karma, not a story block');
  assert.equal(await urabiPage.locator('#sources a').count(), 4, 'all four historical sources should render');
  const urabiImages = urabiPage.locator('#blocks img');
  assert.equal(await urabiImages.count(), 2, 'both story illustrations should render in their assigned positions');
  for (let imageIndex = 0; imageIndex < 2; imageIndex++) {
    const image = urabiImages.nth(imageIndex);
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(node => node.decode());
  }
  const urabiImageFigures = await urabiPage.locator('#blocks').evaluate(node => Array.from(node.querySelectorAll('figure')).map(figure => ({
    image: figure.querySelector('img')?.getAttribute('src') || null,
    fallback: Boolean(figure.querySelector('.kh-image-fallback')),
    imageLoaded: Boolean(figure.querySelector('img') && figure.querySelector('img').naturalWidth > 0)
  })));
  console.log('Ahmed Urabi image render:', JSON.stringify(urabiImageFigures));
  assert.equal(urabiImageFigures.length, 2, 'both story illustrations should render in their assigned positions');
  assert.ok(urabiImageFigures.every(item => item.imageLoaded && !item.fallback), 'both Ahmed Urabi story images must load successfully');
  assert.equal(await urabiPage.locator('#map-section').isVisible(), true, 'the verified birthplace map location should render');
  assert.equal(await urabiPage.locator('#quiz .q').count(), 1, 'the story quiz should show one question at a time');
  const disclosures = {
    ar: 'تم توليد هذه النسخة اللغوية باستخدام الذكاء الاصطناعي.',
    en: 'This language version was generated using artificial intelligence.',
    fr: 'Cette version linguistique a été générée à l’aide de l’intelligence artificielle.',
    it: 'Questa versione linguistica è stata generata utilizzando l’intelligenza artificiale.',
    de: 'Diese Sprachfassung wurde mithilfe künstlicher Intelligenz erstellt.'
  };
  for (const lang of ['ar', 'en', 'fr', 'it', 'de']) {
    if (lang !== 'ar') await urabiPage.locator('[data-lang="' + lang + '"]').click();
    await urabiPage.waitForFunction(expected => document.documentElement.lang === expected, lang);
    assert.equal(await urabiPage.locator('#title').textContent(), urabiStory.i18n[lang].title, lang + ' story title should be localized');
    assert.equal(await urabiPage.locator('html').getAttribute('dir'), lang === 'ar' ? 'rtl' : 'ltr', lang + ' direction should be correct');
    assert.equal(await urabiPage.locator('#blocks .ai-disclosure').textContent(), disclosures[lang], lang + ' AI disclosure should be localized');
    assert.equal(await urabiPage.locator('#blocks .block').last().getAttribute('data-speaker'), 'karma', lang + ' should keep Karma as the final speaker');
  }
  await urabiPage.locator('#theme-toggle').click();
  assert.equal(await urabiPage.locator('html').getAttribute('data-theme'), 'light', 'Ahmed Urabi should support light mode');
  await urabiPage.screenshot({ path: path.join(artifactDir, 'ahmed-urabi-desktop-de-light.png'), fullPage: true, animations: 'disabled' });
  await urabiPage.setViewportSize({ width: 390, height: 844 });
  const urabiOverflow = await urabiPage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(urabiOverflow <= 1, 'Ahmed Urabi mobile page must not overflow horizontally; measured ' + urabiOverflow + 'px');
  await urabiPage.screenshot({ path: path.join(artifactDir, 'ahmed-urabi-mobile-de-light.png'), fullPage: true, animations: 'disabled' });
  await urabiContext.close();

  assert.deepEqual(errors, [], 'unified story pages should not throw browser errors');
  console.log(JSON.stringify({ ok: true, story: story.slug, languagesChecked: ['ar','en','fr'], quizQuestions: story.quiz.length, galleryImages: galleryImages.length, sources: story.sources.length, mobileOverflowPx: overflow, screenshots: artifactDir }, null, 2));
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close().catch(() => {});
  if (server) await new Promise(resolve => server.close(resolve));
  fs.rmSync(temp, { recursive: true, force: true });
});
