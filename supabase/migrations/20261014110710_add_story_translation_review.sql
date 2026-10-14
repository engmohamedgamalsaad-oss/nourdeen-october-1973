begin;

alter table public.khaledoon_submissions
  add column translations jsonb not null default '{}'::jsonb,
  add constraint khaledoon_submissions_translations_object
    check (jsonb_typeof(translations) = 'object');
alter table public.khaledoon_public_stories
  add column translations jsonb not null default '{}'::jsonb,
  add constraint khaledoon_public_stories_translations_object
    check (jsonb_typeof(translations) = 'object');

alter policy "kh anon visitors submit pending"
  on public.khaledoon_submissions
  with check (
    status = 'pending'
    and consent is true
    and admin_notes is null
    and history_note is null
    and translations = '{}'::jsonb
  );
alter policy "kh authenticated visitors or admins insert"
  on public.khaledoon_submissions
  with check (
    (
      status = 'pending'
      and consent is true
      and admin_notes is null
      and history_note is null
      and translations = '{}'::jsonb
    )
    or public.is_admin()
  );

create or replace function public.kh_sync_public_story()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  approved_translations jsonb;
begin
  if tg_op = 'DELETE' then
    delete from public.khaledoon_public_stories where id = old.id;
    return old;
  end if;

  select coalesce(
    jsonb_object_agg(entry.key, entry.value - 'enabled' - 'status'),
    '{}'::jsonb
  )
  into approved_translations
  from jsonb_each(coalesce(new.translations, '{}'::jsonb)) as entry(key, value)
  where entry.value ->> 'enabled' = 'true'
    and entry.value ->> 'status' = 'approved'
    and length(btrim(coalesce(entry.value ->> 'body', ''))) > 0;

  if new.status = 'published' and new.consent is true then
    insert into public.khaledoon_public_stories
      (id, created_at, section, stage, school_grade, subject, figure_name,
       title, subtitle, body, history_note, sources, images_note, translations)
    values
      (new.id, new.created_at, new.section, new.stage, new.school_grade, new.subject,
       new.figure_name, new.title, new.subtitle, new.body, new.history_note,
       new.sources, new.images_note, approved_translations)
    on conflict (id) do update set
      created_at = excluded.created_at,
      section = excluded.section,
      stage = excluded.stage,
      school_grade = excluded.school_grade,
      subject = excluded.subject,
      figure_name = excluded.figure_name,
      title = excluded.title,
      subtitle = excluded.subtitle,
      body = excluded.body,
      history_note = excluded.history_note,
      sources = excluded.sources,
      images_note = excluded.images_note,
      translations = excluded.translations;
  else
    delete from public.khaledoon_public_stories where id = new.id;
  end if;
  return new;
end;
$function$;

create or replace view public.khaledoon_published as
  select id, created_at, section, stage, school_grade, subject, figure_name,
         title, subtitle, body, history_note, sources, images_note, translations
  from public.khaledoon_public_stories;

alter view public.khaledoon_published set (security_invoker = true);

commit;