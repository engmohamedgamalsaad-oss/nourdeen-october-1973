'use strict';
/* Static + unit regression checks for the shared five-language flow.
   Node built-ins only (no install step). Run from the repository root:  node scripts/check-home-language.js

   What this proves (and what it does NOT):
   - proves: the shared script is wired correctly on every visitor page, resolves, loads first,
     all five languages (ar/en/fr/it/de) are supported, every script compiles, every page that loads
     the legacy Khaledoon translation scripts also loads the German dictionary first, files were not
     deleted, and the shared script behaves correctly across storage states (sandbox with a fake DOM).
   - does NOT prove: real rendering, RTL layout, wrapping, print/share, reactions. Those need a
     browser: see scripts/e2e-language-flow.mjs. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = process.cwd();
const SHARED = 'assets/shared/home-language-only.js';
const HOME = 'index.html';
const SUPPORTED = ['ar', 'en', 'fr', 'it', 'de'];
/* الترجمة الألمانية مدمجة في مصدر اللغة المشترك؛ يمنع الرجوع إلى ملف منفصل قديم. */
const LEGACY_I18N_RE = /khaledoon(?:-pages-i18n|-i18n-extra)?\.js/;
/* لوحات الإدارة: ليست صفحات زوار، ولا تحمّل سكربت اللغة. */
const ADMIN_PAGES = new Set(['admin.html', 'admin-all.html', 'khaledoon/admin.html', 'khaledoon/preview.html', 'khaledoon/prompts-admin.html', 'khaledoon/sections-admin.html', 'khaledoon/story-builder.html', 'rebuild/reader.html', 'rebuild/package-review.html']);
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
if (!/var SUPPORTED = \['ar', 'en', 'fr', 'it', 'de'\];/.test(shared)) fail('Shared script: SUPPORTED must be exactly [ar,en,fr,it,de].');
if (!/var RTL = \['ar'\];/.test(shared)) fail("Shared script: only 'ar' may be RTL.");
if (!/var KEY = 'kh-lang';/.test(shared)) fail("Shared script: unified storage key must be 'kh-lang'.");
if (!/LEGACY_KEYS = \['lang'\];/.test(shared)) fail("Shared script: legacy key 'lang' must still be honoured.");
if (!shared.includes('localStorage.setItem(KEY, lang)')) fail('Shared script: legacy -> unified key migration is missing.');
if (!shared.includes("searchParams.delete('lang')") || !shared.includes('history.replaceState')) fail('Shared script: stale ?lang= removal is missing.');
if (!shared.includes('KH_LANG')) fail('Shared script: KH_LANG central config is missing.');
if (!shared.includes('registerDictionary: function')) fail('Shared script: locale dictionaries must register through KH_LANG.registerDictionary.');
if (!shared.includes('translate: function')) fail('Shared script: KH_LANG.translate must be available to every translation engine.');
if (/locked:\s*!isHome/.test(shared) || /createElement\(['"]style['"]\)/.test(shared) || /lang-selector\{display:none!important/.test(shared)) {
  fail('Shared script: language selectors must remain visible and usable on every page.');
}
if (!/locked:\s*false/.test(shared)) fail('Shared script: language changes must not be locked to the homepage.');

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
    for (const l of ['en', 'fr', 'it', 'de']) {
      r = runShared({ store: { 'kh-lang': l } });
      expect(`kh-lang=${l} -> ltr`, [r.lang, r.dir], [l, 'ltr']);
    }
    r = runShared({ store: { 'kh-lang': 'EN' } });
    expect('uppercase kh-lang normalised', r.lang, 'en');
    r = runShared({ store: { lang: 'it' } });
    expect('legacy lang=it migrated', [r.lang, r.store['kh-lang'], r.store.lang], ['it', 'it', 'it']);
    r = runShared({ store: { 'kh-lang': 'es', lang: 'en' } });
    expect('unsupported unified value falls through to valid legacy', [r.lang, r.store['kh-lang']], ['en', 'en']);
    r = runShared({ store: { 'kh-lang': 'es' } });
    expect('unsupported language alone is not applied and storage untouched', [r.lang, r.dir, r.store['kh-lang']], ['ar', 'rtl', 'es']);
    r = runShared({ store: { 'kh-lang': 'de' } });
    expect('German is applied as LTR', [r.lang, r.dir, r.store['kh-lang']], ['de', 'ltr', 'de']);
    const registered = r.api.registerDictionary('de', { 'Testschlüssel': 'Deutscher Text' });
    expect('shared registry accepts a German dictionary', registered, true);
    expect('shared registry returns German text', r.api.translate('de', 'Testschlüssel'), 'Deutscher Text');
    expect('shared registry does not invent missing translations', r.api.translate('de', 'missing'), '');
    expect('shared registry rejects unsupported locales', r.api.registerDictionary('es', { x: 'y' }), false);
    r = runShared({ store: { lang: 'de' } });
    expect('legacy lang=de migrated', [r.lang, r.store['kh-lang']], ['de', 'de']);
    r = runShared({ store: { 'kh-lang': 'fr' }, url: 'https://x.test/p/?lang=en&id=5#sec' });
    expect('inner page strips only lang and keeps id/hash', [r.calls.replaced, r.lang, r.api.locked, r.calls.styles], ['/p/?id=5#sec', 'fr', false, 0]);
    r = runShared({ store: { 'kh-lang': 'fr' }, url: 'https://x.test/p/?id=5' });
    expect('no lang param -> URL untouched', r.calls.replaced, null);
    r = runShared({ store: { 'kh-lang': 'en' }, role: 'home', url: 'https://x.test/?lang=fr' });
    expect('home mode: not locked, no hiding style, URL untouched', [r.api.locked, r.calls.styles, r.calls.replaced, r.lang], [false, 0, null, 'en']);
    r = runShared({ store: { 'kh-lang': 'it' }, preload: true });
    expect('double load is harmless', [r.lang, r.calls.styles], ['it', 0]);
    r = runShared({});
    try { r.api.supported.push('es'); } catch (e) { /* frozen: expected */ }
    expect('supported list is frozen', r.api.supported.length, 5);
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

  /* German dictionary is embedded in the shared language source, not loaded from a separate legacy file. */
  {
    const scripts = [...html.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/gi)].map((m) => m[1]);
    const oldAt = scripts.findIndex((s) => s.split('?')[0].endsWith('khaledoon-de.js'));
    if (oldAt >= 0) fail(`${rel}: obsolete standalone German dictionary is still loaded; use the shared locale registry.`);
    const legacyAt = scripts.findIndex((s) => LEGACY_I18N_RE.test(s.split('?')[0].split('/').pop()));
    const sharedAt = scripts.findIndex((s) => resolveRef(rel, s) === SHARED);
    if (legacyAt >= 0 && sharedAt < 0) fail(`${rel}: legacy translation engine requires the shared language source.`);
    if (legacyAt >= 0 && sharedAt > legacyAt) fail(`${rel}: shared language source must load before translation engines.`);
  }
  /* A language guard that lists en/fr/it without de (inline <head> scripts) leaves German pages RTL/untranslated. */
  if (/\[\s*["']en["']\s*,\s*["']fr["']\s*,\s*["']it["']\s*\]/.test(html)) fail(`${rel}: a language array lists en/fr/it without de.`);
  if (/===\s*["']it["']/.test(html) && !/===\s*["']de["']/.test(html)) fail(`${rel}: a language comparison handles it but not de.`);
  /* Every inline script must at least compile (a stray comma once broke science.html in German). */
  {
    let n = 0;
    for (const m of html.matchAll(/<script(?![^>]*\ssrc=)(?![^>]*type=["'](?:application\/ld\+json|text\/template|importmap)["'])[^>]*>([\s\S]*?)<\/script>/gi)) {
      n++;
      try { new vm.Script(m[1], { filename: `${rel}#inline${n}` }); }
      catch (e) { fail(`${rel}: inline script #${n} has a syntax error: ${e.message}`); }
    }
  }

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
  if (langLinks && !KNOWN_LANG_PARAM_LINKS[rel]) fail(`${rel} contains ${langLinks} hard-coded ?lang= link(s); all pages share the saved language.`);

  if (isAdmin) continue;

  /* The V2 reader owns its five-language switcher; it intentionally does not load the legacy shared-language script. */
  if (html.includes('data-kh-story-reader') && (rel === 'rebuild/reader.html' || /data-story-path=["']data\.v2\.json["']/.test(html))) {
    const v2Languages = ['ar', 'en', 'fr', 'it', 'de'];
    for (const lang of v2Languages) {
      if (!html.includes('data-lang="' + lang + '"') && !html.includes("data-lang='" + lang + "'")) fail('V2 reader is missing language button: ' + lang);
    }
    if (!html.includes('id="theme-toggle"')) fail('V2 reader must expose its light/dark theme toggle.');
    continue;
  }

  /* Standalone local V2 package review utility; it deliberately does not load legacy shared-language code. */
  if (rel === 'rebuild/package-review.html' && html.includes('KHALEDOON_STORY')) continue;

  /* locate the shared-script tag(s) */
  const tags = [...html.matchAll(/<script[^>]*\ssrc=["']([^"']*home-language-only\.js[^"']*)["'][^>]*>/gi)];
  if (isHome) {
    if (tags.length !== 1) { fail('Homepage must include the shared language script exactly once.'); continue; }
    if (!/data-role=["']home["']/.test(tags[0][0])) fail('Homepage must load the shared script with data-role="home" (its chooser must stay visible).');
    if (resolveRef(rel, tags[0][1]) !== SHARED) fail(`Homepage shared-script path resolves to ${resolveRef(rel, tags[0][1])}`);
    if (html.search(/<script\b/i) !== tags[0].index) fail('Homepage: the shared language script must be the first <script>.');
    const chooser = (html.match(/<button[^>]*\sdata-l=["']\d["']/g) || []).length;
    if (chooser !== SUPPORTED.length) fail(`Homepage chooser has ${chooser} language buttons; expected ${SUPPORTED.length} (ar, en, fr, it, de).`);
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

/* ---------- 3b) تغطية مفاتيح data-i18n في كل لغة ---------- */
function matchingObjectEnd(source, openAt) {
  let depth = 0, quote = '', escaped = false, lineComment = false, blockComment = false;
  for (let i = openAt; i < source.length; i++) {
    const ch = source[i], next = source[i + 1];
    if (lineComment) { if (ch === '\n') lineComment = false; continue; }
    if (blockComment) { if (ch === '*' && next === '/') { blockComment = false; i++; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return i;
  }
  return -1;
}
function collectRegisteredLocales(source, maps) {
  const re = /window\.I18N\.register\(\s*(['"])(ar|en|fr|it|de)\1\s*,\s*\{/g;
  let match;
  while ((match = re.exec(source))) {
    const openAt = match.index + match[0].lastIndexOf('{');
    const closeAt = matchingObjectEnd(source, openAt);
    if (closeAt < 0) { fail('Could not parse an I18N registration object.'); continue; }
    try {
      const entries = vm.runInNewContext('(' + source.slice(openAt, closeAt + 1) + ')');
      Object.assign(maps[match[2]], entries);
    } catch (e) {
      fail(`Could not parse ${match[2]} I18N entries: ${e.message}`);
    }
    re.lastIndex = closeAt + 1;
  }
}
{
  const locales = ['ar', 'en', 'fr', 'it', 'de'];
  for (const rel of htmlFiles) {
    const html = read(rel);
    const required = new Set();
    for (const m of html.matchAll(/\bdata-i18n=["']([^"']+)["']/gi)) required.add(m[1].trim());
    for (const m of html.matchAll(/\bdata-i18n-(?:attr|content)=["']([^"']+)["']/gi)) {
      m[1].split(',').forEach((pair) => {
        const parts = pair.split(':');
        const key = parts.length > 1 ? parts[1].trim() : parts[0].trim();
        if (key) required.add(key);
      });
    }
    if (!required.size) continue;
    const maps = { ar: {}, en: {}, fr: {}, it: {}, de: {} };
    let sawRegister = false;
    const scriptRefs = [...html.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/gi)].map((m) => m[1]);
    for (const src of scriptRefs) {
      if (isExternalRef(src)) continue;
      const target = resolveRef(rel, src);
      if (!exists(target)) continue;
      const code = read(target);
      if (!code.includes('window.I18N.register(')) continue;
      sawRegister = true;
      collectRegisteredLocales(code, maps);
    }
    /* Some small pages register translations inline. */
    if (html.includes('window.I18N.register(')) {
      sawRegister = true;
      collectRegisteredLocales(html, maps);
    }
    if (!sawRegister) continue; /* text-key dictionaries and the custom T object are audited separately */
    for (const locale of locales) {
      const missing = [...required].filter((key) => maps[locale][key] === undefined || maps[locale][key] === null || maps[locale][key] === '');
      if (missing.length) fail(`${rel}: ${locale} is missing ${missing.length} data-i18n key(s): ${missing.slice(0, 8).join(', ')}.`);
    }
  }
}

/* ---------- 4) المحرك المشترك يسمح بالتبديل من أي صفحة ---------- */
const engine = read('assets/shared/i18n.js');
if (/KH_LANG&&window\.KH_LANG\.locked/.test(engine)) fail('assets/shared/i18n.js: language switching must not be blocked on inner pages.');
if (!/function setLang\(lang\)/.test(engine)) fail('assets/shared/i18n.js: language switch handler is missing.');
if (!engine.includes('window.KH_LANG.supported')) fail('assets/shared/i18n.js: language list must come from KH_LANG.');

/* ---------- 4b) كل ملفات JS تُترجَم بلا أخطاء + قاموس الألمانية سليم ---------- */
for (const rel of walk('').filter((f) => /\.(?:js|cjs)$/.test(f)).sort()) {
  try { new vm.Script(read(rel), { filename: rel }); }
  catch (e) { fail(`${rel}: syntax error: ${e.message}`); }
}
{
  const match = shared.match(/var germanDictionary = (\{[\s\S]*?\});/);
  if (!match) fail('Shared language source: embedded German dictionary is missing.');
  else {
    try {
      const de = JSON.parse(match[1]);
      const entries = Object.entries(de);
      if (entries.length < 200) fail(`Shared language source: only ${entries.length} German entries; expected at least 200.`);
      const bad = entries.filter(([k, v]) => typeof v !== 'string' || !v.trim() || /\bundefined\b/.test(v));
      if (bad.length) fail(`Shared language source: ${bad.length} empty/invalid German values, e.g. "${bad[0][0].slice(0, 40)}".`);
      const arabicValues = entries.filter(([, v]) => /[؀-ۿ]/.test(v));
      if (arabicValues.length) fail(`Shared language source: ${arabicValues.length} German values still contain Arabic text, e.g. "${arabicValues[0][0].slice(0, 40)}".`);
      const r = runShared({ store: { 'kh-lang': 'de' } });
      if (entries.length && r.api.translate('de', entries[0][0]) !== entries[0][1]) fail('Shared language source: embedded German dictionary was not registered in KH_LANG.');
      notes.push(`${entries.length} German dictionary entries embedded and registered in KH_LANG`);
    } catch (e) { fail(`Shared language source: embedded German dictionary is invalid: ${e.message}`); }
  }
}
for (const rel of ['khaledoon/assets/khaledoon.js', 'khaledoon/assets/khaledoon-i18n-extra.js', 'khaledoon/assets/khaledoon-pages-i18n.js']) {
  const source = read(rel);
  if (!source.includes("KH_LANG.translate('de'")) fail(`${rel}: German must use the shared KH_LANG translation registry.`);
  if (source.includes('window.KH_DE')) fail(`${rel}: legacy window.KH_DE references must be removed.`);
}

/* ---------- 5) لا حذف: كل ملفات الحكايات المتوقعة موجودة ---------- */
const manifestPath = 'scripts/expected-story-files.json';
if (!exists(manifestPath)) fail(`${manifestPath} is missing.`);
else {
  const expected = JSON.parse(read(manifestPath));
  const missing = expected.files.filter((f) => !exists(f));
  if (missing.length) fail(`Deleted/missing expected story files (${missing.length}): ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ', ...' : ''}`);
  else notes.push(`${expected.files.length} expected story files present`);
}

/* ---------- 5b) بيانات بطاقات الحكايات: اكتمال اللغات والأسماء الثابتة ---------- */
{
  const indexPath = 'stories/index.json';
  try {
    const stories = JSON.parse(read(indexPath));
    const locales = ['en', 'fr', 'it', 'de'];
    for (const story of stories) {
      if (!story || !story.id) { fail('stories/index.json: found a story without an id.'); continue; }
      const baseName = String(story.name || '').trim();
      const baseTitle = String(story.title || '').trim();
      const baseSubtitle = String(story.subtitle || '').trim();
      let localizedName = null;
      for (const locale of locales) {
        const t = story.i18n && story.i18n[locale];
        if (!t) { fail(`stories/index.json story ${story.id}: missing ${locale} metadata.`); continue; }
        if (!String(t.title || '').trim()) fail(`stories/index.json story ${story.id}: missing ${locale} title.`);
        if (baseSubtitle && !String(t.subtitle || '').trim()) fail(`stories/index.json story ${story.id}: missing ${locale} subtitle.`);
        if (String(story.grade || '').trim() && !String(t.grade || '').trim()) fail(`stories/index.json story ${story.id}: missing ${locale} grade.`);
        if (String(story.className || '').trim() && !String(t.className || '').trim()) fail(`stories/index.json story ${story.id}: missing ${locale} className.`);
        /* Proper names must match across locales, but the translated “not specified” label
           is ordinary UI text and should remain localized (e.g. Non précisé / Nicht angegeben). */
        const candidateName = String(t.name || '').trim();
        const unspecifiedName = /^(?:غير محدد|غير معروف|not specified|unspecified|non précisé|non precise|non specificato|non specificata|nicht angegeben)$/i.test(baseName);
        if (baseName && !candidateName) fail(`stories/index.json story ${story.id}: missing ${locale} student name.`);
        if (localizedName === null) localizedName = candidateName;
        else if (!unspecifiedName && candidateName !== localizedName) fail(`stories/index.json story ${story.id}: student name spelling differs in ${locale}.`);
      }
      if (!baseTitle) fail(`stories/index.json story ${story.id}: missing source title.`);
    }
    notes.push(`${stories.length} story metadata records checked across five languages`);
  } catch (e) { fail(`stories/index.json: invalid JSON or metadata check failed: ${e.message}`); }
}

/* ---------- 5c) Theme parity for story pages and October collection ---------- */
for (const rel of [
  'stories/october/001/index.html','stories/october/002/index.html',
  'stories/october/003/index.html','stories/october/004/index.html',
  'stories/history/005/index.html','stories/history/006/index.html',
  'stories/science/007/index.html','stories/people/008/index.html','stories/people/009/index.html','stories/women/010/index.html','stories/islamic/011/index.html','stories/science/012/index.html','stories/women/013/index.html','stories/history/014/index.html'
]) {
  const html = read(rel);
  const storyReader = html.includes('data-kh-story-reader') && /data-story-path=["']data\.v2\.json["']/.test(html);
  if (storyReader) {
    if (!/id=["']theme-toggle["']/.test(html)) fail(`${rel}: V2 reader is missing its own light/dark mode controller.`);
    if (!/rebuild\/reader-base\.css/.test(html)) fail(`${rel}: V2 reader is missing its theme stylesheet layer.`);
  } else {
    if (!/khaledoon-theme\.js/.test(html)) fail(`${rel}: missing shared light/dark mode controller.`);
    if (!/shared\/base\.css/.test(html)) fail(`${rel}: missing shared theme stylesheet layer.`);
  }
}
{
  const rel = 'khaledoon/collections/october.html';
  const html = read(rel);
  if (!/khaledoon-theme\.js/.test(html)) fail(`${rel}: missing shared light/dark mode controller.`);
  if (!/october-collection-theme\.css/.test(html)) fail(`${rel}: missing October collection light-mode stylesheet.`);
  if (!exists('khaledoon/assets/october-collection-theme.css')) fail('October collection theme stylesheet is missing.');
}

{
  const rel = 'read.html';
  const html = read(rel);
  if (!/khaledoon-theme\.js/.test(html)) fail(`${rel}: missing shared light/dark mode controller.`);
  if (!/read-theme\.css/.test(html)) fail(`${rel}: missing reader theme stylesheet.`);
  if (!exists('assets/shared/read-theme.css')) fail('Reader theme stylesheet is missing.');
}
{
  const page = read('stories/science/007/index.html');
  const buttons = [...page.matchAll(/<button[^>]*data-lang=["'](ar|en|fr|it|de)["'][^>]*>/g)].map((m) => m[1]);
  if (new Set(buttons).size !== 5 || !['ar', 'en', 'fr', 'it', 'de'].every((locale) => buttons.includes(locale))) {
    fail('stories/science/007/index.html: the Ahmed Zewail story must expose all five language buttons (ar/en/fr/it/de).');
  }
  if (!page.includes('data-kh-story-reader') || !page.includes('data-story-path="story.json"')) {
    fail('stories/science/007/index.html: the Ahmed Zewail story must use the unified V2 reader.');
  }
  try {
    const story = JSON.parse(read('stories/science/007/story.json'));
    const locales = ['ar', 'en', 'fr', 'it', 'de'];
    if (story.format !== 'KHALEDOON_STORY') fail('Ahmed Zewail story package must use KHALEDOON_STORY.');
    for (const locale of locales) {
      const data = story.i18n && story.i18n[locale];
      if (!data || !data.title || !data.subtitle || !data.summary || !Array.isArray(data.blocks) || data.blocks.length < 3) {
        fail('Ahmed Zewail story package is missing required localized reading fields for ' + locale + '.');
      }
      for (const [i, block] of (data && Array.isArray(data.blocks) ? data.blocks : []).entries()) {
        if (!block.text || !block.type || !block.speaker) fail('Ahmed Zewail story block ' + i + ' is incomplete in ' + locale + '.');
      }
      for (const [i, source] of (Array.isArray(story.sources) ? story.sources : []).entries()) {
        if (!source.i18n || !source.i18n[locale] || !source.i18n[locale].title || !source.i18n[locale].organization) {
          fail('Ahmed Zewail source ' + i + ' is missing localized attribution in ' + locale + '.');
        }
      }
      for (const [i, question] of (Array.isArray(story.quiz) ? story.quiz : []).entries()) {
        const q = question.i18n && question.i18n[locale];
        if (!q || !q.question || !q.explanation || !Array.isArray(q.options) || q.options.length !== 4) {
          fail('Ahmed Zewail quiz question ' + i + ' is incomplete in ' + locale + '.');
        }
      }
    }
    notes.push('Ahmed Zewail V2 package: five-language story, image, source and quiz coverage');
  } catch (e) {
    fail('stories/science/007/story.json: could not audit the unified story package: ' + e.message);
  }
}
{
  const homeI18n = read('assets/i18n/home.js');
  const commonI18n = read('assets/i18n/common.js');
  if (homeI18n.includes('رجال خالدون عبر التاريخ') || homeI18n.includes('Immortal Heroes Through History') ||
      homeI18n.includes('Héros immortels à travers l’histoire') || homeI18n.includes('Eroi immortali nella storia') ||
      homeI18n.includes('Unsterbliche Helden der Geschichte')) {
    fail('assets/i18n/home.js: project name is inconsistent with “Immortals Through History”.');
  }
  if (commonI18n.includes("var AR_TITLE='رجال خالدون عبر التاريخ")) {
    fail('assets/i18n/common.js: stale Arabic document title uses the old project name.');
  }
}

/* ---------- 6) Regression checks: homepage map + expanded story translations ---------- */
{
  const home = read('index.html');
  const mapScriptPath = 'khaledoon/assets/khaledoon-map.js';
  const mapStylePath = 'khaledoon/assets/khaledoon-map.css';
  if (!home.includes(mapScriptPath)) fail('Homepage interactive map is not wired into index.html.');
  if (!home.includes(mapStylePath)) fail('Homepage interactive map stylesheet is not wired into index.html.');
  if (!exists(mapScriptPath) || !exists(mapStylePath)) fail('Interactive map script or stylesheet is missing.');
  const map = read(mapScriptPath);
  if (!/var LANGS = \['ar', 'en', 'fr', 'it', 'de'\]/.test(map)) fail('Interactive map must support ar/en/fr/it/de.');
  for (const locale of ['ar', 'en', 'fr', 'it', 'de']) {
    if (!new RegExp('\\b' + locale + ':').test(map)) fail('Interactive map is missing locale data for ' + locale + '.');
  }
  if (!map.includes("get('stories/index.json')") || !map.includes("get('stories/places.json')")) {
    fail('Interactive map must read the current story index and place data.');
  }
  const placeData = read('stories/places.json');
  try {
    const places = JSON.parse(placeData);
    if (!places['003'] || places['003'].approximate !== true) fail('Story 003 map coordinates must be marked approximate until verified.');
    if (places['002']) fail('Story 002 must stay off the map until its disputed birthplace is verified.');
    if (!map.includes("p.approximate === true") || !map.includes("e.p.approximate === true") || !map.includes("T('approx')")) fail('Interactive map must visibly label approximate locations in both popup and fallback list.');
  } catch (e) { fail('stories/places.json: invalid JSON or map-location review metadata failed: ' + e.message); }
  if (map.includes('map.scrollWheelZoom.enable()')) fail('Interactive map must not capture page scrolling after a click.');
  if (!map.includes('if (usingFallback) fallbackList()')) fail('Interactive map fallback list must refresh after language changes.');
}
{
  const rel = 'assets/shared/expanded-story-translations.js';
  const source = read(rel);
  if (source.includes('Object.values(D).some(z=>z[slug]?.t===h.textContent.trim())')) {
    fail(rel + ': translated heading lookup still references h inside its own initializer.');
  }
  if (!source.includes('Object.values(D).some(z=>z[slug]?.t===x.textContent.trim())')) {
    fail(rel + ': translated heading lookup must compare the candidate heading element.');
  }
  const match = source.match(/const D=(\{[\s\S]*?\n\});\nconst H=/);
  if (!match) fail(rel + ': could not read the story translation dictionary for coverage checks.');
  else {
    try {
      const dictionaries = vm.runInNewContext('(' + match[1] + ')');
      for (const locale of ['en', 'fr', 'it', 'de']) {
        for (const slug of ['001', '002', '003', '004', '005', '006', '007']) {
          const story = dictionaries[locale] && dictionaries[locale][slug];
          if (!story || !String(story.t || '').trim() || (slug !== '007' && !String(story.k || '').trim()) ||
              !Array.isArray(story.p) || story.p.length < 2 || story.p.some((p) => !String(p || '').trim())) {
            fail(rel + ': ' + locale + ' expanded story ' + slug + ' is missing a title, kicker, or paragraph translation.');
          }
          if (story && story.c !== undefined && !String(story.c || '').trim()) {
            fail(rel + ': ' + locale + ' expanded story ' + slug + ' has an empty caption translation.');
          }
        }
      }
      notes.push('expanded stories 001–007 checked in EN/FR/IT/DE');
    } catch (e) { fail(rel + ': translation dictionary audit failed: ' + e.message); }
  }
}

if (failures.length) {
  console.error('Homepage language-flow checks FAILED:\n- ' + failures.join('\n- '));
  process.exitCode = 1;
} else {
  console.log(`Homepage language-flow checks passed: ${visitorPages} visitor pages + homepage, ${stubs} redirect stubs, ${ADMIN_PAGES.size} admin pages exempt; AR/EN/FR/IT/DE; ${notes.join('; ')}.`);
}
