import { HabitEntry } from '../types';

// Single source of truth for the recurring-habit definitions used by the
// "Today" strip. The calendar's HabitPanel / HabitMonthView keep their own
// local copies (left untouched on purpose); this module only backs TodayHabits.

export type HabitField = keyof Pick<
  HabitEntry,
  | 'prayer_fajr'
  | 'prayer_dhuhr'
  | 'prayer_asr'
  | 'prayer_maghrib'
  | 'prayer_isha'
  | 'gym'
  | 'outreach'
  | 'learn'
>;

export const PRAYERS: { key: HabitField; label: string }[] = [
  { key: 'prayer_fajr', label: 'Fajr' },
  { key: 'prayer_dhuhr', label: 'Dhuhr' },
  { key: 'prayer_asr', label: 'Asr' },
  { key: 'prayer_maghrib', label: 'Maghrib' },
  { key: 'prayer_isha', label: 'Isha' },
];

export const DAILY_HABITS: { key: HabitField; label: string; icon: string }[] = [
  { key: 'gym', label: 'Gym', icon: '💪' },
  { key: 'outreach', label: 'Outreach', icon: '📨' },
  { key: 'learn', label: 'Learn', icon: '📖' },
];

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Local YYYY-MM-DD for a Date (never toISOString — that shifts by timezone). */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

/**
 * Is `scheduleKey` active on the weekday of `dateStr`?
 * Prayers share the single 'prayer' schedule key; gym/outreach/learn use their
 * own key. No schedule row ⇒ every day (matches the calendar's behaviour).
 */
export function isScheduledForDate(
  scheduleKey: string,
  dateStr: string,
  schedules: Record<string, number[]>
): boolean {
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  return (schedules[scheduleKey] || ALL_DAYS).includes(dow);
}

/**
 * Consecutive scheduled days completed, counting back from today.
 *
 * - Days the habit isn't scheduled are skipped (they neither count nor break).
 * - Today counts if already done; if today is still incomplete the streak is
 *   NOT broken (you've still got the day) — we just resume counting from
 *   yesterday. The first *past* scheduled-but-missed day ends the streak.
 */
export function computeStreak(
  entries: Map<string, HabitEntry>,
  scheduleKey: string,
  schedules: Record<string, number[]>,
  isDone: (entry: HabitEntry | undefined) => boolean,
  maxDays = 90
): number {
  let streak = 0;
  const cursor = new Date();
  const today = todayStr();

  for (let i = 0; i < maxDays; i++) {
    const dateStr = toDateStr(cursor);
    const scheduled = isScheduledForDate(scheduleKey, dateStr, schedules);
    if (scheduled) {
      const done = isDone(entries.get(dateStr));
      if (done) {
        streak++;
      } else if (dateStr === today) {
        // Not done yet today — don't break, just don't count it.
      } else {
        break;
      }
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export const allPrayersDone = (entry: HabitEntry | undefined): boolean =>
  !!entry &&
  entry.prayer_fajr &&
  entry.prayer_dhuhr &&
  entry.prayer_asr &&
  entry.prayer_maghrib &&
  entry.prayer_isha;
