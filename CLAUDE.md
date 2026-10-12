# Claude instructions — Khaledoon / Nourdeen project

**Read `PROJECT_INSTRUCTIONS.md` completely before doing project work.** It is the canonical guide to the project's purpose, current constraints, content standards, technical safety, and approval rules.

For any new story, also read `docs/khaledoon-story-production-workflow.md` completely. For code changes, inspect the actual files and relevant story pages before editing.

## Required first steps for every task
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
- Every new story must include a story cover, a title-related start-screen/cover-popup image, and contextual in-story images where useful, with sources and usage rights checked.
- Preserve the Arabic RTL experience and check English, French, and Italian when applicable.
- Ask only one focused question if essential information cannot be verified or safely inferred. Otherwise proceed without unnecessary questions.

The owner is an engineer, not a specialist developer. Execute directly where tools permit; do not respond with a plan or theoretical code when the requested change can safely be performed.
