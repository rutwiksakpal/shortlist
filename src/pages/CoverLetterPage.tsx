import { useMemo, useState } from 'react';
import { checkCoverLetter, coverLetterFileName, resolveCoverLetter, starterDraft } from '../lib/coverLetter';
import { resolveResume } from '../lib/resolve';
import type { CoverLetter } from '../lib/schema';
import { verifyCoverLetterLayer } from '../lib/pdf/verify';
import { clean, downloadBlob, wordCount } from '../lib/utils';
import { useMediaQuery } from '../lib/useMediaQuery';
import { navigate, paths } from '../router';
import { useStore, useVariant } from '../store/useStore';
import { confirmAction, toast } from '../store/ui';
import { PdfPreview } from '../features/preview/PdfPreview';
import { usePdfDocument, readyOf } from '../features/preview/usePdfBuild';
import { AlertIcon, CheckIcon, ChevronLeftIcon, DownloadIcon, WandIcon } from '../components/icons';
import { Button, Card, Checkbox, EmptyState, IconButton, Notice, Tabs, TextArea, TextField } from '../components/ui';
import { cx } from '../components/cx';

export function CoverLetterPage({ id }: { id: string }) {
  const exists = useStore((s) => s.variants.some((v) => v.id === id));
  if (!exists) {
    return (
      <div className="mx-auto w-full max-w-xl p-6">
        <EmptyState title="Resume not found" action={<Button onClick={() => navigate(paths.dashboard())}>Back to resumes</Button>} />
      </div>
    );
  }
  return <Letter id={id} />;
}

function Letter({ id }: { id: string }) {
  const profile = useStore((s) => s.profile);
  const variant = useVariant(id)!;
  const editVariant = useStore((s) => s.editVariant);
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [confirmed, setConfirmed] = useState(false);
  const c = variant.coverLetter;

  const letter = useMemo(() => resolveCoverLetter(profile, variant), [profile, variant]);
  const key = JSON.stringify([letter, variant.layout]);
  const build = usePdfDocument(
    key,
    async () => (await import('../lib/pdf/render')).renderCoverLetterPdf(letter, variant.layout),
    (ex) => verifyCoverLetterLayer(ex, letter),
  );
  const ready = readyOf(build);
  const check = checkCoverLetter(variant);
  const fileName = coverLetterFileName(profile.personal.fullName, c.company);
  const warnings = [
    ...check.issues,
    ...(ready && !ready.verify.pass ? ready.verify.checks.filter((x) => !x.pass).map((x) => x.label) : []),
  ];

  const set = <K extends keyof CoverLetter>(k: K, v: CoverLetter[K]) =>
    editVariant(variant.id, `cover:${variant.id}:${String(k)}`, (d) => void (d.coverLetter[k] = v));

  const insertDraft = async () => {
    if (clean(c.body)) {
      const ok = await confirmAction({
        title: 'Replace your letter with a starter draft?',
        message: 'Your current text will be replaced. You can undo with Ctrl+Z.',
        confirmLabel: 'Replace',
        tone: 'primary',
      });
      if (!ok) return;
    }
    const skills = resolveResume(profile, variant).sections.flatMap((s) => (s.key === 'skills' ? s.groups.flatMap((g) => g.items) : []));
    if (!clean(c.role) && clean(variant.headline)) set('role', variant.headline);
    editVariant(variant.id, `cover:${variant.id}:draft:${Date.now()}`, (d) => void (d.coverLetter.body = starterDraft(profile, d, skills)));
    toast('Starter draft added. Replace the parts in [brackets] with your own words.', 'info');
  };

  const download = () => {
    if (build.status !== 'ready') return;
    downloadBlob(build.blob, fileName);
    toast(`Downloaded ${fileName}`);
  };

  const form = (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Company" value={c.company} onValue={(v) => set('company', v)} />
          <TextField label="Job title" value={c.role} onValue={(v) => set('role', v)} placeholder={variant.headline} />
          <TextField
            label="Hiring manager (optional)"
            value={c.hiringManager}
            onValue={(v) => set('hiringManager', v)}
            placeholder="e.g. Ms. Rivera"
            hint="Leave empty to use 'Dear Hiring Manager'."
            wrapperClassName="sm:col-span-2"
          />
        </div>
        <Checkbox checked={c.includeDate} onChange={(v) => set('includeDate', v)} label="Include today's date" />
      </Card>
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Letter</h2>
          <Button size="sm" variant="subtle" icon={<WandIcon size={16} />} onClick={() => void insertDraft()}>
            Insert starter draft
          </Button>
        </div>
        <TextArea
          label="Body"
          srOnlyLabel
          rows={16}
          value={c.body}
          onValue={(v) => set('body', v)}
          placeholder={
            'Write 3-4 short paragraphs. Leave a blank line between paragraphs.\n\nOpening: the role and why you are applying.\nMiddle: one or two real results that match the job.\nClose: thank them and invite a conversation.'
          }
          trailing={
            <span className={cx('text-xs tabular-nums', wordCount(c.body) > 400 ? 'text-amber-600' : 'text-slate-400')}>
              {wordCount(c.body)} words
            </span>
          }
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          The starter draft only uses details already in your profile. Write your own results; Shortlist never invents them.
        </p>
        <TextField label="Closing" value={c.closing} onValue={(v) => set('closing', v)} wrapperClassName="max-w-xs" />
      </Card>
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Before you send</h2>
        {warnings.length ? (
          <ul className="space-y-1">
            {warnings.map((w) => (
              <li key={w} className="flex items-start gap-2 text-sm">
                <AlertIcon size={16} className="mt-0.5 shrink-0 text-amber-600" />
                {w}
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckIcon size={16} /> Ready to send. Text layer verified, one page.
          </p>
        )}
        {warnings.length ? <Checkbox checked={confirmed} onChange={setConfirmed} label="Download anyway" /> : null}
        <Button
          variant="primary"
          className="w-full"
          icon={<DownloadIcon size={16} />}
          disabled={build.status !== 'ready' || (warnings.length > 0 && !confirmed)}
          onClick={download}
        >
          Download cover letter
        </Button>
        <p className="text-xs text-slate-500">Saves as {fileName}. Uses the same template as this resume.</p>
      </Card>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <IconButton label="Back to resume" onClick={() => navigate(paths.editor(variant.id))}>
          <ChevronLeftIcon />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">Cover letter</h1>
          <p className="truncate text-xs text-slate-500">For {variant.name}</p>
        </div>
      </div>
      {!clean(profile.personal.fullName) ? (
        <div className="mb-4">
          <Notice tone="warn">Add your name and email in the resume editor first. They appear at the top of the letter.</Notice>
        </div>
      ) : null}
      {desktop ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {form}
          <div className="sticky top-[4.5rem] max-h-[calc(100vh-5.5rem)] overflow-y-auto rounded-xl bg-slate-100 p-4 dark:bg-slate-900/60">
            <PdfPreview build={build} />
          </div>
        </div>
      ) : (
        <>
          <Tabs
            label="Cover letter views"
            idPrefix="cl"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'write', label: 'Write' },
              { value: 'preview', label: 'Preview' },
            ]}
          />
          <div id={`cl-panel-${tab}`} role="tabpanel" aria-labelledby={`cl-tab-${tab}`} className="pt-4">
            {tab === 'write' ? form : <PdfPreview build={build} />}
          </div>
        </>
      )}
    </div>
  );
}
