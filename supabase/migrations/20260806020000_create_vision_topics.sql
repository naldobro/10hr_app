/*
  # Vision Reflections: topics + emotion bubbles

  Life-area topics (e.g. Parents, Career, Health) each holding a set of "emotion"
  bubbles — short reminders of how to think/feel about that area. Emotions are
  stored inline as a jsonb array so a topic is a single row (and undo records the
  whole topic before/after, like goals).

  emotions: [{ id, text, color }]

  ## How to apply
  Run this SQL in the Supabase Dashboard → SQL Editor.
*/

CREATE TABLE IF NOT EXISTS vision_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'single-user',
  title text NOT NULL DEFAULT 'New topic',
  color text NOT NULL DEFAULT '#7c3aed',
  emotions jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vision_topics_user_idx ON vision_topics(user_id);

ALTER TABLE vision_topics DISABLE ROW LEVEL SECURITY;
