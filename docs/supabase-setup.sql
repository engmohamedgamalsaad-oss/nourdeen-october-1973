-- ============================================================
-- حكايات أكتوبر 1973 — إعداد قاعدة بيانات الحكايات المرسلة (Supabase)
-- شغّل هذا الملف كاملًا مرة واحدة من: Supabase > SQL Editor > New query > Run
-- ============================================================

-- 1) جدول الأدمن (قائمة بريد من يحق لهم الإدارة). الجدول غير مقروء من الزوار.
create table if not exists public.admins (
  email text primary key
);
alter table public.admins enable row level security;

-- >>> غيّر البريد التالي إلى بريدك أنت (نفس البريد الذي ستنشئ به حساب الأدمن) <<<
insert into public.admins (email) values ('PUT-YOUR-ADMIN-EMAIL-HERE@example.com')
on conflict do nothing;

-- 2) جدول الحكايات
create table if not exists public.submitted_stories (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  student_name text not null check (char_length(student_name) between 2 and 80),
  grade        text check (char_length(grade) <= 60),
  title        text not null check (char_length(title) between 3 and 140),
  subtitle     text check (char_length(subtitle) <= 200),
  body         text not null check (char_length(body) between 50 and 12000),
  sources      text check (char_length(sources) <= 2000),
  color        text not null default '#b8874b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  status       text not null default 'pending' check (status in ('pending','published','rejected'))
);
alter table public.submitted_stories enable row level security;

-- 3) دالة التحقق من الأدمن (تقرأ جدول admins بصلاحية خاصة)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- 4) سياسات الأمان (RLS)
drop policy if exists "visitors submit pending"   on public.submitted_stories;
drop policy if exists "everyone reads published"  on public.submitted_stories;
drop policy if exists "admin reads all"           on public.submitted_stories;
drop policy if exists "admin inserts"             on public.submitted_stories;
drop policy if exists "admin updates"             on public.submitted_stories;
drop policy if exists "admin deletes"             on public.submitted_stories;

-- أي زائر يقدر يرسل حكاية، لكن بحالة "قيد المراجعة" فقط
create policy "visitors submit pending" on public.submitted_stories
  for insert to anon, authenticated
  with check (status = 'pending');

-- الجميع يقرأ المنشور فقط
create policy "everyone reads published" on public.submitted_stories
  for select to anon, authenticated
  using (status = 'published');

-- الأدمن فقط يقرأ الكل ويضيف ويعدّل ويحذف
create policy "admin reads all" on public.submitted_stories
  for select to authenticated using (public.is_admin());
create policy "admin inserts" on public.submitted_stories
  for insert to authenticated with check (public.is_admin());
create policy "admin updates" on public.submitted_stories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes" on public.submitted_stories
  for delete to authenticated using (public.is_admin());

-- ============================================================
-- بعد التشغيل:
--  1) Supabase > Authentication > Users > Add user > Create new user
--     (البريد = نفس البريد أعلاه، وكلمة مرور قوية، وفعّل Auto Confirm User)
--  2) افتح admin.html وسجّل الدخول.
-- ============================================================
