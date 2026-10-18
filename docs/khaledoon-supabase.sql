-- خالدون عبر التاريخ — جدول موحد لاستقبال حكايات جميع الأقسام، ومنها أكتوبر 1973.
-- يعتمد على جدول admins ودالة is_admin() الموجودين من docs/supabase-setup.sql (نفس حساب الأدمن).
-- شغّله من Supabase > SQL Editor بعد مراجعته. لا يغيّر أي جدول أو سياسة موجودة.

create table if not exists public.khaledoon_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  section text not null check (section in ('october','science','learning','fame','history','curriculum','readers','islamic')),
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

-- يحتفظ بالنص الأصلي كما وصل ولا يسمح بتعديله لاحقًا
create or replace function public.kh_keep_original()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then new.original_body := new.body;
  else new.original_body := old.original_body;
  end if;
  return new;
end;
$$;
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
create policy "kh visitors submit pending" on public.khaledoon_submissions for insert to anon, authenticated
  with check (status = 'pending' and consent = true and admin_notes is null and history_note is null);
create policy "kh admin reads" on public.khaledoon_submissions for select to authenticated using (public.is_admin());
create policy "kh admin inserts" on public.khaledoon_submissions for insert to authenticated with check (public.is_admin());
create policy "kh admin updates" on public.khaledoon_submissions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "kh admin deletes" on public.khaledoon_submissions for delete to authenticated using (public.is_admin());
grant insert on public.khaledoon_submissions to anon, authenticated;
grant select, update, delete on public.khaledoon_submissions to authenticated;

-- اختياري لاحقًا (عند بناء صفحة عرض الحكايات): عرض آمن للحكايات المنشورة فقط وبأعمدة عامة
-- create or replace view public.khaledoon_published as
--   select id, created_at, section, stage, school_grade, subject, figure_name, narrator_name, narrator_grade,
--          title, subtitle, body, history_note, sources, images_note
--   from public.khaledoon_submissions where status = 'published';
-- grant select on public.khaledoon_published to anon, authenticated;
