# Unified Story Naming Migration

Status: canonical package migration is live for 13 non-October stories; final audit and legacy-data retirement remain in progress
Working branch for this audit: `chore/story-naming-final-audit-20261101`
Main baseline incorporated into this audit: `3fa5f63832dc92a004e04d82c43167b6cea57fa8` (2026-11-01)

## Goal

Use one canonical user-facing and internal story contract without breaking published pages, pending submissions, Supabase authorization, or the GitHub Pages publishing workflow.

Canonical names:
- Package format: `KHALEDOON_STORY`
- Story package file: `story.json`
- Reader marker: `data-kh-story-reader`
- Legacy input format: `KH_STORY_PACKAGE_V1` (import/conversion compatibility only while live records still depend on it)
- Adapter module: `story-package-adapter.mjs`
- Publisher module: `publish-story.mjs`

## Verified repository state

- PR #441 is merged. The 13 migrated non-October story folders use `story.json`, `KHALEDOON_STORY`, and the canonical `data-kh-story-reader` marker.
- The 13 folders are: `history/005`, `history/006`, `history/014`, `history/017`, `islamic/011`, `people/008`, `people/009`, `science/007`, `science/012`, `science/015`, `science/016`, `women/010`, and `women/013`.
- Those migrated folders no longer use `data.v2.json` as their story package. Their `data.json` files are localized index/card projections, not a second story package.
- The October archive `rebuild/story-packages/october-sea-men.v2.json`, the October story pages, and the October section remain explicitly excluded. PR #442 does not modify October files.
- PR #442 adds an audit workflow for canonical story packages and reader wiring, plus a full existing-story style report. Existing-story findings are reported for editorial review; they are not permission to invent facts, pad stories, or silently rewrite content. Newly added stories remain subject to the strict style gate.
- The current audit does not establish that the editorial review of all 13 stories is complete. Dialogue placement, “Did you know?” cards/markers, story length, metadata, image placement, and quiz answer distribution still require story-by-story review where flagged.
- Canonical package migration is not the same as completion of the unified reader visual/animation review. The actual live behavior of each story still needs its own review.

## Fresh Supabase inventory — read-only, 2026-11-01

Project: `story-reactions` (`ypwprddkscnfblhftkeb`), region `eu-central-1`.

A fresh read-only SQL inventory returned:

| Table / measure | Verified count |
|---|---:|
| `public.khaledoon_submissions` total | 7 |
| Submissions with status `review` | 5 |
| Submissions with status `published` | 2 |
| `public.khaledoon_published` rows | 2 |
| `public.khaledoon_public_stories` rows | 2 |
| `KH_STORY_PACKAGE_V1` import records in submissions | 6 |
| V1 records with status `review` | 5 |
| V1 records with status `published` | 1 |
| V1 records with a non-null `pending_draft` | 4 |
| V1 records with a non-null `ai_package_raw` | 6 |

Important clarification:
- There are six live V1-imported submission records: five in review and one published.
- Only four of those six currently have a non-null `pending_draft`. The earlier statement that five V1 records still have a pending V1-shaped draft was inaccurate and must not be repeated.
- The seventh submission is a separate legacy published record. It has no `ai_imported_format` marker and no `ai_package_raw`; its metadata contains `pending_draft` and `preview_review`. Do not count it as a seventh V1 record.
- The two published submissions are therefore not both V1 imports: one is V1-imported and one is the separate legacy record.

Backup verification:
- `private.khaledoon_legacy_format_backup_20261101` contains six snapshots sourced from `public.khaledoon_submissions`.
- All six snapshot source IDs still exist in the live submissions table.
- All six current live rows match their stored backup checksums.
- This is a database-resident backup table, not an independently stored off-site backup.

No production rows were changed, deleted, or converted during this inventory. No Edge Function was deployed as part of this check.

## Compatibility and migration rules

1. New story writes use canonical names only: `KHALEDOON_STORY`, `story.json`, and `data-kh-story-reader`.
2. Readers and publishing paths must continue accepting only the specific legacy formats still required by verified live dependencies during the compatibility window.
3. `KH_STORY_PACKAGE_V1` remains an import/conversion source; do not persist new non-October stories in that format.
4. Do not remove V1/V2 adapters, aliases, reader support, admin import handling, or publisher compatibility until all six V1-dependent records have been losslessly migrated and read/edit/preview/publish behavior has been verified.
5. Preserve every field in the six V1 records during conversion, including raw package payloads, pending drafts where present, translations, image metadata/rights, map locations, quiz data, review history, and provider/import metadata. Do not assume `ai_package_raw` and `pending_draft` are interchangeable.
6. Do not infer missing cover objects or borrow images to fill gaps. The earlier inventory found no explicit cover object in the six stored V1 packages.
7. Keep `data.json` as the localized index/card projection; do not treat it as an alternate story package.
8. Identifier cleanup must not rewrite historical claims, translations, image rights, quiz content, or map coordinates. Any requested editorial correction is a separate, traceable content change.
9. The October story page, package, archive, assets, and section are frozen for this migration. Any legacy support required by October must remain scoped and read-only.
10. Deploy the Supabase Edge Function only after its repository source, frontend payload contract, and the intended production behavior have been compared and verified.
11. Remove legacy aliases only after fresh repository-wide and production checks prove no published page, pending draft, or workflow depends on them.

## Six implementation stages — current status

1. **Repository and production inventory — substantially complete.** The 13 canonical story folders have been identified. The latest read-only Supabase inventory and six-row backup checksum comparison are recorded above. Keep this dependency map current as records change.
2. **Canonical package contract — complete for the 13 migrated non-October stories.** Their package names, file paths, and reader markers are canonical. Transitional compatibility remains where live records require it.
3. **GitHub reader, builder, admin, publisher, and CI — migration merged; final audit is in PR #442.** PR #441 delivered the 13-folder package migration. PR #442 adds structural validation across canonical packages, canonical reader wiring checks, and editorial style reporting. Do not confuse this audit PR with completion of every reader animation or visual review.
4. **Supabase — canonical publishing path exists; legacy record conversion is incomplete.** Six V1-imported submission records remain live. Four have a non-null pending draft; all six retain a non-null raw package. Preserve them until a lossless conversion and read/edit/preview/publish verification is completed. The seventh legacy published submission must be assessed separately.
5. **Story content and presentation — package migration complete; editorial and visual review incomplete.** Review all 13 stories against the agreed Mustafa Mosharafa reference, including five-language text, Karma dialogue, images and rights, quizzes, section colors in light/dark mode, reader animation, and map data. Correct only verified issues; do not invent facts or discard important content.
6. **Retire old formats — blocked until live dependencies are migrated.** Stop new legacy writes first. Then convert and verify all six V1 records and separately account for the seventh legacy submission. Only after repository-wide and production checks confirm there are no remaining dependencies should obsolete aliases and compatibility code be removed.

## Rollback and safety

- Keep the original production data unchanged until a lossless migration has been rehearsed and verified.
- Preserve the six existing database snapshots and verify checksums before any row conversion. The current snapshots are database-resident; create and verify an independent export before any destructive production migration.
- Keep old reader attributes and `data.v2.json` support only where a verified production page or excluded scope still requires them.
- If an Edge Function deployment fails verification, restore only an exact previously verified source/version; do not infer a version from its number alone.
- Do not change the October section as part of this work.
