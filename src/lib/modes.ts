// The Track tab's fixed "baskets" (modes). Picking a mode shifts the tab's accent
// glow to its color and, when you Finish a session, logs it in that color/label.
// These are the ONLY buckets — sessions store `color: <mode key>` and the Timeline
// resolves the key back to `color` here. Legacy sessions may still carry old color
// keys (blue/green/…); those are kept in LEGACY_COLORS for backward display.

export interface Mode {
  key: string;
  label: string;
  color: string; // hex, used for the timeline block + accent glow (dark mode)
}

export const MODES: Mode[] = [
  { key: 'work', label: 'Work', color: '#2563eb' },
  { key: 'content', label: 'Content', color: '#7c3aed' },
  { key: 'outreach', label: 'Outreach', color: '#d97706' },
  { key: 'learning', label: 'Learning', color: '#059669' },
  { key: 'variable', label: 'Variable Efforts', color: '#e11d48' },
];

export const MODE_MAP: Record<string, Mode> = Object.fromEntries(
  MODES.map((m) => [m.key, m])
);

// Pre-modes sessions stored these color keys directly.
const LEGACY_COLORS: Record<string, string> = {
  blue: '#1e40af',
  green: '#059669',
  purple: '#7c3aed',
  orange: '#d97706',
  pink: '#db2777',
  teal: '#0f766e',
};

/** Resolve a stored session `color` (mode key or legacy key) to a hex block color. */
export function resolveColor(color: string): string {
  return MODE_MAP[color]?.color || LEGACY_COLORS[color] || '#2563eb';
}

/** "#2563eb" → "37 99 235", for use in `rgb(var(--glow-rgb) / a)`. */
export function hexToRgbTriple(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}
