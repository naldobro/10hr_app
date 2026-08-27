/*
  # Vision settings — add Diary note

  Adds a free-text "diary" field to the single vision_settings row. It backs the
  Diary card under the Focus card on the Vision timeline, where you write your
  goals and track your progression day to day — styled to feel like paper.

  ## How to apply
  Run this SQL in the Supabase Dashboard → SQL Editor.
*/

ALTER TABLE vision_settings ADD COLUMN IF NOT EXISTS diary_note text NOT NULL DEFAULT '';
