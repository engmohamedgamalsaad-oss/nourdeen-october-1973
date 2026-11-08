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
  const engine = { voice: core.VOICES.narrator, provider: 'fish-audio', model: 's2.1-pro-free', audio_revision: 'mp3-sha-1' };
  const audioRevisionOne = await core.baseKey(S, 'ar', 'narrator', 'مرحبا بالعالم', engine);
  const audioRevisionTwo = await core.baseKey(S, 'ar', 'narrator', 'مرحبا بالعالم', { ...engine, audio_revision: 'mp3-sha-2' });
  assert.notEqual(audioRevisionOne, audioRevisionTwo, 'replacing the actual MP3 bytes must invalidate its previous approval');
  assert.equal(await core.sha256Bytes(Buffer.from('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'binary MP3 digest helper must hash raw bytes');

  assert.equal(core.PILOT, undefined, 'review core must not expose a single-story pilot allowlist');
  assert.equal(core.pilotInfo, undefined, 'review core must not gate operation by story slug');

  /* A manifest must cover every story block, match its speaker, and keep chunk indexes contiguous. */
  const coverageBlocks = [
    { speaker: 'karma', text: 'Karma line.' },
    { speaker: 'narrator', text: 'First second.' },
    { speaker: 'title', text: 'Non-spoken heading' }
  ];
  const coverageSegments = [
    { block_index: 0, chunk_index: 0, speaker: 'karma', text: 'Karma line.' },
    { block_index: 1, chunk_index: 0, speaker: 'narrator', text: 'First' },
    { block_index: 1, chunk_index: 1, speaker: 'narrator', text: 'second.' }
  ];
  assert.equal(core.validateManifestCoverage(coverageBlocks, coverageSegments).ok, true);
  assert.equal(core.validateManifestCoverage(coverageBlocks, coverageSegments).segments, 3, 'non-spoken heading blocks must not require MP3 files');
  assert.equal(core.validateManifestCoverage(coverageBlocks, coverageSegments.slice(0, 1)).ok, false, 'missing a story block must fail closed by default');
  const partialCoverage = core.validateManifestCoverage(coverageBlocks, coverageSegments.slice(0, 1), undefined, true);
  assert.equal(partialCoverage.ok, true, 'partial manifests may be loaded for segment-by-segment review');
  assert.equal(partialCoverage.complete, false, 'partial manifests must never be treated as complete');
  assert.deepEqual(partialCoverage.missingBlocks, [1], 'missing spoken blocks must be reported explicitly');
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
  const hashedEntry = { ...entry, key: 'hashed-key', base: 'hashed-base', source_base: 'stable-source-base', audio_sha256: 'a'.repeat(64) };
  const hashedReview = core.applyDecision(null, hashedEntry, { status: 'accepted' });
  assert.equal(hashedReview.audio_hashes['stable-source-base'], 'a'.repeat(64), 'actual MP3 digest must persist across review sessions');
  assert.equal(hashedReview.clips['hashed-key'].audio_sha256, 'a'.repeat(64));
  const validatorResult = {
    engine: 'faster-whisper-local', status: 'review_required',
    audio_sha256: 'a'.repeat(64), hash_verified: true,
    match_ratio: 0.8, detected_language: 'ar', language_probability: 0.97,
    language_mismatch: false, language_detection_uncertain: true,
    expected_word_count: 5, recognized_word_count: 4, transcript: 'نص مسموع',
    mismatches: [{ type: 'replace', expected: ['الكلمة'], recognized: ['كلمة'], start: 1.2, end: 1.8 }],
    low_confidence_words: [{ word: 'كلمة', start: 1.2, end: 1.8, probability: 0.31 }]
  };
  const withValidator = core.applyDecision(null, hashedEntry, {
    status: 'accepted', pronunciation_review: validatorResult
  }, '2026-11-06T00:00:00.000Z');
  assert.equal(withValidator.clips['hashed-key'].pronunciation_review.format, 'KHALEDOON_AUDIO_PRONUNCIATION_REVIEW_RESULT_V1');
  assert.equal(withValidator.clips['hashed-key'].pronunciation_review.hash_verified, true);
  assert.equal(withValidator.clips['hashed-key'].pronunciation_review.mismatches[0].start, 1.2);
  assert.equal(withValidator.clips['hashed-key'].pronunciation_review.low_confidence_words[0].probability, 0.31);
  assert.equal(withValidator.clips['hashed-key'].pronunciation_review.language_detection_uncertain, true,
    'language uncertainty must survive persistence so the admin sees the warning after reopening');
  assert.equal(withValidator.clips['hashed-key'].pronunciation_review.attached_at, '2026-11-06T00:00:00.000Z');
  const preservedValidator = core.applyDecision(withValidator, hashedEntry, {
    status: 'rejected', note: 'مراجعة بشرية'
  }, '2026-11-06T00:01:00.000Z');
  assert.equal(preservedValidator.clips['hashed-key'].pronunciation_review.status, 'review_required',
    'a later admin decision without a newly imported report must preserve the ASR evidence for the same audio hash');
  const unverifiedValidator = core.applyDecision(null, hashedEntry, {
    status: 'accepted',
    pronunciation_review: { ...validatorResult, audio_sha256: 'b'.repeat(64), hash_verified: true }
  });
  assert.equal(unverifiedValidator.clips['hashed-key'].pronunciation_review.hash_verified, false,
    'ASR evidence must not be marked verified when its hash differs from the reviewed MP3');
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
  const listened = { k1: true, k2: true };
  assert.equal(core.evaluateGate([e1, e2], rev, { k1: 'ready', k2: 'ready' }, listened).ok, true);
  assert.equal(core.evaluateGate([e1, e2], rev, { k1: 'ready', k2: 'ready' }, { k1: true }).notListened, 1, 'previous acceptance without current full playback must block approval');
  assert.equal(core.evaluateGate([e1, e2], rev, { k1: 'ready', k2: 'pending' }, listened).ok, false);
  assert.equal(core.evaluateGate([e1, e2], rev, { k1: 'ready', k2: 'error' }, listened).ok, false);
  assert.equal(core.evaluateGate([e1, e2], { clips: { k1: { status: 'accepted' } } }, { k1: 'ready', k2: 'ready' }, listened).unreviewed, 1);
  assert.equal(core.evaluateGate([e1, e2], { clips: { k1: { status: 'accepted' }, k2: { status: 'rejected' } } }, { k1: 'ready', k2: 'ready' }, listened).ok, false);
  assert.equal(core.evaluateGate([], rev, {}, {}).ok, false, 'empty must not pass');
  const allFive = { ar: {}, en: {}, fr: {}, it: {}, de: {} };
  assert.equal(core.evaluateFiveLanguageGate(allFive, [e1, e2], rev, { k1: 'ready', k2: 'ready' }, listened).ok, true);
  assert.deepEqual(
    core.evaluateFiveLanguageGate({ ar: {}, en: {} }, [e1], rev, { k1: 'ready' }).missingLanguages,
    ['fr', 'it', 'de'],
    'any missing language must block preview approval'
  );
  assert.equal(core.evaluateFiveLanguageGate({}, [], rev, {}).ok, false, 'no audio manifests must not bypass review');
  const arEnCoverage = { ar: { complete: false, missingBlocks: [1] }, en: { complete: true, missingBlocks: [] } };
  const arEnGate = core.evaluateLanguageGate({ ar: {}, en: {} }, arEnCoverage, ['ar', 'en'], [e1], { clips: { k1: { status: 'accepted' } } }, { k1: 'ready' }, { k1: true });
  assert.equal(arEnGate.ok, false, 'an AR/EN pilot must still fail while any selected-language block is missing');
  assert.equal(arEnGate.missingSegments, 1);
  arEnCoverage.ar = { complete: true, missingBlocks: [] };
  assert.equal(core.evaluateLanguageGate({ ar: {}, en: {} }, arEnCoverage, ['ar', 'en'], [e1], { clips: { k1: { status: 'accepted' } } }, { k1: 'ready' }, { k1: true }).ok, true, 'the selected-language gate may pass only when both selected manifests are complete and every clip is accepted');

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
  assert.doesNotThrow(function () { new Function(reviewUi); }, 'draft audio review UI must remain valid JavaScript');
  const adminHtml = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');
  assert.ok(reader.includes("window.__KH_STORY_PACKAGE=story;document.dispatchEvent(new CustomEvent('kh-story-audio-context'"), 'reader must publish story context after rendering for the audio reviewer');
  assert.ok(reviewUi.includes("if (!played[entry.key]) { state.textContent = 'استمع إلى المقطع كاملًا قبل قبوله.'; return; }"), 'a clip cannot be accepted before full playback');
  assert.ok(reviewUi.includes('if (manifestLoadFailure) return { ok: false, loadError: true'), 'manifest verification errors must block preview approval');
  assert.ok(reviewUi.includes('details.length ? \' \' + details.join(\' | \') : \'\''), 'manifest errors must identify the affected language and reason for the admin');
  assert.ok(reviewUi.includes('if (!initialized) return { ok: false, loading: true'), 'preview approval must remain blocked while manifests are loading');
  assert.ok(reviewUi.includes('if (!e || !e.isMissingManifest) manifestLoadFailure = true;'), 'only a confirmed 404 may be treated as a missing language manifest');
  assert.ok(reviewUi.includes(String.raw`/^[A-Za-z0-9_-]+\.mp3$/`), 'manifest MP3 filenames must match a normal .mp3 extension');
  assert.ok(reviewUi.includes('return core.evaluateLanguageGate(manifests, coverageByLanguage, LANGS, entries, review, readyByKey, played);'), 'preview must require complete coverage and current full playback in the selected Arabic-English pilot languages');
  assert.ok(reviewUi.includes('loadArabicExpectedTexts') && reviewUi.includes('core.validateManifestCoverage(localized && localized.blocks, data.segments, expectedTexts[lang], true)'), 'partial manifests must still validate every present segment against the approved language text while reporting missing blocks');
  assert.ok(reviewUi.includes('data.approved_audio_only_rewrites.forEach') && reviewUi.includes('return approved[index] ? data.blocks[String(index)] : fallback[index];'), 'only explicitly approved Arabic audio-only rewrites may differ from the visible story text');
  assert.ok(!reviewUi.includes('if (!enabled) return { ok: true'), 'an entirely missing audio set must never bypass the selected-language gate');
  assert.ok(reviewUi.includes("params.get('draft') !== '1'"), 'audio review must run only in draft preview mode');
  assert.ok(reviewUi.includes("action: 'review_get'") && reviewUi.includes('review = core.cloneReview(result.audio_review || null);'), 'review decisions must be loaded from the dedicated audio review record returned by review_get');
  assert.ok(reviewUi.includes("var currentResult = await audioAssetsRequest({ action: 'review_get', section: story.section, slug: story.slug });") && reviewUi.includes('var currentReview = core.cloneReview(currentResult.audio_review || null);') && reviewUi.includes('var next = core.applyDecision(currentReview, entry, decisionWithAnalysis);') && reviewUi.includes('next.audio_languages = LANGS.slice();'), 'each save must merge one clip decision and persist the selected Arabic-English review scope');
  assert.ok(reviewUi.includes('next.audio_hashes[entry.source_base] = entry.audio_sha256'), 'persist verified MP3 byte hashes so accepted decisions remain attached to the exact audio file');
  assert.ok(reviewUi.includes("if (busy) throw new Error('انتظر حتى يكتمل حفظ قرار المقطع السابق.')"), 'overlapping saves must show feedback instead of leaving a clip stuck in saving state');
  assert.ok(reviewUi.includes('stagedPackage.section !== story.section || stagedPackage.slug !== story.slug'), 'a stale admin context must never save one story review into another story row');
  assert.ok(reviewUi.includes('if (!connected) { initializing = false; return; }'), 'audio review controls must not render outside an admin-connected draft');
  assert.ok(reviewUi.includes('seg.audio_sha256 || review.audio_hashes[sourceBase] ||') && reviewUi.includes('knownAudioHash || seg.audio_revision'), 'review identity must reuse a verified MP3 digest across preview sessions');
  assert.ok(reviewUi.includes('core.sha256Bytes(await blob.arrayBuffer())'), 'the actual MP3 bytes played by the reviewer must be hashed and checked');
  assert.ok(reviewUi.includes('function pronunciationReviewFor(entry)'), 'ASR report data must be collected for the exact clip before saving an admin decision');
  assert.ok(reviewUi.includes('decisionWithAnalysis.pronunciation_review = attachedPronunciationReview'), 'the admin decision must carry the matching ASR result into persisted review metadata');
  assert.ok(reviewUi.includes('savedClip.pronunciation_review'), 'previously saved ASR findings must remain visible when the admin reopens the preview');
  assert.ok(reviewUi.includes('function stableReviewJson(value)'), 'persisted ASR evidence must be compared structurally without depending on JSON key order');
  assert.ok(reviewUi.includes('pronunciationReviewMatches(savedReview.clips[key], expectedPronunciationReview)'), 'the immediate save response must contain the complete expected ASR evidence');
  assert.ok(reviewUi.includes('pronunciationReviewMatches(verified.clips[key], expectedPronunciationReview)'), 'a fresh database read must confirm the complete ASR evidence survived persistence');
  assert.ok(reviewUi.includes("report.format !== 'KHALEDOON_AUDIO_PRONUNCIATION_REVIEW_V1'"), 'ASR reports must use the supported report contract');
  assert.ok(reviewUi.includes("reportEntries.length !== report.reports.length"), 'ASR reports with unmatchable entries must be rejected rather than partially trusted');
  assert.ok(reviewUi.includes('جزء متوقع غير موجود في التفريغ'), 'ASR review must expose expected words missing from the recognized transcript');
  assert.ok(reviewUi.includes('تطابق النص:'), 'ASR review must show transcript match ratio alongside language detection');

  assert.ok(reviewUi.includes("report.story !== story.slug || report.section !== story.section"), 'ASR reports must match the active story and section');
  assert.ok(reviewUi.includes("digest.toLowerCase() !== String(item.audio_sha256).toLowerCase()"), 'ASR report entries must be rejected when the current MP3 hash differs');
  assert.ok(reviewUi.includes('playPronunciationRange(match, item, listen, panel)'), 'ASR findings must offer targeted word playback without changing the full-listen approval gate');
  const loadManifestSection = reviewUi.slice(reviewUi.indexOf('async function loadManifests'), reviewUi.indexOf('function gate()'));
  const renderSection = reviewUi.slice(reviewUi.indexOf('function render()'), reviewUi.indexOf('function injectStyles()'));
  assert.ok(!loadManifestSection.includes('kh-audio-asr-import'), 'ASR report file input must not be created during manifest loading');
  assert.ok(renderSection.includes("host.parentNode.insertBefore(importer, host)"), 'ASR report importer must be mounted from the preview render lifecycle');
  assert.ok(reviewUi.includes('audio.ontimeupdate = null;'), 'targeted ASR playback must detach its seek handler before normal clip playback');
  assert.ok(reviewUi.includes("blob: null, hashVerified: false"), 'ASR findings without a verifiable MP3 hash may be shown only as unverified');
  assert.ok(reviewUi.includes("if (!match || !match.hashVerified || !match.blob"), 'targeted word playback must be blocked for unverified ASR reports');
  assert.ok(reviewUi.includes("item.playable && match.hashVerified && match.blob"), 'word playback controls must require a verified current MP3 file');
  assert.ok(reviewUi.includes('audio.onended = null; audio.onerror = null; audio.ontimeupdate = null; audio.pause();'), 'switching clips must detach stale playback events before revoking the previous audio URL');
  assert.ok(reviewUi.includes('readyByKey[entry.key] = \'ready\';') && reviewUi.includes('played[entry.key] = true;'), 'verified audio must be ready and count as listened only after playback ends');
  assert.ok(reviewUi.indexOf("blocks.forEach(function (block) { var old = block.querySelector(':scope > .kh-audio-review-controls'); if (old) old.remove(); });") < reviewUi.indexOf('if (!manifests[lang]) {'), 'switching to a language without a manifest must clear stale controls');
  assert.ok(!reviewUi.includes('meta.pending_draft.story_meta.audio_review'), 'review decisions must not be duplicated inside pending_draft');
  assert.ok(reviewUi.includes('@media print{.kh-audio-review-controls,.kh-audio-review-gate{display:none!important}}'), 'audio review controls and gate must never appear in print');
  assert.ok(!reviewUi.includes("nextStory.section === 'october'"), 'October drafts must use the shared audio review UI');
  assert.ok(reviewUi.includes('banner.hidden = false;'), 'the missing-audio gate must remain visible even when no manifest exists');
  assert.ok(reader.includes("if(previewMode||document.getElementById('kh-story-audio-script'))return"), 'the public player must initialize for all published sections, including October, but not inside admin preview');
  const publicAudioPlayer = fs.readFileSync(path.join(__dirname, '../../assets/shared/story-audio.js'), 'utf8');
  assert.ok(!publicAudioPlayer.includes("story.section !== 'science'"), 'the public audio player must not be hardcoded to Magdi Yacoub');
  assert.ok(publicAudioPlayer.includes("lang !== 'ar' && lang !== 'en'"), 'the first public rollout must support Arabic and English while leaving other languages extensible');
  assert.ok(publicAudioPlayer.includes("segment.provider !== 'edge-tts'"), 'English public playback must validate its Edge TTS manifest contract');
  assert.ok(publicAudioPlayer.includes('else document.body.appendChild(host)'), 'legacy story pages without the V2 blocks container must still receive the shared player');
  for (const octoberId of ['001', '002', '003', '004']) {
    const octoberHtml = fs.readFileSync(path.join(__dirname, '../../stories/october/' + octoberId + '/index.html'), 'utf8');
    assert.ok(octoberHtml.includes("window.__KH_STORY_PACKAGE={section:'october',slug:slug}"), 'October story ' + octoberId + ' must load the shared player using its existing slug');
    assert.ok(octoberHtml.includes('story-audio.js?v=20261108-universal-ar-en-1'), 'October story ' + octoberId + ' must use the shared audio player without changing its visual template');
  }
  const genericWorkflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/story-audio-segment-staging.yml'), 'utf8');
  assert.ok(genericWorkflow.includes('inputs.section') && genericWorkflow.includes('inputs.slug') && genericWorkflow.includes('inputs.language') && genericWorkflow.includes('inputs.block_index'), 'the segment workflow must accept a generic story identity, language, and block');
  assert.ok(genericWorkflow.includes('rebuild/october-audio-packages'), 'October source packages must use the same one-segment workflow');
  assert.ok(!genericWorkflow.includes('ibn-sina') && !genericWorkflow.includes('baseline_run_id'), 'the generic workflow must not be locked to Ibn Sina or require a pre-existing complete artifact');
  assert.ok(reviewUi.includes('context.story_id') && reviewUi.includes('preview.static_story_path'), 'the preview must recover the published story ID from the admin review context');
  assert.ok(adminHtml.includes('story_id:storyId'), 'the admin preview context must persist the canonical story ID for the generator');
  const generator = fs.readFileSync(path.join(__dirname, '../../scripts/generate_story_audio.py'), 'utf8');
  assert.ok(generator.includes('if force_blocks and index not in forced:'), 'single-block generation must skip every non-selected block');
  assert.ok(generator.includes('checkpoint_segments = {} if force_blocks else dict(processed_manifest_segments)'), 'a one-block workflow artifact must contain only its new block so the private staging service can merge it safely');
  const audioAssets = fs.readFileSync(path.join(__dirname, '../../supabase/functions/audio-review-assets/index.ts'), 'utf8');
  assert.ok(audioAssets.includes('story-audio-segment-staging.yml') && audioAssets.includes('namaa-voice-sample-staging.yml') && audioAssets.includes('confirm_namaa_audio_request'), 'English generation uses the generic story workflow while Arabic review samples use the restricted NAMAA workflow');
  const publisher = fs.readFileSync(path.join(__dirname, '../../supabase/functions/publish-story-pr/index.ts'), 'utf8');
  assert.ok(publisher.includes('audioReview.audio_languages') && publisher.includes('collectPrivateAudioForPublish'), 'publishing must honor the selected-language gate and include reviewed private MP3 files plus manifests in the public commit');
  assert.ok(publisher.includes('body?.action === "publish_audio_only"') && publisher.includes('audioOnlyPublish'), 'an already-published story must have a separate, explicit audio-only publication path');
  assert.ok(publisher.includes('audioReview.audio_languages) ? audioReview.audio_languages : ["ar", "en"]'), 'legacy pilot reviews without a stored scope must default to Arabic and English, not require three ungenerated languages');
  assert.ok(reviewUi.includes("action: 'publish_audio_only'") && reviewUi.includes('نشر الصوت على الصفحة المنشورة'), 'the review page must expose audio publication only after the selected-language gate passes and the owner confirms');
  assert.ok(readerHtml.indexOf('audio-review-core.js') < readerHtml.indexOf('reader-audio-review.js'), 'review core must load before its UI');
  assert.ok(reviewUi.includes("if (!played[entry.key]) { state.textContent = 'استمع إلى المقطع كاملًا قبل تسجيل الملاحظة أو الرفض.'; return; }"), 'a clip cannot be rejected before full playback');
  assert.ok(adminHtml.indexOf('assets/audio-review-core.js') < adminHtml.indexOf('var audioReviewSection'), 'admin must load the review core before building AI prompts');
  assert.ok(adminHtml.includes('buildPromptSection(it.story_meta.audio_review)'), 'audio decisions must be included in the AI prompt');
  assert.ok(fs.readFileSync(path.join(__dirname, '../../scripts/generate_story_audio.py'), 'utf8').includes('"audio_sha256": audio_sha256'), 'audio manifests must store the digest of the actual generated MP3 bytes');
  assert.ok(adminHtml.includes('var requireUnifiedStoryPackage=!isOctoberLegacyRecord(it)'), 'October editorial and story-content workflow must remain distinct');
  assert.ok(adminHtml.includes('(requireUnifiedStoryPackage||isOctoberLegacyRecord(it))&&window.KHAudioTextReview'), 'October audio text review must use the shared review UI without changing its story editor');
  assert.ok(adminHtml.includes('var storyReviewPackage=await audioReviewPackageOf(it)'), 'October preview must open its extracted package in the shared audio review preview');
  const octoberPreviewClick = adminHtml.slice(adminHtml.indexOf("preview.addEventListener('click'"), adminHtml.indexOf('actions.appendChild(preview)', adminHtml.indexOf("preview.addEventListener('click'")));
  assert.ok(octoberPreviewClick.indexOf("window.open('about:blank'") < octoberPreviewClick.indexOf('await audioReviewPackageOf(it)'), 'open the preview popup synchronously before fetching October audio source data');
  assert.ok(reviewActions.includes('if(!window.KHStoryAudioReview){message('), 'approval must fail closed if the audio reviewer did not load');
  assert.ok(reviewActions.includes('if(isApprove){'), 'all sections, including October, must pass the shared audio approval gate');
  assert.ok(reviewActions.includes('delete pendingMeta.audio_review') && reviewActions.includes('delete meta.pending_draft.story_meta.audio_review'), 'approval must not duplicate audio_review inside pending_draft metadata');

  console.log('audio-review-core tests passed');
})().catch(function (e) { console.error(e); process.exit(1); });
