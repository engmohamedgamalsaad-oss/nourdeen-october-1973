-- حكايات أكتوبر 1973 — إعداد قاعدة بيانات الحكايات المرسلة.
-- قبل التشغيل: استبدل PUT-YOUR-ADMIN-EMAIL-HERE@example.com ببريد حساب الأدمن نفسه.
create table if not exists public.admins (email text primary key);
alter table public.admins enable row level security;
insert into public.admins(email) values ('PUT-YOUR-ADMIN-EMAIL-HERE@example.com') on conflict do nothing;

create table if not exists public.submitted_stories (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  student_name text not null check (char_length(student_name) between 2 and 80),
  grade text check (char_length(grade) <= 60),
  title text not null check (char_length(title) between 3 and 140),
  subtitle text check (char_length(subtitle) <= 200),
  body text not null check (char_length(body) between 50 and 12000),
  sources text check (char_length(sources) <= 2000),
  color text not null default '#b8874b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  status text not null default 'pending' check (status in ('pending','published','rejected')),
  story_number integer
);
alter table public.submitted_stories enable row level security;
create unique index if not exists submitted_stories_story_number_uidx
  on public.submitted_stories(story_number) where story_number is not null;
create sequence if not exists public.submitted_story_number_seq start with 5;

create or replace function public.assign_submitted_story_number()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if new.status = 'published' and new.story_number is null then
    new.story_number := nextval('public.submitted_story_number_seq');
  end if;
  return new;
end;
$$;
revoke all on function public.assign_submitted_story_number() from public, anon, authenticated;
drop trigger if exists submitted_story_assign_number on public.submitted_stories;
create trigger submitted_story_assign_number before insert or update of status, story_number
on public.submitted_stories for each row execute function public.assign_submitted_story_number();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "visitors submit pending" on public.submitted_stories;
drop policy if exists "everyone reads published" on public.submitted_stories;
drop policy if exists "admin reads all" on public.submitted_stories;
drop policy if exists "admin inserts" on public.submitted_stories;
drop policy if exists "admin updates" on public.submitted_stories;
drop policy if exists "admin deletes" on public.submitted_stories;
create policy "visitors submit pending" on public.submitted_stories for insert to anon, authenticated
  with check (status = 'pending' and story_number is null);
create policy "everyone reads published" on public.submitted_stories for select to anon, authenticated
  using (status = 'published');
create policy "admin reads all" on public.submitted_stories for select to authenticated using (public.is_admin());
create policy "admin inserts" on public.submitted_stories for insert to authenticated with check (public.is_admin());
create policy "admin updates" on public.submitted_stories for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes" on public.submitted_stories for delete to authenticated using (public.is_admin());
grant select, insert on public.submitted_stories to anon, authenticated;
grant update, delete on public.submitted_stories to authenticated;
