/* Safe, conservative repair for malformed JSON pasted from AI tools.
   Never changes the textarea/source text; only parses a working copy.

   Failure classes handled (all seen with ChatGPT / Gemini / Claude / DeepSeek output):
   - Markdown escapes inside JSON strings, e.g. \*\* or \_  (invalid JSON escapes) -> backslash dropped
   - Markdown emphasis/headings left inside story texts (**bold**, # heading) -> removed from texts
     (original_body, URLs and fixed keys are never touched)
   - raw line breaks / tabs / control characters inside strings
   - unescaped double quotes inside prose, trailing commas, a missing comma between properties
   - code fences, text before/after the JSON object, BOM, non-breaking / zero-width spaces
   - typographic quotes used around property names
   - truncated output (reply cut by the tool's length limit) is detected and reported clearly
   - several JSON objects in one paste (the AI repeated its answer, with stray tags such as </escape> or
     doubled code fences between them): each balanced object is tried and the most complete valid one is used

   Prompt side: ask for one raw JSON object without Markdown fences. The parser remains tolerant of legacy
   fenced replies, but the copy helper must never encourage fences or rewrite the prompt to request them. */
(function (root) {
  'use strict';

  var INVISIBLE = /[\u00A0\u200B\u200C\u200D\u200E\u200F\u2060\uFEFF]/;
  var VALID_ESCAPES = '"\\/bfnrtu';
  var SKIP_KEYS = { original_body: 1, url: 1, source_url: 1, format: 1, section_key: 1, kind: 1, visual_design: 1 };

  function stripWrappers(input) {
    var s = String(input == null ? '' : input).replace(/^\uFEFF/, '').trim();
    // Prefer the largest fenced block that contains an object; tolerate a missing closing fence.
    var fence = /\x60{3}[a-zA-Z0-9_-]*[ \t]*\r?\n?([\s\S]*?)(?:\x60{3}|$)/g, best = '', m;
    while ((m = fence.exec(s))) {
      if (m[1].indexOf('{') >= 0 && m[1].length > best.length) best = m[1];
      if (m.index === fence.lastIndex) fence.lastIndex++;
    }
    if (best) s = best.trim();
    var first = s.indexOf('{');
    var last = s.lastIndexOf('}');
    if (first >= 0 && last > first) s = s.slice(first, last + 1);
    else if (first >= 0) s = s.slice(first);
    return s;
  }

  // “key”: -> "key":   (only property names; quotes inside prose are legitimate text)
  function fixCurlyKeys(source, stats) {
    return source.replace(/([{,]\s*)[\u201C\u201D\u201E]([^\u201C\u201D\u201E"\r\n]{1,80})[\u201C\u201D\u201E](\s*:)/g, function (all, a, key, b) {
      stats.curly++;
      return a + '"' + key + '"' + b;
    });
  }

  function isSpace(ch) {
    return /\s/.test(ch) || INVISIBLE.test(ch);
  }

  function commaStartsNextToken(source, from) {
    var j = from;
    while (j < source.length && isSpace(source[j])) j++;
    var c = source[j] || '';
    if (c === '' || '"{[-0123456789}]'.indexOf(c) >= 0) return true;
    return /^(true|false|null)\b/.test(source.slice(j, j + 5));
  }

  function repairQuotedStrings(source, stats) {
    var out = '', inString = false;
    for (var i = 0; i < source.length; i++) {
      var ch = source[i];
      if (!inString) {
        if (INVISIBLE.test(ch)) { out += ' '; continue; }
        out += ch;
        if (ch === '"') inString = true;
        continue;
      }
      if (ch === '\\') {
        var nx = source[i + 1];
        var ok = nx !== undefined && VALID_ESCAPES.indexOf(nx) >= 0 &&
          (nx !== 'u' || /^[0-9a-fA-F]{4}$/.test(source.substr(i + 2, 4)));
        if (ok) { out += ch + nx; i++; continue; }
        stats.escapes++; // e.g. \* \_ \# from Markdown: not a JSON escape, keep the character only
        continue;
      }
      if (ch === '\n' || ch === '\r') {
        out += '\\n';
        if (ch === '\r' && source[i + 1] === '\n') i++;
        stats.controls++;
        continue;
      }
      if (ch === '\t') { out += '\\t'; stats.controls++; continue; }
      if (ch.charCodeAt(0) < 32) {
        out += '\\u' + ('0000' + ch.charCodeAt(0).toString(16)).slice(-4);
        stats.controls++;
        continue;
      }
      if (ch === '"') {
        var j = i + 1;
        while (j < source.length && isSpace(source[j])) j++;
        var next = source[j] || '';
        var isPropertyStart = next === '"' && /^"[^"\r\n]*"\s*:/.test(source.slice(j));
        var closes = next === '}' || next === ']' || next === ':' || j >= source.length ||
          (next === ',' && commaStartsNextToken(source, j + 1));
        if (closes) {
          out += ch;
          inString = false;
        } else if (isPropertyStart) {
          // A common AI omission: a comma between two properties.
          out += ch + ',';
          inString = false;
        } else {
          // A quote inside prose (e.g. قال "العلم" مهم) must be escaped in JSON.
          out += '\\' + ch;
          stats.quotes++;
        }
        continue;
      }
      out += ch;
    }
    return out;
  }

  function removeTrailingCommas(source, stats) {
    var out = '', inString = false, escaped = false;
    for (var i = 0; i < source.length; i++) {
      var ch = source[i];
      if (inString) {
        out += ch;
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        out += ch;
        continue;
      }
      if (ch === ',') {
        var j = i + 1;
        while (j < source.length && /\s/.test(source[j])) j++;
        if (source[j] === '}' || source[j] === ']') { stats.commas++; continue; }
      }
      out += ch;
    }
    return out;
  }

  function isTruncated(text) {
    var depth = 0, inString = false, escaped = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') depth--;
    }
    return inString || depth > 0;
  }

  // Markdown has no meaning on the story page, so its markers would show up as stray symbols.
  function cleanText(s) {
    return s
      .replace(/\\([*_#\x60~\[\]()>+\-.!|])/g, '$1')
      .replace(/\*\*(?=\S)([^\n]*?\S)\*\*/g, '$1')
      .replace(/__(?=\S)([^\n]*?\S)__/g, '$1')
      .replace(/(^|[\s(\[\u00AB"'\u060C:\u061B])\*(?=\S)([^*\n]*?\S)\*(?=[\s)\].,:;!?\u061F\u060C\u00BB"']|$)/g, '$1$2')
      .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '');
  }

  function cleanTree(node, key, flag) {
    if (typeof node === 'string') {
      if (key && Object.prototype.hasOwnProperty.call(SKIP_KEYS, key)) return node;
      var cleaned = cleanText(node);
      if (cleaned !== node) flag.changed = true;
      return cleaned;
    }
    if (Array.isArray(node)) {
      return node.map(function (item) { return cleanTree(item, key, flag); });
    }
    if (node && typeof node === 'object') {
      var out = {};
      Object.keys(node).forEach(function (k) {
        if (k === '__proto__') return;
        out[k] = cleanTree(node[k], k, flag);
      });
      return out;
    }
    return node;
  }

  function finish(value, syntaxRepaired, text, notes) {
    var flag = { changed: false };
    var cleaned = cleanTree(value, null, flag);
    if (flag.changed) notes.push('حُذفت علامات Markdown (مثل ** و \\*) من النصوص؛ original_body والروابط لم تُمس.');
    return { value: cleaned, repaired: syntaxRepaired || flag.changed, text: text, notes: notes };
  }

  function parseSingle(input) {
    var source = stripWrappers(input);
    try {
      return finish(JSON.parse(source), false, source, []);
    } catch (originalError) {
      var stats = { escapes: 0, controls: 0, quotes: 0, commas: 0, curly: 0 };
      var repaired = removeTrailingCommas(repairQuotedStrings(fixCurlyKeys(source, stats), stats), stats);
      try {
        var notes = [];
        if (stats.escapes) notes.push('أُزيلت ' + stats.escapes + ' علامة \\ غير صالحة داخل النصوص.');
        if (stats.controls) notes.push('حُوّلت أسطر/مسافات جدولة خام داخل النصوص إلى صيغة JSON صحيحة.');
        if (stats.quotes) notes.push('هُرّبت ' + stats.quotes + ' علامة اقتباس داخل النصوص.');
        if (stats.commas) notes.push('أُزيلت ' + stats.commas + ' فاصلة زائدة.');
        if (stats.curly) notes.push('صُحّحت علامات اقتباس أسماء الحقول.');
        return finish(JSON.parse(repaired), repaired !== source, repaired, notes);
      } catch (repairError) {
        var message = String(repairError && repairError.message || originalError && originalError.message || 'JSON غير صالح');
        var match = message.match(/position\s+(\d+)/i);
        var position = match ? Number(match[1]) : -1;
        var snippet = position >= 0
          ? source.slice(Math.max(0, position - 90), Math.min(source.length, position + 90)).replace(/\n/g, '↵').replace(/\r/g, '')
          : source.slice(0, 180).replace(/\n/g, '↵').replace(/\r/g, '');
        var hint = isTruncated(repaired)
          ? 'الناتج مقطوع قبل نهايته (غالبًا حد طول الرد): اطلب من الأداة إكماله ثم الصق الناتج كاملًا. '
          : '';
        var error = new Error(hint + message + (snippet ? ' — قرب هذا النص: ' + snippet : ''));
        error.originalError = originalError;
        error.repairError = repairError;
        error.truncated = !!hint;
        throw error;
      }
    }
  }

  // Every balanced top-level {...} object in the pasted text (string-aware), in order.
  function topLevelObjects(input) {
    var text = String(input == null ? '' : input), found = [];
    var depth = 0, start = -1, inString = false, escaped = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (depth > 0 && inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (depth > 0 && ch === '"') { inString = true; continue; }
      if (ch === '{') { if (depth === 0) start = i; depth++; }
      else if (ch === '}' && depth > 0) {
        depth--;
        if (depth === 0 && start >= 0) { found.push(text.slice(start, i + 1)); start = -1; }
      }
    }
    return found;
  }

  function parse(input) {
    try {
      return parseSingle(input);
    } catch (firstError) {
      /* The paste may hold the answer twice (the AI repeated it, with stray tags or doubled fences between
         the copies) or text around it. Try each balanced object; prefer the story package, then the longest. */
      var candidates = topLevelObjects(input);
      var valid = [];
      candidates.forEach(function (c) {
        try { valid.push(parseSingle(c)); } catch (ignore) { /* try the next object */ }
      });
      if (!valid.length) throw firstError;
      var packages = valid.filter(function (r) { return r.value && r.value.format === 'KHALEDOON_STORY'; });
      if (!packages.length) packages = valid.filter(function (r) { return r.value && r.value.format === 'KH_STORY_PACKAGE_V1'; });
      var pool = packages.length ? packages : valid;
      var chosen = pool.reduce(function (a, b) { return b.text.length > a.text.length ? b : a; });
      var notes = chosen.notes.slice();
      notes.push(candidates.length > 1
        ? 'وُجد أكثر من كائن JSON في اللصق (نسخة مكررة أو نص زائد بينها)؛ اعتُمد أكبر كائن مكتمل وصالح.'
        : 'حُذف نص زائد حول كائن JSON.');
      return { value: chosen.value, repaired: true, text: chosen.text, notes: notes };
    }
  }

  /* ---- raw JSON prompt normalization -------------------------------------------------------
     Legacy provider-specific prompt fragments may still ask for fenced JSON. Normalize those fragments
     to one raw JSON object, matching the canonical v4 prompt and import contract. The old sentences below
     are retained only where they still occur in admin.html; tests guard against drift. */
  var PROMPT_MARKER = 'KHALEDOON_STORY';
  var LEGACY_PROMPT_MARKER = 'KH_STORY_PACKAGE_V1';
  var PROMPT_RULES = [
    ['أخرج الحزمة وفق المخطط فقط؛ لا تضف شرحًا خارج JSON.',
      'أخرج الحزمة وفق المخطط ككائن JSON خام فقط؛ لا تضف شرحًا خارج الكائن أو أسوار كود.'],
    ['أخرج كائن JSON واحدًا صالحًا للاستيراد فقط، بلا Markdown أو مقدمة أو خاتمة.',
      'أخرج كائن JSON واحدًا صالحًا للاستيراد كنص خام فقط، بلا Markdown أو أسوار كود أو مقدمة أو خاتمة.'],
    ['قبل إخراج JSON؛ لا تضف Markdown أو نصًا خارجه.',
      'أخرج JSON خامًا بلا Markdown أو أسوار كود أو مقدمة أو خاتمة أو نص خارج الكائن.'],
    ['أخرج JSON صالحًا فقط بلا Markdown أو أسوار كود أو مقدمة أو خاتمة.',
      'أخرج كائن JSON واحدًا صالحًا فقط كنص خام، بلا Markdown أو أسوار كود أو مقدمة أو خاتمة.']
  ];

  /* ---- import-acceptance rules -------------------------------------------------------------
     Rules the admin import and the publish bundle enforce but the prompt never stated. Without them the AI
     returns valid JSON that is still rejected (paragraph counts differ between languages, a field is cut at the
     import length limit, fewer than two source links) or renders as one big block (single newlines). The block is
     inserted before the story data at copy time, and only once. */
  var EXTRA_RULES_TITLE = '=== قواعد إلزامية لقبول الاستيراد ===';
  var STORY_DATA_TITLE = '=== بيانات الحكاية كاملة ===';
  var EXTRA_RULES = EXTRA_RULES_TITLE + '\n' +
    '1. الفقرات: افصل الفقرات في karma_text وbody وhistory_note وimages_note بسطر فارغ واحد، أي \\n\\n داخل قيمة JSON. لا تستخدم سطرًا واحدًا بين فقرتين.\n' +
    '2. تطابق الفقرات: عدد فقرات كل ترجمة (en وfr وit وde) في karma_text وbody وhistory_note وimages_note يساوي عدد فقرات النص العربي تمامًا؛ لا تدمج فقرتين ولا تقسّم فقرة.\n' +
    '3. الأطوال القصوى بالحروف: title 140، subtitle 200، body 12000، history_note 12000، sources 3000، images_note 1500. اختصر ولا تتجاوز؛ ما زاد يُقصّ عند الحفظ ويكسر تطابق الفقرات.\n' +
    '4. sources: كل مصدر في سطر مستقل بصيغة «اسم المصدر — https://الرابط»، ورابطان مختلفان وصالحان على الأقل. لا تختلق روابط.\n' +
    '5. images: صورتان على الأقل؛ url وsource_url يبدأ كل منهما بـ https://، وkind واحدة من archival وillustration وdiagram وmap.\n' +
    '6. question_bank: خمسة أسئلة على الأقل؛ a رقم صحيح بلا علامات اقتباس، وعدد اختيارات كل ترجمة يساوي عدد اختيارات الأصل.\n' +
    '7. داخل قيم النصوص لا تستخدم علامة الاقتباس المزدوجة " (استعمل « ») ولا تضع أسطرًا خامًا؛ استخدم \\n.\n' +
    '8. لا تكرر الإجابة ولا تضع أي وسوم أو نص (مثل </escape>) حول الكائن: JSON خام واحد فقط بلا أسوار كود.\\n' +
    '9. افحص الناتج قبل الإرسال: كائن JSON واحد، كل الحقول المطلوبة موجودة، لا فواصل زائدة، والرد غير مقطوع.';

  function toRawJsonPrompt(text) {
    try {
      if (typeof text !== 'string' || (text.indexOf(PROMPT_MARKER) < 0 && text.indexOf(LEGACY_PROMPT_MARKER) < 0)) return text;
      var out = text;
      PROMPT_RULES.forEach(function (rule) { out = out.split(rule[0]).join(rule[1]); });
      if (out.indexOf(EXTRA_RULES_TITLE) < 0) {
        var at = out.indexOf(STORY_DATA_TITLE);
        if (at >= 0) out = out.slice(0, at).replace(/\s+$/, '') + '\n\n' + EXTRA_RULES + '\n\n' + out.slice(at);
      }
      return out;
    } catch (ignore) {
      return text; // never block copying because of this helper
    }
  }

  // Applies the rewrite at the two copy sinks admin.html uses (Clipboard API and the textarea fallback).
  function installPromptPatch(win) {
    try {
      var nav = win && win.navigator, doc = win && win.document;
      if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function' && !nav.clipboard.__khRawJson) {
        var originalWrite = nav.clipboard.writeText.bind(nav.clipboard);
        nav.clipboard.writeText = function (text) { return originalWrite(toRawJsonPrompt(text)); };
        nav.clipboard.__khRawJson = true;
      }
      if (doc && typeof doc.execCommand === 'function' && !doc.__khRawJson) {
        var originalExec = doc.execCommand.bind(doc);
        doc.execCommand = function (command, showUi, value) {
          try {
            if (String(command).toLowerCase() === 'copy') {
              var field = doc.activeElement;
              if (field && field.tagName === 'TEXTAREA') {
                var next = toRawJsonPrompt(field.value);
                if (next !== field.value) { field.value = next; field.select(); }
              }
            }
          } catch (ignore) { /* fall through to the normal copy */ }
          return originalExec(command, showUi, value);
        };
        doc.__khRawJson = true;
      }
    } catch (ignore) { /* copy keeps working unpatched */ }
  }

  var api = { parse: parse, toRawJsonPrompt: toRawJsonPrompt, toCodeBlockPrompt: toRawJsonPrompt, installPromptPatch: installPromptPatch, PROMPT_RULES: PROMPT_RULES, EXTRA_RULES: EXTRA_RULES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.KHAIJsonRepair = api;
  if (typeof window !== 'undefined') installPromptPatch(window);
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
