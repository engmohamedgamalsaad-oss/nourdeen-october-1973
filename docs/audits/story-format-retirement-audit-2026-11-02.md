# Story format retirement audit — 2026-11-02

Status: read-only audit complete; production-record conversion and compatibility retirement are still blocked on a separately approved data migration.

Repository baseline: `main` at `43d2a6fef1de85f9ee0b100b6d58a80ba638bbbe` (2026-11-02).

## 1. Canonical path for new stories

The current creation path for every non-October story is already canonical:

- Admin entry point: `khaledoon/admin.html`.
- Active prompt directory: `khaledoon/prompts/2026-10-23-unified-v4/`.
- Canonical schema: `rebuild/story-contract.json`.
- Canonical package format: `KHALEDOON_STORY`.
- Canonical package file: `story.json`.
- Canonical reader marker: `data-kh-story-reader`.

The admin sets `requireUnifiedStoryPackage` for every non-October record and rejects any import whose root format is not `KHALEDOON_STORY`. The canonical package is retained as `story_meta.story_package`; the admin-shaped projection is not the publishing source of truth.

This establishes that a new non-October story can be created through the canonical path today. It does not establish that all old compatibility code has been removed.

## 2. Live production inventory — read-only, 2026-11-02

Supabase project: `story-reactions` (`ypwprddkscnfblhftkeb`).

| Measure | Current verified count |
|---|---:|
| `khaledoon_submissions` rows | 7 |
| Rows in review | 5 |
| Rows marked published | 2 |
| Rows carrying the former import-format marker | 6 |
| Former-format rows in review | 5 |
| Former-format rows marked published | 1 |
| Former-format rows with a non-null `pending_draft` | 4 |
| Former-format rows with a non-null `ai_package_raw` | 6 |
| Separate published legacy row without the import marker | 1 |

The seventh row is not another former-format import. It must be assessed separately because its metadata has a pending draft and preview-review state but no original AI package payload.

Backup verification:

- `private.khaledoon_legacy_format_backup_20261101` contains six snapshots from `public.khaledoon_submissions`.
- All six source rows still exist.
- All six current source rows match their stored row checksums.
- These snapshots are inside the same database; they are not an independent off-site export.

No production row was changed, deleted, or converted during this audit. No SQL DDL, migration, Edge Function deployment, or production write was performed.

## 3. Compatibility still present in the repository

The following are active or intentionally retained dependencies, not harmless spelling occurrences:

- `rebuild/adapters/story-package-adapter.mjs`: reversible conversion between the canonical package and the former import shape.
- `khaledoon/admin.html`: October-only import compatibility, old saved-draft property reads, and fallback handling for existing records.
- `rebuild/publish-story.mjs`: reads former saved-draft aliases and checks the old package filename when examining an existing story folder.
- `supabase/functions/publish-story-pr/index.ts`: server-side validation and rejection of former draft flags/artifacts, plus narrowly scoped acceptance for unchanged historical content.
- `rebuild/validate-package.mjs` and `rebuild/validate-story.mjs`: archive normalization and temporary admin-projection constraints.
- `rebuild/story-packages/october-sea-men.v2.json` and the October section: explicitly frozen historical scope.
- Regression tests under `rebuild/tests/` assert that the old October archive and compatibility bridge remain intact.

The archived prompt directories are historical records. They are not the active prompt path and must not be mistaken for the prompt used for new stories.

## 4. Retirement sequence

Do not remove compatibility code yet. The safe sequence is:

1. Keep all new non-October writes on the canonical format only. This is already enforced in the admin import boundary and covered by `rebuild/tests/admin-story-import.test.mjs`.
2. Inspect the six former-format production records individually without changing them. Build a field-level conversion report covering the raw package, pending draft where present, original text, all five languages, images and rights, map data, quiz data, review history, provider/import metadata, and publication state.
3. Treat `ai_package_raw` and `pending_draft` as separate source artifacts. Never substitute one for the other or silently discard either.
4. Rehearse conversion on a separate, access-controlled copy. Validate canonical schema, exact field preservation, and read/edit/preview/publish behavior. Any field that cannot be represented losslessly blocks that record; do not invent replacement data.
5. Assess the separate seventh legacy published record independently.
6. Before any production write, create and verify an independent export outside the production database. The existing six-row database backup is not sufficient as the sole rollback copy.
7. Present the record-by-record conversion report, rollback plan, and exact production operations for explicit owner approval. Only then perform the approved data conversion and verify every resulting row.
8. After fresh production and repository-wide checks prove that no published page, pending draft, October page, or workflow depends on the former representation, remove the adapter, admin aliases, publisher compatibility, and obsolete checks in a separate reviewed change.
9. Keep the October package, page, assets, and section frozen unless the owner explicitly authorizes a separate October change.

## 5. Verification gates before compatibility removal

Compatibility retirement is allowed only when all are true:

- All six imported records have been losslessly converted and independently verified.
- The separate legacy published record has an explicit disposition and passes the same read/edit/preview/publish checks.
- No pending draft, published page, local-storage recovery path, admin action, publisher, or Edge Function depends on the old representation.
- The October archive and pages still work without being rewritten or repackaged.
- Repository-wide searches and regression tests show no unintended old-format dependency.
- The owner has reviewed and approved the production data migration and the later code-removal change.

## 6. Current decision

**New non-October story creation: ready on the canonical path.**

**Complete removal of old compatibility: not yet safe.** Six imported records and the separate legacy published record still need a verified migration/disposition. The correct next implementation task is a record-by-record, non-destructive conversion rehearsal—not deleting adapters or renaming stored fields.

Related merged work: PR #441 (canonical package migration) and PR #442 (canonical package audit and style gate). The shared-reader preview work is tracked separately in PR #472 and is not part of this retirement audit.
