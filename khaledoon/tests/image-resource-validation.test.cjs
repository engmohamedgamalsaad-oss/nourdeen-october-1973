/* Exercises the browser image probe without network access. */
'use strict';
const assert = require('node:assert/strict');
const W = require('../assets/story-workflow.js');

function mockImage({ event = 'load', width = 640, height = 480 } = {}) {
  return class MockImage {
    constructor() { this.naturalWidth = width; this.naturalHeight = height; this.onload = null; this.onerror = null; }
    set src(value) {
      this._src = value;
      if (event === 'never') return;
      queueMicrotask(() => {
        if (event === 'error') { if (this.onerror) this.onerror(new Error('blocked')); }
        else if (this.onload) this.onload();
      });
    }
    get src() { return this._src; }
  };
}

async function main() {
  const url = 'https://images.example.org/portrait.jpg';
  assert.equal(await W.verifyImageResource(url, 'الغلاف', mockImage()), url,
    'a loaded image with real dimensions should be accepted');

  await assert.rejects(
    W.verifyImageResource(url, 'الصورة', mockImage({ event: 'error' }), 100),
    /فشل تحميله كصورة/,
    'network errors must reject the image'
  );

  await assert.rejects(
    W.verifyImageResource(url, 'الصورة', mockImage({ width: 0, height: 0 }), 100),
    /لا يحتوي بيانات صورة قابلة للعرض/,
    'empty or non-image responses must be rejected'
  );

  await assert.rejects(
    W.verifyImageResource(url, 'الصورة البطيئة', mockImage({ event: 'never' }), 5),
    /لم يتم تحميله كصورة فعلية/,
    'a stalled image must time out'
  );

  await assert.rejects(
    W.verifyImageResource('', 'الصورة', mockImage(), 100),
    /URL فارغ/,
    'an empty URL must be rejected'
  );

  console.log('Passed image resource validation: load, error, empty response, timeout, and empty URL.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
