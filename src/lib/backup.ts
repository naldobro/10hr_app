import { supabase } from './supabase';

const SINGLE_USER_ID = 'single-user';

// Every user-owned table. Order matters for import (parents before children).
export const BACKUP_TABLES = [
  'work_sessions',
  'daily_summaries',
  'habit_entries',
  'habit_schedules',
  'vision_goals',
  'vision_topics',
  'vision_snapshots',
  'vision_settings',
  'vision_docs',
] as const;

type Row = Record<string, unknown>;

export interface BackupFile {
  app: '10hr';
  version: 1;
  exportedAt: string;
  tables: Record<string, Row[]>;
}

// Pull every table. Missing tables are tolerated (skipped) so a partial backup still succeeds.
export async function exportAll(): Promise<BackupFile> {
  const tables: Record<string, Row[]> = {};
  for (const t of BACKUP_TABLES) {
    try {
      const { data, error } = await supabase.from(t).select('*').eq('user_id', SINGLE_USER_ID);
      tables[t] = error ? [] : (data as Row[]) || [];
    } catch {
      tables[t] = [];
    }
  }
  return { app: '10hr', version: 1, exportedAt: new Date().toISOString(), tables };
}

export function downloadBackup(file: BackupFile): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `10hr-backup-${file.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function countRows(file: BackupFile): { table: string; count: number }[] {
  return BACKUP_TABLES.map((t) => ({ table: t, count: (file.tables[t] || []).length }));
}

export function parseBackup(text: string): BackupFile {
  const parsed = JSON.parse(text);
  if (!parsed || parsed.app !== '10hr' || !parsed.tables) {
    throw new Error('This does not look like a 10hr backup file.');
  }
  return parsed as BackupFile;
}

// Replace all current data with the backup's. Each table is cleared then re-inserted
// (ids preserved). vision_goals inserts goals before milestones to satisfy the FK.
export async function importAll(file: BackupFile): Promise<void> {
  for (const t of BACKUP_TABLES) {
    const rows = (file.tables[t] || []) as Row[];

    const { error: delErr } = await supabase.from(t).delete().eq('user_id', SINGLE_USER_ID);
    if (delErr) throw new Error(`Clearing ${t} failed: ${delErr.message}`);

    if (rows.length === 0) continue;

    if (t === 'vision_goals') {
      const parents = rows.filter((r) => (r as { kind?: string }).kind !== 'milestone');
      const children = rows.filter((r) => (r as { kind?: string }).kind === 'milestone');
      if (parents.length) {
        const { error } = await supabase.from(t).insert(parents);
        if (error) throw new Error(`Restoring ${t} (goals) failed: ${error.message}`);
      }
      if (children.length) {
        const { error } = await supabase.from(t).insert(children);
        if (error) throw new Error(`Restoring ${t} (milestones) failed: ${error.message}`);
      }
    } else {
      const { error } = await supabase.from(t).insert(rows);
      if (error) throw new Error(`Restoring ${t} failed: ${error.message}`);
    }
  }
}
