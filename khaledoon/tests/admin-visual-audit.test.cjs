/* Desktop/mobile visual smoke audit for the admin and manual builder.
   Uses only fake records and intercepts every Supabase request; no real DB writes. */
'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const PORT = 4174;
const SUPA = 'https://ypwprddkscnfblhftkeb.supabase.co';
const OUT = path.join(ROOT, 'artifacts', 'admin-visual-audit');

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

const records = [
  { id:'visual-preview-001', status:'pending', section:'history', title:'اختبار بصري — حكاية مرسلة للمعاينة',
    subtitle:'بيانات وهمية لفحص واجهة الإدارة فقط', figure_name:'شخصية اختبارية', narrator_name:'راوٍ تجريبي',
    narrator_grade:'الصف الأول الإعدادي', original_body:'هذا نص أصلي وهمي ثابت لاختبار الواجهة فقط.',
    body:'هذا نص تجريبي طويل بما يكفي لمعاينة بطاقة الإدارة والتأكد من التفاف النص على الهاتف والكمبيوتر.',
    sources:'مصدر تجريبي — https://example.invalid/source', consent:true,
    created_at:'2026-10-20T09:00:00Z', translations:{},
    story_meta:{ preview_review:{ decision:'sent', sent_at:'2026-10-20T09:01:00Z' } } },
  { id:'visual-review-002', status:'review', section:'science', title:'اختبار بصري — حكاية بانتظار النشر',
    subtitle:'سجل وهمي لا يمثل حكاية حقيقية', figure_name:'عالم تجريبي', narrator_name:'راوٍ تجريبي',
    narrator_grade:'الصف الأول الإعدادي', original_body:'النص الأصلي الوهمي الثاني الذي يجب ألا يتغير.',
    body:'نص معاينة وهمي آخر لاختبار عرض حالة انتظار النشر والأزرار في البطاقة.',
    sources:'مصدر تجريبي — https://example.invalid/another-source', consent:true,
    created_at:'2026-10-19T09:00:00Z', translations:{},
    story_meta:{ preview_review:{ decision:'approved_waiting_for_github_upload', static_story_id:'099', static_story_path:'stories/history/099/' } } },
  { id:'visual-match-003', status:'pending', section:'science', title:'اختبار تطابق استرشادي بالاسم فقط',
    subtitle:'بيانات وهمية لاختبار التنبيه دون الربط التلقائي', figure_name:'أحمد زويل', narrator_name:'راوٍ تجريبي',
    narrator_grade:'الصف الأول الإعدادي', original_body:'نص وهمي ثالث ثابت.',
    body:'نص وهمي لاختبار التنبيه الاسترشادي عند تطابق اسم الشخصية مع صفحة موجودة.',
    sources:'مصدر تجريبي', consent:true, created_at:'2026-10-18T09:00:00Z', translations:{}, story_meta:{} }
];

async function main() {
  fs.mkdirSync(OUT, { recursive:true });
  const server = await serve();
  const browser = await chromium.launch({ headless:true });
  try {
    for (const viewport of [
      { name:'desktop', width:1440, height:1000 },
      { name:'mobile', width:390, height:844 }
    ]) {
      const context = await browser.newContext({ viewport:{ width:viewport.width, height:viewport.height }, deviceScaleFactor:1 });
      await context.addInitScript(() => {
        localStorage.setItem('kh-theme','dark');
        localStorage.setItem('kh_adm_session', JSON.stringify({
          access_token:'mock-access-token', refresh_token:'mock-refresh-token', expires_at:9999999999
        }));
        sessionStorage.setItem('kh_adm_session', localStorage.getItem('kh_adm_session'));
      });
      const page = await context.newPage();
      await page.route('https://**/*', route => route.abort());
      await page.route(SUPA + '/**', async route => {
        const req = route.request();
        const url = req.url();
        if (url.includes('/rest/v1/rpc/is_admin')) {
          return route.fulfill({ status:200, contentType:'application/json', body:'true' });
        }
        if (url.includes('/rest/v1/khaledoon_submissions')) {
          return route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(records) });
        }
        if (url.includes('/rest/v1/story_visibility')) {
          return route.fulfill({ status:200, contentType:'application/json', body:'[]' });
        }
        if (url.includes('/rest/v1/khaledoon_admin_config')) {
          return route.fulfill({ status:200, contentType:'application/json', body:'[]' });
        }
        if (url.includes('/rest/v1/story_reaction_counts')) {
          return route.fulfill({ status:200, contentType:'application/json', body:'[]' });
        }
        return route.fulfill({ status:200, contentType:'application/json', body:'[]' });
      });
      await page.goto('http://127.0.0.1:' + PORT + '/khaledoon/admin.html', { waitUntil:'domcontentloaded' });
      await page.locator('#app').waitFor({ state:'visible', timeout:15000 });
      await page.getByText('اختبار بصري — حكاية مرسلة للمعاينة').waitFor({ state:'visible', timeout:15000 });
      await page.getByText(/تنبيه: قد تطابق صفحة/).waitFor({ state:'visible', timeout:10000 });
      await page.screenshot({ path:path.join(OUT, 'admin-' + viewport.name + '-dark.png'), fullPage:true });
      await page.locator('#th').click();
      await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light');
      await page.screenshot({ path:path.join(OUT, 'admin-' + viewport.name + '-light.png'), fullPage:true });
      const lightOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(lightOverflow <= 2, 'Admin horizontal overflow in light theme on ' + viewport.name + ': ' + lightOverflow + 'px');
      await page.locator('#th').click();
      await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark');
      const adminOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(adminOverflow <= 2, 'Admin horizontal overflow on ' + viewport.name + ': ' + adminOverflow + 'px');
      console.log('ok - admin loaded and no horizontal overflow (' + viewport.name + ')');

      const builder = await context.newPage();
      await builder.goto('http://127.0.0.1:' + PORT + '/khaledoon/story-builder.html', { waitUntil:'domcontentloaded' });
      await builder.locator('#title').waitFor({ state:'visible', timeout:10000 });
      assert.equal(await builder.locator('details.lang').count(), 4, 'Builder must expose four collapsible translation panels');
      assert.ok(await builder.locator('#tr_de_title').count(), 'German translation fields must remain in the form when collapsed');
      assert.equal(await builder.locator('details.lang[open]').count(), 1, 'Only English should open by default to reduce initial scroll');
      await builder.screenshot({ path:path.join(OUT, 'builder-' + viewport.name + '.png'), fullPage:true });
      const builderOverflow = await builder.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(builderOverflow <= 2, 'Manual builder horizontal overflow on ' + viewport.name + ': ' + builderOverflow + 'px');
      console.log('ok - manual builder loaded and no horizontal overflow (' + viewport.name + ')');
      await context.close();
    }
    console.log('Saved four desktop/mobile admin and builder screenshots using mock data only.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
