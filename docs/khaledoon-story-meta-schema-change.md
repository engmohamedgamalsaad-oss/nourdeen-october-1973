# سجل تعديل مخطط بيانات تجهيز الحكايات — 2026-10-19

## الحالة

تم تنفيذ التغيير والتحقق منه على قاعدة Supabase الحية الخاصة بالمشروع. هذا الملف سجل توثيقي للتغيير المنفذ، وليس بديلًا عن سجل migrations الرسمي.

## ما تغيّر

- إضافة العمود الخاص `story_meta jsonb NOT NULL DEFAULT '{}'` إلى `public.khaledoon_submissions` و`public.submitted_stories`.
- إضافة قيد يضمن أن القيمة JSON object.
- تحديث سياسات RLS بحيث لا يستطيع الزائر إدخال بيانات خاصة في هذا العمود.
- تحديث سياسات قراءة `submitted_stories` العامة بحيث لا تظهر سجلات منشورة تحتوي على بيانات `story_meta` خاصة.
- لم تتغير جداول الإعجابات والتفاعلات، ولم تُحذف أي بيانات.

## SQL الذي نُفذ

```sql
ALTER TABLE public.khaledoon_submissions
  ADD COLUMN IF NOT EXISTS story_meta jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.submitted_stories
  ADD COLUMN IF NOT EXISTS story_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

-- أضيفت قيود jsonb_typeof(story_meta) = 'object' للجدولين
-- عُدّلت سياسات INSERT العامة لتشترط story_meta = '{}'::jsonb
-- عُدّلت سياسات القراءة العامة في submitted_stories لتشترط story_meta = '{}'::jsonb
```

## التحقق قبل وبعد

- قبل التغيير: `khaledoon_submissions` = 4 سجلات (منها سجل منشور واحد)، و`submitted_stories` = 0 سجل.
- بعد التغيير: بقيت الأعداد كما هي، ولم يوجد أي سجل يحتوي على بيانات `story_meta` جديدة.
- تم التحقق من وجود العمودين بنوع JSONB و`NOT NULL DEFAULT '{}'`، ومن وجود قيدي JSON object، ومن شروط سياسات RLS الجديدة.

## حدود التغيير

لا يرفع هذا التغيير ملفات إلى GitHub ولا ينشر حكايات. يتيح حفظ بيانات التجهيز الخاصة في لوحة الإدارة فقط. يجب إنشاء/مزامنة migration رسمي في بيئة التطوير عند توفر Supabase CLI؛ هذا السجل يوثق SQL المنفذ مباشرة ولا يدّعي وجود migration رسمي جديد.
