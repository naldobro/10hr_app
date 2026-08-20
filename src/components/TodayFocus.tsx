import { useLayoutEffect, useRef, useState } from 'react';
import { Sparkles, Pencil, Check } from 'lucide-react';

interface TodayFocusProps {
  text: string;
  /** Human label for the selected day, e.g. "Thu, Aug 20". */
  dayLabel: string;
  onChange: (text: string, persist: boolean) => void;
}

// A per-day "what I'm focusing on today" note. Unlike the Vision Focus card,
// which floats over the timeline, this flows inline in the Track stack and
// wears Track's amber/paper language so it reads as part of the page.
export default function TodayFocus({ text, dayLabel, onChange }: TodayFocusProps) {
  const [editing, setEditing] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Focus the textarea and drop the caret at the end when entering edit mode.
  useLayoutEffect(() => {
    if (editing && taRef.current) {
      const el = taRef.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editing]);

  const done = () => {
    onChange(text, true);
    setEditing(false);
  };

  return (
    <div className="paper-card rounded-2xl paper-shadow paper-border p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span
            className="grid place-items-center w-7 h-7 rounded-lg text-white"
            style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)' }}
          >
            <Sparkles className="w-4 h-4" />
          </span>
          <div className="leading-tight">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Focus</div>
            <div className="text-[11px] ink-text-muted">{dayLabel}</div>
          </div>
        </div>
        {editing ? (
          <button
            onClick={done}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-400/10 transition"
            title="Done"
          >
            <Check className="w-3.5 h-3.5" strokeWidth={3} /> Done
          </button>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold ink-text-muted hover:bg-stone-100 dark:hover:bg-stone-700/40 hover:ink-text transition"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        )}
      </div>

      {editing ? (
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => onChange(e.target.value, false)}
          onBlur={done}
          placeholder="What are you setting out to focus on today?"
          className="block w-full resize-none outline-none bg-transparent text-sm sm:text-[15px] leading-relaxed ink-text placeholder:text-stone-400 min-h-[72px]"
        />
      ) : (
        <div onClick={() => setEditing(true)} className="cursor-text" title="Click to edit">
          {text.trim() ? (
            <p className="text-sm sm:text-[15px] leading-relaxed ink-text whitespace-pre-wrap">{text}</p>
          ) : (
            <p className="text-sm leading-relaxed text-stone-400 italic">
              Click to add today's focus — what should you spend your hours on? ✦
            </p>
          )}
        </div>
      )}
    </div>
  );
}
