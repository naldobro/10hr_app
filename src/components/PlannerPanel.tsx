import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  ListTodo,
  Quote,
  Eraser,
  Type,
  Baseline,
  Highlighter,
  Table,
  Image as ImageIcon,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Lock,
  GripVertical,
  BookOpen,
  CalendarDays,
  RotateCcw,
  Link2,
  ClipboardPaste,
  History,
} from 'lucide-react';
import { VisionDoc, VisionDocSnapshot } from '../types';
import { GOAL_COLORS } from '../lib/visionUtils';
import { db } from '../lib/database';
import ColorPicker from './ColorPicker';

interface PlannerPanelProps {
  docs: VisionDoc[];
  /** Soft-deleted docs, available to restore or remove for good. */
  trashDocs: VisionDoc[];
  /** Per-notebook accent colour + sort order + pinned-section name, keyed by name. */
  notebookMeta: Record<string, { color?: string; order?: number; pinnedName?: string }>;
  onNotebookMetaChange: (next: Record<string, { color?: string; order?: number; pinnedName?: string }>) => void;
  /** Create a doc in the given notebook + month; resolves with the new id (or null on failure). */
  onAdd: (notebook: string, month: string) => Promise<string | null>;
  onUpdate: (id: string, patch: Partial<VisionDoc>, persist: boolean) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
  /** Upload a compressed image blob to storage; resolves with its public URL. */
  onUploadImage?: (blob: Blob, contentType: string) => Promise<string>;
  onClose: () => void;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (m: string) => {
  const [y, mm] = m.split('-').map(Number);
  return new Date(y, mm - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};
const byOrder = (a: VisionDoc, b: VisionDoc) => a.sort_order - b.sort_order;
// The built-in, month-based notebook. Any other notebook name is a freeform idea notebook.
const PLANNER = 'Planner';
const bookOf = (d: VisionDoc) => d.notebook || PLANNER;
// Planner pages with an empty month live in the fixed "pinned" section at the top,
// above every month. (Non-Planner notebooks also use '' but render as a flat list.)
const PINNED = '';
// Inline sub-pages created from *inside* another page carry this sentinel month so
// they stay out of every notebook listing (rail, gallery count, link picker) — they
// exist only through the chip that links to them. Still real docs, so still openable.
const INLINE = '__inline__';
const isInline = (d: VisionDoc) => d.month === INLINE;

// Quick presets ------------------------------------------------------------
// Block-level text styles. These change the WHOLE line/paragraph — real headings
// (bold by default, size driven by the .doc-body h1/h2/h3 CSS) or normal body
// text. Picking one here converts the block's type.
const BLOCK_STYLES: { label: string; hint: string; block: string; px: string; weight: number }[] = [
  { label: 'Title', hint: 'Biggest', block: '<h1>', px: '30px', weight: 800 },
  { label: 'Heading', hint: 'Large', block: '<h2>', px: '23px', weight: 700 },
  { label: 'Subheading', hint: 'Medium', block: '<h3>', px: '18px', weight: 700 },
  { label: 'Body', hint: 'Normal', block: '<p>', px: '15px', weight: 400 },
];
// Inline font sizes (px). Unlike the block styles above, these resize only the
// SELECTED text and never touch its block type — so you can make the text inside
// a code block (or a list, or anything) bigger/smaller without turning it into a
// heading. This is the "lots of sizes to choose between" control.
const TEXT_SIZES = [12, 13, 14, 16, 18, 20, 24, 28, 32, 40, 48];
// Accent colours offered for notebook cards in the gallery.
const NOTEBOOK_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#78716c',
];
const TEXT_COLORS = [
  // neutrals (incl. pure black + white for dark mode)
  '#000000', '#1c1917', '#44403c', '#57534e', '#78716c', '#a8a29e', '#d6d3d1', '#ffffff',
  // reds / pinks
  '#7f1d1d', '#b91c1c', '#dc2626', '#ef4444', '#e11d48', '#f43f5e', '#ec4899', '#f472b6',
  // purples / violets
  '#701a75', '#a21caf', '#c026d3', '#d946ef', '#7c3aed', '#8b5cf6', '#a855f7', '#c084fc',
  // blues / indigos
  '#312e81', '#4338ca', '#4f46e5', '#6366f1', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa',
  // cyans / teals
  '#075985', '#0369a1', '#0ea5e9', '#38bdf8', '#0f766e', '#0d9488', '#14b8a6', '#2dd4bf',
  // greens / limes
  '#166534', '#15803d', '#16a34a', '#22c55e', '#4d7c0f', '#65a30d', '#84cc16', '#a3e635',
  // yellows / ambers / oranges
  '#a16207', '#ca8a04', '#eab308', '#facc15', '#b45309', '#d97706', '#f59e0b', '#fbbf24',
  '#9a3412', '#c2410c', '#ea580c', '#f97316',
];
const HILITE_COLORS = [
  '#fef08a', '#fde68a', '#fed7aa', '#fecaca',
  '#fbcfe8', '#f5d0fe', '#e9d5ff', '#ddd6fe',
  '#c7d2fe', '#bfdbfe', '#bae6fd', '#a5f3fc',
  '#99f6e4', '#bbf7d0', '#d9f99d', '#e2e8f0',
];

// Images are embedded as data URLs inside the doc HTML so they persist through the
// normal save path — no separate storage bucket, no broken links, works offline.
// To keep that HTML from ballooning, we downscale + re-encode before embedding.
const IMG_MAX_DIM = 1600; // px, longest edge

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob((b) => resolve(b && b.type === type ? b : null), type, quality));

// Downscale + re-encode an image file into a compact blob for upload. Returns
// the original file untouched if the canvas step can't run (GIF, no 2d context).
async function compressImage(file: File): Promise<{ blob: Blob; type: string }> {
  const original = { blob: file as Blob, type: file.type };
  // GIFs would lose animation if re-drawn on a canvas, so keep them verbatim.
  if (file.type === 'image/gif') return original;

  const objUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objUrl);
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (w > IMG_MAX_DIM || h > IMG_MAX_DIM) {
      const scale = Math.min(IMG_MAX_DIM / w, IMG_MAX_DIM / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, w, h);
    // WebP is the smallest; if the platform can't encode it, fall back to JPEG.
    const blob =
      (await canvasToBlob(canvas, 'image/webp', 0.85)) ?? (await canvasToBlob(canvas, 'image/jpeg', 0.85));
    return blob ? { blob, type: blob.type } : original;
  } catch {
    return original;
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}

export default function PlannerPanel({
  docs,
  trashDocs,
  notebookMeta,
  onNotebookMetaChange,
  onAdd,
  onUpdate,
  onDelete,
  onRestore,
  onPurge,
  onUploadImage,
  onClose,
}: PlannerPanelProps) {
  const currentMonth = monthKey(new Date());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // A linked page opened in a floating window over the editor (one level deep).
  const [overlayDocId, setOverlayDocId] = useState<string | null>(null);
  // On phones the rail and editor can't sit side-by-side, so we show one at a time.
  const [mobilePane, setMobilePane] = useState<'rail' | 'editor'>('rail');
  const [showTrash, setShowTrash] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [notebook, setNotebook] = useState(PLANNER);
  // 'gallery' = the notebook picker shown on open; 'notebook' = rail + editor.
  const [view, setView] = useState<'gallery' | 'notebook'>('gallery');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmDelNb, setConfirmDelNb] = useState<string | null>(null);
  // Gallery: drag-to-reorder + per-notebook colour menu + inline rename.
  const [dragNb, setDragNb] = useState<string | null>(null);
  const [dragOverNb, setDragOverNb] = useState<string | null>(null);
  const [colorMenuNb, setColorMenuNb] = useState<string | null>(null);
  // Live (unsaved) colour while dragging the wheel, so the card previews instantly.
  const [colorPreview, setColorPreview] = useState<{ name: string; color: string } | null>(null);
  const [renamingNb, setRenamingNb] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  // Per-section collapse OVERRIDES (the user's explicit open/close choices),
  // keyed `${notebook}::${month}`. A section absent from this map uses the
  // DEFAULT, which keeps only the current month open (see isCollapsed) so the
  // rail looks clean on load. Persisted locally.
  const [collapseOverride, setCollapseOverride] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('planner_collapse_v2') || '{}');
    } catch {
      return {};
    }
  });
  // Inline rename of the pinned section header.
  const [renamingPinned, setRenamingPinned] = useState(false);
  const [pinnedDraft, setPinnedDraft] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Close the notebook colour menu on an outside click.
  useEffect(() => {
    if (!colorMenuNb) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-color-menu]')) {
        setColorMenuNb(null);
        setColorPreview(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [colorMenuNb]);

  const isMonthly = notebook === PLANNER;

  // Pages in the active notebook (a missing notebook value means the built-in Planner).
  // Inline sub-pages are excluded here so they never appear in the rail / month lists.
  const nbDocs = useMemo(() => docs.filter((d) => bookOf(d) === notebook && !isInline(d)), [docs, notebook]);

  // Notebooks the user has: the built-in Planner + any they've made. Ordered by the
  // saved manual order (falling back to Planner-first, then alphabetical).
  const notebooks = useMemo(() => {
    const set = new Set<string>();
    docs.forEach((d) => set.add(bookOf(d)));
    const base = [PLANNER, ...[...set].filter((n) => n !== PLANNER).sort((a, b) => a.localeCompare(b))];
    const baseIndex = new Map(base.map((n, i) => [n, i]));
    return base
      .slice()
      .sort((a, b) => (notebookMeta[a]?.order ?? baseIndex.get(a)!) - (notebookMeta[b]?.order ?? baseIndex.get(b)!));
  }, [docs, notebookMeta]);

  // Notebook cards for the gallery: page count + accent colour (saved colour, else
  // derived from the first coloured page).
  const notebookCards = useMemo(
    () =>
      notebooks.map((n) => {
        const pages = docs.filter((d) => bookOf(d) === n && !isInline(d));
        return {
          name: n,
          count: pages.length,
          color: notebookMeta[n]?.color || pages.find((p) => p.color)?.color || '#0ea5e9',
          isPlanner: n === PLANNER,
        };
      }),
    [notebooks, docs, notebookMeta]
  );

  // Persist a manual order across all notebooks after a drag reorder.
  const reorderNotebook = (targetName: string) => {
    const from = dragNb;
    setDragNb(null);
    setDragOverNb(null);
    if (!from || from === targetName) return;
    const list = notebooks.slice();
    const fi = list.indexOf(from);
    const ti = list.indexOf(targetName);
    if (fi < 0 || ti < 0) return;
    const [moved] = list.splice(fi, 1);
    list.splice(ti, 0, moved);
    const next = { ...notebookMeta };
    list.forEach((n, i) => {
      next[n] = { ...next[n], order: i };
    });
    onNotebookMetaChange(next);
  };

  // Persist a notebook colour. Keeps the menu open (the wheel commits repeatedly).
  const setNotebookColor = (name: string, color: string) => {
    onNotebookMetaChange({ ...notebookMeta, [name]: { ...notebookMeta[name], color } });
  };

  // Rename a user notebook: move every page onto the new name and carry its
  // colour/order metadata across. The built-in Planner can't be renamed.
  const commitRename = () => {
    const oldName = renamingNb;
    const newName = renameValue.trim();
    setRenamingNb(null);
    setRenameValue('');
    if (!oldName || oldName === PLANNER || !newName || newName === oldName) return;
    if (notebooks.some((n) => n !== oldName && n.toLowerCase() === newName.toLowerCase())) {
      return; // name already taken — keep the old one
    }
    docs.filter((d) => bookOf(d) === oldName).forEach((d) => onUpdate(d.id, { notebook: newName }, true));
    const next = { ...notebookMeta };
    if (next[oldName]) {
      next[newName] = next[oldName];
      delete next[oldName];
      onNotebookMetaChange(next);
    }
    if (notebook === oldName) setNotebook(newName);
  };

  // Planner is grouped by month; other notebooks are one flat, ordered list.
  // Empty-month pages are the pinned section, not a month, so they're excluded here.
  const months = useMemo(() => {
    const set = new Set<string>([currentMonth]);
    nbDocs.forEach((d) => {
      if (d.month) set.add(d.month);
    });
    return [...set].sort().reverse();
  }, [nbDocs, currentMonth]);

  // Pages in the Planner's fixed pinned section (empty month), ordered.
  const pinnedDocs = useMemo(() => nbDocs.filter((d) => d.month === PINNED).sort(byOrder), [nbDocs]);

  const docsByMonth = useMemo(() => {
    const m = new Map<string, VisionDoc[]>();
    nbDocs.forEach((d) => {
      const arr = m.get(d.month) ?? [];
      arr.push(d);
      m.set(d.month, arr);
    });
    m.forEach((arr) => arr.sort(byOrder));
    return m;
  }, [nbDocs]);

  const flatDocs = useMemo(() => nbDocs.slice().sort(byOrder), [nbDocs]);

  // Keep a valid selection inside the active notebook (create / delete / switch).
  useEffect(() => {
    if (selectedId && nbDocs.some((d) => d.id === selectedId)) return;
    const firstCurrent = nbDocs.find((d) => d.month === currentMonth);
    setSelectedId((firstCurrent ?? [...nbDocs].sort(byOrder)[0])?.id ?? null);
  }, [nbDocs, selectedId, currentMonth]);

  // If the active notebook loses all its pages, fall back to the Planner.
  useEffect(() => {
    if (notebook !== PLANNER && !notebooks.includes(notebook)) setNotebook(PLANNER);
  }, [notebooks, notebook]);

  // Open a notebook from the gallery into the rail + editor view.
  const openNotebook = (n: string) => {
    setNotebook(n);
    setView('notebook');
    setShowTrash(false);
    setMobilePane('rail');
  };

  // Open a page and, on mobile, slide over to the editor pane.
  const openDoc = (id: string) => {
    setSelectedId(id);
    setShowTrash(false);
    setMobilePane('editor');
  };

  const handleAdd = async (month: string) => {
    const id = await onAdd(notebook, isMonthly ? month : '');
    if (id) openDoc(id);
  };

  // Create a fresh *inline* page (hidden from the notebook listing) to link from
  // inside the page being edited. Doesn't switch the open doc — the chip points at it.
  const createInlinePage = async (): Promise<{ id: string; title: string } | null> => {
    const id = await onAdd(notebook, INLINE);
    return id ? { id, title: 'Untitled' } : null;
  };

  // Section collapse (per notebook + month), persisted locally.
  const sectionKey = (month: string) => `${notebook}::${month || '__pinned__'}`;
  // Default: only the current month is open; every other month AND the pinned /
  // Private section start collapsed for a clean rail. The override map holds any
  // section the user has since toggled.
  const isCollapsed = (month: string) => {
    const k = sectionKey(month);
    if (k in collapseOverride) return collapseOverride[k];
    return month !== currentMonth;
  };
  const toggleCollapse = (month: string) => {
    const next = { ...collapseOverride, [sectionKey(month)]: !isCollapsed(month) };
    setCollapseOverride(next);
    localStorage.setItem('planner_collapse_v2', JSON.stringify(next));
  };

  // The pinned section's name (renamable); defaults to "Private".
  const pinnedName = notebookMeta[notebook]?.pinnedName || 'Private';
  const commitPinnedName = () => {
    const name = pinnedDraft.trim();
    setRenamingPinned(false);
    if (name && name !== pinnedName) {
      onNotebookMetaChange({ ...notebookMeta, [notebook]: { ...notebookMeta[notebook], pinnedName: name } });
    }
  };

  const createNotebook = async () => {
    const name = newName.trim();
    if (!name) return;
    const existing = notebooks.find((n) => n.toLowerCase() === name.toLowerCase());
    if (existing) {
      openNotebook(existing);
    } else {
      const id = await onAdd(name, ''); // seed one page so the notebook exists
      if (!id) return; // failed (e.g. migration not applied yet)
      setSelectedId(id);
      openNotebook(name);
    }
    setNewName('');
    setCreating(false);
  };

  const deleteNotebook = (name: string) => {
    docs.filter((d) => bookOf(d) === name).forEach((d) => onDelete(d.id));
    setConfirmDelNb(null);
    if (notebook === name) setNotebook(PLANNER);
  };

  // Pages a page can be reordered against: same notebook (and, for Planner, same month).
  const siblingsOf = (d: VisionDoc) =>
    docs
      .filter((x) => bookOf(x) === bookOf(d) && (bookOf(d) !== PLANNER || x.month === d.month))
      .sort(byOrder);

  const persistOrder = (list: VisionDoc[]) =>
    list.forEach((d, i) => {
      if (d.sort_order !== i) onUpdate(d.id, { sort_order: i }, true);
    });

  // Drag-to-arrange, restricted to within one notebook (and month, for the Planner).
  const dragDoc = dragId ? docs.find((d) => d.id === dragId) ?? null : null;
  const handleDrop = (targetId: string) => {
    const from = dragDoc;
    const to = docs.find((d) => d.id === targetId);
    setDragId(null);
    setDragOverId(null);
    if (!from || !to || from.id === to.id) return;
    if (bookOf(from) !== bookOf(to)) return;
    if (bookOf(from) === PLANNER && from.month !== to.month) return;
    const list = siblingsOf(from);
    const fromIdx = list.findIndex((d) => d.id === from.id);
    const toIdx = list.findIndex((d) => d.id === to.id);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    persistOrder(list);
  };

  // Nudge a page up/down within its group (works on touch, unlike drag).
  const moveDoc = (id: string, dir: -1 | 1) => {
    const d = docs.find((x) => x.id === id);
    if (!d) return;
    const list = siblingsOf(d);
    const idx = list.findIndex((x) => x.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= list.length) return;
    [list[idx], list[swap]] = [list[swap], list[idx]];
    persistOrder(list);
  };

  const doc = docs.find((d) => d.id === selectedId) || null;

  // One page row in the rail — shared by the month view and the flat notebook view.
  const renderRow = (d: VisionDoc, list: VisionDoc[], i: number, dragActiveHere: boolean) => {
    const isOver = dragOverId === d.id && dragId !== d.id && dragActiveHere;
    return (
      <div
        key={d.id}
        draggable
        onDragStart={() => setDragId(d.id)}
        onDragEnd={() => {
          setDragId(null);
          setDragOverId(null);
        }}
        onDragOver={(e) => {
          if (!dragActiveHere) return; // block cross-group drops
          e.preventDefault();
          setDragOverId(d.id);
        }}
        onDrop={(e) => {
          e.preventDefault();
          handleDrop(d.id);
        }}
        className={`group flex items-center gap-0.5 rounded-lg transition ${
          d.id === selectedId ? 'bg-white dark:bg-paper shadow-sm' : 'hover:bg-white/60 dark:hover:bg-paper/60'
        } ${d.id === dragId ? 'opacity-40' : ''} ${isOver ? 'ring-2 ring-amber-400' : ''}`}
      >
        <GripVertical className="w-3.5 h-3.5 flex-none ml-1.5 ink-text-muted/40 group-hover:ink-text-muted cursor-grab active:cursor-grabbing" />
        <button
          onClick={() => openDoc(d.id)}
          className={`flex-1 min-w-0 flex items-center gap-2 pl-1 pr-1 py-1.5 text-left ${
            d.id === selectedId ? 'ink-text' : 'ink-text-muted group-hover:ink-text'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: d.color || '#0ea5e9' }} />
          <span className="text-[13px] truncate">{d.title || 'Untitled'}</span>
        </button>
        <div className="flex-none flex flex-col opacity-100 md:opacity-0 md:group-hover:opacity-100 transition pr-1">
          <button
            onClick={() => moveDoc(d.id, -1)}
            disabled={i === 0}
            className="p-0.5 rounded ink-text-muted hover:ink-text disabled:opacity-20 disabled:cursor-default"
            title="Move up"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => moveDoc(d.id, 1)}
            disabled={i === list.length - 1}
            className="p-0.5 rounded ink-text-muted hover:ink-text disabled:opacity-20 disabled:cursor-default"
            title="Move down"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
    <div className="fixed inset-0 z-[80]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <style>{`
        /* Paint/layout containment + own compositor layer so each keystroke
           repaints only the text, never forcing the parent paper-card's big
           (mode-active) glow shadows to re-rasterize — that was the typing jank. */
        .doc-body { line-height: 1.65; contain: content; transform: translateZ(0); }
        .doc-body:focus { outline: none; }
        .doc-body h1 { font-size: 2rem; font-weight: 800; letter-spacing: -.01em; margin: .6em 0 .3em; line-height: 1.2; }
        .doc-body h2 { font-size: 1.5rem; font-weight: 700; margin: .6em 0 .25em; line-height: 1.25; }
        .doc-body h3 { font-size: 1.2rem; font-weight: 700; margin: .5em 0 .2em; line-height: 1.3; }
        .doc-body p { margin: .35em 0; }
        .doc-body ul { list-style: disc; padding-left: 1.4rem; margin: .35em 0; }
        .doc-body ol { list-style: decimal; padding-left: 1.4rem; margin: .35em 0; }
        .doc-body li { margin: .15em 0; }
        .doc-body blockquote { border-left: 3px solid #d6d3d1; padding-left: .8rem; margin: .5em 0; color: #78716c; font-style: italic; }
        /* monospace / preformatted text (e.g. pasted code) — styled so it still
           reads well if it ever lands in a note. */
        .doc-body pre {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: .92em; line-height: 1.5; tab-size: 2;
          background: #f5f5f4; border: 1px solid #e7e5e4; border-radius: .5rem;
          padding: .7em .9em; margin: .5em 0; white-space: pre-wrap; overflow-x: auto;
        }
        .dark .doc-body pre { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.14); }
        .doc-body code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .92em; background: #f5f5f4; padding: .1em .35em; border-radius: .35em; }
        .dark .doc-body code { background: rgba(255,255,255,.08); }
        .doc-body pre code { background: none; padding: 0; }
        .doc-body a { color: #2563eb; text-decoration: underline; }
        .doc-body hr { border: none; border-top: 1px solid #d6d3d1; margin: .9em 0; }
        .doc-body img { max-width: 100%; height: auto; border-radius: .5rem; margin: .5em 0; display: block; }
        .doc-body[data-empty="true"]::before { content: attr(data-placeholder); color: #a8a29e; }
        /* tables */
        .doc-body table.doc-table { border-collapse: collapse; width: 100%; margin: .6em 0; }
        .doc-body table.doc-table td, .doc-body table.doc-table th { border: 1px solid #d6d3d1; padding: .4em .55em; min-width: 3em; vertical-align: top; }
        .doc-body table.doc-table th { background: #f5f5f4; font-weight: 700; text-align: left; }
        /* checklists / tick boxes */
        .doc-body ul.doc-tasks { list-style: none; padding-left: 0; margin: .4em 0; }
        .doc-body ul.doc-tasks li.doc-task { position: relative; padding-left: 1.8em; margin: .22em 0; }
        .doc-body ul.doc-tasks li.doc-task::before { content: ''; position: absolute; left: 0; top: .18em; width: 1.05em; height: 1.05em; border: 2px solid #a8a29e; border-radius: .3em; background: #fff; cursor: pointer; box-sizing: border-box; }
        .doc-body ul.doc-tasks li.doc-task[data-checked="true"]::before { background: #059669; border-color: #059669; }
        .doc-body ul.doc-tasks li.doc-task[data-checked="true"]::after { content: ''; position: absolute; left: .35em; top: .28em; width: .28em; height: .55em; border: solid #fff; border-width: 0 .16em .16em 0; transform: rotate(45deg); pointer-events: none; }
        .doc-body ul.doc-tasks li.doc-task[data-checked="true"] { color: #a8a29e; text-decoration: line-through; }
        /* toggle / collapsible block — native <details>, so open/close is reliable
           and the body is never lost (it stays in the DOM + saved HTML when closed) */
        .doc-body details.doc-toggle { margin: .5em 0; border-left: 2px solid rgba(120,120,120,.22); padding-left: .2em; }
        .doc-body details.doc-toggle > summary.doc-toggle-head {
          list-style: none; position: relative; padding-left: 2em; font-weight: 600; cursor: text; outline: none;
        }
        .doc-body details.doc-toggle > summary.doc-toggle-head::-webkit-details-marker { display: none; }
        .doc-body details.doc-toggle > summary.doc-toggle-head::marker { content: ''; }
        .doc-body details.doc-toggle > summary.doc-toggle-head::before {
          content: '▶'; position: absolute; left: 0; top: 0; width: 1.4em; text-align: center;
          font-size: 1.45em; line-height: .95; color: #b0aca6;
          cursor: pointer; user-select: none; transition: transform .15s ease; transform-origin: 50% 55%;
        }
        .doc-body details.doc-toggle > summary.doc-toggle-head:hover::before { color: #d6d3d1; }
        .doc-body details.doc-toggle[open] > summary.doc-toggle-head::before { transform: rotate(90deg); }
        .doc-body details.doc-toggle > summary.doc-toggle-head:empty::after { content: 'Toggle'; color: #a8a29e; font-weight: 600; }
        .doc-body details.doc-toggle > .doc-toggle-body { padding-left: 2em; margin-top: .2em; }
        /* linked-page reference chips (collapsed; click opens the page in a window) */
        .doc-body a.doc-ref {
          display: inline-flex; align-items: center; gap: .3em;
          padding: .05em .5em; margin: 0 .1em; border-radius: .5em;
          background: #eef2ff; border: 1px solid #c7d2fe; color: #4338ca;
          font-size: .92em; font-weight: 600; text-decoration: none;
          cursor: pointer; vertical-align: baseline; white-space: nowrap;
          max-width: 100%; overflow: hidden; text-overflow: ellipsis;
        }
        .doc-body a.doc-ref:hover { background: #e0e7ff; border-color: #a5b4fc; }
        .doc-body a.doc-ref[data-missing="true"] {
          background: #fef2f2; border-color: #fecaca; color: #b91c1c; cursor: default;
        }
        .dark .doc-body a.doc-ref { background: rgba(99,102,241,.18); border-color: rgba(129,140,248,.4); color: #c7d2fe; }
        .dark .doc-body a.doc-ref:hover { background: rgba(99,102,241,.3); }
        .dark .doc-body a.doc-ref[data-missing="true"] { background: rgba(239,68,68,.14); border-color: rgba(248,113,113,.4); color: #fca5a5; }
      `}</style>
      <div className="absolute inset-x-0 bottom-0 top-[calc(100px+env(safe-area-inset-top))] md:top-[calc(90px+env(safe-area-inset-top))] flex items-center justify-center p-2 sm:p-4">
      <div
        className="relative paper-card rounded-2xl border border-black/10 dark:border-white/[0.2] shadow-2xl w-[min(1100px,96vw)] h-[820px] max-h-full flex overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
      {view === 'gallery' ? (
        /* ---------- notebook gallery (shown on open) ---------- */
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-between px-6 sm:px-8 pt-6 pb-4 border-b border-black/5 dark:border-white/[0.13]">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="grid place-items-center w-10 h-10 rounded-xl flex-none"
                style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }}
              >
                <NotebookPen className="w-5 h-5 text-white" />
              </span>
              <div className="min-w-0">
                <h2 className="text-xl font-bold ink-text leading-tight">Planner</h2>
                <p className="text-[12px] ink-text-muted">Pick a notebook to open</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg ink-text-muted hover:bg-stone-100 transition flex-none"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-8 py-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {notebookCards.map((nb) => {
                const cardColor = colorPreview?.name === nb.name ? colorPreview.color : nb.color;
                return (
                <div
                  key={nb.name}
                  draggable={renamingNb !== nb.name}
                  onDragStart={() => setDragNb(nb.name)}
                  onDragEnd={() => {
                    setDragNb(null);
                    setDragOverNb(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (nb.name !== dragOverNb) setDragOverNb(nb.name);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    reorderNotebook(nb.name);
                  }}
                  className={`group relative rounded-2xl transition ${
                    dragNb === nb.name ? 'opacity-40' : ''
                  } ${dragOverNb === nb.name && dragNb && dragNb !== nb.name ? 'ring-2 ring-amber-400' : ''}`}
                >
                  {renamingNb === nb.name ? (
                    <div className="paper-card rounded-2xl border border-black/10 dark:border-white/[0.15] p-4 overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: cardColor }} />
                      <span
                        className="grid place-items-center w-9 h-9 rounded-xl mb-3"
                        style={{ background: `${cardColor}1e`, color: cardColor }}
                      >
                        {nb.isPlanner ? <CalendarDays className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                      </span>
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') {
                            setRenamingNb(null);
                            setRenameValue('');
                          }
                        }}
                        onBlur={commitRename}
                        placeholder="Notebook name…"
                        className="w-full font-bold text-[15px] ink-text bg-white dark:bg-paper rounded-lg border border-black/10 dark:border-white/[0.2] px-2 py-1 outline-none focus:border-amber-400"
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => openNotebook(nb.name)}
                      className="w-full text-left paper-card rounded-2xl border border-black/10 dark:border-white/[0.15] p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden cursor-grab active:cursor-grabbing"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: cardColor }} />
                      <span
                        className="grid place-items-center w-9 h-9 rounded-xl mb-3"
                        style={{ background: `${cardColor}1e`, color: cardColor }}
                      >
                        {nb.isPlanner ? <CalendarDays className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                      </span>
                      <div className="font-bold text-[15px] ink-text leading-tight truncate pr-8">{nb.name}</div>
                      <div className="text-[12px] ink-text-muted mt-1">
                        {nb.isPlanner ? 'Month-by-month' : 'Ideas & notes'} · {nb.count} page{nb.count === 1 ? '' : 's'}
                      </div>
                    </button>
                  )}

                  {/* top-right controls: colour + rename/delete (non-Planner) */}
                  <div className={`absolute top-2 right-2 flex items-center gap-0.5 ${renamingNb === nb.name ? 'hidden' : ''}`}>
                    <div className="relative">
                      <button
                        onClick={() => setColorMenuNb(colorMenuNb === nb.name ? null : nb.name)}
                        title="Set colour"
                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded-lg ink-text-muted hover:bg-stone-100 dark:hover:bg-white/10 transition"
                      >
                        <span className="block w-3.5 h-3.5 rounded-full border border-black/20" style={{ background: cardColor }} />
                      </button>
                      {/* Phones: a centred floating panel so it's never clipped by the
                          card or the gallery's scroll box. sm+: a normal dropdown. */}
                      {colorMenuNb === nb.name && (
                        <div
                          data-color-menu
                          className="fixed sm:absolute left-1/2 sm:left-auto right-auto sm:right-0 top-1/2 sm:top-full -translate-x-1/2 sm:translate-x-0 -translate-y-1/2 sm:translate-y-0 sm:mt-1 z-40 w-[min(228px,calc(100vw-1.5rem))] max-w-[228px] paper-card rounded-xl border border-black/10 dark:border-white/[0.2] shadow-xl p-2.5"
                        >
                          <div className="grid grid-cols-6 gap-1.5">
                            {NOTEBOOK_COLORS.map((c) => (
                              <button
                                key={c}
                                onClick={() => {
                                  setNotebookColor(nb.name, c);
                                  setColorPreview(null);
                                }}
                                className="w-6 h-6 rounded-md border border-black/10 dark:border-white/[0.2] transition-transform hover:scale-110"
                                style={{
                                  background: c,
                                  boxShadow: c === cardColor ? `0 0 0 2px #fff, 0 0 0 3.5px ${c}` : undefined,
                                }}
                                title={c}
                              />
                            ))}
                          </div>
                          <div className="border-t border-black/5 dark:border-white/[0.13] my-2.5" />
                          <ColorPicker
                            value={cardColor}
                            onChange={(hex) => setColorPreview({ name: nb.name, color: hex })}
                            onCommit={(hex) => {
                              setNotebookColor(nb.name, hex);
                              setColorPreview(null);
                            }}
                          />
                        </div>
                      )}
                    </div>
                    {!nb.isPlanner && confirmDelNb !== nb.name && (
                      <button
                        onClick={() => {
                          setRenamingNb(nb.name);
                          setRenameValue(nb.name);
                          setColorMenuNb(null);
                        }}
                        title="Rename notebook"
                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded-lg ink-text-muted hover:ink-text hover:bg-stone-100 dark:hover:bg-white/10 transition"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {!nb.isPlanner &&
                      (confirmDelNb === nb.name ? (
                        <div className="flex items-center gap-1 paper-card rounded-lg border border-black/10 dark:border-white/[0.2] shadow px-1 py-0.5">
                          <button
                            onClick={() => deleteNotebook(nb.name)}
                            className="text-[11px] font-bold text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-400/10"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmDelNb(null)}
                            className="text-[11px] ink-text-muted px-1 py-0.5 rounded hover:bg-stone-100"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelNb(nb.name)}
                          title="Delete notebook"
                          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded-lg ink-text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-400/10 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ))}
                  </div>
                </div>
                );
              })}

              {/* new notebook card */}
              {creating ? (
                <div className="paper-card rounded-2xl border-2 border-dashed border-amber-400/60 p-4 flex flex-col justify-center gap-2">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') createNotebook();
                      if (e.key === 'Escape') {
                        setCreating(false);
                        setNewName('');
                      }
                    }}
                    placeholder="Notebook name…"
                    className="w-full text-[13px] px-2.5 py-2 rounded-lg border border-black/10 dark:border-white/[0.2] bg-white dark:bg-paper outline-none focus:border-amber-400"
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={createNotebook}
                      className="flex-1 text-[12px] font-semibold text-white bg-stone-800 hover:bg-stone-900 px-2.5 py-1.5 rounded-lg"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => {
                        setCreating(false);
                        setNewName('');
                      }}
                      className="text-[12px] ink-text-muted px-2 py-1.5 rounded-lg hover:bg-stone-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="rounded-2xl border-2 border-dashed border-black/15 dark:border-white/15 p-4 flex flex-col items-center justify-center gap-2 min-h-[116px] ink-text-muted hover:ink-text hover:border-amber-400/60 hover:bg-amber-50/40 dark:hover:bg-amber-400/10 transition"
                >
                  <Plus className="w-6 h-6" />
                  <span className="text-[13px] font-semibold">New notebook</span>
                </button>
              )}
            </div>
          </div>

          {/* trash entry */}
          <button
            onClick={() => {
              setView('notebook');
              setNotebook(PLANNER);
              setShowTrash(true);
              setMobilePane('editor');
            }}
            className="flex items-center justify-between gap-2 px-6 sm:px-8 py-3 border-t border-black/5 dark:border-white/[0.13] text-[13px] ink-text-muted hover:ink-text hover:bg-white/50 dark:hover:bg-paper/50 transition"
          >
            <span className="flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Trash
            </span>
            {trashDocs.length > 0 && (
              <span className="text-[11px] font-bold bg-stone-200 ink-text rounded-full px-1.5 py-0.5 leading-none">
                {trashDocs.length}
              </span>
            )}
          </button>
        </div>
      ) : (
       <>
        {/* ---------- notebook rail ---------- */}
        <aside
          className={`w-full md:w-[248px] flex-none flex-col border-r border-black/5 dark:border-white/[0.13] bg-amber-50/40 dark:bg-amber-400/10 ${
            mobilePane === 'editor' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* notebook header — back to the gallery */}
          <div className="border-b border-black/5 dark:border-white/[0.13]">
            <button
              onClick={() => setView('gallery')}
              className="w-full flex items-center gap-1.5 px-3 pt-3 pb-1.5 text-left ink-text-muted hover:ink-text transition text-[12px] font-semibold"
              title="All notebooks"
            >
              <ChevronLeft className="w-4 h-4 flex-none" /> Notebooks
            </button>
            <div className="flex items-center gap-2 px-4 pb-3">
              {isMonthly ? (
                <CalendarDays className="w-5 h-5 ink-text flex-none" />
              ) : (
                <BookOpen className="w-5 h-5 ink-text flex-none" />
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-bold ink-text leading-none truncate">{notebook}</h3>
                <p className="text-[11px] ink-text-muted mt-1 leading-none truncate">
                  {isMonthly ? 'Month-by-month notes & plans' : 'Ideas & notes'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {isMonthly ? (
              <>
                {/* fixed pinned section — always on top, above every month */}
                {(() => {
                  const open = !isCollapsed(PINNED);
                  const dragActiveHere = !!dragDoc && bookOf(dragDoc) === PLANNER && dragDoc.month === PINNED;
                  return (
                    <div className="px-2 mb-1">
                      <div className="group flex items-center gap-1 px-2 py-1.5">
                        <button
                          onClick={() => toggleCollapse(PINNED)}
                          className="p-0.5 rounded ink-text-muted hover:ink-text flex-none"
                          title={open ? 'Collapse' : 'Expand'}
                        >
                          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                        <Lock className="w-3 h-3 ink-text-muted flex-none" />
                        {renamingPinned ? (
                          <input
                            autoFocus
                            value={pinnedDraft}
                            onChange={(e) => setPinnedDraft(e.target.value)}
                            onBlur={commitPinnedName}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitPinnedName();
                              if (e.key === 'Escape') setRenamingPinned(false);
                            }}
                            className="flex-1 min-w-0 text-[11px] tracking-wider uppercase font-bold ink-text bg-white dark:bg-paper rounded border border-black/10 dark:border-white/[0.2] px-1.5 py-0.5 outline-none focus:border-amber-400"
                          />
                        ) : (
                          <button
                            onClick={() => toggleCollapse(PINNED)}
                            onDoubleClick={() => {
                              setPinnedDraft(pinnedName);
                              setRenamingPinned(true);
                            }}
                            className="flex-1 min-w-0 text-left text-[11px] tracking-wider uppercase font-bold ink-text-muted truncate"
                            title="Double-click to rename"
                          >
                            {pinnedName}
                          </button>
                        )}
                        {!renamingPinned && (
                          <button
                            onClick={() => {
                              setPinnedDraft(pinnedName);
                              setRenamingPinned(true);
                            }}
                            className="p-1 rounded-md ink-text-muted hover:ink-text opacity-100 md:opacity-0 md:group-hover:opacity-100 transition flex-none"
                            title="Rename section"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => handleAdd(PINNED)}
                          className="p-1 rounded-md ink-text-muted hover:ink-text hover:bg-white/70 dark:hover:bg-paper/70 transition flex-none"
                          title={`New page in ${pinnedName}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {open &&
                        (pinnedDocs.length === 0 ? (
                          <button
                            onClick={() => handleAdd(PINNED)}
                            className="w-full text-left text-[12px] ink-text-muted/70 hover:ink-text px-2.5 py-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-paper/60 transition"
                          >
                            + Add a page
                          </button>
                        ) : (
                          pinnedDocs.map((d, i) => renderRow(d, pinnedDocs, i, dragActiveHere))
                        ))}
                    </div>
                  );
                })()}

                {months.map((m) => {
                  const list = docsByMonth.get(m) ?? [];
                  const open = !isCollapsed(m);
                  const dragActiveHere = !!dragDoc && bookOf(dragDoc) === PLANNER && dragDoc.month === m;
                  return (
                    <div key={m} className="px-2 mb-1">
                      <div className="group flex items-center gap-1 px-2 py-1.5">
                        <button
                          onClick={() => toggleCollapse(m)}
                          className="p-0.5 rounded ink-text-muted hover:ink-text flex-none"
                          title={open ? 'Collapse' : 'Expand'}
                        >
                          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => toggleCollapse(m)}
                          className="flex-1 min-w-0 flex items-baseline gap-1.5 text-left"
                        >
                          <span className="text-[11px] tracking-wider uppercase font-bold ink-text-muted truncate">
                            {monthLabel(m)}
                          </span>
                          {m === currentMonth && (
                            <span className="text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-400/20 rounded-full px-1.5 py-0.5 leading-none flex-none">
                              NOW
                            </span>
                          )}
                          {!open && list.length > 0 && (
                            <span className="text-[10px] ink-text-muted/70 font-semibold flex-none">{list.length}</span>
                          )}
                        </button>
                        <button
                          onClick={() => handleAdd(m)}
                          className="p-1 rounded-md ink-text-muted hover:ink-text hover:bg-white/70 dark:hover:bg-paper/70 transition flex-none"
                          title={`New doc in ${monthLabel(m)}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {open &&
                        (list.length === 0 ? (
                          <button
                            onClick={() => handleAdd(m)}
                            className="w-full text-left text-[12px] ink-text-muted/70 hover:ink-text px-2.5 py-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-paper/60 transition"
                          >
                            + Add the first doc
                          </button>
                        ) : (
                          list.map((d, i) => renderRow(d, list, i, dragActiveHere))
                        ))}
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="px-2">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-[11px] tracking-wider uppercase font-bold ink-text-muted truncate">
                    Pages
                  </span>
                  <button
                    onClick={() => handleAdd('')}
                    className="p-1 rounded-md ink-text-muted hover:ink-text hover:bg-white/70 dark:hover:bg-paper/70 transition flex-none"
                    title="New page"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                {flatDocs.length === 0 ? (
                  <button
                    onClick={() => handleAdd('')}
                    className="w-full text-left text-[12px] ink-text-muted/70 hover:ink-text px-2.5 py-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-paper/60 transition"
                  >
                    + Add the first page
                  </button>
                ) : (
                  flatDocs.map((d, i) => renderRow(d, flatDocs, i, !!dragDoc && bookOf(dragDoc) === notebook))
                )}
              </div>
            )}
          </div>

          {/* trash entry */}
          <button
            onClick={() => {
              setShowTrash(true);
              setMobilePane('editor');
            }}
            className={`flex items-center justify-between gap-2 px-4 py-2.5 border-t border-black/5 dark:border-white/[0.13] text-[13px] transition ${
              showTrash ? 'bg-white dark:bg-paper ink-text' : 'ink-text-muted hover:ink-text hover:bg-white/50 dark:hover:bg-paper/50'
            }`}
          >
            <span className="flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Trash
            </span>
            {trashDocs.length > 0 && (
              <span className="text-[11px] font-bold bg-stone-200 ink-text rounded-full px-1.5 py-0.5 leading-none">
                {trashDocs.length}
              </span>
            )}
          </button>
        </aside>

        {/* ---------- editor ---------- */}
        <div
          className={`flex-1 min-w-0 flex-col ${mobilePane === 'rail' ? 'hidden md:flex' : 'flex'}`}
        >
          <div className="flex justify-between items-center px-3 pt-3">
            {showTrash ? (
              <button
                onClick={() => {
                  setShowTrash(false);
                  setMobilePane('rail');
                }}
                className="text-[13px] font-semibold ink-text-muted hover:ink-text px-2 py-1 rounded-lg hover:bg-stone-100 transition"
              >
                ← Back
              </button>
            ) : (
              <button
                onClick={() => setMobilePane('rail')}
                className="md:hidden flex items-center gap-1 text-[13px] font-semibold ink-text-muted hover:ink-text px-2 py-1 rounded-lg hover:bg-stone-100 transition"
              >
                ← Pages
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg ink-text-muted hover:bg-stone-100 transition" title="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
          {showTrash ? (
            <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-10 py-4">
              <div className="flex items-center gap-2 mb-2">
                <Trash2 className="w-5 h-5 ink-text-muted" />
                <h2 className="text-xl font-bold ink-text">Trash</h2>
              </div>
              <p className="text-[13px] ink-text-muted mb-5">
                Deleted pages wait here — restore anything you removed by accident. Only “Delete forever” erases a page.
              </p>
              {trashDocs.length === 0 ? (
                <div className="text-sm ink-text-muted/70 py-12 text-center">Trash is empty.</div>
              ) : (
                <div className="space-y-2">
                  {trashDocs.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-3 rounded-xl border border-black/5 dark:border-white/[0.13] bg-white/60 dark:bg-paper/60 px-3.5 py-2.5"
                    >
                      <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: d.color || '#0ea5e9' }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] ink-text truncate">{d.title || 'Untitled'}</div>
                        <div className="text-[11px] ink-text-muted truncate">
                          {bookOf(d)}
                          {d.deleted_at ? ` · deleted ${new Date(d.deleted_at).toLocaleDateString()}` : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => onRestore(d.id)}
                        className="flex-none flex items-center gap-1 text-[12px] font-semibold ink-text-muted hover:ink-text px-2 py-1 rounded-lg hover:bg-stone-100 transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore
                      </button>
                      {confirmPurge === d.id ? (
                        <div className="flex-none flex items-center gap-1">
                          <button
                            onClick={() => {
                              onPurge(d.id);
                              setConfirmPurge(null);
                            }}
                            className="text-[12px] font-bold text-red-600 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-400/10 transition"
                          >
                            Delete forever
                          </button>
                          <button
                            onClick={() => setConfirmPurge(null)}
                            className="text-[12px] ink-text-muted px-1.5 py-1 rounded hover:bg-stone-100 transition"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmPurge(d.id)}
                          title="Delete forever"
                          className="flex-none p-1.5 rounded-lg ink-text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-400/10 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : doc ? (
            <DocEditor
              key={doc.id}
              doc={doc}
              onChange={(patch, persist) => onUpdate(doc.id, patch, persist)}
              onDelete={() => onDelete(doc.id)}
              onUploadImage={onUploadImage}
              allDocs={docs}
              onOpenDoc={setOverlayDocId}
              onCreateInlinePage={createInlinePage}
            />
          ) : (
            <div className="flex-1 grid place-items-center px-6 -mt-8">
              <div className="text-center max-w-xs">
                <FileText className="w-10 h-10 ink-text-muted/40 mx-auto mb-3" />
                <p className="text-sm ink-text-muted mb-4">
                  {isMonthly
                    ? `No document open. Start planning ${monthLabel(currentMonth)}.`
                    : `“${notebook}” is empty. Add your first page.`}
                </p>
                <button
                  onClick={() => handleAdd(currentMonth)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-sm font-semibold transition"
                >
                  <Plus className="w-4 h-4" /> {isMonthly ? 'New doc' : 'New page'}
                </button>
              </div>
            </div>
          )}
        </div>
       </>
      )}
      </div>
      </div>
    </div>
    <LinkedDocWindow
      docId={overlayDocId}
      docs={docs}
      onClose={() => setOverlayDocId(null)}
      onChange={onUpdate}
      onUploadImage={onUploadImage}
    />
    </>
  );
}

// A single linked page shown in a floating window over the editor. It's one level
// deep (no "link a page" control inside), reuses the same save path, and closes
// itself if its page disappears (deleted elsewhere).
function LinkedDocWindow({
  docId,
  docs,
  onClose,
  onChange,
  onUploadImage,
}: {
  docId: string | null;
  docs: VisionDoc[];
  onClose: () => void;
  onChange: (id: string, patch: Partial<VisionDoc>, persist: boolean) => void;
  onUploadImage?: (blob: Blob, contentType: string) => Promise<string>;
}) {
  const doc = docId ? docs.find((d) => d.id === docId) || null : null;
  // Close on Escape, and if the target page vanished.
  useEffect(() => {
    if (!docId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [docId, onClose]);
  useEffect(() => {
    if (docId && !doc) onClose();
  }, [docId, doc, onClose]);

  if (!docId || !doc) return null;
  return createPortal(
    <div className="fixed inset-0 z-[95]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-6">
        <div
          className="relative paper-card rounded-2xl border border-black/10 dark:border-white/[0.2] shadow-2xl w-[min(900px,96vw)] h-[min(760px,92vh)] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 px-4 sm:px-6 pt-3 pb-2 border-b border-black/5 dark:border-white/[0.13]">
            <Link2 className="w-4 h-4 ink-text-muted flex-none" />
            <span className="text-[12px] font-semibold ink-text-muted truncate flex-1">Linked page</span>
            <button
              onClick={onClose}
              title="Close (Esc)"
              className="p-1.5 rounded-lg ink-text-muted hover:ink-text hover:bg-stone-100 dark:hover:bg-white/10 transition flex-none"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <DocEditor
            key={doc.id}
            doc={doc}
            nested
            allDocs={docs}
            onChange={(patch, persist) => onChange(doc.id, patch, persist)}
            onDelete={() => {}}
            onUploadImage={onUploadImage}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

function DocEditor({
  doc,
  onChange,
  onDelete,
  onUploadImage,
  allDocs = [],
  onOpenDoc,
  onCreateInlinePage,
  nested = false,
}: {
  doc: VisionDoc;
  onChange: (patch: Partial<VisionDoc>, persist: boolean) => void;
  onDelete: () => void;
  onUploadImage?: (blob: Blob, contentType: string) => Promise<string>;
  /** All active pages, used to resolve link-chip titles and populate the picker. */
  allDocs?: VisionDoc[];
  /** Open a linked page in a window. Absent ⇒ this editor can't open links (depth cap). */
  onOpenDoc?: (id: string) => void;
  /** Create a fresh inline (hidden) sub-page and return it. Absent ⇒ no "new page". */
  onCreateInlinePage?: () => Promise<{ id: string; title: string } | null>;
  /** True when shown inside a linked-page window — hides destructive + nesting controls. */
  nested?: boolean;
}) {
  const summaryRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // The image currently clicked for resizing, plus its on-screen box (viewport
  // coords) used to place the outline + drag handle.
  const selImgRef = useRef<HTMLImageElement | null>(null);
  const [imgBox, setImgBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [title, setTitle] = useState(doc.title);
  const [color, setColor] = useState(doc.color || '#0ea5e9');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [confirmDel, setConfirmDel] = useState(false);
  const [menu, setMenu] = useState<null | 'size' | 'color' | 'hilite' | 'table' | 'link'>(null);
  const [inTable, setInTable] = useState(false);
  const meta = useRef({ title: doc.title, color: doc.color || '#0ea5e9' });
  const saveTimer = useRef<number | undefined>(undefined);
  const savedTimer = useRef<number | undefined>(undefined);
  // Last caret/selection that lived inside one of the editors. Toolbar buttons can
  // briefly move focus/selection, and some browsers collapse the live selection once
  // focus leaves a contenteditable — so we remember the range and restore it before
  // every toolbar action. This is what keeps formatting + table controls reliable.
  const savedRange = useRef<Range | null>(null);
  // Paste events don't carry modifier keys, so we track whether Shift is held
  // from key events and read it at paste time (⌘⇧V / Ctrl+Shift+V = plain paste).
  const shiftHeld = useRef(false);
  // Version snapshots: when the last one was taken, and a fingerprint of what it
  // held, so we don't store duplicates or snapshot more than once per interval.
  const lastSnapAt = useRef(0);
  const lastSnapKey = useRef<string | null>(null);
  // Page-history panel state.
  const [showHistory, setShowHistory] = useState(false);
  const [snaps, setSnaps] = useState<VisionDocSnapshot[] | null>(null);
  const [snapError, setSnapError] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  // Empty only when there's no text AND no block content (table/list/rule/image).
  const setEmpty = (el: HTMLDivElement | null) => {
    if (!el) return;
    const hasText = !!(el.textContent && el.textContent.trim());
    const hasBlocks = !!el.querySelector('table, hr, img, ul, ol, .doc-toggle');
    el.dataset.empty = hasText || hasBlocks ? 'false' : 'true';
  };

  // Ensure every checklist item carries its class + checked state (survives Enter/paste).
  const normalizeTasks = (el: HTMLDivElement | null) => {
    el?.querySelectorAll('ul.doc-tasks > li').forEach((li) => {
      li.classList.add('doc-task');
      if (li.getAttribute('data-checked') == null) li.setAttribute('data-checked', 'false');
    });
  };

  const afterEdit = () => {
    normalizeTasks(summaryRef.current);
    normalizeTasks(bodyRef.current);
    setEmpty(summaryRef.current);
    setEmpty(bodyRef.current);
    scheduleSave();
  };

  const snapshot = (): Partial<VisionDoc> => ({
    title: meta.current.title,
    color: meta.current.color,
    summary: summaryRef.current?.innerHTML ?? '',
    content: bodyRef.current?.innerHTML ?? '',
  });

  const persistNow = () => {
    onChange(snapshot(), true);
    maybeSnapshot();
    setStatus('saved');
    window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setStatus('idle'), 1500);
  };

  const SNAPSHOT_INTERVAL_MS = 90_000;
  // Store a recovery snapshot of the current page, but only when something changed
  // since the last one and (unless forced) at most once per interval. Fire-and-
  // forget — a missing table / offline just means no snapshot this time.
  const maybeSnapshot = (force = false) => {
    const summaryHtml = summaryRef.current?.innerHTML ?? '';
    const contentHtml = bodyRef.current?.innerHTML ?? '';
    const key = `${meta.current.title} ${summaryHtml} ${contentHtml}`;
    if (key === lastSnapKey.current) return; // nothing new to capture
    if (!force && Date.now() - lastSnapAt.current < SNAPSHOT_INTERVAL_MS) return;
    lastSnapAt.current = Date.now();
    lastSnapKey.current = key;
    db.visionDocSnapshots
      .add({ doc_id: doc.id, title: meta.current.title, summary: summaryHtml, content: contentHtml })
      .catch(() => {
        /* table not set up / offline — ignore; the history panel surfaces setup */
      });
  };

  const scheduleSave = () => {
    setStatus('saving');
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = undefined;
      persistNow();
    }, 700);
  };

  // Seed both editors once; keyed by doc.id in the parent so switching docs remounts.
  useEffect(() => {
    // New paragraphs (Enter, paste) should be <p> blocks, not <div>/<br> — so the
    // whole doc stays block-structured and block commands behave predictably.
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {
      /* not supported everywhere — the load-time normalize still keeps blocks clean */
    }
    if (summaryRef.current) {
      summaryRef.current.innerHTML = doc.summary || '';
      normalizeLoadedBlocks(summaryRef.current);
      setEmpty(summaryRef.current);
    }
    if (bodyRef.current) {
      bodyRef.current.innerHTML = doc.content || '';
      normalizeLoadedBlocks(bodyRef.current);
      setEmpty(bodyRef.current);
    }
    // Baseline fingerprint = the state as loaded, so we never snapshot an unchanged page.
    lastSnapKey.current = `${doc.title} ${summaryRef.current?.innerHTML ?? ''} ${bodyRef.current?.innerHTML ?? ''}`;
    refreshDocRefs();
    return () => {
      // Flush any pending edit when leaving this doc, and capture a final snapshot.
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        onChange(snapshot(), true);
      }
      maybeSnapshot(true);
      window.clearTimeout(savedTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-resolve link-chip labels whenever the page list changes (title edits, deletes).
  useEffect(() => {
    refreshDocRefs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDocs]);

  // Track whether the caret sits inside a table, to enable row/column controls,
  // and remember the live selection while it's inside an editor.
  useEffect(() => {
    const onSel = () => {
      rememberSelection();
      setInTable(!!getCell());
    };
    document.addEventListener('selectionchange', onSel);
    const onShift = (e: KeyboardEvent) => {
      shiftHeld.current = e.shiftKey;
    };
    document.addEventListener('keydown', onShift, true);
    document.addEventListener('keyup', onShift, true);
    return () => {
      document.removeEventListener('selectionchange', onSel);
      document.removeEventListener('keydown', onShift, true);
      document.removeEventListener('keyup', onShift, true);
    };
  }, []);

  // Close any open toolbar menu on an outside click.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-menu-root]')) setMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menu]);

  // Keep the resize handle glued to the image as the doc scrolls or the window resizes.
  useEffect(() => {
    if (!imgBox) return;
    const onMove = () => syncImgBox();
    const sc = scrollRef.current;
    sc?.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      sc?.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [imgBox]);

  // Clicking anywhere that isn't the image or its handle drops the selection.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'IMG' || t.closest('[data-img-handle]')) return;
      selImgRef.current = null;
      setImgBox(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const onTitle = (v: string) => {
    setTitle(v);
    meta.current.title = v;
    scheduleSave();
  };

  const pickColor = (c: string) => {
    setColor(c);
    meta.current.color = c;
    persistNow();
  };

  // ---- selection helpers (shared by summary + body via the live selection) ----
  const hostOf = (n: Node | null): HTMLDivElement | null => {
    if (!n) return null;
    if (summaryRef.current?.contains(n)) return summaryRef.current;
    if (bodyRef.current?.contains(n)) return bodyRef.current;
    return null;
  };
  const inEditors = () => {
    const n = window.getSelection()?.anchorNode ?? null;
    return !!hostOf(n);
  };
  // Snapshot the live selection whenever it sits inside an editor.
  const rememberSelection = () => {
    const s = window.getSelection();
    if (!s || s.rangeCount === 0) return;
    const r = s.getRangeAt(0);
    if (hostOf(r.commonAncestorContainer)) savedRange.current = r.cloneRange();
  };
  // Put the remembered range back into the live selection. Returns false if we no
  // longer have a valid range that still lives inside an editor (e.g. its node was
  // deleted), so callers can fall back.
  const restoreSelection = (): boolean => {
    const r = savedRange.current;
    if (!r) return false;
    const c = r.commonAncestorContainer;
    if (!c.isConnected) { savedRange.current = null; return false; }
    const host = hostOf(c);
    if (!host) { savedRange.current = null; return false; }
    host.focus();
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
    return true;
  };
  const ensureFocus = () => {
    // Prefer the live selection if it's already inside an editor…
    if (inEditors()) { rememberSelection(); return; }
    // …otherwise restore the last remembered caret…
    if (restoreSelection()) return;
    // …and only as a last resort drop the caret at the end of the body.
    const el = bodyRef.current;
    if (!el) return;
    el.focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
    savedRange.current = r.cloneRange();
  };
  const getCell = (): HTMLTableCellElement | null => {
    // Prefer the live caret, but fall back to the remembered range so the row/column
    // controls keep working even after focus briefly left the editor.
    let n: Node | null = window.getSelection()?.anchorNode ?? null;
    if (!hostOf(n)) n = savedRange.current?.commonAncestorContainer ?? null;
    if (!n || !n.isConnected || !hostOf(n)) return null;
    let cur: Node | null = n;
    while (cur && cur !== document) {
      if (cur instanceof HTMLTableCellElement) return cur;
      cur = cur.parentNode;
    }
    return null;
  };

  // A single toolbar drives whichever section is focused (execCommand acts on the selection).
  const exec = (cmd: string, val?: string) => {
    ensureFocus();
    document.execCommand(cmd, false, val);
    afterEdit();
  };
  const execStyled = (cmd: string, val?: string) => {
    ensureFocus();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(cmd, false, val);
    afterEdit();
  };

  // Resize just the SELECTED text with an inline font-size span — this never
  // changes the block type, so code stays code, a list stays a list, etc. With
  // nothing selected it sets the size for whatever you type next.
  const applyFontSize = (px: number) => {
    ensureFocus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!hostOf(range.commonAncestorContainer)) return;
    const span = document.createElement('span');
    span.style.fontSize = `${px}px`;
    if (range.collapsed) {
      span.appendChild(document.createTextNode('​')); // zero-width space to hold the caret
      range.insertNode(span);
      const r = document.createRange();
      r.setStart(span.firstChild!, 1);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      savedRange.current = r.cloneRange();
    } else {
      try {
        range.surroundContents(span);
      } catch {
        // Selection crosses element boundaries — extract then wrap.
        const frag = range.extractContents();
        span.appendChild(frag);
        range.insertNode(span);
      }
      // Clear any nested font-size spans so the new size actually wins.
      span.querySelectorAll('span[style*="font-size"]').forEach((inner) => {
        (inner as HTMLElement).style.removeProperty('font-size');
      });
      const r = document.createRange();
      r.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(r);
      savedRange.current = r.cloneRange();
    }
    afterEdit();
  };

  // Drop any inline font-size on the selection, falling back to the block's
  // default size (the Text-size "Reset" action).
  const clearFontSize = () => {
    ensureFocus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const host = hostOf(range.commonAncestorContainer);
    if (!host) return;
    host.querySelectorAll('span[style*="font-size"], font[size]').forEach((el) => {
      if (!range.intersectsNode(el)) return;
      if (el.tagName === 'FONT') el.removeAttribute('size');
      else (el as HTMLElement).style.removeProperty('font-size');
      const e = el as HTMLElement;
      if (e.tagName === 'SPAN' && !e.getAttribute('style') && e.className === '') {
        const p = e.parentNode!;
        while (e.firstChild) p.insertBefore(e.firstChild, e);
        p.removeChild(e);
      }
    });
    afterEdit();
  };

  const insertTable = (rows: number, cols: number) => {
    ensureFocus();
    let html = '<table class="doc-table"><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        const tag = r === 0 ? 'th' : 'td';
        html += `<${tag}><br></${tag}>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    document.execCommand('insertHTML', false, html);
    setMenu(null);
    afterEdit();
  };

  // ---- linked-page reference chips ----
  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Insert a collapsed link chip at the caret. Non-editable so it acts as one atom;
  // the title is a cache — refreshDocRefs() re-derives it from the live page list.
  const insertDocRef = (id: string, title: string) => {
    ensureFocus();
    const label = escapeHtml(title || 'Untitled');
    document.execCommand(
      'insertHTML',
      false,
      `<a class="doc-ref" data-doc-id="${id}" contenteditable="false">📄 ${label}</a>&#8203;`
    );
    setMenu(null);
    afterEdit();
  };

  const pickLinkedDoc = (id: string) => {
    const d = allDocs.find((x) => x.id === id);
    insertDocRef(id, d?.title || 'Untitled');
  };

  const createAndLinkInline = async () => {
    if (!onCreateInlinePage) return;
    const created = await onCreateInlinePage();
    setMenu(null);
    if (!created) return;
    insertDocRef(created.id, created.title);
    // Open the new inline page straight away so it can be filled in.
    onOpenDoc?.(created.id);
  };

  // Keep every chip's label in sync with the current page title, and flag any whose
  // target page is gone (deleted / purged) so a click can't open a dead link.
  const refreshDocRefs = () => {
    [summaryRef.current, bodyRef.current].forEach((host) => {
      host?.querySelectorAll('a.doc-ref').forEach((el) => {
        const a = el as HTMLAnchorElement;
        a.setAttribute('contenteditable', 'false');
        const id = a.getAttribute('data-doc-id');
        const d = allDocs.find((x) => x.id === id);
        const next = d ? `📄 ${d.title || 'Untitled'}` : '⚠ Page unavailable';
        if (d) a.removeAttribute('data-missing');
        else a.setAttribute('data-missing', 'true');
        if (a.textContent !== next) a.textContent = next;
      });
    });
  };

  // Bullet / numbered / checklist, driven by our lossless block transform. Click
  // on plain lines → wrap them; click again on the same kind → unwrap back to
  // paragraphs; click a different kind → convert. Never deletes content.
  const applyList = (kind: ListKind) => {
    ensureFocus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const host = hostOf(range.commonAncestorContainer);
    if (!host) return;

    const touches = (node: Node) => {
      try {
        return range.intersectsNode(node);
      } catch {
        return true;
      }
    };

    // Collect the selected "lines": top-level non-list blocks, or the selected
    // <li>s within a top-level list.
    const touched: ListUnit[] = [];
    let anySelected = false;
    let allKind = true;
    Array.from(host.children).forEach((child) => {
      const el = child as HTMLElement;
      if (!touches(el)) return;
      if (el.tagName === 'UL' || el.tagName === 'OL') {
        const selectedLis = new Set<Element>();
        Array.from(el.children).forEach((li) => {
          if (li.tagName === 'LI' && touches(li)) {
            selectedLis.add(li);
            anySelected = true;
            if (listKindOf(el) !== kind) allKind = false;
          }
        });
        if (selectedLis.size) touched.push({ list: el, selectedLis });
      } else {
        touched.push({ block: el });
        anySelected = true;
        allKind = false;
      }
    });

    // Empty editor / unresolved caret: drop in a fresh one-item list.
    if (!anySelected || touched.length === 0) {
      const list = makeListEl(kind);
      const li = makeLi(kind, []);
      list.appendChild(li);
      host.appendChild(list);
      placeCaret(li, true);
      afterEdit();
      return;
    }

    // Drop a marker at the caret so the selection can be restored after the rebuild.
    const marker = document.createElement('span');
    marker.setAttribute('data-caret-marker', '1');
    const mr = range.cloneRange();
    mr.collapse(true);
    mr.insertNode(marker);

    applyListTransform(host, touched, allKind ? null : kind);

    const m = host.querySelector('span[data-caret-marker="1"]');
    if (m) {
      const r = document.createRange();
      r.setStartBefore(m);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      savedRange.current = r.cloneRange();
      m.remove();
    }
    normalizeTasks(host);
    afterEdit();
  };

  // Shared helpers for the block-level controls below -------------------------
  const selRangeHost = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    const host = hostOf(range.commonAncestorContainer);
    if (!host) return null;
    return { sel, range, host };
  };
  const rangeTouches = (range: Range, node: Node) => {
    try {
      return range.intersectsNode(node);
    } catch {
      return true;
    }
  };

  // Re-type the selected top-level blocks (heading ⇄ body ⇄ quote), losslessly:
  // we only swap each block's tag and move its children across, never deleting
  // text. Clicking the current type again toggles back to a paragraph.
  const setBlockType = (tag: string) => {
    ensureFocus();
    const ctx = selRangeHost();
    if (!ctx) return;
    const { sel, range, host } = ctx;
    const blocks = Array.from(host.children).filter(
      (el) => rangeTouches(range, el) && CONVERTIBLE_TAGS.has(el.tagName)
    ) as HTMLElement[];
    if (blocks.length === 0) return;
    const target = blocks.every((b) => b.tagName === tag.toUpperCase()) ? 'p' : tag;

    const marker = document.createElement('span');
    marker.setAttribute('data-caret-marker', '1');
    const mr = range.cloneRange();
    mr.collapse(true);
    mr.insertNode(marker);

    blocks.forEach((b) => {
      const nb = document.createElement(target);
      if (b.style.textAlign) nb.style.textAlign = b.style.textAlign;
      while (b.firstChild) nb.appendChild(b.firstChild);
      b.replaceWith(nb);
    });

    const m = host.querySelector('span[data-caret-marker="1"]');
    if (m) {
      const r = document.createRange();
      r.setStartBefore(m);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      savedRange.current = r.cloneRange();
      m.remove();
    }
    afterEdit();
  };

  // Align the selected top-level blocks. Pure style change — no structural edit,
  // so the caret stays put and nothing can be lost.
  const setAlign = (dir: 'left' | 'center' | 'right') => {
    ensureFocus();
    const ctx = selRangeHost();
    if (!ctx) return;
    const { range, host } = ctx;
    let any = false;
    Array.from(host.children).forEach((el) => {
      if (!rangeTouches(range, el)) return;
      (el as HTMLElement).style.textAlign = dir;
      any = true;
    });
    if (any) afterEdit();
  };

  // Clear formatting: strip inline marks (bold/colour/size/…) then flatten the
  // block back to a plain paragraph.
  const clearFormatting = () => {
    exec('removeFormat');
    setBlockType('p');
  };

  // Page history ------------------------------------------------------------
  const openHistory = () => {
    setShowHistory(true);
    setSnaps(null);
    setSnapError(false);
    setConfirmRestore(null);
    maybeSnapshot(true); // capture the current state so it's in the list too
    db.visionDocSnapshots
      .list(doc.id)
      .then(setSnaps)
      .catch(() => {
        setSnaps([]);
        setSnapError(true);
      });
  };

  // Roll the page back to a snapshot. The current state is captured first, so a
  // restore is itself reversible (just restore the newest snapshot again).
  const restoreSnapshot = (snap: VisionDocSnapshot) => {
    maybeSnapshot(true);
    setTitle(snap.title);
    meta.current.title = snap.title;
    if (summaryRef.current) {
      summaryRef.current.innerHTML = snap.summary || '';
      normalizeLoadedBlocks(summaryRef.current);
      setEmpty(summaryRef.current);
    }
    if (bodyRef.current) {
      bodyRef.current.innerHTML = snap.content || '';
      normalizeLoadedBlocks(bodyRef.current);
      setEmpty(bodyRef.current);
    }
    refreshDocRefs();
    lastSnapKey.current = `${snap.title} ${summaryRef.current?.innerHTML ?? ''} ${bodyRef.current?.innerHTML ?? ''}`;
    persistNow();
    setShowHistory(false);
    setConfirmRestore(null);
  };

  // Insert a collapsible toggle built on native <details>: a clickable summary
  // (title) + a body that collapses reliably. The body stays in the saved HTML
  // even when closed, so content is never lost. The title is pre-selected so the
  // first keystroke names the toggle.
  const insertToggle = () => {
    ensureFocus();
    const id = 'tg-' + Date.now().toString(36);
    document.execCommand(
      'insertHTML',
      false,
      `<details class="doc-toggle" open><summary class="doc-toggle-head" id="${id}">Toggle</summary><div class="doc-toggle-body"><p><br></p></div></details><p><br></p>`
    );
    const head = document.getElementById(id);
    if (head) {
      head.removeAttribute('id');
      const r = document.createRange();
      r.selectNodeContents(head); // select "Toggle" so the first keystroke replaces it
      const s = window.getSelection();
      s?.removeAllRanges();
      s?.addRange(r);
      savedRange.current = r.cloneRange();
    }
    afterEdit();
  };

  // Insert one or more image files at the caret. Each is compressed, then
  // uploaded to storage so the doc HTML holds only a short URL (fast to save/load,
  // no bloat over the years). If the upload fails — offline, bucket not set up —
  // we embed the image inline as a data URL so it's never silently lost.
  const insertImageFiles = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    ensureFocus();
    for (const file of images) {
      const { blob, type } = await compressImage(file);
      let src: string | null = null;
      if (onUploadImage) {
        try {
          src = await onUploadImage(blob, type);
        } catch {
          src = null; // fall through to inline embedding
        }
      }
      if (!src) src = await blobToDataUrl(blob).catch(() => null);
      if (!src) continue;
      // Keep the caret inside the editor even if focus drifted during the upload.
      ensureFocus();
      // insertHTML drops the caret right after the inserted node, so a series
      // of images lands in order and there's an empty line to keep typing on.
      document.execCommand('insertHTML', false, `<img src="${src}" alt="" /><p><br></p>`);
    }
    afterEdit();
  };

  // Screenshots / copied images arrive as clipboard files — grab them before the
  // default paste turns them into anything lossy (or nothing at all).
  const onEditorPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length > 0) {
      e.preventDefault();
      void insertImageFiles(files);
      return;
    }
    e.preventDefault();
    const plain = e.clipboardData?.getData('text/plain') ?? '';
    const rawHtml = e.clipboardData?.getData('text/html') ?? '';

    // DEFAULT (plain ⌘V / Ctrl+V): paste as PLAIN TEXT — clean, structure-free,
    // stays inside the current block. This is the main, trusted behaviour and is
    // never touched by the formatted path. Formatting is opt-in only: hold Shift
    // (⌘⇧V) or use the toolbar's "Paste with formatting" button.
    if (!shiftHeld.current || !rawHtml.trim()) {
      insertPlainText(plain);
      return;
    }
    insertFormattedHtml(rawHtml, plain);
  };

  // Insert clipboard text as plain text. A single line flows into the current
  // block; multiple lines become separate <p> paragraphs (NOT <br>-joined) so each
  // is a real block and list/heading commands can act on them without mangling.
  const insertPlainText = (text: string) => {
    if (!text) return;
    const normalized = text.replace(/\r\n?/g, '\n');
    if (!normalized.includes('\n')) {
      document.execCommand('insertText', false, normalized);
      afterEdit();
      return;
    }
    const html = normalized
      .split('\n')
      .map((line) => (line ? `<p>${escapeHtml(line)}</p>` : '<p><br></p>'))
      .join('');
    document.execCommand('insertHTML', false, html);
    afterEdit();
  };

  // Insert clipboard HTML WITH formatting, after passing it through the strict
  // whitelist so stray structure / Word-Docs cruft can't corrupt the doc. Falls
  // back to plain text if there's nothing safe left.
  const insertFormattedHtml = (rawHtml: string, plain: string) => {
    const clean = rawHtml.trim() ? sanitizeDocHtml(rawHtml) : '';
    if (!clean.trim()) {
      insertPlainText(plain);
      return;
    }
    document.execCommand('insertHTML', false, clean);
    refreshDocRefs();
    afterEdit();
  };

  // Toolbar "Paste with formatting" button: read the clipboard ourselves (async
  // API) and insert it formatted. If the browser blocks clipboard.read (some
  // webviews do), fall back to plain text, and ultimately to the ⌘⇧V shortcut.
  const pasteWithFormatting = async () => {
    setMenu(null);
    let html = '';
    let text = '';
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes('text/html')) html = await (await item.getType('text/html')).text();
        if (item.types.includes('text/plain')) text = await (await item.getType('text/plain')).text();
      }
    } catch {
      try {
        text = await navigator.clipboard.readText();
      } catch {
        /* clipboard blocked — nothing we can do here; use ⌘⇧V instead */
      }
    }
    ensureFocus();
    insertFormattedHtml(html, text);
  };

  const onEditorDrop = (e: React.DragEvent) => {
    const files = Array.from(e.dataTransfer?.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;
    e.preventDefault();
    void insertImageFiles(files);
  };

  const pickImage = () => {
    ensureFocus();
    fileInputRef.current?.click();
  };

  // Recompute the selected image's on-screen box (or drop the selection if it's
  // gone from the DOM, e.g. deleted).
  const syncImgBox = () => {
    const img = selImgRef.current;
    if (!img || !img.isConnected) {
      selImgRef.current = null;
      setImgBox(null);
      return;
    }
    const r = img.getBoundingClientRect();
    setImgBox({ left: r.left, top: r.top, width: r.width, height: r.height });
  };

  const selectImage = (img: HTMLImageElement) => {
    selImgRef.current = img;
    syncImgBox();
  };

  // Drag the corner handle to make the image smaller or bigger; the new width is
  // written as an inline style so it saves with the doc HTML.
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const img = selImgRef.current;
    if (!img) return;
    const startX = e.clientX;
    const startW = img.getBoundingClientRect().width;
    const maxW = img.parentElement?.clientWidth || startW * 3;
    const onMove = (ev: PointerEvent) => {
      const w = Math.max(48, Math.min(startW + (ev.clientX - startX), maxW));
      img.style.width = `${Math.round(w)}px`;
      img.style.height = 'auto';
      syncImgBox();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      syncImgBox();
      afterEdit(); // persist the new width
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Table row/column edits, relative to the cell holding the caret.
  // Drop the caret into a cell (or after the table once it's gone) so the next
  // edit lands somewhere sane and the selection is never left detached.
  const caretInto = (target: Node | null) => {
    if (!target || !target.isConnected) { ensureFocus(); return; }
    const host = hostOf(target);
    if (host) host.focus();
    const r = document.createRange();
    r.selectNodeContents(target);
    r.collapse(true);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
    savedRange.current = r.cloneRange();
  };

  // The block to move the caret to once a whole table is removed — the paragraph
  // right after it (insertTable leaves one), else the one before, else the host.
  const tableSibling = (table: Element): Node | null =>
    (table.nextElementSibling as HTMLElement | null) ??
    (table.previousElementSibling as HTMLElement | null) ??
    hostOf(table);

  const tableOp = (op: 'addRow' | 'addCol' | 'delRow' | 'delCol' | 'delTable') => {
    ensureFocus(); // restore the caret into the table if focus drifted to the toolbar
    const cell = getCell();
    if (!cell) return;
    const row = cell.parentElement as HTMLTableRowElement | null;
    const table = cell.closest('table');
    if (!row || !table) return;
    const colIdx = Array.from(row.children).indexOf(cell);
    const rows = Array.from(table.querySelectorAll('tr'));

    if (op === 'addRow') {
      const nr = document.createElement('tr');
      Array.from(row.children).forEach(() => {
        const td = document.createElement('td');
        td.innerHTML = '<br>';
        nr.appendChild(td);
      });
      row.after(nr);
      caretInto(nr.children[colIdx] ?? nr.children[0] ?? cell);
    } else if (op === 'addCol') {
      let created: Element | null = null;
      rows.forEach((tr) => {
        const ref = tr.children[colIdx];
        const tag = ref?.tagName === 'TH' ? 'th' : 'td';
        const c = document.createElement(tag);
        c.innerHTML = '<br>';
        if (ref) ref.after(c);
        else tr.appendChild(c);
        if (tr === row) created = c;
      });
      caretInto(created ?? cell);
    } else if (op === 'delTable') {
      const anchor = tableSibling(table);
      table.remove();
      caretInto(anchor);
    } else if (op === 'delRow') {
      if (rows.length <= 1) {
        const anchor = tableSibling(table);
        table.remove();
        caretInto(anchor);
      } else {
        const fallback = (row.nextElementSibling ?? row.previousElementSibling) as HTMLElement | null;
        row.remove();
        caretInto(fallback?.children[colIdx] ?? fallback?.children[0] ?? null);
      }
    } else if (op === 'delCol') {
      const cols = row.children.length;
      if (cols <= 1) {
        const anchor = tableSibling(table);
        table.remove();
        caretInto(anchor);
      } else {
        rows.forEach((tr) => tr.children[colIdx]?.remove());
        caretInto(row.children[colIdx] ?? row.children[row.children.length - 1] ?? null);
      }
    }
    afterEdit();
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* title + status */}
      <div className="px-4 sm:px-10 pt-1">
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
            <button
              onClick={openHistory}
              className="p-1.5 rounded-lg ink-text-muted hover:ink-text hover:bg-stone-100 dark:hover:bg-white/10 transition"
              title="Page history — restore an earlier version"
            >
              <History className="w-4 h-4" />
            </button>
            {nested ? null : confirmDel ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={onDelete}
                  className="text-[11px] font-bold text-red-600 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-400/10 transition"
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
                className="p-1.5 rounded-lg ink-text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-400/10 transition"
                title="Delete this doc"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* toolbar — wraps to as many rows as needed. Tighter padding on phones so
          more controls fit per row. Kept overflow-visible so the dropdown menus
          (size / colour / table) are never clipped. */}
      <div className="px-2.5 sm:px-10 py-2 mt-1 flex items-center gap-0.5 flex-wrap border-b border-black/5 dark:border-white/[0.13]">
        <TB onClick={() => exec('bold')} title="Bold"><Bold className="w-4 h-4" /></TB>
        <TB onClick={() => exec('italic')} title="Italic"><Italic className="w-4 h-4" /></TB>
        <TB onClick={() => exec('underline')} title="Underline"><Underline className="w-4 h-4" /></TB>

        {/* text style / heading preset */}
        <Menu
          open={menu === 'size'}
          onToggle={() => setMenu(menu === 'size' ? null : 'size')}
          title="Text style"
          icon={<><Type className="w-4 h-4" /><ChevronDown className="w-3 h-3 -ml-0.5" /></>}
          wide
        >
          <div className="min-w-[214px]">
            <div className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider ink-text-muted/70">Style</div>
            {BLOCK_STYLES.map((f) => (
              <button
                key={f.label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setBlockType(f.block.replace(/[<>]/g, ''));
                  setMenu(null);
                }}
                className="flex w-full items-baseline justify-between gap-4 px-3 py-2 rounded-lg hover:bg-stone-100 text-left transition-colors"
              >
                <span className="ink-text" style={{ fontSize: f.px, fontWeight: f.weight, lineHeight: 1.1 }}>
                  {f.label}
                </span>
                <span className="text-[11px] ink-text-muted font-medium">{f.hint}</span>
              </button>
            ))}
            <div className="border-t border-black/5 dark:border-white/[0.13] my-1.5" />
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider ink-text-muted/70">
              Text size <span className="font-medium normal-case tracking-normal">(selected text)</span>
            </div>
            <div className="grid grid-cols-4 gap-1 px-1.5">
              {TEXT_SIZES.map((s) => (
                <button
                  key={s}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    applyFontSize(s);
                    setMenu(null);
                  }}
                  className="h-8 grid place-items-center rounded-lg text-[12px] font-semibold ink-text-muted hover:ink-text hover:bg-stone-100 transition"
                  title={`${s}px`}
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                clearFontSize();
                setMenu(null);
              }}
              className="mt-1 w-full text-[12px] ink-text-muted hover:ink-text px-3 py-1.5 rounded-lg hover:bg-stone-100 text-left transition-colors"
            >
              Reset size
            </button>
          </div>
        </Menu>

        {/* text color */}
        <Menu
          open={menu === 'color'}
          onToggle={() => setMenu(menu === 'color' ? null : 'color')}
          title="Text color"
          icon={<Baseline className="w-4 h-4" />}
          wide
        >
          <Swatches
            colors={TEXT_COLORS}
            cols={8}
            onPick={(c) => {
              execStyled('foreColor', c);
              setMenu(null);
            }}
          />
        </Menu>

        {/* highlight */}
        <Menu
          open={menu === 'hilite'}
          onToggle={() => setMenu(menu === 'hilite' ? null : 'hilite')}
          title="Highlight"
          icon={<Highlighter className="w-4 h-4" />}
        >
          <Swatches
            colors={HILITE_COLORS}
            onPick={(c) => {
              execStyled('hiliteColor', c);
              setMenu(null);
            }}
          />
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              execStyled('hiliteColor', 'transparent');
              setMenu(null);
            }}
            className="mt-1 w-full text-[12px] ink-text-muted hover:ink-text px-2 py-1 rounded-md hover:bg-stone-100 text-left"
          >
            Remove highlight
          </button>
        </Menu>

        <Sep />
        <TB onClick={() => setBlockType('h1')} title="Heading 1"><Heading1 className="w-4 h-4" /></TB>
        <TB onClick={() => setBlockType('h2')} title="Heading 2"><Heading2 className="w-4 h-4" /></TB>
        <TB onClick={() => setBlockType('blockquote')} title="Quote"><Quote className="w-4 h-4" /></TB>

        <Sep />
        <TB onClick={() => applyList('bullet')} title="Bulleted list"><List className="w-4 h-4" /></TB>
        <TB onClick={() => applyList('number')} title="Numbered list"><ListOrdered className="w-4 h-4" /></TB>
        <TB onClick={() => applyList('task')} title="Checklist (tick boxes)"><ListTodo className="w-4 h-4" /></TB>
        <TB onClick={insertToggle} title="Toggle (collapsible section)"><ChevronRight className="w-4 h-4" /></TB>

        <Sep />
        {/* table insert with a quick size picker */}
        <Menu
          open={menu === 'table'}
          onToggle={() => setMenu(menu === 'table' ? null : 'table')}
          title="Insert table"
          icon={<Table className="w-4 h-4" />}
          wide
        >
          <TableSizePicker onPick={insertTable} />
        </Menu>
        <TB onClick={() => exec('insertHorizontalRule')} title="Divider line"><Minus className="w-4 h-4" /></TB>
        <TB onClick={pickImage} title="Insert image (or just paste / drop one)"><ImageIcon className="w-4 h-4" /></TB>

        {/* add an inline sub-page, or link an existing page — hidden inside a linked window */}
        {(onOpenDoc || onCreateInlinePage) && (
          <Menu
            open={menu === 'link'}
            onToggle={() => setMenu(menu === 'link' ? null : 'link')}
            title="Add / link a page"
            icon={<Link2 className="w-4 h-4" />}
            wide
          >
            <DocRefPicker
              docs={allDocs}
              currentId={doc.id}
              onPick={pickLinkedDoc}
              onNew={onCreateInlinePage ? createAndLinkInline : undefined}
            />
          </Menu>
        )}

        <Sep />
        <TB onClick={() => setAlign('left')} title="Align left"><AlignLeft className="w-4 h-4" /></TB>
        <TB onClick={() => setAlign('center')} title="Align center"><AlignCenter className="w-4 h-4" /></TB>
        <TB onClick={() => setAlign('right')} title="Align right"><AlignRight className="w-4 h-4" /></TB>

        <Sep />
        <TB
          onClick={() => void pasteWithFormatting()}
          title="Paste with formatting (keeps headings, quotes, etc.) — or press ⌘⇧V"
        >
          <ClipboardPaste className="w-4 h-4" />
        </TB>
        <TB onClick={clearFormatting} title="Clear formatting">
          <Eraser className="w-4 h-4" />
        </TB>

        {/* table row/column controls — only while the caret is inside a table */}
        {inTable && (
          <>
            <Sep />
            <TextBtn onClick={() => tableOp('addRow')} title="Add row below">+ Row</TextBtn>
            <TextBtn onClick={() => tableOp('addCol')} title="Add column right">+ Col</TextBtn>
            <TextBtn onClick={() => tableOp('delRow')} title="Delete this row" danger>− Row</TextBtn>
            <TextBtn onClick={() => tableOp('delCol')} title="Delete this column" danger>− Col</TextBtn>
            <TextBtn onClick={() => tableOp('delTable')} title="Delete the whole table" danger>✕ Table</TextBtn>
          </>
        )}

        <div className="ml-auto flex items-center gap-1.5 pl-2">
          {GOAL_COLORS.map((c) => (
            <button
              key={c}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pickColor(c)}
              className="w-4 h-4 rounded-full transition-transform hover:scale-110"
              style={{ background: c, boxShadow: c === color ? `0 0 0 2px #fff, 0 0 0 3.5px ${c}` : undefined }}
              title="Doc color"
            />
          ))}
        </div>
      </div>

      {/* objectives section + body */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-10 py-5">
        <div
          className="rounded-2xl px-4 py-3 mb-5"
          style={{ background: `${color}12`, border: `1px solid ${color}33`, borderLeft: `3px solid ${color}` }}
        >
          <div className="text-[11px] font-bold tracking-wider uppercase mb-1.5" style={{ color }}>
            To do · objectives
          </div>
          <div
            ref={summaryRef}
            contentEditable
            suppressContentEditableWarning
            onInput={afterEdit}
            onKeyDown={onEditorKeyDown}
            onClick={onTaskClick}
            onPaste={onEditorPaste}
            onDrop={onEditorDrop}
            onDragOver={(e) => e.preventDefault()}
            onBlur={persistNow}
            data-placeholder="List what you need to get done…"
            className="doc-body text-[14px] ink-text"
          />
        </div>
        <div
          ref={bodyRef}
          contentEditable
          suppressContentEditableWarning
          onInput={afterEdit}
          onKeyDown={onEditorKeyDown}
          onClick={onTaskClick}
          onPaste={onEditorPaste}
          onDrop={onEditorDrop}
          onDragOver={(e) => e.preventDefault()}
          onBlur={persistNow}
          data-placeholder="Write your action plan…"
          className="doc-body min-h-[240px] text-[15px] ink-text"
        />
        {/* Hidden picker for the toolbar's insert-image button. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void insertImageFiles(Array.from(e.target.files || []));
            e.target.value = ''; // let the same file be picked again later
          }}
        />
      </div>

      {/* Resize overlay for the selected image — portaled so it's never clipped. */}
      {imgBox &&
        createPortal(
          <>
            <div
              style={{
                position: 'fixed',
                left: imgBox.left,
                top: imgBox.top,
                width: imgBox.width,
                height: imgBox.height,
                outline: '2px solid #f59e0b',
                borderRadius: '0.5rem',
                pointerEvents: 'none',
                zIndex: 90,
              }}
            />
            <div
              data-img-handle
              onPointerDown={startResize}
              title="Drag to resize"
              style={{
                position: 'fixed',
                left: imgBox.left + imgBox.width - 8,
                top: imgBox.top + imgBox.height - 8,
                width: 16,
                height: 16,
                background: '#f59e0b',
                border: '2px solid #fff',
                borderRadius: '50%',
                cursor: 'nwse-resize',
                touchAction: 'none',
                zIndex: 91,
              }}
            />
          </>,
          document.body
        )}

      {/* Page history / restore — portaled over everything. */}
      {showHistory &&
        createPortal(
          <div className="fixed inset-0 z-[96]" onClick={() => setShowHistory(false)}>
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6">
              <div
                className="relative paper-card rounded-2xl border border-black/10 dark:border-white/[0.2] shadow-2xl w-[min(560px,96vw)] h-[min(640px,90vh)] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-black/5 dark:border-white/[0.13]">
                  <History className="w-5 h-5 ink-text-muted flex-none" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-bold ink-text leading-tight">Page history</h3>
                    <p className="text-[11px] ink-text-muted">Restore an earlier version of this page</p>
                  </div>
                  <button
                    onClick={() => setShowHistory(false)}
                    title="Close"
                    className="p-1.5 rounded-lg ink-text-muted hover:ink-text hover:bg-stone-100 dark:hover:bg-white/10 transition flex-none"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
                  {snapError ? (
                    <div className="px-3 py-10 text-center text-[13px] ink-text-muted">
                      Page history needs a one-time setup. Run the{' '}
                      <span className="font-semibold ink-text">vision_doc_snapshots</span> migration in Supabase, then
                      reopen this page.
                    </div>
                  ) : snaps === null ? (
                    <div className="px-3 py-10 text-center text-[13px] ink-text-muted">Loading…</div>
                  ) : snaps.length === 0 ? (
                    <div className="px-3 py-10 text-center text-[13px] ink-text-muted">
                      No earlier versions yet. As you edit, snapshots are saved here automatically.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {snaps.map((s, i) => {
                        const preview = htmlToPreview(`${s.summary} ${s.content}`);
                        return (
                          <div
                            key={s.id}
                            className="rounded-xl border border-black/5 dark:border-white/[0.13] bg-white/60 dark:bg-paper/60 px-3.5 py-2.5"
                          >
                            <div className="flex items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="text-[13px] font-semibold ink-text">
                                  {new Date(s.created_at).toLocaleString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}
                                  {i === 0 && (
                                    <span className="ml-2 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                      LATEST
                                    </span>
                                  )}
                                </div>
                                <div className="text-[12px] ink-text-muted truncate">
                                  {s.title || 'Untitled'}
                                  {preview ? ` — ${preview}` : ''}
                                </div>
                              </div>
                              {confirmRestore === s.id ? (
                                <div className="flex items-center gap-1 flex-none">
                                  <button
                                    onClick={() => restoreSnapshot(s)}
                                    className="text-[12px] font-bold text-amber-700 dark:text-amber-300 px-2 py-1 rounded hover:bg-amber-50 dark:hover:bg-amber-400/10 transition"
                                  >
                                    Restore
                                  </button>
                                  <button
                                    onClick={() => setConfirmRestore(null)}
                                    className="text-[12px] ink-text-muted px-1.5 py-1 rounded hover:bg-stone-100 transition"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmRestore(s.id)}
                                  className="flex-none flex items-center gap-1 text-[12px] font-semibold ink-text-muted hover:ink-text px-2 py-1 rounded-lg hover:bg-stone-100 dark:hover:bg-white/10 transition"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" /> Restore
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <p className="px-1 pt-2 text-[11px] ink-text-muted/70">
                        Restoring saves your current version first, so you can always undo it.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );

  // Toggle a checklist item when its tick box (the left ~26px) is clicked, or
  // select an image for resizing when the image itself is clicked.
  // Keyboard guards for toggles: Enter in a title descends into the body, and
  // Backspace/Delete can never merge a block INTO a toggle (that used to wipe a
  // collapsed toggle's hidden body) — instead they open it and park the caret.
  function onEditorKeyDown(e: React.KeyboardEvent) {
    const sel = window.getSelection();
    const node = sel?.anchorNode;
    if (!node) return;
    const host = hostOf(node);
    if (!host) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      const el = node.nodeType === 3 ? node.parentElement : (node as HTMLElement);
      const head = el?.closest?.('summary.doc-toggle-head') as HTMLElement | null;
      if (head) {
        e.preventDefault();
        const d = head.parentElement as HTMLDetailsElement | null;
        if (d && !d.open) d.open = true; // descending always reveals the body
        const body = head.nextElementSibling as HTMLElement | null; // .doc-toggle-body
        const target = (body?.querySelector('p, li, div') as HTMLElement | null) || body;
        if (target) placeCaret(target, true);
        return;
      }
      // Enter exits a blockquote to a normal paragraph instead of trapping you in
      // it forever. (Shift+Enter still adds a soft line break inside the quote.)
      const bq = el?.closest?.('blockquote') as HTMLElement | null;
      if (bq && hostOf(bq)) {
        e.preventDefault();
        const p = document.createElement('p');
        p.appendChild(document.createElement('br'));
        bq.parentNode?.insertBefore(p, bq.nextSibling);
        placeCaret(p, true);
        afterEdit();
        return;
      }
      return;
    }

    if ((e.key === 'Backspace' || e.key === 'Delete') && sel!.isCollapsed && sel!.rangeCount) {
      const range = sel!.getRangeAt(0);
      // The top-level block the caret sits in (a direct child of the editor host).
      let block: HTMLElement | null = node.nodeType === 3 ? node.parentElement : (node as HTMLElement);
      while (block && block.parentElement && block.parentElement !== host) block = block.parentElement;
      if (!block || block.parentElement !== host) return;
      if (block.matches?.('details.doc-toggle')) return; // caret is already inside a toggle

      const probe = range.cloneRange();
      probe.selectNodeContents(block);

      if (e.key === 'Backspace') {
        probe.setEnd(range.startContainer, range.startOffset);
        if (probe.toString().length !== 0) return; // not at the block's start
        const prev = block.previousElementSibling as HTMLElement | null;
        if (prev?.matches?.('details.doc-toggle')) {
          e.preventDefault();
          (prev as HTMLDetailsElement).open = true;
          placeCaretInToggleBody(prev, false);
          if (isEmptyBlock(block)) block.remove();
          scheduleSave();
        }
      } else {
        probe.setStart(range.endContainer, range.endOffset);
        if (probe.toString().length !== 0) return; // not at the block's end
        const next = block.nextElementSibling as HTMLElement | null;
        if (next?.matches?.('details.doc-toggle')) {
          e.preventDefault();
          (next as HTMLDetailsElement).open = true;
          placeCaretInToggleBody(next, true);
          if (isEmptyBlock(block)) block.remove();
          scheduleSave();
        }
      }
    }
  }

  function onTaskClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    // Linked-page chip: open it in a window (unless this editor is itself a linked
    // window — depth cap — or the target page no longer exists).
    const ref = target.closest?.('a.doc-ref') as HTMLElement | null;
    if (ref) {
      e.preventDefault();
      const id = ref.getAttribute('data-doc-id');
      if (id && onOpenDoc && ref.getAttribute('data-missing') !== 'true') onOpenDoc(id);
      return;
    }
    if (target.tagName === 'IMG') {
      selectImage(target as HTMLImageElement);
      return;
    }
    // Toggle block (native <details>): clicking the ▶ arrow (left ~30px of the
    // summary) opens/closes it; clicking anywhere else in the summary just edits
    // the title. We always preventDefault so the native summary-toggle never
    // fires on its own — we drive `open` ourselves and persist it.
    const head = target.closest?.('summary.doc-toggle-head') as HTMLElement | null;
    if (head) {
      e.preventDefault();
      const d = head.parentElement as HTMLDetailsElement | null;
      if (d && e.clientX - head.getBoundingClientRect().left <= 30) {
        d.open = !d.open;
        scheduleSave();
      }
      return;
    }
    const li = target.closest?.('li.doc-task') as HTMLElement | null;
    if (!li) return;
    if (e.clientX - li.getBoundingClientRect().left > 26) return;
    li.dataset.checked = li.dataset.checked === 'true' ? 'false' : 'true';
    scheduleSave();
  }
}

// Collapse the live selection to the start/end of an element's contents.
function placeCaret(el: HTMLElement, atStart: boolean) {
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(atStart);
  const s = window.getSelection();
  s?.removeAllRanges();
  s?.addRange(r);
}

// Park the caret at the start/end of a toggle's body (its nearest editable edge).
function placeCaretInToggleBody(det: HTMLElement, atStart: boolean) {
  const body = det.querySelector('.doc-toggle-body') as HTMLElement | null;
  const edge = (atStart ? body?.firstElementChild : body?.lastElementChild) as HTMLElement | null;
  placeCaret(edge || body || det, atStart);
}

function isEmptyBlock(block: HTMLElement): boolean {
  return (block.textContent ?? '').trim() === '' && !block.querySelector('img,table,hr,ul,ol,details');
}

// Real block-level tags. Everything else at the top level of an editor is "loose"
// inline content (bare text, <span>, <a>, <br>) that must be wrapped in a paragraph.
const BLOCK_TAGS = new Set([
  'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE',
  'PRE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'HR', 'DETAILS', 'FIGURE', 'IMG',
]);

// Make an editor's content properly block-structured: wrap any loose inline content
// that sits directly in the editor into <p> blocks, splitting at <br>. This is what
// makes list / heading / quote / alignment commands reliable — they operate on whole
// blocks, and <br>-joined "soft lines" (e.g. from an old plain-text paste) used to
// get mangled or deleted by execCommand. Idempotent; safe to run on every load.
function normalizeLoadedBlocks(host: HTMLElement) {
  const isBlock = (n: Node) => n.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((n as Element).tagName);
  const snapshot = Array.from(host.childNodes);
  let run: Node[] = [];
  const flushBefore = (ref: Node | null) => {
    if (run.length === 0) return;
    // Split the run into visual lines at each <br>.
    const lines: Node[][] = [[]];
    run.forEach((n) => {
      if (n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName === 'BR') {
        lines.push([]);
        n.parentNode?.removeChild(n); // the <br> becomes the paragraph break itself
      } else {
        lines[lines.length - 1].push(n);
      }
    });
    lines.forEach((lineNodes, i) => {
      // Drop a purely-empty trailing line so a single paste doesn't leave a blank para.
      if (lineNodes.length === 0 && i === lines.length - 1 && lines.length > 1) return;
      const p = document.createElement('p');
      if (lineNodes.length === 0) p.appendChild(document.createElement('br'));
      else lineNodes.forEach((ln) => p.appendChild(ln)); // moves the node into the <p>
      host.insertBefore(p, ref);
    });
    run = [];
  };
  snapshot.forEach((child) => {
    if (isBlock(child)) flushBefore(child);
    else run.push(child);
  });
  flushBefore(null);
}

// ---- list engine -----------------------------------------------------------
// Lists are driven by our own block-level transform instead of
// execCommand('insert*List'), which mangles/deletes content on WebKit. Every
// operation is lossless: it only ever MOVES existing nodes into new <li>/<p>
// wrappers, never deletes text. Covers bullet, numbered, and checklist, plus
// toggling a list back off and converting between kinds.
type ListKind = 'bullet' | 'number' | 'task';
type ListUnit = { block: HTMLElement } | { list: HTMLElement; selectedLis: Set<Element> };

// Top-level blocks that can be freely re-typed (heading ⇄ body ⇄ quote). Lists,
// tables, toggles, rules and images are left alone by the block-type control.
const CONVERTIBLE_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE']);

const LIST_SPEC: Record<ListKind, { tag: string; cls: string }> = {
  bullet: { tag: 'ul', cls: '' },
  number: { tag: 'ol', cls: '' },
  task: { tag: 'ul', cls: 'doc-tasks' },
};
function listKindOf(list: Element): ListKind | null {
  if (list.tagName === 'OL') return 'number';
  if (list.classList.contains('doc-tasks')) return 'task';
  if (list.tagName === 'UL') return 'bullet';
  return null;
}
function makeListEl(kind: ListKind): HTMLElement {
  const spec = LIST_SPEC[kind];
  const el = document.createElement(spec.tag);
  if (spec.cls) el.className = spec.cls;
  return el;
}
function makeLi(kind: ListKind, children: Node[]): HTMLElement {
  const li = document.createElement('li');
  if (kind === 'task') {
    li.className = 'doc-task';
    li.setAttribute('data-checked', 'false');
  }
  if (children.length === 0) li.appendChild(document.createElement('br'));
  else children.forEach((c) => li.appendChild(c));
  return li;
}
function makePara(children: Node[]): HTMLElement {
  const p = document.createElement('p');
  if (children.length === 0) p.appendChild(document.createElement('br'));
  else children.forEach((c) => p.appendChild(c));
  return p;
}
// Turn the selected "lines" into `kindOrNull` (null ⇒ unwrap back to paragraphs).
// Returns the new top-level nodes, in document order. Unselected items inside a
// touched list are kept, in their original kind, so partial selections split cleanly.
function retargetList(touched: ListUnit[], kindOrNull: ListKind | null): HTMLElement[] {
  const out: HTMLElement[] = [];
  let curList: HTMLElement | null = null;
  const pushLine = (children: Node[]) => {
    if (kindOrNull === null) {
      curList = null;
      out.push(makePara(children));
    } else {
      if (!curList) {
        curList = makeListEl(kindOrNull);
        out.push(curList);
      }
      curList.appendChild(makeLi(kindOrNull, children));
    }
  };
  touched.forEach((u) => {
    if ('block' in u) {
      pushLine(Array.from(u.block.childNodes));
    } else {
      const srcKind = listKindOf(u.list);
      let keepList: HTMLElement | null = null;
      Array.from(u.list.children).forEach((li) => {
        if (li.tagName !== 'LI') return;
        if (u.selectedLis.has(li)) {
          keepList = null;
          pushLine(Array.from(li.childNodes));
        } else {
          curList = null; // a kept item breaks the run, so following selected lines start a fresh list
          if (!keepList && srcKind) {
            keepList = makeListEl(srcKind);
            out.push(keepList);
          }
          keepList?.appendChild(li);
        }
      });
    }
  });
  return out;
}
function applyListTransform(host: HTMLElement, touched: ListUnit[], kindOrNull: ListKind | null) {
  const out = retargetList(touched, kindOrNull);
  const topEls = touched.map((u) => ('block' in u ? u.block : u.list));
  const anchor = topEls[0];
  out.forEach((n) => host.insertBefore(n, anchor));
  topEls.forEach((el) => el.remove());
}

// ---- paste sanitizer -------------------------------------------------------
// Clean clipboard HTML down to a strict whitelist before it's inserted, so a
// formatted paste can carry over real structure (headings, lists, tables, code
// blocks, our toggles/checklists/link-chips) WITHOUT letting scripts, unknown
// tags, or Word/Google-Docs cruft corrupt the doc. Anything not on the list is
// unwrapped (its text survives); comments and disallowed attributes are dropped.
const PASTE_TAGS = new Set([
  'P', 'BR', 'H1', 'H2', 'H3', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE', 'SPAN', 'FONT',
  'A', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'HR', 'IMG', 'TABLE', 'THEAD', 'TBODY',
  'TR', 'TH', 'TD', 'DETAILS', 'SUMMARY', 'DIV',
]);
const PASTE_CLASSES = new Set([
  'doc-table', 'doc-tasks', 'doc-task', 'doc-toggle', 'doc-toggle-head', 'doc-toggle-body', 'doc-ref',
]);
const PASTE_STYLE_PROPS = [
  'font-size', 'color', 'background-color', 'font-weight', 'font-style', 'text-decoration', 'text-align', 'width',
];

function cleanPasteNode(node: Node): Node[] {
  if (node.nodeType === Node.TEXT_NODE) return [document.createTextNode(node.nodeValue ?? '')];
  if (node.nodeType !== Node.ELEMENT_NODE) return []; // drop comments / others
  const el = node as HTMLElement;
  const kids = Array.from(el.childNodes).flatMap(cleanPasteNode);
  if (!PASTE_TAGS.has(el.tagName)) return kids; // unwrap unknown tag, keep contents

  const out = document.createElement(el.tagName.toLowerCase());
  const tag = el.tagName;
  const keepAttr = (name: string, value: string) => out.setAttribute(name, value);

  if (tag === 'A') {
    const href = el.getAttribute('href') || '';
    if (href && !/^\s*javascript:/i.test(href)) keepAttr('href', href);
    const id = el.getAttribute('data-doc-id');
    if (id) keepAttr('data-doc-id', id);
    if (el.classList.contains('doc-ref')) out.setAttribute('contenteditable', 'false');
  } else if (tag === 'IMG') {
    const src = el.getAttribute('src') || '';
    if (/^(https?:|data:image\/)/i.test(src)) keepAttr('src', src);
    const alt = el.getAttribute('alt');
    if (alt) keepAttr('alt', alt);
  } else if (tag === 'DETAILS') {
    out.setAttribute('open', ''); // always paste toggles open so content is visible
  } else if (tag === 'LI') {
    const checked = el.getAttribute('data-checked');
    if (checked != null) keepAttr('data-checked', checked);
  } else if (tag === 'FONT') {
    const color = el.getAttribute('color');
    if (color) keepAttr('color', color);
  }

  // Keep only whitelisted classes.
  const classes = Array.from(el.classList).filter((c) => PASTE_CLASSES.has(c));
  if (classes.length) out.className = classes.join(' ');

  // Keep only safe inline style props (text formatting + image width).
  const style = PASTE_STYLE_PROPS.map((p) => {
    const v = el.style.getPropertyValue(p);
    return v ? `${p}: ${v}` : '';
  }).filter(Boolean);
  if (style.length) out.setAttribute('style', style.join('; '));

  kids.forEach((k) => out.appendChild(k));
  return [out];
}

// Flatten stored HTML to a short one-line preview (used in the history list).
function htmlToPreview(html: string): string {
  const d = document.createElement('div');
  d.innerHTML = html;
  const text = (d.textContent || '').replace(/\s+/g, ' ').trim();
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

function sanitizeDocHtml(html: string): string {
  // Strip anything outside <body>, plus style/script blocks, up front.
  const tmpl = document.createElement('template');
  tmpl.innerHTML = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
  const container = document.createElement('div');
  Array.from(tmpl.content.childNodes)
    .flatMap(cleanPasteNode)
    .forEach((n) => container.appendChild(n));
  return container.innerHTML;
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

function TextBtn({
  onClick,
  title,
  danger,
  children,
}: {
  onClick: () => void;
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={`h-8 px-2 grid place-items-center rounded-lg text-[12px] font-semibold transition ${
        danger ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-400/10' : 'ink-text-muted hover:ink-text hover:bg-stone-100'
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="w-px h-5 bg-black/10 mx-1" />;
}

// Picker for the "Link a page" menu. Two levels so long libraries stay navigable:
//   1. a list of notebooks (with page counts + accent colour), then
//   2. the pages inside the notebook you open — with a "Back to notebooks" row.
// Typing in the search box cuts across every notebook at once (grouped results), so
// you can still find a page without knowing which notebook it lives in. Excludes the
// current page so you can't self-link; onMouseDown is prevented so the caret stays put.
function DocRefPicker({
  docs,
  currentId,
  onPick,
  onNew,
}: {
  docs: VisionDoc[];
  currentId: string;
  onPick: (id: string) => void;
  onNew?: () => void;
}) {
  const [q, setQ] = useState('');
  // Which notebook is open in the drill-down (null ⇒ showing the notebook list).
  const [book, setBook] = useState<string | null>(null);
  const query = q.trim().toLowerCase();

  // Every page you could link to, grouped by notebook.
  const linkable = docs.filter((d) => d.id !== currentId && !isInline(d));
  const byBook = new Map<string, VisionDoc[]>();
  linkable.forEach((d) => {
    const b = bookOf(d);
    (byBook.get(b) ?? byBook.set(b, []).get(b)!).push(d);
  });
  // Notebooks that actually hold a linkable page — Planner first, then alphabetical.
  const books = Array.from(byBook.keys()).sort((a, b) =>
    a === PLANNER ? -1 : b === PLANNER ? 1 : a.localeCompare(b)
  );
  const accentOf = (b: string) => byBook.get(b)?.find((d) => d.color)?.color || '#0ea5e9';

  // Flat, cross-notebook matches while searching.
  const searchHits = query
    ? linkable.filter(
        (d) => (d.title || 'Untitled').toLowerCase().includes(query) || bookOf(d).toLowerCase().includes(query)
      )
    : [];
  const hitsByBook = new Map<string, VisionDoc[]>();
  searchHits.forEach((d) => {
    const b = bookOf(d);
    (hitsByBook.get(b) ?? hitsByBook.set(b, []).get(b)!).push(d);
  });
  const hitBooks = Array.from(hitsByBook.keys()).sort((a, b) =>
    a === PLANNER ? -1 : b === PLANNER ? 1 : a.localeCompare(b)
  );

  const pageRow = (d: VisionDoc) => (
    <button
      key={d.id}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(d.id)}
      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] ink-text hover:bg-stone-100 dark:hover:bg-white/10 transition text-left"
    >
      <span className="w-2 h-2 rounded-full flex-none" style={{ background: d.color || '#0ea5e9' }} />
      <span className="truncate">{d.title || 'Untitled'}</span>
    </button>
  );

  return (
    <div className="w-[260px] max-w-[calc(100vw-1.5rem)]">
      {onNew && (
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={onNew}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] font-semibold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-400/10 transition text-left"
        >
          <Plus className="w-4 h-4 flex-none" /> New inline page
        </button>
      )}
      {onNew && <div className="px-2.5 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider ink-text-muted/70">Or link an existing page</div>}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onMouseDown={(e) => e.stopPropagation()}
        placeholder="Search all pages…"
        className="mt-1 mb-1 w-full text-[13px] ink-text bg-white dark:bg-paper rounded-lg border border-black/10 dark:border-white/[0.2] px-2.5 py-1.5 outline-none focus:border-amber-400"
      />
      <div className="max-h-[240px] overflow-y-auto pr-0.5">
        {query ? (
          /* ── Search: flat results across every notebook ── */
          searchHits.length === 0 ? (
            <div className="px-2.5 py-4 text-[12px] ink-text-muted/70 text-center">No pages found.</div>
          ) : (
            hitBooks.map((b) => (
              <div key={b} className="mb-1">
                <div className="px-2.5 pt-1.5 pb-0.5 text-[10px] font-bold uppercase tracking-wider ink-text-muted/70">{b}</div>
                {hitsByBook.get(b)!.map(pageRow)}
              </div>
            ))
          )
        ) : book === null ? (
          /* ── Level 1: choose a notebook ── */
          books.length === 0 ? (
            <div className="px-2.5 py-4 text-[12px] ink-text-muted/70 text-center">No other pages to link yet.</div>
          ) : (
            books.map((b) => {
              const pages = byBook.get(b)!;
              return (
                <button
                  key={b}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setBook(b)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] ink-text hover:bg-stone-100 dark:hover:bg-white/10 transition text-left"
                >
                  <span className="w-2.5 h-2.5 rounded-sm flex-none" style={{ background: accentOf(b) }} />
                  <span className="truncate flex-1 font-medium">{b}</span>
                  <span className="text-[11px] ink-text-muted/70 flex-none tabular-nums">{pages.length}</span>
                  <ChevronRight className="w-4 h-4 flex-none ink-text-muted/70" />
                </button>
              );
            })
          )
        ) : (
          /* ── Level 2: pages inside the chosen notebook ── */
          <>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setBook(null)}
              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 mb-0.5 rounded-lg text-[12px] font-semibold ink-text-muted hover:ink-text hover:bg-stone-100 dark:hover:bg-white/10 transition text-left"
            >
              <ChevronLeft className="w-4 h-4 flex-none" /> Notebooks
            </button>
            <div className="flex items-center gap-2 px-2.5 pt-1 pb-1">
              <span className="w-2.5 h-2.5 rounded-sm flex-none" style={{ background: accentOf(book) }} />
              <span className="truncate text-[13px] font-bold ink-text">{book}</span>
            </div>
            {(byBook.get(book) ?? []).length === 0 ? (
              <div className="px-2.5 py-4 text-[12px] ink-text-muted/70 text-center">No pages in this notebook.</div>
            ) : (
              byBook.get(book)!.map(pageRow)
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Menu({
  open,
  onToggle,
  title,
  icon,
  wide,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  icon: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative" data-menu-root>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={onToggle}
        title={title}
        className={`h-8 px-1.5 grid grid-flow-col place-items-center rounded-lg transition ${
          open ? 'ink-text bg-stone-100' : 'ink-text-muted hover:ink-text hover:bg-stone-100'
        }`}
      >
        {icon}
      </button>
      {open && (
        <div
          className={`absolute top-full left-0 mt-1 z-20 paper-card rounded-xl border border-black/10 dark:border-white/[0.2] shadow-xl p-1.5 ${
            wide ? '' : 'min-w-[150px]'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function Swatches({ colors, onPick, cols = 4 }: { colors: string[]; onPick: (c: string) => void; cols?: number }) {
  return (
    // Fixed-size tracks (not 1fr) so swatches never squeeze together / overflow the
    // popover. The grid sizes itself to the columns; the menu wraps around it.
    <div className="grid gap-1.5 p-1 w-max" style={{ gridTemplateColumns: `repeat(${cols}, 1.5rem)` }}>
      {colors.map((c) => (
        <button
          key={c}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(c)}
          className="w-6 h-6 rounded-md border border-black/10 dark:border-white/[0.2] transition-transform hover:scale-110"
          style={{ background: c }}
          title={c}
        />
      ))}
    </div>
  );
}

function TableSizePicker({ onPick }: { onPick: (rows: number, cols: number) => void }) {
  const [hover, setHover] = useState({ r: 0, c: 0 });
  const MAX_R = 6;
  const MAX_C = 6;
  return (
    <div className="p-1" onMouseLeave={() => setHover({ r: 0, c: 0 })}>
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${MAX_C}, 1fr)` }}>
        {Array.from({ length: MAX_R * MAX_C }).map((_, i) => {
          const r = Math.floor(i / MAX_C) + 1;
          const c = (i % MAX_C) + 1;
          const on = r <= hover.r && c <= hover.c;
          return (
            <button
              key={i}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHover({ r, c })}
              onClick={() => onPick(hover.r || r, hover.c || c)}
              className={`w-4 h-4 rounded-sm border ${on ? 'bg-amber-400 border-amber-500' : 'bg-white dark:bg-paper border-stone-300'}`}
            />
          );
        })}
      </div>
      <div className="text-center text-[11px] ink-text-muted mt-1.5">
        {hover.r || 0} × {hover.c || 0} table
      </div>
    </div>
  );
}
