import { useEffect, useState, useCallback } from 'react';
import { db } from '../lib/database';
import { undoManager } from '../lib/undoManager';
import { WorkSession, DayData, HabitEntry } from '../types';
import MonthOverview from './MonthOverview';
import HabitMonthView from './HabitMonthView';
import HabitScheduleModal from './HabitScheduleModal';
import MotivationalQuote from './MotivationalQuote';
import DaySummary from './DaySummary';
import TimelineGraph from './TimelineGraph';
import ControlsPanel from './ControlsPanel';
import MilestoneQuote from './MilestoneQuote';
import { Undo2, Redo2, ChevronRight, ChevronLeft, Settings, X } from 'lucide-react';

interface TrackTabProps {
  currentMonth: Date;
}

export default function TrackTab({ currentMonth }: TrackTabProps) {
  const [monthData, setMonthData] = useState<DayData[]>([]);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());
  const [workedHours, setWorkedHours] = useState(0);
  const [milestoneQuote, setMilestoneQuote] = useState<string>('');
  const [showQuote, setShowQuote] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [habitMap, setHabitMap] = useState<Map<string, HabitEntry>>(new Map());
  const [currentHabit, setCurrentHabit] = useState<HabitEntry | null>(null);
  const [habitViewOpen, setHabitViewOpen] = useState(false);
  const [habitSchedules, setHabitSchedules] = useState<Record<string, number[]>>({});
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  const currentDayString = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;

  const showFeedback = useCallback((type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setFeedbackVisible(true);
    setTimeout(() => setFeedbackVisible(false), 2500);
    setTimeout(() => setFeedback(null), 3000);
  }, []);

  useEffect(() => {
    loadMonthData();
    loadSessions();
    loadHabitData();
    loadHabitSchedules();
    updateUndoRedoState();
  }, [currentMonth]);

  useEffect(() => {
    loadSessions();
    loadCurrentHabit();
    updateUndoRedoState();
  }, [selectedDay]);

  const handleUndo = useCallback(async () => {
    if (!undoManager.canUndo()) return;
    if (await undoManager.undo()) {
      await loadSessions();
      await loadMonthData();
      updateUndoRedoState();
      showFeedback('success', 'Undone');
    }
  }, [currentDayString]);

  const handleRedo = useCallback(async () => {
    if (!undoManager.canRedo()) return;
    if (await undoManager.redo()) {
      await loadSessions();
      await loadMonthData();
      updateUndoRedoState();
      showFeedback('success', 'Redone');
    }
  }, [currentDayString]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (isMod && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      } else if (isMod && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const updateUndoRedoState = () => {
    setCanUndo(undoManager.canUndo());
    setCanRedo(undoManager.canRedo());
  };

  const loadHabitSchedules = async () => {
    try {
      const entries = await db.habitSchedules.getAll();
      const map: Record<string, number[]> = {};
      entries.forEach(e => { map[e.habit_key] = e.active_days; });
      setHabitSchedules(map);
    } catch {
      // Table might not exist yet
    }
  };

  const handleScheduleUpdate = async (habitKey: string, activeDays: number[]) => {
    try {
      await db.habitSchedules.upsert(habitKey, activeDays);
      setHabitSchedules(prev => ({ ...prev, [habitKey]: activeDays }));
    } catch (err) {
      console.error('Error updating schedule:', err);
    }
  };

  const loadHabitData = async () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${daysInMonth}`;

    try {
      const entries = await db.habits.getByDateRange(startDate, endDate);
      const map = new Map(entries.map(e => [e.date, e]));
      setHabitMap(map);
      setCurrentHabit(map.get(currentDayString) || null);
    } catch {
      // Table might not exist yet
    }
  };

  const loadCurrentHabit = async () => {
    try {
      const entry = await db.habits.getByDate(currentDayString);
      setCurrentHabit(entry);
    } catch {
      // Table might not exist yet
    }
  };

  const handleHabitToggle = async (field: keyof HabitEntry) => {
    try {
      const current = currentHabit;
      const newValue = !(current?.[field] || false);
      const updated = await db.habits.upsert({
        date: currentDayString,
        [field]: newValue,
        ...(current ? {} : {
          prayer_fajr: false,
          prayer_dhuhr: false,
          prayer_asr: false,
          prayer_maghrib: false,
          prayer_isha: false,
          gym: false,
          outreach: false,
          learn: false,
        }),
        [field]: newValue,
      });
      setCurrentHabit(updated);
      setHabitMap(prev => new Map(prev).set(currentDayString, updated));
    } catch (err) {
      console.error('Error toggling habit:', err);
    }
  };

  const loadMonthData = async () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${daysInMonth}`;

    const summaries = await db.summaries.getByDateRange(startDate, endDate);
    const summaryMap = new Map(
      summaries.map((s) => [new Date(s.date).getDate(), s.total_hours])
    );

    const data: DayData[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const hours = summaryMap.get(day) || 0;
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      let color = 'gray';
      if (hours > 0) {
        if (hours >= 10) color = 'bright-green';
        else if (hours >= 8) color = 'green';
        else if (hours >= 5) color = 'yellow';
        else color = 'red';
      }

      data.push({ day, hours, color, date: dateStr });
    }

    setMonthData(data);
  };

  const loadSessions = async () => {
    const data = await db.sessions.getByDate(currentDayString);

    if (data.length > 0) {
      const sorted = data.sort((a, b) => a.start_time - b.start_time);
      setSessions(sorted);
      const total = sorted.reduce(
        (sum, session) => sum + (session.end_time - session.start_time),
        0
      );
      setWorkedHours(total);
      checkMilestone(total);
    } else {
      setSessions([]);
      setWorkedHours(0);
    }
  };

  const checkMilestone = async (hours: number) => {
    const milestones = [3, 6, 8, 10, 13];
    const previousHours = workedHours;

    for (const milestone of milestones) {
      if (previousHours < milestone && hours >= milestone) {
        const randomQuote = await db.quotes.getRandom();
        setMilestoneQuote(randomQuote);
        setShowQuote(true);
        setTimeout(() => setShowQuote(false), 10000);
        break;
      }
    }
  };

  const handleAddSession = async (sessionData: {
    start_time: number;
    end_time: number;
    label: string;
    color: string;
  }) => {
    setIsAdding(true);

    try {
      const newSession = await db.sessions.add({
        date: currentDayString,
        ...sessionData,
      });

      undoManager.addToUndoHistory({
        type: 'add_session',
        sessionData: newSession,
        timestamp: Date.now(),
      });

      const allSessionsForDay = await db.sessions.getByDate(currentDayString);
      const newTotal = allSessionsForDay.reduce(
        (sum, session) => sum + (session.end_time - session.start_time),
        0
      );

      await db.summaries.upsert({
        date: currentDayString,
        total_hours: newTotal,
      });

      showFeedback('success', 'Session added');

      await loadSessions();
      await loadMonthData();
      updateUndoRedoState();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Error adding session:', err);
      showFeedback('error', message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const sessionToDelete = sessions.find((s) => s.id === sessionId);
      if (!sessionToDelete) return;

      undoManager.addToUndoHistory({
        type: 'delete_session',
        sessionData: sessionToDelete,
        timestamp: Date.now(),
      });

      await db.sessions.delete(sessionId);

      const allSessionsForDay = await db.sessions.getByDate(currentDayString);
      const newTotal = allSessionsForDay.reduce(
        (sum, session) => sum + (session.end_time - session.start_time),
        0
      );

      await db.summaries.upsert({
        date: currentDayString,
        total_hours: newTotal,
      });

      showFeedback('success', 'Session deleted');

      await loadSessions();
      await loadMonthData();
      updateUndoRedoState();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Error deleting session:', err);
      showFeedback('error', message);
    }
  };

  const todayDay = new Date().getDate();

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Toast notification */}
      {feedback && (
        <div className={`fixed bottom-6 right-6 z-[60] ${feedbackVisible ? 'animate-toast-in' : 'opacity-0 pointer-events-none'} transition-opacity duration-300`}>
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}>
            {feedback.message}
            <button onClick={() => setFeedbackVisible(false)} className="opacity-70 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Undo/Redo — compact inline */}
      {(canUndo || canRedo) && (
        <div className="flex gap-2 justify-end">
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-200 hover:bg-stone-300 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm font-medium ink-text transition-colors paper-border"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
            <span className="hidden sm:inline">Undo</span>
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-200 hover:bg-stone-300 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm font-medium ink-text transition-colors paper-border"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
            <span className="hidden sm:inline">Redo</span>
          </button>
        </div>
      )}

      <div className="relative">
        <MonthOverview
          monthData={monthData}
          selectedDay={selectedDay}
          onDayClick={setSelectedDay}
          todayDay={todayDay}
          currentMonth={currentMonth}
          habitData={habitMap}
          currentHabit={currentHabit}
          onHabitToggle={handleHabitToggle}
          habitSchedules={habitSchedules}
        />

        {/* Buttons pinned to right edge */}
        <div className="absolute top-2 -right-1 sm:top-1/2 sm:-translate-y-1/2 sm:-right-5 z-20 flex flex-col gap-2">
          <button
            onClick={() => setHabitViewOpen(!habitViewOpen)}
            className={`
              w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center
              transition-all duration-300 shadow-lg
              ${habitViewOpen
                ? 'bg-amber-700 hover:bg-amber-800 text-white'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
              }
            `}
          >
            {habitViewOpen
              ? <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              : <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            }
          </button>
          <button
            onClick={() => setScheduleModalOpen(true)}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg bg-stone-600 hover:bg-stone-700 text-white"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Overlay on top of calendar */}
        {habitViewOpen && (
          <div
            className="absolute inset-0 z-10 rounded-2xl overflow-hidden"
            style={{ animation: 'habitOverlayIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <HabitMonthView currentMonth={currentMonth} habitData={habitMap} habitSchedules={habitSchedules} />
            <style>{`
              @keyframes habitOverlayIn {
                from { opacity: 0; transform: translateX(30px); }
                to { opacity: 1; transform: translateX(0); }
              }
            `}</style>
          </div>
        )}
      </div>

      <MotivationalQuote workedHours={workedHours} />

      <DaySummary workedHours={workedHours} targetHours={10} />

      <TimelineGraph
        sessions={sessions}
        currentDay={currentDayString}
        onDeleteSession={handleDeleteSession}
      />

      <ControlsPanel onAddSession={handleAddSession} isLoading={isAdding} sessions={sessions} currentDay={currentDayString} />

      <MilestoneQuote quote={milestoneQuote} show={showQuote} />

      {scheduleModalOpen && (
        <HabitScheduleModal
          schedules={habitSchedules}
          onUpdate={handleScheduleUpdate}
          onClose={() => setScheduleModalOpen(false)}
        />
      )}
    </div>
  );
}
