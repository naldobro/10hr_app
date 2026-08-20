import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Sparkles, Pencil, Check, X } from 'lucide-react';

interface TodayFocusProps {
  text: string;
  /** Human label for the selected day, e.g. "Thu, Aug 20". */
  dayLabel: string;
  onChange: (text: string, persist: boolean) => void;
}

// A per-day "what I'm focusing on today" note. Lives as a compact pill in the
// toolbar (next to Undo/Redo) so it never eats calendar space; clicking it drops
// down a floating panel anchored to the pill. Scoped to the selected day.
export default function TodayFocus({ text, dayLabel, onChange }: TodayFocusProps) {
  // Default to open on every mount — opening the app or returning to this page
  // reopens it. Closing only dismisses it for the current session.
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const done = () => {
    onChange(text, true);
    setEditing(false);
  };

  // Focus the textarea and drop the caret at the end when entering edit mode.
  useLayoutEffect(() => {
    if (editing && taRef.current) {
      const el = taRef.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editing]);

  // Close the dropdown on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        if (editing) done();
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editing) done();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, text]);

  const hasNote = text.trim().length > 0;

  return (
    <div ref={wrapRef} className="relative">
      {/* Toolbar pill trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ink-text transition-colors paper-border ${
          open ? 'bg-stone-300 dark:bg-stone-700' : 'bg-stone-200 hover:bg-stone-300 dark:hover:bg-stone-700'
        }`}
        title="Today's focus"
      >
        <Sparkles className={`w-4 h-4 ${hasNote ? 'text-violet-500' : 'text-amber-500'}`} />
        <span className="hidden sm:inline">Focus</span>
      </button>

      {/* Floating panel anchored below-right of the pill */}
      {open && (
        <div className="absolute top-full right-0 mt-2 z-40 w-[min(340px,calc(100vw-24px))] paper-card paper-border paper-shadow rounded-2xl overflow-hidden animate-[focusIn_0.22s_cubic-bezier(0.16,1,0.3,1)]">
          <style>{`@keyframes focusIn { from { opacity: 0; transform: translateY(-8px) scale(0.98); } to { opacity: 1; transform: none; } }`}</style>

          {/* header */}
          <div className="flex items-center justify-between pl-3 pr-2 py-2 border-b border-black/5 dark:border-white/[0.13] bg-white/40 dark:bg-paper/40">
            <div className="flex items-center gap-2">
              <span
                className="grid place-items-center w-7 h-7 rounded-lg"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}
              >
                <Sparkles className="w-4 h-4 text-white" />
              </span>
              <div className="leading-tight">
                <div className="text-[11px] font-bold uppercase tracking-wider ink-text-muted">Focus</div>
                <div className="text-[11px] ink-text-muted">{dayLabel}</div>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              {editing ? (
                <button
                  onClick={done}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-400/10 transition"
                  title="Done"
                >
                  <Check className="w-3.5 h-3.5" strokeWidth={3} /> Done
                </button>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="p-1.5 rounded-lg ink-text-muted hover:bg-stone-100 dark:hover:bg-stone-700/40 hover:ink-text transition"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => {
                  if (editing) done();
                  setOpen(false);
                }}
                className="p-1.5 rounded-lg ink-text-muted hover:bg-stone-100 dark:hover:bg-stone-700/40 hover:ink-text transition"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* body */}
          {editing ? (
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => onChange(e.target.value, false)}
              onBlur={done}
              placeholder="What are you setting out to focus on today? What should you spend your hours on?"
              className="block w-full resize-none outline-none bg-transparent px-4 py-3.5 text-[13.5px] leading-relaxed ink-text placeholder:text-stone-400"
              style={{ height: 'min(46vh, 320px)' }}
            />
          ) : (
            <div
              onClick={() => setEditing(true)}
              className="px-4 py-3.5 max-h-[min(46vh,320px)] overflow-y-auto cursor-text"
              title="Click to edit"
            >
              {hasNote ? (
                <p className="text-[13.5px] leading-relaxed ink-text whitespace-pre-wrap">{text}</p>
              ) : (
                <p className="text-[13px] leading-relaxed text-stone-400 italic">
                  Click to add today's focus — what should you spend your hours on? ✦
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
