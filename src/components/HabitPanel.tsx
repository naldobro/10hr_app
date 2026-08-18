import { HabitEntry } from '../types';
import { Check } from 'lucide-react';

interface HabitPanelProps {
  date: string;
  habit: HabitEntry | null;
  onToggle: (field: keyof HabitEntry) => void;
  habitSchedules: Record<string, number[]>;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const PRAYERS = [
  { key: 'prayer_fajr' as const, label: 'Fajr', time: 'Dawn' },
  { key: 'prayer_dhuhr' as const, label: 'Dhuhr', time: 'Noon' },
  { key: 'prayer_asr' as const, label: 'Asr', time: 'Afternoon' },
  { key: 'prayer_maghrib' as const, label: 'Maghrib', time: 'Sunset' },
  { key: 'prayer_isha' as const, label: 'Isha', time: 'Night' },
];

const HABITS = [
  { key: 'gym' as const, label: 'Gym', icon: '💪' },
  { key: 'outreach' as const, label: 'Outreach', icon: '📨' },
  { key: 'learn' as const, label: 'Learn', icon: '📖' },
];

function ToggleSwitch({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`
      relative w-10 h-6 sm:w-12 sm:h-7 rounded-full transition-all duration-300 flex-shrink-0 border
      ${checked
        ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 border-emerald-600/30 shadow-[0_0_14px_rgba(16,185,129,0.4)]'
        : 'bg-white/10 dark:bg-paper/10 border-white/10 hover:bg-white/20 dark:hover:bg-paper/20'
      }
    `}>
      <div className={`
        absolute top-[2px] sm:top-[3px] w-[18px] h-[18px] sm:w-[22px] sm:h-[22px] rounded-full transition-all duration-300 flex items-center justify-center shadow-sm
        ${checked ? 'left-[19px] sm:left-[23px] bg-white dark:bg-paper' : 'left-[2px] sm:left-[3px] bg-white/40 dark:bg-paper/40'}
      `}>
        {checked && <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 stroke-[3]" />}
      </div>
    </button>
  );
}

export default function HabitPanel({ date, habit, onToggle, habitSchedules }: HabitPanelProps) {
  const dow = new Date(date + 'T00:00:00').getDay();
  const isScheduled = (key: string) => (habitSchedules[key] || ALL_DAYS).includes(dow);

  const prayerCount = habit
    ? [habit.prayer_fajr, habit.prayer_dhuhr, habit.prayer_asr, habit.prayer_maghrib, habit.prayer_isha].filter(Boolean).length
    : 0;
  const habitCount = (habit?.gym && isScheduled('gym') ? 1 : 0) + (habit?.outreach && isScheduled('outreach') ? 1 : 0) + (habit?.learn && isScheduled('learn') ? 1 : 0);
  const scheduledPrayerMax = isScheduled('prayer') ? 5 : 0;
  const scheduledHabitCount = (['gym', 'outreach', 'learn'] as const).filter(k => isScheduled(k)).length;
  const totalMax = scheduledPrayerMax + scheduledHabitCount;
  const totalScore = (isScheduled('prayer') ? prayerCount : 0) + habitCount;

  const formatDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="rounded-xl overflow-hidden shadow-xl" style={{
      background: 'linear-gradient(135deg, #4338ca 0%, #3730a3 30%, #312e81 60%, #1e1b4b 100%)',
    }}>
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <h3 className="text-indigo-100 font-bold text-base sm:text-lg">{formatDate(date)}</h3>
          <div className={`
            flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-bold border
            ${prayerCount >= 5
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-[0_0_14px_rgba(16,185,129,0.25)]'
              : prayerCount >= 4
              ? 'bg-amber-400/20 text-amber-200 border-amber-400/30'
              : 'bg-white/5 dark:bg-paper/5 text-indigo-300/50 border-indigo-400/20'}
          `}>
            🕌 {prayerCount}/5
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.15em] text-indigo-300/40 mb-2 sm:mb-3">Salah</p>
            <div className="space-y-1 sm:space-y-1.5">
              {PRAYERS.map(({ key, label, time }) => (
                <div key={key} className={`
                  flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-300 border
                  ${habit?.[key]
                    ? 'bg-emerald-500/15 border-emerald-500/25'
                    : 'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.08]'
                  }
                `}>
                  <div>
                    <span className={`text-sm sm:text-[15px] font-bold ${habit?.[key] ? 'text-emerald-300' : 'text-indigo-100/80'}`}>
                      {label}
                    </span>
                    <span className={`text-[10px] sm:text-[11px] ml-1.5 sm:ml-2 ${habit?.[key] ? 'text-emerald-400/40' : 'text-indigo-300/25'}`}>
                      {time}
                    </span>
                  </div>
                  <ToggleSwitch checked={habit?.[key] || false} onToggle={() => onToggle(key)} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.15em] text-indigo-300/40 mb-2 sm:mb-3">Daily Habits</p>
            <div className="space-y-1 sm:space-y-1.5">
              {HABITS.map(({ key, label, icon }) => (
                <div key={key} className={`
                  flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-300 border
                  ${habit?.[key]
                    ? 'bg-emerald-500/15 border-emerald-500/25'
                    : 'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.08]'
                  }
                `}>
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <span className="text-base sm:text-lg">{icon}</span>
                    <span className={`text-sm sm:text-[15px] font-bold ${habit?.[key] ? 'text-emerald-300' : 'text-indigo-100/80'}`}>
                      {label}
                    </span>
                  </div>
                  <ToggleSwitch checked={habit?.[key] || false} onToggle={() => onToggle(key)} />
                </div>
              ))}
            </div>

            <div className="mt-4 sm:mt-5 p-3 sm:p-4 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <div className="flex items-center justify-between mb-2 sm:mb-2.5">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-300/40">Daily Score</span>
                <span className={`text-lg sm:text-xl font-black ${
                  totalMax > 0 && totalScore >= totalMax - 1 ? 'text-emerald-400' : totalScore >= totalMax / 2 ? 'text-amber-300' : 'text-indigo-300/40'
                }`}>{totalScore}/{totalMax}</span>
              </div>
              <div className="flex gap-1 sm:gap-1.5">
                {[...Array(totalMax)].map((_, i) => (
                  <div key={i} className={`
                    h-2 sm:h-2.5 flex-1 rounded-full transition-all duration-500
                    ${i < totalScore
                      ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-[0_0_8px_rgba(16,185,129,0.35)]'
                      : 'bg-white/10 dark:bg-paper/10'
                    }
                  `} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
