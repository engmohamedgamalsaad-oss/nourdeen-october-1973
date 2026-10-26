# Supabase migration drift audit — 2026-10-26

## Scope and safety

This is a **read-only audit record** of the live Supabase migration registry and the repository at `main` commit `642670390300260295fe609dfca9230dec2dfc0c`.

- No SQL was executed against the database except read-only metadata/definition queries.
- No migration was applied, repaired, reset, or deployed.
- No Edge Function was invoked or deployed.
- Do not run `supabase db push`, migration repair, or a database reset until the missing history is reconciled.

## Findings

### 1. Live migration registry versus repository

- Live Supabase registry: **27 migration rows**.
- Standard `supabase/migrations/` directory in `main`: **8 SQL files**.
- Four repository files have the right logical migration name but a filename version that does not match the live registry.
- Nineteen live registry entries have no same-version file in `supabase/migrations/`.

| Live registry version | Registry name | Repository file |
|---|---|---|
| `20261014110520` | `optimize_story_review_rls` | `supabase/migrations/20261014110520_optimize_story_review_rls.sql` |
| `20261014110544` | `wrap_admin_jwt_claim_initplan` | `supabase/migrations/20261014110544_wrap_admin_jwt_claim_initplan.sql` |
| `20261014110710` | `add_story_translation_review` | `supabase/migrations/20261014110710_add_story_translation_review.sql` |
| `20261014110722` | `restore_khaledoon_view_invoker_security` | `supabase/migrations/20261014110722_restore_khaledoon_view_invoker_security.sql` |
| `20261018064240` | `story_visibility` | Filename mismatch: `supabase/migrations/20261018120000_story_visibility.sql` |
| `20261018185129` | `allow_islamic_submission_section` | Filename mismatch: `supabase/migrations/20261018150000_allow_islamic_submission_section.sql` |
| `20261019065642` | `khaledoon_admin_config` | Filename mismatch: `supabase/migrations/20261019090000_khaledoon_admin_config.sql` |
| `20261019070004` | `khaledoon_public_sections_config` | Filename mismatch: `supabase/migrations/20261019093000_khaledoon_public_sections_config.sql` |

The following 19 registry entries have no matching standard migration file by version in the repository:

- `20261009135615_create_story_reactions_system`
- `20261009181113_enforce_one_like_per_visitor_sitewide`
- `20261009203058_allow_one_like_per_story_per_visitor`
- `20261010221233_create_story_submission_review_flow`
- `20261010221302_student_story_review_queue_and_numbering`
- `20261010221458_deduplicate_story_number_trigger`
- `20261010221515_harden_admin_check`
- `20261010222327_register_story_admin_email`
- `20261011150905_harden_is_admin_invoker`
- `20261011153743_restrict_existing_story_table_privileges`
- `20261011153806_restrict_postgres_default_public_grants`
- `20261011222848_create_khaledoon_submissions_and_safe_public_view`
- `20261011222908_secure_khaledoon_trigger_search_path`
- `20261011222945_rate_limit_khaledoon_submissions`
- `20261011223004_harden_khaledoon_rate_limit_access`
- `20261011223025_synchronize_khaledoon_setup_sql`
- `20261011223106_index_khaledoon_rate_limits_and_simplify_policy`
- `20261011223200_secure_khaledoon_public_view_projection`
- `20261011223237_sync_sanitized_khaledoon_public_stories`

There are SQL reference/setup files under `docs/`, including `docs/supabase-setup.sql`, `docs/khaledoon-supabase.sql`, `docs/supabase-translations.sql`, and two files under `docs/migrations/`. Those are not automatically treated as migrations by the Supabase CLI, and they are not substitutes for reconstructing the exact historical migration sequence.

### 2. Active Edge Functions

Read-only comparison of deployed source and repository `main` found:

- `publish-story-pr`: active, version 9; deployed `index.ts` matches the repository file byte-for-byte.
- `delete-hidden-story`: active, version 1; deployed `index.ts` matches the repository file byte-for-byte.
- Both functions authenticate the caller and check `is_admin()`, but their source writes commits directly to GitHub `main`; neither creates a pull request despite the publish function's name. **Do not invoke them as part of a test or deployment until the publishing workflow is deliberately reviewed.**
- `translate-story` exists in the repository but was not present in the active Edge Function list during this audit. A repository-wide code search found no current caller outside the function's own source/comments, so it appears unused by the current UI; do not deploy it unless a verified current workflow needs it.

### 3. Database objects and policies

Read-only checks confirmed the live database contains `get_story_reaction_counts`, `record_story_reaction`, and `is_admin()`, and that `is_admin()` consults `public.admins`. Their definitions are not represented by a complete, version-aligned migration history in the standard migration directory. The repository has some setup/reference SQL, but that is not sufficient to safely reconstruct the exact sequence that was applied. An expanded read-only scan of 19 candidate branch heads—selected by names indicating backups, Supabase, migration, reactions, admin management, or publishing—found no additional missing versioned migration files. The standard migration files on those branches were the same four `20261014...` files already listed above plus the four later files whose filename versions do not match the live registry; the other SQL files were setup/reference scripts under `docs/`, not a complete versioned history. Path-specific history queries for all 19 missing migration paths on `main` returned no commits. This was a targeted scan, **not** a scan of all 448 branch heads; a complete all-branch scan remains outstanding.

RLS policy definitions were inspected read-only. This was not an anonymous runtime test or a complete security audit. A performance advisor also reported overlapping permissive SELECT policies on `public.khaledoon_admin_config`; that is a policy/performance warning, not proof of a data leak.

## Safe next steps

1. Preserve this audit and keep production unchanged.
2. Recover the exact historical SQL for the 19 missing versions from trustworthy source history/backups, or agree on a reviewed baseline/repair plan. Do not invent historical migrations from the current schema.
3. Confirm the four filename mismatches against the live registry and exact SQL contents before renaming files.
4. Only after a complete version-by-version reconciliation, decide whether a migration repair or deployment is needed. Any production migration operation must be a separate, explicitly reviewed step.
5. Separately review the direct-to-`main` behavior of `publish-story-pr` and `delete-hidden-story`; do not deploy an alternative until the preview/approval workflow and rollback plan are tested.

## Status

- Registry/file comparison: **completed**.
- Read-only function source comparison: **completed**.
- Historical migration reconstruction: **not completed** — exact source for 19 versions was not found in `main`, the seven checked backup/maintenance branches, or the five queried path histories; a complete all-branch scan remains outstanding.
- Production migration changes: **not performed**.
- Security runtime tests: **not performed**.
