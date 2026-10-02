import { Check, Flame, Sparkles } from 'lucide-react';
import { HabitEntry } from '../types';
import {
  PRAYERS,
  DAILY_HABITS,
  HabitField,
  isScheduledForDate,
  todayStr,
} from '../lib/habits';

interface TodayHabitsProps {
  habit: HabitEntry | null;
  schedules: Record<string, number[]>;
  /** Streak counts keyed by schedule key: 'prayer' | 'gym' | 'outreach' | 'learn'. */
  streaks: Record<string, number>;
  onToggle: (field: HabitField) => void;
}

function StreakFlame({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-bold text-xs">
      <Flame className="w-3.5 h-3.5 fill-amber-500/20" />
      {count}
    </span>
  );
}

/** Small circular progress ring with the live count in the middle. */
function Ring({ done, total, complete }: { done: number; total: number; complete: boolean }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? done / total : 0;
  return (
    <div className="relative w-12 h-12 flex-shrink-0">
      <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          strokeWidth="4"
          className="stroke-stone-200 dark:stroke-white/10"
        />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={`transition-[stroke-dashoffset] duration-500 ${
            complete ? 'stroke-emerald-400' : 'stroke-emerald-500'
          }`}
          style={complete ? { filter: 'drop-shadow(0 0 5px rgba(16,185,129,0.6))' } : undefined}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-[11px] font-black tabular-nums ${complete ? 'text-emerald-500' : 'ink-text'}`}>
          {done}
          <span className="ink-text-muted font-bold">/{total}</span>
        </span>
      </div>
    </div>
  );
}

export default function TodayHabits({ habit, schedules, streaks, onToggle }: TodayHabitsProps) {
  const date = todayStr();
  const prayerScheduled = isScheduledForDate('prayer', date, schedules);
  const scheduledHabits = DAILY_HABITS.filter(h => isScheduledForDate(h.key, date, schedules));

  const prayersDone = PRAYERS.filter(p => habit?.[p.key]).length;
  const habitsDone = scheduledHabits.filter(h => habit?.[h.key]).length;

  const total = (prayerScheduled ? PRAYERS.length : 0) + scheduledHabits.length;
  const done = (prayerScheduled ? prayersDone : 0) + habitsDone;
  const allDone = total > 0 && done === total;

  // Nothing scheduled today — don't render an empty card.
  if (total === 0) return null;

  const niceDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="paper-card rounded-2xl paper-shadow p-4 sm:p-6 paper-border">
      {/* Header: title + overall ring */}
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold ink-text">Today</h3>
            {allDone && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                <Sparkles className="w-3 h-3" /> All done
              </span>
            )}
          </div>
          <p className="text-[11px] sm:text-xs ink-text-muted font-medium mt-0.5">{niceDate}</p>
        </div>
        <Ring done={done} total={total} complete={allDone} />
      </div>

      {/* Salah — five one-tap prayer pills */}
      {prayerScheduled && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.15em] ink-text-muted">
              Salah 🕌
            </span>
            <span className="text-[11px] ink-text-muted font-bold tabular-nums">{prayersDone}/5</span>
            <StreakFlame count={streaks.prayer || 0} />
          </div>
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {PRAYERS.map(({ key, label }) => {
              const on = !!habit?.[key];
              return (
                <button
                  key={key}
                  onClick={() => onToggle(key)}
                  className={`group relative flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border text-center transition-all duration-200 active:scale-95 ${
                    on
                      ? 'bg-emerald-500/15 dark:bg-emerald-500/20 border-emerald-500/30 dark:border-emerald-400/40 shadow-[0_0_14px_rgba(16,185,129,0.25)] dark:shadow-[0_0_16px_rgba(16,185,129,0.3)]'
                      : 'bg-stone-100 dark:bg-white/[0.06] border-stone-200 dark:border-white/10 hover:bg-stone-200 dark:hover:bg-white/[0.1]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 ${
                      on ? 'bg-emerald-500 scale-100' : 'bg-stone-300/60 dark:bg-white/15 scale-90'
                    }`}
                  >
                    {on && <Check className="w-3 h-3 text-white stroke-[3]" />}
                  </div>
                  <span
                    className={`text-[10px] sm:text-[11px] font-bold leading-none ${
                      on ? 'text-emerald-600 dark:text-emerald-300' : 'ink-text-muted'
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily habits — big one-tap chips with streaks */}
      {scheduledHabits.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {scheduledHabits.map(({ key, label, icon }) => {
            const on = !!habit?.[key];
            return (
              <button
                key={key}
                onClick={() => onToggle(key)}
                className={`flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl border transition-all duration-200 active:scale-[0.98] ${
                  on
                    ? 'bg-emerald-500/15 dark:bg-emerald-500/20 border-emerald-500/30 dark:border-emerald-400/40 shadow-[0_0_14px_rgba(16,185,129,0.25)] dark:shadow-[0_0_16px_rgba(16,185,129,0.3)]'
                    : 'bg-stone-100 dark:bg-white/[0.06] border-stone-200 dark:border-white/10 hover:bg-stone-200 dark:hover:bg-white/[0.1]'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-lg flex-shrink-0">{icon}</span>
                  <span
                    className={`text-sm font-bold truncate ${
                      on ? 'text-emerald-600 dark:text-emerald-300' : 'ink-text'
                    }`}
                  >
                    {label}
                  </span>
                </span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <StreakFlame count={streaks[key] || 0} />
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 ${
                      on ? 'bg-emerald-500 scale-100' : 'bg-stone-300/60 dark:bg-white/15 scale-90'
                    }`}
                  >
                    {on && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
