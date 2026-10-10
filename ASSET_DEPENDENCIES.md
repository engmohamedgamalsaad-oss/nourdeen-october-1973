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

**Current status:** The two Wikimedia images have not yet been copied into the repository. A manual GitHub Actions workflow has now been added at `.github/workflows/import-wikimedia-photos.yml`. It downloads only the two Wikimedia images listed above, checks that both are JPEGs, and commits only those two image files to `main`. It does not edit any HTML, compress or convert images, delete files, or touch reactions. It must be run manually from the repository's Actions tab before the images will exist locally.

## External font dependency

The homepage and all four story pages load Cairo and Marhey from Google Fonts:

`https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Marhey:wght@500;700&display=swap`

Proposed destination: `assets/fonts/` with a local CSS file and the required font binaries/license notices. The font binaries have not been downloaded and no font references have been changed.

## Dependencies intentionally left alone

- Supabase is used by the existing reactions/likes implementation. Its configuration and code were not changed.
- External links in story text are reader-facing historical sources, not required display assets; keep them as links.
- The local `data-splash` cover files already exist in their story folders.

## Safe completion sequence

1. Run the manual `Import licensed Wikimedia photos` workflow from the repository's Actions tab and confirm it succeeds.
2. Verify the two added JPEGs and their sizes.
3. Update only the two matching image `src` attributes after verifying the files are present.
4. Obtain the Cairo and Marhey font files plus license notices; add them locally, then update font declarations consistently on the homepage and stories 001–004.
5. Keep the VetoGate photograph remote unless redistribution rights are verified.
6. Verify the published pages, image loading, language switching, and reactions.

This file records the current dependency audit. It does not claim that external assets have already been localized.
