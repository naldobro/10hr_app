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
  if (status === 'on') return <span className="w-[6px] h-[6px] rounded-full bg-emerald-400 inline-block flex-shrink-0 shadow-[0_0_4px_rgba(52,211,153,0.6)]" />;
  if (status === 'yellow') return <span className="w-[6px] h-[6px] rounded-full bg-amber-400 inline-block flex-shrink-0 shadow-[0_0_4px_rgba(251,191,36,0.6)]" />;
  return <span className="w-[6px] h-[6px] rounded-full bg-black/15 inline-block flex-shrink-0" />;
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
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === currentMonth.getFullYear() &&
    today.getMonth() === currentMonth.getMonth();

  const getColorClass = (color: string, isToday: boolean, isFuture: boolean) => {
    const baseClasses = 'transition-all duration-300 paper-shadow';
    if (isFuture) return `${baseClasses} bg-stone-200 paper-border`;
    if (color === 'red') return `${baseClasses} bg-rose-300 ${isToday ? 'ring-2 ring-amber-600' : ''}`;
    if (color === 'yellow') return `${baseClasses} bg-amber-300 ${isToday ? 'ring-2 ring-amber-600' : ''}`;
    if (color === 'green') return `${baseClasses} bg-emerald-400 ${isToday ? 'ring-2 ring-amber-600' : ''}`;
    if (color === 'bright-green') return `${baseClasses} bg-emerald-500 ${isToday ? 'ring-2 ring-amber-600' : ''}`;
    return `${baseClasses} bg-stone-200`;
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
        day,
        hours: 0,
        color: 'gray',
        date: `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      }
    );
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const selectedWeekIndex = weeks.findIndex(week =>
    week.some(d => d && d.day === selectedDay)
  );
  const selectedDayIndex = selectedWeekIndex >= 0
    ? weeks[selectedWeekIndex].findIndex(d => d && d.day === selectedDay)
    : -1;

  const selectedDayData = selectedWeekIndex >= 0
    ? weeks[selectedWeekIndex][selectedDayIndex]
    : null;
  const isFutureSelected = isCurrentMonth && selectedDay > today.getDate();

  return (
    <div className="paper-card rounded-2xl paper-shadow p-4 paper-border">
      <div className="grid grid-cols-7 gap-1.5 mb-3">
        {dayNames.map((day) => (
          <div key={day} className="text-center text-xs font-bold ink-text-muted uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex}>
            <div className="grid grid-cols-7 gap-1.5">
              {week.map((dayData, dayIndex) => {
                if (!dayData) {
                  return <div key={`empty-${dayIndex}`} className="h-[72px]" />;
                }

                const isToday = isCurrentMonth && dayData.day === todayDay;
                const isSelected = dayData.day === selectedDay;
                const isFuture = isCurrentMonth && dayData.day > today.getDate();
                const habit = habitData.get(dayData.date);
                const prayerCount = habit ? getPrayerCount(habit) : 0;
                const prayerLed: 'on' | 'yellow' | 'off' = prayerCount >= 5 ? 'on' : prayerCount === 4 ? 'yellow' : 'off';

                return (
                  <button
                    key={dayData.day}
                    onClick={() => !isFuture && onDayClick(dayData.day)}
                    disabled={isFuture}
                    className={`
                      relative rounded-lg px-2 py-1.5 h-[72px]
                      ${isFuture ? 'cursor-not-allowed' : 'cursor-pointer'}
                      ${getColorClass(dayData.color, isToday, isFuture)}
                      ${!isFuture ? 'hover:scale-[1.03]' : ''}
                      ${isSelected && !isFuture ? 'ring-2 ring-amber-700 scale-[1.03]' : ''}
                      flex flex-col justify-between
                    `}
                  >
                    <div className="flex justify-between items-start w-full">
                      {!isFuture ? (
                        <div className="flex flex-col gap-[3px] mt-0.5">
                          <div className="flex items-center gap-[3px]">
                            <Led status={prayerLed} />
                            <span className="text-[10px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">Pray</span>
                            <Led status={habit?.gym ? 'on' : 'off'} />
                            <span className="text-[10px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">Gym</span>
                          </div>
                          <div className="flex items-center gap-[3px]">
                            <Led status={habit?.outreach ? 'on' : 'off'} />
                            <span className="text-[10px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">Out</span>
                            <Led status={habit?.learn ? 'on' : 'off'} />
                            <span className="text-[10px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">Learn</span>
                          </div>
                        </div>
                      ) : <div />}
                      <span className={`text-xl font-black leading-none ${isFuture ? 'ink-text-muted' : 'text-white drop-shadow-[0_2px_4px_rgba(61,40,23,0.6)]'}`}>
                        {dayData.day}
                      </span>
                    </div>

                    {!isFuture && (
                      <div className="text-right w-full">
                        <span className="text-xs font-bold text-white drop-shadow-[0_2px_4px_rgba(61,40,23,0.6)]">
                          {dayData.hours.toFixed(1)}h
                        </span>
                      </div>
                    )}

                    {isToday && !isFuture && (
                      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-600 rounded-full border-2 border-white" />
                    )}
                  </button>
                );
              })}
            </div>

            {weekIndex === selectedWeekIndex && !isFutureSelected && selectedDayData && (
              <div className="relative mt-1.5">
                <div
                  className="absolute top-0 w-3 h-3 bg-amber-50 border-l border-t border-stone-200 rotate-45 -translate-y-1.5 z-10"
                  style={{
                    left: `calc(${(selectedDayIndex * 100) / 7}% + ${100 / 14}%)`,
                    marginLeft: '-6px',
                  }}
                />
                <HabitPanel
                  date={selectedDayData.date}
                  habit={currentHabit}
                  onToggle={onHabitToggle}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
