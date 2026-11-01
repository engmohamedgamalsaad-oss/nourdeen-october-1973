# Unified Story Naming Migration

Status: in progress
Working branch: `feat/canonical-khaledoon-story-contract-20261101`
Verified baseline: `main` at `5c840ff85c92bfa035965021265e0b55912f0305`

## Goal

Adopt one user-facing and internal canonical story contract without breaking existing published pages, pending submissions, Supabase authorization, or the GitHub Pages publishing workflow.

Canonical names proposed for the migration:
- Package format: `KHALEDOON_STORY`
- Story package file: `story.json`
- Reader marker: `data-kh-story-reader`
- Legacy input format: `KH_STORY_PACKAGE_V1` (accepted only by the legacy conversion adapter during migration)
- Adapter module: `story-package-adapter.mjs`
- Publisher module: `publish-story.mjs`

## Audit findings (2026-11-01)

- Repository default branch: `main`.
- Recursive Git tree contains 582 paths and is not truncated.
- The 13 migrated non-October story folders each contain `story.json` and `data.json`; none of those 13 has `data.v2.json`. `data.json` is the localized index/card projection, not a second story package. The October section is excluded.
- `data.v2.json` remains in code-level compatibility checks and an archived October package; those references must be assessed separately from the 13 migrated story packages. GitHub code search is capped and is not a complete lexical count.
- The canonical package contract and runtime validator still accepted `KHALEDOON_STORY_V2` at the verified baseline; the implementation branch changes this to a read-only transitional alias and removes it from the canonical schema.
- The October source archive `rebuild/story-packages/october-sea-men.v2.json` is excluded from migration by the project's explicit October freeze.
- The active Supabase project is `story-reactions` (`ypwprddkscnfblhftkeb`), region `eu-central-1`.
- Supabase `publish-story-pr` is active at version 15. Its deployed source must be re-compared with the repository source before any deployment; the version number alone is not proof of source equality.
- Read-only inventory found 7 rows in `khaledoon_submissions`, including 6 with `ai_package_raw` package payloads (5 in review and 1 already published). One of the six packages has six quiz questions; conversion must preserve all questions.
- The six stored packages have no explicit cover object. Do not infer a cover or silently borrow an image. The raw package and existing `pending_draft` are not interchangeable; each must be backed up and compared before conversion.
- No production writes, migration, backup tables, or Edge Function deployments have been made. A Supabase development branch is required to rehearse the conversion; creating one has a quoted recurring cost of USD $0.01344/hour and is awaiting confirmation.

## Migration rules

1. New writes use canonical names only.
2. New writes and the canonical JSON Schema use only `KHALEDOON_STORY`; `KHALEDOON_STORY_V2` is normalized at read boundaries only. `KH_STORY_PACKAGE_V1` remains an import-only compatibility source and is converted before non-October persistence.
3. Existing story content is preserved byte-for-byte; `data.json` remains an index/card projection and is not treated as a second story package. No historical claims, translations, image rights, quiz content, or map coordinates are rewritten as part of identifier cleanup.
4. The October story page, package, archive, and section are not modified. Any old-format support required by October remains read-only and explicitly scoped.
5. Supabase JSON metadata is migrated only if a fresh inventory finds actual legacy keys. Existing rows must remain readable before and after any update.
6. Deploy the Supabase function only after its repository source, tests, and frontend payload contract agree.
7. Remove legacy aliases only after repository-wide search, production verification, and confirmation that no pending drafts or published pages depend on them.

## Six implementation stages

1. Complete repository and production inventory. (Verified for the GitHub tree, PR #442, Edge Function version, and submission rows.)
2. Enforce one canonical schema and normalize transitional package identifiers only at read boundaries.
3. Ensure the admin AI prompt emits the official canonical schema; persist the complete canonical package as the authoritative object while any temporary display projection remains non-authoritative.
4. Rehearse Supabase row conversion on a development branch, including backup, rollback, and before/after field-level comparisons. Production conversion is blocked until the quoted branch cost is approved and rehearsal passes.
5. Verify the 13 non-October story folders and all admin/preview/publisher/reader paths; keep October untouched.
6. Remove old aliases only after Supabase migration and repository-wide reference checks prove no production or excluded-scope dependency remains.

## Rollback

- Keep the original main branch untouched until the pull request is reviewed and merged.
- Keep old reader markers only where a verified production page (including the excluded October scope) still requires them; do not emit them for new stories.
- Preserve a pre-migration copy of any Supabase row before changing JSON metadata.
- If a new Edge Function version fails verification, redeploy the exact previously verified version-15 source, not a guessed version or an unverified repository copy.
