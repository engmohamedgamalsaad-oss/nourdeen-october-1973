-- Applied to Supabase project ypwprddkscnfblhftkeb on 2026-10-11.
-- Reduce table privileges while preserving existing RLS policies.
REVOKE ALL PRIVILEGES ON TABLE public.admins FROM anon, authenticated;
GRANT SELECT ON TABLE public.admins TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.submitted_stories FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.submitted_stories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.submitted_stories TO authenticated;
