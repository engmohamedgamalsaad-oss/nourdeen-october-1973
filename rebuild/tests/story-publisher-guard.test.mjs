import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../../supabase/functions/publish-story-pr/index.ts', import.meta.url);

test('unified publisher accepts only the saved canonical package after approval and before direct-main publication', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  const auth = source.indexOf('await supabase.auth.getUser()');
  const admin = source.indexOf('await supabase.rpc("is_admin")');
  const submissionId = source.indexOf('const submissionId =');
  const recordRead = source.indexOf('.from(submissionTable).select("id,story_meta")');
  const savedPackage = source.indexOf('const savedStoryPackageRaw: any =');
  const packageGuard = source.indexOf('if (isStoryOnlyDraft) {');
  const approvalGuard = source.indexOf('review.decision !== "approved_waiting_for_github_upload"');
  const packageMatch = source.indexOf('stableJson(packageData) !== stableJson(savedStoryPackage)');
  const lockWrite = source.indexOf('const lockBranch = "khaledoon/publish-main-lock"');
  const mainWrite = source.indexOf('await github(`/repos/${OWNER}/${REPO}/git/refs/heads/${BASE}`, githubToken, {');
  for (const [name, index] of Object.entries({auth,admin,submissionId,recordRead,savedPackage,packageGuard,approvalGuard,packageMatch,lockWrite,mainWrite})) assert.notEqual(index,-1,name+' safeguard/action is missing');
  assert.ok(auth<admin && admin<submissionId && submissionId<recordRead,'authenticate and authorize before reading the authoritative submission');
  assert.ok(recordRead<savedPackage && savedPackage<packageGuard,'read the canonical package from the source record');
  assert.ok(packageGuard<approvalGuard && approvalGuard<lockWrite && lockWrite<mainWrite,'validate and approve before acquiring the lock and updating main');
  assert.ok(packageMatch<mainWrite,'submitted files must exactly match the approved saved package');
  assert.match(source,/publisher_mode: "direct_main"/);
  assert.match(source,/writes_main_directly: true/);
  assert.match(source,/supports_story_package_publish:\s*true/);
  assert.match(source,/supports_story_move:\s*true/);
  assert.match(source,/published_to_main: true/);
  assert.match(source,/method: "PATCH", body: JSON.stringify\(\{ sha: commit\.sha, force: false \}\)/);
  assert.doesNotMatch(source,/No files were written to main by this function/);
});
 
test('unified publisher validates safe unique paths, payload limits, and rejects non-POST requests', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  assert.match(source, /if \(req\.method !== "POST"\) return reply\(405/);
  assert.match(source, /!allowedPath\(file\.path\) \|\| seen\.has\(file\.path\)/);
  assert.match(source, /file\.content\.length > 5_000_000/);
  assert.match(source, /total > 8_000_000/);
});
