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
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'khaledoon-v2-browser-'));
const artifactDir = process.env.KH_V2_ARTIFACT_DIR || path.join(root, 'artifacts/v2-story-preview');
fs.mkdirSync(artifactDir, { recursive: true });
let server, browser;
const errors = [];
function mime(file) {
  return ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'})[path.extname(file).toLowerCase()] || 'application/octet-stream';
}
async function main() {
  fs.mkdirSync(path.join(temp, 'rebuild'), { recursive: true });
  fs.copyFileSync(path.join(root, 'rebuild/reader.js'), path.join(temp, 'rebuild/reader.js'));
  fs.copyFileSync(path.join(root, 'rebuild/reader-enhance.css'), path.join(temp, 'rebuild/reader-enhance.css'));
  fs.mkdirSync(path.join(temp, 'assets/shared'), { recursive: true });
  fs.copyFileSync(path.join(root, 'assets/shared/reactions.js'), path.join(temp, 'assets/shared/reactions.js'));
  fs.copyFileSync(path.join(root, 'assets/shared/reactions.css'), path.join(temp, 'assets/shared/reactions.css'));
  const packageFile = path.join(root, 'rebuild/story-packages/october-sea-men.v2.json');
  const testImageSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#183b45"/><stop offset="1" stop-color="#081b22"/></linearGradient></defs><rect width="640" height="400" fill="url(#sky)"/><path d="M0 290 Q90 260 180 292 T360 292 T540 292 T720 292 V400 H0Z" fill="#1c5860"/><path d="M0 330 Q100 300 200 330 T400 330 T600 330 T800 330 V400 H0Z" fill="#0b303a"/><path d="M150 250 L490 250 L430 305 L205 305Z" fill="#d6ad55"/><path d="M220 240 L220 135 L310 230Z" fill="#e7d7ad"/><path d="M325 235 L325 155 L395 235Z" fill="#b8874b"/><path d="M135 315 H510" stroke="#e6d09a" stroke-width="4" opacity=".8"/><text x="320" y="80" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#f4e8c8">V2 layout test image</text></svg>';
  const build = spawnSync(process.execPath, [path.join(root, 'rebuild/build-story.mjs'), packageFile, '016'], { cwd: temp, encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr || build.stdout || 'V2 story build failed');
  const story = JSON.parse(fs.readFileSync(path.join(temp, 'stories/october/016/data.v2.json'), 'utf8'));
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
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await context.route(url => !String(url).startsWith('http://127.0.0.1:' + server.address().port), async route => {
    if (route.request().resourceType() === 'image') { await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: testImageSvg }); return; }
    await route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error.message || error)));
  await page.goto(base, { waitUntil: 'load' });
  await page.locator('#story').waitFor({ state: 'visible', timeout: 10000 });
  assert.equal(await page.locator('#title').textContent(), story.i18n.ar.title);
  assert.equal(await page.locator('#story-intro-modal').isVisible(), true, 'the story should open on a dedicated start screen');
  assert.equal(await page.locator('#intro-title').textContent(), story.i18n.ar.title, 'start screen title should be localized');
  await page.screenshot({ path: path.join(artifactDir, 'v2-story-start-ar.png'), fullPage: false, animations: 'disabled' });
  await page.locator('#intro-start').click();
  await page.locator('#story-intro-modal').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#cover img').getAttribute('alt'), story.cover.i18n.ar.alt, 'cover alt text should be localized');
  assert.equal(await page.locator('#reaction-like').count(), 1, 'like control should exist');
  assert.equal(await page.locator('[data-reaction-choice]').count(), 4, 'all reaction choices should exist');
  assert.equal(await page.locator('#print-story').count(), 1, 'print control should exist');
  assert.match(await page.locator('#share-whatsapp').getAttribute('href'), /wa\.me/);
  assert.match(await page.locator('#share-facebook').getAttribute('href'), /facebook\.com\/sharer/);
  assert.equal(await page.locator('#quiz .q').count(), story.quiz.length, 'all V2 quiz questions should render');
  assert.equal(await page.locator('#gallery figure').count(), story.images.length, 'all localized gallery images should render');
  assert.equal(await page.locator('#map-section').isVisible(), true, 'verified map location should render');
  assert.match(await page.locator('#map-link').getAttribute('href'), /openstreetmap\.org/);
  await page.screenshot({ path: path.join(artifactDir, 'v2-story-desktop-ar.png'), fullPage: true, animations: 'disabled' });

  await page.locator('[data-lang="en"]').click();
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  assert.equal(await page.locator('#title').textContent(), story.i18n.en.title);
  assert.equal(await page.locator('html').getAttribute('dir'), 'ltr');
  assert.ok((await page.locator('#gallery figcaption').first().textContent()).includes(story.images[0].i18n.en.caption), 'gallery caption should switch to English');
  assert.ok((await page.locator('#sources a').first().textContent()).includes(story.sources[0].i18n.en.title), 'source title should switch to English');
  assert.equal(await page.locator('#quiz .q').count(), story.quiz.length);
  await page.locator('#gallery img').first().click();
  assert.equal(await page.locator('#image-lightbox').isVisible(), true, 'gallery image should open a lightbox');
  await page.locator('#lightbox-close').click();
  assert.equal(await page.locator('#image-lightbox').isVisible(), false, 'lightbox should close');
  const firstCorrect = story.quiz[0].correct_option;
  await page.locator('#quiz .q').first().locator('.options button').nth(firstCorrect).click();
  assert.equal(await page.locator('#quiz .q').first().locator('.explain').count(), 1, 'quiz answer feedback should render');
  await page.locator('#theme-toggle').click();
  assert.equal(await page.locator('body').getAttribute('data-theme'), 'light', 'theme toggle should switch to light mode');
  assert.equal(await page.locator('#sources a').count(), story.sources.length, 'all sources should render');
  assert.equal(await page.locator('#title').textContent(), story.i18n.en.title);
  await page.screenshot({ path: path.join(artifactDir, 'v2-story-desktop-en-light.png'), fullPage: true, animations: 'disabled' });

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
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
  assert.ok((await mobile.locator('#gallery figcaption').first().textContent()).includes(story.images[0].i18n.fr.caption), 'gallery caption should switch to French');
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, 'mobile story page must not overflow horizontally; measured ' + overflow + 'px');
  await mobile.screenshot({ path: path.join(artifactDir, 'v2-story-mobile-fr.png'), fullPage: true, animations: 'disabled' });
  assert.deepEqual(errors, [], 'V2 story page should not throw browser errors');
  console.log(JSON.stringify({ ok: true, story: story.slug, languagesChecked: ['ar','en','fr'], quizQuestions: story.quiz.length, galleryImages: story.images.length, sources: story.sources.length, mobileOverflowPx: overflow, screenshots: artifactDir }, null, 2));
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close().catch(() => {});
  if (server) await new Promise(resolve => server.close(resolve));
  fs.rmSync(temp, { recursive: true, force: true });
});
