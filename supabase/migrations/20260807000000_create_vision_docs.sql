/*
  # Vision Planner: month-scoped documents

  A lightweight, Google-Docs-style planner that lives inside Vision. Each document
  belongs to a calendar month ('YYYY-MM') so plans are grouped month-by-month; a new
  month starts a fresh set while older months stay browsable. Rich text is stored as
  HTML in `content`.

  ## How to apply
  Run this SQL in the Supabase Dashboard → SQL Editor.
*/

CREATE TABLE IF NOT EXISTS vision_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'single-user',
  month text NOT NULL,                 -- 'YYYY-MM'
  title text NOT NULL DEFAULT 'Untitled',
  content text NOT NULL DEFAULT '',    -- rich text (HTML)
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vision_docs_user_month_idx ON vision_docs(user_id, month);

ALTER TABLE vision_docs DISABLE ROW LEVEL SECURITY;
