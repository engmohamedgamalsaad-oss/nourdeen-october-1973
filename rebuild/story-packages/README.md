# V2 story packages

## October sea story — draft, not publish-ready

File: `october-sea-men.v2.json`

This is the first real-content package used to exercise the V2 validator and builder. It is intentionally stored under `rebuild/story-packages/`, not under the published `stories/` tree.

Before publication, a reviewer must:
- Replace the temporary cover choice with the approved story-specific cover artwork and confirm its rights. The current cover uses a correctly credited 1967 photograph of the destroyer Eilat and explicitly states that it is not a photograph from the 1973 war.
- Compare `original_body` with the author's actual submitted source. It now contains the complete visible Arabic text from all eight story sections plus the closing section of the currently published page in reading order; it is not verified against the author's original submission file.
- Review all five translations for historical and age-appropriate language.
- Re-open every source and image page at review time and preserve attribution and applicable share-alike terms.
- Run a human content review and a browser/mobile preview before proposing any publication PR.

The V2 package now includes all **20 questions** from the archived legacy quiz bank, translated into all five languages, plus three additional questions about Bab el-Mandeb, Nabil Abdel Wahab, and the Ketting operation (23 total). The exact source bank is preserved at `source-archives/october-sea-men-legacy-quiz-001.json` (copied from `stories/quizzes/001.json`, source SHA `5d46968c2db9a32f8fc40363d66deedcbab41cd1`). Correct answer positions are varied instead of placing every answer first. Human review is still required to confirm translations, answer keys, and historical wording. The package has three gallery image records plus a temporary cover and seven source records with localized titles and organization names in all five languages. Do not treat automated validation as a substitute for editorial review. Passing automated validation means the package matches the technical contract; it does **not** certify historical accuracy, translation quality, legal clearance, or publication readiness.

The CI workflow validates this package and builds it only in an isolated temporary directory. It does not add a story to the published site or alter the live Supabase database.


Source-text provenance: `original_body` now contains the complete Arabic text extracted from all eight story sections and the closing section of the currently published `stories/october/001/index.html`, in displayed reading order. It is **not yet verified against the author's original submission file**; that remains a human review gate. The translated V2 `i18n` narrative is a separately rewritten, shortened reading version and must not be represented as a verbatim translation of `original_body`. It now includes additional localized passages about Captain Nabil Abdel Wahab and the Ketting operation, plus two matching quiz questions.
