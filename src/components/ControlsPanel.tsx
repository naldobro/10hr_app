import { useState, useEffect, useCallback } from 'react';
import { Play, Square, Plus } from 'lucide-react';
import { WorkSession } from '../types';
import { MODES, MODE_MAP, textOn } from '../lib/modes';
import { applyModeGlow } from '../lib/modeGlow';

const TIMER_STORAGE_KEY = 'active_timer';
const MODE_STORAGE_KEY = 'selected_mode';

function formatTimerDisplay(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// fractional hours (9.5) <-> "HH:MM" for the editable time inputs.
function hoursToHHMM(h: number) {
  let hh = Math.floor(h);
  let mm = Math.round((h - hh) * 60);
  if (mm === 60) { hh += 1; mm = 0; }
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function hhmmToHours(str: string) {
  const [h, m] = str.split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
}

// hex + alpha byte → rgba-ish hex (e.g. #2563eb + 'aa'). Assumes 6-digit hex.
function withAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

interface ControlsPanelProps {
  onAddSession: (session: { start_time: number; end_time: number; label: string; color: string }) => void;
  isLoading?: boolean;
  sessions: WorkSession[];
  currentDay: string;
}

export default function ControlsPanel({ onAddSession, isLoading = false, sessions }: ControlsPanelProps) {
  const [selectedMode, setSelectedMode] = useState<string | null>(() =>
    typeof localStorage !== 'undefined' ? localStorage.getItem(MODE_STORAGE_KEY) : null
  );
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Finish review modal — Finish no longer logs directly; it opens this so the
  // session can be confirmed or its time/label edited first.
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [finishMode, setFinishMode] = useState<string>('work');
  const [finishStart, setFinishStart] = useState('09:00');
  const [finishEnd, setFinishEnd] = useState('10:00');
  const [finishLabel, setFinishLabel] = useState('');

  const [manualMode, setManualMode] = useState<string>('work');
  const [manualStart, setManualStart] = useState('09:00');
  const [manualDuration, setManualDuration] = useState(1);
  const [manualLabel, setManualLabel] = useState('');
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  const [customHours, setCustomHours] = useState(0);
  const [customMinutes, setCustomMinutes] = useState(0);

  const activeMode = selectedMode ? MODE_MAP[selectedMode] : null;

  // Only a RUNNING timer tints the app — selecting a mode keeps the default glow.
  // Written to <html> so it persists across tab switches / this unmounting.
  useEffect(() => {
    applyModeGlow(isTimerRunning ? selectedMode : null);
  }, [isTimerRunning, selectedMode]);

  // Restore an in-progress timer (survives reloads), including which mode it belongs to.
  useEffect(() => {
    const saved = localStorage.getItem(TIMER_STORAGE_KEY);
    if (saved) {
      try {
        const { start, mode } = JSON.parse(saved);
        if (start && typeof start === 'number') {
          setTimerStart(start);
          setIsTimerRunning(true);
          setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
          if (mode && MODE_MAP[mode]) setSelectedMode(mode);
        }
      } catch {
        localStorage.removeItem(TIMER_STORAGE_KEY);
      }
    }
  }, []);

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

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && isTimerRunning && timerStart) {
        setElapsedSeconds(Math.floor((Date.now() - timerStart) / 1000));
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isTimerRunning, timerStart]);

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

  const handleSelectMode = (modeKey: string) => {
    // Can't switch baskets mid-session — finish first.
    if (isTimerRunning) return;
    setSelectedMode(modeKey);
    setValidationError('');
    localStorage.setItem(MODE_STORAGE_KEY, modeKey);
  };

  const handleStartTimer = () => {
    if (!selectedMode) {
      setValidationError('Pick a mode first');
      return;
    }
    const now = Date.now();
    setIsTimerRunning(true);
    setTimerStart(now);
    setElapsedSeconds(0);
    setValidationError('');
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify({ start: now, mode: selectedMode }));
  };

  const clearTimerState = () => {
    setIsTimerRunning(false);
    setTimerStart(null);
    setElapsedSeconds(0);
    localStorage.removeItem(TIMER_STORAGE_KEY);
    document.title = '10hr';
  };

  // Finish captures the timed span and opens the review modal (does NOT log yet).
  const handleFinish = () => {
    if (!timerStart || !activeMode) return;

    const startDate = new Date(timerStart);
    const now = new Date();

    let startTime = startDate.getHours() + startDate.getMinutes() / 60 + startDate.getSeconds() / 3600;
    let endTime = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;

    if (toLocalDateStr(startDate) !== toLocalDateStr(now)) {
      startTime = 0;
    }

    if (endTime <= startTime) {
      endTime = startTime + 0.01;
    }

    setFinishMode(selectedMode || 'work');
    setFinishLabel(activeMode.label);
    setFinishStart(hoursToHHMM(startTime));
    setFinishEnd(hoursToHHMM(endTime));
    setValidationError('');
    setShowFinishModal(true);
  };

  const handleConfirmFinish = () => {
    setValidationError('');
    const startTime = hhmmToHours(finishStart);
    const endTime = hhmmToHours(finishEnd);

    if (endTime <= startTime) {
      setValidationError('End time must be after the start time');
      return;
    }

    const mode = MODE_MAP[finishMode];
    const overlap = findOverlap(startTime, endTime);
    if (overlap) {
      setValidationError(`Overlaps with "${overlap.label}" (${formatHour(overlap.start_time)}–${formatHour(overlap.end_time)})`);
      return;
    }

    onAddSession({
      start_time: startTime,
      end_time: endTime,
      label: finishLabel.trim() || mode.label,
      color: mode.key,
    });

    setShowFinishModal(false);
    setValidationError('');
    clearTimerState();
  };

  // Cancel = back out without logging; the timer keeps running so nothing is lost.
  const handleCancelFinish = () => {
    setShowFinishModal(false);
    setValidationError('');
  };

  // Ditch = throw the session away AND reset the timer, ready to start fresh.
  const handleDitchFinish = () => {
    setShowFinishModal(false);
    setValidationError('');
    clearTimerState();
  };

  const openManualModal = () => {
    const seed = selectedMode || 'work';
    setManualMode(seed);
    setManualLabel(MODE_MAP[seed].label);
    setShowModal(true);
  };

  const handleAddManualSession = () => {
    setValidationError('');

    if (!manualStart) {
      setValidationError('Please select a start time');
      return;
    }

    const mode = MODE_MAP[manualMode];
    const label = manualLabel.trim() || mode.label;

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
      label,
      color: mode.key,
    });

    setShowModal(false);
    setManualStart('09:00');
    setManualDuration(1);
    setManualLabel('');
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
      <div className="paper-card rounded-2xl paper-shadow p-3 sm:p-4 lg:p-6 paper-border">
        {/* Mode picker — the five baskets. Pick one, then Start. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-3 sm:mb-4">
          {MODES.map((mode) => {
            const isSelected = selectedMode === mode.key;
            return (
              <button
                key={mode.key}
                onClick={() => handleSelectMode(mode.key)}
                disabled={isTimerRunning && !isSelected}
                className="relative flex items-center justify-center text-center px-2 py-3 sm:py-4 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  color: isSelected ? textOn(mode.color) : mode.color,
                  backgroundColor: isSelected ? mode.color : withAlpha(mode.color, '1f'),
                  boxShadow: isSelected
                    ? `0 0 0 1px ${mode.color}, 0 0 18px -2px ${withAlpha(mode.color, 'bb')}`
                    : `inset 0 0 0 1px ${withAlpha(mode.color, '4d')}`,
                }}
              >
                {mode.label}
              </button>
            );
          })}
        </div>

        {validationError && (
          <div className="mb-3 p-2.5 bg-red-50 dark:bg-red-400/10 text-red-700 dark:text-red-300 rounded-lg border border-red-200 text-sm">
            {validationError}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          {!isTimerRunning ? (
            <button
              onClick={handleStartTimer}
              disabled={isLoading || !selectedMode}
              className="flex-1 flex items-center justify-center gap-2 sm:gap-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-lg transition-colors paper-shadow text-sm sm:text-base"
            >
              <Play className="w-4 h-4 sm:w-5 sm:h-5" />
              {activeMode ? `Start ${activeMode.label}` : 'Start Timer'}
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 sm:gap-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-lg transition-colors paper-shadow text-sm sm:text-base"
            >
              <Square className="w-4 h-4 sm:w-5 sm:h-5" />
              Finish: {formatTimerDisplay(elapsedSeconds)}
            </button>
          )}

          <button
            onClick={openManualModal}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 sm:gap-3 bg-stone-700 hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-lg transition-colors paper-shadow text-sm sm:text-base"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            Add Manually
          </button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="paper-card rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 lg:p-8 max-w-lg w-full shadow-2xl paper-border max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 ink-text">
              Add Manual Session
            </h3>

            {validationError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-400/10 text-red-700 dark:text-red-300 rounded-lg border border-red-200 text-sm">
                {validationError}
              </div>
            )}

            <div className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-sm font-medium ink-text-muted mb-2">
                  Mode
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {MODES.map((mode) => {
                    const isSelected = manualMode === mode.key;
                    return (
                      <button
                        key={mode.key}
                        onClick={() => {
                          // Keep the label in sync unless the user has customised it.
                          setManualLabel((prev) =>
                            prev === MODE_MAP[manualMode].label || prev === '' ? mode.label : prev
                          );
                          setManualMode(mode.key);
                        }}
                        className="px-2 py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-all"
                        style={{
                          color: isSelected ? textOn(mode.color) : mode.color,
                          backgroundColor: isSelected ? mode.color : withAlpha(mode.color, '1f'),
                          boxShadow: isSelected
                            ? `0 0 0 1px ${mode.color}`
                            : `inset 0 0 0 1px ${withAlpha(mode.color, '4d')}`,
                        }}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium ink-text-muted mb-2">
                  Start Time
                </label>
                <input
                  type="time"
                  value={manualStart}
                  onChange={(e) => setManualStart(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 paper-border rounded-lg text-base sm:text-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent ink-text"
                />
              </div>

              <div>
                <label className="block text-sm font-medium ink-text-muted mb-3">
                  Duration
                </label>
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-3">
                  {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].map((duration) => (
                    <button
                      key={duration}
                      onClick={() => {
                        setManualDuration(duration);
                        setUseCustomDuration(false);
                      }}
                      className={`py-2 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-all ${
                        manualDuration === duration && !useCustomDuration
                          ? 'bg-amber-600 text-white paper-shadow'
                          : 'bg-amber-50 dark:bg-amber-400/10 ink-text hover:bg-amber-100 dark:hover:bg-amber-400/20 paper-border'
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
                  placeholder={MODE_MAP[manualMode].label}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 paper-border rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6 sm:mt-8">
              <button
                onClick={() => {
                  setShowModal(false);
                  setValidationError('');
                }}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 sm:py-3 bg-stone-200 hover:bg-stone-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold ink-text transition-colors paper-border text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleAddManualSession}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 sm:py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold text-white transition-colors paper-shadow text-sm sm:text-base"
              >
                {isLoading ? 'Adding...' : 'Add Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFinishModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="paper-card rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 lg:p-8 max-w-md w-full shadow-2xl paper-border max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl sm:text-2xl font-bold mb-1 ink-text">Session complete</h3>
            <p className="text-sm ink-text-muted mb-4 sm:mb-6">Review the details, edit if needed, then add it.</p>

            {validationError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-400/10 text-red-700 dark:text-red-300 rounded-lg border border-red-200 text-sm">
                {validationError}
              </div>
            )}

            <div className="space-y-4 sm:space-y-5">
              <div>
                <label className="block text-sm font-medium ink-text-muted mb-2">Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {MODES.map((mode) => {
                    const isSelected = finishMode === mode.key;
                    return (
                      <button
                        key={mode.key}
                        onClick={() => {
                          setFinishLabel((prev) =>
                            prev === MODE_MAP[finishMode].label || prev === '' ? mode.label : prev
                          );
                          setFinishMode(mode.key);
                        }}
                        className="px-2 py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-all"
                        style={{
                          color: isSelected ? textOn(mode.color) : mode.color,
                          backgroundColor: isSelected ? mode.color : withAlpha(mode.color, '1f'),
                          boxShadow: isSelected
                            ? `0 0 0 1px ${mode.color}`
                            : `inset 0 0 0 1px ${withAlpha(mode.color, '4d')}`,
                        }}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium ink-text-muted mb-2">Start</label>
                  <input
                    type="time"
                    value={finishStart}
                    onChange={(e) => setFinishStart(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 paper-border rounded-lg text-base focus:ring-2 focus:ring-amber-600 focus:border-transparent ink-text"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium ink-text-muted mb-2">End</label>
                  <input
                    type="time"
                    value={finishEnd}
                    onChange={(e) => setFinishEnd(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 paper-border rounded-lg text-base focus:ring-2 focus:ring-amber-600 focus:border-transparent ink-text"
                  />
                </div>
              </div>

              <div className="text-sm ink-text-muted">
                Duration: <span className="font-semibold ink-text">{Math.max(0, hhmmToHours(finishEnd) - hhmmToHours(finishStart)).toFixed(2)}h</span>
              </div>

              <div>
                <label className="block text-sm font-medium ink-text-muted mb-2">Label</label>
                <input
                  type="text"
                  value={finishLabel}
                  onChange={(e) => setFinishLabel(e.target.value)}
                  placeholder={MODE_MAP[finishMode].label}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 paper-border rounded-lg focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-2 sm:gap-3 mt-6 sm:mt-8">
              <button
                onClick={handleDitchFinish}
                disabled={isLoading}
                className="px-3 sm:px-4 py-2.5 sm:py-3 bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors border border-rose-600/30 text-sm sm:text-base"
                title="Discard this session and reset the timer"
              >
                Ditch
              </button>
              <button
                onClick={handleCancelFinish}
                disabled={isLoading}
                className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-stone-200 hover:bg-stone-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold ink-text transition-colors paper-border text-sm sm:text-base"
                title="Keep the timer running"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFinish}
                disabled={isLoading}
                className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold text-white transition-colors paper-shadow text-sm sm:text-base"
              >
                {isLoading ? 'Adding...' : 'Add Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
