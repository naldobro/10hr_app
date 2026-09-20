/*
  # Enable Realtime on the Vision tables

  Adds the Vision tables to the `supabase_realtime` publication so the app can
  subscribe to live changes. This is what makes a Planner page / goal / bubble
  added on one device (e.g. the phone) show up on another (e.g. the Mac) within
  a moment, without a manual refresh.

  Idempotent: each table is only added if it isn't already published, so this is
  safe to run more than once. If Realtime isn't enabled the app still works — it
  falls back to refetching when the tab regains focus.

  ## How to apply
  Run this SQL in the Supabase Dashboard → SQL Editor.
*/

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vision_goals', 'vision_docs', 'vision_settings', 'vision_topics'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
