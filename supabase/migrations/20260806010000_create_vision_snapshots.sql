/*
  # Vision daily version history

  Stores one snapshot of the Vision goals/milestones per day so a bad edit can be
  rolled back. `data` is the full array of vision_goals rows for that day.

  ## How to apply
  Run this SQL in the Supabase Dashboard → SQL Editor.
*/

CREATE TABLE IF NOT EXISTS vision_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'single-user',
  date text NOT NULL,
  data jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS vision_snapshots_user_idx ON vision_snapshots(user_id);

ALTER TABLE vision_snapshots DISABLE ROW LEVEL SECURITY;
