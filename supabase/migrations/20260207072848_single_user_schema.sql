/*
  # Single User 10hr Day Schema

  This is a simplified schema for a single-user personal productivity tracker.
  No authentication or Row Level Security is needed since only one person will use this app.

  ## Tables Created

  ### work_sessions
  - Stores individual work sessions with start/end times
  - Fields: id, user_id, date, start_time, end_time, label, color, created_at

  ### daily_summaries
  - Aggregates total hours worked per day
  - Fields: id, user_id, date, total_hours, milestone_quotes_shown, updated_at

  ### goals
  - Stores major and minor goals for each month
  - Fields: id, user_id, type, description, completed, progress_current, progress_total, date, month, created_at

  ### milestone_quotes
  - Stores motivational quotes shown at milestones
  - Fields: id, quote, sort_order

  ## Security
  - RLS is DISABLED for all tables since this is a single-user app
  - The app uses a constant user_id 'single-user' for all records
*/

-- Create work_sessions table
CREATE TABLE IF NOT EXISTS work_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'single-user',
  date text NOT NULL,
  start_time real NOT NULL,
  end_time real NOT NULL,
  label text NOT NULL,
  color text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create daily_summaries table
CREATE TABLE IF NOT EXISTS daily_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'single-user',
  date text NOT NULL,
  total_hours real NOT NULL DEFAULT 0,
  milestone_quotes_shown text[] DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Create goals table
CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'single-user',
  type text NOT NULL CHECK (type IN ('major', 'minor')),
  description text NOT NULL,
  completed boolean DEFAULT false,
  progress_current integer DEFAULT 0,
  progress_total integer DEFAULT 0,
  date text NOT NULL,
  month text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create milestone_quotes table
CREATE TABLE IF NOT EXISTS milestone_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote text NOT NULL,
  sort_order integer NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS work_sessions_date_idx ON work_sessions(date);
CREATE INDEX IF NOT EXISTS work_sessions_user_date_idx ON work_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS daily_summaries_date_idx ON daily_summaries(date);
CREATE INDEX IF NOT EXISTS daily_summaries_user_date_idx ON daily_summaries(user_id, date);
CREATE INDEX IF NOT EXISTS goals_month_idx ON goals(month);
CREATE INDEX IF NOT EXISTS goals_user_month_idx ON goals(user_id, month);

-- Insert default motivational quotes
INSERT INTO milestone_quotes (quote, sort_order) VALUES
  ('Great work! Keep the momentum going!', 1),
  ('You''re making excellent progress!', 2),
  ('Every hour counts towards your goals!', 3),
  ('Consistency is the key to success!', 4),
  ('You''re crushing it today!', 5),
  ('Another milestone reached!', 6),
  ('Your dedication is inspiring!', 7),
  ('Keep pushing your limits!', 8),
  ('Excellence is a habit, not an act!', 9),
  ('You''re on fire today!', 10)
ON CONFLICT DO NOTHING;

-- Disable RLS for all tables (single user app)
ALTER TABLE work_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries DISABLE ROW LEVEL SECURITY;
ALTER TABLE goals DISABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_quotes DISABLE ROW LEVEL SECURITY;
