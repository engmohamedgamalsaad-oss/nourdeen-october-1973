const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const assets = fs.readFileSync(path.join(root, 'supabase/functions/audio-review-assets/index.ts'), 'utf8');
const preview = fs.readFileSync(path.join(root, 'rebuild/reader-audio-flow.js'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'scripts/omnivoice_engine/worker.py'), 'utf8');
const notebook = JSON.parse(fs.readFileSync(path.join(root, 'notebooks/Khaledoon_OmniVoice_Unified_Worker.ipynb'), 'utf8'));
const notebookCode = notebook.cells.filter(cell => cell.cell_type === 'code').map(cell => Array.isArray(cell.source) ? cell.source.join('') : String(cell.source || '')).join('\n');
const publicAudio = fs.readFileSync(path.join(root, 'assets/shared/story-audio.js'), 'utf8');
const storyReader = fs.readFileSync(path.join(root, 'rebuild/reader.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'supabase/functions/story-audio-worker/index.ts'), 'utf8');
const audioEngine = fs.readFileSync(path.join(root, 'rebuild/reader-audio-review.js'), 'utf8');

test('translation generation is per block and a successful Gemini result is default-approved', () => {
  assert.match(assets, /body\.action === "translation_generate"/);
  assert.match(assets, /source_arabic_hash: sourceHash, translation_text: translationText/);
  assert.match(assets, /status: "approved", auto_approved: true/);
  assert.doesNotMatch(assets, /Save as a draft only/);
});

test('optional manual translation edit stays tied to the current Arabic source hash', () => {
  assert.match(assets, /body\.action === "translation_save"/);
  assert.match(assets, /source\.sourceTextHash !== body\.source_arabic_hash/);
  assert.match(assets, /status: decision/);
  assert.match(preview, /حفظ تعديلي \(اختياري\)/);
  assert.doesNotMatch(preview, /kh-translation-approve/);
  assert.match(preview, /translation_save/);
});

test('English audio cannot be queued or published from an unapproved or stale translation', () => {
  assert.match(assets, /translation\.status !== "approved"/);
  assert.match(assets, /translation\.source_arabic_hash !== source\.sourceTextHash/);
  assert.match(assets, /enqueue_approved_language/);
  assert.match(assets, /ترجمة هذا المقطع غير جاهزة أو قديمة/);
});

test('bulk queue preserves each Arabic block speaker for the unified Colab worker', () => {
  assert.match(assets, /speaker: item\.block\.speaker/);
  assert.match(engine, /registry\.get\(job\.get\("speaker"\)\)/);
  assert.match(engine, /provider\.generate\(selected_model/); // the model is chosen per language since PR #654
});

test('public audio player accepts normal MP3 filenames and uses a fresh cache key', () => {
  assert.ok(publicAudio.includes("!/^[A-Za-z0-9_-]+\\.mp3$/.test"), 'MP3 validation must escape the dot once, not twice');
  assert.match(storyReader, /story-audio\.js\?v=20261114-public-audio-mp3-fix-1/);
});

test('the single Colab notebook registers both voices and the admin preview reports worker presence', () => {
  assert.match(notebookCode, /registry\.register\(KarmaProvider/);
  assert.match(notebookCode, /registry\.register\(NarratorProvider/);
  assert.match(notebookCode, /run_worker\(client, voice_model, registry/);
  assert.match(engine, /registry\.get\(job\.get\("speaker"\)\)/);
  assert.match(preview, /fetchWorkerStatus/);
  assert.match(preview, /story-audio-worker/);
  assert.match(preview, /workerOnline === false/);
});

test('legacy direct-to-main translation publishing is disabled in favor of the reviewed text-only PR path', () => {
  assert.ok(assets.includes('body.action === "publish_translations"'));
  assert.match(assets, /تم إيقاف النشر المباشر إلى main/);
  assert.ok(!assets.includes('branch: "main"'));
  assert.ok(!preview.includes("action: 'publish_translations'"));
  assert.match(preview, /نشر النص فقط/);
  assert.match(preview, /لا يبدأ أي توليد صوتي/);
});

test('bulk language audio queue is all-or-nothing when any segment is unapproved or stale', () => {
  const preflight = assets.indexOf('const prepared: Array<');
  const enqueue = assets.indexOf('insertOrReuseJob(service,', preflight);
  assert.ok(preflight >= 0 && enqueue > preflight, 'all segments must be preflighted before the first queue insert');
  assert.match(assets, /لم يبدأ توليد الصوت/);
  assert.match(assets, /required_segments: indexes\.length/);
  assert.match(assets, /approved_segments: prepared\.length/);
  assert.match(assets, /translation\.speaker === block\.speaker/);
  assert.match(preview, /تم فحص اللغة كاملة/);
});

const audioReview = fs.readFileSync(path.join(root, 'rebuild/reader-audio-review.js'), 'utf8');

test('bulk translation paints each segment immediately and preserves the result in its own editor', () => {
  assert.match(preview, /function paintTranslationBlock\(index, state, message, record\)/);
  assert.match(preview, /translationWorkingText\[key\] = String\(translated\.translation_text\)/);
  assert.match(preview, /paintTranslationBlock\(blockIndex, 'approved'/);
  assert.match(preview, /paintTranslationBlock\(blockIndex, 'failed'/);
  assert.match(preview, /translationStates\[key\] = 'processing'/);
  assert.match(preview, /translationStates\[key\] !== 'failed'/);
  assert.match(preview, /translationStates\[key\] = 'processing'/);
});

test('completed audio jobs refresh the review manifest and insert the playable clip without a manual page reload', () => {
  assert.match(preview, /function refreshCompletedAudio\(\)/);
  assert.match(preview, /review\.refreshAudio\(\)/);
  assert.match(preview, /refreshCompletedAudio\(\)/);
  assert.match(audioReview, /refreshAudio: async function \(\) \{ await loadManifests\(\); render\(\); return true; \}/);
});

test('translated languages mark step 2 as not required when no separate speech text exists', () => {
  const source = fs.readFileSync(path.join(root, 'rebuild/reader-audio-flow.js'), 'utf8');
  assert.match(source, /s2 = L !== 'ar' && !speech\s*\?[\s\S]*?t: 'لا يلزم — يُقرأ النص المترجم'/);
});

test('translation belongs to step 1 while Gemini reading text remains a separate step 2', () => {
  assert.match(preview, /var step1 = makeStep\(box, 1, 'النص'\)/);
  assert.match(preview, /step1\.body\.appendChild\(makeTranslationReview\(box, rec\.index, arabicBlock, local\)\)/);
  assert.match(preview, /var step2 = makeStep\(box, 2, 'نص القراءة \(Gemini\)'\)/);
  assert.match(preview, /لا يلزم نص قراءة منفصل لهذه اللغة/);
  assert.match(preview, /return \[\{ n: 1, label: 'النص', s: s1\.s, t: s1\.t \}, \{ n: 2, label: 'نص القراءة', s: s2\.s, t: s2\.t \}/);
});

test('admin preview switches the story body to the selected locale and displays saved/generated translation text', () => {
  assert.match(storyReader, /if\(previewMode\)\{previewAudioLanguage=b\.dataset\.lang;window\.__KH_AUDIO_REVIEW_LANGUAGE=previewAudioLanguage;current=previewAudioLanguage;show\(\);/);
  assert.match(storyReader, /var sourceBlock=b;/);
  assert.match(preview, /function renderTranslationOnPage\(index, text\)/);
  assert.match(preview, /renderTranslationOnPage\(index, record\.translation_text\)/);
  assert.match(preview, /if \(translationConfirmed\[key\]\) renderTranslationOnPage\(index, translationWorkingText\[key\]\)/);
  assert.match(preview, /site-language-change', function \(\) \{ loadTranslations\(\)\.then\(onUpdated\); \}/);
  assert.match(fs.readFileSync(path.join(root, 'rebuild/reader.html'), 'utf8'), /reader\.js\?v=20261116-preview-localized-1/);
});

test('audio readiness waits for a manifest card and the worker verifies uploaded bytes before completing', () => {
  assert.match(preview, /job\.status === 'completed'\) s3 = hasVerifiedCard \? \{ s: 'done', t: 'الصوت جاهز' \} : \{ s: 'busy'/);
  assert.match(audioEngine, /function audioEntryForBlock\(language, index\)/);
  assert.match(audioEngine, /var audioEntry = audioEntryForBlock\(language, index\)/);
  assert.match(audioEngine, /job\.status === 'completed'\) view = audioVerified/);
  assert.match(audioEngine, /panel\.dataset\.audioSha256 = entry\.audio_sha256/);
  assert.match(preview, /function verifiedAudioCard\(box, job\)/);
  assert.match(preview, /actual === expected/);
  assert.match(preview, /review\.refreshAudio\(\)/);
  assert.match(worker, /storage\.from\(BUCKET\)\.download\(path\)/);
  assert.match(worker, /uploadedDigest !== digest/);
  assert.match(worker, /status: "completed"/);
});

test('failed audio generation and failed file verification can be retried for one block', () => {
  assert.match(audioEngine, /job\.status === 'failed'\) view = \{ state: 'failed'[\s\S]*?canResend: true \}/);

  assert.match(audioEngine, /action: 'enqueue', section: story\.section, slug: story\.slug, language: language, block_index: index/);
});


test('French translation preview shows the Arabic reference only once and retries temporary Gemini failures', () => {
  assert.match(preview, /النص العربي المرجعي:/);
  assert.equal(preview.includes('source.appendChild(el("p", "", arabicBlock'), false);
  assert.ok(preview.includes('wrap.append(textarea, buttons, status)'));
  assert.ok(assets.includes('const translationModels = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"];'));
  assert.equal(/translationModels = \[[^\]]*flash-lite/.test(assets), false);
  assert.ok(assets.includes('const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);'));
  assert.match(assets, /const translationDeadlineAt = Date\.now\(\) \+ 75000;/);
  assert.match(assets, /const delayMs = Math\.min\(6000, Math\.max\(retryAfterMs, 2000 \* attempt\)\);/);
  assert.match(assets, /AbortController\(\)[\s\S]{0,120}perAttemptTimeoutMs/);
  assert.match(assets, /بعد " \+ attemptsMade \+ " محاولات على عدة نماذج/);
  assert.match(assets, /status: "approved", auto_approved: true, model,/);
});

test('bulk translation retries failed clips in rounds and stops on lost session', () => {
  const src = fs.readFileSync('rebuild/reader-audio-flow.js', 'utf8');
  assert.ok(src.includes('async function runTranslationRounds('));
  assert.ok(src.includes('maxRounds: 3, waitSeconds: 20'));
  assert.ok(src.includes("outcome === 'auth'"));
  assert.ok(src.includes('إعادة محاولة تلقائية'));
  assert.ok(src.includes('لم يبدأ أي توليد صوتي'));
  assert.ok(!/translation_generate[\s\S]{0,400}generate_audio/.test(src.slice(src.indexOf('runTranslationRounds(todo'))));
});


test('audio generation and review controls follow the selected language without changing Arabic text flow', () => {
  const src = fs.readFileSync('rebuild/reader-audio-flow.js', 'utf8');
  const audioReview = fs.readFileSync('rebuild/reader-audio-review.js', 'utf8');
  assert.ok(src.includes('kh-language-audio-batch'));
  assert.ok(src.includes('actions.appendChild(bulkTranslate)'));
  assert.ok(src.includes("panel.appendChild(translationStatus)"));
  assert.ok(src.includes('ترجمة كل المقاطع دفعة واحدة'));
  assert.ok(src.includes('kh-language-audio-generate'));
  assert.ok(src.includes('kh-language-audio-review'));
  assert.ok(src.includes("action: 'enqueue_approved_language'"));
  assert.ok(audioReview.includes('canQueueLanguage: async function'));
  assert.ok(audioReview.includes('canReviewLanguage: function'));
  assert.ok(!src.includes('kh-translation-queue-all'));
  assert.ok(src.includes('if (!st || L === "ar" || !st.i18n'));
  assert.ok(src.includes("var original = L === 'ar' && local && typeof local.text === 'string' ? local.text : ''"));
});


test('language preview offers a separate approved-audio publish action before the text-only review PR', () => {
  assert.match(audioReview, /publishLanguageAudio: async function \(language\)/);
  assert.match(audioReview, /action: 'publish_audio', section: story\.section, slug: story\.slug, language: language/);
  assert.match(preview, /kh-translation-publish-audio/);
  assert.match(preview, /api\.publishLanguageAudio\(language\)/);
  assert.match(preview, /نشر صوت هذه اللغة للزوار/);
  assert.match(preview, /نشر نص هذه اللغة \(طلب مراجعة\)/);
  assert.match(preview, /هذا الزر ينشر النص فقط/);
});


test('one bulk translation run fans out from canonical Arabic to all four target languages', () => {
  const source = fs.readFileSync(path.join(root, 'rebuild/reader-audio-flow.js'), 'utf8');
  assert.match(source, /var batchLanguages = \['en', 'fr', 'it', 'de'\]/);
  assert.match(source, /action: 'translation_generate',[\s\S]{0,100}language: targetLanguage,[\s\S]{0,60}block_index: blockIndex/);
  assert.match(source, /var sourceBlock = blocks\[blockIndex\]/);
  assert.match(source, /existing\.source_arabic_hash === sourceHash/);
  assert.match(source, /force: !!\(translationRecords\[key\] && translationRecords\[key\]\.status === 'approved'\)/);
  assert.match(source, /translationWorkingText\[key\] = String\(existing\.translation_text\)/);
  assert.match(source, /translation_generate/);
  assert.match(assets, /resolveStoryBlock\(section, slug, "ar", index, body\.story_snapshot\)/);
});
