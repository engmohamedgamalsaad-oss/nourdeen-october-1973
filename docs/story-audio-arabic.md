# Arabic story-audio pronunciation pipeline

The visible story text is the source of truth and is never rewritten by audio generation. Arabic speech receives a separate, audio-only reading copy.

## Processing order

1. Read the Arabic block from the published story package.
2. Split it into sentence-sized pieces for diacritization.
3. Apply `text2tashkeel==0.1.0` with the `rawi-ensemble` model.
4. Rejoin the sentence pieces and split long speech into chunks at sentence/word boundaries.
5. Synthesize each chunk with the configured Fish Audio speaker and pass the Arabic rate as Fish `prosody.speed` (for example, -2% becomes 0.98x). Fish's cloud API does not expose the Edge-style pitch setting used by Edge TTS.
6. Normalize Arabic Fish MP3s with FFmpeg loudnorm before writing the manifest.
7. Keep the vocalized text in the manifest so browser speech fallback uses the same reading copy.
8. Keep a short pause between consecutive audio chunks.

## Failure behavior

- Missing diacritizer dependency or a failed/empty diacritization result fails the Arabic generation step. It does not silently send bare Arabic to TTS.
- Fish Audio retries transient failures up to three times. It does not switch to a different speaker in the middle of a story.
- The audio commit step runs only after successful generation, so a partial run is not published.
- October stories remain excluded by the generator.

## Model and licensing notes

- Package: [text2tashkeel 0.1.0](https://pypi.org/project/text2tashkeel/0.1.0/)
- Model: [TigreGotico/rawi-ensemble](https://huggingface.co/TigreGotico/rawi-ensemble), marked Apache-2.0 on its model card.
- The package reports 2.04% diacritic error rate on its own held-out corpus. Treat this as a benchmark claim, not a guarantee for Khaledoon's child-friendly biographies; names, dates, and ambiguous words still need listening review.
- The package documentation recommends one sentence per diacritization call. Its benchmark documentation also discusses corpus-overlap caveats.

This pipeline affects generated audio assets only. It does not add tashkeel to the visible Arabic story text.
