/* Tests: audio review core (clip keys, decisions, gate, AI prompt section). */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../assets/audio-review-core.js');

(async function () {
  const S = 'science/magdi-yacoub';

  const alignedStory = { i18n: {
    ar: { blocks: [
      { type: 'paragraph', speaker: 'karma', text: 'النص العربي الأول' },
      { type: 'paragraph', speaker: 'narrator', text: 'النص العربي الثاني', image_after: 'photo', heading: 'عنوان عربي' }
    ] },
    en: { blocks: [
      { type: 'paragraph', speaker: 'karma', text: 'Natural English opening', source_ar_text: 'النص العربي الأول' },
      { type: 'paragraph', speaker: 'narrator', text: 'Natural English body', image_after: 'photo', heading: 'Translated heading', source_ar_text: 'النص العربي الثاني', source_ar_heading: 'عنوان عربي' }
    ] }
  } };
  assert.equal(core.validateTranslationAlignment(alignedStory, 'en').ok, true, 'culturally natural target-language text is accepted when source provenance and structure match');
  alignedStory.i18n.ar.blocks[1].text = 'النص العربي المعدل';
  const staleTranslation = core.validateTranslationAlignment(alignedStory, 'en');
  assert.equal(staleTranslation.ok, false, 'changing Arabic source must stale its paired translation');
  assert.deepEqual(staleTranslation.staleBlocks, [1]);
  alignedStory.i18n.en.blocks[1].source_ar_text = 'النص العربي المعدل';
  assert.equal(core.validateTranslationAlignment(alignedStory, 'en').ok, true, 'refreshing the source snapshot revalidates the translated block');
  alignedStory.i18n.en.blocks.pop();
  assert.equal(core.validateTranslationAlignment(alignedStory, 'en').ok, false, 'missing translated blocks must block generation');
  assert.equal(core.validateTranslationAlignment(alignedStory, 'en').staleBlocks, null, 'a locale-wide block-count mismatch must block all segments');

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
  const engine = { ...core.engineOf('ar', 'narrator'), audio_revision: 'mp3-sha-1' };
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
  assert.equal(core.validateManifestCoverage(coverageBlocks, coverageSegments.slice(0, 1)).ok, false, 'missing a story block must fail for a complete manifest');
  assert.equal(core.validateManifestCoverage(coverageBlocks, coverageSegments.slice(0, 1), undefined, true).ok, true, 'one-segment NAMAA previews may be reviewed incrementally');
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
  const e1 = { key: 'k1', lang: 'ar', block_index: 0, chunk_index: 0 }, e2 = { key: 'k2', lang: 'ar', block_index: 1, chunk_index: 0 };
  const rev = { clips: {
    k1: { status: 'accepted', lang: 'ar', block_index: 0, chunk_index: 0 },
    k2: { status: 'accepted', lang: 'ar', block_index: 1, chunk_index: 0 }
  } };
  const listened = { k1: true, k2: true };
  assert.equal(core.evaluateGate([e1, e2], rev, { k1: 'ready', k2: 'ready' }, listened).ok, true);
  const restored = core.restoreListenedFromDecisions([e1, e2], rev, {});
  assert.deepEqual({ ...restored }, { k1: true, k2: true }, 'saved decisions restore full-playback evidence after preview reload');
  assert.equal(core.evaluateGate([e1, e2], rev, { k1: 'ready', k2: 'ready' }, restored).ok, true);
  const changedAudioEntries = [{ key: 'k1-new', lang: 'ar', block_index: 0, chunk_index: 0 }];
  assert.deepEqual({ ...core.restoreListenedFromDecisions(changedAudioEntries, rev, {}) }, {}, 'a changed clip key must not inherit old playback evidence');
  assert.equal(core.evaluateGate([e1, e2], rev, { k1: 'ready', k2: 'pending' }, listened).ok, false);
  assert.equal(core.evaluateGate([e1, e2], rev, { k1: 'ready', k2: 'error' }, listened).ok, false);
  assert.equal(core.evaluateGate([e1, e2], { clips: { k1: { status: 'accepted' } } }, { k1: 'ready', k2: 'ready' }, listened).unreviewed, 1);
  assert.equal(core.evaluateGate([e1, e2], { clips: { k1: { status: 'accepted' }, k2: { status: 'rejected' } } }, { k1: 'ready', k2: 'ready' }, listened).ok, false);
  assert.equal(core.evaluateGate([], rev, {}, {}).ok, false, 'empty must not pass');
  const allFive = { ar: {}, en: {}, fr: {}, it: {}, de: {} };
  assert.equal(core.evaluateFiveLanguageGate(allFive, [e1, e2], rev, { k1: 'ready', k2: 'ready' }, listened).ok, true);
  assert.deepEqual(core.REQUIRED_LANGS, ['ar'], 'Arabic is the required publication language; English and other locales are optional');
  assert.equal(core.evaluateFiveLanguageGate({ ar: {}, en: {} }, [e1, e2], rev, { k1: 'ready', k2: 'ready' }, listened).ok, true, 'missing French/Italian/German audio must not block approval');
  assert.equal(
    core.evaluateFiveLanguageGate({ ar: {} }, [e1], rev, { k1: 'ready' }, listened).ok,
    true,
    'missing optional English audio must not block Arabic-first publication'
  );
  assert.deepEqual(
    core.evaluateFiveLanguageGate({ ar: {}, en: {} }, [e1], rev, { k1: 'ready' }, listened, ['ar', 'en', 'fr']).missingLanguages,
    ['fr'],
    'callers may widen the required language set'
  );
  assert.equal(core.evaluateFiveLanguageGate({}, [], rev, {}).ok, false, 'no audio manifests must not bypass review');

  /* النص المتوقع للصوت: نص القراءة المعتمد أولًا، ثم نص النطق، ثم نص الحكاية */
  assert.equal(core.expectedSpokenText('story', 'pron', { status: 'approved', approved_text: 'egyptian' }), 'egyptian', 'approved speech text sent to generation wins');
  assert.equal(core.expectedSpokenText('story', 'pron', { status: 'suggested', approved_text: 'egyptian', suggested_text: 'draft' }), 'pron', 'an unapproved suggestion must never become the expected text');
  assert.equal(core.expectedSpokenText('story', '', null), 'story');
  assert.equal(core.expectedSpokenText('story', 'pron', {}), 'pron');

  /* الصوت القديم يُفصل ولا يُقبل بصمت، وسجل الموافقة لا يُمس */
  const staleBlocks = [
    { speaker: 'karma', text: 'story one' },
    { speaker: 'narrator', text: 'story two' },
    { speaker: 'title', text: 'heading' }
  ];
  const staleSegs = [
    { block_index: 0, chunk_index: 0, speaker: 'karma', text: 'egyptian one' },
    { block_index: 1, chunk_index: 0, speaker: 'narrator', text: 'old text' }
  ];
  const staleSplit = core.splitStaleSegments(staleBlocks, staleSegs, ['egyptian one', 'egyptian two']);
  assert.deepEqual(staleSplit.stale, [1], 'clip whose recorded text differs from the approved speech text is stale');
  assert.equal(staleSplit.fresh.length, 1);
  assert.equal(staleSplit.fresh[0].block_index, 0, 'a clip matching the approved Egyptian text is fresh even though it differs from the story text');
  assert.deepEqual(core.uncoveredBlocks(staleBlocks, staleSplit.fresh), [1], 'a stale block has no usable audio, so approval stays blocked');
  assert.deepEqual(core.uncoveredBlocks(staleBlocks, staleSegs), [], 'non-spoken heading blocks never need audio');
  const multiChunk = core.splitStaleSegments([{ speaker: 'narrator', text: 'a b' }], [
    { block_index: 0, chunk_index: 1, text: 'b' }, { block_index: 0, chunk_index: 0, text: 'a' }
  ], ['a b']);
  assert.deepEqual(multiChunk.stale, [], 'chunks are joined in chunk order before comparing');
  assert.equal(core.validateManifestCoverage(staleBlocks, staleSplit.fresh, ['egyptian one', 'egyptian two'], true).ok, true, 'fresh clips validate once stale ones are separated');

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
  assert.ok(reviewUi.includes("if (!played[entry.key]) { state.textContent = 'استمع إلى المقطع كاملًا قبل الموافقة عليه.'; return; }"), 'a clip cannot be accepted before full playback');
  assert.ok(reviewUi.includes('if (manifestErrors[language] && !manifestMissing[language])'), 'a manifest verification error must block approval for the affected language');
  assert.ok(reviewUi.includes('details.length ? \' \' + details.join(\' | \') : \'\''), 'manifest errors must identify the affected language and reason for the admin');
  assert.ok(reviewUi.includes('if (!initialized) return { ok: false, loading: true'), 'preview approval must remain blocked while manifests are loading');
  assert.ok(reviewUi.includes('manifestMissing[lang] = true;') && reviewUi.includes('manifestErrors[lang] ='), 'only a confirmed 404 may be treated as a missing language manifest; other errors remain visible for that language');
  assert.ok(reviewUi.includes(String.raw`/^[A-Za-z0-9_-]+\.mp3$/`), 'manifest MP3 filenames must match a normal .mp3 extension');
  assert.ok(reviewUi.includes('core.evaluateFiveLanguageGate(manifests, languageEntries, review, readyByKey, played, [language])') && reviewUi.includes("function gate() { return languageGate('ar'); }"), 'each locale is reviewed independently and Arabic alone is the story publication gate');
  assert.ok(reviewUi.includes('loadArabicExpectedTexts') && reviewUi.includes("core.validateManifestCoverage(localized && localized.blocks, data.segments, expectedTexts[lang], data.provider === 'omnivoice' || (lang === 'ar' && data.provider === 'huggingface-space') || split.stale.length > 0)") && reviewUi.includes('core.expectedSpokenText(') && reviewUi.includes('core.splitStaleSegments('), 'Arabic audio must be checked against the approved speech text that was sent to generation (falling back to the approved pronunciation text), and all other languages against current story text; stale audio is separated, never silently accepted');
  assert.ok(reviewUi.includes('data.approved_audio_only_rewrites.forEach') && reviewUi.includes('return approved[index] ? data.blocks[String(index)] : fallback[index];'), 'only explicitly approved Arabic audio-only rewrites may differ from the visible story text');
  assert.ok(!reviewUi.includes('if (!enabled) return { ok: true'), 'an entirely missing audio set must never bypass the five-language gate');
  assert.ok(reviewUi.includes("params.get('draft') !== '1'"), 'audio review must run only in draft preview mode');
  assert.ok(reviewUi.includes("action: 'review_get'") && reviewUi.includes('review = core.cloneReview(result.audio_review || null);'), 'review decisions must be loaded from the dedicated audio review record returned by review_get');
  assert.ok(reviewUi.includes("var currentResult = await audioAssetsRequest({ action: 'review_get', section: story.section, slug: story.slug });") && reviewUi.includes('var currentReview = core.cloneReview(currentResult.audio_review || null);') && reviewUi.includes('var next = core.applyDecision(currentReview, entry, decisionWithAnalysis);'), 'each save must merge one clip decision into the freshly read review, not overwrite other clips');
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
  const renderSection = reviewUi.slice(reviewUi.indexOf('function renderBlocks()'), reviewUi.indexOf('function injectStyles()'));
  assert.ok(!loadManifestSection.includes('kh-audio-asr-import'), 'ASR report file input must not be created during manifest loading');
  assert.ok(renderSection.includes("host.parentNode.insertBefore(importer, host)"), 'ASR report importer must be mounted from the preview render lifecycle');
  assert.ok(reviewUi.includes('audio.ontimeupdate = null;'), 'targeted ASR playback must detach its seek handler before normal clip playback');
  assert.ok(reviewUi.includes("blob: null, hashVerified: false"), 'ASR findings without a verifiable MP3 hash may be shown only as unverified');
  assert.ok(reviewUi.includes("if (!match || !match.hashVerified || !match.blob"), 'targeted word playback must be blocked for unverified ASR reports');
  assert.ok(reviewUi.includes("item.playable && match.hashVerified && match.blob"), 'word playback controls must require a verified current MP3 file');
  assert.ok(reviewUi.includes('audio.onended = null; audio.onerror = null; audio.ontimeupdate = null; audio.onloadedmetadata = null; audio.pause(); audio.currentTime = 0;'), 'switching clips must detach stale playback events before revoking the previous audio URL');
  assert.ok(reviewUi.includes('readyByKey[entry.key] = \'ready\';') && reviewUi.includes('played[entry.key] = true;'), 'verified audio must be ready and count as listened only after playback ends');
  assert.ok(reviewUi.indexOf("Array.prototype.slice.call(block.querySelectorAll(':scope > .kh-audio-review-controls')).forEach(function (old) { old.remove(); });") < reviewUi.indexOf('if (!manifests[lang]) {'), 'switching to a language without a manifest must clear stale controls');
  assert.ok(!reviewUi.includes('meta.pending_draft.story_meta.audio_review'), 'review decisions must not be duplicated inside pending_draft');
  const reviewCss = fs.readFileSync(path.join(__dirname, '../../rebuild/reader-audio-review.css'), 'utf8');
  assert.ok(/@media print\s*\{\s*\.kh-audio-review-controls,\s*\.kh-audio-review-gate\s*\{\s*display:\s*none\s*!important;?\s*\}\s*\}/.test(reviewCss), 'audio review controls and gate must never appear in print');
  assert.ok(!reviewUi.includes("nextStory.section === 'october'"), 'October drafts must use the shared audio review UI');
  assert.ok(reviewUi.includes('banner.hidden = false;'), 'the missing-audio gate must remain visible even when no manifest exists');
  assert.ok(reader.includes("if(previewMode||document.getElementById('kh-story-audio-script'))return"), 'preserve the existing October reader/player flow while the draft preview reviewer is the only initializer');
  assert.ok(readerHtml.indexOf('audio-review-core.js') < readerHtml.indexOf('reader-audio-review.js'), 'review core must load before its UI');
  assert.ok(reviewUi.includes("if (!played[entry.key]) { state.textContent = 'استمع إلى المقطع كاملًا قبل تسجيل الملاحظة أو الرفض.'; return; }"), 'a clip cannot be rejected before full playback');
  assert.ok(adminHtml.indexOf('assets/audio-review-core.js') < adminHtml.indexOf('var audioReviewSection'), 'admin must load the review core before building AI prompts');
  assert.ok(adminHtml.includes('buildPromptSection(it.story_meta.audio_review)'), 'audio decisions must be included in the AI prompt');
  assert.ok(!fs.existsSync(path.join(__dirname, '../../scripts/generate_story_audio.py')), 'the retired Fish Audio generator must not remain in the active repository');
  const worker = fs.readFileSync(path.join(__dirname, '../../supabase/functions/story-audio-worker/index.ts'), 'utf8');
  assert.ok(worker.includes('sha256(bytes)') && worker.includes('provider: "omnivoice"'), 'the active VoiceTut worker must hash uploaded audio and write OmniVoice manifests');
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
