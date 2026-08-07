import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  FileText,
  NotebookPen,
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Eraser,
} from 'lucide-react';
import { VisionDoc } from '../types';

interface PlannerPanelProps {
  docs: VisionDoc[];
  /** Create a doc in the given month; resolves with the new id (or null on failure). */
  onAdd: (month: string) => Promise<string | null>;
  onUpdate: (id: string, patch: Partial<VisionDoc>, persist: boolean) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (m: string) => {
  const [y, mm] = m.split('-').map(Number);
  return new Date(y, mm - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

export default function PlannerPanel({ docs, onAdd, onUpdate, onDelete, onClose }: PlannerPanelProps) {
  const currentMonth = monthKey(new Date());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Current month is always shown; past months appear once they hold a doc. Newest first.
  const months = useMemo(() => {
    const set = new Set<string>([currentMonth]);
    docs.forEach((d) => set.add(d.month));
    return [...set].sort().reverse();
  }, [docs, currentMonth]);

  const docsByMonth = useMemo(() => {
    const m = new Map<string, VisionDoc[]>();
    docs.forEach((d) => {
      const arr = m.get(d.month) ?? [];
      arr.push(d);
      m.set(d.month, arr);
    });
    return m;
  }, [docs]);

  // Keep a valid selection as docs change (create / delete / switch month).
  useEffect(() => {
    if (selectedId && docs.some((d) => d.id === selectedId)) return;
    const firstCurrent = docs.find((d) => d.month === currentMonth);
    setSelectedId((firstCurrent ?? docs[0])?.id ?? null);
  }, [docs, selectedId, currentMonth]);

  const handleAdd = async (month: string) => {
    const id = await onAdd(month);
    if (id) setSelectedId(id);
  };

  const doc = docs.find((d) => d.id === selectedId) || null;

  return (
    <div className="fixed inset-0 z-[80]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <style>{`
        .doc-body { line-height: 1.65; }
        .doc-body:focus { outline: none; }
        .doc-body h1 { font-size: 1.6rem; font-weight: 700; margin: .6em 0 .3em; }
        .doc-body h2 { font-size: 1.25rem; font-weight: 700; margin: .6em 0 .25em; }
        .doc-body p { margin: .35em 0; }
        .doc-body ul { list-style: disc; padding-left: 1.4rem; margin: .35em 0; }
        .doc-body ol { list-style: decimal; padding-left: 1.4rem; margin: .35em 0; }
        .doc-body li { margin: .15em 0; }
        .doc-body blockquote { border-left: 3px solid #d6d3d1; padding-left: .8rem; margin: .5em 0; color: #78716c; font-style: italic; }
        .doc-body a { color: #2563eb; text-decoration: underline; }
        .doc-body[data-empty="true"]::before { content: attr(data-placeholder); color: #a8a29e; }
      `}</style>
      <div className="absolute inset-x-0 bottom-0 top-[calc(100px+env(safe-area-inset-top))] md:top-[calc(90px+env(safe-area-inset-top))] flex items-center justify-center p-4">
      <div
        className="relative paper-card rounded-2xl border border-black/10 shadow-2xl w-[min(1100px,96vw)] h-[820px] max-h-full flex overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ---------- month rail ---------- */}
        <aside className="w-[248px] flex-none flex flex-col border-r border-black/5 bg-amber-50/40">
          <div className="px-4 pt-4 pb-3 border-b border-black/5 flex items-center gap-2">
            <NotebookPen className="w-5 h-5 ink-text flex-none" />
            <div className="min-w-0">
              <h3 className="text-[15px] font-bold ink-text leading-none">Planner</h3>
              <p className="text-[11px] ink-text-muted mt-1 leading-none">Month-by-month notes & plans</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {months.map((m) => {
              const list = docsByMonth.get(m) ?? [];
              return (
                <div key={m} className="px-2 mb-1">
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="text-[11px] tracking-wider uppercase font-bold ink-text-muted truncate">
                        {monthLabel(m)}
                      </span>
                      {m === currentMonth && (
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5 leading-none flex-none">
                          NOW
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleAdd(m)}
                      className="p-1 rounded-md ink-text-muted hover:ink-text hover:bg-white/70 transition flex-none"
                      title={`New doc in ${monthLabel(m)}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {list.length === 0 ? (
                    <button
                      onClick={() => handleAdd(m)}
                      className="w-full text-left text-[12px] ink-text-muted/70 hover:ink-text px-2.5 py-1.5 rounded-lg hover:bg-white/60 transition"
                    >
                      + Add the first doc
                    </button>
                  ) : (
                    list.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setSelectedId(d.id)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition ${
                          d.id === selectedId ? 'bg-white shadow-sm ink-text' : 'ink-text-muted hover:bg-white/60 hover:ink-text'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5 flex-none opacity-70" />
                        <span className="text-[13px] truncate">{d.title || 'Untitled'}</span>
                      </button>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* ---------- editor ---------- */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex justify-end px-3 pt-3">
            <button onClick={onClose} className="p-1.5 rounded-lg ink-text-muted hover:bg-stone-100 transition" title="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
          {doc ? (
            <DocEditor
              key={doc.id}
              doc={doc}
              onChange={(patch, persist) => onUpdate(doc.id, patch, persist)}
              onDelete={() => onDelete(doc.id)}
            />
          ) : (
            <div className="flex-1 grid place-items-center px-6 -mt-8">
              <div className="text-center max-w-xs">
                <FileText className="w-10 h-10 ink-text-muted/40 mx-auto mb-3" />
                <p className="text-sm ink-text-muted mb-4">
                  No document open. Start planning {monthLabel(currentMonth)}.
                </p>
                <button
                  onClick={() => handleAdd(currentMonth)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-sm font-semibold transition"
                >
                  <Plus className="w-4 h-4" /> New doc
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

function DocEditor({
  doc,
  onChange,
  onDelete,
}: {
  doc: VisionDoc;
  onChange: (patch: Partial<VisionDoc>, persist: boolean) => void;
  onDelete: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(doc.title);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [confirmDel, setConfirmDel] = useState(false);
  const latest = useRef({ title: doc.title, content: doc.content });
  const saveTimer = useRef<number | undefined>(undefined);
  const savedTimer = useRef<number | undefined>(undefined);

  const updateEmpty = () => {
    const el = bodyRef.current;
    if (el) el.dataset.empty = el.textContent && el.textContent.trim() ? 'false' : 'true';
  };

  // Seed the editor once; keyed by doc.id in the parent so switching docs remounts.
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.innerHTML = doc.content || '';
      updateEmpty();
    }
    return () => {
      // Flush any pending edit when leaving this doc.
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        onChange({ ...latest.current }, true);
      }
      window.clearTimeout(savedTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistNow = () => {
    onChange({ ...latest.current }, true);
    setStatus('saved');
    window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setStatus('idle'), 1500);
  };

  const scheduleSave = () => {
    setStatus('saving');
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = undefined;
      persistNow();
    }, 700);
  };

  const onTitle = (v: string) => {
    setTitle(v);
    latest.current.title = v;
    scheduleSave();
  };

  const onBodyInput = () => {
    const el = bodyRef.current;
    if (el) latest.current.content = el.innerHTML;
    updateEmpty();
    scheduleSave();
  };

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    bodyRef.current?.focus();
    if (bodyRef.current) latest.current.content = bodyRef.current.innerHTML;
    updateEmpty();
    scheduleSave();
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* title + status */}
      <div className="px-6 sm:px-10 pt-1">
        <div className="flex items-start gap-3">
          <input
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            onBlur={persistNow}
            placeholder="Untitled"
            className="flex-1 min-w-0 text-2xl font-bold ink-text bg-transparent outline-none placeholder:ink-text-muted/50"
          />
          <div className="flex items-center gap-2 pt-2 flex-none">
            <span className="text-[11px] ink-text-muted w-16 text-right">
              {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved ✓' : ''}
            </span>
            {confirmDel ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={onDelete}
                  className="text-[11px] font-bold text-red-600 px-2 py-1 rounded hover:bg-red-50 transition"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDel(false)}
                  className="text-[11px] ink-text-muted px-1.5 py-1 rounded hover:bg-stone-100 transition"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDel(true)}
                className="p-1.5 rounded-lg ink-text-muted hover:text-red-600 hover:bg-red-50 transition"
                title="Delete this doc"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* toolbar */}
      <div className="px-6 sm:px-10 py-2 mt-1 flex items-center gap-0.5 flex-wrap border-b border-black/5">
        <TB onClick={() => exec('bold')} title="Bold"><Bold className="w-4 h-4" /></TB>
        <TB onClick={() => exec('italic')} title="Italic"><Italic className="w-4 h-4" /></TB>
        <TB onClick={() => exec('underline')} title="Underline"><Underline className="w-4 h-4" /></TB>
        <Sep />
        <TB onClick={() => exec('formatBlock', '<h1>')} title="Heading 1"><Heading1 className="w-4 h-4" /></TB>
        <TB onClick={() => exec('formatBlock', '<h2>')} title="Heading 2"><Heading2 className="w-4 h-4" /></TB>
        <TB onClick={() => exec('formatBlock', '<blockquote>')} title="Quote"><Quote className="w-4 h-4" /></TB>
        <Sep />
        <TB onClick={() => exec('insertUnorderedList')} title="Bulleted list"><List className="w-4 h-4" /></TB>
        <TB onClick={() => exec('insertOrderedList')} title="Numbered list"><ListOrdered className="w-4 h-4" /></TB>
        <Sep />
        <TB
          onClick={() => {
            exec('removeFormat');
            exec('formatBlock', '<p>');
          }}
          title="Clear formatting"
        >
          <Eraser className="w-4 h-4" />
        </TB>
      </div>

      {/* body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-10 py-5">
        <div
          ref={bodyRef}
          contentEditable
          suppressContentEditableWarning
          onInput={onBodyInput}
          onBlur={persistNow}
          data-placeholder="Start writing your plan…"
          className="doc-body min-h-full text-[15px] ink-text"
        />
      </div>
    </div>
  );
}

function TB({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      // Prevent the button from stealing selection/focus from the editor before the command runs.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className="w-8 h-8 grid place-items-center rounded-lg ink-text-muted hover:ink-text hover:bg-stone-100 transition"
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="w-px h-5 bg-black/10 mx-1" />;
}
