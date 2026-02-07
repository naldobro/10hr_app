import { useEffect, useState } from 'react';
import { WorkSession } from '../types';

interface TimelineGraphProps {
  sessions: WorkSession[];
  currentDay: string;
  onDeleteSession: (sessionId: string) => void;
}

export default function TimelineGraph({ sessions, currentDay, onDeleteSession }: TimelineGraphProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const getCurrentHour = () => {
    return currentTime.getHours() + currentTime.getMinutes() / 60;
  };

  const getBlockColor = (color: string) => {
    const colors: Record<string, string> = {
      blue: '#1e40af',
      green: '#059669',
      purple: '#7c3aed',
      orange: '#d97706',
      pink: '#db2777',
      teal: '#0f766e',
    };
    return colors[color] || '#1e40af';
  };

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

  const timelineHeight = Math.max(400, todaySessions.length * 90 + 50);

  return (
    <div className="paper-card rounded-2xl paper-shadow p-6 paper-border">
      <h3 className="text-lg font-bold ink-text mb-4">Timeline</h3>

      <div className="relative bg-amber-50/30 rounded-xl p-4 paper-border" style={{ height: `${timelineHeight}px` }}>
        {hourMarkers.map((hour) => (
          <div
            key={hour}
            className="absolute top-0 bottom-0 border-l border-stone-300"
            style={{
              left: `${(hour / 24) * 100}%`,
              opacity: hour % 3 === 0 ? 1 : 0.3,
            }}
          >
            <span className="absolute -bottom-6 -translate-x-1/2 text-xs font-semibold ink-text-muted">
              {String(hour).padStart(2, '0')}:00
            </span>
          </div>
        ))}

        <div className="relative h-full flex flex-col justify-center gap-3 py-8">
          {todaySessions.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="ink-text-muted text-sm italic">No work sessions logged for this day yet</p>
            </div>
          )}
          {todaySessions.map((session, index) => {
            const startPercent = (session.start_time / 24) * 100;
            const duration = session.end_time - session.start_time;
            const widthPercent = (duration / 24) * 100;

            const isShort = duration < 1;
            const minWidth = isShort ? 120 : 0;

            return (
              <div
                key={session.id}
                className="absolute h-16 rounded-lg paper-shadow transition-all hover:scale-105 hover:shadow-xl group"
                style={{
                  left: `${startPercent}%`,
                  width: `max(${widthPercent}%, ${minWidth}px)`,
                  top: `${20 + index * 70}px`,
                  backgroundColor: getBlockColor(session.color),
                  maxHeight: '64px',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-lg"></div>

                <div className="relative h-full flex items-center justify-between px-3 gap-2 min-w-min">
                  <div className="flex flex-col flex-shrink-0">
                    <span className="text-white font-bold text-xs sm:text-sm drop-shadow-md line-clamp-1">
                      {session.label}
                    </span>
                    <span className="text-white/90 text-xs font-medium">
                      {formatHour(session.start_time)} - {formatHour(session.end_time)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-white font-bold text-xs bg-white/20 px-1.5 py-0.5 rounded">
                      {duration.toFixed(1)}h
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(session.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white px-1.5 py-0.5 rounded text-xs font-bold flex-shrink-0"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/30 rounded-l-lg"></div>
                <div className="absolute right-0 top-0 bottom-0 w-1 bg-black/20 rounded-r-lg"></div>
              </div>
            );
          })}
        </div>

        {isToday && (
          <div
            className="absolute top-0 bottom-0 w-1 bg-amber-700 z-50 animate-pulse shadow-lg"
            style={{
              left: `${(getCurrentHour() / 24) * 100}%`,
            }}
          >
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-amber-700 rounded-full"></div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-amber-700 rounded-full"></div>
          </div>
        )}
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="paper-card rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl paper-border">
            <h3 className="text-2xl font-bold mb-4 ink-text">Delete Session</h3>
            <p className="ink-text-muted mb-6">
              Are you sure you want to delete this session? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelDelete}
                className="flex-1 px-4 py-3 bg-stone-200 hover:bg-stone-300 rounded-lg font-semibold ink-text transition-colors paper-border"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 rounded-lg font-semibold text-white transition-colors paper-shadow"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
