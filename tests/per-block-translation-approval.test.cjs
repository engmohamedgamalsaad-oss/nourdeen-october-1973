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
  assert.match(assets, /لا يمكن نشر الصوت الإنجليزي/);
});

test('bulk queue preserves each Arabic block speaker for the unified Colab worker', () => {
  assert.match(assets, /speaker: item\.block\.speaker/);
  assert.match(engine, /registry\.get\(job\.get\("speaker"\)\)/);
  assert.match(engine, /provider\.generate\(model/);
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
  assert.match(preview, /اكتمل فحص اللغة/);
});

const audioReview = fs.readFileSync(path.join(root, 'rebuild/reader-audio-review.js'), 'utf8');

test('bulk translation paints each segment immediately and preserves the result in its own editor', () => {
  assert.match(preview, /function paintTranslationBlock\(index, state, message, record\)/);
  assert.match(preview, /translationWorkingText\[lang\(\) \+ ':' \+ i\] = String\(result\.translation\.translation_text \|\| ''\)/);
  assert.match(preview, /paintTranslationBlock\(i, 'approved'/);
  assert.match(preview, /paintTranslationBlock\(i, 'failed'/);
  assert.match(preview, /translationStates\[currentTranslationKey\] === 'processing'/);
  assert.match(preview, /translationStates\[key\] !== 'failed'/);
  assert.match(preview, /translationStates\[lang\(\) \+ ':' \+ i\] = 'processing'/);
});

test('completed audio jobs refresh the review manifest and insert the playable clip without a manual page reload', () => {
  assert.match(preview, /function refreshCompletedAudio\(\)/);
  assert.match(preview, /review\.refreshAudio\(\)/);
  assert.match(preview, /refreshCompletedAudio\(\)/);
  assert.match(audioReview, /refreshAudio: async function \(\) \{ await loadManifests\(\); render\(\); return true; \}/);
});

test('translation belongs to step 1 while Gemini reading text remains a separate step 2', () => {
  assert.match(preview, /var step1 = makeStep\(box, 1, 'النص'\)/);
  assert.match(preview, /step1\.body\.appendChild\(makeTranslationReview\(box, rec\.index, arabicBlock, local\)\)/);
  assert.match(preview, /var step2 = makeStep\(box, 2, 'نص القراءة \(Gemini\)'\)/);
  assert.match(preview, /لم يُجهّز نص القراءة الصوتية لهذا المقطع بعد/);
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
  assert.match(preview, /job\.status === 'completed'\) s3 = hasCard \? \{ s: 'done', t: 'الصوت جاهز' \} : \{ s: 'busy'/);
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
