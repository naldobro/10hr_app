import { useState } from 'react';
import { HabitEntry } from '../types';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';

const HABITS = [
  {
    key: 'prayer' as const,
    label: 'Prayer',
    icon: '🕌',
    getStatus: (h: HabitEntry) => {
      const count = [h.prayer_fajr, h.prayer_dhuhr, h.prayer_asr, h.prayer_maghrib, h.prayer_isha].filter(Boolean).length;
      return count >= 5 ? 'green' : count >= 4 ? 'yellow' : 'off';
    },
    getDetail: (h: HabitEntry) => {
      const count = [h.prayer_fajr, h.prayer_dhuhr, h.prayer_asr, h.prayer_maghrib, h.prayer_isha].filter(Boolean).length;
      return `${count}/5`;
    },
  },
  {
    key: 'gym' as const,
    label: 'Gym',
    icon: '💪',
    getStatus: (h: HabitEntry) => h.gym ? 'green' as const : 'off' as const,
    getDetail: () => '',
  },
  {
    key: 'outreach' as const,
    label: 'Outreach',
    icon: '📨',
    getStatus: (h: HabitEntry) => h.outreach ? 'green' as const : 'off' as const,
    getDetail: () => '',
  },
  {
    key: 'learn' as const,
    label: 'Learn',
    icon: '📖',
    getStatus: (h: HabitEntry) => h.learn ? 'green' as const : 'off' as const,
    getDetail: () => '',
  },
];

interface HabitMonthViewProps {
  currentMonth: Date;
  habitData: Map<string, HabitEntry>;
}

export default function HabitMonthView({ currentMonth, habitData }: HabitMonthViewProps) {
  const [habitIndex, setHabitIndex] = useState(0);
  const habit = HABITS[habitIndex];

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayOfWeekStart = new Date(year, month, 1).getDay();

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = Array(dayOfWeekStart).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const pastDays = isCurrentMonth ? today.getDate() : daysInMonth;

  const doneCount = Array.from({ length: pastDays }, (_, i) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
    const entry = habitData.get(dateStr);
    return entry ? habit.getStatus(entry) !== 'off' : false;
  }).filter(Boolean).length;

  const prevHabit = () => setHabitIndex((habitIndex - 1 + HABITS.length) % HABITS.length);
  const nextHabit = () => setHabitIndex((habitIndex + 1) % HABITS.length);

  return (
    <div className="h-full paper-card paper-border rounded-2xl flex flex-col">
      {/* Header */}
      <div className="px-6 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevHabit} className="p-1.5 rounded-lg hover:bg-amber-100 transition-colors paper-border">
            <ChevronLeft className="w-5 h-5 ink-text-muted" />
          </button>
          <div className="text-center">
            <div className="text-2xl mb-0.5">{habit.icon}</div>
            <h3 className="text-2xl font-bold ink-text">{habit.label}</h3>
            <p className="text-xs font-semibold ink-text-muted mt-0.5">
              {doneCount} of {pastDays} days
            </p>
          </div>
          <button onClick={nextHabit} className="p-1.5 rounded-lg hover:bg-amber-100 transition-colors paper-border">
            <ChevronRight className="w-5 h-5 ink-text-muted" />
          </button>
        </div>

        {/* Streak bar */}
        <div className="flex gap-[2px] mb-2">
          {Array.from({ length: daysInMonth }, (_, i) => {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
            const entry = habitData.get(dateStr);
            const status = entry ? habit.getStatus(entry) : 'off';
            const isFuture = isCurrentMonth && (i + 1) > today.getDate();
            return (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${
                isFuture ? 'bg-stone-200' :
                status === 'green' ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.4)]' :
                status === 'yellow' ? 'bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.4)]' :
                'bg-stone-300/50'
              }`} />
            );
          })}
        </div>

        {/* Tab navigation */}
        <div className="flex justify-center gap-2 mt-2">
          {HABITS.map((h, i) => (
            <button
              key={h.key}
              onClick={() => setHabitIndex(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
                i === habitIndex
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-stone-200 ink-text-muted hover:bg-stone-300 paper-border'
              }`}
            >
              <span>{h.icon}</span>
              <span>{h.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Day grid */}
      <div className="flex-1 px-6 pb-5 flex flex-col">
        <div className="grid grid-cols-7 gap-2 mb-2">
          {dayNames.map((d, i) => (
            <div key={i} className="text-center text-xs font-bold ink-text-muted uppercase tracking-wider">{d}</div>
          ))}
        </div>

        <div className="flex-1 flex flex-col gap-2">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-2 flex-1">
              {week.map((day, di) => {
                if (day === null) return <div key={`e-${di}`} />;

                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const entry = habitData.get(dateStr);
                const status = entry ? habit.getStatus(entry) : 'off';
                const detail = entry ? habit.getDetail(entry) : '';
                const isFuture = isCurrentMonth && day > today.getDate();
                const isToday = isCurrentMonth && day === today.getDate();

                return (
                  <div
                    key={day}
                    className={`
                      rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all
                      ${isFuture ? 'bg-stone-200/50' :
                        status === 'green' ? 'bg-emerald-100 border-2 border-emerald-400' :
                        status === 'yellow' ? 'bg-amber-100 border-2 border-amber-400' :
                        'bg-stone-200/70 paper-border'
                      }
                      ${isToday ? 'ring-2 ring-amber-600' : ''}
                    `}
                  >
                    <span className={`text-xl font-bold leading-none ${
                      isFuture ? 'ink-text-muted' :
                      status === 'green' ? 'text-emerald-800' :
                      status === 'yellow' ? 'text-amber-800' :
                      'ink-text-muted'
                    }`}>
                      {day}
                    </span>
                    {!isFuture && status === 'green' && (
                      <Check className="w-5 h-5 text-emerald-600 stroke-[3]" />
                    )}
                    {!isFuture && status === 'yellow' && (
                      <span className="text-sm font-bold text-amber-600">{detail}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
