import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../../supabase/functions/publish-story-pr/index.ts', import.meta.url);

test('unified publisher accepts only the saved canonical package after approval and before opening a draft PR', async () => {
  const source = await readFile(sourceUrl, 'utf8');

  const auth = source.indexOf('await supabase.auth.getUser()');
  const admin = source.indexOf('await supabase.rpc("is_admin")');
  const submissionId = source.indexOf('const submissionId =');
  const recordRead = source.indexOf('.from(submissionTable).select("id,story_meta")');
  const savedPackage = source.indexOf('const savedV2Package: any =');
  const packageGuard = source.indexOf('if (isV2OnlyDraft) {');
  const approvalGuard = source.indexOf('review.decision !== "approved_waiting_for_github_upload"');
  const packageMatch = source.indexOf('stableJson(packageData) !== stableJson(savedV2Package)');
  const branchWrite = source.indexOf('await github(`/repos/${OWNER}/${REPO}/git/refs`, githubToken, {');
  const pullRequestWrite = source.indexOf('await github(`/repos/${OWNER}/${REPO}/pulls`, githubToken, {');

  for (const [name, index] of Object.entries({ auth, admin, submissionId, recordRead, savedPackage, packageGuard, approvalGuard, packageMatch, branchWrite, pullRequestWrite })) {
    assert.notEqual(index, -1, name + ' safeguard/action is missing');
  }

  assert.ok(auth < admin, 'authenticate the session before checking admin role');
  assert.ok(admin < submissionId, 'authorize the admin before reading a submission');
  assert.ok(submissionId < recordRead, 'require the submission identifier before re-reading its record');
  assert.ok(recordRead < savedPackage && savedPackage < packageGuard, 'read the saved canonical package from the authoritative record');
  assert.ok(packageGuard < approvalGuard && approvalGuard < branchWrite, 'reject unapproved packages before creating a Git branch');
  assert.ok(packageMatch < branchWrite && packageMatch < pullRequestWrite, 'submitted files must exactly match the approved saved package before PR creation');

  assert.match(source, /supports_v2_publish:\s*true/);
  assert.match(source, /requires_submission_id:\s*true/);
  assert.match(source, /published_to_main:\s*false/);
  assert.match(source, /No files were written to main by this function/);
});

test('unified publisher validates safe unique paths, payload limits, and rejects non-POST requests', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  assert.match(source, /if \(req\.method !== "POST"\) return reply\(405/);
  assert.match(source, /!allowedPath\(file\.path\) \|\| seen\.has\(file\.path\)/);
  assert.match(source, /file\.content\.length > 5_000_000/);
  assert.match(source, /total > 8_000_000/);
});
