import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { APPLICATION_STATUSES, type Application, type ApplicationStatus } from '../lib/schema';
import { clean, todayIsoDate, uid } from '../lib/utils';
import { isValidUrl, toHref } from '../lib/validation';
import { paths } from '../router';
import { useStore } from '../store/useStore';
import { confirmAction, toast } from '../store/ui';
import { Dialog } from '../components/Dialog';
import { ExternalIcon, PencilIcon, PlusIcon, SearchIcon, TrashIcon } from '../components/icons';
import { Badge, Button, Card, EmptyState, IconButton, Select, TextArea, TextField } from '../components/ui';
import { cx, FOCUS_RING } from '../components/cx';

const formSchema = z.object({
  company: z.string().trim().min(1, 'Company is required').max(100),
  role: z.string().trim().min(1, 'Role is required').max(100),
  jobLink: z
    .string()
    .trim()
    .refine((v) => !v || isValidUrl(v), 'Enter a valid link'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  variantId: z.string(),
  status: z.enum(APPLICATION_STATUSES),
  notes: z.string().max(2000),
});
export type ApplicationForm = z.infer<typeof formSchema>;

export function ApplicationDialog({
  open,
  onClose,
  initial,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Application | null;
  defaults?: Partial<ApplicationForm>;
}) {
  const variants = useStore((s) => s.variants);
  const upsert = useStore((s) => s.upsertApplication);
  const blank: ApplicationForm = {
    company: '',
    role: '',
    jobLink: '',
    date: todayIsoDate(),
    variantId: variants[0]?.id ?? '',
    status: 'Applied',
    notes: '',
    ...defaults,
  };
  const { register, handleSubmit, reset, formState } = useForm<ApplicationForm>({
    resolver: zodResolver(formSchema),
    defaultValues: blank,
  });
  useEffect(() => {
    if (open) reset(initial ? { ...initial } : blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);
  const submit = handleSubmit((v) => {
    const variant = variants.find((x) => x.id === v.variantId);
    upsert({
      id: initial?.id ?? uid('app'),
      company: v.company.trim(),
      role: v.role.trim(),
      jobLink: clean(v.jobLink),
      date: v.date,
      variantId: v.variantId,
      variantName: variant?.name ?? initial?.variantName ?? '',
      status: v.status,
      notes: v.notes,
    });
    toast(initial ? 'Application updated' : 'Application logged');
    onClose();
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Edit application' : 'Log an application'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="application-form">
            Save
          </Button>
        </>
      }
    >
      <form id="application-form" className="grid gap-3 sm:grid-cols-2" onSubmit={submit} noValidate>
        <TextField label="Company" autoFocus error={formState.errors.company?.message} {...register('company')} />
        <TextField label="Role" error={formState.errors.role?.message} {...register('role')} />
        <TextField
          label="Job link"
          inputMode="url"
          wrapperClassName="sm:col-span-2"
          error={formState.errors.jobLink?.message}
          {...register('jobLink')}
        />
        <TextField label="Date applied" type="date" error={formState.errors.date?.message} {...register('date')} />
        <Select label="Status" {...register('status')}>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select label="Resume sent" wrapperClassName="sm:col-span-2" {...register('variantId')}>
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
          {initial && !variants.some((v) => v.id === initial.variantId) ? (
            <option value={initial.variantId}>{initial.variantName} (deleted)</option>
          ) : null}
        </Select>
        <TextArea label="Notes" rows={3} wrapperClassName="sm:col-span-2" {...register('notes')} />
      </form>
    </Dialog>
  );
}

const STATUS_TONE: Record<ApplicationStatus, 'indigo' | 'amber' | 'red' | 'green'> = {
  Applied: 'indigo',
  Interview: 'amber',
  Rejected: 'red',
  Offer: 'green',
};

export function ApplicationsPage() {
  const applications = useStore((s) => s.applications);
  const variants = useStore((s) => s.variants);
  const upsert = useStore((s) => s.upsertApplication);
  const remove = useStore((s) => s.deleteApplication);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ApplicationStatus | 'All'>('All');
  const [editing, setEditing] = useState<Application | null>(null);
  const [adding, setAdding] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return applications
      .filter((a) => status === 'All' || a.status === status)
      .filter((a) => !q || [a.company, a.role, a.variantName, a.notes].join(' ').toLowerCase().includes(q))
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [applications, query, status]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Applications</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track where you applied and which resume you sent.</p>
        </div>
        <Button variant="primary" icon={<PlusIcon size={16} />} onClick={() => setAdding(true)}>
          Log application
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <SearchIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <TextField
            label="Search applications"
            srOnlyLabel
            type="search"
            placeholder="Search company, role, notes"
            className="pl-9"
            value={query}
            onValue={setQuery}
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {(['All', ...APPLICATION_STATUSES] as const).map((s) => {
            const n = s === 'All' ? applications.length : applications.filter((a) => a.status === s).length;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={status === s}
                onClick={() => setStatus(s)}
                className={cx(
                  'rounded-full px-3 py-1 text-xs font-medium',
                  FOCUS_RING,
                  status === s ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                )}
              >
                {s} ({n})
              </button>
            );
          })}
        </div>
      </div>

      {list.length ? (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.map((a) => {
              const variantExists = variants.some((v) => v.id === a.variantId);
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {a.role} <span className="text-slate-500">at</span> {a.company}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {a.date}
                      {a.variantName ? (
                        <>
                          {' | Resume: '}
                          {variantExists ? (
                            <a className={cx('rounded underline', FOCUS_RING)} href={paths.editor(a.variantId)}>
                              {a.variantName}
                            </a>
                          ) : (
                            `${a.variantName} (deleted)`
                          )}
                        </>
                      ) : null}
                    </p>
                    {a.notes ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{a.notes}</p> : null}
                  </div>
                  <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
                  <label className="sr-only" htmlFor={`status-${a.id}`}>
                    Status for {a.company}
                  </label>
                  <select
                    id={`status-${a.id}`}
                    value={a.status}
                    onChange={(e) => upsert({ ...a, status: e.target.value as ApplicationStatus })}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900"
                  >
                    {APPLICATION_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <div className="flex">
                    {a.jobLink && isValidUrl(a.jobLink) ? (
                      <a
                        href={toHref(a.jobLink)}
                        target="_blank"
                        rel="noreferrer noopener"
                        aria-label={`Open job posting for ${a.company} in a new tab`}
                        className={cx(
                          'inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800',
                          FOCUS_RING,
                        )}
                      >
                        <ExternalIcon size={16} />
                      </a>
                    ) : null}
                    <IconButton label={`Edit ${a.company} application`} onClick={() => setEditing(a)}>
                      <PencilIcon size={16} />
                    </IconButton>
                    <IconButton
                      label={`Delete ${a.company} application`}
                      tone="danger"
                      onClick={async () => {
                        if (await confirmAction({ title: `Delete the ${a.company} application?`, confirmLabel: 'Delete' })) remove(a.id);
                      }}
                    >
                      <TrashIcon size={16} />
                    </IconButton>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <EmptyState
          title={applications.length ? 'No applications match' : 'No applications yet'}
          action={
            applications.length ? undefined : (
              <Button variant="primary" onClick={() => setAdding(true)}>
                Log your first application
              </Button>
            )
          }
        >
          {applications.length ? 'Try a different filter.' : 'After downloading a resume you can log the application in one click.'}
        </EmptyState>
      )}
      <ApplicationDialog open={adding} onClose={() => setAdding(false)} />
      <ApplicationDialog open={editing !== null} initial={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
