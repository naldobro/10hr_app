/*
  # Vision settings — Planner notebook metadata

  Stores per-notebook display metadata for the Planner gallery: a chosen accent
  colour and a manual sort order, keyed by notebook name. Shape:

    { "Work": { "color": "#2563eb", "order": 2 }, ... }

  Notebooks themselves are still derived from the pages that belong to them; this
  only remembers how the user has coloured and arranged their cards.

  ## How to apply
  Run this SQL in the Supabase Dashboard → SQL Editor.
*/

ALTER TABLE vision_settings ADD COLUMN IF NOT EXISTS planner_notebooks jsonb NOT NULL DEFAULT '{}'::jsonb;
