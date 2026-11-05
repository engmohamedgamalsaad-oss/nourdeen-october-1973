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
    if (pkg.section === 'october') {
      throw new Error('مدقق النص الصوتي لا يعمل على قسم أكتوبر.');
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
      'لا تضف حقولًا إلى حزمة الحكاية. لا تعتبر أي اقتراح معتمدًا. كل اقتراح يحتاج مراجعة وموافقة بشرية صريحة.',
      '=== المقاطع الحالية ===',
      JSON.stringify({ story: pkg.slug, section: pkg.section, segments: segments }, null, 2)
    ].join('\n\n');
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

  var api = {
    LANGS: LANGS,
    collectSegments: collectSegments,
    diagnose: diagnose,
    buildPrompt: buildPrompt,
    validateResult: validateResult,
    buildApprovedPatch: buildApprovedPatch
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KHAudioTextReview = api;
})(typeof window !== 'undefined' ? window : globalThis);
