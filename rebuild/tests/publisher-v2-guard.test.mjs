import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../../supabase/functions/publish-story-pr/index.ts', import.meta.url);

test('legacy publisher fails closed for V2 drafts before creating any GitHub branch or pull request', async () => {
  const source = await readFile(sourceUrl, 'utf8');

  const auth = source.indexOf('await supabase.auth.getUser()');
  const admin = source.indexOf('await supabase.rpc("is_admin")');
  const submissionId = source.indexOf('const submissionId =');
  const recordRead = source.indexOf('.from(submissionTable).select("id,story_meta")');
  const v2DraftGuard = source.indexOf('sourceMeta.v2_only_draft === true || pendingMeta.v2_only_draft === true');
  const artifactGuard = source.indexOf('else if (hasV2Artifacts) {');
  const branchWrite = source.indexOf('await github(`/repos/${OWNER}/${REPO}/git/refs`, githubToken, {');
  const pullRequestWrite = source.indexOf('await github(`/repos/${OWNER}/${REPO}/pulls`, githubToken, {');

  for (const [name, index] of Object.entries({ auth, admin, submissionId, recordRead, v2DraftGuard, artifactGuard, branchWrite, pullRequestWrite })) {
    assert.notEqual(index, -1, name + ' safeguard/action is missing');
  }

  assert.ok(auth < admin, 'authenticate the session before checking admin role');
  assert.ok(admin < submissionId, 'authorize the admin before reading a submission');
  assert.ok(submissionId < recordRead, 'require the submission identifier before re-reading its record');
  assert.ok(recordRead < v2DraftGuard, 're-read authoritative metadata before applying the V2-only draft guard');
  assert.ok(v2DraftGuard < artifactGuard, 'reject V2-only drafts and then scan submitted artifacts');
  assert.ok(artifactGuard < branchWrite, 'all V2 guards must run before creating a Git branch');
  assert.ok(artifactGuard < pullRequestWrite, 'all V2 guards must run before creating a pull request');

  assert.match(source, /requires_submission_id:\s*true/);
  assert.match(source, /rejects_v2_only_drafts:\s*true/);
  assert.match(source, /supports_v2_publish:\s*false/);
  assert.match(source, /published_to_main:\s*false/);
  assert.match(source, /No files were written to main by this function/);
});

test('legacy publisher validates safe unique paths and rejects non-POST requests', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  assert.match(source, /if \(req\.method !== "POST"\) return reply\(405/);
  assert.match(source, /!allowedPath\(file\.path\) \|\| seen\.has\(file\.path\)/);
  assert.match(source, /file\.content\.length > 5_000_000/);
  assert.match(source, /total > 8_000_000/);
});
