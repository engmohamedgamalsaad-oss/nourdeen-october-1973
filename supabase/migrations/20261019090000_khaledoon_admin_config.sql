-- Khaledoon admin-only configuration store for central prompt/section drafts.
-- Additive migration: does not alter or delete existing story/reaction tables or rows.
create table if not exists public.khaledoon_admin_config (
  config_key text primary key check (config_key in ('prompts','sections')),
  config_value jsonb not null check (jsonb_typeof(config_value) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.khaledoon_admin_config enable row level security;
revoke all on public.khaledoon_admin_config from anon, authenticated;
grant select, insert, update on public.khaledoon_admin_config to authenticated;
drop policy if exists "kh config admins read" on public.khaledoon_admin_config;
drop policy if exists "kh config admins insert" on public.khaledoon_admin_config;
drop policy if exists "kh config admins update" on public.khaledoon_admin_config;
create policy "kh config admins read" on public.khaledoon_admin_config
  for select to authenticated using ((select public.is_admin()));
create policy "kh config admins insert" on public.khaledoon_admin_config
  for insert to authenticated with check ((select public.is_admin()));
create policy "kh config admins update" on public.khaledoon_admin_config
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create or replace function public.kh_touch_admin_config_updated_at()
returns trigger language plpgsql set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists kh_touch_admin_config_updated_at on public.khaledoon_admin_config;
create trigger kh_touch_admin_config_updated_at
before update on public.khaledoon_admin_config
for each row execute function public.kh_touch_admin_config_updated_at();
