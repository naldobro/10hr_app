import { HabitEntry } from '../types';
import { Check } from 'lucide-react';

interface HabitPanelProps {
  date: string;
  habit: HabitEntry | null;
  onToggle: (field: keyof HabitEntry) => void;
}

const PRAYERS = [
  { key: 'prayer_fajr' as const, label: 'Fajr' },
  { key: 'prayer_dhuhr' as const, label: 'Dhuhr' },
  { key: 'prayer_asr' as const, label: 'Asr' },
  { key: 'prayer_maghrib' as const, label: 'Maghrib' },
  { key: 'prayer_isha' as const, label: 'Isha' },
];

const HABITS = [
  { key: 'gym' as const, label: 'Gym', emoji: '💪' },
  { key: 'outreach' as const, label: 'Outreach', emoji: '📨' },
  { key: 'learn' as const, label: 'Learn', emoji: '📖' },
];

function Toggle({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      onClick={onToggle}
      className={`
        flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200
        ${checked
          ? 'bg-emerald-100 border border-emerald-300'
          : 'bg-stone-100 border border-stone-200 hover:bg-stone-150 hover:border-stone-300'
        }
      `}
    >
      <div className={`
        w-5 h-5 rounded-md flex items-center justify-center transition-all duration-200
        ${checked
          ? 'bg-emerald-500 shadow-sm'
          : 'bg-white border-2 border-stone-300'
        }
      `}>
        {checked && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
      </div>
      <span className={`text-sm font-semibold transition-colors ${checked ? 'text-emerald-800' : 'text-stone-500'}`}>
        {label}
      </span>
    </button>
  );
}

export default function HabitPanel({ date, habit, onToggle }: HabitPanelProps) {
  const prayerCount = habit
    ? [habit.prayer_fajr, habit.prayer_dhuhr, habit.prayer_asr, habit.prayer_maghrib, habit.prayer_isha].filter(Boolean).length
    : 0;

  const formatDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-amber-50 rounded-xl border border-stone-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold ink-text">{formatDate(date)}</span>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
          prayerCount >= 5 ? 'bg-emerald-100 text-emerald-700 shadow-[0_0_6px_rgba(52,211,153,0.3)]' :
          prayerCount === 4 ? 'bg-amber-100 text-amber-700' :
          'bg-stone-100 text-stone-400'
        }`}>
          🕌 {prayerCount}/5
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">Prayers</p>
          <div className="flex flex-col gap-1.5">
            {PRAYERS.map(({ key, label }) => (
              <Toggle
                key={key}
                checked={habit?.[key] || false}
                onToggle={() => onToggle(key)}
                label={label}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">Habits</p>
          <div className="flex flex-col gap-1.5">
            {HABITS.map(({ key, label, emoji }) => (
              <Toggle
                key={key}
                checked={habit?.[key] || false}
                onToggle={() => onToggle(key)}
                label={`${emoji} ${label}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
