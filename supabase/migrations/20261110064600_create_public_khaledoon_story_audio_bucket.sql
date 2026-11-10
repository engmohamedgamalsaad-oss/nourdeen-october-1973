insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('khaledoon-story-audio-public','khaledoon-story-audio-public',true,13500000,array['audio/mpeg','application/json'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
