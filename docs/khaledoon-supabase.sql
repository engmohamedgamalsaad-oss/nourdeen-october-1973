-- خالدون عبر التاريخ — جدول مقترحات الحكايات (منفصل تمامًا عن submitted_stories).
-- يعتمد على جدول admins ودالة is_admin() الموجودين من docs/supabase-setup.sql (نفس حساب الأدمن).
-- شغّله من Supabase > SQL Editor بعد مراجعته. لا يغيّر أي جدول أو سياسة موجودة.

create table if not exists public.khaledoon_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  section text not null check (section in ('science','learning','fame','history','curriculum','readers')),
  stage text check (stage in ('primary','preparatory','secondary')),
  school_grade smallint check (school_grade between 1 and 6),
  subject text check (char_length(subject) <= 80),
  figure_name text not null check (char_length(figure_name) between 2 and 120),
  narrator_name text not null check (char_length(narrator_name) between 2 and 40),
  narrator_grade text check (char_length(narrator_grade) <= 60),
  title text not null check (char_length(title) between 3 and 140),
  subtitle text check (char_length(subtitle) <= 200),
  body text not null check (char_length(body) between 50 and 12000),
  original_body text,
  history_note text check (char_length(history_note) <= 12000),
  sources text check (char_length(sources) <= 3000),
  images_note text check (char_length(images_note) <= 1500),
  admin_notes text check (char_length(admin_notes) <= 3000),
  consent boolean not null default false,
  status text not null default 'pending' check (status in ('pending','review','published','rejected')),
  constraint kh_curriculum_fields check (section <> 'curriculum' or (stage is not null and school_grade is not null)),
  constraint kh_grade_range check (stage is null or school_grade is null
    or (stage = 'primary' and school_grade between 1 and 6)
    or (stage <> 'primary' and school_grade between 1 and 3)),
  constraint kh_publish_needs_consent check (status <> 'published' or consent = true)
);

-- حدّ للإرسال على مستوى قاعدة البيانات، فلا يمكن تجاوزه بمسح localStorage أو باستدعاء REST مباشرة.
-- نخزن بصمة IP لا عنوان IP الخام. الحد: 5 مقترحات لكل بصمة خلال 10 دقائق.
create schema if not exists private;
create table if not exists private.khaledoon_submit_rate_limits (
  id bigint generated always as identity,
  fingerprint text not null,
  created_at timestamptz not null default now()
);
alter table private.khaledoon_submit_rate_limits
  add column if not exists id bigint generated always as identity;
do $rate_pk$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'private.khaledoon_submit_rate_limits'::regclass
      and contype = 'p'
  ) then
    alter table private.khaledoon_submit_rate_limits
      add constraint khaledoon_submit_rate_limits_pkey primary key (id);
  end if;
end
$rate_pk$;
create index if not exists kh_submit_rate_limits_fingerprint_time_idx
  on private.khaledoon_submit_rate_limits (fingerprint, created_at desc);
alter table private.khaledoon_submit_rate_limits enable row level security;
revoke all on private.khaledoon_submit_rate_limits from public, anon, authenticated;
drop policy if exists "kh rate limits inaccessible" on private.khaledoon_submit_rate_limits;
create policy "kh rate limits inaccessible" on private.khaledoon_submit_rate_limits
  for all to anon, authenticated using (false) with check (false);

create or replace function public.kh_limit_submission_rate()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $rate_limit$
declare
  req_headers json;
  req_ip text;
  ip_fingerprint text;
  recent_count integer;
begin
  -- لا نقيّد إضافة مسؤول للمقترحات من لوحة الإدارة.
  if auth.uid() is not null and public.is_admin() then
    return new;
  end if;

  req_headers := coalesce(current_setting('request.headers', true), '{}')::json;
  req_ip := split_part(coalesce(req_headers ->> 'x-forwarded-for', ''), ',', 1);
  if req_ip = '' then
    req_ip := coalesce(req_headers ->> 'x-real-ip', '');
  end if;
  if req_ip = '' then
    raise exception 'Submission temporarily unavailable';
  end if;

  ip_fingerprint := md5(req_ip);
  perform pg_advisory_xact_lock(hashtext(ip_fingerprint));

  select count(*) into recent_count
  from private.khaledoon_submit_rate_limits
  where fingerprint = ip_fingerprint
    and created_at > now() - interval '10 minutes';

  if recent_count >= 5 then
    raise exception 'Too many submissions. Try again later.';
  end if;

  insert into private.khaledoon_submit_rate_limits (fingerprint) values (ip_fingerprint);
  delete from private.khaledoon_submit_rate_limits
    where created_at < now() - interval '1 day';
  return new;
end;
$rate_limit$;
revoke all on function public.kh_limit_submission_rate() from public, anon, authenticated;
drop trigger if exists kh_limit_submission_rate on public.khaledoon_submissions;
create trigger kh_limit_submission_rate
before insert on public.khaledoon_submissions
for each row execute function public.kh_limit_submission_rate();

-- يحتفظ بالنص الأصلي كما وصل ولا يسمح بتعديله لاحقًا
create or replace function public.kh_keep_original()
returns trigger language plpgsql set search_path = pg_catalog as $keep_original$
begin
  if tg_op = 'INSERT' then new.original_body := new.body;
  else new.original_body := old.original_body;
  end if;
  return new;
end;
$keep_original$;
drop trigger if exists kh_keep_original on public.khaledoon_submissions;
create trigger kh_keep_original before insert or update on public.khaledoon_submissions
for each row execute function public.kh_keep_original();

alter table public.khaledoon_submissions enable row level security;
drop policy if exists "kh visitors submit pending" on public.khaledoon_submissions;
drop policy if exists "kh admin reads" on public.khaledoon_submissions;
drop policy if exists "kh admin inserts" on public.khaledoon_submissions;
drop policy if exists "kh admin updates" on public.khaledoon_submissions;
drop policy if exists "kh admin deletes" on public.khaledoon_submissions;
-- الزائر: إرسال فقط بحالة pending وبموافقة، ولا قراءة ولا تعديل
create policy "kh visitors submit pending" on public.khaledoon_submissions for insert to anon
  with check (status = 'pending' and consent = true and admin_notes is null and history_note is null);
create policy "kh admin reads" on public.khaledoon_submissions for select to authenticated using (public.is_admin());
create policy "kh admin inserts" on public.khaledoon_submissions for insert to authenticated with check (public.is_admin());
create policy "kh admin updates" on public.khaledoon_submissions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "kh admin deletes" on public.khaledoon_submissions for delete to authenticated using (public.is_admin());
grant insert on public.khaledoon_submissions to anon, authenticated;
grant select, update, delete on public.khaledoon_submissions to authenticated;

-- جدول عرض منفصل يحتوي على الحقول العامة فقط؛ لا يحتوي أسماء الرواة أو الملاحظات الخاصة.
create table if not exists public.khaledoon_public_stories (
  id uuid primary key,
  created_at timestamptz not null,
  section text not null,
  stage text,
  school_grade smallint,
  subject text,
  figure_name text not null,
  title text not null,
  subtitle text,
  body text not null,
  history_note text,
  sources text,
  images_note text
);
alter table public.khaledoon_public_stories enable row level security;
drop policy if exists "kh public stories visible" on public.khaledoon_public_stories;
create policy "kh public stories visible" on public.khaledoon_public_stories
  for select to anon, authenticated using (true);
revoke all on public.khaledoon_public_stories from public, anon, authenticated;
grant select on public.khaledoon_public_stories to anon, authenticated;

-- المزامنة تتم داخل قاعدة البيانات: النشر ينسخ الحقول العامة فقط، والسحب أو الرفض يحذفها.
create or replace function public.kh_sync_public_story()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $sync_public$
begin
  if tg_op = 'DELETE' then
    delete from public.khaledoon_public_stories where id = old.id;
    return old;
  end if;

  if new.status = 'published' and new.consent is true then
    insert into public.khaledoon_public_stories
      (id, created_at, section, stage, school_grade, subject, figure_name,
       title, subtitle, body, history_note, sources, images_note)
    values
      (new.id, new.created_at, new.section, new.stage, new.school_grade, new.subject,
       new.figure_name, new.title, new.subtitle, new.body, new.history_note,
       new.sources, new.images_note)
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
      images_note = excluded.images_note;
  else
    delete from public.khaledoon_public_stories where id = new.id;
  end if;
  return new;
end;
$sync_public$;
revoke all on function public.kh_sync_public_story() from public, anon, authenticated;
drop trigger if exists kh_sync_public_story on public.khaledoon_submissions;
create trigger kh_sync_public_story
after insert or update or delete on public.khaledoon_submissions
for each row execute function public.kh_sync_public_story();

-- إعادة بناء العرض الآمن فوق الجدول العام المنفصل، مع إبقاء RLS فعّالًا.
drop view if exists public.khaledoon_published;
create view public.khaledoon_published
with (security_invoker = true, security_barrier = true)
as
select id, created_at, section, stage, school_grade, subject, figure_name,
       title, subtitle, body, history_note, sources, images_note
from public.khaledoon_public_stories;
revoke all on public.khaledoon_published from public;
grant select on public.khaledoon_published to anon, authenticated;

-- تعبئة آمنة عند إعادة تشغيل ملف الإعداد على قاعدة تحتوي حكايات منشورة بالفعل.
insert into public.khaledoon_public_stories
  (id, created_at, section, stage, school_grade, subject, figure_name,
   title, subtitle, body, history_note, sources, images_note)
select id, created_at, section, stage, school_grade, subject, figure_name,
       title, subtitle, body, history_note, sources, images_note
from public.khaledoon_submissions
where status = 'published' and consent is true
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
  images_note = excluded.images_note;
