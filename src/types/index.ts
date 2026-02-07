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

export interface Goal {
  id: string;
  user_id: string;
  type: 'major' | 'minor';
  description: string;
  completed: boolean;
  progress_current: number;
  progress_total: number;
  date: string;
  month: string;
  created_at: string;
}

export interface MilestoneQuote {
  id: string;
  quote: string;
  sort_order: number;
}

export interface DayData {
  day: number;
  hours: number;
  color: string;
  date: string;
}
