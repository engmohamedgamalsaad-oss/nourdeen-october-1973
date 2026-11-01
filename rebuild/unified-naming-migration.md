# Unified Story Naming Migration

Status: in progress
Branch: `story-unification-naming-20261101`
Baseline: `main` at `e7d0eecf7738a9717f560b57818bca7bc7086927`

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
- Baseline tree: 583 paths; recursive Git tree was not truncated.
- Code search found 39 hits for `KHALEDOON_STORY_V2`, 33 for `data.v2.json`, 23 for `data-kh-v2-reader`, and 18 for `KH_STORY_PACKAGE_V1`. GitHub code search is capped, so these counts are search-result counts, not a complete repository-wide lexical count.
- Thirteen published non-October story folders contain `data.v2.json`: history/005, 006, 014, 017; islamic/011; people/008, 009; science/007, 012, 015, 016; women/010, 013.
- The October source archive `rebuild/story-packages/october-sea-men.v2.json` is excluded from migration by the project's explicit October freeze.
- The active Supabase project is `story-reactions` (`ypwprddkscnfblhftkeb`), region `eu-central-1`.
- Supabase `publish-story-pr` is active at version 14. Its deployed `index.ts` content matches the repository's `supabase/functions/publish-story-pr/index.ts` exactly at the audit baseline.
- Read-only database checks found 7 rows in `khaledoon_submissions`, 2 in `khaledoon_published`, 2 in `khaledoon_public_stories`, and 1 row in `khaledoon_admin_config`. No current `story_meta` or `config_value` JSON contains the searched V2 metadata strings/keys. Therefore no production JSON metadata rewrite is justified by the current data.
- Supabase schema and records were only inspected; no production database writes or function deployments have been made in this audit phase.

## Migration rules

1. New writes use canonical names only.
2. Readers and publisher accept canonical and legacy names during a compatibility window.
3. Existing story content is preserved byte-for-byte when moving package files; no historical claims, translations, image rights, quiz content, or map coordinates are rewritten as part of a filename migration.
4. The October story page, package, archive, and section are not modified.
5. Supabase JSON metadata is migrated only if a fresh inventory finds actual legacy keys. Existing rows must remain readable before and after any update.
6. Deploy the Supabase function only after its repository source, tests, and frontend payload contract agree.
7. Remove legacy aliases only after repository-wide search, production verification, and confirmation that no pending drafts or published pages depend on them.

## Six implementation stages

1. Complete inventory and dependency map. (Audit started; this document records the verified baseline.)
2. Introduce canonical names and compatibility aliases.
3. Update GitHub reader, builder, admin, publisher, prompts, tests, and docs; new builds emit canonical filenames and markers.
4. Update Supabase Edge Function and migrate only verified legacy metadata; deploy and verify capabilities.
5. Migrate the 13 non-October story folders without changing story content; verify old links and reader behavior.
6. Make canonical names the only write format, remove obsolete modules/identifiers after usage checks, and verify all stories and workflows.

## Rollback

- Keep the original main branch untouched until the pull request is reviewed and merged.
- Keep old reader attributes and `data.v2.json` read support throughout the compatibility window.
- Preserve a pre-migration copy of any Supabase row before changing JSON metadata.
- If a new Edge Function version fails verification, redeploy the exact previous version-14 source from the audited repository baseline.
