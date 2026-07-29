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
  habitSchedules: Record<string, number[]>;
}

function getPrayerCount(h: HabitEntry): number {
  return [h.prayer_fajr, h.prayer_dhuhr, h.prayer_asr, h.prayer_maghrib, h.prayer_isha]
    .filter(Boolean).length;
}

function Led({ status }: { status: 'on' | 'yellow' | 'off' }) {
  if (status === 'on') return <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3 rounded-full bg-emerald-500 inline-block flex-shrink-0 ring-[1px] sm:ring-[1.5px] ring-white/80 shadow-[0_0_4px_rgba(16,185,129,0.9)] sm:shadow-[0_0_6px_rgba(16,185,129,0.9)]" />;
  if (status === 'yellow') return <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3 rounded-full bg-orange-400 inline-block flex-shrink-0 ring-[1px] sm:ring-[1.5px] ring-white/80 shadow-[0_0_4px_rgba(251,146,60,0.9)] sm:shadow-[0_0_6px_rgba(251,146,60,0.9)]" />;
  return <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3 rounded-full bg-black/25 inline-block flex-shrink-0 ring-[1px] sm:ring-[1.5px] ring-black/10" />;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export default function MonthOverview({
  monthData, selectedDay, onDayClick, todayDay, currentMonth,
  habitData, currentHabit, onHabitToggle, habitSchedules,
}: MonthOverviewProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === currentMonth.getFullYear() && today.getMonth() === currentMonth.getMonth();

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
    currentWeek.push(dayMap.get(day) || {
      day, hours: 0, color: 'gray',
      date: `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    });
    if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const dayNamesFull = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const selectedWeekIndex = weeks.findIndex(week => week.some(d => d && d.day === selectedDay));
  const selectedDayIndex = selectedWeekIndex >= 0 ? weeks[selectedWeekIndex].findIndex(d => d && d.day === selectedDay) : -1;
  const selectedDayData = selectedWeekIndex >= 0 ? weeks[selectedWeekIndex][selectedDayIndex] : null;
  const isFutureSelected = isCurrentMonth && selectedDay > today.getDate();

  const handleDayClick = (day: number) => {
    if (day === selectedDay) setPanelOpen(!panelOpen);
    else { onDayClick(day); setPanelOpen(true); }
  };

  return (
    <div className="paper-card rounded-2xl paper-shadow p-2.5 sm:p-4 lg:p-5 paper-border">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 sm:mb-3">
        {dayNames.map((day, i) => (
          <div key={i} className="text-center text-[10px] sm:text-xs lg:text-sm font-bold ink-text-muted uppercase tracking-wider">
            <span className="sm:hidden">{day}</span>
            <span className="hidden sm:inline">{dayNamesFull[i]}</span>
          </div>
        ))}
      </div>

      <div className="space-y-1 sm:space-y-2">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex}>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {week.map((dayData, dayIndex) => {
                if (!dayData) return <div key={`empty-${dayIndex}`} className="aspect-square sm:aspect-[1/0.88]" />;

                const isToday = isCurrentMonth && dayData.day === todayDay;
                const isSelected = dayData.day === selectedDay && panelOpen;
                const isFuture = isCurrentMonth && dayData.day > today.getDate();
                const habit = habitData.get(dayData.date);
                const dow = new Date(dayData.date + 'T00:00:00').getDay();
                const isScheduled = (key: string) => (habitSchedules[key] || ALL_DAYS).includes(dow);
                const pc = habit ? getPrayerCount(habit) : 0;
                const pLed: 'on' | 'yellow' | 'off' = !isScheduled('prayer') ? 'off' : pc >= 5 ? 'on' : pc === 4 ? 'yellow' : 'off';

                return (
                  <button
                    key={dayData.day}
                    onClick={() => !isFuture && handleDayClick(dayData.day)}
                    disabled={isFuture}
                    className={`
                      relative rounded-lg sm:rounded-xl transition-all duration-200 paper-shadow
                      aspect-square sm:aspect-[1/0.88]
                      ${isFuture ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-[1.04] active:scale-[0.98]'}
                      ${getColorClass(dayData.color, isToday, isFuture)}
                      ${isSelected ? 'ring-2 ring-amber-600 scale-[1.04] shadow-lg' : ''}
                      ${dayData.day === selectedDay && !panelOpen ? 'ring-1 ring-amber-400/50' : ''}
                      flex flex-col items-center justify-center sm:flex-row sm:items-stretch sm:justify-start p-1 sm:p-2 lg:p-3
                    `}
                  >
                    {/* Mobile: centered day + hours */}
                    <div className="flex flex-col items-center justify-center sm:hidden w-full h-full">
                      <span className={`font-bold leading-none ${isFuture ? 'ink-text-muted' : 'text-stone-800'} text-base`}>
                        {dayData.day}
                      </span>
                      {!isFuture && dayData.hours > 0 && (
                        <span className="font-bold text-stone-800 leading-none text-[9px] mt-0.5">
                          {dayData.hours.toFixed(1)}h
                        </span>
                      )}
                    </div>

                    {/* Tablet+: habit LEDs + day/hours layout */}
                    {!isFuture ? (
                      <div className="hidden sm:flex flex-col justify-between flex-1 min-w-0">
                        {[
                          { label: 'Pray', led: pLed },
                          { label: 'Gym', led: (!isScheduled('gym') ? 'off' : habit?.gym ? 'on' : 'off') as 'on' | 'off' },
                          { label: 'Out', led: (!isScheduled('outreach') ? 'off' : habit?.outreach ? 'on' : 'off') as 'on' | 'off' },
                          { label: 'Learn', led: (!isScheduled('learn') ? 'off' : habit?.learn ? 'on' : 'off') as 'on' | 'off' },
                        ].map(({ label, led }) => (
                          <div key={label} className="flex items-center gap-1 lg:gap-2">
                            <Led status={led} />
                            <span className="hidden lg:inline font-bold text-stone-800 leading-none text-[11px] xl:text-[15px]">
                              {label}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : <div className="hidden sm:block flex-1" />}

                    {/* Tablet+: right zone */}
                    <div className="hidden sm:flex flex-col justify-between items-end flex-shrink-0 ml-0.5 lg:ml-1">
                      <span
                        className={`font-bold leading-none ${isFuture ? 'ink-text-muted' : 'text-stone-800 drop-shadow-[0_1px_2px_rgba(255,255,255,0.3)]'} text-xl md:text-2xl lg:text-4xl xl:text-[45px]`}
                      >
                        {dayData.day}
                      </span>
                      {!isFuture && (
                        <span className="font-bold text-stone-800 leading-none drop-shadow-[0_1px_2px_rgba(255,255,255,0.3)] text-xs md:text-sm lg:text-lg xl:text-[22px]">
                          {dayData.hours.toFixed(1)}h
                        </span>
                      )}
                    </div>

                    {isToday && !isFuture && (
                      <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-2 h-2 sm:w-3 sm:h-3 bg-amber-500 rounded-full border-2 border-white shadow-md" />
                    )}
                  </button>
                );
              })}
            </div>

            {weekIndex === selectedWeekIndex && panelOpen && !isFutureSelected && selectedDayData && (
              <div className="relative mt-2 overflow-hidden" style={{
                animation: 'habitSlideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              }}>
                <div className="absolute top-0 z-10 hidden sm:block" style={{
                  left: `calc(${(selectedDayIndex * 100) / 7}% + ${100 / 14}% - 10px)`,
                }}>
                  <div className="w-5 h-5 rotate-45 -translate-y-2.5 border-l border-t border-indigo-400/20" style={{
                    background: 'linear-gradient(135deg, #4338ca, #3730a3)',
                  }} />
                </div>
                <HabitPanel date={selectedDayData.date} habit={currentHabit} onToggle={onHabitToggle} habitSchedules={habitSchedules} />
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
