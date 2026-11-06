-- Durable per-story audio review state, independent of submission records.
-- This supports published static stories (such as Ibn Sina) without creating fake submissions.
create table if not exists public.story_audio_reviews (
  section text not null check (section ~ '^[a-z0-9-]{1,80}$'),
  slug text not null check (slug ~ '^[a-z0-9-]{1,80}$'),
  audio_review jsonb not null default '{"version":1,"regen":{},"clips":{},"audio_hashes":{} }'::jsonb
    check (jsonb_typeof(audio_review) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (section, slug)
);

alter table public.story_audio_reviews enable row level security;
revoke all on public.story_audio_reviews from anon, authenticated;
grant all on public.story_audio_reviews to service_role;

create or replace function public.kh_touch_story_audio_review_updated_at()
returns trigger language plpgsql set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists kh_touch_story_audio_review_updated_at on public.story_audio_reviews;
create trigger kh_touch_story_audio_review_updated_at
before update on public.story_audio_reviews
for each row execute function public.kh_touch_story_audio_review_updated_at();
