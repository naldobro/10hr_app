CREATE TABLE IF NOT EXISTS habit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'single-user',
  date text NOT NULL,
  prayer_fajr boolean DEFAULT false,
  prayer_dhuhr boolean DEFAULT false,
  prayer_asr boolean DEFAULT false,
  prayer_maghrib boolean DEFAULT false,
  prayer_isha boolean DEFAULT false,
  gym boolean DEFAULT false,
  outreach boolean DEFAULT false,
  learn boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS habit_entries_date_idx ON habit_entries(date);
CREATE INDEX IF NOT EXISTS habit_entries_user_date_idx ON habit_entries(user_id, date);

ALTER TABLE habit_entries DISABLE ROW LEVEL SECURITY;
