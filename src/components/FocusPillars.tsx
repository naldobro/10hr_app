import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import type { FocusPillar } from '../types';

interface FocusPillarsProps {
  pillars: FocusPillar[];
  onChange: (pillars: FocusPillar[]) => void;
  /** Whether the Vision tab is active. When false the pills are inert and any open editor closes. */
  active: boolean;
  /** Compact variant used in the stacked mobile nav. */
  compact?: boolean;
}

// Per-pillar accent so the three "things" read as distinct pillars.
const ACCENTS = ['#7c3aed', '#0ea5e9', '#10b981']; // violet, sky, emerald

// The three "focus things" that live in the Vision nav bar. Each pill shows a
// heading you type; clicking one expands a small popover with the longer note.
// Only three, on purpose — more than that is just confusion.
//
// The popover is rendered in a portal on <body> with fixed positioning computed
// from the pill's on-screen box, then clamped to the viewport. The nav is a fixed,
// opaque bar with its own stacking context, so an in-flow `absolute` popover would
// get clipped / painted behind it and could run off a narrow phone's edge — the
// portal sidesteps both.
export default function FocusPillars({ pillars, onChange, active, compact }: FocusPillarsProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  // Close the editor whenever we leave the Vision tab.
  useEffect(() => {
    if (!active) setOpenIndex(null);
  }, [active]);

  // Position the popover under the open pill, clamped to the viewport. Recomputed
  // while open on resize / scroll so it never drifts off-screen or under the nav.
  useLayoutEffect(() => {
    if (openIndex === null) {
      setPos(null);
      return;
    }
    const place = () => {
      const btn = btnRefs.current[openIndex];
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const margin = 8;
      const width = Math.min(320, window.innerWidth - margin * 2);
      // Centre under the pill, then clamp so both edges stay on-screen.
      const left = Math.max(margin, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - margin));
      const top = r.bottom + margin;
      const maxHeight = Math.max(160, window.innerHeight - top - margin);
      setPos({ top, left, width, maxHeight });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [openIndex]);

  // Close on outside click (either the pills row or the portaled popover count as
  // "inside") or Escape.
  useEffect(() => {
    if (openIndex === null) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpenIndex(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenIndex(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openIndex]);

  // When a pill opens with no title yet, drop the caret into the heading field.
  useLayoutEffect(() => {
    if (openIndex !== null && !pillars[openIndex]?.title.trim()) {
      titleRef.current?.focus();
    }
  }, [openIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (i: number, field: keyof FocusPillar, value: string) => {
    const next = pillars.map((p, idx) => (idx === i ? { ...p, [field]: value } : p));
    onChange(next);
  };

  const openPillar = openIndex !== null ? pillars[openIndex] : null;
  const openAccent = openIndex !== null ? ACCENTS[openIndex % ACCENTS.length] : '#7c3aed';

  return (
    <div ref={rootRef} className={`flex items-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
      {pillars.map((pillar, i) => {
        const accent = ACCENTS[i % ACCENTS.length];
        const isOpen = openIndex === i;
        const filled = !!pillar.title.trim();
        const hasBody = !!pillar.body.trim();
        return (
          <button
            key={i}
            ref={(el) => {
              btnRefs.current[i] = el;
            }}
            onClick={() => setOpenIndex(isOpen ? null : i)}
            title={filled ? pillar.title : `Set focus ${i + 1}`}
            className={`group flex items-center rounded-full paper-border transition-all active:scale-95 ${
              compact ? 'gap-1.5 px-2.5 py-1' : 'gap-2 px-3.5 py-2'
            } ${
              isOpen
                ? 'paper-card paper-shadow ring-2 ring-violet-400/40'
                : filled
                ? 'paper-card hover:paper-shadow'
                : 'bg-transparent hover:bg-amber-50 dark:hover:bg-amber-400/10 border-dashed'
            }`}
          >
            {filled ? (
              <span
                className="shrink-0 rounded-full"
                style={{
                  width: compact ? 6 : 7,
                  height: compact ? 6 : 7,
                  background: accent,
                  boxShadow: hasBody ? `0 0 0 3px ${accent}22` : 'none',
                }}
              />
            ) : (
              <Plus className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} ink-text-muted shrink-0`} />
            )}
            <span
              className={`font-semibold truncate ${compact ? 'text-xs max-w-[92px]' : 'text-[13px] max-w-[140px]'} ${
                filled ? 'ink-text' : 'ink-text-muted'
              }`}
            >
              {filled ? pillar.title : `Focus ${i + 1}`}
            </span>
          </button>
        );
      })}

      {openIndex !== null &&
        openPillar &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            className="fixed z-[100] paper-card paper-border paper-shadow rounded-2xl overflow-hidden flex flex-col animate-[pillarIn_0.22s_cubic-bezier(0.16,1,0.3,1)]"
            style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
          >
            <style>{`@keyframes pillarIn { from { opacity: 0; transform: translateY(-6px) scale(0.98); } to { opacity: 1; transform: none; } }`}</style>

            <div className="flex items-center gap-2 px-3 pt-3 pb-2 flex-none">
              <span className="shrink-0 rounded-full" style={{ width: 8, height: 8, background: openAccent }} />
              <input
                ref={titleRef}
                value={openPillar.title}
                onChange={(e) => patch(openIndex, 'title', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                placeholder={`What's focus ${openIndex + 1}?`}
                className="flex-1 min-w-0 bg-transparent outline-none text-[15px] font-bold ink-text placeholder:text-stone-400 placeholder:font-semibold"
              />
            </div>

            <textarea
              value={openPillar.body}
              onChange={(e) => patch(openIndex, 'body', e.target.value)}
              placeholder="More to it — the why, what it looks like, how you'll spend time on it…"
              className="block w-full flex-1 min-h-[120px] resize-none outline-none bg-transparent px-3.5 pb-3.5 pt-1 text-[13px] leading-relaxed ink-text placeholder:text-stone-400 border-t border-black/5 dark:border-white/[0.08]"
            />
          </div>,
          document.body
        )}
    </div>
  );
}
