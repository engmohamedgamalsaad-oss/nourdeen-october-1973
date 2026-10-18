'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const checks = [
  {
    name: 'admin reads and writes the shared visibility table',
    file: 'khaledoon/admin.html',
    test: (s) => s.includes('story_visibility?select=story_id') &&
      s.includes("rest('story_visibility'") && s.includes('function setHidden')
  },
  {
    name: 'section collection pages filter hidden story IDs',
    file: 'khaledoon/assets/story-collections.js',
    test: (s) => s.includes('/rest/v1/story_visibility?select=story_id') &&
      s.includes('cache: \'no-store\'') &&
      s.includes('hiddenIds.indexOf(String(story.id)) < 0')
  },
  {
    name: 'site search filters hidden story IDs',
    file: 'khaledoon/assets/khaledoon-search.js',
    test: (s) => s.includes('/rest/v1/story_visibility?select=story_id') &&
      s.includes('cache: \'no-store\'') &&
      s.includes("hiddenIds.indexOf(String(s.id || '')) < 0")
  },
  {
    name: 'favorites filter hidden story IDs',
    file: 'khaledoon/assets/khaledoon-favorites.js',
    test: (s) => s.includes('/rest/v1/story_visibility?select=story_id') &&
      s.includes('cache: \'no-store\'') &&
      s.includes('function processCards()') &&
      s.includes("setAttribute('data-khf-hidden', '1')") &&
      s.includes("isFav(String(s.id)) && !isHidden(String(s.id))")
  },
  {
    name: 'interactive map filters hidden story IDs',
    file: 'khaledoon/assets/khaledoon-map.js',
    test: (s) => s.includes('/rest/v1/story_visibility?select=story_id') &&
      s.includes('cache: \'no-store\'') &&
      s.includes("off.indexOf(String(s.id)) >= 0")
  },
  {
    name: 'admin offers the Islamic Figures section',
    file: 'khaledoon/admin.html',
    test: (s) => s.includes("islamic:'شخصيات إسلامية'") &&
      s.includes('khaledoon_submissions')
  },
  {
    name: 'database migration allows Islamic submissions without replacing other sections',
    file: 'supabase/migrations/20261018150000_allow_islamic_submission_section.sql',
    test: (s) => s.includes('khaledoon_submissions_section_check') &&
      s.includes("'islamic'::text") &&
      s.includes("'october'::text") &&
      s.includes("'readers'::text") &&
      s.includes('Rollback only if needed')
  }
];
let failed = false;
for (const c of checks) {
  let ok = false;
  try { ok = c.test(read(c.file)); } catch (e) {}
  console.log((ok ? 'PASS' : 'FAIL') + ' — ' + c.name);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log('PASS — admin visibility integration checks: ' + checks.length + '/' + checks.length);
