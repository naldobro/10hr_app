import { supabase } from './supabase';
import { WorkSession, DailySummary, HabitEntry, HabitSchedule, VisionGoal } from '../types';

const SINGLE_USER_ID = 'single-user';

export const db = {
  sessions: {
    getAll: async (): Promise<WorkSession[]> => {
      const { data, error } = await supabase
        .from('work_sessions')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    getByDate: async (date: string): Promise<WorkSession[]> => {
      const { data, error } = await supabase
        .from('work_sessions')
        .select('*')
        .eq('date', date)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data || [];
    },

    add: async (session: Omit<WorkSession, 'id' | 'user_id' | 'created_at'>): Promise<WorkSession> => {
      const { data, error } = await supabase
        .from('work_sessions')
        .insert([{ ...session, user_id: SINGLE_USER_ID }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    delete: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('work_sessions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },

    getByDateRange: async (startDate: string, endDate: string): Promise<WorkSession[]> => {
      const { data, error } = await supabase
        .from('work_sessions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data || [];
    },

    getById: async (id: string): Promise<WorkSession | null> => {
      const { data, error } = await supabase
        .from('work_sessions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  },

  summaries: {
    getAll: async (): Promise<DailySummary[]> => {
      const { data, error } = await supabase
        .from('daily_summaries')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    getByDateRange: async (startDate: string, endDate: string): Promise<DailySummary[]> => {
      const { data, error } = await supabase
        .from('daily_summaries')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) throw error;
      return data || [];
    },

    getByDate: async (date: string): Promise<DailySummary | null> => {
      const { data, error } = await supabase
        .from('daily_summaries')
        .select('*')
        .eq('date', date)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    upsert: async (summary: { date: string; total_hours: number; milestone_quotes_shown?: string[] }): Promise<void> => {
      const { error } = await supabase
        .from('daily_summaries')
        .upsert({
          user_id: SINGLE_USER_ID,
          date: summary.date,
          total_hours: summary.total_hours,
          milestone_quotes_shown: summary.milestone_quotes_shown || [],
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,date',
        });

      if (error) throw error;
    },
  },

  habits: {
    getByDate: async (date: string): Promise<HabitEntry | null> => {
      const { data, error } = await supabase
        .from('habit_entries')
        .select('*')
        .eq('date', date)
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    getByDateRange: async (startDate: string, endDate: string): Promise<HabitEntry[]> => {
      const { data, error } = await supabase
        .from('habit_entries')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) throw error;
      return data || [];
    },

    upsert: async (entry: Partial<HabitEntry> & { date: string }): Promise<HabitEntry> => {
      const { data, error } = await supabase
        .from('habit_entries')
        .upsert({
          user_id: SINGLE_USER_ID,
          ...entry,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,date',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  },

  habitSchedules: {
    getAll: async (): Promise<HabitSchedule[]> => {
      const { data, error } = await supabase
        .from('habit_schedules')
        .select('*')
        .eq('user_id', SINGLE_USER_ID);

      if (error) throw error;
      return data || [];
    },

    upsert: async (habitKey: string, activeDays: number[]): Promise<HabitSchedule> => {
      const { data, error } = await supabase
        .from('habit_schedules')
        .upsert({
          user_id: SINGLE_USER_ID,
          habit_key: habitKey,
          active_days: activeDays,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,habit_key',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  },

  visionGoals: {
    getAll: async (): Promise<VisionGoal[]> => {
      const { data, error } = await supabase
        .from('vision_goals')
        .select('*')
        .eq('user_id', SINGLE_USER_ID)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data || [];
    },

    add: async (
      goal: Partial<Omit<VisionGoal, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
    ): Promise<VisionGoal> => {
      const { data, error } = await supabase
        .from('vision_goals')
        .insert([{ ...goal, user_id: SINGLE_USER_ID }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    update: async (
      id: string,
      patch: Partial<Omit<VisionGoal, 'id' | 'user_id' | 'created_at'>>
    ): Promise<VisionGoal> => {
      const { data, error } = await supabase
        .from('vision_goals')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    delete: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('vision_goals')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },

    // Re-insert a previously-deleted row keeping its original id (used by undo).
    restore: async (goal: VisionGoal): Promise<VisionGoal> => {
      const { data, error } = await supabase
        .from('vision_goals')
        .insert([
          {
            id: goal.id,
            user_id: SINGLE_USER_ID,
            kind: goal.kind,
            goal_id: goal.goal_id,
            title: goal.title,
            target: goal.target,
            note: goal.note,
            color: goal.color,
            deadline: goal.deadline,
            done: goal.done,
            sort_order: goal.sort_order,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  },

  quotes: {
    getRandom: async (): Promise<string> => {
      const { data, error } = await supabase
        .from('milestone_quotes')
        .select('quote')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) return 'Keep pushing forward!';

      const randomIndex = Math.floor(Math.random() * data.length);
      return data[randomIndex].quote;
    },
  },
};
