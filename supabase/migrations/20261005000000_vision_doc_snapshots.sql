/*
  # Vision Planner: per-page version snapshots

  A lightweight safety net for the planner editor. As you edit a page, the app
  periodically stores a snapshot of its title + objectives + body (all HTML) here,
  so any bad edit is one click away from being recovered. Snapshots are capped per
  page (older ones are pruned by the app), so this table stays small.

  ## How to apply
  Run this SQL in the Supabase Dashboard → SQL Editor.
*/

CREATE TABLE IF NOT EXISTS vision_doc_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id uuid NOT NULL REFERENCES vision_docs(id) ON DELETE CASCADE,
  user_id text NOT NULL DEFAULT 'single-user',
  title text NOT NULL DEFAULT 'Untitled',
  summary text NOT NULL DEFAULT '',   -- objectives section (HTML)
  content text NOT NULL DEFAULT '',   -- main body (HTML)
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vision_doc_snapshots_doc_idx
  ON vision_doc_snapshots(doc_id, created_at DESC);

ALTER TABLE vision_doc_snapshots DISABLE ROW LEVEL SECURITY;
