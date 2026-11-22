import { create } from 'zustand';
import { type Application, type OrderEntry, type Profile, type Snapshot, type Variant, type Workspace } from '../lib/schema';
import { createVariant, emptyProfile, sampleWorkspace, type NewVariantInput } from '../lib/seed';
import { loadSnapshots, loadWorkspace, MAX_SNAPSHOTS, saveSnapshots, saveWorkspace, STORAGE_KEYS, type LoadResult } from '../lib/storage';
import { deepClone, defaultFileName, nowIso, uid } from '../lib/utils';
import { orderedEntries } from '../lib/resolve';

interface Doc {
  profile: Profile;
  variants: Variant[];
}

export type SaveStatus = { state: 'idle' } | { state: 'saving' } | { state: 'saved'; at: string } | { state: 'error'; message: string };

export interface RecoveryNotice {
  backupKey: string;
  reason: string;
}

const HISTORY_LIMIT = 100;
const COALESCE_MS = 1000;
const AUTO_SNAPSHOT_MS = 3 * 60 * 1000;

export interface OnboardingInput {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  linkedin: string;
  github: string;
  portfolio: string;
  preset: 'web' | 'software' | 'custom';
  roleName: string;
}

interface State extends Doc {
  onboarded: boolean;
  /** Another browser tab saved newer data; editing here could overwrite it. */
  staleTab: boolean;
  applications: Application[];
  snapshots: Snapshot[];
  past: Doc[];
  future: Doc[];
  lastCommit: { key: string; at: number } | null;
  saveStatus: SaveStatus;
  recovery: RecoveryNotice | null;
  dirty: boolean;

  // history
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // profile / variant edits. `key` groups rapid edits (typing) into one undo step.
  editProfile: (key: string, fn: (p: Profile) => void) => void;
  editVariant: (variantId: string, key: string, fn: (v: Variant) => void) => void;
  edit: (key: string, fn: (p: Profile, variants: Variant[]) => void) => void;
  setOrder: (variantId: string, listKey: string, entries: OrderEntry[]) => void;
  toggleHidden: (variantId: string, listKey: string, ids: string[], id: string) => void;

  // variants
  addVariant: (input: NewVariantInput) => string;
  duplicateVariant: (id: string, name?: string, extra?: Partial<Variant>) => string;
  renameVariant: (id: string, name: string) => void;
  deleteVariant: (id: string) => void;

  // applications
  upsertApplication: (app: Application) => void;
  deleteApplication: (id: string) => void;

  // snapshots
  takeSnapshot: (label: string) => void;
  restoreSnapshot: (id: string) => void;
  deleteSnapshot: (id: string) => void;

  // onboarding
  completeOnboarding: (input: OnboardingInput) => string;
  loadSample: () => void;
  markOnboarded: () => void;

  // persistence
  replaceWorkspace: (ws: Workspace, snapshots?: Snapshot[]) => void;
  persist: () => void;
  dismissRecovery: () => void;
  workspace: () => Workspace;
}

function initial(): { load: LoadResult; snapshots: Snapshot[] } {
  if (typeof window === 'undefined') {
    return { load: loadWorkspace(), snapshots: [] };
  }
  return { load: loadWorkspace(), snapshots: loadSnapshots() };
}

const init = initial();

function touch(variants: Variant[], id?: string): void {
  const ts = nowIso();
  for (const v of variants) if (!id || v.id === id) v.updatedAt = ts;
}

export const useStore = create<State>()((set, get) => {
  /** Applies a mutation to a cloned doc and records undo history. */
  const commit = (key: string, mutate: (doc: Doc) => void, touchId?: string) => {
    const state = get();
    const before: Doc = { profile: state.profile, variants: state.variants };
    const draft: Doc = deepClone(before);
    mutate(draft);
    touch(draft.variants, touchId);
    const now = Date.now();
    const coalesce = state.lastCommit !== null && state.lastCommit.key === key && now - state.lastCommit.at < COALESCE_MS;
    const past = coalesce ? state.past : [...state.past, before].slice(-HISTORY_LIMIT);
    set({
      profile: draft.profile,
      variants: draft.variants,
      past,
      future: [],
      lastCommit: { key, at: now },
      dirty: true,
    });
  };

  return {
    onboarded: init.load.workspace.onboarded,
    staleTab: false,
    profile: init.load.workspace.profile,
    variants: init.load.workspace.variants,
    applications: init.load.workspace.applications,
    snapshots: init.snapshots,
    past: [],
    future: [],
    lastCommit: null,
    saveStatus: { state: 'idle' },
    recovery: init.load.status === 'recovered' ? { backupKey: init.load.backupKey, reason: init.load.reason } : null,
    dirty: init.load.status !== 'ok',

    undo: () => {
      const { past, future, profile, variants } = get();
      const prev = past[past.length - 1];
      if (!prev) return;
      set({
        profile: prev.profile,
        variants: prev.variants,
        past: past.slice(0, -1),
        future: [{ profile, variants }, ...future].slice(0, HISTORY_LIMIT),
        lastCommit: null,
        dirty: true,
      });
    },
    redo: () => {
      const { past, future, profile, variants } = get();
      const next = future[0];
      if (!next) return;
      set({
        profile: next.profile,
        variants: next.variants,
        past: [...past, { profile, variants }].slice(-HISTORY_LIMIT),
        future: future.slice(1),
        lastCommit: null,
        dirty: true,
      });
    },
    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    editProfile: (key, fn) => commit(key, (d) => fn(d.profile)),
    editVariant: (variantId, key, fn) =>
      commit(
        key,
        (d) => {
          const v = d.variants.find((x) => x.id === variantId);
          if (v) fn(v);
        },
        variantId,
      ),
    edit: (key, fn) => commit(key, (d) => fn(d.profile, d.variants)),
    setOrder: (variantId, listKey, entries) =>
      commit(
        `order:${variantId}:${listKey}:${Date.now()}`,
        (d) => {
          const v = d.variants.find((x) => x.id === variantId);
          if (v) v.order[listKey] = entries.map((e) => ({ id: e.id, hidden: e.hidden }));
        },
        variantId,
      ),
    toggleHidden: (variantId, listKey, ids, id) =>
      commit(
        `hide:${variantId}:${listKey}:${id}:${Date.now()}`,
        (d) => {
          const v = d.variants.find((x) => x.id === variantId);
          if (!v) return;
          const entries = orderedEntries(v.order[listKey], ids);
          v.order[listKey] = entries.map((e) => (e.id === id ? { id: e.id, hidden: !e.hidden } : e));
        },
        variantId,
      ),

    addVariant: (input) => {
      const v = createVariant(get().profile, input);
      commit(`variant:add:${v.id}`, (d) => {
        d.variants.push(v);
      });
      return v.id;
    },
    duplicateVariant: (id, name, extra) => {
      const src = get().variants.find((v) => v.id === id);
      if (!src) return id;
      const ts = nowIso();
      const copyName = name ?? `${src.name} (copy)`;
      const copy: Variant = {
        ...deepClone(src),
        ...extra,
        id: uid('var'),
        name: copyName,
        fileName: defaultFileName(get().profile.personal.fullName, copyName),
        createdAt: ts,
        updatedAt: ts,
      };
      commit(`variant:dup:${copy.id}`, (d) => {
        const idx = d.variants.findIndex((v) => v.id === id);
        d.variants.splice(idx + 1, 0, copy);
      });
      return copy.id;
    },
    renameVariant: (id, name) =>
      commit(
        `variant:rename:${id}`,
        (d) => {
          const v = d.variants.find((x) => x.id === id);
          if (v) v.name = name;
        },
        id,
      ),
    deleteVariant: (id) => {
      if (get().variants.length <= 1) return;
      commit(`variant:delete:${id}`, (d) => {
        d.variants = d.variants.filter((v) => v.id !== id);
      });
    },

    upsertApplication: (app) => {
      const list = get().applications;
      const exists = list.some((a) => a.id === app.id);
      set({ applications: exists ? list.map((a) => (a.id === app.id ? app : a)) : [app, ...list], dirty: true });
    },
    deleteApplication: (id) => set({ applications: get().applications.filter((a) => a.id !== id), dirty: true }),

    takeSnapshot: (label) => {
      const { profile, variants, snapshots } = get();
      const snap: Snapshot = { id: uid('snap'), createdAt: nowIso(), label, profile: deepClone(profile), variants: deepClone(variants) };
      const next = [snap, ...snapshots].slice(0, MAX_SNAPSHOTS);
      set({ snapshots: next });
      saveSnapshots(next);
    },
    restoreSnapshot: (id) => {
      const snap = get().snapshots.find((s) => s.id === id);
      if (!snap) return;
      get().takeSnapshot('Before restoring a version');
      commit(`restore:${id}:${Date.now()}`, (d) => {
        d.profile = deepClone(snap.profile);
        d.variants = deepClone(snap.variants);
      });
    },
    deleteSnapshot: (id) => {
      const next = get().snapshots.filter((s) => s.id !== id);
      set({ snapshots: next });
      saveSnapshots(next);
    },

    completeOnboarding: (input) => {
      const profile = emptyProfile();
      Object.assign(profile.personal, {
        fullName: input.fullName.trim(),
        headline: input.headline.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        city: input.city.trim(),
        country: input.country.trim(),
        linkedin: input.linkedin.trim(),
        github: input.github.trim(),
        portfolio: input.portfolio.trim(),
      });
      const variant = createVariant(profile, {
        name: input.roleName.trim() || input.headline.trim() || 'My resume',
        preset: input.preset,
        headline: input.headline.trim(),
      });
      set({ profile, variants: [variant], onboarded: true, past: [], future: [], lastCommit: null, dirty: true });
      return variant.id;
    },
    loadSample: () => {
      const ws = sampleWorkspace();
      set({ profile: ws.profile, variants: ws.variants, onboarded: true, past: [], future: [], lastCommit: null, dirty: true });
    },
    markOnboarded: () => set({ onboarded: true, dirty: true }),

    replaceWorkspace: (ws, snapshots) => {
      set({
        onboarded: true,
        profile: ws.profile,
        variants: ws.variants,
        applications: ws.applications,
        past: [],
        future: [],
        lastCommit: null,
        dirty: true,
        ...(snapshots ? { snapshots: snapshots.slice(0, MAX_SNAPSHOTS) } : {}),
      });
      if (snapshots) saveSnapshots(snapshots);
    },
    persist: () => {
      const state = get();
      if (!state.dirty || state.staleTab) return;
      set({ saveStatus: { state: 'saving' } });
      const result = saveWorkspace(state.workspace());
      if (!result.ok) {
        set({ saveStatus: { state: 'error', message: result.error } });
        return;
      }
      const last = state.snapshots[0];
      const lastAt = last ? new Date(last.createdAt).getTime() : 0;
      if (state.past.length > 0 && Date.now() - lastAt > AUTO_SNAPSHOT_MS) {
        get().takeSnapshot('Autosave');
      }
      set({ saveStatus: { state: 'saved', at: nowIso() }, dirty: false });
    },
    dismissRecovery: () => set({ recovery: null }),
    workspace: () => {
      const { profile, variants, applications, onboarded } = get();
      return { version: 1, onboarded, profile, variants, applications };
    },
  };
});

/** Debounced autosave. Returns an unsubscribe function. */
export function startAutosave(delay = 600): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => useStore.getState().persist();
  const unsub = useStore.subscribe((state, prev) => {
    if (!state.dirty) return;
    if (
      state.profile === prev.profile &&
      state.variants === prev.variants &&
      state.applications === prev.applications &&
      state.onboarded === prev.onboarded &&
      prev.dirty
    )
      return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, delay);
  });
  const onHide = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  // Another tab wrote newer data: stop autosaving here so it is not overwritten.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEYS.workspace && e.newValue !== null) useStore.setState({ staleTab: true });
  };
  window.addEventListener('beforeunload', flush);
  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', onHide);
  if (useStore.getState().dirty) timer = setTimeout(flush, delay);
  return () => {
    unsub();
    if (timer) clearTimeout(timer);
    window.removeEventListener('beforeunload', flush);
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onHide);
  };
}

export function useVariant(id: string | undefined): Variant | undefined {
  return useStore((s) => s.variants.find((v) => v.id === id));
}
