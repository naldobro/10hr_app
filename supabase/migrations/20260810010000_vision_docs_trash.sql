/*
  # Planner: soft-delete (Trash)

  Adds `deleted_at` to planner docs so deleting a page or notebook only *hides* it
  (moves it to Trash) instead of erasing it. Rows with a non-null `deleted_at` are in
  the Trash and can be restored or permanently removed. Nothing is ever hard-deleted
  by a button or by undo anymore.

  ## How to apply
  Run this SQL in the Supabase Dashboard → SQL Editor (the 10hr_app project). Safe to
  run repeatedly.
*/

ALTER TABLE vision_docs ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS vision_docs_user_deleted_idx ON vision_docs(user_id, deleted_at);
