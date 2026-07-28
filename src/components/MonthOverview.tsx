import { useState } from 'react';
import { DayData, HabitEntry } from '../types';
import HabitPanel from './HabitPanel';

interface MonthOverviewProps {
  monthData: DayData[];
  selectedDay: number;
  onDayClick: (day: number) => void;
  todayDay: number;
  currentMonth: Date;
  habitData: Map<string, HabitEntry>;
  currentHabit: HabitEntry | null;
  onHabitToggle: (field: keyof HabitEntry) => void;
}

function getPrayerCount(h: HabitEntry): number {
  return [h.prayer_fajr, h.prayer_dhuhr, h.prayer_asr, h.prayer_maghrib, h.prayer_isha]
    .filter(Boolean).length;
}

function Led({ status }: { status: 'on' | 'yellow' | 'off' }) {
  if (status === 'on') return <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block flex-shrink-0 ring-[1.5px] ring-white/80 shadow-[0_0_6px_rgba(16,185,129,0.9)]" />;
  if (status === 'yellow') return <span className="w-2 h-2 rounded-full bg-orange-400 inline-block flex-shrink-0 ring-[1.5px] ring-white/80 shadow-[0_0_6px_rgba(251,146,60,0.9)]" />;
  return <span className="w-2 h-2 rounded-full bg-black/20 inline-block flex-shrink-0 ring-[1.5px] ring-black/10" />;
}

export default function MonthOverview({
  monthData,
  selectedDay,
  onDayClick,
  todayDay,
  currentMonth,
  habitData,
  currentHabit,
  onHabitToggle,
}: MonthOverviewProps) {
  const [panelOpen, setPanelOpen] = useState(false);

  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === currentMonth.getFullYear() &&
    today.getMonth() === currentMonth.getMonth();

  const getColorClass = (color: string, isToday: boolean, isFuture: boolean) => {
    if (isFuture) return 'bg-stone-200/80 paper-border';
    if (color === 'red') return `bg-rose-300 ${isToday ? 'ring-2 ring-amber-600' : ''}`;
    if (color === 'yellow') return `bg-amber-300 ${isToday ? 'ring-2 ring-amber-600' : ''}`;
    if (color === 'green') return `bg-emerald-400 ${isToday ? 'ring-2 ring-amber-600' : ''}`;
    if (color === 'bright-green') return `bg-emerald-500 ${isToday ? 'ring-2 ring-amber-600' : ''}`;
    return 'bg-stone-300/70';
  };

  const dayOfWeekStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const dayMap = new Map(monthData.map((d) => [d.day, d]));

  const weeks: (DayData | null)[][] = [];
  let currentWeek: (DayData | null)[] = Array(dayOfWeekStart).fill(null);

  for (let day = 1; day <= daysInMonth; day++) {
    const dayData = dayMap.get(day);
    currentWeek.push(
      dayData || {
        day, hours: 0, color: 'gray',
        date: `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      }
    );
    if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const selectedWeekIndex = weeks.findIndex(week => week.some(d => d && d.day === selectedDay));
  const selectedDayIndex = selectedWeekIndex >= 0
    ? weeks[selectedWeekIndex].findIndex(d => d && d.day === selectedDay) : -1;
  const selectedDayData = selectedWeekIndex >= 0 ? weeks[selectedWeekIndex][selectedDayIndex] : null;
  const isFutureSelected = isCurrentMonth && selectedDay > today.getDate();

  const handleDayClick = (day: number) => {
    if (day === selectedDay) {
      setPanelOpen(!panelOpen);
    } else {
      onDayClick(day);
      setPanelOpen(true);
    }
  };

  return (
    <div className="paper-card rounded-2xl paper-shadow p-5 paper-border">
      <div className="grid grid-cols-7 gap-2 mb-3">
        {dayNames.map((day) => (
          <div key={day} className="text-center text-sm font-bold ink-text-muted uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex}>
            <div className="grid grid-cols-7 gap-2">
              {week.map((dayData, dayIndex) => {
                if (!dayData) return <div key={`empty-${dayIndex}`} className="aspect-square" />;

                const isToday = isCurrentMonth && dayData.day === todayDay;
                const isSelected = dayData.day === selectedDay && panelOpen;
                const isFuture = isCurrentMonth && dayData.day > today.getDate();
                const habit = habitData.get(dayData.date);
                const prayerCount = habit ? getPrayerCount(habit) : 0;
                const prayerLed: 'on' | 'yellow' | 'off' = prayerCount >= 5 ? 'on' : prayerCount === 4 ? 'yellow' : 'off';

                return (
                  <button
                    key={dayData.day}
                    onClick={() => !isFuture && handleDayClick(dayData.day)}
                    disabled={isFuture}
                    className={`
                      relative rounded-xl aspect-square transition-all duration-200 paper-shadow
                      ${isFuture ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-[1.04] active:scale-[0.98]'}
                      ${getColorClass(dayData.color, isToday, isFuture)}
                      ${isSelected ? 'ring-2 ring-amber-600 scale-[1.04] shadow-lg' : ''}
                      ${dayData.day === selectedDay && !panelOpen ? 'ring-1 ring-amber-400/50' : ''}
                      flex flex-col justify-between p-2
                    `}
                  >
                    {/* Day number top-right */}
                    <div className="flex justify-end w-full">
                      <span className={`text-3xl font-black leading-none ${isFuture ? 'ink-text-muted' : 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]'}`}>
                        {dayData.day}
                      </span>
                    </div>

                    {/* Habit LEDs bottom-left, hours bottom-right */}
                    <div className="flex justify-between items-end w-full">
                      {!isFuture ? (
                        <div className="bg-black/25 backdrop-blur-sm rounded-md px-1.5 py-1 flex flex-col gap-[2px]">
                          <div className="flex items-center gap-[3px]">
                            <Led status={prayerLed} />
                            <span className="text-[10px] font-bold text-white leading-none">Pray</span>
                            <span className="w-1" />
                            <Led status={habit?.gym ? 'on' : 'off'} />
                            <span className="text-[10px] font-bold text-white leading-none">Gym</span>
                          </div>
                          <div className="flex items-center gap-[3px]">
                            <Led status={habit?.outreach ? 'on' : 'off'} />
                            <span className="text-[10px] font-bold text-white leading-none">Out</span>
                            <span className="w-1" />
                            <Led status={habit?.learn ? 'on' : 'off'} />
                            <span className="text-[10px] font-bold text-white leading-none">Learn</span>
                          </div>
                        </div>
                      ) : <div />}

                      {!isFuture && (
                        <span className="text-base font-extrabold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
                          {dayData.hours.toFixed(1)}h
                        </span>
                      )}
                    </div>

                    {isToday && !isFuture && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-white shadow-md" />
                    )}
                  </button>
                );
              })}
            </div>

            {weekIndex === selectedWeekIndex && panelOpen && !isFutureSelected && selectedDayData && (
              <div className="relative mt-2 overflow-hidden" style={{
                animation: 'habitSlideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              }}>
                <div
                  className="absolute top-0 z-10"
                  style={{
                    left: `calc(${(selectedDayIndex * 100) / 7}% + ${100 / 14}% - 10px)`,
                  }}
                >
                  <div className="w-5 h-5 rotate-45 -translate-y-2.5 border-l border-t border-amber-300/30" style={{
                    background: 'linear-gradient(135deg, #92400e, #78350f)',
                  }} />
                </div>

                <HabitPanel
                  date={selectedDayData.date}
                  habit={currentHabit}
                  onToggle={onHabitToggle}
                />

                <style>{`
                  @keyframes habitSlideDown {
                    from { max-height: 0; opacity: 0; transform: translateY(-12px); }
                    to { max-height: 500px; opacity: 1; transform: translateY(0); }
                  }
                `}</style>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
