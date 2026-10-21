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
   - truncated output (reply cut by the tool's length limit) is detected and reported clearly */
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

  function parse(input) {
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

  var api = { parse: parse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.KHAIJsonRepair = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
