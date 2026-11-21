import { useState } from 'react';
import { presetById, ROLE_PRESETS } from '../../lib/keywords';
import { hasUsableJd } from '../../lib/jd';
import { sectionOrder, type ResolvedResume } from '../../lib/resolve';
import { FONT_SIZES, MARGINS, SECTION_TITLES, SPACINGS, type Layout, type PresetId, type SectionKey, type Variant } from '../../lib/schema';
import { clean, ensurePdfExtension, formatDateTime } from '../../lib/utils';
import { useStore } from '../../store/useStore';
import { confirmAction, toast } from '../../store/ui';
import { HistoryIcon, WandIcon, XIcon } from '../../components/icons';
import { Badge, Button, IconButton, Notice, SegmentedControl, Select, TextArea, TextField } from '../../components/ui';
import { cx } from '../../components/cx';
import { SummaryField } from './SectionEditors';
import { HideToggle } from './Panel';
import { SortableList } from './SortableList';

function ChipInput({
  label,
  values,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  hint?: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const next = [...values];
    for (const v of draft.split(',').map(clean).filter(Boolean)) {
      if (!next.some((x) => x.toLowerCase() === v.toLowerCase())) next.push(v);
    }
    onChange(next);
    setDraft('');
  };
  return (
    <div>
      <TextField
        label={label}
        hint={hint}
        placeholder={placeholder}
        value={draft}
        onValue={setDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
        }}
        onBlur={() => draft.trim() && add()}
      />
      {values.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={label}>
          {values.map((v) => (
            <li
              key={v}
              className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 py-0.5 pl-2.5 pr-0.5 text-sm dark:bg-slate-800"
            >
              {v}
              <IconButton label={`Remove ${v}`} className="h-6 w-6" onClick={() => onChange(values.filter((x) => x !== v))}>
                <XIcon size={12} />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function TargetPanel({ variant }: { variant: Variant }) {
  const editVariant = useStore((s) => s.editVariant);
  const profileSummary = useStore((s) => s.profile.summary);
  const set = <K extends keyof Variant>(k: K, v: Variant[K]) =>
    editVariant(variant.id, `variant:${variant.id}:${String(k)}`, (d) => void (d[k] = v));
  const preset = presetById(variant.preset);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Headline (target job title)"
          value={variant.headline}
          onValue={(v) => set('headline', v)}
          placeholder="e.g. Web Developer"
        />
        <Select
          label="Role profile"
          value={variant.preset}
          onValue={(v) => set('preset', v as PresetId)}
          hint="Sets the keyword library used for scoring."
        >
          {ROLE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="custom">Custom role</option>
        </Select>
      </div>
      <SummaryField value={variant.summary} onChange={(v) => set('summary', v)} label="Summary for this resume" />
      {!clean(variant.summary) && clean(profileSummary) ? (
        <p className="text-xs text-slate-500">Empty: the default summary from your profile will be used.</p>
      ) : null}
      <ChipInput
        label={variant.preset === 'custom' ? 'Role keywords' : 'Extra keywords'}
        hint={
          variant.preset === 'custom'
            ? 'Keywords this role is scored against when no job description is pasted.'
            : `Added to the ${preset?.name ?? ''} library (${preset?.keywords.length ?? 0} keywords).`
        }
        placeholder="Type keywords separated by commas, then press Enter"
        values={variant.customKeywords}
        onChange={(v) => set('customKeywords', v)}
      />
      <TextArea
        label="Job description (optional)"
        rows={6}
        value={variant.jobDescription}
        onValue={(v) => set('jobDescription', v)}
        placeholder="Paste the job description to score keywords against this specific job."
        hint={
          hasUsableJd(variant.jobDescription)
            ? 'Scoring against this job description. See the ATS score tab for the analysis.'
            : 'Stays on this device. Nothing is sent anywhere.'
        }
      />
      <ChipInput label="Tags" placeholder="e.g. remote, shopify, applied" values={variant.tags} onChange={(v) => set('tags', v)} />
    </div>
  );
}

export function SectionsPanel({ variant }: { variant: Variant }) {
  const setOrder = useStore((s) => s.setOrder);
  const toggleHidden = useStore((s) => s.toggleHidden);
  const entries = sectionOrder(variant);
  return (
    <div>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        Drag to change the order sections print in. Hidden or empty sections are left out completely.
      </p>
      <SortableList
        ariaLabel="Section order"
        entries={entries}
        onReorder={(e) => setOrder(variant.id, 'sections', e)}
        itemLabel={(id) => SECTION_TITLES[id as SectionKey]}
        className="space-y-1.5"
        render={({ id, hidden, handle }) => (
          <div
            className={cx(
              'flex items-center gap-1 rounded-lg border border-slate-200 px-1.5 py-1 dark:border-slate-700',
              hidden && 'opacity-60',
            )}
          >
            {handle}
            <span className="flex-1 text-sm font-medium">{SECTION_TITLES[id as SectionKey]}</span>
            {hidden ? <Badge tone="amber">Hidden</Badge> : null}
            <HideToggle
              hidden={hidden}
              label={`${SECTION_TITLES[id as SectionKey]} section`}
              onToggle={() =>
                toggleHidden(
                  variant.id,
                  'sections',
                  entries.map((e) => e.id),
                  id,
                )
              }
            />
          </div>
        )}
      />
    </div>
  );
}

export function LayoutPanel({ variant, resume, pages }: { variant: Variant; resume: ResolvedResume; pages: number | null }) {
  const editVariant = useStore((s) => s.editVariant);
  const [fitting, setFitting] = useState(false);
  const [fitMsg, setFitMsg] = useState<{ tone: 'success' | 'warn'; text: string } | null>(null);
  const setLayout = (patch: Partial<Layout>) =>
    editVariant(
      variant.id,
      `layout:${variant.id}:${Object.keys(patch).join(',')}:${Date.now()}`,
      (d) => void (d.layout = { ...d.layout, ...patch }),
    );

  const runAutoFit = async () => {
    setFitting(true);
    setFitMsg(null);
    try {
      const { autoFit, pageCountFor } = await import('../../lib/pdf/render');
      const result = await autoFit(variant.layout, (l) => pageCountFor(resume, l));
      setLayout({ fontSize: result.layout.fontSize, spacing: result.layout.spacing, margin: result.layout.margin });
      setFitMsg(
        result.exceedsTwoPages
          ? { tone: 'warn', text: `Still ${result.pages} pages at the most compact ATS-safe settings. Hide or shorten older content.` }
          : {
              tone: 'success',
              text: `Fits on ${result.pages} page${result.pages === 1 ? '' : 's'} at ${result.layout.fontSize}pt, ${result.layout.spacing} spacing, ${result.layout.margin}in margins.`,
            },
      );
    } catch (e) {
      console.error(e);
      setFitMsg({ tone: 'warn', text: 'Auto-fit failed. Try again.' });
    } finally {
      setFitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Page size</p>
          <SegmentedControl
            label="Page size"
            value={variant.layout.pageSize}
            onChange={(v) => setLayout({ pageSize: v })}
            options={[
              { value: 'A4', label: 'A4' },
              { value: 'LETTER', label: 'US Letter' },
            ]}
          />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Spacing</p>
          <SegmentedControl
            label="Spacing"
            value={variant.layout.spacing}
            onChange={(v) => setLayout({ spacing: v })}
            options={SPACINGS.map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) }))}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Body font size"
          value={String(variant.layout.fontSize)}
          onValue={(v) => setLayout({ fontSize: Number(v) as Layout['fontSize'] })}
        >
          {FONT_SIZES.map((f) => (
            <option key={f} value={f}>
              {f} pt (headings {f + 2} pt)
            </option>
          ))}
        </Select>
        <Select label="Margins" value={String(variant.layout.margin)} onValue={(v) => setLayout({ margin: Number(v) as Layout['margin'] })}>
          {MARGINS.map((m) => (
            <option key={m} value={m}>
              {m} inch
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="subtle" icon={<WandIcon size={16} />} onClick={() => void runAutoFit()} disabled={fitting}>
          {fitting ? 'Fitting...' : 'Auto-fit'}
        </Button>
        <span className="text-sm text-slate-600 dark:text-slate-300">
          {pages === null ? 'Counting pages...' : `Currently ${pages} page${pages === 1 ? '' : 's'}`}
        </span>
        {pages !== null && pages > 2 ? <Badge tone="red">Over 2 pages</Badge> : null}
      </div>
      {fitMsg ? <Notice tone={fitMsg.tone === 'success' ? 'success' : 'warn'}>{fitMsg.text}</Notice> : null}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Auto-fit aims for 1 page (up to 2 if needed) while keeping body text 10-11pt and margins 0.6-0.8 inch. Font is always Helvetica.
      </p>
      <TextField
        label="PDF file name"
        value={variant.fileName}
        onValue={(v) => editVariant(variant.id, `variant:${variant.id}:fileName`, (d) => void (d.fileName = v))}
        onBlur={() => {
          const fixed = ensurePdfExtension(variant.fileName);
          if (fixed !== variant.fileName) editVariant(variant.id, `variant:${variant.id}:fileName`, (d) => void (d.fileName = fixed));
        }}
      />
    </div>
  );
}

export function HistoryPanel() {
  const snapshots = useStore((s) => s.snapshots);
  const takeSnapshot = useStore((s) => s.takeSnapshot);
  const restoreSnapshot = useStore((s) => s.restoreSnapshot);
  const deleteSnapshot = useStore((s) => s.deleteSnapshot);
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        The last 20 versions of your whole workspace (profile and all resumes) are kept on this device. A version is saved automatically
        every few minutes while you edit.
      </p>
      <Button
        size="sm"
        icon={<HistoryIcon size={16} />}
        onClick={() => {
          takeSnapshot('Saved manually');
          toast('Version saved');
        }}
      >
        Save version now
      </Button>
      {snapshots.length ? (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
          {snapshots.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div>
                <p className="text-sm font-medium">{formatDateTime(s.createdAt)}</p>
                <p className="text-xs text-slate-500">
                  {s.label} | {s.variants.length} resume{s.variants.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const ok = await confirmAction({
                      title: 'Restore this version?',
                      message:
                        'Your profile and all resumes go back to this version. The current state is saved as a version first, so you can undo this.',
                      confirmLabel: 'Restore',
                      tone: 'primary',
                    });
                    if (ok) {
                      restoreSnapshot(s.id);
                      toast('Version restored');
                    }
                  }}
                >
                  Restore
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteSnapshot(s.id)}
                  aria-label={`Delete version from ${formatDateTime(s.createdAt)}`}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No versions yet.</p>
      )}
    </div>
  );
}
