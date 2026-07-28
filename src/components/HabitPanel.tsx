import { HabitEntry } from '../types';

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
  { key: 'gym' as const, label: 'Gym' },
  { key: 'outreach' as const, label: 'Outreach' },
  { key: 'learn' as const, label: 'Learn' },
];

export default function HabitPanel({ date, habit, onToggle }: HabitPanelProps) {
  const prayerCount = habit
    ? [habit.prayer_fajr, habit.prayer_dhuhr, habit.prayer_asr, habit.prayer_maghrib, habit.prayer_isha].filter(Boolean).length
    : 0;

  const formatDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  return (
    <div className="paper-card rounded-2xl paper-shadow p-6 paper-border animate-in fade-in slide-in-from-top-2 duration-200">
      <h3 className="text-lg font-bold ink-text mb-4">{formatDate(date)}</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="font-bold ink-text">Prayer</h4>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              prayerCount >= 5 ? 'bg-emerald-100 text-emerald-700' :
              prayerCount === 4 ? 'bg-amber-100 text-amber-700' :
              'bg-stone-100 text-stone-500'
            }`}>
              {prayerCount}/5
            </span>
          </div>
          <div className="space-y-2">
            {PRAYERS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={habit?.[key] || false}
                  onChange={() => onToggle(key)}
                  className="w-5 h-5 rounded border-stone-300 text-amber-600 focus:ring-amber-600 cursor-pointer"
                />
                <span className={`font-medium transition-colors ${
                  habit?.[key] ? 'ink-text' : 'ink-text-muted group-hover:text-stone-600'
                }`}>
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-bold ink-text mb-3">Habits</h4>
          <div className="space-y-2">
            {HABITS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={habit?.[key] || false}
                  onChange={() => onToggle(key)}
                  className="w-5 h-5 rounded border-stone-300 text-amber-600 focus:ring-amber-600 cursor-pointer"
                />
                <span className={`font-medium transition-colors ${
                  habit?.[key] ? 'ink-text' : 'ink-text-muted group-hover:text-stone-600'
                }`}>
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
