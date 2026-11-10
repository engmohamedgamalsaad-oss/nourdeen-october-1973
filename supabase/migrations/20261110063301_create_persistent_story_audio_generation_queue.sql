create table if not exists public.story_audio_generation_queue (
  id uuid primary key default gen_random_uuid(),
  section text not null,
  slug text not null,
  language text not null check (language in ('ar','en','fr','it','de')),
  block_index integer not null check (block_index >= 0),
  speaker text not null check (speaker in ('narrator','karma')),
  engine text not null default 'omnivoice-voicetut',
  payload jsonb not null default '{}'::jsonb,
  source_text_hash text not null,
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  lock_token uuid,
  worker_id text,
  result jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint story_audio_generation_queue_story_clip_hash_unique
    unique (section, slug, language, block_index, source_text_hash)
);
create index if not exists story_audio_generation_queue_pending_idx
  on public.story_audio_generation_queue (available_at, created_at)
  where status = 'pending';
create index if not exists story_audio_generation_queue_lease_idx
  on public.story_audio_generation_queue (locked_at)
  where status = 'processing';
alter table public.story_audio_generation_queue enable row level security;
revoke all on public.story_audio_generation_queue from anon, authenticated;
grant all on public.story_audio_generation_queue to service_role;

create or replace function public.claim_story_audio_generation_job(
  p_worker_id text default 'colab-worker',
  p_lease_seconds integer default 900
)
returns setof public.story_audio_generation_queue
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with candidate as (
    select id
    from public.story_audio_generation_queue
    where attempts < max_attempts
      and (
        (status = 'pending' and available_at <= now())
        or (status = 'processing' and locked_at < now() - make_interval(secs => greatest(60, least(p_lease_seconds, 3600))))
      )
    order by created_at, id
    for update skip locked
    limit 1
  )
  update public.story_audio_generation_queue q
  set status = 'processing',
      attempts = q.attempts + 1,
      locked_at = now(),
      lock_token = gen_random_uuid(),
      worker_id = left(coalesce(p_worker_id, 'colab-worker'), 120),
      updated_at = now(),
      last_error = null
  from candidate
  where q.id = candidate.id
  returning q.*;
end;
$$;
revoke all on function public.claim_story_audio_generation_job(text, integer) from public, anon, authenticated;
grant execute on function public.claim_story_audio_generation_job(text, integer) to service_role;

create or replace function public.requeue_expired_story_audio_jobs()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare changed integer;
begin
  update public.story_audio_generation_queue
  set status = case when attempts >= max_attempts then 'failed' else 'pending' end,
      available_at = now() + make_interval(secs => least(300, greatest(10, attempts * 10))),
      locked_at = null,
      lock_token = null,
      worker_id = null,
      updated_at = now(),
      last_error = coalesce(last_error, 'Worker lease expired; job returned to queue')
  where status = 'processing'
    and locked_at < now() - interval '20 minutes';
  get diagnostics changed = row_count;
  return changed;
end;
$$;
revoke all on function public.requeue_expired_story_audio_jobs() from public, anon, authenticated;
grant execute on function public.requeue_expired_story_audio_jobs() to service_role;
