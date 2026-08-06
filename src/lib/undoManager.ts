import { WorkSession, VisionGoal } from '../types';
import { db } from './database';

type UndoAction =
  | { type: 'add_session' | 'delete_session'; sessionData: WorkSession; timestamp: number }
  | { type: 'vision_add'; row: VisionGoal; timestamp: number }
  | { type: 'vision_delete'; row: VisionGoal; timestamp: number }
  | { type: 'vision_update'; before: VisionGoal; after: VisionGoal; timestamp: number };

const visionFields = (g: VisionGoal) => ({
  kind: g.kind,
  goal_id: g.goal_id,
  title: g.title,
  target: g.target,
  note: g.note,
  color: g.color,
  deadline: g.deadline,
  done: g.done,
  sort_order: g.sort_order,
});

const UNDO_STORAGE_KEY = 'undo_history';
const REDO_STORAGE_KEY = 'redo_history';
const MAX_HISTORY = 20;

export const undoManager = {
  getUndoHistory: (): UndoAction[] => {
    const data = localStorage.getItem(UNDO_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  getRedoHistory: (): UndoAction[] => {
    const data = localStorage.getItem(REDO_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  addToUndoHistory: (action: UndoAction): void => {
    const history = undoManager.getUndoHistory();
    history.push(action);
    if (history.length > MAX_HISTORY) {
      history.shift();
    }
    localStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(history));
    localStorage.setItem(REDO_STORAGE_KEY, JSON.stringify([]));
  },

  undo: async (): Promise<boolean> => {
    const undoHistory = undoManager.getUndoHistory();
    if (undoHistory.length === 0) return false;

    const action = undoHistory.pop()!;
    localStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(undoHistory));

    if (action.type === 'add_session') {
      await db.sessions.delete(action.sessionData.id);
      await undoManager.recalculateSummary(action.sessionData.date);
    } else if (action.type === 'delete_session') {
      const restored = await db.sessions.add({
        date: action.sessionData.date,
        start_time: action.sessionData.start_time,
        end_time: action.sessionData.end_time,
        label: action.sessionData.label,
        color: action.sessionData.color,
      });
      action.sessionData = restored;
      await undoManager.recalculateSummary(action.sessionData.date);
    } else if (action.type === 'vision_add') {
      await db.visionGoals.delete(action.row.id);
    } else if (action.type === 'vision_delete') {
      await db.visionGoals.restore(action.row);
    } else if (action.type === 'vision_update') {
      await db.visionGoals.update(action.before.id, visionFields(action.before));
    }

    const redoHistory = undoManager.getRedoHistory();
    redoHistory.push(action);
    localStorage.setItem(REDO_STORAGE_KEY, JSON.stringify(redoHistory));

    return true;
  },

  redo: async (): Promise<boolean> => {
    const redoHistory = undoManager.getRedoHistory();
    if (redoHistory.length === 0) return false;

    const action = redoHistory.pop()!;
    localStorage.setItem(REDO_STORAGE_KEY, JSON.stringify(redoHistory));

    if (action.type === 'add_session') {
      const restored = await db.sessions.add({
        date: action.sessionData.date,
        start_time: action.sessionData.start_time,
        end_time: action.sessionData.end_time,
        label: action.sessionData.label,
        color: action.sessionData.color,
      });
      action.sessionData = restored;
      await undoManager.recalculateSummary(action.sessionData.date);
    } else if (action.type === 'delete_session') {
      await db.sessions.delete(action.sessionData.id);
      await undoManager.recalculateSummary(action.sessionData.date);
    } else if (action.type === 'vision_add') {
      await db.visionGoals.restore(action.row);
    } else if (action.type === 'vision_delete') {
      await db.visionGoals.delete(action.row.id);
    } else if (action.type === 'vision_update') {
      await db.visionGoals.update(action.after.id, visionFields(action.after));
    }

    const undoHistory = undoManager.getUndoHistory();
    undoHistory.push(action);
    localStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(undoHistory));

    return true;
  },

  recalculateSummary: async (date: string): Promise<void> => {
    const sessions = await db.sessions.getByDate(date);
    const total = sessions.reduce(
      (sum, session) => sum + (session.end_time - session.start_time),
      0
    );
    await db.summaries.upsert({
      date,
      total_hours: total,
    });
  },

  canUndo: (): boolean => {
    return undoManager.getUndoHistory().length > 0;
  },

  canRedo: (): boolean => {
    return undoManager.getRedoHistory().length > 0;
  },
};
