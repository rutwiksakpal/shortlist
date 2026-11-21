import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';
import type { OrderEntry } from '../../lib/schema';
import { GripIcon } from '../../components/icons';
import { cx, FOCUS_RING } from '../../components/cx';

export interface SortableRenderArgs {
  id: string;
  hidden: boolean;
  handle: ReactNode;
  index: number;
}

function SortableItem({
  entry,
  index,
  label,
  render,
  className,
}: {
  entry: OrderEntry;
  index: number;
  label: string;
  render: (args: SortableRenderArgs) => ReactNode;
  className?: string;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
  });
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Reorder ${label}. Press space to pick up, arrow keys to move, space to drop.`}
      title="Drag to reorder"
      className={cx(
        'inline-flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-slate-400 hover:text-slate-700 active:cursor-grabbing dark:hover:text-slate-200',
        FOCUS_RING,
      )}
    >
      <GripIcon size={16} />
    </button>
  );
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cx(className, isDragging && 'relative z-10 opacity-80 shadow-lg')}
    >
      {render({ id: entry.id, hidden: entry.hidden, handle, index })}
    </li>
  );
}

export function SortableList({
  entries,
  onReorder,
  render,
  itemLabel,
  layout = 'vertical',
  className,
  itemClassName,
  ariaLabel,
}: {
  entries: OrderEntry[];
  onReorder: (entries: OrderEntry[]) => void;
  render: (args: SortableRenderArgs) => ReactNode;
  itemLabel: (id: string) => string;
  layout?: 'vertical' | 'grid';
  className?: string;
  itemClassName?: string;
  ariaLabel: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = entries.findIndex((x) => x.id === active.id);
    const to = entries.findIndex((x) => x.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(entries, from, to));
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${itemLabel(String(active.id))}.`,
          onDragOver: ({ active, over }) =>
            over ? `${itemLabel(String(active.id))} is over position ${entries.findIndex((x) => x.id === over.id) + 1}.` : '',
          onDragEnd: ({ active, over }) =>
            over ? `Dropped ${itemLabel(String(active.id))} at position ${entries.findIndex((x) => x.id === over.id) + 1}.` : 'Dropped.',
          onDragCancel: ({ active }) => `Cancelled moving ${itemLabel(String(active.id))}.`,
        },
      }}
    >
      <SortableContext items={entries.map((e) => e.id)} strategy={layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}>
        <ul aria-label={ariaLabel} className={className}>
          {entries.map((entry, index) => (
            <SortableItem
              key={entry.id}
              entry={entry}
              index={index}
              label={itemLabel(entry.id)}
              render={render}
              className={itemClassName}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
