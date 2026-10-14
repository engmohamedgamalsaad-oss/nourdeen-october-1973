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
3. Run static checks for missing locale keys and untranslated Arabic fallbacks in non-Arabic locales.
4. Test every published route in all five locales on a preview deployment.
5. Compare route paths, QR targets, and reaction controls before/after.
6. Request owner review. Do not merge to `main` or publish before approval.

## Current status

**NOT COMPLETE — NOT APPROVED FOR RELEASE.** Source inspection found a four-language shared selector and distributed translation systems. Full content coverage and five-locale browser testing have not yet been demonstrated. This file is an audit gate, not evidence that the site has passed.
