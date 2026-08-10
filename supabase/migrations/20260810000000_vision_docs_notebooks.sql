/*
  # Planner: multiple notebooks

  Adds a `notebook` label to each planner doc so pages can be grouped into separate
  notebooks (e.g. the built-in month-based "Planner", plus freeform idea notebooks
  like Family, Kelle Skin, Future goals). Existing docs default to the "Planner"
  notebook, so nothing moves.

  ## How to apply
  Run this SQL in the Supabase Dashboard → SQL Editor. Safe to run repeatedly.
*/

ALTER TABLE vision_docs ADD COLUMN IF NOT EXISTS notebook text NOT NULL DEFAULT 'Planner';
CREATE INDEX IF NOT EXISTS vision_docs_user_notebook_idx ON vision_docs(user_id, notebook);
