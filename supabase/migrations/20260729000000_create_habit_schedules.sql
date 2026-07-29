CREATE TABLE IF NOT EXISTS habit_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  habit_key TEXT NOT NULL,
  active_days INTEGER[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, habit_key)
);
