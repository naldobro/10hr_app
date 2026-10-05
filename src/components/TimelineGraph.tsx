import { useEffect, useState } from 'react';
import { WorkSession } from '../types';
import { MODES, resolveColor, textOn } from '../lib/modes';

interface TimelineGraphProps {
  sessions: WorkSession[];
  currentDay: string;
  onDeleteSession: (sessionId: string) => void;
  onEditSession?: (
    sessionId: string,
    patch: { start_time?: number; end_time?: number; label?: string; color?: string }
  ) => void;
}

// Draft held while an existing block is being edited in the modal.
type EditDraft = { id: string; color: string; label: string; start_time: number; end_time: number };

export default function TimelineGraph({ sessions, currentDay, onDeleteSession, onEditSession }: TimelineGraphProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditDraft | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const getCurrentHour = () => {
    return currentTime.getHours() + currentTime.getMinutes() / 60;
  };

  const getBlockColor = (color: string) => resolveColor(color);

  const formatHour = (hour: number) => {
    return `${String(Math.floor(hour)).padStart(2, '0')}:${String(
      Math.floor((hour % 1) * 60)
    ).padStart(2, '0')}`;
  };

  const todaySessions = sessions.filter((s) => s.date === currentDay);

  const isToday =
    new Date(currentDay).toDateString() === new Date().toDateString();

  const hourMarkers = Array.from({ length: 25 }, (_, i) => i);

  const handleDeleteClick = (sessionId: string) => {
    setSessionToDelete(sessionId);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (sessionToDelete) {
      onDeleteSession(sessionToDelete);
      setShowDeleteModal(false);
      setSessionToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setSessionToDelete(null);
  };

  // --- editing a logged block ---
  const openEdit = (session: WorkSession) => {
    if (!onEditSession) return;
    setEdit({
      id: session.id,
      color: session.color,
      label: session.label,
      start_time: session.start_time,
      end_time: session.end_time,
    });
  };

  // "HH:MM" (what <input type="time"> uses) ⇆ fractional hours.
  const hhmmToHour = (v: string) => {
    const [h, m] = v.split(':').map(Number);
    if (Number.isNaN(h)) return 0;
    return Math.min(24, Math.max(0, h + (m || 0) / 60));
  };
  // <input type="time"> can't show 24:00, so a midnight end is displayed as 23:59.
  // (Only affects the field's display; the stored value stays unless the user edits it.)
  const timeValue = (h: number) => formatHour(Math.min(h, 23 + 59 / 60));

  const editValid = !!edit && edit.end_time > edit.start_time;

  const saveEdit = () => {
    if (!edit || !onEditSession || !editValid) return;
    onEditSession(edit.id, {
      color: edit.color,
      label: edit.label,
      start_time: edit.start_time,
      end_time: edit.end_time,
    });
    setEdit(null);
  };

  const timelineHeight = Math.max(200, todaySessions.length * 80 + 60);

  return (
    <div className="paper-card rounded-2xl paper-shadow p-3 sm:p-4 lg:p-6 paper-border">
      <h3 className="text-base sm:text-lg font-bold ink-text mb-3 sm:mb-4">Timeline</h3>

      <div className="relative bg-amber-50/30 dark:bg-amber-400/10 rounded-xl p-2 sm:p-4 paper-border overflow-x-auto" style={{ minHeight: `${timelineHeight}px` }}>
        <div className="relative min-w-[960px]" style={{ height: `${timelineHeight}px` }}>
          {hourMarkers.map((hour) => (
            <div
              key={hour}
              className="absolute top-0 bottom-0 border-l border-stone-300"
              style={{
                left: `${(hour / 24) * 100}%`,
                opacity: hour % 3 === 0 ? 1 : 0.3,
              }}
            >
              {hour % 3 === 0 && (
                <span className="absolute -bottom-5 -translate-x-1/2 text-[10px] sm:text-xs font-semibold ink-text-muted whitespace-nowrap">
                  {String(hour).padStart(2, '0')}:00
                </span>
              )}
            </div>
          ))}

          <div className="relative h-full flex flex-col justify-center gap-2 sm:gap-3 py-6">
            {todaySessions.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="ink-text-muted text-xs sm:text-sm italic">No sessions logged yet</p>
              </div>
            )}
            {todaySessions.map((session, index) => {
              const startPercent = (session.start_time / 24) * 100;
              const endPercent = (session.end_time / 24) * 100;
              const duration = session.end_time - session.start_time;
              const widthPercent = (duration / 24) * 100;
              const color = getBlockColor(session.color);
              // Bar length is now STRICTLY proportional to duration (with a tiny
              // floor so a seconds-long session is still a visible sliver). The
              // label/time sit BESIDE the bar so text never inflates its width.
              const labelOnLeft = startPercent > 62;

              return (
                <div
                  key={session.id}
                  className="absolute left-0 right-0 h-12 sm:h-14 lg:h-16 group"
                  style={{ top: `${16 + index * 60}px` }}
                >
                  {/* the proportional bar — click to edit (change mode / times) */}
                  <div
                    onClick={() => openEdit(session)}
                    title={onEditSession ? 'Click to edit' : undefined}
                    className={`absolute top-0 bottom-0 rounded-lg paper-shadow transition-transform hover:scale-y-[1.04] ${
                      onEditSession ? 'cursor-pointer' : ''
                    }`}
                    style={{
                      left: `${startPercent}%`,
                      width: `max(${widthPercent}%, 8px)`,
                      backgroundColor: color,
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-lg"></div>
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/30 dark:bg-paper/30 rounded-l-lg"></div>
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-black/20 rounded-r-lg"></div>
                  </div>

                  {/* the label, placed beside the bar (flips to the left near the right edge) */}
                  <div
                    className={`absolute top-0 bottom-0 flex items-center whitespace-nowrap ${labelOnLeft ? 'pr-2 flex-row-reverse' : 'pl-2'}`}
                    style={labelOnLeft ? { right: `${100 - startPercent}%` } : { left: `${endPercent}%` }}
                  >
                    <div
                      onClick={() => openEdit(session)}
                      title={onEditSession ? 'Click to edit' : undefined}
                      className={`flex flex-col leading-tight ${labelOnLeft ? 'items-end' : 'items-start'} ${
                        onEditSession ? 'cursor-pointer' : ''
                      }`}
                    >
                      <span className="ink-text font-bold text-xs sm:text-sm flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }}></span>
                        {session.label}
                      </span>
                      <span className="ink-text-muted text-[10px] sm:text-xs font-medium">
                        {formatHour(session.start_time)}–{formatHour(session.end_time)} · {duration.toFixed(1)}h
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(session.id);
                      }}
                      className={`${labelOnLeft ? 'mr-2' : 'ml-2'} opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white w-5 h-5 rounded flex items-center justify-center text-xs font-bold flex-shrink-0`}
                    >
                      &times;
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {isToday && (
            <div
              className="mode-nowline absolute top-0 bottom-0 w-1 bg-amber-700 z-50 animate-pulse shadow-lg"
              style={{
                left: `${(getCurrentHour() / 24) * 100}%`,
              }}
            >
              <div className="mode-nowline absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-amber-700 rounded-full"></div>
              <div className="mode-nowline absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-amber-700 rounded-full"></div>
            </div>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="paper-card rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl paper-border">
            <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 ink-text">Delete Session</h3>
            <p className="ink-text-muted mb-5 sm:mb-6 text-sm sm:text-base">
              Are you sure you want to delete this session? You can undo this with Ctrl+Z.
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelDelete}
                className="flex-1 px-4 py-2.5 sm:py-3 bg-stone-200 hover:bg-stone-300 rounded-lg font-semibold ink-text transition-colors paper-border text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 sm:py-3 bg-rose-600 hover:bg-rose-700 rounded-lg font-semibold text-white transition-colors paper-shadow text-sm sm:text-base"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {edit && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setEdit(null)}
        >
          <div
            className="paper-card rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-2xl paper-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-1 ink-text">Edit session</h3>
            <p className="ink-text-muted text-sm mb-5">Change its mode, or adjust the time.</p>

            <label className="block text-[11px] font-bold uppercase tracking-wider ink-text-muted mb-2">
              Mode
            </label>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {MODES.map((m) => {
                const active = edit.color === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => setEdit({ ...edit, color: m.key, label: m.label })}
                    className="px-3 py-2.5 rounded-xl text-sm font-semibold transition border text-left"
                    style={
                      active
                        ? { backgroundColor: m.color, color: textOn(m.color), borderColor: m.color }
                        : { borderColor: `${m.color}66`, color: m.color }
                    }
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider ink-text-muted mb-1.5">
                  Start
                </label>
                <input
                  type="time"
                  value={timeValue(edit.start_time)}
                  onChange={(e) => setEdit({ ...edit, start_time: hhmmToHour(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-paper ink-text paper-border outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider ink-text-muted mb-1.5">
                  End
                </label>
                <input
                  type="time"
                  value={timeValue(edit.end_time)}
                  onChange={(e) => setEdit({ ...edit, end_time: hhmmToHour(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-paper ink-text paper-border outline-none"
                />
              </div>
            </div>
            {!editValid && (
              <p className="text-[12px] text-rose-500 mt-2">End time must be after the start time.</p>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEdit(null)}
                className="flex-1 px-4 py-2.5 bg-stone-200 hover:bg-stone-300 rounded-lg font-semibold ink-text transition-colors paper-border"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={!editValid}
                className="flex-1 px-4 py-2.5 bg-stone-800 hover:bg-stone-900 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-semibold text-white transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
