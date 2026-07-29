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

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const doneCount = Array.from({ length: daysInMonth }, (_, i) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
    const entry = habitData.get(dateStr);
    return entry ? habit.getStatus(entry) !== 'off' : false;
  }).filter(Boolean).length;

  const pastDays = isCurrentMonth ? today.getDate() : daysInMonth;

  const prevHabit = () => setHabitIndex((habitIndex - 1 + HABITS.length) % HABITS.length);
  const nextHabit = () => setHabitIndex((habitIndex + 1) % HABITS.length);

  return (
    <div className="rounded-xl overflow-hidden shadow-lg" style={{
      background: 'linear-gradient(160deg, #4338ca 0%, #3730a3 40%, #312e81 100%)',
      width: '300px',
    }}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevHabit} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <ChevronLeft className="w-5 h-5 text-indigo-200" />
          </button>
          <div className="text-center">
            <div className="text-2xl mb-0.5">{habit.icon}</div>
            <h3 className="text-white font-bold text-lg leading-tight">{habit.label}</h3>
            <p className="text-indigo-300/50 text-xs font-semibold mt-0.5">
              {doneCount}/{pastDays} days
            </p>
          </div>
          <button onClick={nextHabit} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <ChevronRight className="w-5 h-5 text-indigo-200" />
          </button>
        </div>

        <div className="flex gap-[2px] mb-3">
          {Array.from({ length: daysInMonth }, (_, i) => {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
            const entry = habitData.get(dateStr);
            const status = entry ? habit.getStatus(entry) : 'off';
            const isFuture = isCurrentMonth && (i + 1) > today.getDate();
            return (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${
                isFuture ? 'bg-white/5' :
                status === 'green' ? 'bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.4)]' :
                status === 'yellow' ? 'bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.4)]' :
                'bg-white/10'
              }`} />
            );
          })}
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayNames.map((d, i) => (
            <div key={i} className="text-center text-[10px] font-bold text-indigo-300/40 uppercase">{d}</div>
          ))}
        </div>

        <div className="space-y-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((day, di) => {
                if (day === null) return <div key={`e-${di}`} className="aspect-square" />;

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
                      aspect-square rounded-lg flex flex-col items-center justify-center
                      ${isFuture ? 'bg-white/[0.03]' :
                        status === 'green' ? 'bg-emerald-500/20 border border-emerald-500/30' :
                        status === 'yellow' ? 'bg-amber-400/20 border border-amber-400/30' :
                        'bg-white/[0.05] border border-white/[0.05]'
                      }
                      ${isToday ? 'ring-1 ring-indigo-300/50' : ''}
                    `}
                  >
                    <span className={`text-[11px] font-bold leading-none ${
                      isFuture ? 'text-indigo-300/20' :
                      status !== 'off' ? 'text-white/90' : 'text-indigo-200/40'
                    }`}>
                      {day}
                    </span>
                    {!isFuture && status === 'green' && (
                      <Check className="w-3 h-3 text-emerald-400 mt-0.5 stroke-[3]" />
                    )}
                    {!isFuture && status === 'yellow' && (
                      <span className="text-[8px] font-bold text-amber-300 mt-0.5">{detail}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-2 mt-3">
          {HABITS.map((h, i) => (
            <button
              key={h.key}
              onClick={() => setHabitIndex(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === habitIndex ? 'bg-white scale-125' : 'bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
