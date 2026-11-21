import { useMemo, useState } from 'react';
import { sensitiveReason } from '../lib/import/sensitive';
import { resumePlainText, sectionOrder } from '../lib/resolve';
import { SECTION_TITLES, type SectionKey } from '../lib/schema';
import { clean, downloadBlob, ensurePdfExtension } from '../lib/utils';
import { displayUrl, isValidEmail, isValidPhone, isValidUrl, toHref } from '../lib/validation';
import { navigate, paths } from '../router';
import { useStore } from '../store/useStore';
import { toast } from '../store/ui';
import { useResume } from '../features/useResume';
import { PdfPreview } from '../features/preview/PdfPreview';
import { ScoreRing } from '../features/score/ScorePanel';
import { scoreTone } from '../features/score/tone';
import { ApplicationDialog } from './ApplicationsPage';
import { AlertIcon, CheckIcon, ChevronLeftIcon, DownloadIcon, ExternalIcon, XIcon } from '../components/icons';
import { Button, Card, Checkbox, EmptyState, Notice, Spinner, TextField } from '../components/ui';
import { cx, FOCUS_RING } from '../components/cx';

type CheckState = 'pass' | 'warn' | 'fail' | 'pending';

interface CheckRow {
  id: string;
  label: string;
  state: CheckState;
  detail?: string;
}

function StateIcon({ state }: { state: CheckState }) {
  if (state === 'pass') return <CheckIcon size={16} className="text-emerald-600" aria-label="Pass" />;
  if (state === 'fail') return <XIcon size={16} className="text-red-600" aria-label="Fail" />;
  if (state === 'warn') return <AlertIcon size={16} className="text-amber-600" aria-label="Warning" />;
  return <span className="block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" aria-label="Checking" />;
}

export function ReviewPage({ id }: { id: string }) {
  const exists = useStore((s) => s.variants.some((v) => v.id === id));
  if (!exists) {
    return (
      <div className="mx-auto w-full max-w-xl p-6">
        <EmptyState title="Resume not found" action={<Button onClick={() => navigate(paths.dashboard())}>Back to resumes</Button>} />
      </div>
    );
  }
  return <Review id={id} />;
}

function Review({ id }: { id: string }) {
  const { profile, variant, resume, build, ready, fresh, score } = useResume(id);
  const editVariant = useStore((s) => s.editVariant);
  const [confirmed, setConfirmed] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [logging, setLogging] = useState(false);

  const checks = useMemo<CheckRow[]>(() => {
    if (!variant) return [];
    const p = profile.personal;
    const links = [p.portfolio, p.github, p.linkedin, ...p.otherLinks.map((l) => l.url)].map(clean).filter(Boolean);
    const badLinks = links.filter((l) => !isValidUrl(l));
    const text = resumePlainText(resume);
    const sensitive = text
      .split('\n')
      .map((l) => sensitiveReason(l, false))
      .filter((r): r is string => Boolean(r));
    const emptyOmitted = sectionOrder(variant)
      .filter((e) => !e.hidden && !resume.sections.some((s) => s.key === e.id))
      .map((e) => SECTION_TITLES[e.id as SectionKey]);
    const rows: CheckRow[] = [
      {
        id: 'name',
        label: 'Full name',
        state: clean(p.fullName) ? 'pass' : 'fail',
        detail: clean(p.fullName) || 'Add your name in Personal details.',
      },
      { id: 'email', label: 'Email', state: isValidEmail(p.email) ? 'pass' : 'fail', detail: clean(p.email) || 'Missing' },
      {
        id: 'phone',
        label: 'Phone',
        state: isValidPhone(p.phone) ? 'pass' : clean(p.phone) ? 'fail' : 'warn',
        detail: clean(p.phone) || 'Missing',
      },
      {
        id: 'links',
        label: 'Links are valid and clickable',
        state: links.length === 0 ? 'warn' : badLinks.length ? 'fail' : 'pass',
        detail:
          links.length === 0
            ? 'No links. Add LinkedIn, GitHub or a portfolio.'
            : badLinks.length
              ? `Invalid: ${badLinks.join(', ')}`
              : 'Open each link below to confirm it works.',
      },
      {
        id: 'empty',
        label: 'No empty sections',
        state: 'pass',
        detail: emptyOmitted.length ? `Left out because they are empty: ${emptyOmitted.join(', ')}.` : 'Every printed section has content.',
      },
      {
        id: 'sensitive',
        label: 'No date of birth, photo or other personal data',
        state: !ready ? 'pending' : sensitive.length || ready.extracted.imageCount > 0 ? 'fail' : 'pass',
        detail: sensitive.length
          ? `Found: ${Array.from(new Set(sensitive)).join(', ')}. Remove it from your text.`
          : ready?.extracted.imageCount
            ? 'Images found in the PDF.'
            : undefined,
      },
      {
        id: 'pages',
        label: 'Page count',
        state: !ready ? 'pending' : ready.pages <= 1 ? 'pass' : ready.pages === 2 ? 'warn' : 'fail',
        detail: ready
          ? `${ready.pages} page${ready.pages === 1 ? '' : 's'}${ready.pages === 2 ? '. Fine if your experience needs it; try Auto-fit for 1 page.' : ready.pages > 2 ? '. Over the 2-page limit; trim content.' : ''}`
          : undefined,
      },
      {
        id: 'text',
        label: 'Text layer verified',
        state: !fresh || !ready ? 'pending' : ready.verify.pass ? 'pass' : 'fail',
        detail:
          ready && !ready.verify.pass
            ? ready.verify.checks
                .filter((c) => !c.pass)
                .map((c) => `${c.label}${c.detail ? ` (${c.detail})` : ''}`)
                .join('; ')
            : 'Name, email and headings extracted in reading order.',
      },
    ];
    if (score.total < 70)
      rows.push({ id: 'score', label: 'ATS score', state: 'warn', detail: `${score.total}/100. Check the score details in the editor.` });
    return rows;
  }, [profile, variant, resume, ready, fresh, score.total]);

  if (!variant) return null;
  const pending = checks.some((c) => c.state === 'pending') || !fresh;
  const problems = checks.filter((c) => c.state === 'warn' || c.state === 'fail');
  const fileName = ensurePdfExtension(variant.fileName);
  const canDownload = fresh && !pending && (problems.length === 0 || confirmed);
  const p = profile.personal;
  const links = [p.portfolio, p.github, p.linkedin, ...p.otherLinks.map((l) => l.url)].map(clean).filter((l) => l && isValidUrl(l));

  const download = () => {
    if (build.status !== 'ready') return;
    downloadBlob(build.blob, fileName);
    setDownloaded(true);
    toast(`Downloaded ${fileName}`);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" icon={<ChevronLeftIcon size={16} />} onClick={() => navigate(paths.editor(variant.id))}>
          Back to editor
        </Button>
        <h1 className="text-xl font-bold">Review and download: {variant.name}</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="order-2 lg:order-1">
          <PdfPreview build={build} />
        </div>
        <div className="order-1 space-y-4 lg:order-2">
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <ScoreRing score={score.total} size={72} />
              <div>
                <p className={cx('font-semibold', scoreTone(score.total).text)}>{scoreTone(score.total).label}</p>
                <p className="text-xs text-slate-500">{score.note}</p>
                <a href={paths.editor(variant.id)} className={cx('text-sm text-indigo-700 underline dark:text-indigo-300', FOCUS_RING)}>
                  See score details
                </a>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 font-semibold">Checklist</h2>
            <ul className="space-y-2">
              {checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  <span className="mt-0.5">
                    <StateIcon state={c.state} />
                  </span>
                  <span className="text-sm">
                    <span className="font-medium">{c.label}</span>
                    {c.detail ? <span className="block text-xs text-slate-500 dark:text-slate-400">{c.detail}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
            {links.length ? (
              <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                <p className="mb-1 text-xs font-medium text-slate-500">Test your links</p>
                <ul className="space-y-1">
                  {links.map((l) => (
                    <li key={l}>
                      <a
                        href={toHref(l)}
                        target="_blank"
                        rel="noreferrer noopener"
                        className={cx('inline-flex items-center gap-1 text-sm text-indigo-700 underline dark:text-indigo-300', FOCUS_RING)}
                      >
                        {displayUrl(l)} <ExternalIcon size={12} />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          {ready ? (
            <Card className="p-4">
              <h2 className="mb-2 font-semibold">Text layer check</h2>
              <ul className="space-y-1">
                {ready.verify.checks.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5">
                      <StateIcon state={c.pass ? 'pass' : 'fail'} />
                    </span>
                    <span>
                      {c.label}
                      {c.detail ? <span className="block text-xs text-slate-500">{c.detail}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
              <p className={cx('mt-2 text-sm font-semibold', ready.verify.pass ? 'text-emerald-600' : 'text-red-600')}>
                {ready.verify.pass ? 'PASS' : 'FAIL'}
              </p>
            </Card>
          ) : null}

          <Card className="space-y-3 p-4">
            <TextField
              label="File name"
              value={variant.fileName}
              onValue={(v) => editVariant(variant.id, `variant:${variant.id}:fileName`, (d) => void (d.fileName = v))}
              hint={`Saves as ${fileName}. PDF title: "${resume.meta.title}", author: "${resume.meta.author}".`}
            />
            {problems.length ? (
              <>
                <Notice tone="warn" title={`${problems.length} warning${problems.length === 1 ? '' : 's'}`}>
                  You can still download, but review the items marked above first.
                </Notice>
                <Checkbox checked={confirmed} onChange={setConfirmed} label="I have reviewed the warnings and want to download anyway" />
              </>
            ) : null}
            {pending ? <Spinner label="Generating and verifying the PDF" /> : null}
            <Button variant="primary" className="w-full" icon={<DownloadIcon size={16} />} disabled={!canDownload} onClick={download}>
              Download PDF
            </Button>
            {downloaded ? (
              <Notice
                tone="success"
                title="Downloaded"
                action={
                  <Button size="sm" onClick={() => setLogging(true)}>
                    Log application
                  </Button>
                }
              >
                Record where you sent it in the applications log.
              </Notice>
            ) : null}
          </Card>
        </div>
      </div>
      <ApplicationDialog open={logging} onClose={() => setLogging(false)} defaults={{ variantId: variant.id, role: variant.headline }} />
    </div>
  );
}
