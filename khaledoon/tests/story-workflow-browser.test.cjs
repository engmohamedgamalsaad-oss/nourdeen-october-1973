/* Headless browser checks for the real preview page.
   All Supabase endpoints are intercepted and use fake records only. */
'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const PORT = 4173;
const SUPA = 'https://ypwprddkscnfblhftkeb.supabase.co';
const IDS = {
  manual: '11111111-1111-4111-8111-111111111111',
  ai: '22222222-2222-4222-8222-222222222222'
};

function serve() {
  const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
    '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
    '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp' };
  const server = http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
    catch (_) { res.writeHead(400); return res.end('Bad URL'); }
    const file = path.resolve(ROOT, '.' + pathname);
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

function fakeStory(id, mode) {
  return {
    id, status: 'pending', section: 'history', title: 'اختبار متصفح ' + mode,
    subtitle: 'سجل تجريبي محلي لا يمثل حكاية منشورة',
    figure_name: 'شخصية تجريبية ' + mode, narrator_name: 'راوٍ تجريبي',
    narrator_grade: 'الصف الأول الإعدادي',
    original_body: 'هذا هو النص الأصلي التجريبي الثابت الذي يجب ألا يتغير.',
    body: 'هذا متن تجريبي للحكاية يستخدم فقط لاختبار صفحة المعاينة. يحتوي على نص كافٍ لعرض قالب القارئ في المتصفح دون الاعتماد على حكاية منشورة.',
    sources: 'مصدر تجريبي — https://example.invalid/source',
    translations: {
      en: { title:'Browser test story', subtitle:'Mock only', karma_text:'Karma asks.', body:'A mock story.' },
      fr: { title:'Histoire de test', subtitle:'Simulation', karma_text:'Karma demande.', body:'Une histoire fictive.' },
      it: { title:'Storia di prova', subtitle:'Simulazione', karma_text:'Karma chiede.', body:'Una storia fittizia.' },
      de: { title:'Testgeschichte', subtitle:'Nur Testdaten', karma_text:'Karma fragt.', body:'Eine erfundene Testgeschichte.' }
    },
    story_meta: {
      source_mode: mode, preview_review: { decision: 'sent' }, section_key: 'science',
      cover: {
        url: 'https://images.example.org/cover.svg', alt: 'غلاف تجريبي', caption: 'غلاف اختبار',
        kind: 'illustration', source_name: 'مصدر تجريبي', source_url: 'https://example.invalid/cover',
        rights: 'رسم تجريبي',
        i18n: {
          en:{alt:'Test cover',caption:'Test cover',source_name:'Test source',rights:'Illustration'},
          fr:{alt:'Couverture test',caption:'Couverture test',source_name:'Source test',rights:'Illustration'},
          it:{alt:'Copertina test',caption:'Copertina test',source_name:'Fonte test',rights:'Illustrazione'},
          de:{alt:'Testtitelbild',caption:'Testtitelbild',source_name:'Testquelle',rights:'Illustration'}
        }
      },
      images: [
        {url:'https://images.example.org/gallery-a.svg',alt:'صورة أ',caption:'صورة أ',kind:'archival',source_name:'مصدر أ',source_url:'https://example.invalid/a',rights:'رسم تجريبي'},
        {url:'https://images.example.org/gallery-b.svg',alt:'صورة ب',caption:'صورة ب',kind:'diagram',source_name:'مصدر ب',source_url:'https://example.invalid/b',rights:'رسم تجريبي'}
      ]
    }
  };
}

async function main() {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  let passed = 0;
  try {
    for (const mode of ['manual', 'ai']) {
      for (const decision of ['reject', 'approve']) {
        const id = IDS[mode];
        const row = fakeStory(id, mode);
        let patched = null;
        const context = await browser.newContext({ acceptDownloads: true });
        const page = await context.newPage();

        await page.route('https://**/*', route => route.abort());
        await page.route('https://engmohamedgamalsaad-oss.github.io/nourdeen-october-1973/**', async route => {
          const url = new URL(route.request().url());
          const relative = url.pathname.replace(/^\/nourdeen-october-1973\//, '');
          const file = path.resolve(ROOT, relative);
          if (!relative || !file.startsWith(ROOT + path.sep)) return route.abort();
          const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
            '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
            '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp',
            '.woff2':'font/woff2', '.woff':'font/woff', '.ttf':'font/ttf' };
          try {
            const body = await fs.promises.readFile(file);
            return route.fulfill({ status:200, contentType:types[path.extname(file)]||'application/octet-stream', body });
          } catch (_) { return route.abort(); }
        });
        await page.route('https://images.example.org/**', route => route.fulfill({
          status: 200, contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#8ad9e8"/></svg>'
        }));
        await page.route(SUPA + '/**', async route => {
          const req = route.request();
          if (req.url().includes('/rest/v1/khaledoon_submissions')) {
            if (req.method() === 'GET') {
              return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([row]) });
            }
            if (req.method() === 'PATCH') {
              patched = req.postDataJSON();
              Object.assign(row, patched);
              return route.fulfill({ status: 200, contentType: 'application/json',
                body: JSON.stringify([Object.assign({}, row)]) });
            }
          }
          if (req.url().includes('/auth/v1/user')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id:'mock-admin' }) });
          }
          if (req.url().includes('/rest/v1/rpc/is_admin')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: 'true' });
          }
          return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        });

        await page.addInitScript(({ story, session }) => {
          localStorage.setItem('kh-story-preview-draft', JSON.stringify(story));
          localStorage.setItem('kh_adm_session', JSON.stringify(session));
          sessionStorage.setItem('kh_adm_session', JSON.stringify(session));
        }, { story: Object.assign({}, row, { submission_id: id, submission_table: 'khaledoon_submissions',
          section_key: 'history', section_label: 'التاريخ والحضارات', status_label: 'مرسلة للمعاينة' }),
          session: { access_token:'mock-access-token', refresh_token:'mock-refresh-token', expires_at: 9999999999 } });

        await page.goto('http://127.0.0.1:' + PORT + '/khaledoon/preview.html?story=1', { waitUntil:'domcontentloaded' });
        await page.locator('#reviewTitle').waitFor({ state:'visible', timeout:10000 });
        assert.match(await page.locator('#reviewTitle').innerText(), new RegExp(mode, 'i'));
        assert.match(await page.locator('#reviewMeta').innerText(), /الحالة الحالية|المعاينة|راجِع|راجع/i);

        const reader = page.frameLocator('#actualPagePreview');
        await reader.locator('h1').first().waitFor({ state:'visible', timeout:10000 });
        assert.match(await reader.locator('h1').first().innerText(), /اختبار متصفح/);
        const heroCover = reader.locator('.hero-art img').first();
        const modalCover = reader.locator('.story-splash .story-start-art img').first();
        await heroCover.waitFor({ state:'visible', timeout:10000 });
        await modalCover.waitFor({ state:'visible', timeout:10000 });
        assert.equal(await heroCover.getAttribute('src'), 'https://images.example.org/cover.svg',
          'saved story_meta.cover must render the cover in the hero');
        assert.equal(await modalCover.getAttribute('src'), 'https://images.example.org/cover.svg',
          'the intro modal must reuse the same saved cover');
        assert.equal(await reader.locator('.story-visual-gallery .story-image-card').count(), 2,
          'saved story_meta.images must render the gallery in the generated reader preview');
        assert.ok(await heroCover.evaluate(img => img.naturalWidth > 0), 'mock cover image must load in the reader preview');
        if (mode === 'manual' && decision === 'reject') {
          const screenshotDir = path.join(ROOT, 'artifacts', 'story-template-preview');
          fs.mkdirSync(screenshotDir, { recursive: true });
          await reader.locator('html').evaluate(el => el.setAttribute('data-theme', 'dark'));
          await reader.locator('.story-splash .story-start-card').screenshot({ path:path.join(screenshotDir, 'generated-story-desktop-dark.png') });
          await page.setViewportSize({ width:390, height:844 });
          await reader.locator('html').evaluate(el => el.setAttribute('data-theme', 'light'));
          await reader.locator('.story-splash .story-start-card').screenshot({ path:path.join(screenshotDir, 'generated-story-mobile-light.png') });
        }

        // Avoid creating a real ZIP or consulting the public story index in a test.
        await page.evaluate(() => {
          window.KHStoryBundle.download = async () => ({ id:'999', section:'history', path:'stories/history/999/', bundle:true });
        });

        if (decision === 'reject') {
          await page.locator('#rejectionReason').fill('سبب تجريبي للرفض');
          await page.locator('#rejectStoryBtn').click();
          await page.waitForFunction(() => document.getElementById('reviewMeta').innerText.includes('سبب الرفض محفوظ'));
          assert.equal(patched.status, 'pending');
          assert.equal(patched.story_meta.preview_review.decision, 'rejected');
          assert.equal(patched.story_meta.preview_review.reason, 'سبب تجريبي للرفض');
        } else {
          await page.locator('#approveStoryTopBtn').click();
          await page.waitForFunction(() => document.getElementById('reviewMeta').innerText.includes('لم تُنشر'));
          assert.equal(patched.status, 'review');
          assert.equal(patched.story_meta.preview_review.decision, 'approved_waiting_for_github_upload');
        }
        assert.equal(row.original_body, 'هذا هو النص الأصلي التجريبي الثابت الذي يجب ألا يتغير.');
        passed++;
        console.log('ok - headless preview ' + mode + '/' + decision);
        await context.close();
      }
    }
    console.log('Passed ' + passed + ' headless browser scenarios using mock records only.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
