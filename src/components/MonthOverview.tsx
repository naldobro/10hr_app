import { DayData, HabitEntry } from '../types';

interface MonthOverviewProps {
  monthData: DayData[];
  selectedDay: number;
  onDayClick: (day: number) => void;
  todayDay: number;
  currentMonth: Date;
  habitData: Map<string, HabitEntry>;
}

function getPrayerCount(h: HabitEntry): number {
  return [h.prayer_fajr, h.prayer_dhuhr, h.prayer_asr, h.prayer_maghrib, h.prayer_isha]
    .filter(Boolean).length;
}

function HabitLed({ active, color }: { active: boolean | 'yellow'; color: string }) {
  if (active === 'yellow') {
    return <span className="w-2 h-2 rounded-full bg-amber-400 inline-block flex-shrink-0" />;
  }
  if (active) {
    return <span className={`w-2 h-2 rounded-full ${color} inline-block flex-shrink-0`} />;
  }
  return <span className="w-2 h-2 rounded-full bg-stone-400/40 inline-block flex-shrink-0" />;
}

export default function MonthOverview({
  monthData,
  selectedDay,
  onDayClick,
  todayDay,
  currentMonth,
  habitData,
}: MonthOverviewProps) {
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === currentMonth.getFullYear() &&
    today.getMonth() === currentMonth.getMonth();

  const getColorClass = (color: string, isToday: boolean, isFuture: boolean) => {
    const baseClasses = 'transition-all duration-300 paper-shadow';

    if (isFuture) {
      return `${baseClasses} bg-stone-200 paper-border`;
    }

    if (color === 'red') {
      return `${baseClasses} bg-rose-300 ${isToday ? 'ring-2 ring-amber-600' : ''}`;
    } else if (color === 'yellow') {
      return `${baseClasses} bg-amber-300 ${isToday ? 'ring-2 ring-amber-600' : ''}`;
    } else if (color === 'green') {
      return `${baseClasses} bg-emerald-400 ${isToday ? 'ring-2 ring-amber-600' : ''}`;
    } else if (color === 'bright-green') {
      return `${baseClasses} bg-emerald-500 ${isToday ? 'ring-2 ring-amber-600' : ''}`;
    }
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
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="paper-card rounded-2xl paper-shadow p-6 paper-border">
      <div className="mb-2">
        <div className="grid grid-cols-7 gap-2 mb-4">
          {dayNames.map((day) => (
            <div key={day} className="text-center text-sm font-bold ink-text-muted uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-2">
              {week.map((dayData, dayIndex) => {
                if (!dayData) {
                  return <div key={`empty-${dayIndex}`} className="aspect-square" />;
                }

                const isToday = isCurrentMonth && dayData.day === todayDay;
                const isSelected = dayData.day === selectedDay;
                const isFuture = isCurrentMonth && dayData.day > today.getDate();
                const habit = habitData.get(dayData.date);
                const prayerCount = habit ? getPrayerCount(habit) : 0;
                const prayerStatus: boolean | 'yellow' = prayerCount >= 5 ? true : prayerCount === 4 ? 'yellow' : false;

                return (
                  <button
                    key={dayData.day}
                    onClick={() => !isFuture && onDayClick(dayData.day)}
                    disabled={isFuture}
                    className={`
                      relative rounded-lg p-2
                      ${isFuture ? 'cursor-not-allowed' : 'cursor-pointer'}
                      ${getColorClass(dayData.color, isToday, isFuture)}
                      ${isToday && !isFuture ? 'scale-[1.02]' : ''}
                      ${!isFuture ? 'hover:scale-[1.02]' : ''}
                      ${isSelected && !isFuture ? 'ring-2 ring-amber-700' : ''}
                      flex flex-col justify-between aspect-square
                    `}
                  >
                    <div className="flex justify-between items-start w-full">
                      {!isFuture ? (
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-left">
                          <div className="flex items-center gap-1">
                            <HabitLed active={prayerStatus} color="bg-emerald-400" />
                            <span className="text-[9px] font-bold text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] leading-none">Pray</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <HabitLed active={habit?.gym || false} color="bg-emerald-400" />
                            <span className="text-[9px] font-bold text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] leading-none">Gym</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <HabitLed active={habit?.outreach || false} color="bg-emerald-400" />
                            <span className="text-[9px] font-bold text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] leading-none">Out</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <HabitLed active={habit?.learn || false} color="bg-emerald-400" />
                            <span className="text-[9px] font-bold text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] leading-none">Learn</span>
                          </div>
                        </div>
                      ) : <div />}

                      <span className={`text-2xl font-black leading-none ${isFuture ? 'ink-text-muted drop-shadow-sm' : 'text-white drop-shadow-[0_2px_4px_rgba(61,40,23,0.6)]'}`}>
                        {dayData.day}
                      </span>
                    </div>

                    {!isFuture && (
                      <div className="text-right w-full">
                        <span className="text-sm font-bold text-white drop-shadow-[0_2px_4px_rgba(61,40,23,0.6)] leading-none">
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
          ))}
        </div>
      </div>
    </div>
  );
}
