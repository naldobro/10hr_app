import { supabase } from './supabase';
import { WorkSession, DailySummary, Goal } from '../types';

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

  goals: {
    getAll: async (): Promise<Goal[]> => {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    getByMonth: async (month: string, type?: 'major' | 'minor'): Promise<Goal[]> => {
      let query = supabase
        .from('goals')
        .select('*')
        .eq('month', month);

      if (type) {
        query = query.eq('type', type);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    add: async (goal: Omit<Goal, 'id' | 'user_id' | 'created_at'>): Promise<Goal> => {
      const { data, error } = await supabase
        .from('goals')
        .insert([{ ...goal, user_id: SINGLE_USER_ID }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    update: async (id: string, updates: Partial<Goal>): Promise<void> => {
      const { error } = await supabase
        .from('goals')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },

    delete: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },

    deleteByMonth: async (month: string): Promise<void> => {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('month', month);

      if (error) throw error;
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
