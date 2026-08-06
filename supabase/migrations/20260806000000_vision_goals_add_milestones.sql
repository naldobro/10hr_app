/*
  # Vision: milestones + simpler goals

  Milestones become first-class, lightweight timeline items that live in the same
  table as goals. A milestone can optionally be attached to a goal, and when it is,
  it inherits that goal's colour (derived in the app).

  Adds to vision_goals:
  - `kind`    - 'goal' | 'milestone'
  - `goal_id` - when a milestone is attached to a goal (NULL = standalone).
                ON DELETE SET NULL so deleting a goal just detaches its milestones.
  - `done`    - completion flag (replaces the old step-driven progress on goals)

  The legacy `steps` column is left in place but is no longer used by the app.

  ## How to apply
  Run this SQL in the Supabase Dashboard → SQL Editor.
*/

ALTER TABLE vision_goals
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'goal',
  ADD COLUMN IF NOT EXISTS goal_id uuid REFERENCES vision_goals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS done boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS vision_goals_kind_idx ON vision_goals(kind);
