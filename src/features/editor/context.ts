import { createContext, useContext } from 'react';
import { orderedEntries } from '../../lib/resolve';
import type { OrderEntry, Profile } from '../../lib/schema';

/**
 * Editing context shared by the resume editor (store-backed, with per-variant ordering)
 * and the import review screen (local draft, ordering changes the draft arrays).
 */
export interface Ordering {
  get: (listKey: string) => OrderEntry[] | undefined;
  set: (listKey: string, entries: OrderEntry[]) => void;
  toggle: (listKey: string, ids: string[], id: string) => void;
}

export interface EditorContextValue {
  profile: Profile;
  edit: (key: string, fn: (p: Profile) => void) => void;
  ordering: Ordering | null;
  /** Whether new items should be added visible in the current variant (always true). */
  mode: 'variant' | 'draft';
}

export const EditorContext = createContext<EditorContextValue | null>(null);
const Ctx = EditorContext;

export function useEditor(): EditorContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useEditor must be used inside EditorProvider');
  return v;
}

export interface OrderedList {
  entries: OrderEntry[];
  reorder: (entries: OrderEntry[]) => void;
  toggle: ((id: string) => void) | null;
}

/**
 * Ordered list for a section. In variant mode, order and visibility live on the variant.
 * In draft mode, reordering rewrites the underlying array via `reorderDraft`.
 */
export function useOrderedList(listKey: string, ids: string[], reorderDraft: (orderedIds: string[]) => void): OrderedList {
  const { ordering } = useEditor();
  if (ordering) {
    return {
      entries: orderedEntries(ordering.get(listKey), ids),
      reorder: (entries) => ordering.set(listKey, entries),
      toggle: (id) => ordering.toggle(listKey, ids, id),
    };
  }
  return {
    entries: ids.map((id) => ({ id, hidden: false })),
    reorder: (entries) => reorderDraft(entries.map((e) => e.id)),
    toggle: null,
  };
}

export function reorderById<T extends { id: string }>(items: T[], ids: string[]): T[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const out = ids.map((id) => byId.get(id)).filter((x): x is T => Boolean(x));
  for (const i of items) if (!ids.includes(i.id)) out.push(i);
  return out;
}
