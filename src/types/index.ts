export interface WorkSession {
  id: string;
  user_id: string;
  date: string;
  start_time: number;
  end_time: number;
  label: string;
  color: string;
  created_at: string;
}

export interface DailySummary {
  id: string;
  user_id: string;
  date: string;
  total_hours: number;
  milestone_quotes_shown: string[];
  updated_at: string;
}


export interface HabitEntry {
  id: string;
  user_id: string;
  date: string;
  prayer_fajr: boolean;
  prayer_dhuhr: boolean;
  prayer_asr: boolean;
  prayer_maghrib: boolean;
  prayer_isha: boolean;
  gym: boolean;
  outreach: boolean;
  learn: boolean;
  created_at: string;
  updated_at: string;
}

export interface HabitSchedule {
  id: string;
  user_id: string;
  habit_key: string;
  active_days: number[];
  created_at: string;
  updated_at: string;
}

export interface DayData {
  day: number;
  hours: number;
  color: string;
  date: string;
}
