# Arabic story-audio pronunciation pipeline

The visible story text is the source of truth and is never rewritten by audio generation. Speech may use a separately reviewed, audio-only reading copy; this does not alter the visible story.

## Shared story workflow

All sections, including October, use the same story-audio workflow: canonical story packages, five-language audio-text approval where required, generation planning, isolated staging, manifests, ASR review, dialect review, and human listening/acceptance.

October's only special handling is source extraction and presentation:
- Its published HTML/CSS and visible story wording are preserved.
- Its canonical audio source package is stories/october/<id>/story.json, accompanied by audio-readiness.json.
- The readiness file confirms that the extracted source text and five translations are complete. It does not prove that MP3 files were generated, that manifests exist, or that a human accepted any clip.
- October audio is stored and audited under the same assets/audio/october/<story-slug>/<language>/ layout as other sections.

## Processing order

1. Read the Arabic block from the canonical story package.
2. Split it into sentence-sized pieces for diacritization.
3. Apply text2tashkeel==0.1.0 with the rawi-ensemble model.
4. Rejoin the sentence pieces and split long speech into chunks at sentence/word boundaries.
5. Use only the configured, owner-approved speaker identity and model. No automatic speaker substitution is permitted.
6. Normalize generated MP3 audio as configured before writing the manifest.
7. Keep the audio reading text in the manifest so browser speech fallback can use the same reading copy.
8. Keep a short pause between consecutive audio chunks.

## Failure and approval behavior

- Missing diacritizer dependency or a failed/empty diacritization result fails the Arabic generation step. It does not silently send bare Arabic to TTS.
- A failed TTS request is surfaced as a failure; the generator does not silently retry or switch speakers.
- Generation writes to isolated, ignored staging. It does not replace published MP3 files as part of planning or review.
- Generation requires an explicit invocation. Fish Audio additionally requires its separate explicit approval flag; this documentation change does not invoke TTS.
- A complete source package is not an audio-complete story. Every required language must have valid manifests and actual MP3 files, every clip must be listened to in full, and every clip must receive explicit human acceptance before final audio approval.
- ASR and dialect reports are advisory only. Neither can replace human listening or approve a clip.

## Model and licensing notes

- Package: https://pypi.org/project/text2tashkeel/0.1.0/
- Model: https://huggingface.co/TigreGotico/rawi-ensemble, marked Apache-2.0 on its model card.
- The package reports 2.04% diacritic error rate on its own held-out corpus. Treat this as a benchmark claim, not a guarantee for Khaledoon's child-friendly biographies; names, dates, and ambiguous words still need listening review.
- Fish Audio's public guidance and voice permissions must be checked against the account plan and the permissions for each selected voice before commercial use. Do not use a voice that imitates an identifiable real person without the required consent.

This pipeline affects generated audio assets only. It does not add tashkeel to the visible Arabic story text or change the published October page design/content.
