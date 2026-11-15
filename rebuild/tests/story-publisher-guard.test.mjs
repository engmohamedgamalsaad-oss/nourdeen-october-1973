import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../../supabase/functions/publish-story-pr/index.ts', import.meta.url);

test('unified publisher creates a review PR and never writes directly to main', async () => {
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
  const branchCreate = source.indexOf('refs/heads/" + publishBranchForCleanup');
  const pullCreate = source.indexOf('await github(`/repos/${OWNER}/${REPO}/pulls`');
  for (const [name, index] of Object.entries({auth,admin,submissionId,recordRead,savedPackage,packageGuard,approvalGuard,packageMatch,lockWrite,branchCreate,pullCreate})) assert.notEqual(index,-1,name+' safeguard/action is missing');
  assert.ok(auth<admin && admin<submissionId && submissionId<recordRead,'authenticate and authorize before reading the authoritative submission');
  assert.ok(recordRead<savedPackage && savedPackage<packageGuard,'read the canonical package from the source record');
  assert.ok(packageGuard<approvalGuard && approvalGuard<lockWrite && lockWrite<branchCreate && branchCreate<pullCreate,'validate and approve before creating a review branch and PR');
  assert.ok(packageMatch<branchCreate,'submitted files must exactly match the approved saved package');
  assert.ok(source.includes('publisher_mode: "pull_request"'));
  assert.ok(source.includes('writes_main_directly: false'));
  assert.ok(source.includes('supports_text_only_translation_pr: true'));
  assert.ok(source.includes('published_to_main: false'));
  assert.ok(source.includes('publicationMode === "text_only"'));
  assert.ok(source.includes('record.source_arabic_hash !== sourceHash'));
  assert.ok(source.includes('record.speaker !== sourceBlock.speaker'));
  assert.ok(source.includes('targetBlock.text = record.translation_text.trim()'));
  assert.ok(source.includes('for (const lang of ["en", "fr", "it", "de"])'));
  assert.ok(!source.includes('method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false })'));
});

test('unified publisher validates safe unique paths, payload limits, and rejects non-POST requests', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  assert.match(source, /if \(req\.method !== "POST"\) return reply\(405/);
  assert.match(source, /!allowedPath\(file\.path\) \|\| seen\.has\(file\.path\)/);
  assert.match(source, /file\.content\.length > 5_000_000/);
  assert.match(source, /total > 8_000_000/);
});
