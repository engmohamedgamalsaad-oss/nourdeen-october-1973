# V2 story packages

## October sea story — draft, not publish-ready

File: `october-sea-men.v2.json`

This is the first real-content package used to exercise the V2 validator and builder. It is intentionally stored under `rebuild/story-packages/`, not under the published `stories/` tree.

Before publication, a reviewer must:
- Replace the temporary cover choice with the approved story-specific cover artwork and confirm its rights. The current cover uses a correctly credited 1967 photograph of the destroyer Eilat and explicitly states that it is not a photograph from the 1973 war.
- Compare `original_body` with the author's actual submitted source. At present it preserves a verbatim excerpt copied from the currently published page; it is not independently verified as the original submission.
- Review all five translations for historical and age-appropriate language.
- Re-open every source and image page at review time and preserve attribution and applicable share-alike terms.
- Run a human content review and a browser/mobile preview before proposing any publication PR.

The package currently has five localized quiz questions, three image records with source/licence notes, and five source records. Passing automated validation means the package matches the technical contract; it does **not** certify historical accuracy, translation quality, legal clearance, or publication readiness.

The CI workflow validates this package and builds it only in an isolated temporary directory. It does not add a story to the published site or alter the live Supabase database.
