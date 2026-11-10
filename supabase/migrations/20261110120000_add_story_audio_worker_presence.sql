alter table public.story_audio_worker_credentials
  add column if not exists last_seen_at timestamptz;

comment on column public.story_audio_worker_credentials.last_seen_at is
  'Last authenticated request from the private audio worker; read only by the service role for public online/offline status.';
