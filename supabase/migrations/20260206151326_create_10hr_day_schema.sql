/*
  # 10hr Day Productivity App Schema

  ## Overview
  Creates the complete database schema for the 10hr Day productivity tracking application.
  This includes work session tracking, daily summaries, goals management, and milestone quotes.

  ## New Tables

  ### `work_sessions`
  Stores individual deep work sessions with timing and categorization
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `date` (date) - the calendar day of the session
  - `start_time` (numeric) - hour as decimal (e.g., 10.5 = 10:30 AM)
  - `end_time` (numeric) - hour as decimal
  - `label` (text) - session description/category
  - `color` (text) - visual color for timeline display
  - `created_at` (timestamptz)

  ### `daily_summaries`
  Cached daily totals for performance
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `date` (date, unique per user)
  - `total_hours` (numeric) - sum of all work hours for the day
  - `milestone_quotes_shown` (text[]) - array of quote IDs shown this day
  - `updated_at` (timestamptz)

  ### `goals`
  Tracks both major and minor goals
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `type` (text) - 'major' or 'minor'
  - `description` (text) - goal text
  - `completed` (boolean) - completion status
  - `progress_current` (integer) - for trackable goals (e.g., 2/3)
  - `progress_total` (integer) - target number
  - `date` (date) - relevant date for the goal
  - `month` (text) - month in YYYY-MM format
  - `created_at` (timestamptz)

  ### `milestone_quotes`
  100 motivational quotes for milestone celebrations
  - `id` (uuid, primary key)
  - `quote` (text) - the motivational quote text
  - `sort_order` (integer) - for consistent ordering

  ## Security
  - Enable RLS on all tables
  - Users can only access their own data
  - Quotes table is readable by all authenticated users
*/

-- Create work_sessions table
CREATE TABLE IF NOT EXISTS work_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  start_time numeric NOT NULL,
  end_time numeric NOT NULL,
  label text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'blue',
  created_at timestamptz DEFAULT now()
);

-- Create daily_summaries table
CREATE TABLE IF NOT EXISTS daily_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  total_hours numeric NOT NULL DEFAULT 0,
  milestone_quotes_shown text[] DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Create goals table
CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('major', 'minor')),
  description text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  progress_current integer DEFAULT 0,
  progress_total integer DEFAULT 0,
  date date NOT NULL,
  month text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create milestone_quotes table
CREATE TABLE IF NOT EXISTS milestone_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote text NOT NULL,
  sort_order integer NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_work_sessions_user_date ON work_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_user_date ON daily_summaries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_goals_user_month ON goals(user_id, month);

-- Enable RLS
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_quotes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for work_sessions
CREATE POLICY "Users can view own work sessions"
  ON work_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own work sessions"
  ON work_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own work sessions"
  ON work_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own work sessions"
  ON work_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for daily_summaries
CREATE POLICY "Users can view own daily summaries"
  ON daily_summaries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily summaries"
  ON daily_summaries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily summaries"
  ON daily_summaries FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily summaries"
  ON daily_summaries FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for goals
CREATE POLICY "Users can view own goals"
  ON goals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
  ON goals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
  ON goals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
  ON goals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for milestone_quotes (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view quotes"
  ON milestone_quotes FOR SELECT
  TO authenticated
  USING (true);

-- Insert 100 motivational quotes
INSERT INTO milestone_quotes (quote, sort_order) VALUES
  ('Loud hustlers chase attention. Silent ones chase freedom.', 1),
  ('Work so quietly that even you''re surprised by your results.', 2),
  ('The quiet grind is the most dangerous because it doesn''t announce when it''s about to take over.', 3),
  ('Your results should walk into the room before your words ever do.', 4),
  ('Silence multiplies focus. Focus multiplies outcomes.', 5),
  ('The world celebrates noise. Winners celebrate progress.', 6),
  ('They''ll ask where you were when you arrive where you''re going.', 7),
  ('Success isn''t loud. It''s consistent.', 8),
  ('Stop announcing moves. Start announcing results.', 9),
  ('The best revenge is massive success achieved in silence.', 10),
  ('Work in private. Win in public.', 11),
  ('Silent hustlers are the scariest competition.', 12),
  ('Your silence is your power. Use it wisely.', 13),
  ('Success is the sum of small efforts repeated day in and day out.', 14),
  ('The grind never stops, but neither does the growth.', 15),
  ('Excellence is not a destination. It''s a continuous journey.', 16),
  ('Discipline is choosing between what you want now and what you want most.', 17),
  ('The pain of discipline weighs ounces. The pain of regret weighs tons.', 18),
  ('Your future self is watching. Make them proud.', 19),
  ('Don''t count the days. Make the days count.', 20),
  ('The harder you work, the luckier you get.', 21),
  ('Success is walking from failure to failure with no loss of enthusiasm.', 22),
  ('The only way to do great work is to love what you do.', 23),
  ('Dreams don''t work unless you do.', 24),
  ('Stop wishing. Start doing.', 25),
  ('The secret to getting ahead is getting started.', 26),
  ('You don''t have to be great to start, but you have to start to be great.', 27),
  ('The best time to plant a tree was 20 years ago. The second best time is now.', 28),
  ('Focus on being productive instead of busy.', 29),
  ('Quality is not an act. It is a habit.', 30),
  ('The only impossible journey is the one you never begin.', 31),
  ('Your limitation is only your imagination.', 32),
  ('Great things never come from comfort zones.', 33),
  ('Success doesn''t just find you. You have to go out and get it.', 34),
  ('The harder you work for something, the greater you''ll feel when you achieve it.', 35),
  ('Dream bigger. Do bigger.', 36),
  ('Don''t stop when you''re tired. Stop when you''re done.', 37),
  ('Wake up with determination. Go to bed with satisfaction.', 38),
  ('Do something today that your future self will thank you for.', 39),
  ('Little things make big days.', 40),
  ('It''s going to be hard, but hard does not mean impossible.', 41),
  ('Don''t wait for opportunity. Create it.', 42),
  ('Sometimes we''re tested not to show our weaknesses, but to discover our strengths.', 43),
  ('The key to success is to focus on goals, not obstacles.', 44),
  ('Dream it. Believe it. Build it.', 45),
  ('Success is not how high you have climbed, but how you make a positive difference to the world.', 46),
  ('Work until your idols become your rivals.', 47),
  ('The difference between ordinary and extraordinary is that little extra.', 48),
  ('You are never too old to set another goal or to dream a new dream.', 49),
  ('Try not to become a person of success, but rather a person of value.', 50),
  ('Be so good they can''t ignore you.', 51),
  ('Invest in yourself. It pays the best interest.', 52),
  ('The expert in anything was once a beginner.', 53),
  ('Every accomplishment starts with the decision to try.', 54),
  ('Your potential is endless.', 55),
  ('The time is now. Start today.', 56),
  ('Action is the foundational key to all success.', 57),
  ('Don''t be afraid to give up the good to go for the great.', 58),
  ('I find that the harder I work, the more luck I seem to have.', 59),
  ('Success is liking yourself, liking what you do, and liking how you do it.', 60),
  ('If you''re offered a seat on a rocket ship, don''t ask what seat. Just get on.', 61),
  ('Opportunities don''t happen. You create them.', 62),
  ('Don''t be upset by the results you didn''t get with the work you didn''t do.', 63),
  ('Work hard in silence. Let success make the noise.', 64),
  ('The only place where success comes before work is in the dictionary.', 65),
  ('Success is not final, failure is not fatal: it is the courage to continue that counts.', 66),
  ('The way to get started is to quit talking and begin doing.', 67),
  ('If you really look closely, most overnight successes took a long time.', 68),
  ('The real test is not whether you avoid failure, because you won''t. It''s whether you let it harden or shame you into inaction, or whether you learn from it.', 69),
  ('It is not the strongest of the species that survive, nor the most intelligent, but the one most responsive to change.', 70),
  ('The successful warrior is the average man, with laser-like focus.', 71),
  ('Develop success from failures. Discouragement and failure are two of the surest stepping stones to success.', 72),
  ('Strive not to be a success, but rather to be of value.', 73),
  ('I owe my success to having listened respectfully to the very best advice, and then going away and doing the exact opposite.', 74),
  ('Success usually comes to those who are too busy to be looking for it.', 75),
  ('If you really want to do something, you''ll find a way. If you don''t, you''ll find an excuse.', 76),
  ('The function of leadership is to produce more leaders, not more followers.', 77),
  ('Success is stumbling from failure to failure with no loss of enthusiasm.', 78),
  ('What seems to us as bitter trials are often blessings in disguise.', 79),
  ('You miss 100% of the shots you don''t take.', 80),
  ('Every strike brings me closer to the next home run.', 81),
  ('Definiteness of purpose is the starting point of all achievement.', 82),
  ('We become what we think about most of the time.', 83),
  ('The mind is everything. What you think you become.', 84),
  ('The best revenge is massive success.', 85),
  ('I have not failed. I''ve just found 10,000 ways that won''t work.', 86),
  ('A successful man is one who can lay a firm foundation with the bricks others have thrown at him.', 87),
  ('No one can make you feel inferior without your consent.', 88),
  ('Limit your ''always'' and your ''nevers.''', 89),
  ('Nothing is impossible. The word itself says ''I''m possible!''', 90),
  ('The only person you are destined to become is the person you decide to be.', 91),
  ('Believe you can and you''re halfway there.', 92),
  ('Too many of us are not living our dreams because we are living our fears.', 93),
  ('I didn''t fail the test. I just found 100 ways to do it wrong.', 94),
  ('In order to succeed, we must first believe that we can.', 95),
  ('The only limit to our realization of tomorrow will be our doubts of today.', 96),
  ('What you get by achieving your goals is not as important as what you become by achieving your goals.', 97),
  ('You learn more from failure than from success. Don''t let it stop you. Failure builds character.', 98),
  ('If you are working on something that you really care about, you don''t have to be pushed. The vision pulls you.', 99),
  ('People who are crazy enough to think they can change the world, are the ones who do.', 100)
ON CONFLICT DO NOTHING;