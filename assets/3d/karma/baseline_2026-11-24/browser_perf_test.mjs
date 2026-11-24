import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repoRoot = path.resolve(process.cwd(), '../../../../');
const port = 4179;
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.glb':'model/gltf-binary', '.png':'image/png', '.json':'application/json' };
const server = http.createServer((req,res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const target = path.resolve(repoRoot, '.' + pathname);
  if (target !== repoRoot && !target.startsWith(repoRoot + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(target, (err,data) => {
    if (err) { res.writeHead(404).end(String(err)); return; }
    res.writeHead(200, { 'content-type': mime[path.extname(target)] || 'application/octet-stream', 'cache-control':'no-store' });
    res.end(data);
  });
});
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless:true, args:['--no-sandbox','--enable-webgl','--use-gl=swiftshader','--disable-dev-shm-usage'] });
const models = [
  { name:'baseline', url:'/assets/3d/karma/baseline_2026-11-24/karma_skinned_baseline_NOT_FINAL.glb' },
  { name:'weights_v2_experiment', url:'/assets/3d/karma/rig_tests_2026-11-24/weights_v2_test/EXPERIMENT_NOT_FINAL_karma_skinned_baseline_weights_v2.glb' }
];
const karmaRoot = path.join(repoRoot, 'assets/3d/karma');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes:true }).flatMap(entry => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return entry.name === 'archive_2026-11-24' ? [] : walk(full);
  return entry.isFile() && entry.name.toLowerCase().endsWith('.glb') && !entry.name.toLowerCase().includes('not_final') ? [full] : [];
});
const known = new Set(models.map(model => path.resolve(repoRoot, '.' + model.url)));
for (const full of walk(karmaRoot)) {
  if (known.has(path.resolve(full))) continue;
  models.push({
    name:'final_' + path.basename(full, '.glb').replace(/[^a-z0-9_-]/gi, '_'),
    url:'/' + path.relative(repoRoot, full).split(path.sep).join('/')
  });
}
const viewports = [
  { name:'desktop', width:1280, height:800 },
  { name:'mobile', width:390, height:844 }
];
const report = { environment:'Headless Chromium + SwiftShader (software WebGL; not a physical-device benchmark)', results:[] };
try {
  for (const model of models) for (const viewport of viewports) {
    const context = await browser.newContext({ viewport:{width:viewport.width,height:viewport.height}, deviceScaleFactor:1, isMobile:viewport.name==='mobile', hasTouch:viewport.name==='mobile' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('requestfailed', req => errors.push(req.url() + ': ' + (req.failure()?.errorText || 'request failed')));
    page.on('console', msg => { if (msg.type()==='error') errors.push(msg.text()); });
    await page.addInitScript(() => {
      window.__bootError = null;
      window.addEventListener('error', e => { window.__bootError = e.message || String(e.error); });
      window.addEventListener('unhandledrejection', e => { window.__bootError = String(e.reason); });
    });
    const url = `http://127.0.0.1:${port}/assets/3d/karma/baseline_2026-11-24/browser_perf_page.html?model=${encodeURIComponent(model.url)}`;
    const response = await page.goto(url, { waitUntil:'domcontentloaded', timeout:90000 });
    if (!response || !response.ok()) throw new Error('Preview page HTTP failure: ' + (response?.status() ?? 'no response') + ' ' + url);
    await page.waitForFunction(() => window.__karmaLoaded === true || !!window.__bootError, { timeout:90000 });
    const bootError = await page.evaluate(() => window.__bootError);
    if (bootError) throw new Error('Karma browser boot failed: ' + bootError);
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.__startPerf());
    const actions = await page.evaluate(() => window.__runSixActions());
    await page.waitForTimeout(500);
    const perf = await page.evaluate(() => window.__stopPerf());
    report.results.push({ model:model.name, viewport:viewport.name, actions, perf, errors });
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
const out = process.argv[2] || 'RESULT_browser_perf.json';
fs.writeFileSync(out, JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
const bad = report.results.some(r => r.errors.length || Object.values(r.actions).some(a => !a.completed) || !r.perf.frameSamples);
if (bad) process.exitCode = 1;
