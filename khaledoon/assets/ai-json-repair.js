/* Safe, conservative repair for common malformed JSON pasted from AI tools.
   Never changes the textarea/source text; only parses a working copy. */
(function (root) {
  'use strict';

  function stripWrappers(input) {
    var s = String(input == null ? '' : input).replace(/^\uFEFF/, '').trim();
    s = s.replace(/^\x60{3}(?:json)?[ \t]*\r?\n?/i, '');
    s = s.replace(/\r?\n?[ \t]*\x60{3}[ \t]*$/, '').trim();
    var first = s.indexOf('{');
    var last = s.lastIndexOf('}');
    if (first >= 0 && last > first) s = s.slice(first, last + 1);
    return s;
  }

  function repairQuotedStrings(source) {
    var out = '', inString = false, escaped = false;
    for (var i = 0; i < source.length; i++) {
      var ch = source[i];
      if (!inString) {
        out += ch;
        if (ch === '"') inString = true;
        continue;
      }
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '\n' || ch === '\r') {
        out += ch === '\r' && source[i + 1] === '\n' ? '\\n' : '\\n';
        if (ch === '\r' && source[i + 1] === '\n') i++;
        continue;
      }
      if (ch === '"') {
        var j = i + 1;
        while (j < source.length && /\s/.test(source[j])) j++;
        var next = source[j] || '';
        var isPropertyStart = next === '"' && /^"[^"\r\n]*"\s*:/.test(source.slice(j));
        if (next === ',' || next === '}' || next === ']' || next === ':' || j >= source.length) {
          out += ch;
          inString = false;
        } else if (isPropertyStart) {
          // A common AI omission: a comma between two properties.
          out += ch + ',';
          inString = false;
        } else {
          // A quote inside prose (e.g. قال "العلم" مهم) must be escaped in JSON.
          out += '\\' + ch;
        }
        continue;
      }
      out += ch;
    }
    return out;
  }

  function removeTrailingCommas(source) {
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
        if (source[j] === '}' || source[j] === ']') continue;
      }
      out += ch;
    }
    return out;
  }

  function parse(input) {
    var source = stripWrappers(input);
    try {
      return { value: JSON.parse(source), repaired: false, text: source };
    } catch (originalError) {
      var repaired = removeTrailingCommas(repairQuotedStrings(source));
      try {
        return { value: JSON.parse(repaired), repaired: repaired !== source, text: repaired };
      } catch (repairError) {
        var message = String(repairError && repairError.message || originalError && originalError.message || 'JSON غير صالح');
        var match = message.match(/position\s+(\d+)/i);
        var position = match ? Number(match[1]) : -1;
        var snippet = position >= 0
          ? source.slice(Math.max(0, position - 90), Math.min(source.length, position + 90)).replace(/\n/g, '↵').replace(/\r/g, '')
          : source.slice(0, 180).replace(/\n/g, '↵').replace(/\r/g, '');
        var error = new Error(message + (snippet ? ' — قرب هذا النص: ' + snippet : ''));
        error.originalError = originalError;
        error.repairError = repairError;
        throw error;
      }
    }
  }

  var api = { parse: parse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.KHAIJsonRepair = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
