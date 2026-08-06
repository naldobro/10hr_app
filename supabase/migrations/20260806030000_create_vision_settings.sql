/*
  # Vision settings (single row per user)

  Small key/value-ish settings row for the Vision area. Currently holds the
  editable Reflections heading + subtitle so they sync across devices.

  ## How to apply
  Run this SQL in the Supabase Dashboard → SQL Editor.
*/

CREATE TABLE IF NOT EXISTS vision_settings (
  user_id text PRIMARY KEY DEFAULT 'single-user',
  reflections_title text NOT NULL DEFAULT 'Reflections',
  reflections_subtitle text NOT NULL DEFAULT 'Life areas and how you want to hold them.',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vision_settings DISABLE ROW LEVEL SECURITY;
