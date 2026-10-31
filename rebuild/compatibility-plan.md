# خطة التوافق بين حزمة V1 وعقد V2

الحالة: عقد V2 والقارئ الموحد موجودان في المستودع، ويحتوي فرع التكامل الحالي على ربط الإدارة ومسار نشر PR آمن. لا يغيّر هذا المسار الحكايات المنشورة أو مخطط Supabase. النسخة الحية من Edge Function لم تُحدّث بعد؛ التفاصيل التنفيذية الحالية في `rebuild/README.md` و`rebuild/story-packages/README.md`.

## القرار المطلوب قبل بناء القارئ الجديد

لا يجوز اعتبار `KHALEDOON_STORY_V2` بديلًا مباشرًا لعقد `KH_STORY_PACKAGE_V1` حتى توجد طبقة تحويل واختبارات تثبت عدم فقدان البيانات. يجب أن يظل `#372` مرجع التكامل الحالي، بينما يبقى `#384` نموذجًا تجريبيًا معزولًا.

## الفروق المؤكدة من القالب والبرومبت الحاليين

| المعنى | عقد V1 الحالي | عقد V2 التجريبي | الخطر إذا حُوّل مباشرة |
|---|---|---|---|
| القسم | `section_key` مع قيم مثل `learning` و`fame` | `section` بقيم معيارية مثل `women` و`people` | تصنيف الحكاية في قسم خاطئ |
| الهوية البصرية | `visual_design` | `design.variant` و`design.accent` | فقدان متغيرات معتمدة مثل `timeline` و`journey-map` و`discovery` إذا لم توضع خريطة تحويل |
| صاحب الحكاية والصف | `student_name` / `narrator_name` و`grade` / `narrator_grade` | لا توجد حقول مكافئة في المخطط الحالي | فقدان اسم صاحب الاقتراح أو الصف الدراسي |
| نص كارما والراوي | `karma_text` و`body`، مع `history_note` و`images_note` | `i18n[lang].blocks[]` | فقدان الفصل بين صوت الطفلة والراوي أو ملاحظات التحقق والصور |
| الترجمة | `translations[lang]` بحقول مستقلة | `i18n[lang]` وكتل سردية | تحويل غير مكتمل إذا لم تُحفظ كل الحقول ومقاطع النص |
| بيانات الغلاف والصور | حقول عربية أساسية مع ترجمات `en/fr/it/de` | بيانات صورة موحدة وترجمات مطلوبة للغات الخمس | يجب نسخ القيم العربية إلى `i18n.ar` دون اختراع بيانات، والتحقق من المصدر والحقوق |
| نوع الصورة | V1 يقبل `archival/illustration/diagram/map` للغلاف | V2 يقبل `archival/photograph/illustration/map/document` | لا يجوز تحويل `diagram` إلى نوع آخر بصمت |
| الاختبار | شكل الحزمة الحالي في القالب والبرومبت | 5 أسئلة، 4 اختيارات، وإجابة صحيحة ثابتة مع ترجمة كاملة | يجب اختبار توافق بنية السؤال وترتيب الخيارات قبل التحويل |
| هوية الشخصية | `figure_name` و`translations[lang].figure_name/person` | أضيفت حقول `figure_name` و`person` اختيارية داخل `i18n[lang]` | يجب نقل الاسم المترجم دون الخلط بينه وبين عنوان الحكاية أو صاحب الاقتراح |
| موقع الخريطة | `map_location` أو `story_meta.map_location`، وقد يكون `null` | أضيف `map_location` اختياريًا؛ يقبل `null` أو `lat/lng/place` بأسماء الأماكن باللغات الخمس | لا يجوز اختراع إحداثيات؛ يجب الاحتفاظ بـ `null` الصريح ومنع بقايا العربية في أسماء الأماكن المترجمة |

## حقول يجب أن تبقى خارج حزمة المحتوى

بعض الحقول التي يستخدمها سير العمل الحالي هي بيانات تشغيلية وليست جزءًا من الحكاية التي يكتبها الذكاء الاصطناعي:

- `story_number` و`order`: يخصصهما النظام بعد فحص الفهرس والمجلدات لتجنب التكرار؛ لا يُقبل رقم نهائي من ناتج الذكاء الاصطناعي.
- `published` وحالات الإدارة والمراجعة و`story_meta`: يحددها سير العمل وصاحب المشروع، ولا تُستورد من حزمة المحتوى ولا تمنح موافقة نشر تلقائية.
- بيانات التفاعلات والإعجابات وروابط الحكايات القائمة: لا تدخل في التحويل ولا يعاد إنشاؤها أو تصفيرها.

يجب أن يرفض عقد V2 هذه الحقول الزائدة بدل قبولها بصمت. تبقى حالة النشر ومعلومات التشغيل في طبقة الإدارة، منفصلة عن نص الحكاية وبياناتها التعليمية.

## قواعد التحويل الآمن

1. لا يُعدَّل `original_body` مطلقًا؛ يُحفظ كما وصل.
2. لا يُحذف أي حقل V1 قبل وجود مقابل صريح له واختبار يثبت استعادته.
3. يجب أن تكون خريطة الأقسام والتصميمات صريحة ومختبرة، لا تخمينًا من عنوان الحكاية.
4. يجب تحويل `karma_text` و`body` إلى كتل مع الحفاظ على ترتيب الفقرات والصوت المنسوب لكل فقرة.
5. يجب حفظ `history_note` و`images_note` واسم صاحب الحكاية والصف الدراسي في حقول V2 صريحة قبل اعتماد V2.
6. لا تُستنتج حقوق الصور من نجاح تحميل الصورة. يبقى `source_url` رابط صفحة المصدر/الترخيص الفعلية.
7. لا يُحوَّل رابط خارجي إلى ملف محلي أو العكس من دون التحقق من الملف وحقوق الاستخدام.
8. كل تحويل يجب أن ينتج تقريرًا بالحقول المحفوظة، والمحوّلة، والمرفوضة؛ أي فقد محتمل يمنع المعاينة/النشر.

## بوابات القبول قبل الانتقال للمرحلة الثانية

- إضافة حقول V2 المكافئة للصف الدراسي وصاحب الحكاية وملاحظات التحقق وملاحظات الصور.
- كتابة محوّل V1 → نموذج داخلي موحّد مع اختبارات round-trip للحقول المهمة.
- استخدام حكايتين مرجعيتين: «رجال البحر في أكتوبر» و«نجيب محفوظ»، مع مقارنة بيانات المصدر قبل التحويل وبعده.
- اختبار كل اللغات الخمس، الصور، الغلاف، شاشة البداية، المعرض، الأسئلة، الطباعة والمشاركة في قارئ تجريبي غير منشور.
- عدم تغيير الموقع الحي أو Supabase قبل اجتياز هذه البوابات ومراجعة مستقلة.

## Current status

V2 now has optional localized fields for student_name, narrator_name, figure_name, person, grade, narrator_grade, history_note, and images_note. The validator allows optional metadata to exist only in locales with reliable source values; missing translations are omitted rather than guessed. Grade/narrator_grade role labels are filtered so a generic ‘story narrator’ label is not presented as a school grade. The optional map_location field explicitly supports null or a validated lat/lng plus five localized place labels. Regression tests cover missing localized metadata, invalid coordinates, and Arabic fallback in non-Arabic place labels. These safeguards do not yet prove a V1-to-V2 conversion or round-trip preservation.

Contract V2 and its validator are still only an initial foundation. Validator tests do not prove V1 compatibility, reader readiness, admin readiness, or publishing workflow readiness. Keep this branch as a draft; do not merge it as a replacement for the current system.


## تنفيذ المحوّل — 2026-10-27

أضيف ملف تجريبي معزول `rebuild/adapters/v1-v2.mjs` واختبارات `rebuild/tests/v1-v2-adapter.test.mjs`. المحوّل لا يخصص أرقام حكايات ولا يغيّر حالة نشر أو بيانات تشغيل. ويشترط slug صريحًا من المستدعي، ويحفظ `original_body` كما وصل.

المحوّل يرفض بدل التخمين أو الاختلاق في الحالات التالية: أقسام/تصميمات بلا تحويل عكسي صريح، مصادر أقل من رابطين HTTPS مختلفين أو لا يمكن تمثيل بياناتها دون فقد، سؤال لا يملك أربعة اختيارات، أنواع صور لا يدعمها عقد V2، أو ترتيب كتل يتداخل فيه صوت كارما بعد صوت الراوي. هذه قيود محافظة وليست دليلًا على أن كل حكايات V1 الحالية قابلة للتحويل.

اختبارات المحوّل تغطي النص الأصلي، فصل صوت كارما والراوي، بطاقات المعرفة، بيانات الصور وترجماتها، المصادر، وإجابات الأسئلة، إضافة إلى حالات الرفض الآمن. لم يُربط المحوّل بالقارئ أو لوحة الإدارة أو الاستيراد، ولم يُجر تحويلًا جماعيًا على الحكايات المنشورة. يجب أن تنجح اختبارات CI أولًا، ثم تُختبر الحكايتان المرجعيتان «رجال البحر في أكتوبر» و«نجيب محفوظ» فعليًا قبل تقرير التوافق النهائي.


## Review update — 2026-10-27

The current GitHub evidence is inconsistent about PR scope: a direct compare against the current `main` ref reported eight added foundation/workflow/test files, while the PR metadata still reports 76 changed files (3,578 additions / 352 deletions). Until the PR's actual diff and base/head comparison are reconciled, **treat the PR as potentially broad and do not merge it**. Do not assume the production pages, story index/map, or Supabase source are unaffected solely from the compact compare response.

The previous current-head GitHub Actions runs passed:
- Contract and V1↔V2 adapter regression tests: run 40450354649.
- Homepage language and responsive browser sweep: run 40450354638.

A further adapter fix and regression test now cover photograph/document image kinds. Latest CI run 40451572018 was queued at the time of this update, so the newest change is not yet verified.

The adapter remains unconnected to the reader, admin, and import workflow and has not been tested against real legacy packages such as the October story or Naguib Mahfouz. Keep V1 as the production import contract until the scope discrepancy is reconciled, latest CI passes, and representative real-package plus integration tests are complete. Do not run SQL or modify live Supabase as part of this foundation.


## Production-layout inspection — 2026-10-27

Inspected the actual published files on `main`:
- `stories/october/001/data.json` + `stories/october/001/index.html` (رجال البحر في أكتوبر).
- `stories/people/009/data.json` + `stories/people/009/index.html` (نجيب محفوظ).

These published `data.json` files are metadata/index companions, not `KH_STORY_PACKAGE_V1` import objects: they do not carry a `format` marker, story body, source list, image bundle, or quiz bank. Reader text and language wiring live in the HTML and per-story i18n scripts; quiz and source assets use separate paths. There is no `story.json` package at either path. Therefore, the adapter cannot honestly be declared tested against these published stories simply by passing their `data.json` files to it. A proper real-package test needs a genuine V1 package captured from the admin/import workflow, or a carefully documented reconstruction from the original source assets.

A new test file checks that both real published stories remain correctly indexed, published, and localized, without treating their metadata files as V1 AI packages. Its first CI run caught an overly narrow language-wiring assertion for story 001; that assertion was corrected to recognize the actual `i18n.js` / `data-i18n` pattern. The corrected test passed in the latest foundation CI run 40452346404. Both published-story layout checks passed. This verifies index/layout consistency only, not V1↔V2 adapter conversion of real packages.

The homepage browser audit run 40452346450 completed successfully: 203/203 flow steps across 10 language/viewport runs, 12/12 intro-popup checks, 28/28 SVG checks, zero hard failures, and zero audit warnings. The report covers 26 pages in AR/EN/FR/IT/DE; all 10 language/viewport sweeps reported zero horizontal overflow. This is a site regression audit; it does not validate V1↔V2 adapter integration.


## تحديث تحقق CI — 2026-10-27 (الأحدث)

حالة PR #387 على الفرع المعزول: 9 ملفات تأسيس/اختبار، ولا تعديل لصفحات الحكايات المنشورة أو فهرسها أو ملفات القارئ/الإدارة أو وظائف Supabase.

- اختبارات العقد والمحوّل: **26/26 ناجحة**، run [40453979649](https://github.com/engmohamedgamalsaad-oss/nourdeen-october-1973/actions/runs/40453979649).
- فحص المتصفح الفعلي: **203/203 خطوات ناجحة** عبر 10 تشغيلات لغة/شاشة، و12/12 فحص شاشة البداية، و28/28 فحص SVG، بلا إخفاقات أو تحذيرات في التقرير؛ 26 صفحة × 5 لغات × شاشتين، وصفر تجاوز أفقي في كل الصفحات المفحوصة، run [40453979642](https://github.com/engmohamedgamalsaad-oss/nourdeen-october-1973/actions/runs/40453979642).
- أُنزِل تقرير الفحص وصور سطح المكتب والهاتف من artifacts وفُحص التقرير: جميع مجموعات التدفق العشر ناجحة، وقوائم hard failures وwarnings فارغة.
- هذه النتائج تثبت سلامة الفحوص المحددة على الموقع الحالي، لكنها **لا تثبت توافق كل حزم V1 ولا تكامل المحوّل مع القارئ أو لوحة الإدارة**.
- اختبار المحوّل الحالي يستخدم fixture اختباريًا يمر على مدقّق V1 الفعلي قبل التحويل وبعده؛ لم تُلتقط حتى الآن حزمة أصلية مُصدّرة من جلسة لوحة الإدارة الحية.

القرار: أبقِ PR #387 مسودة. لا تدمج ولا تستبدل صيغة الاستيراد V1 قبل اختبار حزمة حقيقية من تدفق الإدارة ومراجعة كل الحقول التي لا يمكن تمثيلها دون فقد. ملاحظات نطاق PR القديمة في هذا الملف تاريخية، ويُرجع إلى بيانات PR #387 الحالية (9 ملفات) بدل الاعتماد على الأرقام السابقة التي وصفت PR #384 الواسع.

## Legacy prompt package compatibility review — 2026-10-27

The full user-provided Farouk El-Baz prompt/package was inspected as a private conversation attachment, not copied into this public repository. It is not fully conformant with the old prompt's own declared V1 shape. The compatibility prompt must normalize these cases without publishing the sample itself:

- Root `format` is missing even though the legacy prompt says it is required.
- The Arabic narrator text is named `current_body`, while the legacy contract names it `body`.
- `cover` is `null`; V2 requires a cover, so conversion must research and verify a separate replacement rather than emit a null cover or duplicate an existing gallery image.
- The two gallery images have Arabic top-level source/rights fields, but their localized `i18n` entries contain only `alt` and `caption`; V2 needs localized source/rights fields too. These may be translated from the existing statements, but the wording must retain the source's uncertainty and must not claim that NASA reuse terms were verified when the package says they were not.
- `question_bank` is a JSON-encoded string rather than an object; parse it before mapping the five questions.
- Some metadata appears only in non-Arabic translations, while the Arabic package has generic narrator labels rather than a confirmed school grade. Do not invent a missing Arabic student name or turn a role label into a school grade.
- Translation objects contain workflow fields such as `status` and `enabled`; these must not be carried into V2 content.

The package also uses `section_key: science` and `visual_design: discovery`, both of which have mappings in the adapter (`science` → `science`, `discovery` → `reader-story`). Its five localized `grade` values are role labels equivalent to “story narrator,” not school grades, and `student_name` appears only in the four non-Arabic locales; neither should be misrepresented as a confirmed Arabic student name or school grade. The existing story body has six paragraphs per language but only one explicit “Did you know?”-style marker in most languages (and none in French/German), despite the old prompt's requirement for at least three; conversion must not relabel arbitrary prose as fact cards without editorial review. The V2 prompt now explicitly handles these legacy variations, preserves `original_body`, keeps `map_location: null`, and requires a short blocker report if the missing cover or rights cannot be resolved honestly. The adapter now safely normalizes a recognizable legacy V1 package when its format marker is missing, maps Arabic `current_body` to `body` when `body` is absent, and parses a JSON-string `question_bank`. It omits optional metadata consistently if any locale is missing rather than inventing a translation, while preserving explicitly empty strings. It still rejects unresolved mandatory gaps such as a null cover or missing localized image source/rights; those require a researched/editorially verified V2 package, not a guessed adapter default. The user-provided package was not added to the repository and was not converted into a publishable story.

### Cover research for the Farouk El-Baz test input

A distinct, official NASA image candidate was found for a future private V2 conversion, without duplicating either of the two existing gallery images:

- **Image:** Farouk El-Baz teaching Apollo 17 Command Module Pilot Ronald E. Evans about lunar orbital geology, with Robert F. Overmyer present.
- **Official NASA article:** https://www.nasa.gov/history/50-years-ago-two-months-until-apollo-17/
- **Direct image URL:** https://www.nasa.gov/wp-content/uploads/2022/10/apollo_17_l-2_months_1_as17-325-72pc-525-farouk_el_bazevans_and_overmyer-10.11.72.jpg
- **Rights basis:** NASA's current media-use guidance says NASA content is generally available for educational/informational use with source credit, while requiring checks for marked third-party copyright and prohibiting implied NASA endorsement. See https://www.nasa.gov/nasa-brand-center/images-and-media/
- **Credit/rights text suitable for editorial review:** “Photo credit: NASA. NASA content is generally available for educational and informational use under NASA's media usage guidelines, provided no third-party copyright notice applies; do not imply NASA endorsement.”

This establishes a grounded candidate and a source for the general usage conditions, not a blanket guarantee about every image on NASA's website. The individual asset should still be checked for a third-party copyright notice before any story package is approved. The image has not been added to the repository or published.

### Latest compatibility hardening — 2026-10-27

- The V2 contract and adapter now preserve optional localized metadata independently per language. If a legacy package provides a proposer name in EN/FR/IT/DE but not Arabic, those known values remain in those locales; Arabic stays absent instead of being invented, and the foreign values are not discarded.
- The adapter now accepts an explicit `coverOverride` only when the old cover is absent or null. It requires a usable image locator, rejects reuse of a gallery image, and does not replace a valid existing cover. This is a controlled input from a research/editorial step, not automatic permission to treat an arbitrary NASA image as cleared.
- Regression tests cover sparse proposer-name metadata and the safe cover-override rules.
- Latest contract tests and homepage/browser checks are being re-run against the current head; do not call this latest adapter change verified until the runs for the final head are complete.
