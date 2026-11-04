// Pure helpers for the Creative Strategist auto-planner. A planner "week" is a
// Monday→Sunday span that becomes one VisionDoc page, pre-seeded with a heading
// per day so you can type directly under today's date. All dates are LOCAL
// 'YYYY-MM-DD' strings (never toISOString, which would shift by timezone).
import { iso, parseISO, addDays } from './visionUtils';

/** The Monday (00:00 local) of the week containing `d`. */
export function weekStartMonday(d: Date): Date {
  const base = new Date(d);
  base.setHours(0, 0, 0, 0);
  // getDay(): 0=Sun..6=Sat. Shift so Monday is the start of the week.
  const back = (base.getDay() + 6) % 7;
  return addDays(base, -back);
}

/** ISO 'YYYY-MM-DD' of the Monday of `d`'s week — the identity key for a page. */
export function weekStartISO(d: Date): string {
  return iso(weekStartMonday(d));
}

const shortDay = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** Monday start, Sunday end, and a human label for the week starting `startISO`.
 * Label collapses the month when both ends share it: "Nov 3 – 9" vs "Oct 27 – Nov 2". */
export function weekRange(startISO: string): { startISO: string; endISO: string; label: string } {
  const start = parseISO(startISO);
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const label = sameMonth
    ? `${shortDay(start)} – ${end.getDate()}`
    : `${shortDay(start)} – ${shortDay(end)}`;
  return { startISO, endISO: iso(end), label };
}

/** Which month 'YYYY-MM' a boundary week belongs to: the one containing its
 * Thursday (ISO rule) — so a week that's mostly in the next month files there. */
export function monthBucket(startISO: string): string {
  const thu = addDays(parseISO(startISO), 3);
  return `${thu.getFullYear()}-${String(thu.getMonth() + 1).padStart(2, '0')}`;
}

/** The 7 days of the week starting `startISO`, each with its ISO date + a label
 * like "Mon · Nov 3". */
export function weekDays(startISO: string): { iso: string; label: string }[] {
  const start = parseISO(startISO);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
    return { iso: iso(d), label: `${wd} · ${shortDay(d)}` };
  });
}

/** Seed HTML for a fresh week page: an <h3> heading per day (Mon→Sun) carrying a
 * `data-day` anchor used to scroll/focus today, each followed by an empty line to
 * type into. Matches the `.doc-body h3` convention the DocEditor renders. */
export function seedDayHeadersHTML(startISO: string): string {
  return weekDays(startISO)
    .map((d) => `<h3 data-day="${d.iso}">${d.label}</h3><p><br></p>`)
    .join('');
}

/**
 * Re-assert the day headings in a week page as managed structure.
 *
 * Day headings carry the `data-day` anchor that "jump to today" and the today-peek
 * depend on. But the planner body is a free-form contentEditable, and some edits
 * (paste, select-across, a browser serialising a heading's computed CSS) can flatten
 * an `<h3 data-day=…>` into a styled `<p><span style="font-size:1.2rem;font-weight:700">`
 * — losing BOTH the tag and the anchor. Rather than try to block every browser quirk,
 * we treat the headings as derived from the week definition and continuously repair
 * them: any top-level block whose text is exactly a day label for this week is rewritten
 * to the canonical `<h3 data-day="iso">Label</h3>`, dropping the mangled inline wrappers.
 *
 * Idempotent and conservative — only exact day-label matches are touched, everything the
 * user actually wrote is left alone. Returns the original string unchanged when nothing
 * needed fixing (so it won't churn the caret/DOM in the common case).
 */
export function repairWeekHeadings(html: string, startISO: string): string {
  if (!html || typeof document === 'undefined') return html;
  const labelToIso = new Map(weekDays(startISO).map((d) => [d.label, d.iso] as const));
  const div = document.createElement('div');
  div.innerHTML = html;
  let changed = false;
  Array.from(div.children).forEach((el) => {
    const label = (el.textContent || '').trim();
    const iso = labelToIso.get(label);
    if (!iso) return;
    // Already the canonical anchored <h3> with no stray inline wrappers? Leave it.
    if (el.tagName === 'H3' && el.getAttribute('data-day') === iso && el.children.length === 0) return;
    const h3 = document.createElement('h3');
    h3.setAttribute('data-day', iso);
    h3.textContent = label;
    el.replaceWith(h3);
    changed = true;
  });
  return changed ? div.innerHTML : html;
}
