const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const source = fs.readFileSync('supabase/functions/story-audio-worker/index.ts', 'utf8');
const match = source.match(/async function sha256\(bytes: Uint8Array\): Promise<string> \{([\s\S]*?)\n\}/);
assert.ok(match, 'worker SHA-256 helper must exist');
const digest = vm.runInNewContext('(async function(bytes) {' + match[1] + '})', { crypto: webcrypto, Uint8Array });
test('worker hashes exactly the supplied byte view, not surrounding bytes', async () => {
  const bytes = new TextEncoder().encode('XabcY');
  assert.equal(await digest(bytes.subarray(1, 4)), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('worker accepts SharedArrayBuffer-backed input by making a private byte copy', async () => {
  const bytes = new Uint8Array(new SharedArrayBuffer(3));
  bytes.set([97, 98, 99]);
  assert.equal(await digest(bytes), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
