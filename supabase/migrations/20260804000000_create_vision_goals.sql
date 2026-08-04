/*
  # Vision Timeline goals

  Backs the "Vision" tab: goals placed on a glowing timeline with a deadline,
  a target metric (e.g. "$10,000/mo"), a colour, a reason, and milestone steps.

  ## Table: vision_goals
  - `title`      - name of the goal
  - `target`     - the visual target metric (money, reps, followers, ayahs, launch…)
  - `note`       - "why this matters"
  - `color`      - accent hex used on the card / node / ring
  - `deadline`   - YYYY-MM-DD; NULL means the goal is unscheduled (sitting in the tray)
  - `steps`      - jsonb array of { text, done } milestones; drives the progress ring
  - `sort_order` - stable ordering for the unscheduled tray

  ## How to apply
  Run this SQL in the Supabase Dashboard → SQL Editor.
*/

CREATE TABLE IF NOT EXISTS vision_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'single-user',
  title text NOT NULL DEFAULT 'New goal',
  target text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#7c3aed',
  deadline text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vision_goals_user_idx ON vision_goals(user_id);

-- Match the other single-user tables in this project (RLS handled app-side by user_id).
ALTER TABLE vision_goals DISABLE ROW LEVEL SECURITY;
