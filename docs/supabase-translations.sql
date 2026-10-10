-- ============================================================
-- إضافة الترجمة الآلية للحكايات (تشغّل بعد docs/supabase-setup.sql)
-- شغّل هذا الملف كاملًا من: Supabase > SQL Editor > New query > Run
-- يمكن تشغيله أكثر من مرة بدون مشاكل.
-- ============================================================

-- عمود الترجمات: {"en":{...},"fr":{...},"it":{...}}
alter table public.submitted_stories
  add column if not exists translations jsonb not null default '{}'::jsonb;

alter table public.submitted_stories drop constraint if exists translations_is_object;
alter table public.submitted_stories
  add constraint translations_is_object
  check (jsonb_typeof(translations) = 'object' and char_length(translations::text) <= 60000);

-- الزائر لا يستطيع إرسال ترجمات؛ الترجمة يضيفها الأدمن فقط
drop policy if exists "visitors submit pending" on public.submitted_stories;
create policy "visitors submit pending" on public.submitted_stories
  for insert to anon, authenticated
  with check (status = 'pending' and translations = '{}'::jsonb);
