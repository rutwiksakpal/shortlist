import { useMemo, useState } from 'react';
import { presetById } from '../lib/keywords';
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
import { Badge, Button, Card, EmptyState, IconButton, Notice, TextField } from '../components/ui';
import { cx, FOCUS_RING } from '../components/cx';
import { APPLICATION_STATUSES } from '../lib/schema';
import { TEMPLATES } from '../lib/pdf/templates';
import { backupReminderDue, markExported, snoozeBackupReminder } from '../lib/pwa';
import { makeBackup } from '../lib/storage';
import { seedWorkspace } from '../lib/seed';
import { downloadBlob, formatDateTime, todayIsoDate } from '../lib/utils';

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

  const profile = useStore((s) => s.profile);
  const loadFresh = useStore((s) => s.replaceWorkspace);
  const [backupHidden, setBackupHidden] = useState(false);
  const first = profile.personal.fullName.trim().split(' ')[0];
  const hour = new Date().getHours();
  const greeting = `${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}${first ? `, ${first}` : ''}`;
  const sample = profile.personal.email.endsWith('@example.com') && profile.personal.fullName === 'Alex Morgan';
  const hasContent = profile.experience.length + profile.projects.length + profile.education.length > 0;
  const showBackup = !sample && !backupHidden && backupReminderDue(hasContent);
  const scored = variants.map((v) => scores[v.id]).filter((n): n is number => typeof n === 'number');
  const best = scored.length ? Math.max(...scored) : null;
  const active = applications.filter((a) => a.status === 'Interview' || a.status === 'Offer').length;
  const stats: Array<[string, string, string]> = [
    ['Resumes', String(variants.length), `${variants.filter((v) => v.jobDescription.trim()).length} tailored to a job`],
    ['Best ATS score', best === null ? '-' : String(best), best === null ? 'Open a resume to score it' : 'out of 100'],
    ['Applications', String(applications.length), `${applications.filter((a) => a.status === 'Applied').length} waiting to hear back`],
    [
      'Interviews and offers',
      String(active),
      applications.length ? `${Math.round((active / applications.length) * 100)}% response rate` : 'Log applications to track',
    ],
  ];
  const backupNow = () => {
    const st = useStore.getState();
    downloadBlob(
      new Blob([JSON.stringify(makeBackup(st.workspace(), st.snapshots), null, 2)], { type: 'application/json' }),
      `shortlist-backup-${todayIsoDate()}.json`,
    );
    markExported();
    setBackupHidden(true);
    toast('Backup downloaded');
  };
  const startOwn = async () => {
    const ok = await confirmAction({
      title: 'Remove the sample data?',
      message: 'The sample profile and its resumes are deleted, and you start fresh with your own details.',
      confirmLabel: 'Start fresh',
      tone: 'primary',
    });
    if (!ok) return;
    loadFresh({ ...seedWorkspace(), onboarded: false });
    useStore.setState({ onboarded: false });
    navigate(paths.start());
  };

  const statusCounts = APPLICATION_STATUSES.map((s) => [s, applications.filter((a) => a.status === s).length] as const);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{greeting}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            One master profile, a targeted resume for every role. Everything stays in this browser.
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

      {sample ? (
        <Notice
          tone="info"
          title="You are looking at sample data"
          action={
            <Button size="sm" variant="primary" onClick={() => void startOwn()}>
              Start with my own details
            </Button>
          }
        >
          Alex Morgan is a fictional profile for exploring. Replace it when you are ready.
        </Notice>
      ) : null}

      {showBackup ? (
        <Notice
          tone="warn"
          title="Back up your resumes"
          action={
            <span className="flex gap-2">
              <Button size="sm" variant="primary" icon={<DownloadIcon size={14} />} onClick={backupNow}>
                Download backup
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  snoozeBackupReminder();
                  setBackupHidden(true);
                }}
              >
                Later
              </Button>
            </span>
          }
        >
          Your data lives only in this browser. Clearing browser data would erase it. A backup file restores everything in one click.
        </Notice>
      ) : null}

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-4 dark:border-slate-800 dark:bg-slate-800">
        {stats.map(([label, value, hint]) => (
          <div key={label} className="bg-white px-4 py-3 dark:bg-slate-900">
            <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight">{value}</dd>
            <dd className="text-xs text-slate-500 dark:text-slate-400">{hint}</dd>
          </div>
        ))}
      </dl>

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
                    <Badge>{TEMPLATES[v.layout.template].name} template</Badge>
                    {v.coverLetter.body.trim() ? <Badge tone="amber">Cover letter</Badge> : null}
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
