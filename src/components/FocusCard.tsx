import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Sparkles, Pencil, ChevronRight, Check } from 'lucide-react';

interface FocusCardProps {
  text: string;
  onChange: (text: string, persist: boolean) => void;
  /** Hide entirely while a goal drawer is open so it never fights the panel. */
  hidden?: boolean;
}

// A floating "what I'm focusing on right now" note pinned to the top-right of the
// timeline. Reads as formatted prose; click to edit. Collapses to a pill so it can
// get out of the way on small screens.
export default function FocusCard({ text, onChange, hidden }: FocusCardProps) {
  const [open, setOpen] = useState(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('vision_focus_open') : null;
    if (saved != null) return saved === '1';
    return typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
  });
  const [editing, setEditing] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    localStorage.setItem('vision_focus_open', open ? '1' : '0');
  }, [open]);

  // Focus the textarea and drop the caret at the end when entering edit mode.
  useLayoutEffect(() => {
    if (editing && taRef.current) {
      const el = taRef.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editing]);

  if (hidden) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute top-3 right-3 z-20 flex items-center gap-2 rounded-full paper-card paper-border paper-shadow px-3.5 py-2 ink-text text-[13px] font-semibold hover:shadow-lg transition"
        title="Show focus"
      >
        <Sparkles className="w-4 h-4 text-violet-500" /> Focus
      </button>
    );
  }

  const done = () => {
    onChange(text, true);
    setEditing(false);
  };

  return (
    <div className="absolute top-3 right-3 z-20 w-[min(340px,calc(100vw-24px))] paper-card paper-border paper-shadow rounded-2xl overflow-hidden animate-[focusIn_0.3s_cubic-bezier(0.16,1,0.3,1)]">
      <style>{`@keyframes focusIn { from { opacity: 0; transform: translateY(-8px) scale(0.98); } to { opacity: 1; transform: none; } }`}</style>

      {/* header */}
      <div className="flex items-center justify-between pl-3 pr-2 py-2 border-b border-black/5 dark:border-white/[0.13] bg-white/40 dark:bg-paper/40">
        <div className="flex items-center gap-2">
          <span
            className="grid place-items-center w-6 h-6 rounded-lg"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider ink-text-muted">Focus</span>
        </div>
        <div className="flex items-center gap-0.5">
          {editing ? (
            <button
              onClick={done}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 transition"
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

      {/* body */}
      {editing ? (
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => onChange(e.target.value, false)}
          onBlur={done}
          placeholder="What's on your mind? What should you focus on and spend your time on right now?"
          className="block w-full resize-none outline-none bg-transparent px-4 py-3.5 text-[13.5px] leading-relaxed ink-text placeholder:text-stone-400"
          style={{ height: 'min(46vh, 320px)' }}
        />
      ) : (
        <div
          onClick={() => setEditing(true)}
          className="px-4 py-3.5 max-h-[min(46vh,320px)] overflow-y-auto cursor-text"
          title="Click to edit"
        >
          {text.trim() ? (
            <p className="text-[13.5px] leading-relaxed ink-text whitespace-pre-wrap">{text}</p>
          ) : (
            <p className="text-[13px] leading-relaxed text-stone-400 italic">
              Click to add your thoughts — what should you focus on and spend your time on right now? ✦
            </p>
          )}
        </div>
      )}
    </div>
  );
}
