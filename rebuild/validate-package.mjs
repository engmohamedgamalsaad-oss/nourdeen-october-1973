#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateStory, validateLocalImagePaths } from './validate-story.mjs';
import { validateStyle } from './validate-style.mjs';
import { normalizeStoryFormat } from './adapters/story-package-adapter.mjs';

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
// Archived packages (for example the October V2 source) still carry the transitional
// KHALEDOON_STORY_V2 name; validateStory only accepts the canonical format, so normalize first
// exactly as rebuild/build-story.mjs does. The file on disk is never modified.
try {
  story = normalizeStoryFormat(story);
} catch (error) {
  console.error('Cannot normalize package format: ' + error.message);
  process.exit(2);
}
const errors = [
  ...validateStory(story),
  ...await validateLocalImagePaths(story, process.cwd()),
  ...(style ? validateStyle(story) : [])
];
if (errors.length) {
  console.error('Story package failed validation:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log('Story package valid: ' + story.slug + ' [' + story.section + ']' + (style ? ' (style gate passed)' : ''));
