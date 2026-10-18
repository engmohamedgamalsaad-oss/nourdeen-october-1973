# Five-language localization audit — 2026-10-18

## Current source audit

The current `main` branch has moved well beyond the old review branch `audit/five-language-i18n-2026-10-14`. Do not merge that stale branch over current `main`: it is 212 commits behind and its version of the shared story-body map drops German entries that are present in `main`.

Source inspection of the current `main` branch confirms:

- The canonical language list in `assets/shared/home-language-only.js` is exactly `ar`, `en`, `fr`, `it`, `de`.
- `assets/shared/i18n.js` uses the canonical language list and its fallback list contains the same five locales.
- German registration exists in the shared UI files and story locale files for October stories 001–004 and history stories 005–006.
- The inline translation tables in `stories/science/007/index.html` contain all five locales.
- The shared story-body map contains 418 flat entries with English keys and no missing `en`, `fr`, `it`, or `de` fields under the current static check.
- The shared story-label map contains 53 comparable entries and passes the same flat-entry check.

These are source-level checks, not proof that every visible string on every route is correctly translated. The checker is heuristic and does not replace browser testing.

## Remaining release checks

Before claiming the five-language audit is complete, preview and test every published route in Arabic, English, French, Italian, and German:

1. Page title, description, Open Graph metadata, and canonical/share URLs.
2. Full story text, headings, image captions/alt text, sources, and source descriptions.
3. Dynamic reaction states, form validation, loading, success, and error messages.
4. Correct RTL/LTR direction for the document, splash screen, dynamically inserted content, and controls.
5. Language persistence after navigation and reload; switching back to Arabic; no mixed-language UI.
6. Home/collection/story navigation, print, WhatsApp/Facebook sharing, QR targets, and existing reaction behavior.
7. Phone and desktop layouts, including long German labels and line wrapping.

## School-name references

The current shared translation map `assets/i18n/story-common.js` still contains legacy translation keys referring to Al-Manar school and school administration. The home page and October story HTML files 001–004 inspected for this audit do not contain those school-name strings. Do not reintroduce the legacy keys into visible UI; before deleting them from the shared map, search all current routes for key usage so shared behavior is not broken.

## Status

**Static source audit: PASS for the checks listed above. Browser preview audit: NOT YET VERIFIED. Release approval: PENDING.**

Do not publish or claim full five-language quality until the route-by-route browser matrix is completed and reviewed. Preserve the Arabic originals and existing story IDs, links, QR targets, and reactions.
