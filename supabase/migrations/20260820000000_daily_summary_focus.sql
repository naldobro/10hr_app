/*
  # Daily summary — add Focus note

  Adds a free-text "focus" field to each daily_summaries row. It backs the
  per-day Focus card in the Track tab, where you jot what you're setting out to
  focus on for that specific day before you start logging sessions.

  Mirrors the vision_settings.focus_note field, but scoped per day rather than
  as a single global note.

  ## How to apply
  Run this SQL in the Supabase Dashboard → SQL Editor.
*/

ALTER TABLE daily_summaries ADD COLUMN IF NOT EXISTS focus_note text NOT NULL DEFAULT '';
