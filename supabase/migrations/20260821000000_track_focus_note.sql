/*
  # Vision settings — add Track Focus note

  Adds a second free-text focus field to the single vision_settings row:
  `track_focus_note`. It backs the Track tab's Focus note — one global,
  day-independent note that stays the same across every day.

  This is deliberately SEPARATE from `focus_note` (the Vision tab's Focus card),
  so the two notes have their own text and never overwrite each other.

  The Track tab previously stored its Focus per-day in
  daily_summaries.focus_note; that column is now unused and left in place.

  ## How to apply
  Run this SQL in the Supabase Dashboard → SQL Editor.
*/

ALTER TABLE vision_settings ADD COLUMN IF NOT EXISTS track_focus_note text NOT NULL DEFAULT '';
