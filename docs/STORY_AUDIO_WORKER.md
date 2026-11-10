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


## Colab notebook setup

Open `notebooks/Khaledoon_VoiceTut_Colab_Worker.ipynb` in Google Colab and run its cells in order.

- The notebook installs OmniVoice from `k2-fsa/OmniVoice` and loads `masterofaudio2077/voicetut-egyptian-tashkeel`.
- It reads the Karma reference from the configured Drive path and asks for the narrator reference audio if no path is configured.
- It asks for the exact spoken transcript of each reference. Do not guess these transcripts.
- Enter the dedicated worker token when prompted. It is held in the running notebook memory only; do not save it in the notebook or GitHub.
- The worker claims one clip, renews its lease while generating, converts output to MP3, and uploads through the authenticated Edge Function.
- Completed clips are added to the private story manifest, which the existing review page reads using short-lived signed URLs.

The model card's documented Python API uses `OmniVoice.from_pretrained(...)` and `model.generate(text=..., language="arz", ref_audio=..., ref_text=...)`, returning audio at 24 kHz. English generation uses the model's English language selector; validate the first English clip by listening before continuing a story.

A Colab runtime that has been terminated cannot be started remotely. The queue remains durable while it is offline; once the notebook is opened and the worker cell is run again, it resumes by polling the queue.


## Publishing approved audio to story pages

The private worker manifest is never public by default. After every Arabic and English clip has been listened to and accepted in the review page, the admin can use **نشر الصوت المعتمد على صفحة الحكاية**. The authenticated `publish_audio` action verifies complete block coverage, accepted decisions, exact audio SHA-256 values, and the approved speech text before copying files to the public `khaledoon-story-audio-public` bucket and writing its public manifests.

The public story player reads only those public manifests. It supports Arabic and English for every story, including October. Existing legacy static audio remains a fallback where no public VoiceTut manifest exists. Rejected or unreviewed clips are never copied by the publication action.
