import { WorkSession, DailySummary, Goal } from '../types';

const STORAGE_KEYS = {
  SESSIONS: 'work_sessions',
  SUMMARIES: 'daily_summaries',
  GOALS: 'goals',
  QUOTES_SHOWN: 'quotes_shown',
};

export const localDB = {
  sessions: {
    getAll: (): WorkSession[] => {
      const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      return data ? JSON.parse(data) : [];
    },

    getByDate: (date: string): WorkSession[] => {
      const all = localDB.sessions.getAll();
      return all.filter((s) => s.date === date);
    },

    add: (session: Omit<WorkSession, 'id' | 'user_id' | 'created_at'>): WorkSession => {
      const all = localDB.sessions.getAll();
      const newSession: WorkSession = {
        ...session,
        id: `session_${Date.now()}_${Math.random()}`,
        user_id: 'local_user',
        created_at: new Date().toISOString(),
      };
      all.push(newSession);
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(all));
      return newSession;
    },

    delete: (id: string): void => {
      const all = localDB.sessions.getAll();
      const filtered = all.filter((s) => s.id !== id);
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(filtered));
    },
  },

  summaries: {
    getAll: (): DailySummary[] => {
      const data = localStorage.getItem(STORAGE_KEYS.SUMMARIES);
      return data ? JSON.parse(data) : [];
    },

    getByDateRange: (startDate: string, endDate: string): DailySummary[] => {
      const all = localDB.summaries.getAll();
      return all.filter((s) => s.date >= startDate && s.date <= endDate);
    },

    getByDate: (date: string): DailySummary | null => {
      const all = localDB.summaries.getAll();
      return all.find((s) => s.date === date) || null;
    },

    upsert: (summary: { date: string; total_hours: number; milestone_quotes_shown?: string[] }): void => {
      const all = localDB.summaries.getAll();
      const existing = all.findIndex((s) => s.date === summary.date);

      if (existing >= 0) {
        all[existing] = {
          ...all[existing],
          total_hours: summary.total_hours,
          milestone_quotes_shown: summary.milestone_quotes_shown || all[existing].milestone_quotes_shown,
          updated_at: new Date().toISOString(),
        };
      } else {
        all.push({
          id: `summary_${Date.now()}`,
          user_id: 'local_user',
          date: summary.date,
          total_hours: summary.total_hours,
          milestone_quotes_shown: summary.milestone_quotes_shown || [],
          updated_at: new Date().toISOString(),
        });
      }

      localStorage.setItem(STORAGE_KEYS.SUMMARIES, JSON.stringify(all));
    },
  },

  goals: {
    getAll: (): Goal[] => {
      const data = localStorage.getItem(STORAGE_KEYS.GOALS);
      return data ? JSON.parse(data) : [];
    },

    getByMonth: (month: string, type?: 'major' | 'minor'): Goal[] => {
      const all = localDB.goals.getAll();
      return all.filter((g) => g.month === month && (!type || g.type === type));
    },

    add: (goal: Omit<Goal, 'id' | 'user_id' | 'created_at'>): Goal => {
      const all = localDB.goals.getAll();
      const newGoal: Goal = {
        ...goal,
        id: `goal_${Date.now()}_${Math.random()}`,
        user_id: 'local_user',
        created_at: new Date().toISOString(),
      };
      all.push(newGoal);
      localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(all));
      return newGoal;
    },

    update: (id: string, updates: Partial<Goal>): void => {
      const all = localDB.goals.getAll();
      const index = all.findIndex((g) => g.id === id);
      if (index >= 0) {
        all[index] = { ...all[index], ...updates };
        localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(all));
      }
    },

    delete: (id: string): void => {
      const all = localDB.goals.getAll();
      const filtered = all.filter((g) => g.id !== id);
      localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(filtered));
    },

    deleteByMonth: (month: string): void => {
      const all = localDB.goals.getAll();
      const filtered = all.filter((g) => g.month !== month);
      localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(filtered));
    },
  },
};
