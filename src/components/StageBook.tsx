import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Check, Flag, CalendarClock, Target, Settings2, X, Sparkles } from 'lucide-react';
import { VisionGoal, StageBubble } from '../types';
import { daysUntil, fmtDayMonth, urgency, Urgency } from '../lib/visionUtils';

const URGENCY_COLOR: Record<Urgency, string> = {
  past: '#e11d48',
  now: '#e11d48',
  soon: '#d97706',
  far: '#57534e',
};

// Emerald for "lean in", rose for "steer clear".
const BUBBLE = {
  focus: { ring: '#10b981', text: '#065f46', darkText: '#6ee7b7', bg: 'rgba(16,185,129,0.14)', glow: 'rgba(16,185,129,0.35)' },
  avoid: { ring: '#f43f5e', text: '#9f1239', darkText: '#fda4af', bg: 'rgba(244,63,94,0.13)', glow: 'rgba(244,63,94,0.32)' },
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
  const prevIndexRef = useRef(0);

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

  const commit = (next: StageBubble[]) => activeId && onBubblesChange(activeId, next);

  const addBubble = (kind: 'focus' | 'avoid') => {
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
    commit(pageBubbles.map((b) => (b.id === id ? { ...b, kind: b.kind === 'focus' ? 'avoid' : 'focus' } : b)));

  const removeBubble = (id: string) => commit(pageBubbles.filter((b) => b.id !== id));

  const onBubblePointerDown = (e: React.PointerEvent, b: StageBubble) => {
    if (e.button !== 0 || editingBubble?.id === b.id) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
      moved = true;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.min(0.97, Math.max(0.03, (ev.clientX - rect.left) / rect.width));
      const y = Math.min(0.95, Math.max(0.05, (ev.clientY - rect.top) / rect.height));
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
        .stage-page-next { animation: stage-in-next .32s cubic-bezier(.22,.7,.3,1) both; }
        .stage-page-prev { animation: stage-in-prev .32s cubic-bezier(.22,.7,.3,1) both; }
        @keyframes bubble-float { 0%,100% { transform: translate(-50%,-50%); } 50% { transform: translate(-50%,calc(-50% - 5px)); } }
      `}</style>

      {/* ---------------- Page ---------------- */}
      <div className="flex-1 min-w-0 relative flex items-stretch p-4 sm:p-6" style={{ perspective: 1400 }}>
        {/* stacked paper behind, to hint at pages you can flip through */}
        <div className="absolute inset-4 sm:inset-6 rounded-3xl bg-white/40 dark:bg-paper/40 border border-black/5 dark:border-white/[0.08] translate-x-2 translate-y-2 pointer-events-none" />
        <div className="absolute inset-4 sm:inset-6 rounded-3xl bg-white/60 dark:bg-paper/60 border border-black/5 dark:border-white/[0.1] translate-x-1 translate-y-1 pointer-events-none" />

        {active && (
          <div
            key={active.id}
            className={`relative flex-1 min-w-0 flex flex-col rounded-3xl paper-card paper-shadow overflow-hidden ${
              turn === 'next' ? 'stage-page-next' : 'stage-page-prev'
            }`}
            style={{ border: `1px solid ${active.color}44` }}
          >
            {/* lined-paper texture + top colour wash */}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.5] dark:opacity-[0.25]"
              style={{ background: `repeating-linear-gradient(transparent, transparent 37px, ${active.color}0f 37px, ${active.color}0f 38px)` }}
            />
            <div
              className="absolute top-0 left-0 right-0 h-40 pointer-events-none"
              style={{ background: `radial-gradient(120% 100% at 50% 0, ${active.color}22, transparent 70%)` }}
            />

            {/* header */}
            <div className="relative px-6 sm:px-9 pt-6 sm:pt-8">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] font-mono font-bold tracking-widest uppercase" style={{ color: active.color }}>
                  <span
                    className="grid place-items-center w-6 h-6 rounded-lg text-white text-xs"
                    style={{ background: active.color }}
                  >
                    {activeIndex + 1}
                  </span>
                  Stage {activeIndex + 1} of {stages.length}
                </div>
                <StatusPill goal={active} />
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
                className="mt-3 text-3xl sm:text-[40px] leading-[1.1] font-black ink-text outline-none focus:bg-black/[0.03] dark:focus:bg-white/[0.05] rounded-lg -mx-1 px-1"
              >
                {active.title}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-2.5">
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
              <div className="absolute left-2 top-0 z-10 flex gap-2">
                <button
                  onClick={() => addBubble('focus')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full text-emerald-700 dark:text-emerald-300 bg-emerald-500/12 border border-emerald-500/30 hover:bg-emerald-500/20 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Focus
                </button>
                <button
                  onClick={() => addBubble('avoid')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full text-rose-700 dark:text-rose-300 bg-rose-500/12 border border-rose-500/30 hover:bg-rose-500/20 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Avoid
                </button>
              </div>

              <div ref={canvasRef} className="absolute inset-0">
                {pageBubbles.length === 0 && (
                  <div className="absolute inset-0 grid place-items-center pointer-events-none">
                    <p className="text-sm ink-text-muted/70 text-center max-w-xs">
                      Drop a bubble for what to <span className="text-emerald-600 dark:text-emerald-400 font-semibold">focus</span> on
                      and what to <span className="text-rose-600 dark:text-rose-400 font-semibold">avoid</span>. Drag them anywhere.
                    </p>
                  </div>
                )}
                {pageBubbles.map((b) => {
                  const dp = dragPos?.id === b.id ? dragPos : null;
                  const x = dp ? dp.x : b.x;
                  const y = dp ? dp.y : b.y;
                  const c = BUBBLE[b.kind];
                  const isEditing = editingBubble?.id === b.id;
                  return (
                    <div
                      key={b.id}
                      onPointerDown={(e) => onBubblePointerDown(e, b)}
                      className="group absolute select-none"
                      style={{
                        left: `${x * 100}%`,
                        top: `${y * 100}%`,
                        zIndex: isEditing || dp ? 40 : 20,
                        touchAction: 'none',
                        animation: isEditing || dp ? 'none' : `bubble-float ${5 + (b.id.charCodeAt(0) % 4)}s ease-in-out infinite`,
                        transform: 'translate(-50%,-50%)',
                        cursor: isEditing ? 'text' : 'grab',
                      }}
                    >
                      <div
                        className="relative flex items-center gap-1.5 rounded-2xl px-3.5 py-2 backdrop-blur-sm shadow-lg"
                        style={{ background: c.bg, border: `1.5px solid ${c.ring}`, boxShadow: `0 6px 20px -6px ${c.glow}` }}
                      >
                        <button
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => flipKind(b.id)}
                          className="w-2.5 h-2.5 rounded-full flex-none"
                          style={{ background: c.ring }}
                          title={b.kind === 'focus' ? 'Focus — click to flip to Avoid' : 'Avoid — click to flip to Focus'}
                        />
                        {isEditing ? (
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
                        ) : (
                          <span className="text-sm font-semibold whitespace-pre-wrap max-w-[42vw] break-words">
                            <span className="dark:hidden" style={{ color: c.text }}>{b.text}</span>
                            <span className="hidden dark:inline" style={{ color: c.darkText }}>{b.text}</span>
                          </span>
                        )}
                        <button
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => removeBubble(b.id)}
                          className="opacity-0 group-hover:opacity-100 ink-text-muted hover:ink-text transition flex-none"
                          title="Remove"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
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
                    className="inline-flex items-center gap-2 rounded-xl border border-black/8 dark:border-white/[0.12] bg-white dark:bg-paper px-2.5 py-1.5"
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
        style={{ width: narrow ? 60 : 152 }}
      >
        {stages.map((s, i) => {
          const isActive = s.id === activeId;
          const isCurrent = s.id === nextId;
          return (
            <button
              key={s.id}
              onClick={() => goTo(s.id)}
              className={`group relative flex items-center gap-2 rounded-l-xl rounded-r-md pl-2.5 pr-2 py-2.5 text-left transition-all ${
                isActive ? 'shadow-lg -ml-1' : 'hover:-ml-0.5'
              }`}
              style={{
                background: isActive ? s.color : 'rgb(var(--surface))',
                border: `1px solid ${isActive ? s.color : 'var(--paper-border)'}`,
                borderRight: isActive ? `4px solid ${s.color}` : `4px solid ${s.color}`,
              }}
              title={s.title}
            >
              <span
                className="grid place-items-center w-6 h-6 rounded-lg text-xs font-bold flex-none"
                style={{
                  background: isActive ? 'rgba(255,255,255,0.25)' : `${s.color}1e`,
                  color: isActive ? '#fff' : s.color,
                }}
              >
                {s.done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}
              </span>
              {!narrow && (
                <span
                  className={`text-xs font-semibold leading-tight line-clamp-2 ${
                    isActive ? 'text-white' : 'ink-text'
                  }`}
                >
                  {s.title}
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
