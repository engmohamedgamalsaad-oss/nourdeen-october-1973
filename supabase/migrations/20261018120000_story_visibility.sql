-- خالدون عبر التاريخ — إخفاء حكايات من الموقع (قرار الأدمن فقط).
-- كل صف = حكاية مخفية (story_id هو رقم الحكاية في stories/index.json). حذف الصف = إظهار الحكاية.
-- الزائر يقرأ قائمة المخفية فقط ليخفيها، ولا يكتب. الكتابة للأدمن عبر public.is_admin().
-- شغّله من Supabase > SQL Editor مرة واحدة.

create table if not exists public.story_visibility (
  story_id text primary key check (story_id ~ '^[0-9]{3,}$'),
  hidden_at timestamptz not null default now()
);

alter table public.story_visibility enable row level security;

drop policy if exists "sv public read" on public.story_visibility;
drop policy if exists "sv admin insert" on public.story_visibility;
drop policy if exists "sv admin delete" on public.story_visibility;

create policy "sv public read" on public.story_visibility
  for select to anon, authenticated using (true);
create policy "sv admin insert" on public.story_visibility
  for insert to authenticated with check ((select public.is_admin()));
create policy "sv admin delete" on public.story_visibility
  for delete to authenticated using ((select public.is_admin()));

grant select on public.story_visibility to anon, authenticated;
grant insert, delete on public.story_visibility to authenticated;
