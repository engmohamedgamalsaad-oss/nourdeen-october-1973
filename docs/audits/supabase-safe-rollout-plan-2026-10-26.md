# Supabase safe rollout plan — 2026-10-26

## Current rollout status — 2026-10-26

The coordinated UI/function rollout has been deployed, but a real staging end-to-end test has **not** been completed.

- PR #372 was merged to `main` at `02b7ac5538405e3bf8cb0917510f4f23fe96d7da`. Its homepage language-flow check passed on that merge commit, and the GitHub Pages deployment for that commit succeeded.
- PR #385 corrected story 013's grade/className in the public index across all five languages and was merged at `4232d01c2ce938304a99fbc5e946817e198051b2`.
- The verified Supabase project is `ypwprddkscnfblhftkeb`. `publish-story-pr` is deployed at version 10 and `delete-hidden-story` at version 2. Their deployed source files contain the `draft_pr` capability contract and no direct-to-`main` write path.
- No story was published or deleted as a smoke test. The authenticated `capabilities` actions have not been invoked through a live admin session, so end-to-end operational readiness remains unverified.
- The database currently has the required tables and RLS policies for the deployed functions. The migration registry still contains versions that are absent or mismatched in the checked-in SQL history. No SQL, migration repair, schema change, or database write was performed.
- No staging Supabase project/branch is available. Mocked tests are not evidence of a real staging run.

## Release gates (all required)

1. **Keep migration-history drift isolated from the function rollout.** Recover missing migration files from a trusted source and reconcile version/name mismatches before any future schema/migration change. Do not apply or rewrite schema history as part of this function rollout.
2. **Obtain explicit owner approval** for any Supabase project access, function deployment, or live test. Confirm the exact project/ref out-of-band; never infer it from repository names.
3. **Prepare a real staging project** with the minimum required configuration and test data. Use non-production GitHub credentials with access limited to a disposable test repository if feasible. Do not copy production secrets into logs or repository files.
4. **Deployment completed in the verified production project:** `publish-story-pr` v10 and `delete-hidden-story` v2. The deployed source contains the expected capability mode and `writes_main_directly: false`; an authenticated live capability-response check is still outstanding.
5. **Run staging end-to-end tests:** authorized and unauthorized requests; publish creates a Draft PR and leaves `main` unchanged; delete requires a hidden story, creates a Draft PR, leaves files and visibility state unchanged before merge; verification only cleans up after the matching PR is merged and the expected files/index/map entries are gone. Confirm failures are fail-closed.
6. **Review the exact release commit and CI.** Require passing current-head language-flow and story-workflow checks, then review the diff and approve the PR explicitly.
7. **Production cutover completed with owner authorization.** The UI and both functions are now deployed as a compatibility set. Keep the fail-closed checks in place; never test by publishing or deleting a real story.
8. **Verify production capability only after approval.** Use the authenticated admin UI's read-only capability checks. Do not send a real story payload or story ID as a smoke test. Confirm both functions advertise the new mode and no direct-to-`main` code path remains in the deployed versions.
9. **Rollback plan:** if either function cannot be verified, keep publish/delete blocked and restore the prior compatible UI only with an explicit owner decision. Do not restore a direct-write workflow as an automatic fallback. Preserve all created branches/PRs for audit; do not remove visibility rows or story files as cleanup.

## Evidence required before calling this complete

- Production merge commits `02b7ac5538405e3bf8cb0917510f4f23fe96d7da` and `4232d01c2ce938304a99fbc5e946817e198051b2`.
- Deployed production function versions: publish v10, delete v2.
- A named staging project and staging run IDs/results for publish, delete, and verify flows (not available yet).
- Read-only authenticated confirmation of both production capability responses (not yet performed).
- A check that the published story index/map are unchanged by a no-write smoke test.

Until the outstanding evidence is recorded, status remains **deployed, but not end-to-end verified in staging**.
