// Image gallery block for planner docs.
//
// A gallery lives INSIDE the doc HTML (so it saves, syncs, snapshots and undoes
// with everything else) as a non-editable island with editable islands inside it:
//
//   <div class="doc-gallery" contenteditable="false" data-cols="3" [data-filter="picked"]>
//     <div class="doc-gal-bar">
//       <span class="doc-gal-title" contenteditable="true">Gallery</span>
//       <span class="doc-gal-meta">…counts…</span>
//       <span class="doc-gal-actions">…buttons (data-g="…")…</span>
//     </div>
//     <div class="doc-gal-grid">
//       <figure class="doc-gal-item" data-picked="false">
//         <div class="doc-gal-media" draggable="true"><img src="…"></div>
//         <span class="doc-gal-ctl doc-gal-pick" data-g="pick">✓</span>
//         <span class="doc-gal-ctl doc-gal-del" data-g="del">×</span>
//         <figcaption class="doc-gal-note" contenteditable="true">note…</figcaption>
//       </figure>
//       …
//       <div class="doc-gal-add" data-g="add">+ Add images</div>
//     </div>
//   </div>
//
// Only the data (images, notes, picked flags, title, cols, filter) matters; the
// chrome (buttons, counts, add tile) is rebuilt by hydrateGalleries() on load, so
// the design can change later without migrating saved docs.

const svg = (body: string, size = 14) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const ICON = {
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  x: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  plus: svg('<path d="M5 12h14"/><path d="M12 5v14"/>'),
  plusBig: svg('<path d="M5 12h14"/><path d="M12 5v14"/>', 22),
  grid: svg('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'),
  filter: svg('<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>'),
  trash: svg('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>'),
  expand: svg('<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>', 13),
};

export const GALLERY_COLS = [2, 3, 4, 5];

const el = (tag: string, cls?: string, html?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

export const isGallery = (n: Element | null): n is HTMLElement => !!n && n.classList.contains('doc-gallery');

export const galleryOf = (n: Node | null): HTMLElement | null => {
  const e = n && (n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement);
  return (e?.closest('.doc-gallery') as HTMLElement | null) ?? null;
};

export const galleryItems = (g: HTMLElement, visibleOnly = false): HTMLElement[] => {
  const all = Array.from(g.querySelectorAll<HTMLElement>(':scope > .doc-gal-grid > figure.doc-gal-item'));
  if (!visibleOnly || g.dataset.filter !== 'picked') return all;
  return all.filter((f) => f.dataset.picked === 'true');
};

/** Build a fresh, empty gallery (chrome included). */
export function createGallery(title = 'Gallery'): HTMLElement {
  const g = el('div', 'doc-gallery');
  g.dataset.cols = '3';
  const bar = el('div', 'doc-gal-bar');
  const t = el('span', 'doc-gal-title');
  t.textContent = title;
  bar.appendChild(t);
  g.appendChild(bar);
  g.appendChild(el('div', 'doc-gal-grid'));
  hydrateGallery(g);
  return g;
}

/** A new item tile. `pending` marks it as still uploading (never persisted). */
export function createGalleryItem(src: string, pending = false): HTMLElement {
  const f = el('figure', 'doc-gal-item');
  f.dataset.picked = 'false';
  if (pending) f.dataset.pending = '1';
  const media = el('div', 'doc-gal-media');
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  media.appendChild(img);
  f.appendChild(media);
  f.appendChild(el('figcaption', 'doc-gal-note'));
  hydrateItem(f);
  return f;
}

function hydrateItem(f: HTMLElement) {
  if (f.dataset.picked !== 'true') f.dataset.picked = 'false';
  let media = f.querySelector(':scope > .doc-gal-media') as HTMLElement | null;
  const img = f.querySelector('img');
  if (!media) {
    media = el('div', 'doc-gal-media');
    if (img) media.appendChild(img);
    f.insertBefore(media, f.firstChild);
  }
  media.setAttribute('draggable', 'true');
  media.setAttribute('title', 'Click to view · drag to reorder');
  img?.setAttribute('draggable', 'false');
  // chrome: rebuilt every load
  f.querySelectorAll(':scope > .doc-gal-ctl').forEach((n) => n.remove());
  const pick = el('span', 'doc-gal-ctl doc-gal-pick', ICON.check);
  pick.dataset.g = 'pick';
  pick.title = 'Pick / unpick';
  const del = el('span', 'doc-gal-ctl doc-gal-del', ICON.x);
  del.dataset.g = 'del';
  del.title = 'Remove image';
  const open = el('span', 'doc-gal-ctl doc-gal-open', ICON.expand);
  open.dataset.g = 'open';
  open.title = 'View large';
  f.insertBefore(pick, media.nextSibling);
  f.insertBefore(del, pick.nextSibling);
  f.insertBefore(open, del.nextSibling);
  let note = f.querySelector(':scope > figcaption.doc-gal-note') as HTMLElement | null;
  if (!note) {
    note = el('figcaption', 'doc-gal-note');
    f.appendChild(note);
  }
  note.setAttribute('contenteditable', 'true');
  note.setAttribute('data-placeholder', 'Add a note…');
  syncNoteEmpty(note);
}

export function syncNoteEmpty(note: HTMLElement) {
  note.dataset.empty = (note.textContent ?? '').trim() ? 'false' : 'true';
}

/** (Re)build a gallery's chrome around its saved data. Idempotent. */
export function hydrateGallery(g: HTMLElement) {
  g.setAttribute('contenteditable', 'false');
  if (!GALLERY_COLS.includes(Number(g.dataset.cols))) g.dataset.cols = '3';

  let bar = g.querySelector(':scope > .doc-gal-bar') as HTMLElement | null;
  if (!bar) {
    bar = el('div', 'doc-gal-bar');
    g.insertBefore(bar, g.firstChild);
  }
  let title = bar.querySelector(':scope > .doc-gal-title') as HTMLElement | null;
  if (!title) {
    title = el('span', 'doc-gal-title');
    title.textContent = 'Gallery';
  }
  title.setAttribute('contenteditable', 'true');
  title.setAttribute('data-placeholder', 'Gallery');
  bar.innerHTML = '';
  bar.appendChild(title);
  bar.appendChild(el('span', 'doc-gal-meta'));
  const actions = el('span', 'doc-gal-actions');
  const btn = (g_: string, icon: string, label: string, tip: string) => {
    const b = el('span', 'doc-gal-btn', `${icon}<span>${label}</span>`);
    b.dataset.g = g_;
    b.title = tip;
    return b;
  };
  actions.appendChild(btn('filter', ICON.filter, 'Picked', 'Show only picked images'));
  actions.appendChild(btn('cols', ICON.grid, '', 'Change grid size'));
  actions.appendChild(btn('add', ICON.plus, 'Add', 'Add images'));
  actions.appendChild(btn('remove', ICON.trash, '', 'Delete this gallery'));
  bar.appendChild(actions);

  let grid = g.querySelector(':scope > .doc-gal-grid') as HTMLElement | null;
  if (!grid) {
    grid = el('div', 'doc-gal-grid');
    g.appendChild(grid);
  }
  // Anything stray in the island (not bar/grid) is dropped.
  Array.from(g.children).forEach((c) => {
    if (c !== bar && c !== grid) c.remove();
  });
  grid.querySelectorAll(':scope > .doc-gal-add').forEach((n) => n.remove());
  Array.from(grid.children).forEach((c) => {
    const f = c as HTMLElement;
    // An upload that never finished (app closed mid-upload) or a tile with no image.
    if (!f.matches('figure.doc-gal-item') || f.dataset.pending || !f.querySelector('img[src]')) f.remove();
    else hydrateItem(f);
  });
  const add = el('div', 'doc-gal-add', `${ICON.plusBig}<span>Add images</span><small>or drop / paste them here</small>`);
  add.dataset.g = 'add';
  grid.appendChild(add);
  refreshGalleryMeta(g);
}

export function hydrateGalleries(host: HTMLElement) {
  host.querySelectorAll<HTMLElement>('.doc-gallery').forEach(hydrateGallery);
}

/** Update the count line + filter button state. Cheap; safe on every keystroke. */
export function refreshGalleryMeta(g: HTMLElement) {
  const items = galleryItems(g);
  const picked = items.filter((f) => f.dataset.picked === 'true').length;
  const meta = g.querySelector(':scope > .doc-gal-bar > .doc-gal-meta');
  const text =
    items.length === 0
      ? 'No images yet'
      : `${items.length} image${items.length === 1 ? '' : 's'}${picked ? ` · ${picked} picked` : ''}`;
  if (meta && meta.textContent !== text) meta.textContent = text;
  const filterBtn = g.querySelector('[data-g="filter"]');
  filterBtn?.classList.toggle('is-on', g.dataset.filter === 'picked');
  g.dataset.count = String(items.length);
  g.querySelectorAll<HTMLElement>('figcaption.doc-gal-note').forEach(syncNoteEmpty);
}

export function refreshAllGalleryMeta(host: HTMLElement | null) {
  host?.querySelectorAll<HTMLElement>('.doc-gallery').forEach(refreshGalleryMeta);
}

/** Saved HTML minus tiles still uploading (their blob: URLs would be dead links). */
export function stripPending(host: HTMLElement | null): string {
  if (!host) return '';
  if (!host.querySelector('[data-pending]')) return host.innerHTML;
  const clone = host.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[data-pending]').forEach((n) => n.remove());
  return clone.innerHTML;
}

export const DOC_GALLERY_CSS = `
  .doc-body .doc-gallery {
    --ga: #10b981;
    margin: .8em 0; padding: .7rem; border-radius: 1rem;
    border: 1px solid rgba(120,113,108,.22); background: rgba(250,250,249,.7);
    user-select: none; -webkit-user-select: none;
  }
  .dark .doc-body .doc-gallery { border-color: rgba(255,255,255,.16); background: rgba(255,255,255,.025); }
  .doc-body .doc-gallery.is-drop { border-color: var(--ga); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ga) 25%, transparent); }

  .doc-body .doc-gal-bar { display: flex; align-items: center; gap: .6rem; margin: 0 .15rem .6rem; flex-wrap: wrap; }
  .doc-body .doc-gal-title {
    font-weight: 700; font-size: 1.02em; outline: none; min-width: 3ch; cursor: text;
    user-select: text; -webkit-user-select: text;
  }
  .doc-body .doc-gal-title:empty::before { content: attr(data-placeholder); color: #a8a29e; }
  .doc-body .doc-gal-meta { font-size: .78em; color: #a8a29e; font-weight: 500; }
  .doc-body .doc-gal-actions { margin-left: auto; display: flex; gap: .25rem; }
  .doc-body .doc-gal-btn {
    display: inline-flex; align-items: center; gap: .3em; height: 1.9rem; padding: 0 .55rem;
    border-radius: .6rem; font-size: .76em; font-weight: 600; color: #78716c; cursor: pointer;
    border: 1px solid transparent; transition: background .15s, color .15s, border-color .15s;
  }
  .doc-body .doc-gal-btn:hover { background: rgba(0,0,0,.05); color: #1c1917; }
  .dark .doc-body .doc-gal-btn { color: #a8a29e; }
  .dark .doc-body .doc-gal-btn:hover { background: rgba(255,255,255,.08); color: #fff; }
  .doc-body .doc-gal-btn.is-on { color: var(--ga); border-color: color-mix(in srgb, var(--ga) 45%, transparent); background: color-mix(in srgb, var(--ga) 10%, transparent); }
  .doc-body .doc-gal-btn[data-armed="1"] { color: #fff; background: #dc2626; }
  .doc-body .doc-gal-btn[data-armed="1"]::after { content: 'Delete?'; }
  .doc-body .doc-gal-btn span:empty { display: none; }

  .doc-body .doc-gal-grid { display: grid; gap: .7rem; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .doc-body .doc-gallery[data-cols="2"] .doc-gal-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .doc-body .doc-gallery[data-cols="4"] .doc-gal-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .doc-body .doc-gallery[data-cols="5"] .doc-gal-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  @media (max-width: 640px) {
    .doc-body .doc-gallery .doc-gal-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  }

  .doc-body figure.doc-gal-item {
    position: relative; margin: 0; display: flex; flex-direction: column; min-width: 0;
    border-radius: .8rem; background: #fff; border: 1px solid rgba(120,113,108,.18);
    overflow: hidden; transition: border-color .15s, box-shadow .15s, transform .15s, opacity .15s;
  }
  .dark .doc-body figure.doc-gal-item { background: #0a0a0a; border-color: rgba(255,255,255,.14); }
  .doc-body figure.doc-gal-item:hover { border-color: rgba(120,113,108,.4); }
  .dark .doc-body figure.doc-gal-item:hover { border-color: rgba(255,255,255,.3); }
  .doc-body figure.doc-gal-item[data-picked="true"] {
    border-color: var(--ga); box-shadow: 0 0 0 2px var(--ga);
  }
  .dark .doc-body figure.doc-gal-item[data-picked="true"] {
    box-shadow: 0 0 0 2px var(--ga), 0 0 18px color-mix(in srgb, var(--ga) 45%, transparent);
  }
  .doc-body .doc-gallery[data-filter="picked"] figure.doc-gal-item[data-picked="false"] { display: none; }
  .doc-body figure.doc-gal-item.is-dragging { opacity: .35; }
  .doc-body figure.doc-gal-item.drop-before { box-shadow: -4px 0 0 0 var(--ga); }
  .doc-body figure.doc-gal-item.drop-after { box-shadow: 4px 0 0 0 var(--ga); }
  .doc-body figure.doc-gal-item[data-pending] .doc-gal-media { animation: docGalPulse 1.1s ease-in-out infinite; }
  .doc-body figure.doc-gal-item[data-pending] .doc-gal-media img { opacity: .55; filter: blur(1px); }
  @keyframes docGalPulse { 50% { opacity: .6; } }

  .doc-body .doc-gal-media { aspect-ratio: 3 / 4; background: rgba(120,113,108,.1); cursor: zoom-in; overflow: hidden; }
  .doc-body .doc-gal-media img {
    width: 100%; height: 100%; max-width: none; object-fit: cover; margin: 0; border-radius: 0; display: block;
    transition: transform .35s ease;
  }
  .doc-body figure.doc-gal-item:hover .doc-gal-media img { transform: scale(1.03); }

  .doc-body .doc-gal-ctl {
    position: absolute; top: .45rem; width: 1.75rem; height: 1.75rem; border-radius: 999px;
    display: flex; align-items: center; justify-content: center; cursor: pointer;
    background: rgba(0,0,0,.45); color: #fff; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    border: 1px solid rgba(255,255,255,.35); opacity: 0; transition: opacity .15s, background .15s, transform .15s;
  }
  .doc-body .doc-gal-ctl:hover { transform: scale(1.08); }
  .doc-body .doc-gal-pick { left: .45rem; }
  .doc-body .doc-gal-del { right: .45rem; }
  .doc-body .doc-gal-del:hover { background: #dc2626; }
  .doc-body .doc-gal-open { right: 2.55rem; }
  .doc-body figure.doc-gal-item:hover .doc-gal-ctl { opacity: 1; }
  .doc-body figure.doc-gal-item[data-picked="true"] .doc-gal-pick { opacity: 1; background: var(--ga); border-color: var(--ga); }
  @media (hover: none) { .doc-body .doc-gal-ctl { opacity: 1; } }

  .doc-body figcaption.doc-gal-note {
    padding: .45rem .6rem .55rem; font-size: .82em; line-height: 1.45; min-height: 2.2em; outline: none;
    cursor: text; user-select: text; -webkit-user-select: text; word-break: break-word;
  }
  .doc-body figcaption.doc-gal-note:focus { background: rgba(120,113,108,.07); }
  .doc-body figcaption.doc-gal-note[data-empty="true"]::before { content: attr(data-placeholder); color: #a8a29e; pointer-events: none; }
  .doc-body figcaption.doc-gal-note[data-empty="true"]:focus::before { content: ''; }

  .doc-body .doc-gal-add {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .3rem;
    min-height: 9rem; border-radius: .8rem; border: 1.5px dashed rgba(120,113,108,.35);
    color: #a8a29e; cursor: pointer; font-size: .8em; font-weight: 600; text-align: center; padding: .8rem;
    transition: border-color .15s, color .15s, background .15s;
  }
  .doc-body .doc-gal-add small { font-weight: 500; font-size: .85em; opacity: .75; }
  .doc-body .doc-gal-add:hover { border-color: var(--ga); color: var(--ga); background: color-mix(in srgb, var(--ga) 6%, transparent); }
  .dark .doc-body .doc-gal-add { border-color: rgba(255,255,255,.2); }
  .doc-body .doc-gallery[data-count="0"] .doc-gal-add { grid-column: 1 / -1; min-height: 11rem; }
  .doc-body .doc-gallery[data-filter="picked"] .doc-gal-add { display: none; }

  /* read-only previews (e.g. Strategist today card): no chrome, no editing */
  .doc-readonly .doc-gal-ctl, .doc-readonly .doc-gal-actions, .doc-readonly .doc-gal-add { display: none !important; }
  .doc-readonly [contenteditable] { pointer-events: none; }
  .doc-readonly figcaption.doc-gal-note[data-empty="true"] { display: none; }
`;
