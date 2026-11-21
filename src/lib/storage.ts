import { backupSchema, snapshotSchema, workspaceSchema, type Backup, type Snapshot, type Workspace } from './schema';
import { seedWorkspace } from './seed';
import { nowIso } from './utils';
import { z } from 'zod';

export const STORAGE_KEYS = {
  workspace: 'shortlist:workspace:v1',
  snapshots: 'shortlist:snapshots:v1',
  theme: 'shortlist:theme',
  corruptPrefix: 'shortlist:corrupt:',
} as const;

export const MAX_SNAPSHOTS = 20;

export type LoadResult =
  | { status: 'ok'; workspace: Workspace }
  | { status: 'new'; workspace: Workspace }
  | { status: 'recovered'; workspace: Workspace; backupKey: string; reason: string };

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads the workspace. Corrupted or invalid data is never thrown away: the raw value is copied
 * to a "shortlist:corrupt:<timestamp>" key (downloadable from Settings) and a fresh seed is used.
 */
export function loadWorkspace(): LoadResult {
  const raw = safeGet(STORAGE_KEYS.workspace);
  if (raw === null) return { status: 'new', workspace: seedWorkspace() };
  let reason = '';
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = workspaceSchema.safeParse(parsed);
    if (result.success) return { status: 'ok', workspace: result.data };
    reason = result.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
      .join('; ');
  } catch (e) {
    reason = e instanceof Error ? e.message : 'Unreadable data';
  }
  const backupKey = `${STORAGE_KEYS.corruptPrefix}${Date.now()}`;
  safeSet(backupKey, raw);
  return { status: 'recovered', workspace: seedWorkspace(), backupKey, reason };
}

export function saveWorkspace(ws: Workspace): { ok: true } | { ok: false; error: string } {
  try {
    localStorage.setItem(STORAGE_KEYS.workspace, JSON.stringify(ws));
    return { ok: true };
  } catch (e) {
    const quota = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);
    return {
      ok: false,
      error: quota ? 'Browser storage is full. Export a JSON backup and delete old version history.' : 'Could not save to browser storage.',
    };
  }
}

export function loadSnapshots(): Snapshot[] {
  const raw = safeGet(STORAGE_KEYS.snapshots);
  if (!raw) return [];
  try {
    const parsed = z.array(snapshotSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.slice(0, MAX_SNAPSHOTS) : [];
  } catch {
    return [];
  }
}

export function saveSnapshots(list: Snapshot[]): boolean {
  return safeSet(STORAGE_KEYS.snapshots, JSON.stringify(list.slice(0, MAX_SNAPSHOTS)));
}

export function listCorruptBackups(): Array<{ key: string; size: number }> {
  const out: Array<{ key: string; size: number }> = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEYS.corruptPrefix)) out.push({ key, size: localStorage.getItem(key)?.length ?? 0 });
    }
  } catch {
    return [];
  }
  return out.sort((a, b) => b.key.localeCompare(a.key));
}

export function readRaw(key: string): string | null {
  return safeGet(key);
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function makeBackup(ws: Workspace, snapshots: Snapshot[]): Backup {
  return { app: 'shortlist', exportedAt: nowIso(), workspace: ws, snapshots };
}

export type BackupParse = { ok: true; backup: Backup } | { ok: false; error: string };

export function parseBackup(text: string): BackupParse {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  const result = backupSchema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    return {
      ok: false,
      error: `This is not a Shortlist backup${first ? ` (${first.path.join('.') || 'root'}: ${first.message})` : ''}.`,
    };
  }
  return { ok: true, backup: result.data };
}

export type ThemePref = 'light' | 'dark' | 'system';

export function loadTheme(): ThemePref {
  const t = safeGet(STORAGE_KEYS.theme);
  return t === 'light' || t === 'dark' || t === 'system' ? t : 'system';
}

export function saveTheme(t: ThemePref): void {
  safeSet(STORAGE_KEYS.theme, t);
}
