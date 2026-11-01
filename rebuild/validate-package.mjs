#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateStory, validateLocalImagePaths } from './validate-story.mjs';
import { validateStyle } from './validate-style.mjs';

const args = process.argv.slice(2);
const style = args.includes('--style');
const input = args.find(arg => !arg.startsWith('--'));
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
  ...(style ? validateStyle(story) : [])
];
if (errors.length) {
  console.error('V2 story package failed validation:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log('V2 story package valid: ' + story.slug + ' [' + story.section + ']' + (style ? ' (style gate passed)' : ''));
