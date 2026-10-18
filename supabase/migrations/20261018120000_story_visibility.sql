-- خالدون عبر التاريخ — إخفاء حكايات من الموقع (قرار الأدمن فقط).
-- كل صف = حكاية مخفية (story_id هو رقم الحكاية في stories/index.json). حذف الصف = إظهار الحكاية.
-- الزائر يقرأ قائمة المخفية فقط ليخفيها، ولا يكتب. الكتابة للأدمن عبر public.is_admin() (قائمة public.admins).
-- آمن لإعادة التشغيل أكثر من مرة. شغّله من Supabase > SQL Editor.

create table if not exists public.story_visibility (
  story_id text primary key check (story_id ~ '^[0-9]{3,}$'),
  hidden_at timestamptz not null default now()
);

alter table public.story_visibility enable row level security;

-- دفاع بطبقتين: صلاحيات الجدول (GRANT) ثم سياسات الصفوف (RLS).
-- Supabase يمنح anon/authenticated صلاحيات كاملة افتراضيًا على جداول public، فنسحبها أولًا ثم نمنح الأدنى فقط.
revoke all on public.story_visibility from anon, authenticated;
grant select on public.story_visibility to anon, authenticated;
grant insert, delete on public.story_visibility to authenticated;
-- لا UPDATE عمدًا: لا شيء يُعدَّل، الإخفاء إدراج والإظهار حذف.

drop policy if exists "sv public read" on public.story_visibility;
drop policy if exists "sv admin insert" on public.story_visibility;
drop policy if exists "sv admin delete" on public.story_visibility;

create policy "sv public read" on public.story_visibility
  for select to anon, authenticated using (true);
create policy "sv admin insert" on public.story_visibility
  for insert to authenticated with check ((select public.is_admin()));
create policy "sv admin delete" on public.story_visibility
  for delete to authenticated using ((select public.is_admin()));

-- ===== استعلامات تحقق (شغّلها بعد التنفيذ؛ اتركها معلّقة هنا) =====
-- 1) السياسات يجب أن تكون ثلاثًا فقط، والكتابة مشروطة بـ is_admin():
--    select policyname, cmd, roles, qual, with_check from pg_policies where tablename = 'story_visibility';
-- 2) الصلاحيات: anon = SELECT فقط، authenticated = SELECT + INSERT + DELETE:
--    select grantee, privilege_type from information_schema.role_table_grants where table_name = 'story_visibility' order by 1, 2;
-- 3) قائمة الأدمن المعتمدة (يجب أن تضم بريدك أنت فقط ومن تثق بهم):
--    select email from public.admins;
-- 4) تعريف is_admin الحي (يجب أن يكون security definer ويقرأ من public.admins):
--    select pg_get_functiondef('public.is_admin()'::regprocedure);
