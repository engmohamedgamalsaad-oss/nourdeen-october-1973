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
const models = [];
// Compare the current weight-ramp experiment, a validated optimization candidate,
// and any newly delivered final GLBs from either branch checkout.
const baseExperimentUrl = '/base-work/assets/3d/karma/rig_tests_2026-11-24/weights_v2_test/EXPERIMENT_NOT_FINAL_karma_skinned_baseline_weights_v2.glb';
if (fs.existsSync(path.join(repoRoot, baseExperimentUrl.slice(1)))) {
  models.push({ name:'weights_v2_experiment', url:baseExperimentUrl });
}
const integratedUrl = '/base-work/assets/3d/karma/integrated_v1_2026-11-24/EXPERIMENT_NOT_FINAL_karma_integrated_v1.glb';
const integratedReport = path.join(repoRoot, 'assets/3d/karma/baseline_2026-11-24/RESULT_integrated_v1.json');
if (fs.existsSync(path.join(repoRoot, integratedUrl.slice(1))) && fs.existsSync(integratedReport)) {
  try {
    const result = JSON.parse(fs.readFileSync(integratedReport, 'utf8'));
    if (result.tests?.rigAndMotionPass) models.push({ name:'integrated_v1_experiment', url:integratedUrl });
  } catch {}
}
const optimizedUrl = '/assets/3d/karma/baseline_2026-11-24/karma_weights_v2_optimized_NOT_FINAL.glb';
if (fs.existsSync(path.join(repoRoot, optimizedUrl.slice(1)))) {
  models.push({ name:'optimized_experiment', url:optimizedUrl });
}
const karmaRoots = [
  path.join(repoRoot, 'assets/3d/karma'),
  path.join(repoRoot, 'base-work/assets/3d/karma')
].filter(fs.existsSync);
const walk = (dir) => fs.readdirSync(dir, { withFileTypes:true }).flatMap(entry => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return entry.name === 'archive_2026-11-24' ? [] : walk(full);
  return entry.isFile() && entry.name.toLowerCase().endsWith('.glb') && !entry.name.toLowerCase().includes('not_final') ? [full] : [];
});
const known = new Set(models.map(model => path.resolve(repoRoot, '.' + model.url)));
for (const root of karmaRoots) for (const full of walk(root)) {
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
    page.setDefaultTimeout(60000);
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
    console.log(`[${model.name}/${viewport.name}] opening preview`);
    const response = await page.goto(url, { waitUntil:'domcontentloaded', timeout:90000 });
    if (!response || !response.ok()) throw new Error('Preview page HTTP failure: ' + (response?.status() ?? 'no response') + ' ' + url);
    await page.waitForFunction(() => window.__karmaLoaded === true || !!window.__bootError, null, { timeout:90000 });
    const bootError = await page.evaluate(() => window.__bootError);
    if (bootError) throw new Error('Karma browser boot failed: ' + bootError);
    console.log(`[${model.name}/${viewport.name}] GLB loaded; running six actions`);
    await page.evaluate(() => window.__startPerf());
    const actions = await page.evaluate(() => window.__runSixActions());
    const perf = await page.evaluate(() => window.__stopPerf());
    report.results.push({ model:model.name, viewport:viewport.name, actions, perf, errors });
    console.log(`[${model.name}/${viewport.name}] done: ${perf.renderThroughputFps} render-throughput fps, ${perf.p95RenderCallMs} ms p95`);
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
const out = process.argv[2] || 'RESULT_browser_perf.json';
fs.writeFileSync(out, JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
const bad = report.results.some(r =>
  r.errors.length ||
  Object.values(r.actions).some(a => !a.completed) ||
  r.actions.leanOn.state !== 'lean' ||
  r.actions.stand.state !== 'idle' ||
  !r.perf.renderSamples
);
if (bad) process.exitCode = 1;
