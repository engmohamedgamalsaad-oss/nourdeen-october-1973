# Unified Story Naming Migration

Status: migration in progress — canonical story files are live; legacy draft compatibility is still required
Branch: `chore/story-naming-final-audit-20261101`
Current main baseline: `161cad560fc3c7176b4f536b023ecd94be976739`
Latest audit branch commit: `c4d93326d74c077b48ed9414c246b4cf43d410ed`

## Goal

Adopt one user-facing and internal canonical story contract without breaking existing published pages, pending submissions, Supabase authorization, or the GitHub Pages publishing workflow.

Canonical names proposed for the migration:
- Package format: `KHALEDOON_STORY`
- Story package file: `story.json`
- Reader marker: `data-kh-story-reader`
- Legacy input format: `KH_STORY_PACKAGE_V1` (accepted only by the legacy conversion adapter during migration)
- Adapter module: `story-package-adapter.mjs`
- Publisher module: `publish-story.mjs`

## Audit findings (updated 2026-11-01)

- PR #441 is merged. Its canonical package migration is on `main`; 13 non-October story folders now use `story.json`, format `KHALEDOON_STORY`, and reader marker `data-kh-story-reader`.
- The 13 migrated folders are history/005, 006, 014, 017; islamic/011; people/008, 009; science/007, 012, 015, 016; women/010, 013. The corresponding `data.v2.json` package files are no longer present in those folders. Their small `data.json` index/metadata companions are not the story package and must not be mistaken for V2 package files.
- The October archive `rebuild/story-packages/october-sea-men.v2.json` and the October section remain explicitly excluded. No October story files were changed by this migration.
- Supabase `publish-story-pr` is active at version 15. A live source comparison confirmed its deployed source matches `supabase/functions/publish-story-pr/index.ts` on `main`.
- Fresh read-only inventory: `khaledoon_submissions` contains 7 rows (5 review, 2 published). Six rows retain `ai_imported_format = KH_STORY_PACKAGE_V1` / the original raw V1 package; five of those still have a pending V1-shaped draft. The published Taufiq al-Hakim record also retains the V1 import marker. These are live dependencies, not dead code.
- The V1 and V2 compatibility references therefore cannot yet be deleted safely. In particular, the adapter, admin import path, reader/validator compatibility, publisher, and Edge Function still contain compatibility handling. No Supabase row was rewritten or deleted in this audit.
- A first pass of the current style rules against all 13 migrated packages found that only one passes every present editorial threshold; the others have varying findings (dialogue placement, did-you-know cards/markers, length, metadata, image placement, or quiz answer distribution). These findings are not permission to invent facts, pad stories, or remove important content. They require story-by-story editorial review against sources.
- PR #439 remains a draft and is not merged. It is not treated as evidence that the current production story set passes the style rules.
- A follow-up CI change is being prepared on `chore/story-naming-final-audit-20261101`: structural validation of every canonical story package, canonical reader wiring checks, and a full style audit report. Existing-story style findings remain review findings rather than automatic content rewrites; newly added stories must pass the strict style gate.

## Migration rules

1. New writes use canonical names only.
2. Readers and publisher accept canonical and legacy names during a compatibility window.
3. Existing story content is preserved byte-for-byte when moving package files; no historical claims, translations, image rights, quiz content, or map coordinates are rewritten as part of a filename migration.
4. The October story page, package, archive, and section are not modified.
5. Supabase JSON metadata is migrated only if a fresh inventory finds actual legacy keys. Existing rows must remain readable before and after any update.
6. Deploy the Supabase function only after its repository source, tests, and frontend payload contract agree.
7. Remove legacy aliases only after repository-wide search, production verification, and confirmation that no pending drafts or published pages depend on them.

## Six implementation stages — current status

1. **Complete inventory and dependency map — substantially complete, with a live-data blocker documented.** Repository code/path searches and Supabase row inventory identify the remaining V1 dependencies. The compatibility dependency map must remain current as records are migrated.
2. **Introduce canonical names and compatibility aliases — complete for the production story package path.** Canonical names are `KHALEDOON_STORY`, `story.json`, and `data-kh-story-reader`; old names remain accepted only where required for compatibility.
3. **Update GitHub — main migration merged.** PR #441 migrated the 13 non-October story folders and updated the reader/build/admin/publisher integration. The final audit workflow is being strengthened separately.
4. **Update Supabase — canonical publisher deployed and verified; legacy data migration is not complete.** Edge Function v15 is active and matches the repository source. Six V1-imported submission records still depend on the old package representation; preserve them until a lossless conversion and read/edit/publish verification is completed.
5. **Unify and verify story content — package migration done, editorial review incomplete.** All 13 package files are in the canonical location/format. Five-language content, Karma dialogue, image placement/rights, quizzes, and map details still need story-by-story verification and correction without inventing facts or deleting important material.
6. **Retire old names — not safe to complete yet.** Stop any new legacy writes first; migrate and verify the six V1-dependent submission records; then remove compatibility code and obsolete files only after repository and production searches prove there are no remaining readers/writers. The all-story CI audit must be green for structural rules, and style findings must be resolved through editorial review. Only then remove legacy aliases and publish the final Pages build.

## Rollback

- Keep the original main branch untouched until the pull request is reviewed and merged.
- Keep old reader attributes and `data.v2.json` read support throughout the compatibility window.
- Preserve a pre-migration copy of any Supabase row before changing JSON metadata.
- If a new Edge Function version fails verification, redeploy the exact previous version-14 source from the audited repository baseline.
