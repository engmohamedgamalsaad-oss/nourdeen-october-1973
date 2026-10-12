-- Migration: unify all new story submissions under Khaledoon, including October 1973.
-- Existing rows and the legacy submitted_stories table are intentionally preserved.
-- Verified before migration: khaledoon_submissions has 1 row; submitted_stories has 0 rows.
begin;
alter table public.khaledoon_submissions
  drop constraint if exists khaledoon_submissions_section_check;
alter table public.khaledoon_submissions
  add constraint khaledoon_submissions_section_check
  check (section = any (array[
    'october'::text,
    'science'::text,
    'learning'::text,
    'fame'::text,
    'history'::text,
    'curriculum'::text,
    'readers'::text
  ]));
commit;

-- Rollback, only if needed:
-- begin;
-- alter table public.khaledoon_submissions
--   drop constraint if exists khaledoon_submissions_section_check;
-- alter table public.khaledoon_submissions
--   add constraint khaledoon_submissions_section_check
--   check (section = any (array[
--     'science'::text, 'learning'::text, 'fame'::text,
--     'history'::text, 'curriculum'::text, 'readers'::text
--   ]));
-- commit;
