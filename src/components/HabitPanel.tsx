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
      relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0
      ${checked
        ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_0_12px_rgba(52,211,153,0.4)]'
        : 'bg-white/10 hover:bg-white/20'
      }
    `}>
      <div className={`
        absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center
        ${checked
          ? 'left-[22px] bg-white shadow-md'
          : 'left-0.5 bg-white/60'
        }
      `}>
        {checked && <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />}
      </div>
    </button>
  );
}

export default function HabitPanel({ date, habit, onToggle }: HabitPanelProps) {
  const prayerCount = habit
    ? [habit.prayer_fajr, habit.prayer_dhuhr, habit.prayer_asr, habit.prayer_maghrib, habit.prayer_isha].filter(Boolean).length
    : 0;

  const formatDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e1b4b 100%)',
    }}>
      <div className="p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-bold text-base">{formatDate(date)}</h3>
          <div className={`
            flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold
            ${prayerCount >= 5 ? 'bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.2)]' :
              prayerCount >= 4 ? 'bg-amber-500/20 text-amber-300' :
              'bg-white/5 text-white/40'}
          `}>
            <span>🕌</span>
            <span>{prayerCount}/5</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 mb-3">Salah</p>
            <div className="space-y-1">
              {PRAYERS.map(({ key, label, time }) => (
                <div key={key} className={`
                  flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-300
                  ${habit?.[key]
                    ? 'bg-emerald-500/15 border border-emerald-500/20'
                    : 'bg-white/[0.03] border border-white/[0.04] hover:bg-white/[0.06]'
                  }
                `}>
                  <div>
                    <span className={`text-sm font-semibold ${habit?.[key] ? 'text-emerald-300' : 'text-white/70'}`}>
                      {label}
                    </span>
                    <span className={`text-[10px] ml-1.5 ${habit?.[key] ? 'text-emerald-400/50' : 'text-white/20'}`}>
                      {time}
                    </span>
                  </div>
                  <ToggleSwitch checked={habit?.[key] || false} onToggle={() => onToggle(key)} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 mb-3">Daily Habits</p>
            <div className="space-y-1">
              {HABITS.map(({ key, label, icon }) => (
                <div key={key} className={`
                  flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-300
                  ${habit?.[key]
                    ? 'bg-emerald-500/15 border border-emerald-500/20'
                    : 'bg-white/[0.03] border border-white/[0.04] hover:bg-white/[0.06]'
                  }
                `}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{icon}</span>
                    <span className={`text-sm font-semibold ${habit?.[key] ? 'text-emerald-300' : 'text-white/70'}`}>
                      {label}
                    </span>
                  </div>
                  <ToggleSwitch checked={habit?.[key] || false} onToggle={() => onToggle(key)} />
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 rounded-lg bg-white/[0.03] border border-white/[0.04]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Today's Score</span>
              </div>
              <div className="flex gap-1">
                {[...Array(8)].map((_, i) => {
                  const filled = i < (prayerCount + (habit?.gym ? 1 : 0) + (habit?.outreach ? 1 : 0) + (habit?.learn ? 1 : 0));
                  return (
                    <div key={i} className={`
                      h-1.5 flex-1 rounded-full transition-all duration-500
                      ${filled
                        ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-[0_0_8px_rgba(52,211,153,0.3)]'
                        : 'bg-white/10'
                      }
                    `} />
                  );
                })}
              </div>
              <p className="text-right text-xs font-bold text-white/40 mt-1">
                {prayerCount + (habit?.gym ? 1 : 0) + (habit?.outreach ? 1 : 0) + (habit?.learn ? 1 : 0)}/8
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
