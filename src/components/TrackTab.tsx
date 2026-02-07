import { useEffect, useState } from 'react';
import { db } from '../lib/database';
import { undoManager } from '../lib/undoManager';
import { WorkSession, DayData } from '../types';
import MonthOverview from './MonthOverview';
import MotivationalQuote from './MotivationalQuote';
import DaySummary from './DaySummary';
import TimelineGraph from './TimelineGraph';
import ControlsPanel from './ControlsPanel';
import MilestoneQuote from './MilestoneQuote';
import { Undo2, Redo2 } from 'lucide-react';

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
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const currentDayString = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;

  useEffect(() => {
    loadMonthData();
    loadSessions();
    updateUndoRedoState();
  }, [currentMonth]);

  useEffect(() => {
    loadSessions();
    updateUndoRedoState();
  }, [selectedDay]);

  const updateUndoRedoState = () => {
    setCanUndo(undoManager.canUndo());
    setCanRedo(undoManager.canRedo());
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
    setFeedback(null);

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

      const newTotal = workedHours + (sessionData.end_time - sessionData.start_time);

      await db.summaries.upsert({
        date: currentDayString,
        total_hours: newTotal,
      });

      setFeedback({ type: 'success', message: 'Session added successfully!' });

      await loadSessions();
      await loadMonthData();
      updateUndoRedoState();

      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Error adding session:', err);
      setFeedback({ type: 'error', message });
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

      setFeedback({ type: 'success', message: 'Session deleted successfully!' });

      await loadSessions();
      await loadMonthData();
      updateUndoRedoState();

      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Error deleting session:', err);
      setFeedback({ type: 'error', message });
    }
  };

  const handleUndo = async () => {
    if (await undoManager.undo()) {
      await loadSessions();
      await loadMonthData();
      updateUndoRedoState();
      setFeedback({ type: 'success', message: 'Action undone!' });
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleRedo = async () => {
    if (await undoManager.redo()) {
      await loadSessions();
      await loadMonthData();
      updateUndoRedoState();
      setFeedback({ type: 'success', message: 'Action redone!' });
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const todayDay = new Date().getDate();

  return (
    <div className="space-y-6">
      {feedback && (
        <div className={`p-4 rounded-lg text-sm font-medium animate-in fade-in ${
          feedback.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <div className="font-semibold mb-1">
            {feedback.type === 'success' ? 'Success!' : 'Error'}
          </div>
          {feedback.message}
        </div>
      )}

      <div className="flex gap-3 justify-center">
        <button
          onClick={handleUndo}
          disabled={!canUndo}
          className="flex items-center gap-2 px-6 py-3 bg-stone-200 hover:bg-stone-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold ink-text transition-colors paper-border paper-shadow"
        >
          <Undo2 className="w-5 h-5" />
          Undo
        </button>
        <button
          onClick={handleRedo}
          disabled={!canRedo}
          className="flex items-center gap-2 px-6 py-3 bg-stone-200 hover:bg-stone-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold ink-text transition-colors paper-border paper-shadow"
        >
          <Redo2 className="w-5 h-5" />
          Redo
        </button>
      </div>

      <MonthOverview
        monthData={monthData}
        selectedDay={selectedDay}
        onDayClick={setSelectedDay}
        todayDay={todayDay}
        currentMonth={currentMonth}
      />

      <MotivationalQuote workedHours={workedHours} />

      <DaySummary workedHours={workedHours} targetHours={10} />

      <TimelineGraph
        sessions={sessions}
        currentDay={currentDayString}
        onDeleteSession={handleDeleteSession}
      />

      <ControlsPanel onAddSession={handleAddSession} isLoading={isAdding} />

      <MilestoneQuote quote={milestoneQuote} show={showQuote} />
    </div>
  );
}
