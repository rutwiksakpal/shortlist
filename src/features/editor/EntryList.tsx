import { useState, type ReactNode } from 'react';
import type { ListSection, Profile } from '../../lib/schema';
import { confirmAction } from '../../store/ui';
import { PlusIcon } from '../../components/icons';
import { Button } from '../../components/ui';
import { reorderById, useEditor, useOrderedList } from './context';
import { DeleteButton, EntryCard, HideToggle } from './Panel';
import { SortableList } from './SortableList';

type ItemOf<S extends ListSection> = Profile[S][number];

export interface EntryListProps<S extends ListSection> {
  section: S;
  singular: string;
  newItem: () => ItemOf<S>;
  title: (item: ItemOf<S>) => string;
  meta?: (item: ItemOf<S>) => string;
  fields: (
    item: ItemOf<S>,
    set: <K extends keyof ItemOf<S>>(field: K, value: ItemOf<S>[K]) => void,
    patch: (values: Partial<ItemOf<S>>) => void,
  ) => ReactNode;
  addLabel: string;
  empty: ReactNode;
}

export function EntryList<S extends ListSection>({ section, singular, newItem, title, meta, fields, addLabel, empty }: EntryListProps<S>) {
  const { profile, edit, mode } = useEditor();
  const items = profile[section] as Array<ItemOf<S>>;
  const byId = new Map(items.map((i) => [i.id, i]));
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const list = useOrderedList(
    section,
    items.map((i) => i.id),
    (ids) =>
      edit(`reorder:${section}:${Date.now()}`, (p) => {
        (p[section] as Array<ItemOf<S>>) = reorderById(p[section] as Array<ItemOf<S>>, ids);
      }),
  );

  const setField =
    (id: string) =>
    <K extends keyof ItemOf<S>>(field: K, value: ItemOf<S>[K]) =>
      edit(`${section}:${id}:${String(field)}`, (p) => {
        const target = (p[section] as Array<ItemOf<S>>).find((x) => x.id === id);
        if (target) target[field] = value;
      });

  const patchItem = (id: string) => (values: Partial<ItemOf<S>>) =>
    edit(`${section}:${id}:${Object.keys(values).join(',')}`, (p) => {
      const target = (p[section] as Array<ItemOf<S>>).find((x) => x.id === id);
      if (target) Object.assign(target, values);
    });

  const remove = async (id: string) => {
    const item = byId.get(id);
    const name = item ? title(item) : singular;
    if (mode === 'variant') {
      const ok = await confirmAction({
        title: `Delete ${name}?`,
        message:
          'This removes it from the master profile and from every resume. To remove it from this resume only, use the hide (eye) button instead.',
        confirmLabel: 'Delete',
      });
      if (!ok) return;
    }
    edit(`del:${section}:${id}`, (p) => {
      (p[section] as Array<ItemOf<S>>) = (p[section] as Array<ItemOf<S>>).filter((x) => x.id !== id);
    });
  };

  const add = () => {
    const item = newItem();
    edit(`add:${section}:${item.id}`, (p) => {
      (p[section] as Array<ItemOf<S>>).push(item);
    });
    setJustAdded(item.id);
  };

  return (
    <div className="space-y-2">
      {list.entries.length ? (
        <SortableList
          ariaLabel={`${singular} entries`}
          entries={list.entries}
          onReorder={list.reorder}
          itemLabel={(id) => {
            const it = byId.get(id);
            return it ? title(it) : singular;
          }}
          className="space-y-2"
          render={({ id, hidden, handle }) => {
            const item = byId.get(id);
            if (!item) return null;
            return (
              <EntryCard
                title={title(item)}
                meta={meta?.(item)}
                hidden={hidden}
                handle={handle}
                defaultOpen={justAdded === id || items.length === 1}
                actions={
                  <>
                    {list.toggle ? <HideToggle hidden={hidden} label={title(item)} onToggle={() => list.toggle?.(id)} /> : null}
                    <DeleteButton label={title(item)} onClick={() => void remove(id)} />
                  </>
                }
              >
                {fields(item, setField(id), patchItem(id))}
              </EntryCard>
            );
          }}
        />
      ) : (
        <div className="text-sm text-slate-500 dark:text-slate-400">{empty}</div>
      )}
      <Button size="sm" variant="subtle" icon={<PlusIcon size={16} />} onClick={add}>
        {addLabel}
      </Button>
    </div>
  );
}
