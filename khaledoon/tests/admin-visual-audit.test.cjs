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
    sources:'مصدر تجريبي', consent:true, created_at:'2026-10-18T09:00:00Z', translations:{}, story_meta:{} },
  { id:'visual-published-004', status:'published', section:'science', title:'اختبار بصري — حكاية منشورة',
    subtitle:'سجل منشور وهمي لا يمثل حكاية حقيقية', figure_name:'عالم منشور تجريبي', narrator_name:'راوٍ تجريبي',
    narrator_grade:'الصف الأول الإعدادي', original_body:'النص الأصلي المنشور الوهمي.',
    body:'نص وهمي لاختبار فتح محرر السجل المنشور ونقل نسخته الجديدة دون تعديل النسخة الحية.',
    sources:'مصدر تجريبي', consent:true, created_at:'2026-10-17T09:00:00Z', translations:{},
    story_meta:{ preview_review:{ decision:'published', static_story_id:'098', static_story_path:'stories/science/098/' } } },
  { id:'visual-linked-published-005', status:'published', section:'science', title:'فاروق الباز',
    subtitle:'سجل تحرير مرتبط صراحة بالصفحة المنشورة 012', figure_name:'فاروق الباز', narrator_name:'راوٍ تجريبي',
    narrator_grade:'الصف الأول الإعدادي', original_body:'نص أصلي تجريبي مرتبط بصفحة منشورة.',
    body:'نص تجريبي للتحقق من ظهور سجل التحرير المنشور داخل بطاقة صفحة الموقع.',
    sources:'مصدر تجريبي', consent:true, created_at:'2026-10-16T09:00:00Z', translations:{},
    story_meta:{ preview_review:{ decision:'published', static_story_id:'012', static_story_path:'stories/science/012/' } } }
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
      const submissionWrites = [];
      const submissionPatches = [];
      const publisherCalls = [];
      await page.route('https://**/*', route => route.abort());
      await page.route(SUPA + '/**', async route => {
        const req = route.request();
        const url = req.url();
        if (url.includes('/functions/v1/publish-story-pr')) {
          let payload = {};
          try { payload = JSON.parse(req.postData() || '{}'); } catch (_) {}
          publisherCalls.push(payload);
          return route.fulfill({ status:400, contentType:'application/json', body:JSON.stringify({ error:'legacy function does not support capabilities' }) });
        }
        if (url.includes('/rest/v1/khaledoon_submissions') && !['GET','HEAD','OPTIONS'].includes(req.method())) { submissionWrites.push(req.method() + ' ' + url); if(req.method()==='PATCH'){ try{submissionPatches.push(JSON.parse(req.postData()||'{}'))}catch(_){submissionPatches.push({})} } }
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

      // Exercise row-level edit/move actions against mock records only.
      const editableSummary = page.locator('summary').filter({ hasText:'اختبار بصري — حكاية مرسلة للمعاينة' }).first();
      await editableSummary.click();
      const editAction = page.getByRole('button', { name:'تعديل', exact:true }).first();
      await editAction.waitFor({ state:'visible', timeout:10000 });
      await editAction.click();
      await page.getByRole('textbox', { name:'الصق ناتج الذكاء الاصطناعي JSON' }).waitFor({ state:'visible', timeout:10000 });
      console.log('ok - row-level edit opens the editor for an ordinary draft (' + viewport.name + ')');
      const moveAction = page.getByRole('button', { name:'نقل الحكاية', exact:true }).first();
      await moveAction.click();
      await page.getByRole('button', { name:'تأكيد النقل', exact:true }).waitFor({ state:'visible', timeout:10000 });
      await page.getByRole('button', { name:'إلغاء', exact:true }).last().click();
      console.log('ok - row-level move opens and closes its section panel (' + viewport.name + ')');

      // Published rows must also open the editor, and a move must be staged without changing the published row itself.
      const publishedSummary = page.locator('summary').filter({ hasText:'اختبار بصري — حكاية منشورة' }).first();
      await publishedSummary.click();
      const publishedRow = publishedSummary.locator('xpath=..');
      await publishedRow.getByRole('button', { name:'تعديل', exact:true }).click();
      await publishedRow.getByRole('textbox', { name:'الصق ناتج الذكاء الاصطناعي JSON' }).waitFor({ state:'visible', timeout:10000 });
      console.log('ok - row-level edit opens the editor for a published story (' + viewport.name + ')');
      await publishedRow.getByRole('button', { name:'نقل الحكاية', exact:true }).click();
      await publishedRow.locator('.move-story-panel select').first().selectOption('history');
      const patchesBeforeMove = submissionPatches.length;
      const movePatchResponse = page.waitForResponse(response => response.url().includes('/rest/v1/khaledoon_submissions') && response.request().method()==='PATCH');
      await publishedRow.getByRole('button', { name:'تأكيد النقل', exact:true }).click();
      await movePatchResponse;
      const movePatch = submissionPatches.slice(patchesBeforeMove).find(p => p.story_meta && p.story_meta.pending_draft);
      assert.ok(movePatch, 'moving a published story must persist a pending draft');
      assert.equal(movePatch.story_meta.pending_draft.section, 'history', 'pending draft should use the destination section');
      assert.equal(movePatch.status, undefined, 'move must not overwrite the published status');
      assert.equal(movePatch.section, undefined, 'move must not change the published section before review');
      console.log('ok - published story move is staged as a draft without changing live fields (' + viewport.name + ')');

      // Published static pages must retain their explicitly linked database editor instead of hiding it.
      const siteSummary = page.locator('summary').filter({ hasText:'فاروق الباز' }).first();
      await siteSummary.click();
      const siteRow = siteSummary.locator('xpath=..');
      const linkedRecordSummary = siteRow.locator('details.fcard > summary').first();
      await linkedRecordSummary.waitFor({ state:'visible', timeout:10000 });
      await linkedRecordSummary.click();
      await siteRow.getByRole('textbox', { name:'العنوان' }).first().waitFor({ state:'visible', timeout:10000 });
      console.log('ok - explicitly linked published record remains editable under its site page (' + viewport.name + ')');

      // Exercise the user's one-button AI import lock cycle with invalid content only.
      // This must never write to Supabase; only the fake read endpoints are available.
      await page.goto('http://127.0.0.1:' + PORT + '/khaledoon/admin.html?editcode=visual-preview-001', { waitUntil:'domcontentloaded' });
      const targetCard = page.locator('summary').filter({ hasText:'اختبار بصري — حكاية مرسلة للمعاينة' }).first();
      const targetDetails = targetCard.locator('xpath=..');
      await page.waitForFunction(() => { const s=[...document.querySelectorAll('summary')].find(el=>el.textContent.includes('اختبار بصري — حكاية مرسلة للمعاينة')); return !!s && !!s.parentElement.open; });
      const aiTextarea = page.getByRole('textbox', { name:'الصق ناتج الذكاء الاصطناعي JSON' });
      const aiApply = page.getByRole('button', { name:'تعديل ناتج الذكاء الاصطناعي أو تطبيقه وقفل الخانة' });
      await aiTextarea.waitFor({ state:'visible', timeout:10000 });
      assert.equal(await aiTextarea.evaluate(el => el.readOnly), false, 'AI textarea should begin unlocked');
      const writesBeforePaste = submissionWrites.length;
      await aiTextarea.fill('not JSON at all ###');
      await page.waitForTimeout(150);
      assert.equal(submissionWrites.length, writesBeforePaste, 'pasting alone must not write or import');
      await aiApply.click();
      await page.waitForFunction(() => { const el=document.querySelector('[aria-label="الصق ناتج الذكاء الاصطناعي JSON"]'); return !!el && el.readOnly; });
      assert.equal(await aiTextarea.inputValue(), 'not JSON at all ###', 'failed import must preserve the pasted text');
      await aiApply.click();
      await page.waitForFunction(() => { const el=document.querySelector('[aria-label="الصق ناتج الذكاء الاصطناعي JSON"]'); return !!el && !el.readOnly; });
      await aiTextarea.fill('still not JSON ###');
      await aiApply.click();
      await page.waitForFunction(() => { const el=document.querySelector('[aria-label="الصق ناتج الذكاء الاصطناعي JSON"]'); return !!el && el.readOnly; });
      assert.equal(await aiTextarea.inputValue(), 'still not JSON ###', 'third click must execute again and relock without losing text');
      assert.equal(submissionWrites.length, writesBeforePaste, 'invalid AI packages must never write to Supabase');
      console.log('ok - AI textarea paste/execute/unlock/execute lock cycle (' + viewport.name + ')');

      // A non-October legacy story must be stopped before the old publisher or any upload request.
      const approvedSummary = page.locator('summary').filter({ hasText:'اختبار بصري — حكاية بانتظار النشر' }).first();
      await approvedSummary.click();
      const approvedCard = approvedSummary.locator('xpath=..');
      const writesBeforePublisherProbe = submissionWrites.length;
      const publishButton = approvedCard.getByRole('button', { name:'نشر الحكاية' });
      await publishButton.waitFor({ state:'visible' });
      await publishButton.scrollIntoViewIfNeeded();
      await publishButton.click();
      await page.getByText(/هذه الحكاية خارج قسم أكتوبر ولم تُحوّل بعد إلى حزمة القالب الموحد/).waitFor({ state:'visible', timeout:10000 });
      assert.equal(publisherCalls.length, 0, 'non-October legacy story must be blocked before calling the publisher');
      assert.equal(submissionWrites.length, writesBeforePublisherProbe, 'blocked legacy story must not cause a submission write');
      console.log('ok - non-October legacy publisher is blocked before upload (' + viewport.name + ')');

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
