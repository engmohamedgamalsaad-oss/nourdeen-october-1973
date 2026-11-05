# Arabic story-audio pronunciation pipeline

The visible story text is the source of truth and is never rewritten by audio generation. Arabic speech receives a separate, audio-only reading copy.

## Processing order currently implemented

1. Read the Arabic block from the published story package.
2. If `audio-pronunciation.json` exists beside the story package, use its reviewed audio-only text for the matching block. Otherwise use the story block text. The visible story text is never rewritten.
3. Normalize whitespace and split long speech at sentence/word boundaries.
4. Synthesize Arabic chunks with the approved Fish Audio voice ID and model. The Arabic rate is passed as Fish `prosody.speed` (for example, -2% becomes 0.98x). Fish's cloud API does not expose the Edge-style pitch setting used by Edge TTS.
5. Keep the exact spoken text, voice, provider, model, chunk index and input hash in the manifest.
6. The browser player handles pauses between consecutive chunks.

The current generator does **not** run an automatic diacritizer or FFmpeg loudness normalization. Those steps must not be assumed to have happened unless a separate verified tool is added and run.

## Failure and safety behavior

- The generator makes one Fish Audio request per changed Arabic chunk and does not automatically retry or switch to another speaker. A failed request stops that chunk; the manifest checkpoint allows already completed chunks to be reused on a later run.
- A non-dry-run Arabic generation requires the explicit `--allow-fish` flag. The manual GitHub workflow also requires the operator to select `yes` for its Fish Audio confirmation input.
- `--dry-run` performs preflight checks without sending TTS requests or changing MP3 files/manifests.
- MP3 files no longer referenced by the latest manifest are reported and preserved. The generator does not delete them automatically; cleanup requires separate manual review.
- The GitHub workflow commits generated audio to a dedicated branch and opens a pull request. It must never push generated audio directly to `main`.
- October stories remain excluded by the generator.

## Model and licensing notes

- Package: [text2tashkeel 0.1.0](https://pypi.org/project/text2tashkeel/0.1.0/)
- Model: [TigreGotico/rawi-ensemble](https://huggingface.co/TigreGotico/rawi-ensemble), marked Apache-2.0 on its model card.
- The package reports 2.04% diacritic error rate on its own held-out corpus. Treat this as a benchmark claim, not a guarantee for Khaledoon's child-friendly biographies; names, dates, and ambiguous words still need listening review.
- The package documentation recommends one sentence per diacritization call. Its benchmark documentation also discusses corpus-overlap caveats.

- Fish Audio's current public guidance describes its free plan as personal/non-commercial; paid plans are required for commercial use. The exact usage rights and creator permissions for the two selected community voice IDs have not been independently confirmed. Before monetization, sponsorship, or other commercial use, verify the account plan and each voice's permissions with Fish Audio. Do not use a voice that imitates an identifiable real person without the required consent.

This pipeline affects generated audio assets only. It does not add tashkeel to the visible Arabic story text.
