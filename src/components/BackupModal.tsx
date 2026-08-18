import { useEffect, useRef, useState } from 'react';
import { X, Download, Upload, ShieldCheck, AlertTriangle } from 'lucide-react';
import { exportAll, downloadBackup, importAll, parseBackup, countRows, BackupFile } from '../lib/backup';

interface BackupModalProps {
  onClose: () => void;
}

export default function BackupModal({ onClose }: BackupModalProps) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BackupFile | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const doExport = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const file = await exportAll();
      downloadBackup(file);
      const total = countRows(file).reduce((s, r) => s + r.count, 0);
      setStatus(`Downloaded a backup of ${total} records. Keep it somewhere safe (iCloud/Drive).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    }
    setBusy(false);
  };

  const onFile = async (file: File) => {
    setError(null);
    setStatus(null);
    try {
      setPreview(parseBackup(await file.text()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const confirmImport = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await importAll(preview);
      setStatus('Restored. Reloading…');
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative paper-card rounded-2xl border border-black/10 dark:border-white/[0.2] shadow-2xl w-[min(480px,94vw)] max-h-[86vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4 border-b border-black/5 dark:border-white/[0.13] flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold ink-text flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" /> Backup &amp; Restore
            </h3>
            <p className="text-xs ink-text-muted mt-1">A full copy of everything — goals, milestones, reflections, hours, habits.</p>
          </div>
          <button onClick={onClose} disabled={busy} className="p-1.5 rounded-lg ink-text-muted hover:bg-stone-100 transition disabled:opacity-40">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex flex-col gap-4">
          {/* Export */}
          <div className="rounded-xl border border-black/[0.07] dark:border-white/[0.13] p-4">
            <div className="font-semibold ink-text text-sm mb-1">Download a backup</div>
            <p className="text-xs ink-text-muted mb-3">
              Saves one JSON file you fully own. Do this regularly, or before anything risky.
            </p>
            <button
              onClick={doExport}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-sm font-semibold transition disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> Download backup (.json)
            </button>
          </div>

          {/* Import */}
          <div className="rounded-xl border border-black/[0.07] dark:border-white/[0.13] p-4">
            <div className="font-semibold ink-text text-sm mb-1">Restore from a backup</div>
            <p className="text-xs ink-text-muted mb-3">
              Load a backup file. This <span className="font-semibold">replaces all current data</span>. Also how you move
              to another Supabase account: point the app at it, then restore here.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => e.target.files && e.target.files[0] && onFile(e.target.files[0])}
            />
            {!preview ? (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-black/10 dark:border-white/[0.2] ink-text text-sm font-semibold hover:bg-stone-50 transition disabled:opacity-50"
              >
                <Upload className="w-4 h-4" /> Choose backup file…
              </button>
            ) : (
              <div className="rounded-lg border border-amber-300 bg-amber-50/70 dark:bg-amber-400/10 p-3">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm font-semibold mb-2">
                  <AlertTriangle className="w-4 h-4" /> Replace everything with this backup?
                </div>
                <div className="text-[11px] font-mono ink-text-muted mb-3 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>from {preview.exportedAt.slice(0, 10)}</span>
                  {countRows(preview)
                    .filter((r) => r.count > 0)
                    .map((r) => (
                      <span key={r.table}>
                        {r.table.replace('vision_', '').replace('_', ' ')}: {r.count}
                      </span>
                    ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPreview(null)}
                    disabled={busy}
                    className="flex-1 py-2 rounded-lg border border-black/10 dark:border-white/[0.2] ink-text text-sm font-semibold hover:bg-white dark:hover:bg-paper transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmImport}
                    disabled={busy}
                    className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition disabled:opacity-50"
                  >
                    {busy ? 'Restoring…' : 'Replace & restore'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {status && <div className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-400/10 border border-emerald-200 rounded-lg px-3 py-2">{status}</div>}
          {error && <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-400/10 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        </div>
      </div>
    </div>
  );
}
