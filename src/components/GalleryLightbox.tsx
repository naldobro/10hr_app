import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';
import { galleryItems, refreshGalleryMeta, syncNoteEmpty } from '../lib/docGallery';

// Full-screen viewer for a doc gallery. It edits the gallery's DOM directly (the
// doc HTML is the source of truth) and calls onEdited so the editor saves +
// records an undo step.
export default function GalleryLightbox({
  gallery,
  startItem,
  onClose,
  onEdited,
}: {
  gallery: HTMLElement;
  startItem: HTMLElement;
  onClose: () => void;
  onEdited: () => void;
}) {
  const [item, setItem] = useState<HTMLElement>(startItem);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const [note, setNote] = useState('');
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const items = galleryItems(gallery, true);
  const idx = Math.max(0, items.indexOf(item));
  const img = item.querySelector('img');
  const caption = item.querySelector('figcaption.doc-gal-note') as HTMLElement | null;
  const picked = item.dataset.picked === 'true';
  const pickedCount = galleryItems(gallery).filter((f) => f.dataset.picked === 'true').length;
  const title = (gallery.querySelector('.doc-gal-title')?.textContent || 'Gallery').trim() || 'Gallery';

  // Load the note text when the shown image changes.
  useEffect(() => {
    setNote(caption?.innerText.replace(/\n$/, '') ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  // Close if the gallery/image vanished (undo, other edits).
  useEffect(() => {
    if (!gallery.isConnected) onClose();
  });

  const go = (d: number) => {
    const list = galleryItems(gallery, true);
    if (list.length === 0) return onClose();
    const i = list.indexOf(item);
    setItem(list[(i + d + list.length) % list.length]);
  };

  const togglePick = () => {
    item.dataset.picked = picked ? 'false' : 'true';
    refreshGalleryMeta(gallery);
    onEdited();
    rerender();
  };

  const remove = () => {
    const list = galleryItems(gallery, true);
    const i = list.indexOf(item);
    const next = list[i + 1] ?? list[i - 1] ?? null;
    item.remove();
    refreshGalleryMeta(gallery);
    onEdited();
    if (next) setItem(next);
    else onClose();
  };

  const writeNote = (v: string) => {
    setNote(v);
    if (!caption) return;
    caption.textContent = '';
    v.split('\n').forEach((line, i) => {
      if (i > 0) caption.appendChild(document.createElement('br'));
      if (line) caption.appendChild(document.createTextNode(line));
    });
    syncNoteEmpty(caption);
    onEdited();
  };

  // Keyboard: ←/→ browse, P pick, Esc close. Capture phase so the planner's own
  // Escape-to-close doesn't also fire.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = document.activeElement === noteRef.current;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (typing) noteRef.current?.blur();
        else onClose();
        return;
      }
      if (typing) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); go(-1); }
      else if (e.key.toLowerCase() === 'p' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); togglePick(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  // Swipe on touch screens.
  const touchX = useRef<number | null>(null);

  return createPortal(
    <div className="fixed inset-0 z-[97] flex flex-col bg-black/90 backdrop-blur-sm" onClick={onClose}>
      {/* top bar */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <div className="text-[14px] font-bold truncate">{title}</div>
          <div className="text-[12px] text-white/55">
            {idx + 1} / {items.length}
            {pickedCount > 0 && ` · ${pickedCount} picked`}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={togglePick}
            title="Pick / unpick (P)"
            className={`h-9 px-3.5 rounded-full text-[13px] font-semibold flex items-center gap-1.5 border transition ${
              picked
                ? 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_18px_rgba(16,185,129,.55)]'
                : 'border-white/30 text-white/85 hover:bg-white/10'
            }`}
          >
            <Check className="w-4 h-4" />
            {picked ? 'Picked' : 'Pick'}
          </button>
          <button
            onClick={remove}
            title="Remove image"
            className="w-9 h-9 rounded-full flex items-center justify-center border border-white/20 text-white/70 hover:bg-red-600 hover:border-red-500 hover:text-white transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="w-9 h-9 rounded-full flex items-center justify-center border border-white/20 text-white/80 hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* image */}
      <div
        className="relative flex-1 min-h-0 flex items-center justify-center px-3 sm:px-16"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        }}
      >
        {img && (
          <img
            key={img.src}
            src={img.src}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className={`max-w-full max-h-full object-contain rounded-xl select-none transition-shadow ${
              picked ? 'ring-2 ring-emerald-400 shadow-[0_0_40px_rgba(16,185,129,.35)]' : ''
            }`}
            draggable={false}
          />
        )}
        {items.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); go(-1); }}
              title="Previous (←)"
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); go(1); }}
              title="Next (→)"
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {/* note + filmstrip */}
      <div className="px-4 sm:px-6 pt-3 pb-4 flex flex-col gap-3 items-center" onClick={(e) => e.stopPropagation()}>
        <textarea
          ref={noteRef}
          value={note}
          onChange={(e) => writeNote(e.target.value)}
          placeholder="Add a note for this image…"
          rows={2}
          className="w-full max-w-2xl resize-none rounded-xl bg-white/[0.07] border border-white/15 focus:border-white/40 outline-none px-3.5 py-2.5 text-[14px] text-white placeholder:text-white/35"
        />
        {items.length > 1 && (
          <div className="flex gap-2 overflow-x-auto max-w-full pb-1">
            {items.map((f, i) => {
              const src = f.querySelector('img')?.src;
              const on = f === item;
              return (
                <button
                  key={i}
                  onClick={() => setItem(f)}
                  className={`relative flex-none w-12 h-16 rounded-lg overflow-hidden border-2 transition ${
                    on ? 'border-white' : 'border-transparent opacity-55 hover:opacity-100'
                  }`}
                >
                  {src && <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />}
                  {f.dataset.picked === 'true' && (
                    <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
