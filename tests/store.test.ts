import { describe, expect, it, beforeEach, vi } from 'vitest';
import { STORAGE_KEYS, loadWorkspace, parseBackup, makeBackup } from '../src/lib/storage';
import { seedWorkspace } from '../src/lib/seed';

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('starts with seed data when empty', () => {
    const r = loadWorkspace();
    expect(r.status).toBe('new');
    expect(r.workspace.profile.personal.fullName).toBe('Rutwik Sakpal');
    expect(r.workspace.variants.map((v) => v.name)).toEqual(['Web Developer', 'Software Developer']);
  });

  it('recovers from corrupted storage without deleting the raw data', () => {
    localStorage.setItem(STORAGE_KEYS.workspace, '{not json');
    const r = loadWorkspace();
    expect(r.status).toBe('recovered');
    if (r.status !== 'recovered') return;
    expect(localStorage.getItem(r.backupKey)).toBe('{not json');
    expect(r.workspace.variants.length).toBeGreaterThan(0);
  });

  it('rejects data containing excluded personal fields', () => {
    const ws = seedWorkspace() as unknown as { profile: { personal: Record<string, unknown> } };
    ws.profile.personal.gender = 'x';
    localStorage.setItem(STORAGE_KEYS.workspace, JSON.stringify(ws));
    expect(loadWorkspace().status).toBe('recovered');
  });

  it('round-trips a JSON backup', () => {
    const backup = makeBackup(seedWorkspace(), []);
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);
    expect(parseBackup('{"app":"other"}').ok).toBe(false);
  });
});

describe('store: undo, variants, snapshots', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('undoes and redoes edits, coalescing rapid typing', async () => {
    const { useStore } = await import('../src/store/useStore');
    const s = useStore.getState();
    s.editProfile('personal:headline', (p) => void (p.personal.headline = 'A'));
    s.editProfile('personal:headline', (p) => void (p.personal.headline = 'AB'));
    expect(useStore.getState().profile.personal.headline).toBe('AB');
    useStore.getState().undo();
    expect(useStore.getState().profile.personal.headline).toBe('Web Developer');
    useStore.getState().redo();
    expect(useStore.getState().profile.personal.headline).toBe('AB');
  });

  it('duplicates, tailors, renames and protects the last variant', async () => {
    const { useStore } = await import('../src/store/useStore');
    const first = useStore.getState().variants[0]!;
    const id = useStore.getState().duplicateVariant(first.id, 'Acme - Shopify Developer', { jobDescription: 'JD', tailoredFrom: first.id });
    const copy = useStore.getState().variants.find((v) => v.id === id)!;
    expect(copy.jobDescription).toBe('JD');
    expect(copy.fileName).toBe('Rutwik_Sakpal_Acme_Shopify_Developer_Resume.pdf');
    useStore.getState().renameVariant(id, 'Renamed');
    expect(useStore.getState().variants.find((v) => v.id === id)?.name).toBe('Renamed');
    for (const v of useStore.getState().variants.slice()) useStore.getState().deleteVariant(v.id);
    expect(useStore.getState().variants).toHaveLength(1);
  });

  it('keeps at most 20 snapshots and restores one', async () => {
    const { useStore } = await import('../src/store/useStore');
    for (let i = 0; i < 25; i += 1) useStore.getState().takeSnapshot(`s${i}`);
    expect(useStore.getState().snapshots).toHaveLength(20);
    const snap = useStore.getState().snapshots[0]!;
    useStore.getState().editProfile('x', (p) => void (p.personal.fullName = 'Changed'));
    useStore.getState().restoreSnapshot(snap.id);
    expect(useStore.getState().profile.personal.fullName).toBe('Rutwik Sakpal');
  });

  it('persists to localStorage', async () => {
    const { useStore } = await import('../src/store/useStore');
    useStore.getState().editProfile('x', (p) => void (p.personal.city = 'Pune'));
    useStore.getState().persist();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.workspace)!).profile.personal.city).toBe('Pune');
  });
});
