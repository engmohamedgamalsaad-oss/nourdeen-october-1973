-- Applied to production as Supabase migration 20261110063521.
-- The worker credential row is provisioned separately; never commit its token hash.
create table if not exists public.story_audio_worker_credentials (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  token_sha256 text not null check (token_sha256 ~ '^[a-f0-9]{64}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);
alter table public.story_audio_worker_credentials enable row level security;
revoke all on public.story_audio_worker_credentials from anon, authenticated;
grant all on public.story_audio_worker_credentials to service_role;
