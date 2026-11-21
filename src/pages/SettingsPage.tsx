import { useRef, useState } from 'react';
import { listCorruptBackups, makeBackup, parseBackup, readRaw, removeKey, STORAGE_KEYS } from '../lib/storage';
import { seedWorkspace } from '../lib/seed';
import { downloadBlob, todayIsoDate } from '../lib/utils';
import { useStore } from '../store/useStore';
import { useTheme } from '../store/theme';
import { confirmAction, toast } from '../store/ui';
import { DownloadIcon, MonitorIcon, MoonIcon, SunIcon, UploadIcon } from '../components/icons';
import { Button, Card, Notice, SegmentedControl } from '../components/ui';

function usageKb(): number {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k?.startsWith('shortlist:')) total += (localStorage.getItem(k)?.length ?? 0) + k.length;
    }
    return Math.round((total * 2) / 1024);
  } catch {
    return 0;
  }
}

export function SettingsPage() {
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);
  const replaceWorkspace = useStore((s) => s.replaceWorkspace);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [corrupt, setCorrupt] = useState(listCorruptBackups);

  const exportAll = () => {
    const s = useStore.getState();
    const backup = makeBackup(s.workspace(), s.snapshots);
    downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), `shortlist-backup-${todayIsoDate()}.json`);
    toast('Backup downloaded');
  };

  const importAll = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const ok = await confirmAction({
      title: 'Replace all data with this backup?',
      message: `Backup from ${parsed.backup.exportedAt.slice(0, 10)} with ${parsed.backup.workspace.variants.length} resumes and ${parsed.backup.workspace.applications.length} applications. Your current data is saved as a version first.`,
      confirmLabel: 'Replace my data',
    });
    if (!ok) return;
    useStore.getState().takeSnapshot('Before restoring a backup');
    replaceWorkspace(parsed.backup.workspace, parsed.backup.snapshots);
    toast('Backup restored');
  };

  const resetAll = async () => {
    const ok = await confirmAction({
      title: 'Reset everything?',
      message:
        'This replaces your profile, resumes and applications with the starter data. Export a backup first if you want to keep anything.',
      confirmLabel: 'Reset all data',
    });
    if (!ok) return;
    useStore.getState().takeSnapshot('Before reset');
    replaceWorkspace(seedWorkspace());
    toast('Data reset');
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Appearance</h2>
        <SegmentedControl
          label="Theme"
          value={theme}
          onChange={setTheme}
          options={[
            {
              value: 'light',
              label: (
                <span className="flex items-center gap-1">
                  <SunIcon size={14} /> Light
                </span>
              ),
            },
            {
              value: 'dark',
              label: (
                <span className="flex items-center gap-1">
                  <MoonIcon size={14} /> Dark
                </span>
              ),
            },
            {
              value: 'system',
              label: (
                <span className="flex items-center gap-1">
                  <MonitorIcon size={14} /> System
                </span>
              ),
            },
          ]}
        />
        <p className="text-xs text-slate-500">The PDF is always black text on white, whatever the theme.</p>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Backup and restore</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Your data lives only in this browser ({usageKb()} KB used). Clearing browser data or switching devices loses it, so export a
          backup regularly.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<DownloadIcon size={16} />} onClick={exportAll}>
            Export all data (JSON)
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            id="restore-file"
            onChange={(e) => {
              void importAll(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Button icon={<UploadIcon size={16} />} onClick={() => fileRef.current?.click()}>
            Import backup
          </Button>
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </Card>

      {corrupt.length ? (
        <Card className="space-y-3 p-4">
          <h2 className="font-semibold">Recovered data</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Saved data that could not be read was kept here instead of being deleted.
          </p>
          <ul className="space-y-2">
            {corrupt.map((c) => (
              <li key={c.key} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  {new Date(Number(c.key.slice(STORAGE_KEYS.corruptPrefix.length))).toLocaleString()} ({Math.round(c.size / 1024)} KB)
                </span>
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      const raw = readRaw(c.key);
                      if (raw !== null)
                        downloadBlob(
                          new Blob([raw], { type: 'application/json' }),
                          `shortlist-recovered-${c.key.slice(STORAGE_KEYS.corruptPrefix.length)}.json`,
                        );
                    }}
                  >
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      removeKey(c.key);
                      setCorrupt(listCorruptBackups());
                    }}
                  >
                    Delete
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Privacy</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Shortlist has no backend, no login, no analytics and makes no external API calls. Imports, scoring and PDF generation all run in
          your browser.
        </p>
      </Card>

      <Card className="space-y-3 border-red-200 p-4 dark:border-red-900">
        <h2 className="font-semibold text-red-700 dark:text-red-400">Danger zone</h2>
        <Button variant="danger" onClick={() => void resetAll()}>
          Reset all data
        </Button>
      </Card>
    </div>
  );
}
