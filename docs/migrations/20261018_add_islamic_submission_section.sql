-- Allow Islamic Figures in the shared story submission table.
-- This additive migration preserves all existing section identifiers.
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
    'readers'::text,
    'islamic'::text
  ]));
commit;

-- Rollback, only if needed:
-- begin;
-- alter table public.khaledoon_submissions
--   drop constraint if exists khaledoon_submissions_section_check;
-- alter table public.khaledoon_submissions
--   add constraint khaledoon_submissions_section_check
--   check (section = any (array[
--     'october'::text, 'science'::text, 'learning'::text, 'fame'::text,
--     'history'::text, 'curriculum'::text, 'readers'::text
--   ]));
-- commit;
