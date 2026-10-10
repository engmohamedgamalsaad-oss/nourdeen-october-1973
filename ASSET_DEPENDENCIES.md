# External Asset Dependency Audit

Audit date: 2026-10-10  
Scope: homepage and stories 001–004, their story stylesheets, and shared story/reaction scripts.

## Current local assets verified in the repository

- Homepage cover: `assets/homepage/main-cover.jpg` (used by the hero image and CSS background).
- School logo: `assets/logo/school-logo.png`.
- Story 001 images and covers are stored in `stories/001/`.
- Story 002 covers are stored in `stories/002/`; the in-story historical photograph is still remote.
- Story 003 covers are stored in `stories/003/`.
- Story 004 cover is stored in `stories/004/`; two in-story photographs are remote.
- Student portraits and avatars are stored under `assets/students/`.

No existing image was compressed, renamed, converted, or deleted during this audit.

## External image dependencies

| Used by | Remote asset | Local target if licensed and copied unchanged | Status |
|---|---|---|---|
| Story 002 | `https://commons.wikimedia.org/wiki/Special:FilePath/Crossing_the_Bar_Lev_Line,_October_War.jpg?width=1200` | `stories/002/Crossing_the_Bar_Lev_Line,_October_War.jpg` | Wikimedia Commons identifies this historical image as public domain in Egypt and the United States. Keep its source/credit link in the story if mirrored. |
| Story 004 | `https://upload.wikimedia.org/wikipedia/commons/1/1d/Atef_El_Sadat.jpg` | `stories/004/Atef_El_Sadat.jpg` | Wikimedia Commons identifies this image as public domain in Egypt and the United States. Keep its source/credit link in the story if mirrored. |
| Story 004 | `https://www.vetogate.com/UploadCache/libfiles/596/9/800x450o/141.jpg` | No local copy created | Reuse/redistribution permission was not verified. Keep the existing image and source link unchanged until permission/licensing is established. |

## Other external dependencies

- Google Fonts is referenced by the homepage and all four story pages:
  `https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Marhey:wght@500;700&display=swap`
  - Candidate local destination: `assets/fonts/` plus a local stylesheet.
  - No font binaries have been copied yet; font files must be retrieved with their license/attribution preserved before changing the pages.
- Supabase is used by the existing reactions/likes code. It remains unchanged intentionally; likes and reactions must keep working.
- External source/reference links in story text are citations for readers, not rendering assets. They should remain external links.

## Safe next steps

1. Copy the two public-domain Wikimedia images into the listed local destinations without resizing or recompressing them.
2. Update only the two corresponding image `src` values after the files are present and verified.
3. Self-host Cairo and Marhey only after the font files and license notices are available; then update the five pages consistently.
4. Leave the VetoGate photograph remote unless redistribution rights are verified.
5. Recheck the published pages and reactions after each focused change.

This audit does not change the live site's behavior. It records dependencies so asset localization can be completed without breaking the existing pages.
