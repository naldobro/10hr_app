import { useEffect, useState } from 'react';
import { Clock, TrendingUp, Target, Timer } from 'lucide-react';

interface DaySummaryProps {
  workedHours: number;
  targetHours?: number;
}

export default function DaySummary({ workedHours, targetHours = 10 }: DaySummaryProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getCurrentHour = () => {
    return currentTime.getHours() + currentTime.getMinutes() / 60;
  };

  const getPassedHours = () => {
    return getCurrentHour();
  };

  const getHoursLeft = () => {
    const left = targetHours - workedHours;
    return Math.max(0, left);
  };

  const getTimeRemaining = () => {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(24, 0, 0, 0);
    const ms = endOfDay.getTime() - now.getTime();
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return { hours, minutes };
  };

  const getProgressPercentage = () => {
    return Math.min((workedHours / targetHours) * 100, 100);
  };

  const getProgressColor = () => {
    const percentage = getProgressPercentage();
    if (percentage < 50) return 'from-rose-400 to-rose-500';
    if (percentage < 80) return 'from-amber-400 to-amber-500';
    return 'from-emerald-400 to-emerald-500';
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const timeRemaining = getTimeRemaining();

  return (
    <div className="paper-card rounded-2xl paper-shadow p-8 paper-border">
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="paper-card rounded-xl p-6 paper-shadow paper-border hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-amber-700" />
            <div className="text-sm font-semibold ink-text-muted">Current Time</div>
          </div>
          <div className="text-4xl font-bold ink-text tracking-tight">{formatTime(currentTime)}</div>
        </div>

        <div className="paper-card rounded-xl p-6 paper-shadow paper-border hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 ink-text-muted" />
            <div className="text-sm font-semibold ink-text-muted">Day Progress</div>
          </div>
          <div className="text-4xl font-bold ink-text">
            {getPassedHours().toFixed(1)}h
          </div>
        </div>

        <div className="bg-amber-50 rounded-xl p-6 paper-shadow paper-border hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-amber-700" />
            <div className="text-sm font-semibold text-amber-700">To Goal</div>
          </div>
          <div className="text-4xl font-bold text-amber-800">
            {getHoursLeft().toFixed(1)}h
          </div>
        </div>

        <div className="paper-card rounded-xl p-6 paper-shadow paper-border hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <Timer className="w-5 h-5 ink-text-muted" />
            <div className="text-sm font-semibold ink-text-muted">Time Left Today</div>
          </div>
          <div className="text-4xl font-bold ink-text">
            {timeRemaining.hours}h {timeRemaining.minutes}m
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="h-12 bg-stone-200 rounded-full overflow-hidden shadow-inner paper-border">
          <div
            className={`h-full bg-gradient-to-r ${getProgressColor()} transition-all duration-700 ease-out relative`}
            style={{ width: `${getProgressPercentage()}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold ink-text drop-shadow-lg px-4 py-1 bg-amber-50/90 rounded-full paper-border">
            {workedHours.toFixed(1)} / {targetHours} hours
          </span>
        </div>
      </div>
    </div>
  );
}
