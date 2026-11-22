import { describe, expect, it, beforeEach, vi } from 'vitest';
import { STORAGE_KEYS, loadWorkspace, parseBackup, makeBackup } from '../src/lib/storage';
import { seedWorkspace } from '../src/lib/seed';

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('starts a new visitor with an empty profile and onboarding pending', () => {
    const r = loadWorkspace();
    expect(r.status).toBe('new');
    expect(r.workspace.onboarded).toBe(false);
    expect(r.workspace.profile.personal.fullName).toBe('');
    expect(r.workspace.variants).toHaveLength(1);
  });

  it('migrates older saved data (no template, cover letter or onboarded flag)', () => {
    const ws = seedWorkspace() as unknown as Record<string, unknown> & {
      variants: Array<Record<string, unknown> & { layout: Record<string, unknown> }>;
    };
    delete ws.onboarded;
    for (const v of ws.variants) {
      delete v.coverLetter;
      delete v.layout.template;
    }
    localStorage.setItem(STORAGE_KEYS.workspace, JSON.stringify(ws));
    const r = loadWorkspace();
    expect(r.status).toBe('ok');
    expect(r.workspace.onboarded).toBe(true);
    expect(r.workspace.variants[0]!.layout.template).toBe('simple');
    expect(r.workspace.variants[0]!.coverLetter.closing).toBe('Sincerely,');
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
    s.editProfile('personal:headline', (p) => void (p.personal.headline = 'Web Developer'));
    s.editProfile('other', (p) => void (p.personal.city = 'X'));
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
    useStore.getState().editProfile('n', (p) => void (p.personal.fullName = 'Rutwik Sakpal'));
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
    expect(useStore.getState().profile.personal.fullName).toBe('');
  });

  it('persists to localStorage', async () => {
    const { useStore } = await import('../src/store/useStore');
    useStore.getState().editProfile('x', (p) => void (p.personal.city = 'Pune'));
    useStore.getState().persist();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.workspace)!).profile.personal.city).toBe('Pune');
  });
});

describe('onboarding', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('creates the profile and first resume from the wizard', async () => {
    const { useStore } = await import('../src/store/useStore');
    expect(useStore.getState().onboarded).toBe(false);
    const id = useStore.getState().completeOnboarding({
      fullName: 'Priya Shah',
      headline: 'Frontend Developer',
      email: 'p@example.com',
      phone: '',
      city: 'Pune',
      country: 'India',
      linkedin: '',
      github: '',
      portfolio: '',
      preset: 'software',
      roleName: 'Frontend Developer',
    });
    const st = useStore.getState();
    expect(st.onboarded).toBe(true);
    expect(st.profile.personal.fullName).toBe('Priya Shah');
    expect(st.variants).toHaveLength(1);
    expect(st.variants[0]!.id).toBe(id);
    expect(st.variants[0]!.fileName).toBe('Priya_Shah_Frontend_Developer_Resume.pdf');
  });

  it('loads fictional sample data', async () => {
    const { useStore } = await import('../src/store/useStore');
    useStore.getState().loadSample();
    expect(useStore.getState().profile.personal.fullName).toBe('Alex Morgan');
    expect(useStore.getState().variants.length).toBe(2);
  });

  it('stops autosaving when another tab wrote newer data', async () => {
    const { useStore } = await import('../src/store/useStore');
    useStore.setState({ staleTab: true });
    useStore.getState().editProfile('x', (p) => void (p.personal.city = 'Nowhere'));
    useStore.getState().persist();
    expect(localStorage.getItem(STORAGE_KEYS.workspace)).toBeNull();
  });
});
