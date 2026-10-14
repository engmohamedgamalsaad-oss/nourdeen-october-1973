alter policy "users check own admin email"
  on public.admins
  using (
    lower(email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
  );