# Persistent VoiceTut / OmniVoice worker

This worker is the server-side bridge between the durable Supabase queue and the Colab runtime.

## Security
- The Colab notebook receives only a dedicated worker token, never the Supabase secret/service-role key.
- The worker token is checked against a SHA-256 hash in `public.story_audio_worker_credentials`.
- The queue table and credential table remain inaccessible to `anon` and `authenticated`.
- Audio is uploaded to the private `khaledoon-audio-review` bucket. No public URL is created here.

## Runtime behavior
- `claim`: claims one job using `claim_story_audio_generation_job`.
- `heartbeat`: renews the current lease.
- `complete`: verifies and stores one WAV/MP3 clip, then marks that queue row completed.
- `fail`: returns a failed attempt to the queue with backoff, or marks it terminal after the configured maximum attempts.

The queue is durable while Colab is offline. A terminated Colab runtime cannot be awakened by Supabase; when the notebook/runtime is started again, its polling loop can claim pending work.

## Endpoint
`POST https://ypwprddkscnfblhftkeb.supabase.co/functions/v1/story-audio-worker`

Header: `x-khaledoon-worker-token: <dedicated token>`

The function intentionally does not expose the Supabase secret key to the notebook.
