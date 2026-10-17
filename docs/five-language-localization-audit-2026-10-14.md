# Five-language localization audit — 2026-10-14

## Release gate

Do not merge or publish until all checks below pass on a preview deployment.

## Confirmed findings from source inspection

- `assets/shared/i18n.js` currently allows only `ar`, `en`, `fr`, and `it`; German is not enabled in the shared language selector.
- The shared translation helper falls back to Arabic when a translation key is missing. Therefore a visible language selector is not proof of complete translation.
- Localization is split across `assets/i18n/common.js`, `assets/i18n/home.js`, `assets/i18n/story-common.js`, `assets/shared/story-body-i18n.js`, `assets/shared/story-i18n.js`, and per-story scripts under `stories/october/*/i18n.js`.
- Per-story scripts include reaction-state messages and splash-screen strings; these must be audited as content, not just decorative labels.
- Shared direction handling sets `html[dir]` from the selected language, but individual story splash screens also set their own direction. Check nested components and any dynamically inserted content.

## Required audit matrix

For each published route and each locale (`ar`, `en`, `fr`, `it`, `de`), record PASS/FAIL for:
1. Page title and description metadata.
2. Full story text and section headings.
3. Source names, citations, links, and source descriptions.
4. Image captions, alt text, and accessible labels.
5. All controls, reactions, forms, validation messages, loading/success/error states.
6. Correct document and component direction.
7. Navigation to home, collection, another story, and back to Arabic.
8. Locale persistence after navigation and reload, with no mixed-language content.
9. Existing route, QR target, reaction behavior, and story identifiers remain unchanged.

## Non-destructive release procedure

1. Work only on a dedicated audit/preview branch.
2. Add or correct locale data and unify the translation entry point without deleting existing translation keys.
3. Run `node scripts/check-localization-coverage.js` from the repository root. This is a release gate and intentionally fails while required German coverage is incomplete.
4. Add browser-level checks for missing locale keys and untranslated Arabic fallbacks in non-Arabic locales.
5. Test every published route in all five locales on a preview deployment.
6. Compare route paths, QR targets, and reaction controls before/after.
7. Request owner review. Do not merge to `main` or publish before approval.

## Current status

**Updated 2026-10-17.** German (`de`) is now enabled across the homepage, the section pages, the story pages, `submit.html`, `quiz.html` and `read.html`, and `node scripts/check-localization-coverage.js` passes.

What changed in this pass (branch `fix/german-language-complete-2026-10-17`):

- `khaledoon/assets/khaledoon-de.js` is now the single German dictionary (`window.KH_DE`, 241 entries) and loads before `khaledoon.js`, `khaledoon-pages-i18n.js` and `khaledoon-i18n-extra.js` on every page that uses them. Text without a German entry falls back to Arabic and can no longer render as the word "undefined" (the legacy three-language tables are indexed `[en, fr, it]`, so German used to read past the end of the array).
- `science.html`: fixed a stray comma that made the Zewail card script fail to parse.
- `history.html`, `knowledge.html`, `people.html`, `science.html`, `submit.html`: the early `<head>` language guard now accepts `de`, so German pages are LTR from first paint.
- `quiz.html` and `read.html`: German added; a missing key falls back to English, not Arabic. The quiz meta description is translated in every language.
- CI (`scripts/check-home-language.js`) now expects five languages, compiles every JS file and inline script, and requires the German dictionary to load first wherever the legacy scripts are used. `scripts/e2e-language-flow.cjs` runs ar/en/fr/it/de.

Verification on this branch: static check passes; real-browser run (Chromium, desktop + mobile) 160/160 flow steps, 0 hard failures; every page rendered in all five languages compared with `main` — Arabic, English, French and Italian unchanged, apart from the quiz description and the `science.html` script error being fixed.

Known remaining items (not German-specific): the two `aria-label` values on the curriculum page are Arabic in every language, and a few story pages overflow horizontally by 2–7 px on mobile in every language.

Not verified: the live site, Supabase reactions, and a native-speaker review of the German wording.
