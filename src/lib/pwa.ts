import { create } from 'zustand';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  installEvent: BeforeInstallPromptEvent | null;
  installed: boolean;
  persisted: boolean | null;
  install: () => Promise<void>;
}

export const usePwa = create<PwaState>()((set, get) => ({
  installEvent: null,
  installed: typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches === true,
  persisted: null,
  install: async () => {
    const e = get().installEvent;
    if (!e) return;
    await e.prompt();
    const choice = await e.userChoice;
    set({ installEvent: null, installed: choice.outcome === 'accepted' });
  },
}));

/** Registers the offline service worker in production builds. */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    usePwa.setState({ installEvent: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => usePwa.setState({ installed: true, installEvent: null }));
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err: unknown) => console.error('Service worker registration failed', err));
  });
}

/** Asks the browser not to evict this site's storage. Returns the resulting state. */
export async function requestPersistentStorage(): Promise<boolean | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return null;
  try {
    const already = await navigator.storage.persisted();
    const ok = already || (await navigator.storage.persist());
    usePwa.setState({ persisted: ok });
    return ok;
  } catch {
    return null;
  }
}

const LAST_EXPORT_KEY = 'shortlist:lastExport';
const SNOOZE_KEY = 'shortlist:backupSnooze';
const DAY = 24 * 60 * 60 * 1000;

export function markExported(): void {
  try {
    localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString());
  } catch {
    // ignore
  }
}

export function lastExportedAt(): Date | null {
  try {
    const v = localStorage.getItem(LAST_EXPORT_KEY);
    return v ? new Date(v) : null;
  } catch {
    return null;
  }
}

export function snoozeBackupReminder(days = 7): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + days * DAY));
  } catch {
    // ignore
  }
}

/** True when the user has real content and no recent backup (14 days), unless snoozed. */
export function backupReminderDue(hasContent: boolean, now = Date.now()): boolean {
  if (!hasContent) return false;
  try {
    const snooze = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
    if (snooze > now) return false;
  } catch {
    return false;
  }
  const last = lastExportedAt();
  return !last || now - last.getTime() > 14 * DAY;
}
