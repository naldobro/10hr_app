import { DayData } from '../types';

interface MonthOverviewProps {
  monthData: DayData[];
  selectedDay: number;
  onDayClick: (day: number) => void;
  todayDay: number;
  currentMonth: Date;
}

export default function MonthOverview({
  monthData,
  selectedDay,
  onDayClick,
  todayDay,
  currentMonth,
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
    const isFuture = isCurrentMonth && day > today.getDate();

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
                  return (
                    <div key={`empty-${dayIndex}`} className="h-24 w-24"></div>
                  );
                }

                const isToday = isCurrentMonth && dayData.day === todayDay;
                const isSelected = dayData.day === selectedDay;
                const isFuture = isCurrentMonth && dayData.day > today.getDate();

                return (
                  <button
                    key={dayData.day}
                    onClick={() => !isFuture && onDayClick(dayData.day)}
                    disabled={isFuture}
                    className={`
                      relative h-24 w-24 rounded-lg
                      ${isFuture ? 'cursor-not-allowed' : 'cursor-pointer'}
                      ${getColorClass(dayData.color, isToday, isFuture)}
                      ${isToday && !isFuture ? 'scale-105' : ''}
                      ${!isFuture ? 'hover:scale-105' : ''}
                      ${isSelected && !isFuture ? 'ring-2 ring-amber-700' : ''}
                      flex flex-col items-center justify-center
                    `}
                  >
                    <span className={`text-4xl font-black ${isFuture ? 'ink-text-muted' : 'text-white'} ${isFuture ? 'drop-shadow-sm' : 'drop-shadow-[0_2px_4px_rgba(61,40,23,0.6)]'} leading-none mb-1`}>
                      {dayData.day}
                    </span>
                    {!isFuture && (
                      <span className="text-sm font-bold text-white drop-shadow-[0_2px_4px_rgba(61,40,23,0.6)] leading-none">
                        {dayData.hours.toFixed(1)}h
                      </span>
                    )}

                    {isToday && !isFuture && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-600 rounded-full border border-white"></div>
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
