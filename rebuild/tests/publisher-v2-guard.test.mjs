import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../../supabase/functions/publish-story-pr/index.ts', import.meta.url);

test('publisher validates the approved V2 package before creating a review PR', async () => {
  const source = await readFile(sourceUrl, 'utf8');

  const auth = source.indexOf('await supabase.auth.getUser()');
  const admin = source.indexOf('await supabase.rpc("is_admin")');
  const submissionId = source.indexOf('const submissionId =');
  const recordRead = source.indexOf('.from(submissionTable).select("id,story_meta")');
  const v2DraftGuard = source.indexOf('const isV2OnlyDraft = sourceMeta.v2_only_draft === true || pendingMeta.v2_only_draft === true');
  const packageValidation = source.indexOf('const packageFiles = body.files.filter');
  const branchWrite = source.indexOf('await github(`/repos/${OWNER}/${REPO}/git/refs`, githubToken, {');
  const pullRequestWrite = source.indexOf('await github(`/repos/${OWNER}/${REPO}/pulls`, githubToken, {');

  for (const [name, index] of Object.entries({ auth, admin, submissionId, recordRead, v2DraftGuard, packageValidation, branchWrite, pullRequestWrite })) {
    assert.notEqual(index, -1, name + ' safeguard/action is missing');
  }

  assert.ok(auth < admin, 'authenticate the session before checking admin role');
  assert.ok(admin < submissionId, 'authorize the admin before reading a submission');
  assert.ok(submissionId < recordRead, 'require the submission identifier before re-reading its record');
  assert.ok(recordRead < v2DraftGuard, 're-read authoritative metadata before checking V2 status');
  assert.ok(v2DraftGuard < packageValidation, 'identify V2-only drafts before validating their exact package');
  assert.ok(packageValidation < branchWrite, 'validate the approved V2 package before creating a Git branch');
  assert.ok(packageValidation < pullRequestWrite, 'validate the approved V2 package before creating a pull request');

  assert.match(source, /requires_submission_id:\\s*true/);
  assert.match(source, /rejects_v2_only_drafts:\\s*true/);
  assert.match(source, /supports_v2_publish:\\s*true/);
  assert.match(source, /v2_publish_version:\\s*"2026-10-31-v2-publish-1"/);
  assert.match(source, /published_to_main:\\s*false/);
  assert.match(source, /No files were written to main by this function/);
});

test('legacy publisher validates safe unique paths and rejects non-POST requests', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  assert.match(source, /if \(req\.method !== "POST"\) return reply\(405/);
  assert.match(source, /!allowedPath\(file\.path\) \|\| seen\.has\(file\.path\)/);
  assert.match(source, /file\.content\.length > 5_000_000/);
  assert.match(source, /total > 8_000_000/);
});
