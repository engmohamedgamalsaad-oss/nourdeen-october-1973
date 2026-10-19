-- Public site may read only the section configuration row; prompt drafts remain admin-only.
grant select on public.khaledoon_admin_config to anon, authenticated;
drop policy if exists "kh public section config read" on public.khaledoon_admin_config;
create policy "kh public section config read" on public.khaledoon_admin_config
  for select to anon, authenticated using (config_key = 'sections');
