import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
export default function FocusPillars({ pillars, onChange, active, compact }: FocusPillarsProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Close the editor whenever we leave the Vision tab.
  useEffect(() => {
    if (!active) setOpenIndex(null);
  }, [active]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (openIndex === null) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenIndex(null);
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

  return (
    <div ref={rootRef} className={`flex items-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
      {pillars.map((pillar, i) => {
        const accent = ACCENTS[i % ACCENTS.length];
        const isOpen = openIndex === i;
        const filled = !!pillar.title.trim();
        const hasBody = !!pillar.body.trim();
        return (
          <div key={i} className="relative">
            <button
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

            {isOpen && (
              <div
                className={`absolute top-full mt-2 z-[60] w-[min(320px,calc(100vw-24px))] paper-card paper-border paper-shadow rounded-2xl overflow-hidden animate-[pillarIn_0.22s_cubic-bezier(0.16,1,0.3,1)] ${
                  i === pillars.length - 1 ? 'right-0' : 'left-0'
                }`}
              >
                <style>{`@keyframes pillarIn { from { opacity: 0; transform: translateY(-6px) scale(0.98); } to { opacity: 1; transform: none; } }`}</style>

                <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                  <span
                    className="shrink-0 rounded-full"
                    style={{ width: 8, height: 8, background: accent }}
                  />
                  <input
                    ref={titleRef}
                    value={pillar.title}
                    onChange={(e) => patch(i, 'title', e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                    placeholder={`What's focus ${i + 1}?`}
                    className="flex-1 min-w-0 bg-transparent outline-none text-[15px] font-bold ink-text placeholder:text-stone-400 placeholder:font-semibold"
                  />
                </div>

                <textarea
                  value={pillar.body}
                  onChange={(e) => patch(i, 'body', e.target.value)}
                  placeholder="More to it — the why, what it looks like, how you'll spend time on it…"
                  className="block w-full resize-none outline-none bg-transparent px-3.5 pb-3.5 pt-1 text-[13px] leading-relaxed ink-text placeholder:text-stone-400 border-t border-black/5 dark:border-white/[0.08]"
                  style={{ height: 'min(34vh, 220px)' }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
