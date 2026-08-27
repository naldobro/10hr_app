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
  Pencil,
  GripVertical,
  BookOpen,
  CalendarDays,
  RotateCcw,
} from 'lucide-react';
import { VisionDoc } from '../types';
import { GOAL_COLORS } from '../lib/visionUtils';

interface PlannerPanelProps {
  docs: VisionDoc[];
  /** Soft-deleted docs, available to restore or remove for good. */
  trashDocs: VisionDoc[];
  /** Per-notebook accent colour + sort order for the gallery, keyed by name. */
  notebookMeta: Record<string, { color?: string; order?: number }>;
  onNotebookMetaChange: (next: Record<string, { color?: string; order?: number }>) => void;
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

// Quick presets ------------------------------------------------------------
const FONT_SIZES: { label: string; size: string; px: string }[] = [
  { label: 'Small', size: '2', px: '13px' },
  { label: 'Normal', size: '3', px: '15px' },
  { label: 'Large', size: '5', px: '20px' },
  { label: 'Huge', size: '7', px: '28px' },
];
// Accent colours offered for notebook cards in the gallery.
const NOTEBOOK_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#78716c',
];
const TEXT_COLORS = [
  '#1c1917', '#44403c', '#78716c', '#a8a29e', // neutrals
  '#e11d48', '#f43f5e', '#ec4899', '#d946ef', // reds / pinks
  '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', // purples / blues
  '#2563eb', '#0ea5e9', '#06b6d4', '#14b8a6', // blues / cyans
  '#10b981', '#22c55e', '#84cc16', '#eab308', // greens / lime
  '#f59e0b', '#f97316', '#ea580c', '#dc2626', // ambers / oranges / red
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
  const [renamingNb, setRenamingNb] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

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
      if (!(e.target as HTMLElement).closest('[data-color-menu]')) setColorMenuNb(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [colorMenuNb]);

  const isMonthly = notebook === PLANNER;

  // Pages in the active notebook (a missing notebook value means the built-in Planner).
  const nbDocs = useMemo(() => docs.filter((d) => bookOf(d) === notebook), [docs, notebook]);

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
        const pages = docs.filter((d) => bookOf(d) === n);
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

  const setNotebookColor = (name: string, color: string) => {
    onNotebookMetaChange({ ...notebookMeta, [name]: { ...notebookMeta[name], color } });
    setColorMenuNb(null);
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
  const months = useMemo(() => {
    const set = new Set<string>([currentMonth]);
    nbDocs.forEach((d) => set.add(d.month));
    return [...set].sort().reverse();
  }, [nbDocs, currentMonth]);

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
              {notebookCards.map((nb) => (
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
                      <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: nb.color }} />
                      <span
                        className="grid place-items-center w-9 h-9 rounded-xl mb-3"
                        style={{ background: `${nb.color}1e`, color: nb.color }}
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
                      <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: nb.color }} />
                      <span
                        className="grid place-items-center w-9 h-9 rounded-xl mb-3"
                        style={{ background: `${nb.color}1e`, color: nb.color }}
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
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg ink-text-muted hover:bg-stone-100 dark:hover:bg-white/10 transition"
                      >
                        <span className="block w-3.5 h-3.5 rounded-full border border-black/20" style={{ background: nb.color }} />
                      </button>
                      {colorMenuNb === nb.name && (
                        <div
                          data-color-menu
                          className="absolute right-0 top-full mt-1 z-30 w-[204px] paper-card rounded-xl border border-black/10 dark:border-white/[0.2] shadow-xl p-2 grid grid-cols-6 gap-1.5"
                        >
                          {NOTEBOOK_COLORS.map((c) => (
                            <button
                              key={c}
                              onClick={() => setNotebookColor(nb.name, c)}
                              className="w-6 h-6 rounded-md border border-black/10 dark:border-white/[0.2] transition-transform hover:scale-110"
                              style={{
                                background: c,
                                boxShadow: c === nb.color ? `0 0 0 2px #fff, 0 0 0 3.5px ${c}` : undefined,
                              }}
                              title={c}
                            />
                          ))}
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
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg ink-text-muted hover:ink-text hover:bg-stone-100 dark:hover:bg-white/10 transition"
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
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg ink-text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-400/10 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ))}
                  </div>
                </div>
              ))}

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
              months.map((m) => {
                const list = docsByMonth.get(m) ?? [];
                const dragActiveHere = !!dragDoc && bookOf(dragDoc) === PLANNER && dragDoc.month === m;
                return (
                  <div key={m} className="px-2 mb-1">
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className="text-[11px] tracking-wider uppercase font-bold ink-text-muted truncate">
                          {monthLabel(m)}
                        </span>
                        {m === currentMonth && (
                          <span className="text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-400/20 rounded-full px-1.5 py-0.5 leading-none flex-none">
                            NOW
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleAdd(m)}
                        className="p-1 rounded-md ink-text-muted hover:ink-text hover:bg-white/70 dark:hover:bg-paper/70 transition flex-none"
                        title={`New doc in ${monthLabel(m)}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {list.length === 0 ? (
                      <button
                        onClick={() => handleAdd(m)}
                        className="w-full text-left text-[12px] ink-text-muted/70 hover:ink-text px-2.5 py-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-paper/60 transition"
                      >
                        + Add the first doc
                      </button>
                    ) : (
                      list.map((d, i) => renderRow(d, list, i, dragActiveHere))
                    )}
                  </div>
                );
              })
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
  );
}

function DocEditor({
  doc,
  onChange,
  onDelete,
  onUploadImage,
}: {
  doc: VisionDoc;
  onChange: (patch: Partial<VisionDoc>, persist: boolean) => void;
  onDelete: () => void;
  onUploadImage?: (blob: Blob, contentType: string) => Promise<string>;
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
  const [menu, setMenu] = useState<null | 'size' | 'color' | 'hilite' | 'table'>(null);
  const [inTable, setInTable] = useState(false);
  const meta = useRef({ title: doc.title, color: doc.color || '#0ea5e9' });
  const saveTimer = useRef<number | undefined>(undefined);
  const savedTimer = useRef<number | undefined>(undefined);

  // Empty only when there's no text AND no block content (table/list/rule/image).
  const setEmpty = (el: HTMLDivElement | null) => {
    if (!el) return;
    const hasText = !!(el.textContent && el.textContent.trim());
    const hasBlocks = !!el.querySelector('table, hr, img, ul, ol');
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

  // Seed both editors once; keyed by doc.id in the parent so switching docs remounts.
  useEffect(() => {
    if (summaryRef.current) {
      summaryRef.current.innerHTML = doc.summary || '';
      setEmpty(summaryRef.current);
    }
    if (bodyRef.current) {
      bodyRef.current.innerHTML = doc.content || '';
      setEmpty(bodyRef.current);
    }
    return () => {
      // Flush any pending edit when leaving this doc.
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        onChange(snapshot(), true);
      }
      window.clearTimeout(savedTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track whether the caret sits inside a table, to enable row/column controls.
  useEffect(() => {
    const onSel = () => setInTable(!!getCell());
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
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
  const inEditors = () => {
    const n = window.getSelection()?.anchorNode ?? null;
    return !!n && (!!summaryRef.current?.contains(n) || !!bodyRef.current?.contains(n));
  };
  const ensureFocus = () => {
    if (inEditors()) return;
    const el = bodyRef.current;
    if (!el) return;
    el.focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
  };
  const getCell = (): HTMLTableCellElement | null => {
    const n = window.getSelection()?.anchorNode ?? null;
    if (!n) return null;
    if (!summaryRef.current?.contains(n) && !bodyRef.current?.contains(n)) return null;
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

  const insertChecklist = () => {
    ensureFocus();
    document.execCommand(
      'insertHTML',
      false,
      '<ul class="doc-tasks"><li class="doc-task" data-checked="false">&#8203;</li></ul>'
    );
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
    if (files.length === 0) return;
    e.preventDefault();
    void insertImageFiles(files);
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
  const tableOp = (op: 'addRow' | 'addCol' | 'delRow' | 'delCol') => {
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
    } else if (op === 'addCol') {
      rows.forEach((tr) => {
        const ref = tr.children[colIdx];
        const tag = ref?.tagName === 'TH' ? 'th' : 'td';
        const c = document.createElement(tag);
        c.innerHTML = '<br>';
        if (ref) ref.after(c);
        else tr.appendChild(c);
      });
    } else if (op === 'delRow') {
      if (rows.length <= 1) table.remove();
      else row.remove();
    } else if (op === 'delCol') {
      const cols = row.children.length;
      if (cols <= 1) {
        table.remove();
      } else {
        rows.forEach((tr) => tr.children[colIdx]?.remove());
      }
    }
    afterEdit();
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

      {/* toolbar */}
      <div className="px-6 sm:px-10 py-2 mt-1 flex items-center gap-0.5 flex-wrap border-b border-black/5 dark:border-white/[0.13]">
        <TB onClick={() => exec('bold')} title="Bold"><Bold className="w-4 h-4" /></TB>
        <TB onClick={() => exec('italic')} title="Italic"><Italic className="w-4 h-4" /></TB>
        <TB onClick={() => exec('underline')} title="Underline"><Underline className="w-4 h-4" /></TB>

        {/* font size preset */}
        <Menu
          open={menu === 'size'}
          onToggle={() => setMenu(menu === 'size' ? null : 'size')}
          title="Text size"
          icon={<><Type className="w-4 h-4" /><ChevronDown className="w-3 h-3 -ml-0.5" /></>}
        >
          {FONT_SIZES.map((f) => (
            <button
              key={f.size}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                execStyled('fontSize', f.size);
                setMenu(null);
              }}
              className="flex w-full items-center justify-between gap-4 px-3 py-1.5 rounded-md hover:bg-stone-100 text-left"
            >
              <span className="ink-text" style={{ fontSize: f.px, lineHeight: 1 }}>{f.label}</span>
            </button>
          ))}
        </Menu>

        {/* text color */}
        <Menu
          open={menu === 'color'}
          onToggle={() => setMenu(menu === 'color' ? null : 'color')}
          title="Text color"
          icon={<Baseline className="w-4 h-4" />}
        >
          <Swatches
            colors={TEXT_COLORS}
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
        <TB onClick={() => exec('formatBlock', '<h1>')} title="Heading 1"><Heading1 className="w-4 h-4" /></TB>
        <TB onClick={() => exec('formatBlock', '<h2>')} title="Heading 2"><Heading2 className="w-4 h-4" /></TB>
        <TB onClick={() => exec('formatBlock', '<blockquote>')} title="Quote"><Quote className="w-4 h-4" /></TB>

        <Sep />
        <TB onClick={() => exec('insertUnorderedList')} title="Bulleted list"><List className="w-4 h-4" /></TB>
        <TB onClick={() => exec('insertOrderedList')} title="Numbered list"><ListOrdered className="w-4 h-4" /></TB>
        <TB onClick={insertChecklist} title="Checklist (tick boxes)"><ListTodo className="w-4 h-4" /></TB>

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

        <Sep />
        <TB onClick={() => exec('justifyLeft')} title="Align left"><AlignLeft className="w-4 h-4" /></TB>
        <TB onClick={() => exec('justifyCenter')} title="Align center"><AlignCenter className="w-4 h-4" /></TB>
        <TB onClick={() => exec('justifyRight')} title="Align right"><AlignRight className="w-4 h-4" /></TB>

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

        {/* table row/column controls — only while the caret is inside a table */}
        {inTable && (
          <>
            <Sep />
            <TextBtn onClick={() => tableOp('addRow')} title="Add row below">+ Row</TextBtn>
            <TextBtn onClick={() => tableOp('addCol')} title="Add column right">+ Col</TextBtn>
            <TextBtn onClick={() => tableOp('delRow')} title="Delete this row" danger>− Row</TextBtn>
            <TextBtn onClick={() => tableOp('delCol')} title="Delete this column" danger>− Col</TextBtn>
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
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-10 py-5">
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
    </div>
  );

  // Toggle a checklist item when its tick box (the left ~26px) is clicked, or
  // select an image for resizing when the image itself is clicked.
  function onTaskClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      selectImage(target as HTMLImageElement);
      return;
    }
    const li = target.closest?.('li.doc-task') as HTMLElement | null;
    if (!li) return;
    if (e.clientX - li.getBoundingClientRect().left > 26) return;
    li.dataset.checked = li.dataset.checked === 'true' ? 'false' : 'true';
    scheduleSave();
  }
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

function Swatches({ colors, onPick }: { colors: string[]; onPick: (c: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1.5 p-1">
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
