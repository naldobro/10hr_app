/*
  # Vision settings — add the 3 Focus Pillars

  Adds a `focus_pillars` JSONB field to the single vision_settings row. It backs
  the three "focus things" that live in the top navigation bar on the Vision tab —
  the only three topics you want to think about in life. Each pillar is
  `{ "title": string, "body": string }`: the title is the pill's heading and the
  body is the longer note that expands when you click it.

  Kept as JSONB (not three separate columns) so the shape stays flexible and one
  patch writes all three at once. Defaults to an empty array; the app pads it to
  exactly three pillars on load.

  ## How to apply
  Run this SQL in the Supabase Dashboard → SQL Editor.
*/

ALTER TABLE vision_settings ADD COLUMN IF NOT EXISTS focus_pillars jsonb NOT NULL DEFAULT '[]'::jsonb;
