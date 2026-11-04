/*
  # Vision settings — Creative Strategist tab state

  Backs the new "Creative Strategist" tab (a focused 2×2 dashboard that lives
  alongside Vision). Everything that tab owns is kept as one JSONB blob here —
  same grab-bag convention as stage_bubbles / planner_notebooks / focus_pillars,
  so a single upsert writes it all and it degrades gracefully offline.

    {
      "stages": [
        { "name": "Creative Strategist", "target": "$10k/mo", "deadline": null, "done": false },
        { "name": "Business", "target": "₹1cr in bank", "deadline": null, "done": false },
        { "name": "Enlightenment", "target": "", "deadline": null, "done": false }
      ],
      "weeks":  { "2026-11-03": "<vision_doc-id>" },   // Monday -> auto-planner page
      "goals":  { "weekly": [ { "id":"g1", "text":"...", "done":false } ], "monthly": [ ... ] },
      "notes":  [ { "id":"n1", "text":"...", "x":0.3, "y":0.4, "color":"#10b981" } ]
    }

  The active stage (first with done=false) drives the tab's name.

  ## How to apply
  Run this SQL in the Supabase Dashboard → SQL Editor.
*/

ALTER TABLE vision_settings ADD COLUMN IF NOT EXISTS strategist jsonb NOT NULL DEFAULT '{}'::jsonb;
