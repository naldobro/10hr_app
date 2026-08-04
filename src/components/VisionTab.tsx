import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, CalendarClock, X } from 'lucide-react';
import { db } from '../lib/database';
import { VisionGoal } from '../types';
import {
  DAY,
  GOAL_COLORS,
  todayMidnight,
  iso,
  addDays,
  daysUntil,
  fmtDayMonth,
  progress,
  isDone,
  urgency,
  Urgency,
} from '../lib/visionUtils';
import GoalDrawer from './GoalDrawer';

const ZOOMS = [
  { name: 'Weeks', ppd: 20 },
  { name: 'Months', ppd: 6.2 },
  { name: 'Quarters', ppd: 2.6 },
];
const TOP_PAD = 90;
const BOT_PAD = 150;
const GAP = 46; // spine → card gap
const CARD_W = 250;

const URGENCY_COLOR: Record<Urgency, string> = {
  past: '#e11d48',
  now: '#e11d48',
  soon: '#d97706',
  far: '#57534e',
};

interface Drag {
  id: string;
  mode: 'placed' | 'tray';
  x: number;
  y: number;
  previewDeadline: string | null;
}

interface Particle {
  y: number;
  vy: number;
  drift: number;
  amp: number;
  r: number;
  hue: string;
  a: number;
}

interface Burst {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  rgb: string;
}

export default function VisionTab() {
  const [goals, setGoals] = useState<VisionGoal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoomIndex, setZoomIndex] = useState(1);
  const [viewportH, setViewportH] = useState(800);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dbDown, setDbDown] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pCanvasRef = useRef<HTMLCanvasElement>(null);
  const goalsRef = useRef<VisionGoal[]>([]);
  const dimsRef = useRef({ w: 0, h: 0 });
  const particlesRef = useRef<Particle[]>([]);
  const burstsRef = useRef<Burst[]>([]);
  const didInitScroll = useRef(false);

  useEffect(() => {
    goalsRef.current = goals;
  });

  const ppd = ZOOMS[zoomIndex].ppd;

  const maxDays = useCallback(() => {
    let m = 30;
    goals.forEach((g) => {
      if (g.deadline) m = Math.max(m, daysUntil(g.deadline));
    });
    return m + 25;
  }, [goals]);

  const layoutH = Math.max(viewportH, TOP_PAD + maxDays() * ppd + BOT_PAD);
  const yForDays = (d: number) => layoutH - BOT_PAD - d * ppd;
  const yForDeadline = (dl: string) => yForDays(daysUntil(dl));

  // ---------- load ----------
  useEffect(() => {
    (async () => {
      try {
        let rows = await db.visionGoals.getAll();
        if (rows.length === 0) {
          rows = await seedDemoGoals();
        }
        setGoals(rows);
      } catch {
        setDbDown(true);
        setGoals(demoGoals());
      }
    })();
  }, []);

  // ---------- viewport measure ----------
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight));
    ro.observe(el);
    setViewportH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // start the view at "today" (bottom), looking upward
  useEffect(() => {
    if (didInitScroll.current) return;
    const el = scrollRef.current;
    if (el && goals.length) {
      el.scrollTop = el.scrollHeight;
      didInitScroll.current = true;
    }
  }, [goals, layoutH]);

  // ---------- particles ----------
  useEffect(() => {
    const canvas = pCanvasRef.current;
    const wrap = canvasRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d')!;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;

    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dimsRef.current = { w, h };
      if (particlesRef.current.length === 0) {
        for (let i = 0; i < 46; i++) particlesRef.current.push(spawn(w, h, true));
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const frame = () => {
      const { w, h } = dimsRef.current;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      particlesRef.current.forEach((p) => {
        p.y += p.vy;
        p.drift += 0.02;
        const x = cx + Math.sin(p.drift) * p.amp;
        if (p.y < -10) Object.assign(p, spawn(w, h, false));
        ctx.beginPath();
        ctx.fillStyle = `rgba(${p.hue},${p.a})`;
        ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      if (burstsRef.current.length) {
        burstsRef.current.forEach((b) => {
          b.x += b.vx;
          b.y += b.vy;
          b.vy += 0.12;
          b.life -= 0.02;
          ctx.beginPath();
          ctx.fillStyle = `rgba(${b.rgb},${Math.max(0, b.life)})`;
          ctx.arc(b.x, b.y, 2.6, 0, Math.PI * 2);
          ctx.fill();
        });
        burstsRef.current = burstsRef.current.filter((b) => b.life > 0);
      }
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const triggerBurst = (color: string) => {
    const el = scrollRef.current;
    if (!el) return;
    const cx = dimsRef.current.w / 2;
    const cy = el.scrollTop + el.clientHeight * 0.3;
    const rgb = hexRgb(color);
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 5;
      burstsRef.current.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, life: 1, rgb });
    }
  };

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  // ---------- CRUD ----------
  const persistGoal = (g: VisionGoal) => {
    if (dbDown) return;
    db.visionGoals
      .update(g.id, {
        title: g.title,
        target: g.target,
        note: g.note,
        color: g.color,
        deadline: g.deadline,
        steps: g.steps,
        sort_order: g.sort_order,
      })
      .catch(() => flash('Could not save — check the vision_goals table'));
  };

  const updateGoal = (id: string, patch: Partial<VisionGoal>, persist: boolean) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    if (persist) {
      const cur = goalsRef.current.find((g) => g.id === id);
      if (cur) persistGoal({ ...cur, ...patch });
    }
  };

  const addGoal = async () => {
    const sort_order = goals.reduce((m, g) => Math.max(m, g.sort_order), 0) + 1;
    const color = GOAL_COLORS[Math.floor(Math.random() * GOAL_COLORS.length)];
    const draft = { title: 'New goal', target: '', note: '', color, deadline: null, steps: [], sort_order };
    if (dbDown) {
      const local: VisionGoal = {
        id: 'local-' + Date.now(),
        user_id: 'single-user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...draft,
      };
      setGoals((p) => [...p, local]);
      setSelectedId(local.id);
      return;
    }
    try {
      const row = await db.visionGoals.add(draft);
      setGoals((p) => [...p, row]);
      setSelectedId(row.id);
    } catch {
      flash('Could not create — run the vision_goals migration');
      setDbDown(true);
    }
  };

  const deleteGoal = (id: string) => {
    setGoals((p) => p.filter((g) => g.id !== id));
    setSelectedId(null);
    if (!dbDown) db.visionGoals.delete(id).catch(() => flash('Delete failed'));
  };

  // ---------- drag ----------
  const deadlineFromClientY = (clientY: number): string => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const y = clientY - rect.top;
    const days = Math.max(0, Math.round((layoutH - BOT_PAD - y) / ppd));
    return iso(addDays(todayMidnight(), days));
  };

  const onCardPointerDown = (e: React.PointerEvent, goal: VisionGoal) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const mode: 'placed' | 'tray' = goal.deadline ? 'placed' : 'tray';
    let moved = false;

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) > 5) {
        moved = true;
        setDrag({ id: goal.id, mode, x: ev.clientX, y: ev.clientY, previewDeadline: goal.deadline });
      }
      if (moved) {
        if (mode === 'placed') {
          const dl = deadlineFromClientY(ev.clientY);
          setDrag((d) => (d ? { ...d, previewDeadline: dl } : d));
        } else {
          setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d));
        }
      }
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!moved) {
        setSelectedId(goal.id);
      } else if (mode === 'placed') {
        updateGoal(goal.id, { deadline: deadlineFromClientY(ev.clientY) }, true);
      } else {
        const rect = scrollRef.current!.getBoundingClientRect();
        const inside =
          ev.clientX > rect.left && ev.clientX < rect.right && ev.clientY > rect.top && ev.clientY < rect.bottom;
        if (inside) updateGoal(goal.id, { deadline: deadlineFromClientY(ev.clientY) }, true);
      }
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ---------- derived ----------
  const placed = useMemo(
    () => goals.filter((g) => g.deadline).sort((a, b) => daysUntil(a.deadline!) - daysUntil(b.deadline!)),
    [goals]
  );
  const unplaced = goals.filter((g) => !g.deadline);
  const nextId = placed.find((g) => daysUntil(g.deadline!) >= 0 && !isDone(g))?.id ?? null;

  const ticks = useMemo(() => {
    const today = todayMidnight();
    const end = addDays(today, maxDays());
    const arr: { y: number; label: string; quarter: boolean; key: string }[] = [];
    let cur = new Date(today.getFullYear(), today.getMonth(), 1);
    while (cur <= end) {
      const days = Math.round((cur.getTime() - today.getTime()) / DAY);
      if (days >= -2) {
        const quarter = cur.getMonth() % 3 === 0;
        const label = quarter
          ? `Q${Math.floor(cur.getMonth() / 3) + 1} · ${cur.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()} ${cur.getFullYear()}`
          : cur.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
        arr.push({ y: yForDays(days), label, quarter, key: iso(cur) });
      }
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, ppd, viewportH]);

  const selectedGoal = goals.find((g) => g.id === selectedId) || null;
  const today = todayMidnight();

  return (
    <div className="fixed left-0 right-0 bottom-0 top-[100px] md:top-[90px] flex overflow-hidden bg-[#f7f6f3]">
      {/* ---------------- Tray ---------------- */}
      <aside className="w-[220px] sm:w-[264px] flex-shrink-0 flex flex-col gap-3.5 p-4 overflow-y-auto bg-amber-50/40 border-r border-black/5">
        <button
          onClick={addGoal}
          className="text-white font-bold text-sm rounded-xl py-3 px-3.5 flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(120deg,#06b6d4,#7c3aed)', boxShadow: '0 6px 18px rgba(124,58,237,0.35)' }}
        >
          <Plus className="w-4 h-4" /> New goal
        </button>

        <p className="text-xs leading-relaxed ink-text-muted">
          Drag a goal onto the timeline to set its deadline. Drag up = further out. Click any goal to open its details.
        </p>

        {dbDown && (
          <div className="text-[11px] leading-relaxed rounded-lg border border-amber-300 bg-amber-100/60 text-amber-800 px-2.5 py-2">
            Working offline — run the <code className="font-mono">vision_goals</code> migration to save your goals.
          </div>
        )}

        <h2 className="text-[11px] tracking-wider uppercase ink-text-muted font-bold mt-1">Timeline scale</h2>
        <div className="flex gap-1.5">
          {ZOOMS.map((z, i) => (
            <button
              key={z.name}
              onClick={() => setZoomIndex(i)}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-lg border transition ${
                i === zoomIndex
                  ? 'ink-text border-violet-400 shadow-[0_0_0_1px_#7c3aed_inset]'
                  : 'ink-text-muted border-black/10 bg-white hover:bg-amber-50'
              }`}
            >
              {z.name}
            </button>
          ))}
        </div>

        <h2 className="text-[11px] tracking-wider uppercase ink-text-muted font-bold mt-1">Unscheduled</h2>
        <div className="flex flex-col gap-2.5 min-h-[40px]">
          {unplaced.length === 0 && <p className="text-xs ink-text-muted/70">Everything is on the timeline ✦</p>}
          {unplaced.map((g) => (
            <div
              key={g.id}
              onPointerDown={(e) => onCardPointerDown(e, g)}
              className="relative paper-card paper-border rounded-xl p-3 cursor-grab active:cursor-grabbing overflow-hidden select-none"
              style={{ touchAction: 'none', opacity: drag?.id === g.id ? 0.4 : 1 }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: g.color }} />
              <div className="font-semibold text-sm ink-text leading-tight">{g.title}</div>
              <div className="text-[11px] ink-text-muted font-mono mt-1">{g.target || 'no target'}</div>
            </div>
          ))}
        </div>
      </aside>

      {/* ---------------- Timeline ---------------- */}
      <div ref={scrollRef} className={`flex-1 overflow-auto relative ${drag?.mode === 'tray' ? 'ring-2 ring-inset ring-violet-300/70' : ''}`}>
        <div ref={canvasRef} className="relative min-h-full" style={{ height: layoutH }}>
          {/* ambient glow behind the spine */}
          <div
            className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[280px] pointer-events-none"
            style={{ background: 'radial-gradient(closest-side, rgba(124,58,237,0.06), transparent)' }}
          />
          <canvas ref={pCanvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }} />

          {/* month / quarter gridlines */}
          {ticks.map((t) => (
            <div key={t.key} className="absolute left-0 right-0 pointer-events-none" style={{ top: t.y, zIndex: 2 }}>
              <div
                className="absolute left-[7%] right-[7%]"
                style={
                  t.quarter
                    ? { top: 0, height: 1, background: 'rgba(0,0,0,0.12)' }
                    : { top: 0, height: 0, borderTop: '1px dashed rgba(0,0,0,0.07)' }
                }
              />
              <div
                className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-mono tracking-wider rounded-full border ${
                  t.quarter
                    ? 'text-[11px] font-bold ink-text px-2.5 py-0.5 bg-white border-black/10 shadow-sm'
                    : 'text-[10px] ink-text-muted px-2 py-0.5 bg-[#f7f6f3] border-black/5'
                }`}
              >
                {t.label}
              </div>
            </div>
          ))}

          {/* glowing spine */}
          <div
            className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 rounded"
            style={{
              zIndex: 2,
              background:
                'linear-gradient(to top, rgba(6,182,212,0.15), #06b6d4 18%, #7c3aed 82%, rgba(124,58,237,0.12))',
              boxShadow: '0 0 12px rgba(6,182,212,0.5), 0 0 30px rgba(124,58,237,0.32)',
            }}
          />

          {/* nodes + connectors + cards */}
          {placed.map((g, i) => {
            const side = i % 2 === 0 ? 'left' : 'right';
            const isDragging = drag?.id === g.id;
            const dl = isDragging && drag?.previewDeadline ? drag.previewDeadline : g.deadline!;
            const y = yForDeadline(dl);
            const days = daysUntil(dl);
            const u = urgency(dl);
            const uColor = URGENCY_COLOR[u];
            const done = isDone(g);
            const pr = progress(g);
            const isNext = g.id === nextId;
            const dm = fmtDayMonth(dl);

            return (
              <div key={g.id}>
                {/* connector */}
                <div
                  className="absolute h-[2px]"
                  style={{
                    top: y,
                    width: GAP,
                    zIndex: 3,
                    transform: 'translateY(-50%)',
                    opacity: isNext ? 0.9 : 0.5,
                    ...(side === 'left'
                      ? { right: 'calc(50% + 2px)', background: `linear-gradient(90deg, ${g.color}, ${g.color}22)` }
                      : { left: 'calc(50% + 2px)', background: `linear-gradient(270deg, ${g.color}, ${g.color}22)` }),
                  }}
                />
                {/* node */}
                <div
                  className="absolute left-1/2 w-3.5 h-3.5 rounded-full -translate-x-1/2 -translate-y-1/2"
                  style={{
                    top: y,
                    zIndex: 4,
                    background: '#fff',
                    boxShadow: `0 0 0 3px ${g.color}, 0 0 12px 2px ${g.color}`,
                  }}
                >
                  {isNext && (
                    <span
                      className="absolute inset-0 rounded-full animate-ping"
                      style={{ boxShadow: `0 0 0 3px ${g.color}`, opacity: 0.6 }}
                    />
                  )}
                </div>

                {/* card */}
                <div
                  onPointerDown={(e) => onCardPointerDown(e, g)}
                  className={`absolute paper-card rounded-2xl overflow-hidden select-none cursor-grab active:cursor-grabbing ${
                    isDragging ? 'shadow-2xl' : 'paper-shadow hover:shadow-xl'
                  }`}
                  style={{
                    top: y,
                    width: CARD_W,
                    zIndex: isDragging ? 30 : 5,
                    transform: 'translateY(-50%)',
                    ...(side === 'left' ? { right: `calc(50% + ${GAP + 2}px)` } : { left: `calc(50% + ${GAP + 2}px)` }),
                    border: `1px solid ${isNext ? g.color + '66' : 'rgba(0,0,0,0.06)'}`,
                    touchAction: 'none',
                    transition: isDragging ? 'none' : 'box-shadow 0.15s ease',
                    opacity: done ? 0.9 : 1,
                  }}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: g.color }} />
                  <div className="pl-4 pr-3 pt-3 pb-3 flex flex-col gap-2.5">
                    {/* title + target */}
                    <div className="flex items-start justify-between gap-2">
                      <div className={`font-bold text-[15px] leading-snug ink-text ${done ? 'line-through' : ''}`}>
                        {g.title}
                      </div>
                      {g.target && (
                        <div
                          className="font-mono text-[11px] font-bold px-2 py-1 rounded-lg whitespace-nowrap"
                          style={{ color: g.color, background: `${g.color}22` }}
                        >
                          {g.target}
                        </div>
                      )}
                    </div>

                    {/* progress */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.round(pr * 100)}%`,
                            background: `linear-gradient(90deg, ${g.color}99, ${g.color})`,
                            boxShadow: `0 0 8px ${g.color}66`,
                          }}
                        />
                      </div>
                      <span className="font-mono text-[10px] ink-text-muted">
                        {g.steps.filter((s) => s.done).length}/{g.steps.length}
                      </span>
                    </div>

                    {/* HERO deadline band */}
                    <div
                      className="flex items-center justify-between rounded-xl px-3 py-2 mt-0.5"
                      style={{ background: `${uColor}12`, border: `1px solid ${uColor}22` }}
                    >
                      <div className="flex items-center gap-2">
                        <CalendarClock className="w-4 h-4" style={{ color: uColor }} />
                        <div className="leading-none">
                          <div className="font-mono font-extrabold text-[17px] ink-text tabular-nums">
                            {dm.day} {dm.month}
                          </div>
                          <div className="text-[10px] ink-text-muted mt-0.5">deadline</div>
                        </div>
                      </div>
                      <div className="text-right leading-none">
                        {days === 0 ? (
                          <div className="font-extrabold text-[15px]" style={{ color: uColor }}>
                            TODAY
                          </div>
                        ) : (
                          <>
                            <div className="font-extrabold text-[22px] tabular-nums" style={{ color: uColor }}>
                              {Math.abs(days)}
                            </div>
                            <div className="text-[10px] font-semibold" style={{ color: uColor }}>
                              {days > 0 ? 'days left' : 'overdue'}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* TODAY marker */}
          <div
            className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none"
            style={{ top: yForDays(0), zIndex: 6 }}
          >
            <div className="relative w-[52px] h-[52px] rounded-full" style={{
              background: 'radial-gradient(circle at 35% 30%, #fff, #f59e0b 55%, #d97706)',
              boxShadow: '0 0 0 4px #f7f6f3, 0 0 0 5px #f59e0b, 0 0 26px 6px rgba(245,158,11,0.55)',
            }}>
              <span className="absolute inset-[-14px] rounded-full border-2 border-amber-400 animate-ping opacity-40" />
            </div>
            <div className="font-mono text-[10px] tracking-widest font-bold text-amber-700 bg-white border border-black/10 px-2.5 py-0.5 rounded-full shadow-sm">
              {today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()} · TODAY
            </div>
          </div>
        </div>
      </div>

      {/* floating ghost while dragging from tray */}
      {drag?.mode === 'tray' && (
        <div
          className="fixed z-[90] w-[230px] pointer-events-none paper-card rounded-2xl p-3 border border-dashed border-violet-400 shadow-2xl font-semibold text-sm ink-text"
          style={{ left: drag.x - 115, top: drag.y - 24 }}
        >
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-violet-500" />
            {goals.find((g) => g.id === drag.id)?.title}
          </div>
        </div>
      )}

      {/* drawer + scrim */}
      {selectedGoal && (
        <>
          <div className="fixed inset-0 z-[65] bg-black/25 backdrop-blur-[2px]" onClick={() => setSelectedId(null)} />
          <GoalDrawer
            goal={selectedGoal}
            onChange={(patch, persist) => updateGoal(selectedGoal.id, patch, persist)}
            onDelete={() => deleteGoal(selectedGoal.id)}
            onClose={() => setSelectedId(null)}
            onComplete={triggerBurst}
          />
        </>
      )}

      {/* toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[95] bg-stone-800 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-toast-in">
          {toast}
          <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- particle helpers ----------
function spawn(_w: number, h: number, rand: boolean): Particle {
  return {
    y: rand ? Math.random() * h : h + 10,
    vy: -(0.3 + Math.random() * 0.7),
    drift: Math.random() * Math.PI * 2,
    amp: 6 + Math.random() * 22,
    r: 0.8 + Math.random() * 1.8,
    hue: Math.random() < 0.5 ? '6,182,212' : '124,58,237',
    a: 0.4 + Math.random() * 0.45,
  };
}
function hexRgb(h: string) {
  const n = parseInt(h.slice(1), 16);
  return `${n >> 16},${(n >> 8) & 255},${n & 255}`;
}

// ---------- demo seed ----------
function demoGoals(): VisionGoal[] {
  const t = todayMidnight();
  const base = {
    user_id: 'single-user',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const mk = (
    i: number,
    title: string,
    target: string,
    color: string,
    days: number | null,
    note: string,
    steps: { text: string; done: boolean }[]
  ): VisionGoal => ({
    id: 'demo-' + i,
    title,
    target,
    color,
    note,
    steps,
    sort_order: i,
    deadline: days === null ? null : iso(addDays(t, days)),
    ...base,
  });
  return [
    mk(1, 'Hit $10k / month', '$10,000/mo', '#d97706', 132, 'Recurring revenue across products — the north star.', [
      { text: 'Land first 3 paying clients', done: true },
      { text: 'Reach $3k MRR', done: true },
      { text: 'Build referral loop', done: false },
      { text: 'Hire first contractor', done: false },
    ]),
    mk(2, 'Ship the app v1.0', 'Public launch', '#06b6d4', 38, "Get the product in real users' hands.", [
      { text: 'Finish onboarding flow', done: true },
      { text: 'Payments live', done: false },
      { text: 'Landing page', done: false },
      { text: 'Launch on Product Hunt', done: false },
    ]),
    mk(3, 'Bench press 100kg', '100 kg × 1', '#059669', 84, 'Progressive overload, 4 sessions/week.', [
      { text: '85kg', done: true },
      { text: '90kg', done: true },
      { text: '95kg', done: false },
      { text: '100kg', done: false },
    ]),
    mk(4, 'Memorize Surah Al-Kahf', '110 ayahs', '#7c3aed', 26, 'Every Friday feels different once this is locked in.', [
      { text: 'Ayahs 1–30', done: true },
      { text: 'Ayahs 31–60', done: false },
      { text: 'Ayahs 61–90', done: false },
      { text: 'Ayahs 91–110', done: false },
    ]),
    mk(5, 'Grow to 10k followers', '10,000', '#2563eb', 205, 'Build in public. Consistency over virality.', [
      { text: '1k', done: true },
      { text: '3k', done: false },
      { text: '6k', done: false },
      { text: '10k', done: false },
    ]),
    mk(6, 'Launch weekly newsletter', 'Issue #1', '#e11d48', null, '', [
      { text: 'Pick platform', done: false },
      { text: 'Write 3 issues ahead', done: false },
    ]),
    mk(7, 'Read 12 books this year', '12 books', '#06b6d4', null, '', [{ text: 'Book 1', done: false }]),
  ];
}

async function seedDemoGoals(): Promise<VisionGoal[]> {
  const out: VisionGoal[] = [];
  for (const g of demoGoals()) {
    const row = await db.visionGoals.add({
      title: g.title,
      target: g.target,
      note: g.note,
      color: g.color,
      deadline: g.deadline,
      steps: g.steps,
      sort_order: g.sort_order,
    });
    out.push(row);
  }
  return out;
}
