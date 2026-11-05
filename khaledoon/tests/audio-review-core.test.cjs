/* Tests: audio review core (clip keys, decisions, gate, AI prompt section). */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../assets/audio-review-core.js');

(async function () {
  const S = 'science/magdi-yacoub';

  /* المفتاح: المسافات لا تغيّره، والنص يغيّره، والترتيب لا يدخل فيه */
  const a = await core.baseKey(S, 'ar', 'narrator', 'مرحبا   بالعالم');
  const b = await core.baseKey(S, 'ar', 'narrator', ' مرحبا بالعالم ');
  const c = await core.baseKey(S, 'ar', 'narrator', 'مرحبا بالعالم!');
  assert.equal(a, b, 'whitespace-only change must keep key');
  assert.notEqual(a, c, 'text change must change key');
  assert.notEqual(a, await core.baseKey(S, 'ar', 'karma', 'مرحبا بالعالم'), 'speaker/voice changes key');
  assert.notEqual(a, await core.baseKey(S, 'en', 'narrator', 'مرحبا بالعالم'), 'language changes key');
  const otherStory = 'history/another-story';
  assert.notEqual(a, await core.baseKey(otherStory, 'ar', 'narrator', 'مرحبا بالعالم'), 'story identity isolates review keys across all stories');
  assert.equal(core.PILOT, undefined, 'review core must not expose a single-story pilot allowlist');
  assert.equal(core.pilotInfo, undefined, 'review core must not gate operation by story slug');

  /* A manifest must cover every story block, match its speaker, and keep chunk indexes contiguous. */
  const coverageBlocks = [{ speaker: 'karma' }, { speaker: 'narrator' }];
  const coverageSegments = [
    { block_index: 0, chunk_index: 0, speaker: 'karma' },
    { block_index: 1, chunk_index: 0, speaker: 'narrator' },
    { block_index: 1, chunk_index: 1, speaker: 'narrator' }
  ];
  assert.equal(core.validateManifestCoverage(coverageBlocks, coverageSegments).ok, true);
  assert.equal(core.validateManifestCoverage(coverageBlocks, coverageSegments.slice(0, 1)).ok, false, 'missing a story block must fail');
  assert.equal(core.validateManifestCoverage(coverageBlocks, [{ ...coverageSegments[0], speaker: 'narrator' }, ...coverageSegments.slice(1)]).ok, false, 'speaker mismatch must fail');
  assert.equal(core.validateManifestCoverage(coverageBlocks, [...coverageSegments, coverageSegments[0]]).ok, false, 'duplicate chunk must fail');
  assert.equal(core.validateManifestCoverage(coverageBlocks, [coverageSegments[0], coverageSegments[1], { ...coverageSegments[2], chunk_index: 2 }]).ok, false, 'missing chunk index must fail');
  const textBlocks = [{ speaker: 'narrator', text: 'The current story text.' }];
  const matchingText = [{ block_index: 0, chunk_index: 0, speaker: 'narrator', text: 'The current story text.' }];
  assert.equal(core.validateManifestCoverage(textBlocks, matchingText).ok, true);
  assert.equal(core.validateManifestCoverage(textBlocks, [{ ...matchingText[0], text: 'An outdated story text.' }]).ok, false, 'stale audio text must not pass review');
  assert.equal(core.validateManifestCoverage(textBlocks, [{ ...matchingText[0], text: 'Reviewed Arabic pronunciation.' }], ['Reviewed Arabic pronunciation.']).ok, true, 'approved Arabic audio-only text may differ from visible story text');

  /* العدّاد يغيّر المفتاح */
  assert.equal(await core.clipKey(a, 0), a);
  assert.notEqual(await core.clipKey(a, 1), a);
  assert.notEqual(await core.clipKey(a, 1), await core.clipKey(a, 2));

  /* القبول والرفض متعارضان، وتغيير الترتيب (block_index) لا يلغي قبول نفس المفتاح */
  const entry = { story_id: S, lang: 'ar', block_index: 3, chunk_index: 0, speaker: 'karma', base: a, key: a, text: 'مرحبا بالعالم' };
  let r = core.applyDecision(null, entry, { status: 'accepted' });
  assert.equal(r.clips[a].status, 'accepted');
  r = core.applyDecision(r, entry, { status: 'rejected', note: 'نطق خاطئ', suggestion: 'صياغة أوضح', issue: 'audio_only' });
  assert.equal(r.clips[a].status, 'rejected');
  assert.equal(r.clips[a].issue, 'audio_only');
  assert.equal(r.clips[a].suggestion, 'صياغة أوضح');
  assert.equal(r.clips[a].chunk_index, 0);
  assert.equal(Object.keys(r.clips).length, 1);

  /* جزآن من نفس المقطع لا يمسح أحدهما قرار الآخر */
  const secondChunk = { ...entry, chunk_index: 1, base: 'chunk-2', key: 'chunk-2', text: 'جزء ثانٍ' };
  let chunkReview = core.applyDecision(null, entry, { status: 'accepted' });
  chunkReview = core.applyDecision(chunkReview, secondChunk, { status: 'accepted' });
  assert.equal(Object.keys(chunkReview.clips).length, 2, 'distinct chunks in one block keep independent decisions');
  assert.equal(chunkReview.clips[a].status, 'accepted');
  assert.equal(chunkReview.clips['chunk-2'].status, 'accepted');

  /* الشرط: لا اعتماد مع مرفوض أو غير مراجَع أو غير جاهز */
  const e1 = { key: 'k1' }, e2 = { key: 'k2' };
  const rev = { clips: { k1: { status: 'accepted' }, k2: { status: 'accepted' } } };
  assert.equal(core.evaluateGate([e1, e2], rev, { k1: 'ready', k2: 'ready' }).ok, true);
  assert.equal(core.evaluateGate([e1, e2], rev, { k1: 'ready', k2: 'pending' }).ok, false);
  assert.equal(core.evaluateGate([e1, e2], rev, { k1: 'ready', k2: 'error' }).ok, false);
  assert.equal(core.evaluateGate([e1, e2], { clips: { k1: { status: 'accepted' } } }, { k1: 'ready', k2: 'ready' }).unreviewed, 1);
  assert.equal(core.evaluateGate([e1, e2], { clips: { k1: { status: 'accepted' }, k2: { status: 'rejected' } } }, { k1: 'ready', k2: 'ready' }).ok, false);
  assert.equal(core.evaluateGate([], rev, {}).ok, false, 'empty must not pass');
  const allFive = { ar: {}, en: {}, fr: {}, it: {}, de: {} };
  assert.equal(core.evaluateFiveLanguageGate(allFive, [e1, e2], rev, { k1: 'ready', k2: 'ready' }).ok, true);
  assert.deepEqual(
    core.evaluateFiveLanguageGate({ ar: {}, en: {} }, [e1], rev, { k1: 'ready' }).missingLanguages,
    ['fr', 'it', 'de'],
    'any missing language must block preview approval'
  );
  assert.equal(core.evaluateFiveLanguageGate({}, [], rev, {}).ok, false, 'no audio manifests must not bypass review');

  /* تغيّر نص مقطع واحد: قبوله القديم يسقط والبقية تبقى */
  const other = { story_id: S, lang: 'ar', block_index: 1, speaker: 'narrator', base: 'bX', key: 'bX', text: 'x' };
  let r2 = core.applyDecision(null, other, { status: 'accepted' });
  const changed = { story_id: S, lang: 'ar', block_index: 3, speaker: 'karma', base: 'bNew', key: 'bNew', text: 'نص جديد' };
  r2 = core.applyDecision(r2, entry, { status: 'accepted' });
  r2 = core.applyDecision(r2, changed, { status: 'accepted' });
  assert.equal(r2.clips[a], undefined, 'old key of changed block removed');
  assert.equal(r2.clips.bNew.status, 'accepted');
  assert.equal(r2.clips.bX.status, 'accepted', 'untouched block keeps acceptance');

  /* إعادة صوت مقطع واحد: يرتفع عدّاد المرفوض (ب) فقط مرة واحدة */
  let r3 = core.applyDecision(null, entry, { status: 'rejected', note: 'n', issue: 'audio_only' });
  r3 = core.applyDecision(r3, other, { status: 'accepted' });
  const bumped = core.bumpAudioOnly(r3);
  assert.equal(bumped.bumped, 1);
  assert.equal(bumped.review.regen[a], 1);
  assert.equal(core.bumpAudioOnly(bumped.review).bumped, 0, 'idempotent');
  assert.equal(bumped.review.regen.bX, undefined, 'other clips untouched');

  /* قسم البرومبت */
  const sec = core.buildPromptSection(r3);
  assert.ok(sec.includes('مراجعة الصوت'));
  assert.ok(sec.includes('(ب) النص صحيح والصوت فقط'));
  assert.ok(sec.includes('مصرية طبيعية'));
  assert.ok(sec.includes('ملاحظة الأدمن: n'));
  const suggested = core.buildPromptSection(core.applyDecision(null, entry, { status: 'rejected', note: 'ملاحظة', suggestion: 'صياغة مقترحة', issue: 'text' }));
  assert.ok(suggested.includes('الصياغة المقترحة: صياغة مقترحة'));
  assert.ok(sec.includes('لا تضف أي بيانات قبول'));
  assert.equal(core.buildPromptSection(null), '');

  /* Integration regression: draft preview must publish its story context after rendering,
     and the reviewer must not allow acceptance before a complete playback. */
  const reader = fs.readFileSync(path.join(__dirname, '../../rebuild/reader.js'), 'utf8');
  const reviewUi = fs.readFileSync(path.join(__dirname, '../../rebuild/reader-audio-review.js'), 'utf8');
  const reviewActions = fs.readFileSync(path.join(__dirname, '../../rebuild/reader-review-actions.js'), 'utf8');
  const readerHtml = fs.readFileSync(path.join(__dirname, '../../rebuild/reader.html'), 'utf8');
  const adminHtml = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');
  assert.ok(reader.includes("window.__KH_STORY_PACKAGE=story;document.dispatchEvent(new CustomEvent('kh-story-audio-context'"), 'reader must publish story context after rendering for the audio reviewer');
  assert.ok(reviewUi.includes("if (!played[entry.key]) { state.textContent = 'استمع إلى المقطع كاملًا قبل قبوله.'; return; }"), 'a clip cannot be accepted before full playback');
  assert.ok(reviewUi.includes('if (manifestLoadFailure) return { ok: false, loadError: true'), 'manifest verification errors must block preview approval');
  assert.ok(reviewUi.includes('if (!initialized) return { ok: false, loading: true'), 'preview approval must remain blocked while manifests are loading');
  assert.ok(reviewUi.includes('if (!e || !e.isMissingManifest) manifestLoadFailure = true;'), 'only a confirmed 404 may be treated as a missing language manifest');
  assert.ok(reviewUi.includes(String.raw`/^[A-Za-z0-9_-]+\.mp3$/`), 'manifest MP3 filenames must match a normal .mp3 extension');
  assert.ok(reviewUi.includes('return core.evaluateFiveLanguageGate(manifests, entries, review, readyByKey);'), 'preview must use the shared five-language gate');
  assert.ok(reviewUi.includes('loadArabicExpectedTexts') && reviewUi.includes('core.validateManifestCoverage(localized && localized.blocks, data.segments, expectedTexts[lang])'), 'Arabic audio must be checked against the approved audio-only pronunciation text, and all other languages against current story text');
  assert.ok(!reviewUi.includes('if (!enabled) return { ok: true'), 'an entirely missing audio set must never bypass the five-language gate');
  assert.ok(reviewUi.includes("params.get('draft') !== '1'"), 'audio review must run only in draft preview mode');
  assert.ok(reviewUi.includes('review = core.cloneReview(meta.audio_review || null);'), 'review decisions must be read only from story_meta.audio_review');
  assert.ok(reviewUi.includes('var currentReview = core.cloneReview(meta.audio_review || null);') && reviewUi.includes('var next = core.applyDecision(currentReview, entry, decision);'), 'each save must merge one clip decision into the freshly read review, not overwrite other clips');
  assert.ok(reviewUi.includes('stagedPackage.section !== story.section || stagedPackage.slug !== story.slug'), 'a stale admin context must never save one story review into another story row');
  assert.ok(!reviewUi.includes('meta.pending_draft.story_meta.audio_review'), 'review decisions must not be duplicated inside pending_draft');
  assert.ok(reviewUi.includes('@media print{.kh-audio-review-controls,.kh-audio-review-gate{display:none!important}}'), 'audio review controls and gate must never appear in print');
  assert.ok(reviewUi.includes("nextStory.section === 'october'"), 'October drafts must remain completely outside audio review');
  assert.ok(reviewUi.includes('banner.hidden = false;'), 'the missing-audio gate must remain visible even when no manifest exists');
  assert.ok(reader.includes("if(!story||story.section==='october')return"), 'October pages must not publish audio review context or load the reviewer');
  assert.ok(readerHtml.indexOf('audio-review-core.js') < readerHtml.indexOf('reader-audio-review.js'), 'review core must load before its UI');
  assert.ok(reviewUi.includes("if (!played[entry.key]) { state.textContent = 'استمع إلى المقطع كاملًا قبل تسجيل الملاحظة أو الرفض.'; return; }"), 'a clip cannot be rejected before full playback');
  assert.ok(adminHtml.indexOf('assets/audio-review-core.js') < adminHtml.indexOf('var audioReviewSection'), 'admin must load the review core before building AI prompts');
  assert.ok(adminHtml.includes('buildPromptSection(it.story_meta.audio_review)'), 'audio decisions must be included in the AI prompt');
  assert.ok(adminHtml.includes("String(it.section||it.section_key||'').toLowerCase()!=='october'"), 'October story content must remain protected from AI prompt edits');
  assert.ok(reviewActions.includes('if(!window.KHStoryAudioReview){message('), 'approval must fail closed if the audio reviewer did not load');
  assert.ok(reviewActions.includes("isApprove&&String(draft.section||draft.section_key||'').toLowerCase()!=='october'"), 'October approval flow must remain unchanged');
  assert.ok(reviewActions.includes('delete pendingMeta.audio_review') && reviewActions.includes('delete meta.pending_draft.story_meta.audio_review'), 'approval must not duplicate audio_review inside pending_draft metadata');

  console.log('audio-review-core tests passed');
})().catch(function (e) { console.error(e); process.exit(1); });
