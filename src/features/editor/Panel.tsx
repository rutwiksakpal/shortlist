import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { OPEN_PANEL_EVENT } from './strength';
import { ChevronDownIcon, EyeIcon, EyeOffIcon, TrashIcon } from '../../components/icons';
import { Badge, IconButton } from '../../components/ui';
import { cx, FOCUS_RING } from '../../components/cx';

export function Panel({
  title,
  subtitle,
  children,
  defaultOpen = false,
  badge,
  id,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
  id?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const auto = useId();
  const bodyId = `${id ?? auto}-body`;
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!id) return;
    const onOpen = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) return;
      setOpen(true);
      requestAnimationFrame(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        ref.current?.querySelector<HTMLButtonElement>('h2 button')?.focus({ preventScroll: true });
      });
    };
    window.addEventListener(OPEN_PANEL_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_PANEL_EVENT, onOpen);
  }, [id]);
  return (
    <section
      ref={ref}
      id={id}
      style={{ scrollMarginTop: '8rem' }}
      className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
          className={cx('flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left', FOCUS_RING)}
        >
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
              {title}
              {badge}
            </span>
            {subtitle ? <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{subtitle}</span> : null}
          </span>
          <ChevronDownIcon className={cx('shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
        </button>
      </h2>
      <div id={bodyId} hidden={!open} className="border-t border-slate-100 px-4 py-4 dark:border-slate-800">
        {open ? children : null}
      </div>
    </section>
  );
}

export function HideToggle({ hidden, onToggle, label }: { hidden: boolean; onToggle: () => void; label: string }) {
  return (
    <IconButton label={hidden ? `Show ${label} in this resume` : `Hide ${label} from this resume`} aria-pressed={hidden} onClick={onToggle}>
      {hidden ? <EyeOffIcon /> : <EyeIcon />}
    </IconButton>
  );
}

export function DeleteButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <IconButton label={`Delete ${label}`} tone="danger" onClick={onClick}>
      <TrashIcon />
    </IconButton>
  );
}

export function HiddenBadge() {
  return <Badge tone="amber">Hidden here</Badge>;
}

/** Collapsible card for one entry (role, project, school...). */
export function EntryCard({
  title,
  meta,
  hidden,
  handle,
  actions,
  children,
  defaultOpen,
}: {
  title: string;
  meta?: string;
  hidden: boolean;
  handle: ReactNode;
  actions: ReactNode;
  children: ReactNode;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <div className={cx('rounded-lg border border-slate-200 dark:border-slate-700', hidden && 'bg-slate-50 dark:bg-slate-950/50')}>
      <div className="flex items-center gap-1 px-1.5 py-1.5">
        {handle}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
          className={cx('flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-left', FOCUS_RING)}
        >
          <ChevronDownIcon size={16} className={cx('shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
          <span className="min-w-0">
            <span className={cx('block truncate text-sm font-medium', hidden ? 'text-slate-500' : 'text-slate-900 dark:text-slate-100')}>
              {title}
            </span>
            {meta ? <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{meta}</span> : null}
          </span>
          {hidden ? <HiddenBadge /> : null}
        </button>
        {actions}
      </div>
      <div id={bodyId} hidden={!open} className="space-y-3 border-t border-slate-100 px-3 py-3 dark:border-slate-800">
        {open ? children : null}
      </div>
    </div>
  );
}
