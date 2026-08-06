import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Flag, CalendarClock, X, Check, Minus, Undo2, Redo2, History, RotateCcw, Save, Heart } from 'lucide-react';
import { db } from '../lib/database';
import { undoManager } from '../lib/undoManager';
import { VisionGoal, VisionSnapshot, VisionTopic } from '../types';
import {
  DAY,
  GOAL_COLORS,
  MILESTONE_NEUTRAL,
  todayMidnight,
  iso,
  addDays,
  daysUntil,
  fmtDate,
  fmtDayMonth,
  urgency,
  Urgency,
} from '../lib/visionUtils';
import GoalDrawer from './GoalDrawer';
import ReflectionsPanel from './ReflectionsPanel';

// Single timeline; spacing (pixels-per-day) is user-adjustable to spread out cramped items.
const PPD_MIN = 4;
const PPD_MAX = 30;
const PPD_DEFAULT = 7;
const TOP_PAD = 90;
const BOT_PAD = 150;
const GAP = 46; // spine → goal card
const GAP_M = 20; // spine → milestone label
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

const isMs = (g: VisionGoal) => g.kind === 'milestone';

export default function VisionTab() {
  const [goals, setGoals] = useState<VisionGoal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewportH, setViewportH] = useState(800);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dbDown, setDbDown] = useState(false);
  const [pendingMove, setPendingMove] = useState<{ id: string; from: string | null; to: string } | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<VisionSnapshot[]>([]);
  const [restoreDate, setRestoreDate] = useState<string | null>(null);
  const [versionsBusy, setVersionsBusy] = useState(false);
  const [topics, setTopics] = useState<VisionTopic[]>([]);
  const [showReflections, setShowReflections] = useState(false);
  const [reflHeading, setReflHeading] = useState({
    title: 'Reflections',
    subtitle: 'Life areas and how you want to hold them.',
  });
  const reflHeadingRef = useRef(reflHeading);
  useEffect(() => {
    reflHeadingRef.current = reflHeading;
  });
  const [ppd, setPpd] = useState<number>(() => {
    const saved = Number(localStorage.getItem('vision_ppd'));
    return saved >= PPD_MIN && saved <= PPD_MAX ? saved : PPD_DEFAULT;
  });
  useEffect(() => {
    localStorage.setItem('vision_ppd', String(ppd));
  }, [ppd]);

  // Remember which day is at the centre of the viewport so we can zoom around it.
  const captureAnchor = () => {
    const el = scrollRef.current;
    if (!el) return;
    const centerY = el.scrollTop + el.clientHeight / 2;
    anchorDaysRef.current = (layoutH - BOT_PAD - centerY) / ppd;
  };
  const setPpdClamped = (v: number) => setPpd(Math.min(PPD_MAX, Math.max(PPD_MIN, v)));
  const stepPpd = (delta: number) => {
    captureAnchor();
    setPpdClamped(ppd + delta);
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pCanvasRef = useRef<HTMLCanvasElement>(null);
  const goalsRef = useRef<VisionGoal[]>([]);
  const topicsRef = useRef<VisionTopic[]>([]);
  const dimsRef = useRef({ w: 0, h: 0 });
  const particlesRef = useRef<Particle[]>([]);
  const burstsRef = useRef<Burst[]>([]);
  const didInitScroll = useRef(false);
  const pausedRef = useRef(false);
  const anchorDaysRef = useRef<number | null>(null); // day kept centered while changing spacing
  const zoomingRef = useRef(false);

  useEffect(() => {
    goalsRef.current = goals;
  });
  useEffect(() => {
    topicsRef.current = topics;
  });
  useEffect(() => {
    pausedRef.current = selectedId !== null;
  }, [selectedId]);

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

  // After spacing changes, re-anchor scroll so the previously-centred day stays centred.
  useEffect(() => {
    const el = scrollRef.current;
    const days = anchorDaysRef.current;
    if (!el || days == null) return;
    const centerY = layoutH - BOT_PAD - days * ppd;
    el.scrollTop = Math.max(0, Math.min(centerY - el.clientHeight / 2, el.scrollHeight - el.clientHeight));
    if (!zoomingRef.current) anchorDaysRef.current = null;
  }, [ppd, layoutH]);

  const refreshUndo = useCallback(() => {
    setCanUndo(undoManager.canUndo());
    setCanRedo(undoManager.canRedo());
  }, []);

  const reloadGoals = useCallback(async () => {
    try {
      const rows = await db.visionGoals.getAll();
      setGoals(normalize(rows));
    } catch {
      /* leave current state */
    }
  }, []);

  const reloadTopics = useCallback(async () => {
    try {
      const rows = await db.visionTopics.getAll();
      setTopics(rows.map((t) => ({ ...t, emotions: Array.isArray(t.emotions) ? t.emotions : [] })));
    } catch {
      /* table may be absent until migration */
    }
  }, []);

  // ---------- load ----------
  useEffect(() => {
    (async () => {
      try {
        let rows = await db.visionGoals.getAll();
        if (rows.length === 0) rows = await seedDemo();
        const norm = normalize(rows);
        setGoals(norm);
        // Capture today's baseline version once per day (ignored if snapshots table is absent).
        db.visionSnapshots.ensureToday(iso(todayMidnight()), norm).catch(() => {});
      } catch {
        setDbDown(true);
        setGoals(demoGoals());
      }
      reloadTopics();
      db.visionSettings
        .get()
        .then((s) => {
          if (s) setReflHeading({ title: s.reflections_title, subtitle: s.reflections_subtitle });
        })
        .catch(() => {});
      refreshUndo();
    })();
  }, [refreshUndo, reloadTopics]);

  const openVersions = async () => {
    setShowVersions(true);
    try {
      setVersions(await db.visionSnapshots.list());
    } catch {
      setVersions([]);
      flash('Run the vision_snapshots migration to use Versions');
    }
  };

  const saveVersionNow = async () => {
    try {
      await db.visionSnapshots.saveToday(iso(todayMidnight()), goalsRef.current);
      setVersions(await db.visionSnapshots.list());
      flash('Version saved');
    } catch {
      flash('Could not save version');
    }
  };

  const doRestore = async (date: string) => {
    setVersionsBusy(true);
    try {
      // checkpoint current state under today before overwriting, so the restore is reversible
      await db.visionSnapshots.saveToday(iso(todayMidnight()), goalsRef.current);
      const data = await db.visionSnapshots.get(date);
      await db.visionGoals.replaceAll(data);
      await reloadGoals();
      undoManager.clear();
      refreshUndo();
      flash('Restored version from ' + fmtDate(date));
      setShowVersions(false);
    } catch {
      flash('Restore failed');
    }
    setRestoreDate(null);
    setVersionsBusy(false);
  };

  const handleUndo = useCallback(async () => {
    if (!undoManager.canUndo()) return;
    await undoManager.undo();
    await Promise.all([reloadGoals(), reloadTopics()]);
    refreshUndo();
    setToast('Undone');
    window.setTimeout(() => setToast(null), 1600);
  }, [reloadGoals, reloadTopics, refreshUndo]);

  const handleRedo = useCallback(async () => {
    if (!undoManager.canRedo()) return;
    await undoManager.redo();
    await Promise.all([reloadGoals(), reloadTopics()]);
    refreshUndo();
    setToast('Redone');
    window.setTimeout(() => setToast(null), 1600);
  }, [reloadGoals, reloadTopics, refreshUndo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((mod && key === 'z' && e.shiftKey) || (mod && key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo]);

  // ---------- viewport measure ----------
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight));
    ro.observe(el);
    setViewportH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // start at "today" (bottom), looking upward
  useEffect(() => {
    if (didInitScroll.current) return;
    const el = scrollRef.current;
    if (el && goals.length) {
      el.scrollTop = el.scrollHeight;
      didInitScroll.current = true;
    }
  }, [goals, layoutH]);

  // ---------- particles (viewport-sized, follows scroll) ----------
  useEffect(() => {
    const canvas = pCanvasRef.current;
    const scrollEl = scrollRef.current;
    if (!canvas || !scrollEl) return;
    const ctx = canvas.getContext('2d')!;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;

    const resize = () => {
      const w = scrollEl.clientWidth;
      const h = scrollEl.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dimsRef.current = { w, h };
      if (particlesRef.current.length === 0) {
        for (let i = 0; i < 32; i++) particlesRef.current.push(spawn(h, true));
      }
    };
    const reposition = () => {
      canvas.style.top = scrollEl.scrollTop + 'px';
    };
    resize();
    reposition();
    const ro = new ResizeObserver(() => {
      resize();
      reposition();
    });
    ro.observe(scrollEl);
    scrollEl.addEventListener('scroll', reposition, { passive: true });

    const frame = () => {
      const hasBursts = burstsRef.current.length > 0;
      if (!pausedRef.current || hasBursts) {
        const { w, h } = dimsRef.current;
        ctx.clearRect(0, 0, w, h);
        const cx = w / 2;
        particlesRef.current.forEach((p) => {
          p.y += p.vy;
          p.drift += 0.02;
          const x = cx + Math.sin(p.drift) * p.amp;
          if (p.y < -10) Object.assign(p, spawn(h, false));
          ctx.beginPath();
          ctx.fillStyle = `rgba(${p.hue},${p.a})`;
          ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        });
        if (hasBursts) {
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
      }
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scrollEl.removeEventListener('scroll', reposition);
    };
  }, []);

  const triggerBurst = (color: string) => {
    const cx = dimsRef.current.w / 2;
    const cy = dimsRef.current.h * 0.3;
    const rgb = hexRgb(color);
    for (let i = 0; i < 36; i++) {
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
        kind: g.kind,
        goal_id: g.goal_id,
        title: g.title,
        target: g.target,
        note: g.note,
        color: g.color,
        deadline: g.deadline,
        done: g.done,
        sort_order: g.sort_order,
      })
      .catch(() => flash('Could not save — run the latest vision_goals migration'));
  };

  const updateGoal = (id: string, patch: Partial<VisionGoal>, persist: boolean) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    if (persist) {
      const cur = goalsRef.current.find((g) => g.id === id);
      if (cur) {
        const after = { ...cur, ...patch };
        persistGoal(after);
        if (!dbDown && visionChanged(cur, after)) {
          undoManager.addToUndoHistory({ type: 'vision_update', before: cur, after, timestamp: Date.now() });
          refreshUndo();
        }
      }
    }
  };

  const addItem = async (kind: 'goal' | 'milestone') => {
    const sort_order = goals.reduce((m, g) => Math.max(m, g.sort_order), 0) + 1;
    const draft = {
      kind,
      goal_id: null,
      title: kind === 'goal' ? 'New goal' : 'New milestone',
      target: '',
      note: '',
      color: kind === 'goal' ? GOAL_COLORS[Math.floor(Math.random() * GOAL_COLORS.length)] : MILESTONE_NEUTRAL,
      deadline: null,
      done: false,
      sort_order,
    };
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
      const norm = { ...row, kind: row.kind ?? kind, done: row.done ?? false, goal_id: row.goal_id ?? null };
      setGoals((p) => [...p, norm]);
      setSelectedId(row.id);
      undoManager.addToUndoHistory({ type: 'vision_add', row: norm, timestamp: Date.now() });
      refreshUndo();
    } catch {
      flash('Could not create — run the latest vision_goals migration');
      setDbDown(true);
    }
  };

  const deleteGoal = (id: string) => {
    const row = goalsRef.current.find((g) => g.id === id);
    setGoals((p) => p.filter((g) => g.id !== id).map((g) => (g.goal_id === id ? { ...g, goal_id: null } : g)));
    setSelectedId(null);
    if (!dbDown) {
      db.visionGoals.delete(id).catch(() => flash('Delete failed'));
      if (row) {
        undoManager.addToUndoHistory({ type: 'vision_delete', row, timestamp: Date.now() });
        refreshUndo();
      }
    }
  };

  // ---------- topics (Reflections) ----------
  const persistTopic = (t: VisionTopic) => {
    if (dbDown) return;
    db.visionTopics
      .update(t.id, { title: t.title, color: t.color, emotions: t.emotions, sort_order: t.sort_order })
      .catch(() => flash('Could not save — run the vision_topics migration'));
  };

  const updateTopic = (id: string, patch: Partial<VisionTopic>, persist: boolean) => {
    setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    if (persist) {
      const cur = topicsRef.current.find((t) => t.id === id);
      if (cur) {
        const after = { ...cur, ...patch };
        persistTopic(after);
        if (!dbDown && topicChanged(cur, after)) {
          undoManager.addToUndoHistory({ type: 'topic_update', before: cur, after, timestamp: Date.now() });
          refreshUndo();
        }
      }
    }
  };

  const addTopic = async () => {
    const sort_order = topics.reduce((m, t) => Math.max(m, t.sort_order), 0) + 1;
    const draft = { title: 'New topic', color: GOAL_COLORS[Math.floor(Math.random() * GOAL_COLORS.length)], emotions: [], sort_order };
    try {
      const row = await db.visionTopics.add(draft);
      const norm = { ...row, emotions: Array.isArray(row.emotions) ? row.emotions : [] };
      setTopics((p) => [...p, norm]);
      undoManager.addToUndoHistory({ type: 'topic_add', topic: norm, timestamp: Date.now() });
      refreshUndo();
    } catch {
      flash('Could not create — run the vision_topics migration');
    }
  };

  const deleteTopic = (id: string) => {
    const row = topicsRef.current.find((t) => t.id === id);
    setTopics((p) => p.filter((t) => t.id !== id));
    db.visionTopics.delete(id).catch(() => flash('Delete failed'));
    if (row) {
      undoManager.addToUndoHistory({ type: 'topic_delete', topic: row, timestamp: Date.now() });
      refreshUndo();
    }
  };

  const updateReflHeading = (patch: Partial<{ title: string; subtitle: string }>, persist: boolean) => {
    setReflHeading((prev) => ({ ...prev, ...patch }));
    if (persist) {
      const after = { ...reflHeadingRef.current, ...patch };
      db.visionSettings
        .upsert({ reflections_title: after.title, reflections_subtitle: after.subtitle })
        .catch(() => flash('Could not save — run the vision_settings migration'));
    }
  };

  // ---------- drag ----------
  const deadlineFromClientY = (clientY: number): string => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const y = clientY - rect.top;
    const days = Math.max(0, Math.round((layoutH - BOT_PAD - y) / ppd));
    return iso(addDays(todayMidnight(), days));
  };

  const onItemPointerDown = (e: React.PointerEvent, item: VisionGoal) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const mode: 'placed' | 'tray' = item.deadline ? 'placed' : 'tray';
    let moved = false;

    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 5) {
        moved = true;
        setDrag({ id: item.id, mode, x: ev.clientX, y: ev.clientY, previewDeadline: item.deadline });
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
        setSelectedId(item.id);
      } else if (mode === 'placed') {
        const to = deadlineFromClientY(ev.clientY);
        if (to !== item.deadline) {
          // Show the item at the new spot optimistically, but wait for confirmation before saving.
          updateGoal(item.id, { deadline: to }, false);
          setPendingMove({ id: item.id, from: item.deadline, to });
        }
      } else {
        const rect = scrollRef.current!.getBoundingClientRect();
        const inside =
          ev.clientX > rect.left && ev.clientX < rect.right && ev.clientY > rect.top && ev.clientY < rect.bottom;
        if (inside) updateGoal(item.id, { deadline: deadlineFromClientY(ev.clientY) }, true);
      }
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const confirmMove = () => {
    if (!pendingMove) return;
    updateGoal(pendingMove.id, { deadline: pendingMove.to }, true);
    setPendingMove(null);
  };
  const cancelMove = () => {
    if (!pendingMove) return;
    updateGoal(pendingMove.id, { deadline: pendingMove.from }, false);
    setPendingMove(null);
  };
  useEffect(() => {
    if (!pendingMove) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') confirmMove();
      else if (e.key === 'Escape') cancelMove();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMove]);

  // ---------- derived ----------
  const placedGoals = useMemo(
    () => goals.filter((g) => !isMs(g) && g.deadline).sort((a, b) => daysUntil(a.deadline!) - daysUntil(b.deadline!)),
    [goals]
  );
  const placedMilestones = useMemo(
    () => goals.filter((g) => isMs(g) && g.deadline).sort((a, b) => daysUntil(a.deadline!) - daysUntil(b.deadline!)),
    [goals]
  );
  const unscheduled = goals.filter((g) => !g.deadline);
  const attachOptions = goals.filter((g) => !isMs(g)).map((g) => ({ id: g.id, title: g.title, color: g.color }));
  const nextId = placedGoals.find((g) => daysUntil(g.deadline!) >= 0 && !g.done)?.id ?? null;
  const msColor = (g: VisionGoal) =>
    g.goal_id ? goals.find((x) => x.id === g.goal_id)?.color ?? MILESTONE_NEUTRAL : MILESTONE_NEUTRAL;

  const ticks = useMemo(() => {
    const today = todayMidnight();
    const end = addDays(today, maxDays());
    const arr: { y: number; label: string; key: string }[] = [];
    let cur = new Date(today.getFullYear(), today.getMonth(), 1);
    while (cur <= end) {
      const days = Math.round((cur.getTime() - today.getTime()) / DAY);
      if (days >= -2) {
        arr.push({
          y: yForDays(days),
          label: cur.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() + ' ' + cur.getFullYear(),
          key: iso(cur),
        });
      }
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, viewportH, ppd]);

  const selectedGoal = goals.find((g) => g.id === selectedId) || null;
  const today = todayMidnight();

  return (
    <div className="fixed left-0 right-0 bottom-0 top-[100px] md:top-[90px] flex overflow-hidden bg-[#f7f6f3]">
      <style>{`
        .vision-range { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 999px; background: #e7e5e4; outline: none; }
        .vision-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #57534e; border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); cursor: pointer; }
        .vision-range::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #57534e; border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); cursor: pointer; }
        .vision-range::-moz-range-track { height: 6px; border-radius: 999px; background: #e7e5e4; }
      `}</style>
      {/* ---------------- Tray ---------------- */}
      <aside className="w-[220px] sm:w-[264px] flex-shrink-0 flex flex-col gap-3 p-4 overflow-y-auto bg-amber-50/40 border-r border-black/5">
        <div className="flex gap-2">
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white border border-black/10 ink-text text-sm font-semibold hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Undo (Ctrl/Cmd+Z)"
          >
            <Undo2 className="w-4 h-4" /> Undo
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white border border-black/10 ink-text text-sm font-semibold hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Redo (Ctrl/Cmd+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" /> Redo
          </button>
        </div>
        <button
          onClick={() => addItem('goal')}
          className="bg-stone-800 hover:bg-stone-900 text-white font-bold text-sm rounded-xl py-3 px-3.5 flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> New goal
        </button>
        <button
          onClick={() => addItem('milestone')}
          className="bg-white border border-black/10 ink-text font-semibold text-sm rounded-xl py-2.5 px-3.5 flex items-center justify-center gap-2 hover:bg-stone-50 transition-colors"
        >
          <Flag className="w-3.5 h-3.5" /> New milestone
        </button>
        <button
          onClick={() => setShowReflections(true)}
          className="bg-white border border-black/10 ink-text-muted hover:ink-text font-semibold text-sm rounded-xl py-2 px-3.5 flex items-center justify-center gap-2 hover:bg-stone-50 transition-colors"
          title="Important points to keep in mind"
        >
          <Heart className="w-3.5 h-3.5 text-rose-500" /> Reflections
        </button>
        <button
          onClick={openVersions}
          className="bg-white border border-black/10 ink-text-muted hover:ink-text font-semibold text-sm rounded-xl py-2 px-3.5 flex items-center justify-center gap-2 hover:bg-stone-50 transition-colors"
          title="Daily version history"
        >
          <History className="w-3.5 h-3.5" /> Versions
        </button>

        <p className="text-xs leading-relaxed ink-text-muted mt-1">
          Drag an item onto the timeline to set its date. Drag up = further out. Click to open details.
        </p>

        {dbDown && (
          <div className="text-[11px] leading-relaxed rounded-lg border border-amber-300 bg-amber-100/60 text-amber-800 px-2.5 py-2">
            Working offline — run the latest <code className="font-mono">vision_goals</code> migration to save.
          </div>
        )}

        <h2 className="text-[11px] tracking-wider uppercase ink-text-muted font-bold mt-2">Timeline spacing</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => stepPpd(-2)}
            disabled={ppd <= PPD_MIN}
            className="w-8 h-8 flex-none rounded-lg bg-white border border-black/10 ink-text flex items-center justify-center hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Tighter"
          >
            <Minus className="w-4 h-4" />
          </button>
          <input
            type="range"
            min={PPD_MIN}
            max={PPD_MAX}
            step={1}
            value={ppd}
            onPointerDown={() => {
              captureAnchor();
              zoomingRef.current = true;
            }}
            onChange={(e) => {
              if (anchorDaysRef.current == null) captureAnchor();
              setPpdClamped(Number(e.target.value));
            }}
            onPointerUp={() => {
              zoomingRef.current = false;
              anchorDaysRef.current = null;
            }}
            onBlur={() => {
              zoomingRef.current = false;
            }}
            className="vision-range flex-1 cursor-pointer"
            title="Drag to spread the timeline out"
          />
          <button
            onClick={() => stepPpd(2)}
            disabled={ppd >= PPD_MAX}
            className="w-8 h-8 flex-none rounded-lg bg-white border border-black/10 ink-text flex items-center justify-center hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Spread out"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11px] ink-text-muted -mt-1">Drag the slider to spread items out when a month gets crowded.</p>

        <h2 className="text-[11px] tracking-wider uppercase ink-text-muted font-bold mt-2">Unscheduled</h2>
        <div className="flex flex-col gap-2 min-h-[40px]">
          {unscheduled.length === 0 && <p className="text-xs ink-text-muted/70">Everything is on the timeline ✦</p>}
          {unscheduled.map((g) =>
            isMs(g) ? (
              <div
                key={g.id}
                onPointerDown={(e) => onItemPointerDown(e, g)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 bg-white/70 border border-black/5 cursor-grab active:cursor-grabbing select-none"
                style={{ touchAction: 'none', opacity: drag?.id === g.id ? 0.4 : 1 }}
              >
                <span className="w-2 h-2 rounded-full flex-none" style={{ background: msColor(g) }} />
                <span className="text-[13px] ink-text truncate">{g.title}</span>
              </div>
            ) : (
              <div
                key={g.id}
                onPointerDown={(e) => onItemPointerDown(e, g)}
                className="relative paper-card paper-border rounded-xl p-3 cursor-grab active:cursor-grabbing overflow-hidden select-none"
                style={{ touchAction: 'none', opacity: drag?.id === g.id ? 0.4 : 1 }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: g.color }} />
                <div className="font-semibold text-sm ink-text leading-tight">{g.title}</div>
                <div className="text-[11px] ink-text-muted font-mono mt-1">{g.target || 'no target'}</div>
              </div>
            )
          )}
        </div>
      </aside>

      {/* ---------------- Timeline ---------------- */}
      <div
        ref={scrollRef}
        className={`flex-1 overflow-auto relative ${drag?.mode === 'tray' ? 'ring-2 ring-inset ring-stone-300/70' : ''}`}
      >
        <div ref={canvasRef} className="relative min-h-full" style={{ height: layoutH }}>
          <div
            className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[280px] pointer-events-none"
            style={{ background: 'radial-gradient(closest-side, rgba(124,58,237,0.05), transparent)' }}
          />
          <canvas ref={pCanvasRef} className="absolute left-0 top-0 pointer-events-none" style={{ zIndex: 1 }} />

          {/* month gridlines (light) + month-year labels above the spine */}
          {ticks.map((t) => (
            <div
              key={t.key + '-line'}
              className="absolute left-[6%] right-[6%] pointer-events-none"
              style={{ top: t.y, height: 1, background: 'rgba(0,0,0,0.06)', zIndex: 2 }}
            />
          ))}
          {ticks.map((t) => (
            <div
              key={t.key + '-lbl'}
              className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-mono tracking-wider text-[10px] font-semibold ink-text-muted px-2.5 py-0.5 rounded-full bg-white border border-black/5 shadow-sm pointer-events-none"
              style={{ top: t.y, zIndex: 7 }}
            >
              {t.label}
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

          {/* ---- milestones (small text markers) ---- */}
          {placedMilestones.map((g, i) => {
            const side = i % 2 === 0 ? 'left' : 'right';
            const isDragging = drag?.id === g.id;
            const dl = isDragging && drag?.previewDeadline ? drag.previewDeadline : g.deadline!;
            const y = yForDeadline(dl);
            const c = msColor(g);
            return (
              <div key={g.id}>
                <div
                  className="absolute h-px"
                  style={{
                    top: y,
                    width: GAP_M,
                    zIndex: 3,
                    background: c,
                    opacity: 0.5,
                    ...(side === 'left' ? { right: 'calc(50% + 2px)' } : { left: 'calc(50% + 2px)' }),
                  }}
                />
                <div
                  className="absolute left-1/2 w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2"
                  style={{ top: y, zIndex: 4, background: '#fff', boxShadow: `0 0 0 2.5px ${c}` }}
                />
                <div
                  onPointerDown={(e) => onItemPointerDown(e, g)}
                  className="absolute -translate-y-1/2 flex items-center gap-1.5 rounded-full bg-white border border-black/5 shadow-sm px-2.5 py-1 cursor-grab active:cursor-grabbing select-none"
                  style={{
                    top: y,
                    zIndex: isDragging ? 30 : 5,
                    touchAction: 'none',
                    opacity: g.done ? 0.55 : 1,
                    ...(side === 'left' ? { right: `calc(50% + ${GAP_M + 2}px)` } : { left: `calc(50% + ${GAP_M + 2}px)` }),
                  }}
                >
                  <Flag className="w-3 h-3 flex-none" style={{ color: c }} />
                  <span className={`text-[11px] leading-none ${g.done ? 'line-through ink-text-muted' : 'ink-text'}`}>
                    {g.title}
                  </span>
                  {g.done && <Check className="w-3 h-3" strokeWidth={3} style={{ color: c }} />}
                </div>
              </div>
            );
          })}

          {/* ---- goals (cards, no progress) ---- */}
          {placedGoals.map((g, i) => {
            const side = i % 2 === 0 ? 'left' : 'right';
            const isDragging = drag?.id === g.id;
            const dl = isDragging && drag?.previewDeadline ? drag.previewDeadline : g.deadline!;
            const y = yForDeadline(dl);
            const days = daysUntil(dl);
            const u = urgency(dl);
            const uColor = URGENCY_COLOR[u];
            const isNext = g.id === nextId;
            const dm = fmtDayMonth(dl);

            return (
              <div key={g.id}>
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
                <div
                  className="absolute left-1/2 w-3.5 h-3.5 rounded-full -translate-x-1/2 -translate-y-1/2 grid place-items-center"
                  style={{ top: y, zIndex: 4, background: '#fff', boxShadow: `0 0 0 3px ${g.color}, 0 0 12px 2px ${g.color}` }}
                >
                  {g.done && <Check className="w-2.5 h-2.5" strokeWidth={3} style={{ color: g.color }} />}
                  {isNext && !g.done && (
                    <span className="absolute inset-0 rounded-full animate-ping" style={{ boxShadow: `0 0 0 3px ${g.color}`, opacity: 0.6 }} />
                  )}
                </div>

                <div
                  onPointerDown={(e) => onItemPointerDown(e, g)}
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
                    opacity: g.done ? 0.85 : 1,
                  }}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: g.color }} />
                  <div className="pl-4 pr-3 pt-3 pb-3 flex flex-col gap-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className={`font-bold text-[15px] leading-snug ink-text ${g.done ? 'line-through' : ''}`}>
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

                    <div
                      className="flex items-center justify-between rounded-xl px-3 py-2"
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
                        {g.done ? (
                          <div className="font-extrabold text-[13px] flex items-center gap-1" style={{ color: g.color }}>
                            <Check className="w-3.5 h-3.5" strokeWidth={3} /> DONE
                          </div>
                        ) : days === 0 ? (
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
            <div
              className="relative w-[52px] h-[52px] rounded-full"
              style={{
                background: 'radial-gradient(circle at 35% 30%, #fff, #f59e0b 55%, #d97706)',
                boxShadow: '0 0 0 4px #f7f6f3, 0 0 0 5px #f59e0b, 0 0 26px 6px rgba(245,158,11,0.55)',
              }}
            >
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
          className="fixed z-[90] w-[210px] pointer-events-none paper-card rounded-2xl p-3 border border-dashed border-stone-400 shadow-2xl font-semibold text-sm ink-text"
          style={{ left: drag.x - 105, top: drag.y - 24 }}
        >
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 ink-text-muted" />
            {goals.find((g) => g.id === drag.id)?.title}
          </div>
        </div>
      )}

      {/* drawer + scrim */}
      {selectedGoal && (
        <>
          <div className="fixed inset-0 z-[65] bg-black/25" onClick={() => setSelectedId(null)} />
          <GoalDrawer
            goal={selectedGoal}
            attachOptions={attachOptions.filter((o) => o.id !== selectedGoal.id)}
            onChange={(patch, persist) => updateGoal(selectedGoal.id, patch, persist)}
            onDelete={() => deleteGoal(selectedGoal.id)}
            onClose={() => setSelectedId(null)}
            onComplete={triggerBurst}
          />
        </>
      )}

      {/* reflections panel */}
      {showReflections && (
        <ReflectionsPanel
          topics={topics}
          heading={reflHeading}
          onUpdateHeading={updateReflHeading}
          onAddTopic={addTopic}
          onUpdateTopic={updateTopic}
          onDeleteTopic={deleteTopic}
          onClose={() => setShowReflections(false)}
        />
      )}

      {/* versions modal */}
      {showVersions && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={() => setShowVersions(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative paper-card rounded-2xl border border-black/10 shadow-2xl w-[min(460px,94vw)] max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4 border-b border-black/5 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold ink-text flex items-center gap-2">
                  <History className="w-5 h-5" /> Versions
                </h3>
                <p className="text-xs ink-text-muted mt-1">
                  A daily backup of your goals & milestones. Restoring rolls everything back to that day.
                </p>
              </div>
              <button onClick={() => setShowVersions(false)} className="p-1.5 rounded-lg ink-text-muted hover:bg-stone-100 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-black/5">
              <button
                onClick={saveVersionNow}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-sm font-semibold transition"
              >
                <Save className="w-4 h-4" /> Save current as today's version
              </button>
            </div>

            <div className="px-5 py-3 overflow-y-auto flex flex-col gap-2">
              {versions.length === 0 && (
                <p className="text-sm ink-text-muted text-center py-6">No versions yet — one is saved automatically each day.</p>
              )}
              {versions.map((v) => {
                const count = Array.isArray(v.data) ? v.data.length : 0;
                const isToday = v.date === iso(today);
                return (
                  <div key={v.id} className="flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-white px-3.5 py-3">
                    <div>
                      <div className="font-semibold ink-text text-sm">
                        {fmtDate(v.date)} {isToday && <span className="ink-text-muted font-normal">· today</span>}
                      </div>
                      <div className="text-[11px] ink-text-muted font-mono">{count} item{count === 1 ? '' : 's'}</div>
                    </div>
                    {restoreDate === v.date ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setRestoreDate(null)}
                          disabled={versionsBusy}
                          className="px-3 py-1.5 rounded-lg border border-black/10 ink-text text-xs font-semibold hover:bg-stone-50 transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => doRestore(v.date)}
                          disabled={versionsBusy}
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition disabled:opacity-50"
                        >
                          {versionsBusy ? 'Restoring…' : 'Confirm restore'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRestoreDate(v.date)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/10 ink-text text-xs font-semibold hover:bg-stone-50 transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* move confirmation */}
      {pendingMove && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[95] paper-card rounded-2xl border border-black/10 shadow-2xl px-4 py-3 flex items-center gap-4 animate-toast-in">
          <div className="text-sm ink-text">
            Move <span className="font-bold">{goals.find((g) => g.id === pendingMove.id)?.title}</span> to{' '}
            <span className="font-bold font-mono">{fmtDate(pendingMove.to)}</span>?
            {pendingMove.from && (
              <span className="ink-text-muted"> (was {fmtDate(pendingMove.from)})</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={cancelMove}
              className="px-3 py-2 rounded-lg border border-black/10 ink-text text-sm font-semibold hover:bg-stone-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={confirmMove}
              className="px-3 py-2 rounded-lg bg-stone-800 hover:bg-stone-900 text-white text-sm font-semibold transition"
            >
              Confirm
            </button>
          </div>
        </div>
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

// ---------- helpers ----------
function normalize(rows: VisionGoal[]): VisionGoal[] {
  return rows.map((r) => ({ ...r, kind: r.kind ?? 'goal', done: r.done ?? false, goal_id: r.goal_id ?? null }));
}

function visionChanged(a: VisionGoal, b: VisionGoal): boolean {
  const f = (g: VisionGoal) => [g.kind, g.goal_id, g.title, g.target, g.note, g.color, g.deadline, g.done, g.sort_order];
  return JSON.stringify(f(a)) !== JSON.stringify(f(b));
}

function topicChanged(a: VisionTopic, b: VisionTopic): boolean {
  const f = (t: VisionTopic) => [t.title, t.color, t.emotions, t.sort_order];
  return JSON.stringify(f(a)) !== JSON.stringify(f(b));
}

function spawn(h: number, rand: boolean): Particle {
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

// ---------- demo (offline fallback / first-run seed) ----------
function demoGoals(): VisionGoal[] {
  const t = todayMidnight();
  const base = { user_id: 'single-user', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const mk = (
    i: number,
    kind: 'goal' | 'milestone',
    title: string,
    target: string,
    color: string,
    days: number | null,
    goal_id: string | null = null
  ): VisionGoal => ({
    id: 'demo-' + i,
    kind,
    goal_id,
    title,
    target,
    color,
    note: '',
    done: false,
    sort_order: i,
    deadline: days === null ? null : iso(addDays(t, days)),
    ...base,
  });
  return [
    mk(1, 'goal', 'Hit $10k / month', '$10,000/mo', '#d97706', 132),
    mk(2, 'goal', 'Ship the app v1.0', 'Public launch', '#06b6d4', 38),
    mk(3, 'goal', 'Bench press 100kg', '100 kg × 1', '#059669', 84),
    mk(4, 'goal', 'Memorize Surah Al-Kahf', '110 ayahs', '#7c3aed', 26),
    mk(5, 'milestone', 'Payments live', '', MILESTONE_NEUTRAL, 20, 'demo-2'),
    mk(6, 'milestone', 'First 100 users', '', MILESTONE_NEUTRAL, 55),
    mk(7, 'goal', 'Launch weekly newsletter', 'Issue #1', '#e11d48', null),
  ];
}

async function seedDemo(): Promise<VisionGoal[]> {
  // Insert goals first so milestones can reference them.
  const seeds = demoGoals();
  const idMap = new Map<string, string>();
  const out: VisionGoal[] = [];
  for (const g of seeds.filter((s) => !isMs(s))) {
    const row = await db.visionGoals.add({
      kind: 'goal',
      goal_id: null,
      title: g.title,
      target: g.target,
      note: g.note,
      color: g.color,
      deadline: g.deadline,
      done: false,
      sort_order: g.sort_order,
    });
    idMap.set(g.id, row.id);
    out.push(row);
  }
  for (const g of seeds.filter(isMs)) {
    const row = await db.visionGoals.add({
      kind: 'milestone',
      goal_id: g.goal_id ? idMap.get(g.goal_id) ?? null : null,
      title: g.title,
      target: '',
      note: '',
      color: g.color,
      deadline: g.deadline,
      done: false,
      sort_order: g.sort_order,
    });
    out.push(row);
  }
  return out;
}
