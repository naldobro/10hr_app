export const DAY = 86400000;

// Accent palette for goals (deepened for contrast on the warm-paper ground)
export const GOAL_COLORS = [
  '#06b6d4', // cyan
  '#7c3aed', // violet
  '#d97706', // amber (brand)
  '#e11d48', // rose
  '#059669', // emerald
  '#2563eb', // blue
];

// Neutral tone for a standalone (unattached) milestone.
export const MILESTONE_NEUTRAL = '#78716c'; // stone-500

export function todayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function iso(d: Date): string {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

export function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

export function daysUntil(deadline: string): number {
  return Math.round((parseISO(deadline).getTime() - todayMidnight().getTime()) / DAY);
}

export function fmtDate(s: string): string {
  return parseISO(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtDayMonth(s: string): { day: string; month: string } {
  const d = parseISO(s);
  return {
    day: String(d.getDate()),
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  };
}

export function relText(deadline: string): string {
  const d = daysUntil(deadline);
  if (d === 0) return 'due today';
  if (d > 0) return 'in ' + d + ' day' + (d === 1 ? '' : 's');
  return Math.abs(d) + ' day' + (d === -1 ? '' : 's') + ' ago';
}

// Urgency bucket drives the countdown colour on each card.
export type Urgency = 'past' | 'now' | 'soon' | 'far';

export function urgency(deadline: string | null): Urgency {
  if (!deadline) return 'far';
  const d = daysUntil(deadline);
  if (d < 0) return 'past';
  if (d <= 7) return 'now';
  if (d <= 30) return 'soon';
  return 'far';
}
