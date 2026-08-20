/*
  # Re-enable RLS for single-user protection

  RLS was disabled for convenience, but the anon key is exposed in frontend JS.
  Anyone who finds it can read/write/delete all data.

  This adds basic protection: only rows where user_id = 'single-user' are accessible.
  Not bulletproof (the user_id is guessable), but blocks casual/automated abuse.

  ## How to apply
  Run this SQL in the Supabase Dashboard → SQL Editor
*/

-- Enable RLS on all tables
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_quotes ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to start clean
DROP POLICY IF EXISTS "Users can view own work sessions" ON work_sessions;
DROP POLICY IF EXISTS "Users can insert own work sessions" ON work_sessions;
DROP POLICY IF EXISTS "Users can update own work sessions" ON work_sessions;
DROP POLICY IF EXISTS "Users can delete own work sessions" ON work_sessions;

DROP POLICY IF EXISTS "Users can view own daily summaries" ON daily_summaries;
DROP POLICY IF EXISTS "Users can insert own daily summaries" ON daily_summaries;
DROP POLICY IF EXISTS "Users can update own daily summaries" ON daily_summaries;
DROP POLICY IF EXISTS "Users can delete own daily summaries" ON daily_summaries;

DROP POLICY IF EXISTS "Users can view own goals" ON goals;
DROP POLICY IF EXISTS "Users can insert own goals" ON goals;
DROP POLICY IF EXISTS "Users can update own goals" ON goals;
DROP POLICY IF EXISTS "Users can delete own goals" ON goals;

DROP POLICY IF EXISTS "All users can view quotes" ON milestone_quotes;
DROP POLICY IF EXISTS "Authenticated users can view quotes" ON milestone_quotes;

-- Work Sessions: full access for single-user rows
CREATE POLICY "single_user_select_sessions" ON work_sessions
  FOR SELECT TO public USING (user_id = 'single-user');
CREATE POLICY "single_user_insert_sessions" ON work_sessions
  FOR INSERT TO public WITH CHECK (user_id = 'single-user');
CREATE POLICY "single_user_update_sessions" ON work_sessions
  FOR UPDATE TO public USING (user_id = 'single-user') WITH CHECK (user_id = 'single-user');
CREATE POLICY "single_user_delete_sessions" ON work_sessions
  FOR DELETE TO public USING (user_id = 'single-user');

-- Daily Summaries: full access for single-user rows
CREATE POLICY "single_user_select_summaries" ON daily_summaries
  FOR SELECT TO public USING (user_id = 'single-user');
CREATE POLICY "single_user_insert_summaries" ON daily_summaries
  FOR INSERT TO public WITH CHECK (user_id = 'single-user');
CREATE POLICY "single_user_update_summaries" ON daily_summaries
  FOR UPDATE TO public USING (user_id = 'single-user') WITH CHECK (user_id = 'single-user');
CREATE POLICY "single_user_delete_summaries" ON daily_summaries
  FOR DELETE TO public USING (user_id = 'single-user');

-- Goals: full access for single-user rows
CREATE POLICY "single_user_select_goals" ON goals
  FOR SELECT TO public USING (user_id = 'single-user');
CREATE POLICY "single_user_insert_goals" ON goals
  FOR INSERT TO public WITH CHECK (user_id = 'single-user');
CREATE POLICY "single_user_update_goals" ON goals
  FOR UPDATE TO public USING (user_id = 'single-user') WITH CHECK (user_id = 'single-user');
CREATE POLICY "single_user_delete_goals" ON goals
  FOR DELETE TO public USING (user_id = 'single-user');

-- Quotes: read-only for everyone
CREATE POLICY "public_read_quotes" ON milestone_quotes
  FOR SELECT TO public USING (true);

