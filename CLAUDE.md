## نطاق الصوت — النظام لكل الحكايات وابن سينا مرجع التجربة

نظام الصوت يستهدف جميع حكايات المشروع الحالية والجديدة، بما فيها أكتوبر. ابن سينا هي الحكاية المرجعية التجريبية الأولى لاختبار المسار، وليست الحكاية الوحيدة أو حد نطاق المشروع. بعد اعتماد التجربة يُعمّم النظام على بقية الحكايات بالتتابع، حكاية واحدة في كل مرة. يجب أن تكون الوظائف عامة وتقبل هوية أي حكاية، وألا تبقى قيود ابن سينا التجريبية في الكود أو الخادم بعد انتهاء الاختبار.

> **قاعدة ترشيد الباقة وتحديد نطاق العمل — أولوية قصوى لكلود**


>
> حافظ على رصيد الاستخدام والوقت بالعمل داخل أضيق نطاق ممكن:
> - ابدأ دائمًا بقراءة ملف `CLAUDE.md` هذا، ثم حدّد الجزء/المهمة المطلوبة بدقة قبل فتح أي ملفات أخرى.
> - افتح فقط الملفات المرتبطة مباشرة بالمهمة، وبالقدر اللازم منها. استخدم البحث عن اسم الملف أو الرمز أو القسم المحدد بدل استعراض المستودع كاملًا.
> - **ممنوع** عمل مسح شامل للـrepo، أو سرد كل المجلدات والملفات، أو قراءة ملفات ومجلدات لا تخص المهمة، أو إعادة قراءة وثائق سبق التحقق منها دون سبب جديد واضح.
> - لا تكرر فحص الحالة أو الاختبارات أو التقارير التي أُنجزت بالفعل؛ اعتمد على النتائج والروابط والـcommit SHA المتاحة، وأعد الفحص فقط إذا تغيّر الملف أو الفرع أو ظهرت قرينة تستدعي ذلك.
> - إذا كانت المهمة تخص ملفًا واحدًا، فاعمل على هذا الملف وحده، وافحص ما يتصل به مباشرة فقط. وإذا احتاجت المهمة ملفًا إضافيًا، اذكر سبب الحاجة إليه باختصار قبل توسيع النطاق.
> - لا توسّع المهمة إلى تنظيف أو تحسينات جانبية أو إعادة هيكلة. نفّذ المطلوب المحدد فقط، وتوقف عند حدوده.
> - عند الحاجة إلى وثيقة مرجعية إلزامية، اقرأ الجزء الذي يحكم المهمة أولًا؛ ولا تقرأ الوثيقة كاملة أو بقية الوثائق إلا إذا كانت المهمة شاملة، أو وُجد تعارض، أو كان ذلك لازمًا للسلامة وصحة التنفيذ.
> - إذا تعذّر تحديد الملف أو الجزء المسؤول، استخدم بحثًا موجّهًا بكلمات قليلة ومحددة، لا بحثًا عامًا في المستودع كله.
>
> الهدف: أقل عدد ممكن من قراءات الملفات والطلبات والاختبارات، مع الحفاظ على الدقة وعدم تجاوز تعليمات صاحب المشروع. لا تجعل توفير الباقة سببًا لتخطي موافقة مطلوبة أو خطوة أمان أساسية.

# Claude instructions — Khaledoon / Nourdeen project

**Before every reply or action on this project, read `AGENTS.md`, `PROJECT_INSTRUCTIONS.md`, `docs/KHALEDOON_CONTROL_TOWER.md`, and `docs/STORY_LIFECYCLE.md` completely.** `docs/KHALEDOON_MASTER_REFERENCE.md` is the compiled shareable copy; `docs/STATUS.md` is historical and must be checked against live repository state. If a required document cannot be read fully, stop and say so. For any new story, also read `docs/khaledoon-story-production-workflow.md` completely.

For any new story, also read `docs/khaledoon-story-production-workflow.md` completely. For code changes, inspect the actual files and relevant story pages before editing.

## Mandatory audio workflow
- The shared story Preview page opened from Admin is the only owner-facing path for spoken-text review/approval, one-segment audio generation, listening, and accept/reject/notes.
- Never ask the owner to edit or approve JSON/GitHub files, and never bypass Preview by directly dispatching Actions/CLI generation. If Preview lacks a required control, inspect and fix the Preview implementation on a review branch.
- Generate one segment at a time. Do not start the next until the owner has listened to the full current segment and recorded a decision in Preview. No bulk generation.
- Ibn Sina is the first pilot/reference story only. The reusable audio system must support every current and future Khaledoon story, including October stories. Pilot audio starts with Arabic + English; after owner approval, roll out story-by-story, never in bulk. Do not hard-code Ibn Sina as a permanent server/workflow restriction.
- A generated MP3, commit, or successful workflow is not owner approval.

## No-improvisation contract
- Priority: the owner's latest explicit instruction, then `docs/KHALEDOON_CONTROL_TOWER.md`, then `docs/STORY_LIFECYCLE.md`, then project instructions. `docs/STATUS.md` is historical, not a higher-priority decision source.
- If documents conflict, do not silently choose one or proceed through the conflict. Correct the original documents and compiled reference on a review branch, then re-check for stale contradictory wording.
- Do not replace execution with an apology or another plan. Perform the smallest safe available action; if blocked, state the exact missing capability or permission.
- Never route an owner-facing audio step around the shared Preview page.

## Required first steps for every task
0. Read `docs/KHALEDOON_CONTROL_TOWER.md` and `docs/STORY_LIFECYCLE.md` completely before discussing or doing project work. Do not ask the owner to repeat decisions already documented there. Verify its status claims against current GitHub/Supabase state before acting.
1. Confirm the current branch and inspect the repository tree and working changes.
2. Read `PROJECT_INSTRUCTIONS.md` and the relevant existing files. Do not assume paths from memory.
3. Determine the smallest safe change that meets the request; preserve existing pages, assets, links, QR codes, reactions, print/share behavior, and shared code.
4. Work on a preview branch when available. Do not write to the published branch, merge, publish a story, or modify Supabase/SQL without the owner's explicit approval.
5. After editing, inspect the diff and test affected paths, images, languages, responsive layout, and relevant functions as far as tools permit.
6. Report only verified results: what changed, what was tested, what remains unverified, and a verified preview link if available.

## Non-negotiable rules
- Never claim an edit, test, upload, or deployment succeeded unless it actually did and was checked.
- Never treat a commit or file upload as proof that the live site changed.
- Never run SQL or modify database tables, RLS, policies, or Supabase data before inspection and explicit approval.
- Never expose secrets, personal data, or private drafts in the public repository.
- Never publish a new story without explicit approval.
- Keep the original submitted story text unchanged in a separate copy.
- For stories, verify historical claims and sources; never invent quotations or present AI-generated illustrations as archival photographs.
- Every new story must include a story cover, a title-related start-screen/cover-popup image, and contextual in-story images where useful, with sources and usage rights checked. Review spelling, names, dates, and language in text appearing inside images.
- Preserve Arabic RTL and check all five languages: Arabic, English, French, Italian, and German. Karma opens with a natural childlike introduction; a knowledgeable narrator then deepens, explains, and verifies the story. Do not make the story a Q&A transcript.
- Ask only one focused question if essential information cannot be verified or safely inferred. Otherwise proceed without unnecessary questions.

After material changes, update the Control Tower on a preview branch with verified facts, PR/commit links, remaining work, and the next restart point. Never mark a proposal as completed.

The owner is an engineer, not a specialist developer. Execute directly where tools permit; do not respond with a plan or theoretical code when the requested change can safely be performed.
