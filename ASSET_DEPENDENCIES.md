# External Asset Dependency Audit

Audit date: 2026-10-10  
Scope: homepage and stories 001–004, their story stylesheets, and shared story/reaction scripts.

## Verified local assets

- Homepage cover: `assets/homepage/main-cover.jpg` (used as both hero image and CSS background; browser caching may reuse the same resource).
- School logo: `assets/logo/school-logo.png`.
- Story 001 images and covers: `stories/001/`.
- Story 002 covers: `stories/002/`; its in-story historical photograph is still remote.
- Story 003 covers: `stories/003/`.
- Story 004 cover: `stories/004/`; two in-story photographs are still remote.
- Student portraits and avatars: `assets/students/`.

No existing image was compressed, renamed, converted, or deleted during this audit. No page or reaction code was changed.

## External image dependencies to localize

| Used by | Current remote asset | Proposed local path | Rights / next step |
|---|---|---|---|
| Story 002 | `https://commons.wikimedia.org/wiki/Special:FilePath/Crossing_the_Bar_Lev_Line,_October_War.jpg?width=1200` | `stories/002/Crossing_the_Bar_Lev_Line,_October_War.jpg` | Wikimedia Commons file page identifies it as public domain in Egypt and the US: https://commons.wikimedia.org/wiki/File:Crossing_the_Bar_Lev_Line,_October_War.jpg |
| Story 004 | `https://upload.wikimedia.org/wikipedia/commons/1/1d/Atef_El_Sadat.jpg` | `stories/004/Atef_El_Sadat.jpg` | Wikimedia Commons file page identifies it as public domain in Egypt and the US: https://commons.wikimedia.org/wiki/File:Atef_El_Sadat.jpg |
| Story 004 | `https://www.vetogate.com/UploadCache/libfiles/596/9/800x450o/141.jpg` | None yet | Redistribution rights not verified. Keep its current URL and source link until permission/licensing is established. |

**Status: completed.** The manual workflow `.github/workflows/import-wikimedia-photos.yml` succeeded. Both original JPEGs are now stored locally at the paths above, and the image `src` attributes in stories 002 and 004 now point to those local files. The original file bytes were added without resizing or recompression. No files were deleted, and the reactions code was not changed.

## External font dependency

The homepage and all four story pages load Cairo and Marhey from Google Fonts:

`https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Marhey:wght@500;700&display=swap`

Proposed destination: `assets/fonts/` with a local CSS file and the required font binaries/license notices. The font binaries have not been downloaded and no font references have been changed.

## Dependencies intentionally left alone

- Supabase is used by the existing reactions/likes implementation. Its configuration and code were not changed.
- External links in story text are reader-facing historical sources, not required display assets; keep them as links.
- The local `data-splash` cover files already exist in their story folders.

## Safe completion sequence

1. Completed: downloaded the two Wikimedia JPEGs with file-type checks, committed them, and changed only their matching image `src` attributes.
2. Next: obtain the Cairo and Marhey font files plus license notices; add them locally, then update font declarations consistently on the homepage and stories 001–004.
3. Keep the VetoGate photograph remote unless redistribution rights are verified.
4. Verify the published pages, image loading, language switching, and reactions.

This file records the current dependency audit. It does not claim that external assets have already been localized.
