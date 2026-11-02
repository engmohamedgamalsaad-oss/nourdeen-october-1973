# Live submission conversion rehearsal findings — 2026-11-02

Scope: read-only inspection of the six submissions carrying the former import marker. No row was changed, converted, deleted, or exported into this repository.

## 1. Record-level structural results

The six stored raw packages were parsed successfully after removing their presentation wrappers (plain JSON label or fenced JSON). The following checks passed for all six:

- The raw package's `original_body` exactly matches the table's `original_body` column.
- The Arabic figure name, title, subtitle, body, and section match the corresponding submission columns.
- The raw quiz bank exactly matches the separately stored `question_bank_json` after JSON parsing.
- Each package has the Arabic source fields plus translation entries for English, French, Italian, and German.
- Each record has an image array and a review-history array.
- Four records also have a separate non-null `pending_draft`; two do not. The raw package and pending draft are separate artifacts and must remain separate in any conversion.

Aggregate content shape:

| Check | Result |
|---|---:|
| Raw packages parsed | 6 / 6 |
| Original text exact match | 6 / 6 |
| Five-language source material present | 6 / 6 |
| Image records | 2–3 per package |
| Quiz questions | 5 in five packages; 6 in one |
| Separate pending draft present | 4 / 6 |
| Separate pending draft absent | 2 / 6 |

The export is not included here because it contains draft story text and metadata. This document stores only structural findings.

## 2. Confirmed blockers

### A. All six raw packages have no cover object

None of the six raw packages contains a `cover` object. The existing conservative adapter requires a real cover image object, or an explicitly supplied and verified cover override. It rejects a missing cover.

Do not select one of the gallery images as the cover automatically. The project migration rules explicitly prohibit borrowing an image to fill a missing cover. Each record therefore remains blocked until an independently verified cover source and its rights/attribution are supplied or located.

### B. The translations column is not a safe replacement for the raw package

For the five review records, the database translations column adds per-language `status` and `enabled` fields that are not in the raw package. For the one published imported record, the raw package contains a per-language `did_you_know` field that is absent from the translations column.

This is a material difference. Use the raw package as the story-content source, retain the database translation metadata separately, and do not overwrite either artifact with the other.

### C. Four pending drafts must be compared independently

For the four records that have a pending draft, title, body, Karma text, image arrays, quiz bank, map location, and original text match the raw package in the inspected fields. Their translation objects are not byte-for-byte identical to the raw package because the database translation metadata differs.

The fifth review record and the published imported record have no separate pending draft. Do not manufacture one.

### D. A seventh record is a separate migration case

The submissions table also contains one published record without the former import marker. It has a pending draft and preview-review metadata, but no raw AI package. It is outside the six-record conversion batch and needs its own source-of-truth assessment.

## 3. Required next inputs before a conversion rehearsal can pass

For each of the six imported records:

1. A verified cover image object with HTTPS URL or approved local path, image kind, five-language alt/caption/attribution, source URL, and rights. This must come from a real source, not a gallery-image substitution.
2. A human-approved stable story slug. The adapter deliberately refuses to guess a slug from a title.
3. A secure, independently stored export of the six complete source rows and their backup snapshots. The existing checksum-matched backup is inside the same production database and is not an independent rollback copy.
4. An explicit field-preservation decision for both `ai_package_raw` and `pending_draft`, plus the separate translation-column metadata and review history.

Only after those inputs exist should the adapter be run on a local/offline export. The rehearsal must produce a per-record diff and pass the canonical schema validator before anyone considers a production write.

## 4. Decision

**No production conversion is safe yet.** The raw story text and quiz data are internally consistent in the inspected checks, but the missing covers and translation-column differences are real blockers. The next safe task is to obtain/verify the missing cover sources and approved slugs, then run a local conversion rehearsal against an independently stored export.

No production SQL writes, schema changes, Edge Function deployments, repository story edits, or publication actions were performed for this rehearsal.
