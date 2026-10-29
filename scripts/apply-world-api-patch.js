#!/usr/bin/env node
/* Adds the small bridge that khaledoon-world-gl.js needs to khaledoon/assets/khaledoon-world.js.
   Usage: node scripts/apply-world-api-patch.js [path-to-khaledoon-world.js]
   Safe to re-run: it does nothing if the bridge is already there, and it refuses to touch the file
   unless every anchor is found exactly once. */
'use strict';
var fs = require('fs');
var file = process.argv[2] || 'khaledoon/assets/khaledoon-world.js';
var src = fs.readFileSync(file, 'utf8');

if (src.indexOf('window._khWorldApi') >= 0) {
  console.log('Already patched: ' + file);
  process.exit(0);
}

var API = [
  "  /* Bridge for khaledoon-world-gl.js. The 2D globe keeps owning points, selection, cards, zoom and events. */",
  "  var glHooks={redraw:[],reset:[]};",
  "  window._khWorldApi={",
  "    stage:stage,canvas:canvas,",
  "    getPoints:function(){return points},",
  "    getSelected:function(){return selectedPoint},",
  "    getGeography:function(){return geography},",
  "    getZoom:function(){return zoom},",
  "    setZoom:function(v){setZoom(v)},",
  "    select:function(p){selectPoint({p:p,x:0,y:0})},",
  "    sectionColor:function(id){return sectionColor(id)},",
  "    cityLabel:function(n){return cityLabel(n)},",
  "    redraw:function(){requestDraw()},",
  "    onRedraw:function(f){glHooks.redraw.push(f)},",
  "    onReset:function(f){glHooks.reset.push(f)}",
  "  };",
  "  /* Loads the optional WebGL layer; if it is missing or fails, the 2D globe keeps working. */",
  "  (function(){var s=document.createElement('script');s.src='khaledoon/assets/khaledoon-world-gl.js?v=20261030-gl-1';s.defer=true;(document.head||document.documentElement).appendChild(s)})();",
  ""
].join('\n');

var edits = [
  {
    name: 'draw() hand-off',
    re: /function draw\(\)\{(\s*)raf=0;/,
    to: function (m, ws) {
      return 'function draw(){' + ws + 'raf=0;' + ws +
        'if(window._khUseThree&&glHooks){glHooks.redraw.forEach(function(f){try{f()}catch(e){}});return}';
    }
  },
  {
    name: 'zoom reset button',
    re: /else setZoom\(1\)\}\);/,
    to: function () {
      return 'else{setZoom(1);if(glHooks)glHooks.reset.forEach(function(f){try{f()}catch(e){}})}});';
    }
  },
  {
    name: 'reset button stays enabled with the WebGL globe',
    re: /zoomReset\.disabled=Math\.abs\(zoom-1\)<\.001/,
    to: function () { return 'zoomReset.disabled=Math.abs(zoom-1)<.001&&!window._khUseThree'; }
  },
  {
    name: 'API bridge',
    re: /(\n[ \t]*)(requestDraw\(\);\s*fetch\('khaledoon\/assets\/geo\/natural-earth-110m\.json')/,
    to: function (m, nl, rest) { return '\n' + API + nl.replace(/^\n/, '') + rest; }
  }
];

var out = src, problems = [];
edits.forEach(function (e) {
  var g = new RegExp(e.re.source, 'g'), count = (out.match(g) || []).length;
  if (count !== 1) { problems.push(e.name + ': found ' + count + ' times (expected 1)'); return; }
  out = out.replace(e.re, e.to);
});
if (problems.length) {
  console.error('Not patched. ' + problems.join('; '));
  process.exit(1);
}
fs.writeFileSync(file, out);
console.log('Patched: ' + file + ' (' + edits.length + ' edits)');
