/* Read-only pre-generation speech-text review helpers. No persistence or TTS calls. */
(function (root) {
  'use strict';

  var LANGS = ['ar', 'en', 'fr', 'it', 'de'];
  var SPEAKERS = ['narrator', 'karma'];
  var ISSUE_TYPES = ['none', 'pronunciation', 'heavy_sentence', 'dialect', 'number', 'name', 'other'];

  function collectSegments(pkg) {
    if (!pkg || pkg.format !== 'KHALEDOON_STORY' || !pkg.i18n || typeof pkg.i18n !== 'object') {
      throw new Error('الحزمة الموحدة غير صالحة أو لا تحتوي على i18n.');
    }
    var out = [];
    LANGS.forEach(function (lang) {
      var localized = pkg.i18n[lang];
      if (!localized || !Array.isArray(localized.blocks) || !localized.blocks.length) {
        throw new Error('اللغة ' + lang + ' ناقصة أو لا تحتوي على مقاطع.');
      }
      localized.blocks.forEach(function (block, index) {
        if (!block || SPEAKERS.indexOf(block.speaker) < 0) return;
        var text = typeof block.text === 'string' ? block.text.trim() : '';
        if (!text) throw new Error('نص فارغ في ' + lang + '، المقطع ' + (index + 1) + '.');
        out.push({
          lang: lang,
          block_index: index,
          speaker: block.speaker,
          original_text: text
        });
      });
    });
    if (!out.length) throw new Error('لا توجد مقاطع راوٍ أو كارما قابلة للمراجعة.');
    return out;
  }

  function diagnose(pkg) {
    var segments = collectSegments(pkg);
    return segments.map(function (item) {
      var flags = [];
      if (item.original_text.length > 240) flags.push('long_segment');
      if (/\d/.test(item.original_text)) flags.push('digits_in_spoken_text');
      if (!/[.!?؟؛…]["'»”’)]*$/.test(item.original_text)) flags.push('check_sentence_ending');
      if (item.lang === 'ar') flags.push('human_egyptian_dialect_review_required');
      return Object.assign({}, item, { flags: flags });
    });
  }

  function buildPrompt(pkg) {
    var segments = collectSegments(pkg);
    return [
      'أنت مدقق نصوص صوتية لحكايات تعليمية للأطفال في مشروع خالدون عبر التاريخ.',
      'المطلوب مراجعة النص المنطوق فقط قبل توليد الصوت. لا تعدّل الحكاية المرئية ولا تعِد كتابة الحزمة الأصلية.',
      'العربية: راجع اللهجة المصرية الطبيعية كما يتحدث بها أهل مصر، دون فصحى ثقيلة أو ميل للصعيدية. الراوي واضح ودافئ وغير إذاعي، وكارما طفلة مصرية فضولية.',
      'طبّق طريقة المعالجة رقم 4: أعد صياغة الجملة الثقيلة أو الصعبة على النطق لتصبح أسهل في السماع، مع الحفاظ الحرفي على المعنى والوقائع والأسماء والتواريخ. لا تحذف معلومة ولا تضف معلومة أو اقتباسًا.',
      'راجع اللغات الخمس كلٌّ بلغتها الطبيعية. لا تفرض العامية المصرية على غير العربية. إذا لم تكن واثقًا من النطق أو سلامة الصياغة في لغة ما، اذكر ذلك واجعل needs_human_review=true.',
      'راجع الأسماء والأماكن والمصطلحات والأرقام والتواريخ. اكتب طريقة نطق مقترحة في reason عند الحاجة، ولا تغيّر تهجئة الاسم التاريخي داخل النص المرئي.',
      'أخرج JSON خامًا فقط وفق العقد التالي. أعد كل المقاطع دون إسقاط أو تكرار، وبنفس lang وblock_index وspeaker. original_text يجب أن يطابق النص المرسل حرفيًا. إذا لم تحتج الجملة تعديلًا، اجعل proposed_audio_text مساويًا تمامًا لـ original_text وissue_type=none.',
      'العقد: {"format":"KHALEDOON_AUDIO_TEXT_REVIEW_V1","segments":[{"lang":"ar|en|fr|it|de","block_index":0,"speaker":"narrator|karma","original_text":"...","proposed_audio_text":"...","issue_type":"none|pronunciation|heavy_sentence|dialect|number|name|other","reason":"...","needs_human_review":true}]}',
      'لا تضف حقولًا إلى حزمة الحكاية. لا تعتبر أي اقتراح معتمدًا. اجعل needs_human_review=true لكل المقاطع دائمًا؛ لا تعلن اعتمادًا آليًا. كل اقتراح يحتاج مراجعة وموافقة بشرية صريحة.',
      '=== المقاطع الحالية ===',
      JSON.stringify({ story: pkg.slug, section: pkg.section, segments: segments }, null, 2)
    ].join('\n\n');
  }

  function normalizeArabicToken(value) {
    return String(value || '').normalize('NFC').replace(/[\u064B-\u065F\u0670\u0640]/g, '');
  }

  function arabicTokenSpans(value) {
    var pattern = /[\u0621-\u064A\u066E-\u06D3\u06FA-\u06FC\u064B-\u065F\u0670]+/g;
    var spans = [], match;
    while ((match = pattern.exec(value)) !== null) {
      spans.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
    }
    return spans;
  }

  function applyDictionaryText(source, entry) {
    var sourceSpans = arabicTokenSpans(source);
    var matchTokens = arabicTokenSpans(entry.match).map(function (item) { return normalizeArabicToken(item.text); });
    var spokenTokens = arabicTokenSpans(entry.spoken).map(function (item) { return item.text; });
    if (matchTokens.length === 1 && !entry.before && !entry.after) {
      throw new Error('قاعدة قاموس غير آمنة: الكلمة المفردة تحتاج إلى سياق محدد.');
    }
    if ((entry.before && arabicTokenSpans(entry.before).length !== 1) ||
        (entry.after && arabicTokenSpans(entry.after).length !== 1)) {
      throw new Error('قاعدة قاموس غير آمنة: سياق القاعدة يجب أن يكون كلمة واحدة.');
    }
    if (!matchTokens.length || matchTokens.length !== spokenTokens.length ||
        spokenTokens.some(function (token, index) { return normalizeArabicToken(token) !== matchTokens[index]; })) {
      throw new Error('قاعدة قاموس غير آمنة: يجب الحفاظ على الحروف وترتيب الكلمات.');
    }
    var replacements = [], applied = false, cursor = 0;
    while (cursor < sourceSpans.length) {
      var endIndex = cursor + matchTokens.length;
      if (endIndex > sourceSpans.length) break;
      var actual = sourceSpans.slice(cursor, endIndex).map(function (item) { return normalizeArabicToken(item.text); });
      var matches = actual.every(function (token, index) { return token === matchTokens[index]; });
      if (matches) {
        for (var gapIndex = cursor; gapIndex < endIndex - 1; gapIndex++) {
          if (source.slice(sourceSpans[gapIndex].end, sourceSpans[gapIndex + 1].start).trim()) matches = false;
        }
        if (entry.before) {
          matches = matches && cursor > 0 &&
            !source.slice(sourceSpans[cursor - 1].end, sourceSpans[cursor].start).trim() &&
            normalizeArabicToken(sourceSpans[cursor - 1].text) === normalizeArabicToken(entry.before);
        }
        if (entry.after) {
          matches = matches && endIndex < sourceSpans.length &&
            !source.slice(sourceSpans[endIndex - 1].end, sourceSpans[endIndex].start).trim() &&
            normalizeArabicToken(sourceSpans[endIndex].text) === normalizeArabicToken(entry.after);
        }
      }
      if (!matches) { cursor++; continue; }
      for (var tokenIndex = 0; tokenIndex < spokenTokens.length; tokenIndex++) {
        replacements.push({
          start: sourceSpans[cursor + tokenIndex].start,
          end: sourceSpans[cursor + tokenIndex].end,
          text: spokenTokens[tokenIndex]
        });
      }
      applied = true;
      cursor = endIndex;
    }
    var result = source;
    replacements.reverse().forEach(function (item) {
      result = result.slice(0, item.start) + item.text + result.slice(item.end);
    });
    if (normalizeArabicToken(result.replace(/[^\\u0621-\\u064A\\u066E-\\u06D3\\u06FA-\\u06FC\\u064B-\\u065F\\u0670]+/g, '')) !==
        normalizeArabicToken(source.replace(/[^\\u0621-\\u064A\\u066E-\\u06D3\\u06FA-\\u06FC\\u064B-\\u065F\\u0670]+/g, ''))) {
      throw new Error('تطبيق القاموس غيّر الحروف العربية؛ تم إيقاف الاقتراح.');
    }
    return { text: result, applied: applied };
  }

  function applyDictionarySuggestions(input, pkg, dictionary) {
    var checked = validateResult(input, pkg);
    if (!checked.ok) throw new Error('تحقق من تقرير اللغات الخمس أولًا: ' + checked.errors.slice(0, 3).join(' | '));
    if (!dictionary || dictionary.schema_version !== 1 || !Array.isArray(dictionary.entries)) {
      throw new Error('ملف قاموس النطق غير صالح أو غير مدعوم.');
    }
    var result = typeof input === 'string' ? JSON.parse(input) : JSON.parse(JSON.stringify(input));
    var entries = dictionary.entries.slice().sort(function (a, b) {
      return arabicTokenSpans(b.match || '').length - arabicTokenSpans(a.match || '').length;
    });
    var applied = [];
    result.segments.forEach(function (item) {
      if (item.lang !== 'ar' || item.issue_type !== 'none' || item.proposed_audio_text !== item.original_text) return;
      entries.forEach(function (entry) {
        if (!entry || typeof entry.id !== 'string' || typeof entry.match !== 'string' || typeof entry.spoken !== 'string') {
          throw new Error('يوجد مدخل غير صالح في قاموس النطق.');
        }
      });
      for (var index = 0; index < entries.length; index++) {
        var candidate = applyDictionaryText(item.original_text, entries[index]);
        if (!candidate.applied || candidate.text === item.original_text) continue;
        item.proposed_audio_text = candidate.text;
        item.issue_type = 'pronunciation';
        item.reason = 'اقتراح من قاموس النطق العربي (' + entries[index].id + '). راجع التشكيل والسياق النحوي، وعدّل النص قبل الموافقة إذا لزم.';
        item.suggestion_source = 'ar-EG-pronunciation-dictionary';
        applied.push({ lang: item.lang, block_index: item.block_index, entry_id: entries[index].id });
        break;
      }
    });
    return { report: result, applied: applied, requires_human_approval: true, applied_to_story: false };
  }

  function validateResult(input, pkg) {
    var result;
    try {
      result = typeof input === 'string' ? JSON.parse(input) : input;
    } catch (error) {
      return { ok: false, errors: ['الناتج ليس JSON صالحًا.'] };
    }
    var errors = [];
    if (!result || typeof result !== 'object' || result.format !== 'KHALEDOON_AUDIO_TEXT_REVIEW_V1') {
      errors.push('إصدار تقرير التدقيق غير صحيح.');
    }
    if (!result || !Array.isArray(result.segments)) {
      errors.push('قائمة segments غير موجودة.');
      return { ok: false, errors: errors };
    }
    var expected;
    try {
      expected = collectSegments(pkg);
    } catch (error) {
      return { ok: false, errors: [error.message] };
    }
    var expectedByKey = Object.create(null);
    expected.forEach(function (item) {
      expectedByKey[item.lang + ':' + item.block_index] = item;
    });
    var seen = Object.create(null);
    result.segments.forEach(function (item, index) {
      var key = item && item.lang + ':' + item.block_index;
      var label = 'المقطع الناتج رقم ' + (index + 1);
      if (!item || typeof item !== 'object' || !expectedByKey[key]) {
        errors.push(label + ': لغة أو رقم مقطع غير موجود في الحكاية.');
        return;
      }
      if (seen[key]) errors.push(label + ': المقطع مكرر.');
      seen[key] = true;
      var source = expectedByKey[key];
      if (item.speaker !== source.speaker) errors.push(label + ': المتحدث لا يطابق الحكاية.');
      if (item.original_text !== source.original_text) errors.push(label + ': النص الأصلي تغيّر.');
      if (typeof item.proposed_audio_text !== 'string' || !item.proposed_audio_text.trim()) {
        errors.push(label + ': النص الصوتي المقترح فارغ.');
      }
      if (ISSUE_TYPES.indexOf(item.issue_type) < 0) errors.push(label + ': نوع المشكلة غير معتمد.');
      if (typeof item.reason !== 'string') errors.push(label + ': سبب الاقتراح غير موجود كنص.');
      if (item.issue_type !== 'none' && !item.reason.trim()) errors.push(label + ': سبب الاقتراح مطلوب.');
      if (item.needs_human_review !== true) errors.push(label + ': يجب إبقاء المراجعة البشرية مطلوبة دائمًا.');
      if (item.issue_type === 'none' && item.proposed_audio_text !== source.original_text) {
        errors.push(label + ': لا يجوز تغيير النص مع issue_type=none.');
      }
    });
    expected.forEach(function (item) {
      var key = item.lang + ':' + item.block_index;
      if (!seen[key]) errors.push('المقطع الأصلي غير موجود في التقرير: ' + key + '.');
    });
    return {
      ok: errors.length === 0,
      errors: errors,
      total: expected.length,
      suggestions: Array.isArray(result.segments)
        ? result.segments.filter(function (item) {
            return item && item.issue_type !== 'none' &&
              typeof item.proposed_audio_text === 'string' &&
              item.proposed_audio_text !== item.original_text;
          }).length
        : 0,
      requires_human_approval: true,
      applied: false
    };
  }

  function buildApprovedPatch(input, pkg, approvedKeys) {
    var checked = validateResult(input, pkg);
    if (!checked.ok) throw new Error('لا يمكن تصدير اقتراحات من تقرير غير صالح: ' + checked.errors.slice(0, 3).join(' | '));
    var result = typeof input === 'string' ? JSON.parse(input) : input;
    var approved = Object.create(null);
    (Array.isArray(approvedKeys) ? approvedKeys : []).forEach(function (key) {
      approved[String(key)] = true;
    });
    var changes = result.segments.filter(function (item) {
      var key = item.lang + ':' + item.block_index;
      return approved[key] === true &&
        item.issue_type !== 'none' &&
        item.proposed_audio_text !== item.original_text;
    }).map(function (item) {
      return {
        lang: item.lang,
        block_index: item.block_index,
        speaker: item.speaker,
        original_text: item.original_text,
        approved_audio_text: item.proposed_audio_text,
        issue_type: item.issue_type,
        reason: item.reason
      };
    });
    return {
      format: 'KHALEDOON_AUDIO_TEXT_APPROVED_PATCH_V1',
      story: pkg.slug,
      section: pkg.section,
      status: 'approved_for_manual_application',
      applied: false,
      changes: changes
    };
  }

  function buildApprovedAudioPronunciation(input, pkg, approvedKeys) {
    var checked = validateResult(input, pkg);
    if (!checked.ok) throw new Error('لا يمكن اعتماد مراجعة غير صالحة: ' + checked.errors.slice(0, 3).join(' | '));
    var result = typeof input === 'string' ? JSON.parse(input) : input;
    var approved = Object.create(null);
    (Array.isArray(approvedKeys) ? approvedKeys : []).forEach(function (key) {
      approved[String(key)] = true;
    });
    var suggestions = Object.create(null);
    result.segments.forEach(function (item) {
      if (item.issue_type !== 'none' && item.proposed_audio_text !== item.original_text) {
        suggestions[item.lang + ':' + item.block_index] = item;
      }
    });
    Object.keys(approved).forEach(function (key) {
      if (!suggestions[key]) throw new Error('تم تحديد اقتراح غير موجود أو غير قابل للاعتماد: ' + key);
    });
    var rewrites = { ar: {}, en: {}, fr: {}, it: {}, de: {} };
    var reviewSegments = result.segments.map(function (item) {
      var key = item.lang + ':' + item.block_index;
      // Only Arabic is submitted for owner approval. Other languages are prepared
      // by the assistant and retain their current source text unless separately revised.
      var selected = item.lang === 'ar' && approved[key] === true && suggestions[key];
      var spoken = selected ? item.proposed_audio_text : item.original_text;
      if (selected) rewrites.ar[String(item.block_index)] = spoken;
      return {
        lang: item.lang,
        block_index: item.block_index,
        speaker: item.speaker,
        source_text: item.original_text,
        approved_audio_text: spoken,
        decision: item.lang === 'ar'
          ? (selected ? 'approved_rewrite' : 'approved_original')
          : 'prepared_by_assistant'
      };
    });
    var arabicIndexes = Object.keys(rewrites.ar).sort(function (a, b) { return Number(a) - Number(b); });
    return {
      format: 'KHALEDOON_AUDIO_PRONUNCIATION_V1',
      story: pkg.slug,
      section: pkg.section,
      language: 'ar',
      approved_audio_only_rewrites: arabicIndexes,
      blocks: rewrites.ar,
      approved_audio_text_rewrites: rewrites,
      review: {
        format: 'KHALEDOON_AUDIO_TEXT_REVIEW_APPROVAL_V1',
        status: 'approved_by_admin',
        languages: LANGS.slice(),
        human_approved_languages: ['ar'],
        prepared_languages: ['en', 'fr', 'it', 'de'],
        total_segments: reviewSegments.length,
        segments: reviewSegments
      }
    };
  }

  var api = {
    LANGS: LANGS,
    collectSegments: collectSegments,
    diagnose: diagnose,
    buildPrompt: buildPrompt,
    validateResult: validateResult,
    applyDictionarySuggestions: applyDictionarySuggestions,
    buildApprovedPatch: buildApprovedPatch,
    buildApprovedAudioPronunciation: buildApprovedAudioPronunciation
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KHAudioTextReview = api;
})(typeof window !== 'undefined' ? window : globalThis);
