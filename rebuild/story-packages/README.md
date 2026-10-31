# V2 story packages

## October sea story — draft, not publish-ready

File: `october-sea-men.v2.json`

This is the first real-content package used to exercise the V2 validator and builder. It is intentionally stored under `rebuild/story-packages/`, not under the published `stories/` tree.

## Admin handling boundary

The admin import path now validates a full V2 package first. If it cannot pass through the narrow V1 bridge without losing V2 fields, it saves the complete package in the admin record's `story_meta.v2_package`, keeps a clearly non-authoritative V1-shaped projection for existing admin listing fields, and opens this read-only package reviewer. The original V2 package is the source of truth; the projection may flatten the interleaving of narrator and Karma blocks and maps photo/document kinds only for legacy storage compatibility.

**تحديث مسار النشر — 2026-10-31:** في فرع `feat/unified-story-production-path` أصبحت كل حزمة V2 جديدة هي المصدر المعتمد، ولا تُحوّل إلى V1 للنشر. أضيف مولّد متصفح ينشئ صفحة القارئ الموحد وملف `data.v2.json` والفهرس وبيانات الخريطة وبنك الأسئلة، كما أضيف تحقق خادمي يطابق الملف المنشور مع الحزمة المحفوظة والمعتمدة في سجل Supabase. المسار ينشئ PR للمراجعة ولا يكتب مباشرة إلى main. النسخة الحية التي فُحصت ما زالت Edge Function v12 ولا تعلن دعم V2؛ لم تُنشر نسخة الفرع ولم تُدمج بعد. لذلك لا يُعد هذا تكاملًا منشورًا حتى اعتماد الفرع ونشر الوظيفة الجديدة.

Before publication, a reviewer must:
- Replace the temporary cover choice with the approved story-specific cover artwork and confirm its rights. The current cover uses a correctly credited 1967 photograph of the destroyer Eilat and explicitly states that it is not a photograph from the 1973 war.
- Compare `original_body` with the author's actual submitted source. It now contains the Arabic narrative text from all eight story sections and the separate closing section, including the closing quote, in reading order. Figure captions and UI controls are kept separately; the text is not verified against the author's original submission file.
- Review all five translations for historical and age-appropriate language.
- Re-open every source and image page at review time and preserve attribution and applicable share-alike terms.
- Run a human content review and a browser/mobile preview before proposing any publication PR.

The V2 package now includes all **20 questions** from the archived legacy quiz bank, translated into all five languages, plus three additional questions about Bab el-Mandeb, Nabil Abdel Wahab, and the Ketting operation (23 total). The exact source bank is preserved at `source-archives/october-sea-men-legacy-quiz-001.json` (copied from `stories/quizzes/001.json`, source SHA `5d46968c2db9a32f8fc40363d66deedcbab41cd1`). Correct answer positions are varied instead of placing every answer first. Human review is still required to confirm translations, answer keys, and historical wording. The package has three gallery image records plus a temporary cover and seven source records with localized titles and organization names in all five languages. Do not treat automated validation as a substitute for editorial review. Passing automated validation means the package matches the technical contract; it does **not** certify historical accuracy, translation quality, legal clearance, or publication readiness.

The CI workflow validates this package and builds it only in an isolated temporary directory. It does not add a story to the published site or alter the live Supabase database.

Map metadata: the package links the story to Bab el-Mandeb using the Marine Regions Gazetteer reference point (12.58333, 43.41667), with the source URL recorded in the package. This is a reference point for the strait, **not** a claim that a particular naval action occurred at those exact coordinates.


Source-text provenance: `original_body` contains the Arabic headings and paragraphs extracted from all eight `<section class="story">` blocks plus `<section class="end">` in `stories/october/001/index.html` (64 text blocks, in displayed reading order). Image figures/captions and navigation controls are excluded from `original_body`; the exact original figure HTML, including alt text, captions, and linked attribution, is preserved separately in `source-archives/october-sea-men-original-figures.json`. This is extracted from the published HTML, **not yet verified against the author's original submission file**; that remains a human review gate. The translated V2 `i18n` narrative is a separately rewritten, shortened reading version and must not be represented as a verbatim translation of `original_body`. It now covers the Navy's October 6 role, Bab el-Mandeb context, Captain Nabil Abdel Wahab, and the Kenting operation in all five locales; the three supplemental quiz questions match those topics.
