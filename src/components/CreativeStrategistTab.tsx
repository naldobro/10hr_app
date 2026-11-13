import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Plus,
  X,
  Maximize2,
  CalendarClock,
  Target,
  Flag,
  NotebookPen,
  StickyNote,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Pencil,
} from 'lucide-react';
import type { StrategistState, StrategistStage, StrategistGoal, StrategistNote, VisionDoc } from '../types';
import { db } from '../lib/database';
import { daysUntil, fmtDayMonth, urgency, iso, todayMidnight } from '../lib/visionUtils';
import {
  normalizeStrategist,
  activeStageIndex,
  STRATEGIST_LS_KEY,
} from '../lib/strategist';
import {
  weekStartISO,
  weekRange,
  monthBucket,
  weekDays,
  seedDayHeadersHTML,
  repairWeekHeadings,
} from '../lib/plannerWeeks';
import { DocEditor, DOC_BODY_CSS } from './PlannerPanel';

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 's' + Date.now() + Math.random().toString(36).slice(2, 6);

const todayISO = () => iso(todayMidnight());

const URGENCY_COLOR: Record<string, string> = {
  past: '#e11d48',
  now: '#e11d48',
  soon: '#d97706',
  far: '#57534e',
};

type BoxKey = 'stages' | 'planner' | 'goals' | 'notes';

// Per-box accent so the map reads as four distinct zones.
const ACCENT: Record<BoxKey, string> = {
  stages: '#10b981',
  planner: '#0ea5e9',
  goals: '#f59e0b',
  notes: '#8b5cf6',
};

export default function CreativeStrategistTab() {
  const [strat, setStrat] = useState<StrategistState>(() => {
    try {
      return normalizeStrategist(JSON.parse(localStorage.getItem(STRATEGIST_LS_KEY) || '{}'));
    } catch {
      return normalizeStrategist({});
    }
  });
  const stratRef = useRef(strat);
  stratRef.current = strat;
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [docs, setDocs] = useState<VisionDoc[]>([]);
  const docsRef = useRef<VisionDoc[]>([]);
  docsRef.current = docs;
  const [dbDown, setDbDown] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<BoxKey | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  // Merge freshly-fetched rows into state WITHOUT clobbering pages already held
  // (those may carry edits newer than the server copy) — only brand-new ids are added.
  const addDocs = useCallback((rows: VisionDoc[]) => {
    setDocs((prev) => {
      const have = new Set(prev.map((d) => d.id));
      const extra = rows.filter((r) => !r.deleted_at && !have.has(r.id));
      return extra.length ? [...prev, ...extra] : prev;
    });
  }, []);

  // ---------- load ----------
  // Three independent fetches so the planner paints as fast as possible:
  //  1. this week's page straight from its id (one row — the instant paint),
  //  2. the settings blob (single row — the authoritative stages/weeks map),
  //  3. the full page list in the background (other weeks / history).
  // The week no longer waits on (3); that bulk read was the "Preparing…" delay.
  useEffect(() => {
    const seededWeekDocId = stratRef.current.weeks[weekStartISO(new Date())];
    if (seededWeekDocId) {
      db.visionDocs
        .getById(seededWeekDocId)
        .then((d) => d && addDocs([d]))
        .catch(() => {});
    }

    (async () => {
      try {
        const s = await db.visionSettings.get();
        if (s && s.strategist != null) {
          const norm = normalizeStrategist(s.strategist);
          setStrat(norm);
          localStorage.setItem(STRATEGIST_LS_KEY, JSON.stringify(norm));
          window.dispatchEvent(new CustomEvent('strategist:stageschanged', { detail: norm.stages }));
        }
      } catch {
        setDbDown(true);
      } finally {
        setSettingsLoaded(true);
      }
    })();

    (async () => {
      try {
        addDocs(await db.visionDocs.getAll());
      } catch {
        /* vision_docs table may be absent — the per-id fetch still paints the week */
      }
    })();
  }, [addDocs]);

  // Undo/redo: snapshots of the whole strategist blob. Because every writer
  // produces a brand-new object (spreads, never in-place mutation), each entry is
  // an immutable point-in-time copy — no deep clone needed.
  const undoStack = useRef<StrategistState[]>([]);
  const redoStack = useRef<StrategistState[]>([]);

  // Low-level writer: update state + localStorage, tell the nav about stage
  // changes, and debounce the DB upsert (surfacing a "run the migration" toast on
  // failure). Does NOT touch history — undo/redo reuse it to replay a snapshot.
  const persist = useCallback(
    (next: StrategistState) => {
      setStrat(next);
      stratRef.current = next;
      localStorage.setItem(STRATEGIST_LS_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('strategist:stageschanged', { detail: next.stages }));
      if (dbDown) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        db.visionSettings
          .upsert({ strategist: next })
          .catch(() => flash('Could not save — run the strategist migration'));
      }, 500);
    },
    [dbDown, flash]
  );

  // Public writer every user action goes through. Pushes the pre-change snapshot
  // onto the undo stack (unless `history:false` for bookkeeping writes like the
  // auto-created week mapping) and clears the redo stack.
  const commit = useCallback(
    (next: StrategistState, opts?: { history?: boolean }) => {
      if (opts?.history !== false) {
        undoStack.current.push(stratRef.current);
        if (undoStack.current.length > 200) undoStack.current.shift();
        redoStack.current = [];
      }
      persist(next);
    },
    [persist]
  );

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(stratRef.current);
    persist(prev);
  }, [persist]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(stratRef.current);
    persist(next);
  }, [persist]);

  // Cmd/Ctrl+Z to undo, Cmd/Ctrl+Shift+Z (or Cmd/Ctrl+Y) to redo — for the tab's
  // structural state (stages, goals, notes). When the caret is in a text field or
  // the planner editor, step aside so the browser's native text undo wins there.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      const isRedo = (k === 'z' && e.shiftKey) || k === 'y';
      const isUndo = k === 'z' && !e.shiftKey;
      if (!isUndo && !isRedo) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      e.preventDefault();
      if (isRedo) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // ---------- planner doc CRUD (thin wrappers over db.visionDocs) ----------
  const addDoc = useCallback(
    async (month: string, title: string, content: string): Promise<string | null> => {
      const sort_order =
        docsRef.current
          .filter((d) => (d.notebook || 'Planner') === 'Planner' && d.month === month)
          .reduce((m, d) => Math.max(m, d.sort_order), 0) + 1;
      const base = { month, title, summary: '', content, color: ACCENT.planner, sort_order };
      if (dbDown) {
        const local: VisionDoc = {
          id: 'local-' + Date.now(),
          user_id: 'single-user',
          notebook: 'Planner',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...base,
        };
        setDocs((p) => [...p, local]);
        return local.id;
      }
      try {
        const row = await db.visionDocs.add(base); // Planner relies on the notebook default
        setDocs((p) => [...p, row]);
        return row.id;
      } catch {
        flash('Could not create the week — run the vision_docs migration');
        return null;
      }
    },
    [dbDown, flash]
  );

  const updateDoc = useCallback(
    (id: string, patch: Partial<VisionDoc>, persist: boolean) => {
      setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
      if (persist && !dbDown) {
        db.visionDocs.update(id, patch).catch(() => flash('Could not save the page'));
      }
    },
    [dbDown, flash]
  );

  // ---------- auto-planner: ensure a week page exists ----------
  // Idempotent: reuse the mapped doc if it's still live, else create + remember it.
  const ensuringRef = useRef<Set<string>>(new Set());
  const ensureWeek = useCallback(
    async (startISO: string): Promise<string | null> => {
      const mapped = stratRef.current.weeks[startISO];
      if (mapped && docsRef.current.some((d) => d.id === mapped)) return mapped;
      // Settings say this week already has a page, it's just not in our local list
      // yet (the bulk load hasn't landed, or missed it). Trust the mapping and fetch
      // that one page directly — never create a duplicate or get stuck because of a
      // transient load miss. Only a genuinely-gone page falls through to a create.
      if (mapped && !dbDown) {
        try {
          const existing = await db.visionDocs.getById(mapped);
          if (existing && !existing.deleted_at) {
            addDocs([existing]);
            return mapped;
          }
        } catch {
          // couldn't reach the row — keep the mapping, don't create a rival page
          return mapped;
        }
      }
      if (ensuringRef.current.has(startISO)) return mapped ?? null; // a create is already in flight
      ensuringRef.current.add(startISO);
      try {
        const { label } = weekRange(startISO);
        const id = await addDoc(monthBucket(startISO), label, seedDayHeadersHTML(startISO));
        if (id) commit({ ...stratRef.current, weeks: { ...stratRef.current.weeks, [startISO]: id } }, { history: false });
        return id;
      } finally {
        ensuringRef.current.delete(startISO);
      }
    },
    [addDoc, commit, addDocs, dbDown]
  );

  // The week currently shown in the planner box (defaults to this week).
  const [viewWeek, setViewWeek] = useState<string>(() => weekStartISO(new Date()));
  const [weekDocId, setWeekDocId] = useState<string | null>(null);

  // Resolve the shown week's page as soon as the settings blob is in (it carries the
  // weeks→page map). We deliberately DON'T wait on the full doc list here — ensureWeek
  // fetches the page by id if needed, so the planner paints without the bulk-load lag.
  useEffect(() => {
    if (!settingsLoaded) return;
    let alive = true;
    ensureWeek(viewWeek).then((id) => {
      if (alive) setWeekDocId(id);
    });
    return () => {
      alive = false;
    };
  }, [settingsLoaded, viewWeek, ensureWeek]);

  const weekDoc = useMemo(() => docs.find((d) => d.id === weekDocId) || null, [docs, weekDocId]);

  // ---------- stage helpers ----------
  const activeIdx = activeStageIndex(strat.stages);
  const setStages = (stages: StrategistStage[]) => commit({ ...strat, stages });
  const editStage = (i: number, patch: Partial<StrategistStage>) =>
    setStages(strat.stages.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  // ---------- goals helpers ----------
  const setGoals = (goals: StrategistState['goals']) => commit({ ...strat, goals });

  // ---------- notes helpers ----------
  const setNotes = (notes: StrategistNote[]) => commit({ ...strat, notes });

  return (
    <main
      className="relative pb-4 px-3 sm:px-4 lg:px-5"
      style={{ paddingTop: 'var(--nav-h, calc(100px + env(safe-area-inset-top)))' }}
    >
      <style>{DOC_BODY_CSS}</style>

      {/* ---------------- the 2×2 map — fills the screen below the nav ---------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-2 gap-4 mt-3 lg:h-[calc(100dvh-var(--nav-h,100px)-1.5rem)]">
        <Box k="stages" n="01" title="Stages" icon={<Target className="w-4 h-4" />} onExpand={() => setExpanded('stages')}>
          <StagesView strat={strat} activeIdx={activeIdx} onEdit={editStage} compact />
        </Box>

        <Box k="planner" n="02" title="Planner" icon={<NotebookPen className="w-4 h-4" />} onExpand={() => setExpanded('planner')}>
          <PlannerPreview doc={weekDoc} onOpen={() => setExpanded('planner')} />
        </Box>

        <Box k="goals" n="03" title="Weekly & Monthly Goals" icon={<Flag className="w-4 h-4" />} onExpand={() => setExpanded('goals')}>
          <GoalsView goals={strat.goals} onChange={setGoals} />
        </Box>

        <Box k="notes" n="04" title="Notes" icon={<StickyNote className="w-4 h-4" />} onExpand={() => setExpanded('notes')}>
          <NotesPreview notes={strat.notes} onOpen={() => setExpanded('notes')} />
        </Box>
      </div>

      {/* ---------------- fullscreen overlays ---------------- */}
      {expanded && (
        <Overlay
          title={
            expanded === 'stages'
              ? 'Stages'
              : expanded === 'planner'
              ? 'Planner'
              : expanded === 'goals'
              ? 'Weekly & Monthly Goals'
              : 'Notes'
          }
          accent={ACCENT[expanded]}
          onClose={() => setExpanded(null)}
        >
          {expanded === 'stages' && <StagesView strat={strat} activeIdx={activeIdx} onEdit={editStage} />}
          {expanded === 'planner' && (
            <PlannerView
              weekISO={viewWeek}
              doc={weekDoc}
              onPrev={() => setViewWeek(iso(new Date(new Date(viewWeek).getTime() - 7 * 86400000)))}
              onNext={() => setViewWeek(iso(new Date(new Date(viewWeek).getTime() + 7 * 86400000)))}
              onToday={() => setViewWeek(weekStartISO(new Date()))}
              onUpdate={updateDoc}
            />
          )}
          {expanded === 'goals' && <GoalsView goals={strat.goals} onChange={setGoals} />}
          {expanded === 'notes' && <NotesCanvas notes={strat.notes} onChange={setNotes} />}
        </Overlay>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] paper-card paper-border rounded-xl px-4 py-2.5 text-sm font-semibold ink-text shadow-2xl">
          {toast}
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Shared chrome
// ---------------------------------------------------------------------------

function Box({
  k,
  n,
  title,
  icon,
  onExpand,
  children,
}: {
  k: BoxKey;
  n: string;
  title: string;
  icon: React.ReactNode;
  onExpand: () => void;
  children: React.ReactNode;
}) {
  const accent = ACCENT[k];
  return (
    <section className="paper-card paper-border dyn-glow rounded-2xl overflow-hidden flex flex-col min-h-[260px] lg:min-h-0">
      <header className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-black/5 dark:border-white/[0.1]">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-mono text-[11px] font-black tracking-tight" style={{ color: accent }}>
            {n}
          </span>
          <span className="grid place-items-center w-6 h-6 rounded-md flex-none" style={{ background: `${accent}1e`, color: accent }}>
            {icon}
          </span>
          <h2 className="text-[15px] font-bold ink-text truncate">{title}</h2>
        </div>
        <button
          onClick={onExpand}
          className="p-1.5 rounded-lg ink-text-muted hover:ink-text hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition flex-none"
          title="Expand"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </header>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </section>
  );
}

function Overlay({
  title,
  accent,
  onClose,
  children,
}: {
  title: string;
  accent: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-x-0 bottom-0 top-[calc(90px+env(safe-area-inset-top))] flex items-stretch justify-center p-2 sm:p-4">
        <div
          className="relative paper-card rounded-2xl border border-black/10 dark:border-white/[0.2] shadow-2xl w-[min(1100px,96vw)] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-center justify-between px-5 py-3 border-b border-black/5 dark:border-white/[0.12]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: accent }} />
              <h2 className="text-[15px] font-bold ink-text">{title}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg ink-text-muted hover:bg-black/[0.05] dark:hover:bg-white/10 transition" title="Close">
              <X className="w-5 h-5" />
            </button>
          </header>
          <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 01 · Stages
// ---------------------------------------------------------------------------

function StagePill({ stage }: { stage: StrategistStage }) {
  if (!stage.deadline) return null;
  const days = daysUntil(stage.deadline);
  const color = stage.done ? '#059669' : URGENCY_COLOR[urgency(stage.deadline)];
  const dm = fmtDayMonth(stage.deadline);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1" style={{ background: `${color}14`, border: `1px solid ${color}30` }}>
      <CalendarClock className="w-3.5 h-3.5 flex-none" style={{ color }} />
      <span className="font-mono text-[12px] font-bold ink-text tabular-nums">
        {dm.day} {dm.month}
      </span>
      <span className="text-[12px] font-extrabold tabular-nums" style={{ color }}>
        {stage.done ? 'DONE' : days === 0 ? 'TODAY' : days > 0 ? `${days}d left` : `${Math.abs(days)}d over`}
      </span>
    </span>
  );
}

// The per-stage bullet list — a quick, specific thought process under each stage.
// Read-only dots in the compact card; editable inputs (add / edit / remove) when
// the Stages box is expanded.
function StageBullets({
  accent,
  compact,
  bullets,
  onChange,
}: {
  accent: string;
  compact?: boolean;
  bullets: string[];
  onChange: (next: string[]) => void;
}) {
  if (compact) {
    if (bullets.length === 0) return null;
    return (
      <ul className="mt-2.5 space-y-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-[12.5px] leading-snug ink-text">
            <span className="mt-[7px] w-1.5 h-1.5 rounded-full flex-none" style={{ background: accent }} />
            <span className="min-w-0 break-words">{b}</span>
          </li>
        ))}
      </ul>
    );
  }

  const setAt = (i: number, text: string) => onChange(bullets.map((b, j) => (j === i ? text : b)));
  const removeAt = (i: number) => onChange(bullets.filter((_, j) => j !== i));
  const add = () => onChange([...bullets, '']);

  return (
    <div className="mt-3 space-y-1.5">
      {bullets.map((b, i) => (
        <div key={i} className="group flex items-start gap-2">
          <span className="mt-[11px] w-1.5 h-1.5 rounded-full flex-none" style={{ background: accent }} />
          <input
            value={b}
            autoFocus={b === ''}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
              if (e.key === 'Backspace' && b === '') {
                e.preventDefault();
                removeAt(i);
              }
            }}
            placeholder="a specific thought…"
            className="flex-1 text-[13px] ink-text bg-transparent outline-none border-b border-transparent focus:border-black/20 dark:focus:border-white/25 placeholder:ink-text-muted/60"
          />
          <button
            onClick={() => removeAt(i)}
            className="opacity-0 group-hover:opacity-100 ink-text-muted hover:ink-text transition flex-none mt-[3px]"
            title="Remove point"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="inline-flex items-center gap-1 text-[12px] font-semibold ink-text-muted hover:ink-text transition mt-0.5"
      >
        <Plus className="w-3.5 h-3.5" style={{ color: accent }} /> Add point
      </button>
    </div>
  );
}

function StagesView({
  strat,
  activeIdx,
  onEdit,
  compact,
}: {
  strat: StrategistState;
  activeIdx: number;
  onEdit: (i: number, patch: Partial<StrategistStage>) => void;
  compact?: boolean;
}) {
  const accent = ACCENT.stages;
  const stages = strat.stages;
  return (
    <div className={`h-full overflow-y-auto ${compact ? 'p-4' : 'p-5 sm:p-7'}`}>
      {/* progress segments */}
      <div className="flex items-center gap-1 mb-4">
        {stages.map((s, i) => (
          <span
            key={i}
            className="h-[3px] rounded-full transition-all duration-300"
            style={{
              width: i === activeIdx ? 40 : 16,
              background: i === activeIdx ? accent : s.done ? `${accent}80` : 'rgba(128,128,128,0.3)',
            }}
          />
        ))}
      </div>

      <div className={compact ? 'space-y-2.5' : 'space-y-3.5'}>
        {stages.map((s, i) => {
          const isActive = i === activeIdx;
          const locked = !s.done && i > activeIdx; // can't be reached yet
          return (
            <div
              key={i}
              className="rounded-xl border p-3.5 transition"
              style={{
                borderColor: isActive ? accent : 'var(--paper-border)',
                background: isActive ? `${accent}0e` : 'transparent',
                opacity: locked ? 0.6 : 1,
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="grid place-items-center w-7 h-7 rounded-lg text-[12px] font-mono font-bold flex-none"
                  style={s.done || isActive ? { background: accent, color: '#000' } : { background: `${accent}22`, color: accent }}
                >
                  {s.done ? <Check className="w-4 h-4" strokeWidth={3} /> : String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {compact ? (
                      <span className="font-bold text-[15px] ink-text">{s.name}</span>
                    ) : (
                      <input
                        value={s.name}
                        onChange={(e) => onEdit(i, { name: e.target.value })}
                        className="font-bold text-[16px] ink-text bg-transparent outline-none border-b border-transparent focus:border-black/20 dark:focus:border-white/25 min-w-0"
                      />
                    )}
                    {isActive && (
                      <span className="text-[9px] font-black tracking-wider uppercase rounded-full px-1.5 py-0.5" style={{ background: accent, color: '#000' }}>
                        You are here
                      </span>
                    )}
                  </div>

                  {/* target */}
                  {compact ? (
                    s.target && (
                      <div className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: accent }}>
                        <Target className="w-3.5 h-3.5" /> {s.target}
                      </div>
                    )
                  ) : (
                    <div className="mt-2 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 flex-none" style={{ color: accent }} />
                      <input
                        value={s.target}
                        onChange={(e) => onEdit(i, { target: e.target.value })}
                        placeholder="Target to reach this stage…"
                        className="flex-1 text-[13px] ink-text bg-transparent outline-none border-b border-transparent focus:border-black/20 dark:focus:border-white/25 placeholder:ink-text-muted/60"
                      />
                    </div>
                  )}

                  {/* deadline + mark complete (expanded only) */}
                  <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                    <StagePill stage={s} />
                    {!compact && (
                      <>
                        <label className="inline-flex items-center gap-1.5 text-[12px] ink-text-muted cursor-pointer">
                          <CalendarClock className="w-3.5 h-3.5" />
                          <input
                            type="date"
                            value={s.deadline || ''}
                            onChange={(e) => onEdit(i, { deadline: e.target.value || null })}
                            className="bg-transparent outline-none ink-text text-[12px]"
                          />
                        </label>
                        <button
                          onClick={() => onEdit(i, { done: !s.done })}
                          className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-bold px-2.5 py-1.5 rounded-lg border transition"
                          style={
                            s.done
                              ? { borderColor: 'var(--paper-border)', color: 'var(--ink-muted)' }
                              : { borderColor: accent, color: accent }
                          }
                        >
                          <Check className="w-3.5 h-3.5" strokeWidth={3} />
                          {s.done ? 'Mark not done' : 'Mark complete'}
                        </button>
                      </>
                    )}
                  </div>

                  {/* bullets — the specific thought process for this stage */}
                  <StageBullets accent={accent} compact={compact} bullets={s.bullets ?? []} onChange={(next) => onEdit(i, { bullets: next })} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {compact && (
        <p className="mt-3 text-[11px] ink-text-muted/70">Expand to set targets, time limits, and mark a stage complete.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 02 · Planner
// ---------------------------------------------------------------------------

// Matches a day heading by its text ("Thu · Nov 5") even if editing flattened the
// <h3 data-day> into a styled <p> that lost the tag + anchor.
const DAY_LABEL_RE = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) · [A-Z][a-z]{2} \d{1,2}\b/;

// Renders read-only doc HTML and scales it DOWN to fit its box when there's a lot,
// so the whole day's plan stays visible in the card instead of being clipped. CSS
// transforms don't change layout size, so scrollHeight stays the true natural
// height — no measure/scale feedback loop.
function FitBox({ html }: { html: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner) return;
    const fit = () => {
      const availH = box.clientHeight;
      const needH = inner.scrollHeight;
      setScale(needH > availH && availH > 0 ? Math.max(0.45, availH / needH) : 1);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [html]);
  return (
    <div ref={boxRef} className="w-full h-full overflow-hidden">
      <div
        ref={innerRef}
        className="doc-body ink-text text-[16px] leading-relaxed"
        style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: `${100 / scale}%` }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// The grid card: shows today's section exactly as written (lists, to-dos, formatting),
// read-only, filling the card and shrinking to fit when there's more.
function PlannerPreview({ doc, onOpen }: { doc: VisionDoc | null; onOpen: () => void }) {
  const today = todayISO();
  const dayLabel = weekDays(weekStartISO(new Date())).find((d) => d.iso === today)?.label ?? today;
  // Grab the real HTML the user wrote under TODAY's heading — up to the next day.
  const html = useMemo(() => {
    if (!doc?.content) return '';
    const div = document.createElement('div');
    div.innerHTML = doc.content;
    const head = div.querySelector(`[data-day="${today}"]`);
    let node = head?.nextElementSibling as Element | null;
    const parts: string[] = [];
    while (node) {
      const t = (node.textContent || '').trim();
      // Stop at the next day boundary only — a real day heading (data-day), a mangled
      // one (reads like a label), never on the user's own sub-headings.
      if (node.hasAttribute('data-day') || !!node.querySelector('[data-day]') || DAY_LABEL_RE.test(t)) break;
      // Skip the seeded empty "<p><br></p>" lines; keep anything with text or a block.
      if (t || node.querySelector('img,table,ul,ol,hr')) parts.push(node.outerHTML);
      node = node.nextElementSibling;
    }
    return parts.join('');
  }, [doc?.content, today]);

  return (
    <button onClick={onOpen} className="w-full h-full text-left p-4 flex flex-col group">
      <div className="text-[11px] font-bold tracking-widest uppercase ink-text-muted">Today</div>
      <div className="mt-1 text-lg font-black ink-text">{dayLabel}</div>
      <div className="mt-3 flex-1 min-h-0 overflow-hidden rounded-xl border border-black/5 dark:border-white/[0.1] bg-black/[0.015] dark:bg-white/[0.02] p-3">
        {html ? (
          <FitBox html={html} />
        ) : (
          <p className="text-[13px] ink-text-muted/70">Nothing yet for today. Open to plan your day.</p>
        )}
      </div>
      <div className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold self-start px-2.5 py-1.5 rounded-lg transition" style={{ color: ACCENT.planner }}>
        <Pencil className="w-3.5 h-3.5" /> Open to write
      </div>
    </button>
  );
}

function PlannerView({
  weekISO,
  doc,
  onPrev,
  onNext,
  onToday,
  onUpdate,
}: {
  weekISO: string;
  doc: VisionDoc | null;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onUpdate: (id: string, patch: Partial<VisionDoc>, persist: boolean) => void;
}) {
  const { label } = weekRange(weekISO);
  const isThisWeek = weekISO === weekStartISO(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Day headings are managed structure (see repairWeekHeadings). Re-assert them on
  // the content the editor mounts with — this self-heals any page whose headings got
  // flattened in an earlier session, so "jump to today" + the peek always find their
  // anchors. The editor is uncontrolled (keyed on id), so a repaired doc only changes
  // what it mounts from — it never rewrites the DOM under a live caret.
  const fixedDoc = useMemo(
    () => (doc ? { ...doc, content: repairWeekHeadings(doc.content || '', weekISO) } : null),
    [doc, weekISO]
  );

  // When the current week opens, scroll today's heading to the TOP of the page
  // (so the already-passed days tuck away above it and the later days are a
  // scroll down) and drop the caret just after it so the user can type straight
  // away. Keyed on the doc *id* so it fires once per open — not on every edit,
  // which would otherwise yank the caret back to today mid-sentence.
  const docId = fixedDoc?.id ?? null;
  useEffect(() => {
    if (!docId || !isThisWeek) return;
    const t = setTimeout(() => {
      const root = scrollRef.current;
      if (!root) return;
      const head = root.querySelector(`[data-day="${todayISO()}"]`) as HTMLElement | null;
      if (!head) return;
      head.scrollIntoView({ block: 'start' });
      const target = (head.nextElementSibling as HTMLElement | null) ?? head;
      const body = target.closest('.doc-body') as HTMLElement | null;
      if (body) {
        const range = document.createRange();
        range.selectNodeContents(target);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        (body as HTMLElement).focus();
      }
    }, 120);
    return () => clearTimeout(t);
  }, [docId, isThisWeek]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-black/5 dark:border-white/[0.1]">
        <div className="flex items-center gap-1">
          <button onClick={onPrev} className="p-1.5 rounded-lg ink-text-muted hover:ink-text hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition" title="Previous week">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-2 text-center">
            <div className="text-[14px] font-bold ink-text leading-none">{label}</div>
            <div className="text-[10px] ink-text-muted mt-0.5">{isThisWeek ? 'This week' : 'Week'}</div>
          </div>
          <button onClick={onNext} className="p-1.5 rounded-lg ink-text-muted hover:ink-text hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition" title="Next week">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {!isThisWeek && (
          <button onClick={onToday} className="text-[12px] font-bold px-2.5 py-1.5 rounded-lg border border-black/10 dark:border-white/[0.15] ink-text-muted hover:ink-text transition">
            Jump to today
          </button>
        )}
      </div>
      <div ref={scrollRef} className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {fixedDoc ? (
          <DocEditor
            key={fixedDoc.id}
            doc={fixedDoc}
            onChange={(patch, persist) =>
              onUpdate(
                fixedDoc.id,
                patch.content != null ? { ...patch, content: repairWeekHeadings(patch.content, weekISO) } : patch,
                persist
              )
            }
            onDelete={() => {}}
            onUploadImage={(blob, type) => db.visionImages.upload(blob, type)}
            nested
          />
        ) : (
          <div className="h-full grid place-items-center">
            <p className="text-sm ink-text-muted">Preparing this week’s page…</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 03 · Weekly & Monthly goals
// ---------------------------------------------------------------------------

function GoalsView({ goals, onChange }: { goals: StrategistState['goals']; onChange: (g: StrategistState['goals']) => void }) {
  return (
    <div className="h-full overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
      <GoalList title="This week" items={goals.weekly} onChange={(weekly) => onChange({ ...goals, weekly })} />
      <GoalList title="This month" items={goals.monthly} onChange={(monthly) => onChange({ ...goals, monthly })} />
    </div>
  );
}

function GoalList({ title, items, onChange }: { title: string; items: StrategistGoal[]; onChange: (items: StrategistGoal[]) => void }) {
  const [draft, setDraft] = useState('');
  const accent = ACCENT.goals;
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, { id: uid(), text, done: false }]);
    setDraft('');
  };
  return (
    <div className="min-w-0">
      <h3 className="text-[11px] font-bold tracking-widest uppercase ink-text-muted mb-2.5">{title}</h3>
      <div className="space-y-1.5">
        {items.map((it) => (
          <div key={it.id} className="group flex items-center gap-2.5 rounded-lg px-1 py-1">
            <button
              onClick={() => onChange(items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))}
              className="w-[18px] h-[18px] rounded-md flex-none grid place-items-center transition"
              style={{ background: it.done ? accent : 'transparent', border: `1.5px solid ${it.done ? accent : 'rgba(120,113,108,0.5)'}` }}
            >
              {it.done && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
            </button>
            <input
              value={it.text}
              onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)))}
              className={`flex-1 min-w-0 bg-transparent outline-none text-[14px] ${it.done ? 'line-through ink-text-muted' : 'ink-text'}`}
            />
            <button
              onClick={() => onChange(items.filter((x) => x.id !== it.id))}
              className="opacity-0 group-hover:opacity-100 p-1 rounded ink-text-muted hover:text-red-500 transition flex-none"
              title="Remove"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Plus className="w-4 h-4 ink-text-muted flex-none" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
          placeholder="Add a goal…"
          className="flex-1 min-w-0 bg-transparent outline-none text-[14px] ink-text placeholder:ink-text-muted/60"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 04 · Notes canvas (freeform floating text boxes)
// ---------------------------------------------------------------------------

const NOTE_COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#0ea5e9', '#ef4444', '#ec4899'];

function NotesPreview({ notes, onOpen }: { notes: StrategistNote[]; onOpen: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [base, setBase] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setBase({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <button onClick={onOpen} className="w-full h-full text-left p-4 flex flex-col">
      <div ref={wrapRef} className="relative flex-1 min-h-0 overflow-hidden rounded-xl border border-black/5 dark:border-white/[0.1] bg-black/[0.015] dark:bg-white/[0.02]">
        {notes.length === 0 ? (
          <p className="absolute inset-0 grid place-items-center text-center p-3 text-[13px] ink-text-muted/70">A blank canvas. Open to scatter floating notes anywhere.</p>
        ) : (
          notes.map((n) => (
            <div
              key={n.id}
              className="absolute select-none pointer-events-none"
              style={{ left: n.x * base.w, top: n.y * base.h, transform: 'translate(-50%,-50%)' }}
            >
              <div className="rounded-lg px-2 py-1 border bg-white dark:bg-black dyn-sheen" style={{ borderColor: `${n.color}66` }}>
                <span
                  className="block text-[11px] font-medium leading-snug whitespace-pre-wrap break-words max-w-[9rem] line-clamp-4"
                  style={{ color: n.color }}
                >
                  {n.text || 'note'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold self-start" style={{ color: ACCENT.notes }}>
        <Maximize2 className="w-3.5 h-3.5" /> Open canvas
      </div>
    </button>
  );
}

function NotesCanvas({ notes, onChange }: { notes: StrategistNote[]; onChange: (notes: StrategistNote[]) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [base, setBase] = useState({ w: 0, h: 0 });
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setBase({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const flushEditing = (list: StrategistNote[]): StrategistNote[] => {
    if (!editing) return list;
    const t = editing.text.trim();
    return t ? list.map((n) => (n.id === editing.id ? { ...n, text: t } : n)) : list.filter((n) => n.id !== editing.id);
  };

  const addNote = () => {
    const n: StrategistNote = {
      id: uid(),
      text: '',
      x: 0.2 + Math.random() * 0.4,
      y: 0.2 + Math.random() * 0.4,
      color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
    };
    onChange([...flushEditing(notes), n]);
    setEditing({ id: n.id, text: '' });
  };

  const commitText = (id: string, text: string) => {
    const t = text.trim();
    onChange(t ? notes.map((n) => (n.id === id ? { ...n, text: t } : n)) : notes.filter((n) => n.id !== id));
    setEditing(null);
  };

  const removeNote = (id: string) => {
    if (editing?.id === id) setEditing(null);
    onChange(flushEditing(notes).filter((n) => n.id !== id));
  };

  const cycleColor = (id: string) =>
    onChange(
      flushEditing(notes).map((n) => {
        if (n.id !== id) return n;
        const idx = NOTE_COLORS.indexOf(n.color);
        return { ...n, color: NOTE_COLORS[(idx + 1) % NOTE_COLORS.length] };
      })
    );

  const onPointerDown = (e: React.PointerEvent, n: StrategistNote) => {
    if (e.button !== 0 || editing?.id === n.id) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
      moved = true;
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect || base.w === 0 || base.h === 0) return;
      const x = Math.min(0.98, Math.max(0.02, (ev.clientX - rect.left) / base.w));
      const y = Math.min(0.97, Math.max(0.02, (ev.clientY - rect.top) / base.h));
      setDragPos({ id: n.id, x, y });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDragPos((d) => {
        if (d && d.id === n.id) onChange(flushEditing(notes).map((nn) => (nn.id === n.id ? { ...nn, x: d.x, y: d.y } : nn)));
        return null;
      });
      if (!moved) setEditing({ id: n.id, text: n.text });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/5 dark:border-white/[0.1]">
        <button
          onClick={addNote}
          className="inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg border transition"
          style={{ color: ACCENT.notes, borderColor: `${ACCENT.notes}66` }}
        >
          <Plus className="w-3.5 h-3.5" /> Add note
        </button>
        <span className="text-[11px] ink-text-muted/70">Drag to move · click to edit · dot cycles colour</span>
      </div>
      <div ref={wrapRef} className="relative flex-1 min-h-0 overflow-hidden">
        {notes.length === 0 && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <p className="text-sm ink-text-muted/70">Add a note and drag it anywhere.</p>
          </div>
        )}
        {notes.map((n) => {
          const dp = dragPos?.id === n.id ? dragPos : null;
          const x = dp ? dp.x : n.x;
          const y = dp ? dp.y : n.y;
          const isEditing = editing?.id === n.id;
          return (
            <div
              key={n.id}
              onPointerDown={(e) => onPointerDown(e, n)}
              className="group absolute select-none"
              style={{
                left: x * base.w,
                top: y * base.h,
                transform: 'translate(-50%,-50%)',
                zIndex: isEditing || dp ? 40 : 20,
                touchAction: 'none',
                cursor: isEditing ? 'text' : 'grab',
              }}
            >
              <div className="relative flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 border bg-white dark:bg-black dyn-sheen" style={{ borderColor: `${n.color}66` }}>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => cycleColor(n.id)}
                  className="w-2.5 h-2.5 rounded-full flex-none mt-1.5"
                  style={{ background: n.color }}
                  title="Cycle colour"
                />
                {isEditing ? (
                  <textarea
                    autoFocus
                    rows={1}
                    ref={(el) => {
                      if (el) {
                        el.style.height = 'auto';
                        el.style.height = el.scrollHeight + 'px';
                      }
                    }}
                    value={editing!.text}
                    onChange={(e) => {
                      setEditing({ id: n.id, text: e.target.value });
                      e.currentTarget.style.height = 'auto';
                      e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                    }}
                    onBlur={() => commitText(n.id, editing!.text)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') commitText(n.id, n.text);
                    }}
                    placeholder="type a note…"
                    className="block bg-transparent outline-none resize-none overflow-hidden text-[14px] font-medium leading-snug w-[22rem] max-w-[46vw] ink-text placeholder:ink-text-muted/50"
                  />
                ) : (
                  <span className="text-[14px] font-medium leading-snug whitespace-pre-wrap max-w-[46vw] break-words" style={{ color: n.color }}>
                    {n.text || 'note'}
                  </span>
                )}
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => removeNote(n.id)}
                  className="opacity-0 group-hover:opacity-100 ink-text-muted hover:ink-text transition flex-none mt-0.5"
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
  );
}
