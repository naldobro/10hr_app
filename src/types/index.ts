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

export interface GoalStep {
  text: string;
  done: boolean;
}

export interface VisionGoal {
  id: string;
  user_id: string;
  kind: 'goal' | 'milestone';
  goal_id: string | null;
  title: string;
  target: string;
  note: string;
  color: string;
  deadline: string | null;
  done: boolean;
  /** Legacy: no longer used since milestones became their own items. */
  steps?: GoalStep[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface VisionSnapshot {
  id: string;
  user_id: string;
  date: string;
  data: VisionGoal[];
  created_at: string;
}

export interface Emotion {
  id: string;
  text: string;
  color: string;
}

export interface VisionTopic {
  id: string;
  user_id: string;
  title: string;
  color: string;
  emotions: Emotion[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface VisionSettings {
  user_id: string;
  reflections_title: string;
  reflections_subtitle: string;
  /** Free-text "what I'm focusing on right now" note, shown in the Focus card. */
  focus_note: string;
  updated_at: string;
}

export interface VisionDoc {
  id: string;
  user_id: string;
  /** Notebook this doc belongs to. The built-in month-based one is 'Planner'; others are freeform. */
  notebook: string;
  /** Calendar month this doc belongs to, as 'YYYY-MM' (empty for freeform notebooks). */
  month: string;
  title: string;
  /** Top "objectives / to-do" section, rich text (HTML). */
  summary: string;
  /** Main body, rich text (HTML). */
  content: string;
  /** Accent color (hex). */
  color: string;
  sort_order: number;
  /** When set, the doc is in the Trash (soft-deleted) rather than gone. */
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}
