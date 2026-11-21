import { useMemo, useState } from 'react';
import { presetById } from '../lib/keywords';
import { formatDateTime } from '../lib/utils';
import { navigate, paths } from '../router';
import { useScoreCache } from '../store/scoreCache';
import { useStore } from '../store/useStore';
import { confirmAction, toast } from '../store/ui';
import { NewResumeDialog, RenameDialog, TailorDialog } from '../features/dashboard/dialogs';
import { scoreTone } from '../features/score/tone';
import {
  BriefcaseIcon,
  CopyIcon,
  DownloadIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TargetIcon,
  TrashIcon,
  UploadIcon,
} from '../components/icons';
import { Badge, Button, Card, EmptyState, IconButton, TextField } from '../components/ui';
import { cx, FOCUS_RING } from '../components/cx';
import { APPLICATION_STATUSES } from '../lib/schema';

export function DashboardPage() {
  const variants = useStore((s) => s.variants);
  const applications = useStore((s) => s.applications);
  const duplicateVariant = useStore((s) => s.duplicateVariant);
  const deleteVariant = useStore((s) => s.deleteVariant);
  const scores = useScoreCache((s) => s.scores);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [tailorId, setTailorId] = useState<string | null>(null);

  const tags = useMemo(() => Array.from(new Set(variants.flatMap((v) => v.tags))).sort(), [variants]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return variants
      .filter((v) => !tag || v.tags.includes(tag))
      .filter((v) => !q || [v.name, v.headline, ...v.tags].join(' ').toLowerCase().includes(q))
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [variants, query, tag]);

  const statusCounts = APPLICATION_STATUSES.map((s) => [s, applications.filter((a) => a.status === s).length] as const);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your resumes</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            One master profile, many targeted resumes. Everything stays in this browser.
          </p>
        </div>
        <div className="flex gap-2">
          <Button icon={<UploadIcon size={16} />} onClick={() => navigate(paths.import())}>
            Import resume
          </Button>
          <Button variant="primary" icon={<PlusIcon size={16} />} onClick={() => setCreating(true)}>
            New resume
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <SearchIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <TextField
            label="Search resumes"
            srOnlyLabel
            placeholder="Search by name, headline or tag"
            value={query}
            onValue={setQuery}
            className="pl-9"
            type="search"
          />
        </div>
        {tags.length ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by tag">
            <button
              type="button"
              aria-pressed={tag === null}
              onClick={() => setTag(null)}
              className={cx(
                'rounded-full px-3 py-1 text-xs font-medium',
                FOCUS_RING,
                tag === null ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
              )}
            >
              All
            </button>
            {tags.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tag === t}
                onClick={() => setTag(tag === t ? null : t)}
                className={cx(
                  'rounded-full px-3 py-1 text-xs font-medium',
                  FOCUS_RING,
                  tag === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {filtered.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => {
            const score = scores[v.id];
            const tone = score !== undefined ? scoreTone(score) : null;
            const preset = presetById(v.preset);
            return (
              <li key={v.id}>
                <Card className="flex h-full flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold">
                        <a href={paths.editor(v.id)} className={cx('rounded hover:text-indigo-700 dark:hover:text-indigo-300', FOCUS_RING)}>
                          {v.name}
                        </a>
                      </h2>
                      <p className="truncate text-sm text-slate-500 dark:text-slate-400">{v.headline || 'No headline'}</p>
                    </div>
                    <div className="text-right" aria-label={score !== undefined ? `Last ATS score ${score}` : 'Not scored yet'}>
                      {tone ? (
                        <span className={cx('text-2xl font-bold tabular-nums', tone.text)}>{score}</span>
                      ) : (
                        <span className="text-xs text-slate-400">Open to score</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge tone="indigo">{preset?.name ?? 'Custom role'}</Badge>
                    {v.jobDescription.trim() ? <Badge tone="green">Job description</Badge> : null}
                    {v.tags.map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Updated {formatDateTime(v.updatedAt)}</p>
                  <div className="mt-auto flex flex-wrap items-center gap-1 pt-3">
                    <Button size="sm" variant="primary" onClick={() => navigate(paths.editor(v.id))}>
                      Open
                    </Button>
                    <Button size="sm" variant="subtle" icon={<TargetIcon size={14} />} onClick={() => setTailorId(v.id)}>
                      Tailor for job
                    </Button>
                    <span className="ml-auto flex">
                      <IconButton label={`Download ${v.name}`} onClick={() => navigate(paths.review(v.id))}>
                        <DownloadIcon size={16} />
                      </IconButton>
                      <IconButton
                        label={`Duplicate ${v.name}`}
                        onClick={() => {
                          duplicateVariant(v.id);
                          toast('Resume duplicated');
                        }}
                      >
                        <CopyIcon size={16} />
                      </IconButton>
                      <IconButton label={`Rename ${v.name}`} onClick={() => setRenameId(v.id)}>
                        <PencilIcon size={16} />
                      </IconButton>
                      <IconButton
                        label={`Delete ${v.name}`}
                        tone="danger"
                        disabled={variants.length <= 1}
                        onClick={async () => {
                          const ok = await confirmAction({
                            title: `Delete "${v.name}"?`,
                            message:
                              'Only this resume is deleted. Your master profile and other resumes are not affected. You can undo or restore from version history.',
                            confirmLabel: 'Delete resume',
                          });
                          if (ok) {
                            deleteVariant(v.id);
                            toast('Resume deleted');
                          }
                        }}
                      >
                        <TrashIcon size={16} />
                      </IconButton>
                    </span>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="No resumes match"
          action={
            <Button
              onClick={() => {
                setQuery('');
                setTag(null);
              }}
            >
              Clear filters
            </Button>
          }
        >
          Try a different search or tag.
        </EmptyState>
      )}

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              <BriefcaseIcon />
            </span>
            <div>
              <h2 className="font-semibold">Applications</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {applications.length
                  ? statusCounts.map(([s, n]) => `${n} ${s}`).join(' | ')
                  : 'Log each job you apply to and which resume you sent.'}
              </p>
            </div>
          </div>
          <Button onClick={() => navigate(paths.applications())}>Open applications log</Button>
        </div>
      </Card>

      <NewResumeDialog open={creating} onClose={() => setCreating(false)} />
      <RenameDialog open={renameId !== null} variantId={renameId} onClose={() => setRenameId(null)} />
      <TailorDialog open={tailorId !== null} variantId={tailorId} onClose={() => setTailorId(null)} />
    </div>
  );
}
