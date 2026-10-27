# خطة التوافق بين حزمة V1 وعقد V2

الحالة: مراجعة تصميمية فقط، لا تغيّر بيانات الحكايات المنشورة ولا القالب الحالي.

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

V2 now has optional localized fields for student_name, narrator_name, figure_name, person, grade, narrator_grade, history_note, and images_note. The validator requires any used field to exist across all five locales. The optional map_location field explicitly supports null or a validated lat/lng plus five localized place labels. Regression tests cover missing localized metadata, invalid coordinates, and Arabic fallback in non-Arabic place labels. These safeguards do not yet prove a V1-to-V2 conversion or round-trip preservation.

Contract V2 and its validator are still only an initial foundation. Validator tests do not prove V1 compatibility, reader readiness, admin readiness, or publishing workflow readiness. Keep this branch as a draft; do not merge it as a replacement for the current system.


## تنفيذ المحوّل — 2026-10-27

أضيف ملف تجريبي معزول `rebuild/adapters/v1-v2.mjs` واختبارات `rebuild/tests/v1-v2-adapter.test.mjs`. المحوّل لا يخصص أرقام حكايات ولا يغيّر حالة نشر أو بيانات تشغيل. ويشترط slug صريحًا من المستدعي، ويحفظ `original_body` كما وصل.

المحوّل يرفض بدل التخمين أو الاختلاق في الحالات التالية: أقسام/تصميمات بلا تحويل عكسي صريح، سطر مصادر يحتوي أكثر من رابط أو لا يحتوي رابط HTTPS واحدًا، سؤال لا يملك أربعة اختيارات، أنواع صور لا يدعمها عقد V2، أو ترتيب كتل يتداخل فيه صوت كارما بعد صوت الراوي. هذه قيود محافظة وليست دليلًا على أن كل حكايات V1 الحالية قابلة للتحويل.

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
