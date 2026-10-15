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

**Updated 2026-10-15.** This document describes the five-language release gate (Arabic, English, French, Italian, German). That gate is **still not satisfied**: German is intentionally disabled and `node scripts/check-localization-coverage.js` still fails by design until German coverage is complete.

PR #45 ("Centralize language selection on the homepage") was merged into `main` on 2026-10-15 with the owner's explicit approval. It covers the four-language scope only:

- A single language source of truth (`KH_LANG` in `assets/shared/home-language-only.js`); inner pages read the language chosen on the homepage.
- German stays unavailable in the selector, so a missing German entry cannot fall back to Arabic for visitors.
- Verified: the static check (`static-language-flow`) passed in GitHub Actions, and the curriculum page and its grade panel were checked by hand on the branch preview in English, French and Italian.
- Not verified after the last commits: `scripts/e2e-language-flow.cjs` (last recorded 128/128 on `642cb4b`), and the live-site rollout.

Still open for the five-language gate: the German story-body corpus (hundreds of entries), stories 004–006 in German, German metadata/source/caption coverage, and a full route × locale test on a preview deployment. Do not enable German in the selector until that work is complete and verified.

See `docs/language-unification-report-2026-10-15.md` for the detailed findings and remaining issues.
