import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NotebookPen, Pencil, ChevronRight, Check } from 'lucide-react';

interface DiaryCardProps {
  text: string;
  onChange: (text: string, persist: boolean) => void;
  /** Hide entirely while a goal drawer is open so it never fights the panel. */
  hidden?: boolean;
}

// A simple diary that lives under the Focus card in the floating right-hand rail —
// where you write your goals and track your progression. Warm paper feel, plain
// text box; collapses to a pill to get out of the way.
export default function DiaryCard({ text, onChange, hidden }: DiaryCardProps) {
  const [open, setOpen] = useState(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('vision_diary_open') : null;
    if (saved != null) return saved === '1';
    return typeof window !== 'undefined' ? window.innerWidth >= 1024 : false;
  });
  const [editing, setEditing] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    localStorage.setItem('vision_diary_open', open ? '1' : '0');
  }, [open]);

  useLayoutEffect(() => {
    if (editing && taRef.current) {
      const el = taRef.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editing]);

  if (hidden) return null;

  const done = () => {
    onChange(text, true);
    setEditing(false);
  };

  const bodyHeight = 'min(38vh, 340px)';

  // Collapsed pill.
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="pointer-events-auto flex items-center gap-2 rounded-full paper-card paper-border paper-shadow px-3.5 py-2 ink-text text-[13px] font-semibold hover:shadow-lg transition"
        title="Show diary"
      >
        <NotebookPen className="w-4 h-4 text-amber-600" /> Diary
      </button>
    );
  }

  return (
    <div className="diary-card pointer-events-auto w-[min(340px,calc(100vw-24px))] paper-border paper-shadow rounded-2xl overflow-hidden">
      <style>{`
        .diary-card { background: #fffdf5; }
        .dark .diary-card { background: #24232c; }
        .diary-body { color: #43413b; }
        .dark .diary-body { color: #d7d9e3; }
        .diary-body::placeholder { color: rgba(120,120,120,0.5); }
      `}</style>

      {/* header */}
      <div className="flex items-center justify-between pl-3 pr-2 py-2 border-b border-black/5 dark:border-white/[0.13] bg-white/50 dark:bg-paper/40">
        <div className="flex items-center gap-2">
          <span
            className="grid place-items-center w-6 h-6 rounded-lg"
            style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }}
          >
            <NotebookPen className="w-3.5 h-3.5 text-white" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider ink-text-muted">Diary</span>
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
              className="p-1.5 rounded-lg ink-text-muted hover:bg-stone-100 hover:ink-text transition"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg ink-text-muted hover:bg-stone-100 hover:ink-text transition"
            title="Collapse"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* body — plain text box */}
      {editing ? (
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => onChange(e.target.value, false)}
          onBlur={done}
          placeholder="Today's goals, what I did, how it went…"
          className="diary-body block w-full resize-none outline-none bg-transparent px-4 py-3.5 text-[14px] leading-relaxed"
          style={{ height: bodyHeight }}
        />
      ) : (
        <div
          onClick={() => setEditing(true)}
          className="diary-body px-4 py-3.5 overflow-y-auto cursor-text text-[14px] leading-relaxed"
          style={{ maxHeight: bodyHeight }}
          title="Click to write"
        >
          {text.trim() ? (
            <p className="whitespace-pre-wrap">{text}</p>
          ) : (
            <p className="opacity-50">Today's goals, what I did, how it went…</p>
          )}
        </div>
      )}
    </div>
  );
}
