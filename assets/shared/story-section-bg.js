/* Story page background: takes the section colour used on the homepage card,
   derives a stable per-story variation from the story number, and adds a very
   light section pattern. October stories are intentionally left untouched.
   Loaded by reactions.js on story pages. Opt out with <body data-disable-section-bg>. */
(function () {
  'use strict';
  var body = document.body;
  if (!body || body.hasAttribute('data-disable-section-bg')) return;

  var m = location.pathname.match(/\/stories\/([a-z0-9-]+)\/(\d+)\/?/i);
  var section = ((m && m[1]) || body.getAttribute('data-story-section') || '').toLowerCase();
  if (!section || section === 'october') return;
  var storyId = (body.dataset && body.dataset.storySlug) || (m && m[2]) || '0';
  var n = parseInt(storyId, 10) || 0;

  /* Same defaults as the homepage gateway cards (collection-visuals.css, dark palette).
     The islamic card has no explicit default in CSS; it falls back to this green. */
  var DEFAULTS = {
    science: { inner: '#123d4a', outer: '#8ad9e8' },
    women: { inner: '#4b2944', outer: '#e7a1c1' },
    people: { inner: '#29415c', outer: '#f3c17b' },
    history: { inner: '#342b56', outer: '#d4b7ff' },
    curriculum: { inner: '#1f3560', outer: '#9bb7ff' },
    islamic: { inner: '#1f4a3a', outer: '#78c59a' }
  };
  var FALLBACK = { inner: '#1d2c3a', outer: '#e3bd78' };

  var API = 'https://ypwprddkscnfblhftkeb.supabase.co';
  var KEY = 'sb_publishable_JJnVwx8HQAJNxSok32L-qg_83fXk5Qn';
  var CACHE_KEY = 'kh-section-colors:v1:' + section;

  function valid(x) { return typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x); }

  function hexToHsl(hex) {
    var r = parseInt(hex.substr(1, 2), 16) / 255, g = parseInt(hex.substr(3, 2), 16) / 255, b = parseInt(hex.substr(5, 2), 16) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, h = 0, s = 0, d = max - min;
    if (d) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: h, s: s * 100, l: l * 100 };
  }
  function hsl(h, s, l) { return 'hsl(' + Math.round((h + 360) % 360) + ' ' + Math.round(s) + '% ' + Math.round(l * 10) / 10 + '%)'; }

  /* Light, line-art motif per section; one tile per story with size/opacity varied by story number. */
  function motif(sec, c) {
    var s = 'stroke="' + c + '"';
    switch (sec) {
      case 'science': return '<ellipse cx="30" cy="30" rx="22" ry="9" transform="rotate(30 30 30)" ' + s + '/><ellipse cx="30" cy="30" rx="22" ry="9" transform="rotate(150 30 30)" ' + s + '/><circle cx="30" cy="30" r="2.4" fill="' + c + '" stroke="none"/>';
      case 'history': return '<path d="M30 4 56 30 30 56 4 30Z" ' + s + '/><path d="M30 18 42 30 30 42 18 30Z" ' + s + '/>';
      case 'people': return '<path d="M0 60 60 0M-12 12 12-12M48 72 72 48" ' + s + '/>';
      case 'women': return '<circle cx="30" cy="21" r="7" ' + s + '/><circle cx="30" cy="39" r="7" ' + s + '/><circle cx="21" cy="30" r="7" ' + s + '/><circle cx="39" cy="30" r="7" ' + s + '/>';
      case 'islamic': return '<rect x="15" y="15" width="30" height="30" ' + s + '/><rect x="15" y="15" width="30" height="30" transform="rotate(45 30 30)" ' + s + '/>';
      default: return '<circle cx="12" cy="12" r="1.8" fill="' + c + '" stroke="none"/><circle cx="42" cy="42" r="1.8" fill="' + c + '" stroke="none"/>';
    }
  }

  function apply(colors) {
    var inner = valid(colors.inner) ? colors.inner : FALLBACK.inner;
    var outer = valid(colors.outer) ? colors.outer : FALLBACK.outer;
    var base = hexToHsl(inner);
    var step = (n * 37) % 5;                          /* 0..4, stable per story */
    var hue = base.h + (step - 2) * 5;
    var sat = Math.min(Math.max(base.s, 25), 60);
    /* Keep the page dark enough for the existing light text, even if the admin picked a bright colour. */
    var l = Math.max(9, Math.min(base.l, 20)) + step * 1.2;
    var top = hsl(hue, sat, l + 8), mid = hsl(hue, sat, l), bot = hsl(hue, sat, Math.max(4, l - 6));

    var size = 56 + step * 8;
    var opacity = (0.07 + step * 0.01).toFixed(2);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 60 60">' +
      '<g fill="none" stroke-width="1.1" stroke-opacity="' + opacity + '" fill-opacity="' + opacity + '">' + motif(section, outer) + '</g></svg>';
    var tile = 'data:image/svg+xml,' + encodeURIComponent(svg);

    var css = 'html body{' +
      '--kh-section-accent:' + outer + ';' +
      'background-color:' + mid + '!important;' +
      'background-image:url("' + tile + '"),radial-gradient(ellipse at 50% 0%,' + top + ' 0%,' + mid + ' 52%,' + bot + ' 100%)!important;' +
      'background-size:' + size + 'px ' + size + 'px,100% 100%!important;' +
      'background-repeat:repeat,no-repeat!important;' +
      'background-attachment:scroll!important}';
    var el = document.getElementById('kh-story-section-bg');
    if (!el) { el = document.createElement('style'); el.id = 'kh-story-section-bg'; document.head.appendChild(el); }
    el.textContent = css;
  }

  function cached() {
    try { var c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null'); if (c && valid(c.inner) && valid(c.outer)) return c; } catch (e) { }
    return null;
  }

  apply(cached() || DEFAULTS[section] || FALLBACK);

  /* Same source the homepage uses: the admin-approved section colours in Supabase. */
  var timer = new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, 4000); });
  var request = fetch(API + '/rest/v1/khaledoon_admin_config?config_key=eq.sections&select=config_value&limit=1', {
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY }
  }).then(function (r) { return r.ok ? r.json() : []; });
  Promise.race([request, timer]).then(function (rows) {
    var cfg = rows && rows[0] && rows[0].config_value;
    var c = cfg && cfg.colors && cfg.colors[section];
    if (c && valid(c.inner) && valid(c.outer)) {
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ inner: c.inner, outer: c.outer })); } catch (e) { }
      apply(c);
    }
  }).catch(function () { /* keep defaults; the page stays readable */ });
})();
