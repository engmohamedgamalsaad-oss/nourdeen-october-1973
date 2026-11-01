#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateStory, validateLocalImagePaths } from './validate-story.mjs';
import { validateStyle } from './validate-style.mjs';

// --style also applies the new-story style gate (languages, Karma/Narrator voices,
// "Did you know?" cards, image placement, map link, section colour, quiz). Use it for
// NEW stories only; already-published stories are checked against the contract alone.
const args = process.argv.slice(2);
const strictStyle = args.includes('--style');
const input = args.find(a => !a.startsWith('--'));
if (!input) {
  console.error('Usage: node rebuild/validate-package.mjs [--style] <story-package.json>');
  process.exit(2);
}
let story;
try {
  story = JSON.parse(await readFile(path.resolve(input), 'utf8'));
} catch (error) {
  console.error('Invalid JSON package: ' + error.message);
  process.exit(2);
}
const errors = [
  ...validateStory(story),
  ...await validateLocalImagePaths(story, process.cwd()),
  ...(strictStyle ? validateStyle(story) : [])
];
if (errors.length) {
  console.error('V2 story package failed validation:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log('V2 story package valid: ' + story.slug + ' [' + story.section + ']' + (strictStyle ? ' (style gate on)' : ''));
