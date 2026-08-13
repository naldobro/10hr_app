/*
  # Vision settings — add Focus note

  Adds a free-text "focus" field to the single vision_settings row. It backs the
  Focus card in the top-right of the Vision timeline, where you jot what you're
  thinking about and what to spend your time on right now.

  ## How to apply
  Run this SQL in the Supabase Dashboard → SQL Editor.
*/

ALTER TABLE vision_settings ADD COLUMN IF NOT EXISTS focus_note text NOT NULL DEFAULT '';
