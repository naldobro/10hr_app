import { X } from 'lucide-react';

interface ScheduleMap {
  [habitKey: string]: number[];
}

interface HabitScheduleModalProps {
  schedules: ScheduleMap;
  onUpdate: (habitKey: string, activeDays: number[]) => void;
  onClose: () => void;
}

const HABITS = [
  { key: 'prayer', label: 'Prayer', icon: '🕌' },
  { key: 'gym', label: 'Gym', icon: '💪' },
  { key: 'outreach', label: 'Outreach', icon: '📨' },
  { key: 'learn', label: 'Learn', icon: '📖' },
];

const DAYS = [
  { index: 0, short: 'S', label: 'Sun' },
  { index: 1, short: 'M', label: 'Mon' },
  { index: 2, short: 'T', label: 'Tue' },
  { index: 3, short: 'W', label: 'Wed' },
  { index: 4, short: 'T', label: 'Thu' },
  { index: 5, short: 'F', label: 'Fri' },
  { index: 6, short: 'S', label: 'Sat' },
];

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export default function HabitScheduleModal({ schedules, onUpdate, onClose }: HabitScheduleModalProps) {
  const getActiveDays = (habitKey: string): number[] => {
    return schedules[habitKey] || ALL_DAYS;
  };

  const toggleDay = (habitKey: string, dayIndex: number) => {
    const current = getActiveDays(habitKey);
    const newDays = current.includes(dayIndex)
      ? current.filter(d => d !== dayIndex)
      : [...current, dayIndex].sort();
    onUpdate(habitKey, newDays);
  };

  const setAllDays = (habitKey: string) => {
    onUpdate(habitKey, ALL_DAYS);
  };

  const setWeekdays = (habitKey: string) => {
    onUpdate(habitKey, [1, 2, 3, 4, 5]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg paper-card rounded-2xl paper-shadow paper-border overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'modalIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-xl font-bold ink-text">Habit Schedule</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-stone-200 transition-colors"
          >
            <X className="w-5 h-5 ink-text-muted" />
          </button>
        </div>

        <p className="px-6 text-sm ink-text-muted mb-4">
          Choose which days each habit is active. Off-days won't count toward your score.
        </p>

        <div className="px-6 pb-6 space-y-4">
          {HABITS.map(({ key, label, icon }) => {
            const activeDays = getActiveDays(key);
            const activeCount = activeDays.length;

            return (
              <div key={key} className="p-4 rounded-xl bg-stone-100 border border-stone-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{icon}</span>
                    <span className="font-bold ink-text">{label}</span>
                    <span className="text-xs ink-text-muted ml-1">
                      {activeCount === 7 ? 'Daily' : `${activeCount} days/week`}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setAllDays(key)}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md transition-colors ${
                        activeCount === 7 ? 'bg-amber-600 text-white' : 'bg-stone-200 ink-text-muted hover:bg-stone-300'
                      }`}
                    >
                      Daily
                    </button>
                    <button
                      onClick={() => setWeekdays(key)}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md transition-colors ${
                        activeCount === 5 && !activeDays.includes(0) && !activeDays.includes(6)
                          ? 'bg-amber-600 text-white'
                          : 'bg-stone-200 ink-text-muted hover:bg-stone-300'
                      }`}
                    >
                      Weekdays
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  {DAYS.map(({ index, short, label: dayLabel }) => {
                    const isActive = activeDays.includes(index);
                    return (
                      <button
                        key={index}
                        onClick={() => toggleDay(key, index)}
                        title={dayLabel}
                        className={`
                          flex-1 aspect-square rounded-xl font-bold text-sm transition-all duration-200
                          ${isActive
                            ? 'bg-amber-600 text-white shadow-md hover:bg-amber-700'
                            : 'bg-stone-200 ink-text-muted hover:bg-stone-300'
                          }
                        `}
                      >
                        {short}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <style>{`
          @keyframes modalIn {
            from { opacity: 0; transform: scale(0.95) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}
