/*
  # Vision settings — Stage-book focus bubbles

  Backs the new Stage Book view (an alternative to the scrolling timeline). Each
  Vision goal becomes a "stage" page, and on that page you scatter free-floating
  focus bubbles — reminders of what to focus on ("focus") and what to avoid
  ("avoid"). Those bubbles live here, keyed by goal id:

    {
      "<goal-id>": [
        { "id": "b1", "text": "ship daily",  "kind": "focus", "x": 0.32, "y": 0.4 },
        { "id": "b2", "text": "doomscroll",  "kind": "avoid", "x": 0.7,  "y": 0.6 }
      ],
      ...
    }

  x / y are fractions (0..1) of the page canvas so bubbles stay put when the page
  is resized. Kept as one JSONB blob (not a table) so a single upsert writes a
  whole page's bubbles at once and it degrades gracefully offline, matching how
  planner_notebooks / focus_pillars are stored.

  ## How to apply
  Run this SQL in the Supabase Dashboard → SQL Editor.
*/

ALTER TABLE vision_settings ADD COLUMN IF NOT EXISTS stage_bubbles jsonb NOT NULL DEFAULT '{}'::jsonb;
