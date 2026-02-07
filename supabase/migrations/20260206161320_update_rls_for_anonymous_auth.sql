/*
  # Update RLS Policies for Anonymous Auth Support
  
  1. Changes to RLS Policies
    - Change work_sessions policies from "TO authenticated" to "TO public" to support anonymous auth
    - Update daily_summaries policies similarly
    - Update goals policies for anonymous access
    - Keep milestone_quotes read-only for all authenticated users
  
  2. Security Model
    - Anonymous users can only access their own data via auth.uid() = user_id check
    - All data access still requires ownership verification
    - No data is exposed across users
*/

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

DROP POLICY IF EXISTS "Authenticated users can view quotes" ON milestone_quotes;

-- Work Sessions Policies (Anonymous Auth Support)
CREATE POLICY "Users can view own work sessions"
  ON work_sessions FOR SELECT
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own work sessions"
  ON work_sessions FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own work sessions"
  ON work_sessions FOR UPDATE
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own work sessions"
  ON work_sessions FOR DELETE
  TO public
  USING (auth.uid() = user_id);

-- Daily Summaries Policies
CREATE POLICY "Users can view own daily summaries"
  ON daily_summaries FOR SELECT
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily summaries"
  ON daily_summaries FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily summaries"
  ON daily_summaries FOR UPDATE
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily summaries"
  ON daily_summaries FOR DELETE
  TO public
  USING (auth.uid() = user_id);

-- Goals Policies
CREATE POLICY "Users can view own goals"
  ON goals FOR SELECT
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
  ON goals FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
  ON goals FOR UPDATE
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
  ON goals FOR DELETE
  TO public
  USING (auth.uid() = user_id);

-- Milestone Quotes Policies
CREATE POLICY "All users can view quotes"
  ON milestone_quotes FOR SELECT
  TO public
  USING (true);