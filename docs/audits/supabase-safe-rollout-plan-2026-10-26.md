# Supabase safe rollout plan — 2026-10-26

## Status

Planning document only. No deployment, function invocation, database write, migration, or merge is authorized or performed by this document.

- The repository branch implements `draft_pr` publishing and deletion.
- The live `publish-story-pr` and `delete-hidden-story` functions were verified as older direct-to-`main` implementations.
- The updated admin UI fails closed when either live function does not advertise the expected capability.
- No staging Supabase project or staging configuration was found in the repository tree. Do not treat mocked tests as staging evidence.
- The live migration registry and checked-in SQL history do not match. Do not run `supabase db push`, migration repair, reset, or guessed SQL as part of this rollout.

## Release gates (all required)

1. **Resolve the migration-history blocker separately.** Recover the missing migration files from a trusted source and reconcile version/name mismatches. Do not apply or rewrite schema history during the function rollout.
2. **Obtain explicit owner approval** for any Supabase project access, function deployment, or live test. Confirm the exact project/ref out-of-band; never infer it from repository names.
3. **Prepare a real staging project** with the minimum required configuration and test data. Use non-production GitHub credentials with access limited to a disposable test repository if feasible. Do not copy production secrets into logs or repository files.
4. **Deploy the candidate functions to staging only:** `publish-story-pr` and `delete-hidden-story`. Confirm both `capabilities` responses report their expected mode and `writes_main_directly: false`.
5. **Run staging end-to-end tests:** authorized and unauthorized requests; publish creates a Draft PR and leaves `main` unchanged; delete requires a hidden story, creates a Draft PR, leaves files and visibility state unchanged before merge; verification only cleans up after the matching PR is merged and the expected files/index/map entries are gone. Confirm failures are fail-closed.
6. **Review the exact release commit and CI.** Require passing current-head language-flow and story-workflow checks, then review the diff and approve the PR explicitly.
7. **Coordinate the production cutover.** The new UI and both functions are a compatibility set. The safest available sequence is to merge the UI only with owner approval, accept that publish/delete actions will remain blocked until the functions are upgraded, then deploy both new functions promptly after verifying project identity. Never test by publishing or deleting a real story.
8. **Verify production capability only after approval.** Use the authenticated admin UI's read-only capability checks. Do not send a real story payload or story ID as a smoke test. Confirm both functions advertise the new mode and no direct-to-`main` code path remains in the deployed versions.
9. **Rollback plan:** if either function cannot be verified, keep publish/delete blocked and restore the prior compatible UI only with an explicit owner decision. Do not restore a direct-write workflow as an automatic fallback. Preserve all created branches/PRs for audit; do not remove visibility rows or story files as cleanup.

## Evidence required before calling this complete

- A named staging project and documented authorization.
- Staging run IDs and results for publish, delete, and verify flows.
- A reviewed merge commit and production function versions after explicit approval.
- Read-only confirmation of production capabilities and a check that the site's published story index/map are unchanged by the smoke test.

Until these are recorded, status remains **not released / not verified in staging**.
