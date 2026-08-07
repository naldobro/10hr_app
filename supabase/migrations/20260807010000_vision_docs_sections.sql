/*
  # Vision Planner: doc sections + color

  Adds a top "objectives / to-do" section to each planner doc (kept separate from the
  main body) and an accent color for the doc. Both are safe to run repeatedly.

  ## How to apply
  Run this SQL in the Supabase Dashboard → SQL Editor.
*/

ALTER TABLE vision_docs ADD COLUMN IF NOT EXISTS summary text NOT NULL DEFAULT '';
ALTER TABLE vision_docs ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#0ea5e9';
