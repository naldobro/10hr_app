import { useState, useEffect, useCallback } from 'react';
import { Play, Square, Plus } from 'lucide-react';
import { WorkSession } from '../types';

const TIMER_STORAGE_KEY = 'active_timer';

function formatTimerDisplay(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface ControlsPanelProps {
  onAddSession: (session: { start_time: number; end_time: number; label: string; color: string }) => void;
  isLoading?: boolean;
  sessions: WorkSession[];
  currentDay: string;
}

export default function ControlsPanel({ onAddSession, isLoading = false, sessions, currentDay }: ControlsPanelProps) {
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [showTimerLabelModal, setShowTimerLabelModal] = useState(false);
  const [timerSessionData, setTimerSessionData] = useState<{ start_time: number; end_time: number } | null>(null);
  const [timerLabel, setTimerLabel] = useState('Deep Work');
  const [timerColor, setTimerColor] = useState('blue');
  const [validationError, setValidationError] = useState('');

  const [manualStart, setManualStart] = useState('09:00');
  const [manualDuration, setManualDuration] = useState(1);
  const [manualLabel, setManualLabel] = useState('');
  const [manualColor, setManualColor] = useState('blue');
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  const [customHours, setCustomHours] = useState(0);
  const [customMinutes, setCustomMinutes] = useState(0);

  const colorOptions = [
    { value: 'blue', label: 'Blue', class: 'bg-blue-700' },
    { value: 'green', label: 'Green', class: 'bg-emerald-600' },
    { value: 'purple', label: 'Purple', class: 'bg-violet-700' },
    { value: 'orange', label: 'Orange', class: 'bg-amber-600' },
    { value: 'pink', label: 'Pink', class: 'bg-pink-600' },
    { value: 'teal', label: 'Teal', class: 'bg-teal-700' },
  ];

  // Restore timer from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(TIMER_STORAGE_KEY);
    if (saved) {
      try {
        const { start } = JSON.parse(saved);
        if (start && typeof start === 'number') {
          setTimerStart(start);
          setIsTimerRunning(true);
          setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
        }
      } catch {
        localStorage.removeItem(TIMER_STORAGE_KEY);
      }
    }
  }, []);

  // Timer tick + update tab title
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isTimerRunning && timerStart) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - timerStart) / 1000);
        setElapsedSeconds(elapsed);
        document.title = `${formatTimerDisplay(elapsed)} — 10hr`;
      }, 1000);
    } else {
      document.title = '10hr';
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timerStart]);

  // Snap to correct time when tab becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && isTimerRunning && timerStart) {
        setElapsedSeconds(Math.floor((Date.now() - timerStart) / 1000));
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isTimerRunning, timerStart]);

  // Warn before closing tab with active timer
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isTimerRunning) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isTimerRunning]);

  const findOverlap = useCallback((start: number, end: number) => {
    return sessions.find(s => start < s.end_time && end > s.start_time);
  }, [sessions]);

  const handleStartTimer = () => {
    const now = Date.now();
    setIsTimerRunning(true);
    setTimerStart(now);
    setElapsedSeconds(0);
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify({ start: now }));
  };

  const clearTimerState = () => {
    setIsTimerRunning(false);
    setTimerStart(null);
    setElapsedSeconds(0);
    localStorage.removeItem(TIMER_STORAGE_KEY);
    document.title = '10hr';
  };

  const handleStopTimer = () => {
    if (!timerStart) return;

    const startDate = new Date(timerStart);
    const now = new Date();

    let startTime = startDate.getHours() + startDate.getMinutes() / 60 + startDate.getSeconds() / 3600;
    let endTime = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;

    // If the timer started on a different day, cap start to midnight (0)
    if (toLocalDateStr(startDate) !== toLocalDateStr(now)) {
      startTime = 0;
    }

    if (endTime <= startTime) {
      endTime = startTime + 0.01;
    }

    setTimerSessionData({ start_time: startTime, end_time: endTime });
    setShowTimerLabelModal(true);
  };

  const handleSaveTimerSession = () => {
    if (!timerLabel.trim()) {
      setValidationError('Please enter a label for this session');
      return;
    }

    if (timerSessionData) {
      const overlap = findOverlap(timerSessionData.start_time, timerSessionData.end_time);
      if (overlap) {
        setValidationError(`Overlaps with "${overlap.label}" (${formatHour(overlap.start_time)}–${formatHour(overlap.end_time)})`);
        return;
      }

      onAddSession({
        ...timerSessionData,
        label: timerLabel,
        color: timerColor,
      });

      setShowTimerLabelModal(false);
      setTimerLabel('Deep Work');
      setTimerColor('blue');
      setTimerSessionData(null);
      setValidationError('');
      clearTimerState();
    }
  };

  const handleCancelTimerSession = () => {
    setShowTimerLabelModal(false);
    setTimerLabel('Deep Work');
    setTimerColor('blue');
    setTimerSessionData(null);
    setValidationError('');
    clearTimerState();
  };

  const handleAddManualSession = () => {
    setValidationError('');

    if (!manualStart) {
      setValidationError('Please select a start time');
      return;
    }

    if (!manualLabel.trim()) {
      setValidationError('Please enter a label for this session');
      return;
    }

    const finalDuration = useCustomDuration
      ? customHours + customMinutes / 60
      : manualDuration;

    if (finalDuration <= 0) {
      setValidationError('Duration must be greater than 0');
      return;
    }

    const [startHour, startMin] = manualStart.split(':').map(Number);
    const startTime = startHour + startMin / 60;
    const endTime = startTime + finalDuration;

    if (endTime > 24) {
      setValidationError('Session extends past midnight. Please adjust the start time or duration');
      return;
    }

    const overlap = findOverlap(startTime, endTime);
    if (overlap) {
      setValidationError(`Overlaps with "${overlap.label}" (${formatHour(overlap.start_time)}–${formatHour(overlap.end_time)})`);
      return;
    }

    onAddSession({
      start_time: startTime,
      end_time: endTime,
      label: manualLabel,
      color: manualColor,
    });

    setShowModal(false);
    setManualStart('09:00');
    setManualDuration(1);
    setManualLabel('');
    setManualColor('blue');
    setUseCustomDuration(false);
    setCustomHours(0);
    setCustomMinutes(0);
    setValidationError('');
  };

  const formatHour = (hour: number) => {
    return `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}`;
  };

  return (
    <>
      <div className="paper-card rounded-2xl paper-shadow p-6 paper-border">
        <div className="flex gap-4">
          {!isTimerRunning ? (
            <button
              onClick={handleStartTimer}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-colors paper-shadow"
            >
              <Play className="w-5 h-5" />
              Start Deep Work Timer
            </button>
          ) : (
            <button
              onClick={handleStopTimer}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-colors paper-shadow"
            >
              <Square className="w-5 h-5" />
              Stop Timer: {formatTimerDisplay(elapsedSeconds)}
            </button>
          )}

          <button
            onClick={() => setShowModal(true)}
            disabled={isLoading}
            className="flex items-center justify-center gap-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-colors paper-shadow"
          >
            <Plus className="w-5 h-5" />
            Add Manual Session
          </button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="paper-card rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl paper-border">
            <h3 className="text-2xl font-bold mb-6 ink-text">
              Add Manual Session
            </h3>

            {validationError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm">
                {validationError}
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium ink-text-muted mb-2">
                  Start Time
                </label>
                <input
                  type="time"
                  value={manualStart}
                  onChange={(e) => setManualStart(e.target.value)}
                  className="w-full px-4 py-3 paper-border rounded-lg text-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent ink-text"
                />
              </div>

              <div>
                <label className="block text-sm font-medium ink-text-muted mb-3">
                  Duration
                </label>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].map((duration) => (
                    <button
                      key={duration}
                      onClick={() => {
                        setManualDuration(duration);
                        setUseCustomDuration(false);
                      }}
                      className={`py-3 rounded-lg font-semibold transition-all ${
                        manualDuration === duration && !useCustomDuration
                          ? 'bg-amber-600 text-white paper-shadow'
                          : 'bg-amber-50 ink-text hover:bg-amber-100 paper-border'
                      }`}
                    >
                      {duration}h
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <div className="border-t border-stone-300 pt-3">
                    <label className="flex items-center gap-2 text-sm font-medium ink-text-muted mb-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useCustomDuration}
                        onChange={(e) => setUseCustomDuration(e.target.checked)}
                        className="w-4 h-4 rounded border-stone-300 text-amber-600"
                      />
                      Custom Duration
                    </label>

                    {useCustomDuration && (
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="block text-xs font-medium ink-text-muted mb-1">
                            Hours
                          </label>
                          <input
                            type="number"
                            value={customHours}
                            onChange={(e) => setCustomHours(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full px-3 py-2 paper-border rounded-lg text-sm focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                            min="0"
                            max="24"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-medium ink-text-muted mb-1">
                            Minutes
                          </label>
                          <input
                            type="number"
                            value={customMinutes}
                            onChange={(e) => setCustomMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                            className="w-full px-3 py-2 paper-border rounded-lg text-sm focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                            min="0"
                            max="59"
                          />
                        </div>
                        <span className="text-sm ink-text-muted pb-2">
                          = {(customHours + customMinutes / 60).toFixed(2)}h
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium ink-text-muted mb-2">
                  Label
                </label>
                <input
                  type="text"
                  value={manualLabel}
                  onChange={(e) => setManualLabel(e.target.value)}
                  placeholder="e.g., Outreach, Copywriting"
                  className="w-full px-4 py-3 paper-border rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium ink-text-muted mb-2">
                  Color
                </label>
                <div className="flex gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setManualColor(color.value)}
                      className={`w-12 h-12 rounded-lg ${color.class} ${
                        manualColor === color.value
                          ? 'ring-4 ring-amber-800'
                          : 'opacity-50 hover:opacity-100'
                      } transition-all paper-shadow`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => {
                  setShowModal(false);
                  setValidationError('');
                }}
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-stone-200 hover:bg-stone-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold ink-text transition-colors paper-border"
              >
                Cancel
              </button>
              <button
                onClick={handleAddManualSession}
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold text-white transition-colors paper-shadow"
              >
                {isLoading ? 'Adding...' : 'Add Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTimerLabelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="paper-card rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl paper-border">
            <h3 className="text-2xl font-bold mb-6 ink-text">
              Name Your Session
            </h3>

            {validationError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm">
                {validationError}
              </div>
            )}

            <div className="space-y-5 mb-6">
              <div>
                <label className="block text-sm font-medium ink-text-muted mb-2">
                  Session Label
                </label>
                <input
                  type="text"
                  value={timerLabel}
                  onChange={(e) => {
                    setTimerLabel(e.target.value);
                    setValidationError('');
                  }}
                  placeholder="e.g., Deep Work, Writing, Coding"
                  className="w-full px-4 py-3 paper-border rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveTimerSession();
                    }
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium ink-text-muted mb-2">
                  Color
                </label>
                <div className="flex gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setTimerColor(color.value)}
                      className={`w-10 h-10 rounded-lg ${color.class} ${
                        timerColor === color.value
                          ? 'ring-4 ring-amber-800'
                          : 'opacity-50 hover:opacity-100'
                      } transition-all paper-shadow`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelTimerSession}
                className="flex-1 px-4 py-3 bg-stone-200 hover:bg-stone-300 rounded-lg font-semibold ink-text transition-colors paper-border"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTimerSession}
                className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-700 rounded-lg font-semibold text-white transition-colors paper-shadow"
              >
                Save Session
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
