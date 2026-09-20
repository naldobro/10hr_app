import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Plus, Check, Flag, CalendarClock, Target, Settings2, X, Sparkles } from 'lucide-react';
import { VisionGoal, StageBubble } from '../types';
import { daysUntil, fmtDayMonth, urgency, Urgency } from '../lib/visionUtils';

// The free-form canvas uses a logical page at least this big, so a layout authored
// on a wide screen isn't crushed into a narrow column on a phone (you scroll instead).
const MIN_PAGE_W = 1280;
const MIN_PAGE_H = 640;

const URGENCY_COLOR: Record<Urgency, string> = {
  past: '#e11d48',
  now: '#e11d48',
  soon: '#d97706',
  far: '#57534e',
};

// Flat, modern chip styling. Emerald = lean in, rose = steer clear. Static Tailwind
// classes (no gradients / blur) so light stays crisp white and dark goes pitch black
// with coloured text.
const KIND = {
  focus: {
    dot: '#10b981',
    add: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10',
    chip: 'bg-white dark:bg-black border-emerald-500/40',
    text: 'text-stone-800 dark:text-emerald-300',
  },
  avoid: {
    dot: '#f43f5e',
    add: 'text-rose-600 dark:text-rose-400 border-rose-500/40 hover:bg-rose-500/10',
    chip: 'bg-white dark:bg-black border-rose-500/40',
    text: 'text-stone-800 dark:text-rose-300',
  },
} as const;

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'b' + Date.now() + Math.random().toString(36).slice(2, 6);

interface Props {
  stages: VisionGoal[]; // goals with a deadline, sorted earliest → latest
  milestones: VisionGoal[]; // every milestone item (attached & unattached)
  nextId: string | null; // the current stage (nearest un-done deadline)
  bubbles: Record<string, StageBubble[]>;
  onBubblesChange: (goalId: string, next: StageBubble[]) => void;
  onEditGoal: (id: string, patch: Partial<VisionGoal>, persist: boolean) => void;
  onOpenGoal: (id: string) => void; // open the full GoalDrawer
  onAddMilestone: (goalId: string) => void;
  onToggleMilestone: (id: string, done: boolean) => void;
  viewportW: number;
}

export default function StageBook({
  stages,
  milestones,
  nextId,
  bubbles,
  onBubblesChange,
  onEditGoal,
  onOpenGoal,
  onAddMilestone,
  onToggleMilestone,
  viewportW,
}: Props) {
  const narrow = viewportW < 640;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingBubble, setEditingBubble] = useState<{ id: string; text: string } | null>(null);
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null);
  const [turn, setTurn] = useState<'next' | 'prev'>('next');
  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollWrapRef = useRef<HTMLDivElement>(null);
  const prevIndexRef = useRef(0);
  // Size of one "page" (the visible canvas). Bubble x/y are fractions of this, so
  // the default view is unchanged; the surface itself grows past it for scrolling.
  const [base, setBase] = useState({ w: 0, h: 0 });

  const activeIndex = Math.max(0, stages.findIndex((s) => s.id === activeId));

  // Keep a valid active stage: default to the current one, and recover if it vanishes.
  useEffect(() => {
    if (stages.length === 0) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    if (!activeId || !stages.some((s) => s.id === activeId)) {
      setActiveId(nextId && stages.some((s) => s.id === nextId) ? nextId : stages[0].id);
    }
  }, [stages, nextId, activeId]);

  const goTo = (id: string) => {
    const to = stages.findIndex((s) => s.id === id);
    setTurn(to >= prevIndexRef.current ? 'next' : 'prev');
    prevIndexRef.current = to;
    setEditingBubble(null);
    setActiveId(id);
  };

  const active = stages.find((s) => s.id === activeId) || null;
  const pageBubbles = useMemo(() => (activeId ? bubbles[activeId] ?? [] : []), [bubbles, activeId]);
  const stageMs = useMemo(
    () => (activeId ? milestones.filter((m) => m.goal_id === activeId) : []),
    [milestones, activeId]
  );

  // Measure the visible canvas ("one page") so bubbles keep their relative spots.
  // Re-runs per stage because the page subtree remounts (keyed by active.id).
  useLayoutEffect(() => {
    const el = scrollWrapRef.current;
    if (!el) return;
    const measure = () =>
      setBase({ w: Math.max(el.clientWidth, MIN_PAGE_W), h: Math.max(el.clientHeight, MIN_PAGE_H) });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeId]);

  // The scrollable surface: at least 1.5 pages each way (so bars always show and
  // there's room to drag into), and it keeps ~half a page of empty space past the
  // furthest bubble so you can always scroll out for more room.
  const surface = useMemo(() => {
    let maxX = 1;
    let maxY = 1;
    for (const b of pageBubbles) {
      if (b.x > maxX) maxX = b.x;
      if (b.y > maxY) maxY = b.y;
    }
    return {
      w: Math.max(base.w * 1.5, (maxX + 0.5) * base.w),
      h: Math.max(base.h * 1.5, (maxY + 0.6) * base.h),
    };
  }, [pageBubbles, base]);

  const growTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  const commit = (next: StageBubble[]) => activeId && onBubblesChange(activeId, next);

  const addBubble = (kind: StageBubble['kind']) => {
    const b: StageBubble = { id: uid(), text: '', kind, x: 0.28 + Math.random() * 0.44, y: 0.3 + Math.random() * 0.4 };
    commit([...pageBubbles, b]);
    setEditingBubble({ id: b.id, text: '' });
  };

  const commitText = (id: string, text: string) => {
    const t = text.trim();
    // An empty bubble was just an accidental add — drop it instead of leaving a blank.
    commit(t ? pageBubbles.map((b) => (b.id === id ? { ...b, text: t } : b)) : pageBubbles.filter((b) => b.id !== id));
    setEditingBubble(null);
  };

  const flipKind = (id: string) =>
    commit(
      pageBubbles.map((b) => (b.id === id && b.kind !== 'note' ? { ...b, kind: b.kind === 'focus' ? 'avoid' : 'focus' } : b))
    );

  const removeBubble = (id: string) => commit(pageBubbles.filter((b) => b.id !== id));

  const onBubblePointerDown = (e: React.PointerEvent, b: StageBubble) => {
    // Phones: canvas is read-only (view + scroll) so nothing moves by accident.
    if (narrow) return;
    if (e.button !== 0 || editingBubble?.id === b.id) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
      moved = true;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect || base.w === 0 || base.h === 0) return;
      // Fractions are relative to one page (base), so 1.0 = a page edge. rect.left
      // shifts with scroll, so this stays correct wherever the surface is scrolled.
      const maxFX = surface.w / base.w - 0.03;
      const maxFY = surface.h / base.h - 0.04;
      const x = Math.min(maxFX, Math.max(0.02, (ev.clientX - rect.left) / base.w));
      const y = Math.min(maxFY, Math.max(0.03, (ev.clientY - rect.top) / base.h));
      setDragPos({ id: b.id, x, y });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDragPos((d) => {
        if (d && d.id === b.id) commit(pageBubbles.map((bb) => (bb.id === b.id ? { ...bb, x: d.x, y: d.y } : bb)));
        return null;
      });
      if (!moved) setEditingBubble({ id: b.id, text: b.text });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ---- empty state ----
  if (stages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="paper-card paper-border rounded-3xl p-10 max-w-md text-center">
          <Sparkles className="w-8 h-8 mx-auto text-amber-500" />
          <h2 className="mt-4 text-xl font-bold ink-text">Your journey, one stage at a time</h2>
          <p className="mt-2 text-sm ink-text-muted leading-relaxed">
            Every goal with a deadline becomes a stage in this book. Add a goal and give it a date — it'll show up here
            as a page you can fill with focus bubbles and milestones.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex min-h-0 relative overflow-hidden">
      <style>{`
        @keyframes stage-in-next { from { opacity: 0; transform: translateX(26px) rotateY(-6deg) scale(.985); } to { opacity: 1; transform: none; } }
        @keyframes stage-in-prev { from { opacity: 0; transform: translateX(-26px) rotateY(6deg) scale(.985); } to { opacity: 1; transform: none; } }
        .stage-page-next { animation: stage-in-next .28s cubic-bezier(.22,.7,.3,1) both; }
        .stage-page-prev { animation: stage-in-prev .28s cubic-bezier(.22,.7,.3,1) both; }
        /* Always-visible, reliable scrollbars on the bubble canvas (both axes). */
        .stage-scroll { scrollbar-width: thin; scrollbar-color: rgba(160,160,160,0.45) transparent; }
        .stage-scroll::-webkit-scrollbar { width: 12px; height: 12px; }
        .stage-scroll::-webkit-scrollbar-track { background: transparent; }
        .stage-scroll::-webkit-scrollbar-thumb { background: rgba(160,160,160,0.4); border-radius: 999px; border: 3px solid transparent; background-clip: content-box; }
        .stage-scroll::-webkit-scrollbar-thumb:hover { background: rgba(190,190,190,0.65); background-clip: content-box; }
        .stage-scroll::-webkit-scrollbar-corner { background: transparent; }
      `}</style>

      {/* ---------------- Page ---------------- */}
      <div className="flex-1 min-w-0 relative flex items-stretch p-4 sm:p-6" style={{ perspective: 1400 }}>
        {active && (
          <div
            key={active.id}
            className={`relative flex-1 min-w-0 flex flex-col rounded-2xl overflow-hidden bg-white dark:bg-black dyn-glow border border-black/10 dark:border-white/10 ${
              turn === 'next' ? 'stage-page-next' : 'stage-page-prev'
            }`}
          >
            {/* thin accent line at the very top */}
            <div className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none" style={{ background: active.color }} />

            {/* giant faint stage-number watermark — pure graphic depth, no gradient */}
            <div
              className="absolute -bottom-8 right-2 pointer-events-none select-none font-mono font-black leading-none text-black/[0.035] dark:text-white/[0.05]"
              style={{ fontSize: 'min(42vh, 360px)' }}
            >
              {String(activeIndex + 1).padStart(2, '0')}
            </div>

            {/* header */}
            <div className="relative px-6 sm:px-10 pt-7 sm:pt-9">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span
                    className="font-mono font-black text-[40px] sm:text-[52px] leading-none tracking-tighter"
                    style={{ color: active.color }}
                  >
                    {String(activeIndex + 1).padStart(2, '0')}
                  </span>
                  <div className="flex flex-col leading-none gap-1 pt-1">
                    <span className="font-mono text-[10px] tracking-[0.3em] uppercase ink-text-muted">Stage</span>
                    <span className="font-mono text-[10px] tracking-[0.3em] uppercase ink-text-muted">
                      / {String(stages.length).padStart(2, '0')}
                    </span>
                  </div>
                </div>
                <StatusPill goal={active} />
              </div>

              {/* journey progress — one segment per stage */}
              <div className="mt-5 flex items-center gap-1">
                {stages.map((s, i) => (
                  <span
                    key={s.id}
                    className="h-[3px] rounded-full transition-all duration-300"
                    style={{
                      width: i === activeIndex ? 36 : 14,
                      background:
                        i === activeIndex ? active.color : s.done ? `${active.color}80` : 'rgba(128,128,128,0.3)',
                    }}
                  />
                ))}
              </div>

              {/* editable heading = the goal you're chasing */}
              <h1
                key={active.id + '-h'}
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                onBlur={(e) => {
                  const t = e.currentTarget.textContent?.trim() || 'Untitled';
                  if (t !== active.title) onEditGoal(active.id, { title: t }, true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    (e.currentTarget as HTMLElement).blur();
                  }
                }}
                className="mt-4 text-3xl sm:text-[42px] leading-[1.05] font-black tracking-tight ink-text outline-none focus:bg-black/[0.03] dark:focus:bg-white/[0.05] rounded-lg -mx-1 px-1"
              >
                {active.title}
              </h1>

              <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                {active.target && (
                  <span
                    className="inline-flex items-center gap-1.5 font-mono text-xs font-bold px-2.5 py-1.5 rounded-lg"
                    style={{ color: active.color, background: `${active.color}1e` }}
                  >
                    <Target className="w-3.5 h-3.5" /> {active.target}
                  </span>
                )}
                <button
                  onClick={() => onOpenGoal(active.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold ink-text-muted hover:ink-text px-2.5 py-1.5 rounded-lg border border-black/10 dark:border-white/[0.15] hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition"
                  title="Colour, target, note, mark done…"
                >
                  <Settings2 className="w-3.5 h-3.5" /> Edit details
                </button>
              </div>
            </div>

            {/* ---- focus-bubble canvas ---- */}
            <div className="relative flex-1 min-h-0 mx-3 sm:mx-5 mt-4 mb-2">
              {!narrow && (
              <div className="absolute left-2 top-0 z-20 flex flex-wrap gap-2">
                <button
                  onClick={() => addBubble('focus')}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${KIND.focus.add}`}
                >
                  <Plus className="w-3.5 h-3.5" /> Focus
                </button>
                <button
                  onClick={() => addBubble('avoid')}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${KIND.avoid.add}`}
                >
                  <Plus className="w-3.5 h-3.5" /> Avoid
                </button>
                <button
                  onClick={() => addBubble('note')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-black/15 dark:border-white/20 ink-text-muted hover:ink-text hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Text
                </button>
              </div>
              )}

              <div ref={scrollWrapRef} className="absolute inset-0 overflow-auto stage-scroll">
                <div
                  ref={canvasRef}
                  className="relative"
                  style={{ width: surface.w || '100%', height: surface.h || '100%' }}
                >
                {pageBubbles.length === 0 && base.w > 0 && (
                  <div
                    className="absolute left-0 top-0 grid place-items-center pointer-events-none"
                    style={{ width: base.w, height: base.h }}
                  >
                    <p className="text-sm ink-text-muted/70 text-center max-w-xs px-6">
                      {narrow ? (
                        'Nothing here yet. Add focus points, things to avoid, and notes from a computer.'
                      ) : (
                        <>
                          Add what to <span className="text-emerald-600 dark:text-emerald-400 font-semibold">focus</span> on,
                          what to <span className="text-rose-600 dark:text-rose-400 font-semibold">avoid</span>, or a plain{' '}
                          <span className="ink-text font-semibold">note</span>. Drag anything anywhere.
                        </>
                      )}
                    </p>
                  </div>
                )}
                {pageBubbles.map((b) => {
                  const dp = dragPos?.id === b.id ? dragPos : null;
                  const x = dp ? dp.x : b.x;
                  const y = dp ? dp.y : b.y;
                  const isEditing = editingBubble?.id === b.id;
                  const isNote = b.kind === 'note';
                  const k = b.kind === 'note' ? null : KIND[b.kind];
                  return (
                    <div
                      key={b.id}
                      onPointerDown={(e) => onBubblePointerDown(e, b)}
                      className="group absolute select-none"
                      style={{
                        left: x * base.w,
                        top: y * base.h,
                        zIndex: isEditing || dp ? 40 : 20,
                        touchAction: narrow ? 'auto' : 'none',
                        transform: 'translate(-50%,-50%)',
                        cursor: narrow ? 'default' : isEditing ? 'text' : 'grab',
                        willChange: dp ? 'left, top' : undefined,
                      }}
                    >
                      <div
                        className={
                          isNote
                            ? 'relative flex items-start gap-1.5'
                            : `relative flex items-center gap-2 rounded-lg px-3 py-1.5 border dyn-sheen ${k!.chip}`
                        }
                      >
                        {!isNote && (
                          <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => flipKind(b.id)}
                            className="w-2 h-2 rounded-full flex-none"
                            style={{ background: k!.dot }}
                            title={b.kind === 'focus' ? 'Focus — click to flip to Avoid' : 'Avoid — click to flip to Focus'}
                          />
                        )}
                        {isEditing ? (
                          isNote ? (
                            <textarea
                              autoFocus
                              rows={1}
                              ref={growTextarea}
                              value={editingBubble!.text}
                              onChange={(e) => {
                                setEditingBubble({ id: b.id, text: e.target.value });
                                growTextarea(e.currentTarget);
                              }}
                              onBlur={() => commitText(b.id, editingBubble!.text)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') commitText(b.id, b.text);
                              }}
                              placeholder="type a note…"
                              className="block bg-transparent outline-none resize-none overflow-hidden text-[15px] font-medium leading-relaxed w-[22rem] max-w-[62vw] ink-text placeholder:ink-text-muted/50"
                            />
                          ) : (
                            <input
                              autoFocus
                              value={editingBubble!.text}
                              onChange={(e) => setEditingBubble({ id: b.id, text: e.target.value })}
                              onBlur={() => commitText(b.id, editingBubble!.text)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitText(b.id, editingBubble!.text);
                                if (e.key === 'Escape') commitText(b.id, b.text);
                              }}
                              placeholder="type…"
                              className="bg-transparent outline-none text-sm font-semibold w-[7.5rem] max-w-[40vw] ink-text placeholder:ink-text-muted/50"
                            />
                          )
                        ) : (
                          <span
                            className={
                              isNote
                                ? 'text-[15px] font-medium leading-snug whitespace-pre-wrap max-w-[46vw] break-words ink-text'
                                : `text-sm font-semibold whitespace-pre-wrap max-w-[42vw] break-words ${k!.text}`
                            }
                          >
                            {b.text || (isNote ? 'note' : '')}
                          </span>
                        )}
                        {!narrow && (
                          <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => removeBubble(b.id)}
                            className="opacity-0 group-hover:opacity-100 ink-text-muted hover:ink-text transition flex-none mt-[1px]"
                            title="Remove"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>

            {/* ---- milestones for this stage ---- */}
            <div className="relative px-6 sm:px-9 py-4 border-t border-black/5 dark:border-white/[0.1] bg-black/[0.015] dark:bg-white/[0.02]">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-[11px] font-bold tracking-widest uppercase ink-text-muted flex items-center gap-1.5">
                  <Flag className="w-3.5 h-3.5" /> Milestones
                </h3>
                <button
                  onClick={() => onAddMilestone(active.id)}
                  className="inline-flex items-center gap-1 text-xs font-semibold ink-text-muted hover:ink-text px-2 py-1 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {stageMs.length === 0 && <p className="text-xs ink-text-muted/70">No milestones yet — add a checkpoint on the way here.</p>}
                {stageMs.map((m) => (
                  <div
                    key={m.id}
                    className="inline-flex items-center gap-2 rounded-xl border border-black/8 dark:border-white/[0.12] bg-white dark:bg-paper dyn-sheen px-2.5 py-1.5"
                  >
                    <button
                      onClick={() => onToggleMilestone(m.id, !m.done)}
                      className="w-4 h-4 rounded-md flex-none grid place-items-center transition"
                      style={{
                        background: m.done ? active.color : 'transparent',
                        border: `1.5px solid ${m.done ? active.color : 'rgba(120,113,108,0.5)'}`,
                      }}
                      title={m.done ? 'Mark not done' : 'Mark done'}
                    >
                      {m.done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </button>
                    <button
                      onClick={() => onOpenGoal(m.id)}
                      className={`text-[13px] font-medium ${m.done ? 'line-through ink-text-muted' : 'ink-text'}`}
                    >
                      {m.title}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---------------- Tab rail (right) ---------------- */}
      <div
        className="flex-none flex flex-col gap-2 py-6 pr-2 sm:pr-3 pl-1 overflow-y-auto"
        style={{ width: narrow ? 60 : 158 }}
      >
        {!narrow && (
          <div className="px-2 pb-1 flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase ink-text-muted">Stages</span>
            <span className="font-mono text-[10px] tracking-widest ink-text-muted/70">
              {String(stages.length).padStart(2, '0')}
            </span>
          </div>
        )}
        {stages.map((s, i) => {
          const isActive = s.id === activeId;
          const isCurrent = s.id === nextId;
          return (
            <button
              key={s.id}
              onClick={() => goTo(s.id)}
              className={`group relative flex items-center gap-2.5 rounded-lg pl-3.5 pr-2 py-2.5 text-left border transition-all dyn-sheen ${
                isActive ? '-ml-1' : 'hover:-ml-0.5'
              }`}
              style={{
                background: isActive ? 'rgba(127,127,127,0.10)' : 'rgb(var(--surface))',
                borderColor: isActive ? s.color : 'var(--paper-border)',
              }}
              title={s.title}
            >
              {/* left accent bar */}
              <span
                className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                style={{ background: s.color, opacity: isActive ? 1 : 0.45 }}
              />
              <span
                className="grid place-items-center w-6 h-6 rounded-md text-[11px] font-mono font-bold flex-none"
                style={
                  isActive
                    ? { background: s.color, color: '#000' }
                    : { background: `${s.color}22`, color: s.color }
                }
              >
                {s.done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : String(i + 1).padStart(2, '0')}
              </span>
              {!narrow && (
                <span
                  className="text-xs font-semibold leading-tight line-clamp-2"
                  style={isActive ? { color: s.color } : undefined}
                >
                  <span className={isActive ? '' : 'ink-text'}>{s.title}</span>
                </span>
              )}
              {isCurrent && !isActive && (
                <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_0_2px_var(--timeline-bg)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatusPill({ goal }: { goal: VisionGoal }) {
  if (!goal.deadline) return null;
  const days = daysUntil(goal.deadline);
  const u = urgency(goal.deadline);
  const color = goal.done ? '#059669' : URGENCY_COLOR[u];
  const dm = fmtDayMonth(goal.deadline);
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-1.5"
      style={{ background: `${color}14`, border: `1px solid ${color}30` }}
    >
      <CalendarClock className="w-4 h-4 flex-none" style={{ color }} />
      <span className="font-mono font-bold text-sm ink-text tabular-nums">
        {dm.day} {dm.month}
      </span>
      <span className="font-extrabold text-sm tabular-nums" style={{ color }}>
        {goal.done ? 'DONE' : days === 0 ? 'TODAY' : days > 0 ? `${days}d left` : `${Math.abs(days)}d over`}
      </span>
    </div>
  );
}
