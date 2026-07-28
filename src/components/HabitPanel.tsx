import { HabitEntry } from '../types';
import { Check } from 'lucide-react';

interface HabitPanelProps {
  date: string;
  habit: HabitEntry | null;
  onToggle: (field: keyof HabitEntry) => void;
}

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
      relative w-12 h-7 rounded-full transition-all duration-300 flex-shrink-0 border
      ${checked
        ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 border-emerald-600/30 shadow-[0_0_14px_rgba(16,185,129,0.4)]'
        : 'bg-amber-900/20 border-amber-700/20 hover:bg-amber-900/30'
      }
    `}>
      <div className={`
        absolute top-[3px] w-[22px] h-[22px] rounded-full transition-all duration-300 flex items-center justify-center shadow-sm
        ${checked
          ? 'left-[23px] bg-white'
          : 'left-[3px] bg-amber-200/60'
        }
      `}>
        {checked && <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />}
      </div>
    </button>
  );
}

export default function HabitPanel({ date, habit, onToggle }: HabitPanelProps) {
  const prayerCount = habit
    ? [habit.prayer_fajr, habit.prayer_dhuhr, habit.prayer_asr, habit.prayer_maghrib, habit.prayer_isha].filter(Boolean).length
    : 0;
  const habitCount = (habit?.gym ? 1 : 0) + (habit?.outreach ? 1 : 0) + (habit?.learn ? 1 : 0);
  const totalScore = prayerCount + habitCount;

  const formatDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  return (
    <div className="rounded-xl overflow-hidden shadow-lg" style={{
      background: 'linear-gradient(135deg, #92400e 0%, #78350f 40%, #451a03 100%)',
    }}>
      <div className="p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-amber-100 font-bold text-lg">{formatDate(date)}</h3>
          <div className={`
            flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-bold border
            ${prayerCount >= 5
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-[0_0_14px_rgba(16,185,129,0.25)]'
              : prayerCount >= 4
              ? 'bg-amber-400/20 text-amber-200 border-amber-400/30'
              : 'bg-amber-900/30 text-amber-300/50 border-amber-700/20'}
          `}>
            🕌 {prayerCount}/5
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-amber-400/50 mb-3">Salah</p>
            <div className="space-y-1.5">
              {PRAYERS.map(({ key, label, time }) => (
                <div key={key} className={`
                  flex items-center justify-between px-3.5 py-3 rounded-xl transition-all duration-300 border
                  ${habit?.[key]
                    ? 'bg-emerald-500/15 border-emerald-500/25'
                    : 'bg-amber-950/30 border-amber-700/15 hover:bg-amber-950/50'
                  }
                `}>
                  <div>
                    <span className={`text-sm font-bold ${habit?.[key] ? 'text-emerald-300' : 'text-amber-100/80'}`}>
                      {label}
                    </span>
                    <span className={`text-[10px] ml-2 ${habit?.[key] ? 'text-emerald-400/40' : 'text-amber-400/25'}`}>
                      {time}
                    </span>
                  </div>
                  <ToggleSwitch checked={habit?.[key] || false} onToggle={() => onToggle(key)} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-amber-400/50 mb-3">Daily Habits</p>
            <div className="space-y-1.5">
              {HABITS.map(({ key, label, icon }) => (
                <div key={key} className={`
                  flex items-center justify-between px-3.5 py-3 rounded-xl transition-all duration-300 border
                  ${habit?.[key]
                    ? 'bg-emerald-500/15 border-emerald-500/25'
                    : 'bg-amber-950/30 border-amber-700/15 hover:bg-amber-950/50'
                  }
                `}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{icon}</span>
                    <span className={`text-sm font-bold ${habit?.[key] ? 'text-emerald-300' : 'text-amber-100/80'}`}>
                      {label}
                    </span>
                  </div>
                  <ToggleSwitch checked={habit?.[key] || false} onToggle={() => onToggle(key)} />
                </div>
              ))}
            </div>

            <div className="mt-5 p-4 rounded-xl bg-amber-950/40 border border-amber-700/15">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400/40">Daily Score</span>
                <span className={`text-lg font-black ${
                  totalScore >= 7 ? 'text-emerald-400' : totalScore >= 4 ? 'text-amber-300' : 'text-amber-400/40'
                }`}>{totalScore}/8</span>
              </div>
              <div className="flex gap-1.5">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className={`
                    h-2 flex-1 rounded-full transition-all duration-500
                    ${i < totalScore
                      ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.35)]'
                      : 'bg-amber-900/40'
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
