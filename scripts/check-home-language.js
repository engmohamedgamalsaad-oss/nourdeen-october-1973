'use strict';
/* Static + unit regression checks for the homepage-only language flow.
   Node built-ins only (no install step). Run from the repository root:  node scripts/check-home-language.js

   What this proves (and what it does NOT):
   - proves: the shared script is wired correctly on every visitor page, resolves, loads first,
     German stays gated, files were not deleted, and the shared script behaves correctly across
     storage states (run in a sandbox with a fake DOM).
   - does NOT prove: real rendering, RTL layout, wrapping, print/share, reactions. Those need a
     browser: see scripts/e2e-language-flow.mjs. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = process.cwd();
const SHARED = 'assets/shared/home-language-only.js';
const HOME = 'index.html';
const SUPPORTED = ['ar', 'en', 'fr', 'it'];
/* لوحات الإدارة: ليست صفحات زوار، ولا تحمّل سكربت اللغة. */
const ADMIN_PAGES = new Set(['admin.html', 'admin-all.html', 'khaledoon/admin.html', 'khaledoon/preview.html', 'khaledoon/sections-admin.html', 'khaledoon/prompts-admin.html']);
/* تعارضات موثّقة تنتظر قرار صاحب المشروع (لا تُعدَّل بصمت). */
const KNOWN_LANG_PARAM_LINKS = {
  'read.html': 'رابط «اقرأ بالعربية» داخل صفحة قراءة حكاية الطلاب يضيف ?lang=ar، والقفل الموحد يزيله (موثّق في التقرير).'
};

const failures = [];
const notes = [];
const fail = (m) => failures.push(m);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}
const exists = (rel) => fs.existsSync(path.join(root, rel));
const read = (rel) => {
  try { return fs.readFileSync(path.join(root, rel), 'utf8'); }
  catch (e) { fail(`Missing file: ${rel}`); return ''; }
};
const resolveRef = (fromRel, ref) =>
  path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), ref.split('#')[0].split('?')[0]));
const isExternalRef = (ref) => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref);

/* ---------- 1) الملف المشترك: بنية ثابتة ---------- */
const shared = read(SHARED);
if (!/var SUPPORTED = \['ar', 'en', 'fr', 'it'\];/.test(shared)) fail('Shared script: SUPPORTED must be exactly [ar,en,fr,it].');
if (/SUPPORTED\s*=\s*\[[^\]]*['"]de['"]/.test(shared)) fail('Shared script: German (de) must stay out of SUPPORTED until fully translated.');
if (!/var KEY = 'kh-lang';/.test(shared)) fail("Shared script: unified storage key must be 'kh-lang'.");
if (!/LEGACY_KEYS = \['lang'\];/.test(shared)) fail("Shared script: legacy key 'lang' must still be honoured.");
if (!shared.includes('localStorage.setItem(KEY, lang)')) fail('Shared script: legacy -> unified key migration is missing.');
if (!shared.includes("searchParams.delete('lang')") || !shared.includes('history.replaceState')) fail('Shared script: stale ?lang= removal is missing.');
if (!shared.includes('KH_LANG')) fail('Shared script: KH_LANG central config is missing.');
{
  const home = shared.indexOf('if (isHome) return;');
  const hide = shared.indexOf("createElement('style')");
  if (home < 0 || hide < 0 || home > hide) fail('Shared script: home mode must return before the switcher-hiding style is injected.');
}

/* ---------- 2) اختبار سلوكي للملف المشترك (sandbox) ---------- */
function runShared({ store = {}, url = 'https://x.test/p/', role = '', preload = false }) {
  const calls = { styles: 0, replaced: null };
  const storage = {
    data: { ...store },
    getItem(k) { return k in this.data ? this.data[k] : null; },
    setItem(k, v) { this.data[k] = String(v); }
  };
  const documentElement = { lang: 'ar', dir: 'rtl' };
  const document = {
    documentElement,
    head: { appendChild() { calls.styles++; } },
    createElement() { return { setAttribute() {}, textContent: '' }; },
    currentScript: { getAttribute: (n) => (n === 'data-role' ? role : null) }
  };
  const loc = new URL(url);
  const window = {};
  const sandbox = {
    window, document, localStorage: storage, URL, Object, String,
    location: { get href() { return loc.href; } },
    history: { state: null, replaceState(_s, _t, u) { calls.replaced = u; } }
  };
  sandbox.window = sandbox; /* window === global في المتصفح */
  vm.createContext(sandbox);
  vm.runInContext(shared, sandbox);
  if (preload) vm.runInContext(shared, sandbox);
  return { lang: documentElement.lang, dir: documentElement.dir, store: storage.data, calls, api: sandbox.KH_LANG };
}
function expect(label, got, want) {
  if (JSON.stringify(got) !== JSON.stringify(want)) fail(`Unit [${label}]: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
}
if (shared) {
  try {
    let r = runShared({});
    expect('empty storage -> ar/rtl', [r.lang, r.dir, 'kh-lang' in r.store], ['ar', 'rtl', false]);
    for (const l of ['en', 'fr', 'it']) {
      r = runShared({ store: { 'kh-lang': l } });
      expect(`kh-lang=${l} -> ltr`, [r.lang, r.dir], [l, 'ltr']);
    }
    r = runShared({ store: { 'kh-lang': 'EN' } });
    expect('uppercase kh-lang normalised', r.lang, 'en');
    r = runShared({ store: { lang: 'it' } });
    expect('legacy lang=it migrated', [r.lang, r.store['kh-lang'], r.store.lang], ['it', 'it', 'it']);
    r = runShared({ store: { 'kh-lang': 'de', lang: 'en' } });
    expect('unsupported unified value falls through to valid legacy', [r.lang, r.store['kh-lang']], ['en', 'en']);
    r = runShared({ store: { 'kh-lang': 'de' } });
    expect('German alone is not applied and storage untouched', [r.lang, r.dir, r.store['kh-lang']], ['ar', 'rtl', 'de']);
    r = runShared({ store: { 'kh-lang': 'fr' }, url: 'https://x.test/p/?lang=en&id=5#sec' });
    expect('inner page strips only lang and keeps id/hash', [r.calls.replaced, r.lang, r.api.locked, r.calls.styles], ['/p/?id=5#sec', 'fr', true, 1]);
    r = runShared({ store: { 'kh-lang': 'fr' }, url: 'https://x.test/p/?id=5' });
    expect('no lang param -> URL untouched', r.calls.replaced, null);
    r = runShared({ store: { 'kh-lang': 'en' }, role: 'home', url: 'https://x.test/?lang=fr' });
    expect('home mode: not locked, no hiding style, URL untouched', [r.api.locked, r.calls.styles, r.calls.replaced, r.lang], [false, 0, null, 'en']);
    r = runShared({ store: { 'kh-lang': 'it' }, preload: true });
    expect('double load is harmless', [r.lang, r.calls.styles], ['it', 1]);
    r = runShared({});
    try { r.api.supported.push('de'); } catch (e) { /* frozen: expected */ }
    expect('supported list is frozen', r.api.supported.length, 4);
  } catch (e) { fail(`Unit sandbox crashed: ${e.message}`); }
}

/* ---------- 3) كل صفحات HTML ---------- */
const htmlFiles = walk('').filter((f) => f.endsWith('.html')).sort();
let visitorPages = 0, stubs = 0;
for (const rel of htmlFiles) {
  const html = read(rel);
  const isHome = rel === HOME;
  const isAdmin = ADMIN_PAGES.has(rel);
  const isStub = /<meta[^>]+http-equiv=["']refresh["']/i.test(html);

  /* German overlay must not be wired anywhere */
  if (html.includes('khaledoon-de.js')) fail(`German-only overlay is referenced by ${rel}; it must stay disabled until full German coverage.`);

  /* local script/css paths must resolve to real files */
  for (const m of html.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/gi)) {
    if (isExternalRef(m[1])) continue;
    if (m[1].startsWith('/')) { fail(`Root-absolute script path breaks under the project sub-path: ${rel} -> ${m[1]}`); continue; }
    const r = resolveRef(rel, m[1]);
    if (!exists(r)) fail(`Broken script path in ${rel}: ${m[1]} -> ${r}`);
  }
  for (const m of html.matchAll(/<link[^>]*rel=["'][^"']*stylesheet[^"']*["'][^>]*>/gi)) {
    const h = m[0].match(/href=["']([^"']+)["']/i);
    if (!h || isExternalRef(h[1])) continue;
    const r = resolveRef(rel, h[1]);
    if (!exists(r)) fail(`Broken stylesheet path in ${rel}: ${h[1]} -> ${r}`);
  }

  /* ?lang= links */
  const langLinks = (html.match(/[?&]lang=/g) || []).length;
  if (langLinks && !KNOWN_LANG_PARAM_LINKS[rel]) fail(`${rel} contains ${langLinks} hard-coded ?lang= link(s); inner pages must follow the homepage language.`);

  if (isAdmin) continue;

  /* locate the shared-script tag(s) */
  const tags = [...html.matchAll(/<script[^>]*\ssrc=["']([^"']*home-language-only\.js[^"']*)["'][^>]*>/gi)];
  if (isHome) {
    if (tags.length !== 1) { fail('Homepage must include the shared language script exactly once.'); continue; }
    if (!/data-role=["']home["']/.test(tags[0][0])) fail('Homepage must load the shared script with data-role="home" (its chooser must stay visible).');
    if (resolveRef(rel, tags[0][1]) !== SHARED) fail(`Homepage shared-script path resolves to ${resolveRef(rel, tags[0][1])}`);
    if (html.search(/<script\b/i) !== tags[0].index) fail('Homepage: the shared language script must be the first <script>.');
    const chooser = (html.match(/<button[^>]*\sdata-l=["']\d["']/g) || []).length;
    if (chooser !== SUPPORTED.length) fail(`Homepage chooser has ${chooser} language buttons; expected ${SUPPORTED.length} (German must stay hidden).`);
    continue;
  }
  if (isStub && tags.length === 0) { stubs++; continue; } /* صفحة تحويل فقط */
  visitorPages++;
  if (tags.length !== 1) { fail(`${rel}: shared language script must appear exactly once (found ${tags.length}).`); continue; }
  const tag = tags[0];
  if (/data-role=["']home["']/.test(tag[0])) fail(`${rel}: only the homepage may use data-role="home".`);
  const resolved = resolveRef(rel, tag[1]);
  if (resolved !== SHARED) fail(`${rel}: shared script path ${tag[1]} resolves to ${resolved}`);
  else if (!exists(resolved)) fail(`${rel}: shared script file not found at ${resolved}`);

  /* ترتيب التحميل: قبل أي سكربت خارجي آخر */
  const before = html.slice(0, tag.index);
  for (const m of before.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/gi)) {
    if (!/home-language-only/.test(m[1])) fail(`${rel}: external script ${m[1]} loads before the shared language script.`);
  }
  /* السكربتات المضمّنة قبله مسموحة فقط إذا لم تغيّر اللغة أو تقرأها من الرابط */
  for (const m of before.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (/setItem\(|searchParams|URLSearchParams|[?&]lang=/.test(m[1])) fail(`${rel}: an inline script before the shared script changes or reads the language from the URL.`);
  }
  /* ترتيب التحميل: قبل سكربتات الترجمة */
  const tr = html.search(/<script[^>]*\ssrc=["'][^"']*(?:i18n(?:-extra)?\.js|translations\.js|page\.js)/i);
  if (tr >= 0 && tag.index > tr) fail(`${rel}: shared language script must precede the translation scripts.`);
}

/* ---------- 4) المحرك المشترك يلتزم بالقفل ---------- */
const engine = read('assets/shared/i18n.js');
if (!/function readLang\(\)\{\s*[^]*?KH_LANG\.locked\)return window\.KH_LANG\.current/.test(engine)) fail('assets/shared/i18n.js: readLang() must ignore ?lang= when KH_LANG.locked.');
if (!/function setLang\(lang\)\{\s*if\(window\.KH_LANG&&window\.KH_LANG\.locked\)return/.test(engine)) fail('assets/shared/i18n.js: setLang() must be a no-op when KH_LANG.locked.');
if (!engine.includes('window.KH_LANG.supported')) fail('assets/shared/i18n.js: language list must come from KH_LANG.');

/* ---------- 5) لا حذف: كل ملفات الحكايات المتوقعة موجودة ---------- */
const manifestPath = 'scripts/expected-story-files.json';
if (!exists(manifestPath)) fail(`${manifestPath} is missing.`);
else {
  const expected = JSON.parse(read(manifestPath));
  const missing = expected.files.filter((f) => !exists(f));
  if (missing.length) fail(`Deleted/missing expected story files (${missing.length}): ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ', ...' : ''}`);
  else notes.push(`${expected.files.length} expected story files present`);
}

if (failures.length) {
  console.error('Homepage language-flow checks FAILED:\n- ' + failures.join('\n- '));
  process.exitCode = 1;
} else {
  console.log(`Homepage language-flow checks passed: ${visitorPages} visitor pages + homepage, ${stubs} redirect stubs, ${ADMIN_PAGES.size} admin pages exempt; AR/EN/FR/IT; German gated; ${notes.join('; ')}.`);
}
