begin;

alter policy "users check own admin email"
  on public.admins
  using (
    lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );

drop policy "visitors submit pending" on public.submitted_stories;
drop policy "admin inserts" on public.submitted_stories;
create policy "anon visitors submit pending"
  on public.submitted_stories for insert to anon
  with check (status = 'pending' and story_number is null);
create policy "authenticated visitors or admins insert"
  on public.submitted_stories for insert to authenticated
  with check (
    (status = 'pending' and story_number is null)
    or public.is_admin()
  );

drop policy "everyone reads published" on public.submitted_stories;
drop policy "admin reads all" on public.submitted_stories;
create policy "anon reads published"
  on public.submitted_stories for select to anon
  using (status = 'published');
create policy "authenticated reads published or admin"
  on public.submitted_stories for select to authenticated
  using (status = 'published' or public.is_admin());

drop policy "kh visitors submit pending" on public.khaledoon_submissions;
drop policy "kh admin inserts" on public.khaledoon_submissions;
create policy "kh anon visitors submit pending"
  on public.khaledoon_submissions for insert to anon
  with check (
    status = 'pending'
    and consent is true
    and admin_notes is null
    and history_note is null
  );
create policy "kh authenticated visitors or admins insert"
  on public.khaledoon_submissions for insert to authenticated
  with check (
    (
      status = 'pending'
      and consent is true
      and admin_notes is null
      and history_note is null
    )
    or public.is_admin()
  );

commit;