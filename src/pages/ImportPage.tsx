import { useMemo, useRef, useState, type DragEvent } from 'react';
import { applyImport, assignUnmapped, type PersonalMode, type UnmappedTarget } from '../lib/import/apply';
import type { FileImportResult } from '../lib/import/files';
import { parseResumeText, type ImportDraft } from '../lib/import/parse';
import type { Profile } from '../lib/schema';
import { parseBackup } from '../lib/storage';
import { clean, deepClone } from '../lib/utils';
import { navigate, paths } from '../router';
import { useStore } from '../store/useStore';
import { confirmAction, toast } from '../store/ui';
import { EditorContext, type EditorContextValue } from '../features/editor/context';
import { Panel } from '../features/editor/Panel';
import {
  AchievementsEditor,
  CertificationsEditor,
  EducationEditor,
  ExperienceEditor,
  LanguagesEditor,
  PersonalEditor,
  ProjectsEditor,
  SkillsEditor,
  SummaryField,
} from '../features/editor/SectionEditors';
import { countFilled } from '../features/editor/counts';
import { FileIcon, UploadIcon } from '../components/icons';
import { Badge, Button, Card, Notice, Spinner, Tabs, TextArea, TextField } from '../components/ui';
import { cx, FOCUS_RING } from '../components/cx';

type Stage = { step: 'source' } | { step: 'review'; draft: ImportDraft; source: string };

export function ImportPage() {
  const [stage, setStage] = useState<Stage>({ step: 'source' });
  return stage.step === 'source' ? (
    <SourceStep onParsed={(draft, source) => setStage({ step: 'review', draft, source })} />
  ) : (
    <ReviewStep initial={stage.draft} source={stage.source} onBack={() => setStage({ step: 'source' })} />
  );
}

function SourceStep({ onParsed }: { onParsed: (d: ImportDraft, source: string) => void }) {
  const replaceWorkspace = useStore((s) => s.replaceWorkspace);
  const [tab, setTab] = useState<'file' | 'paste'>('file');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const handleResult = async (r: FileImportResult) => {
    if (r.kind === 'error') {
      setError(r.message);
      return;
    }
    if (r.kind === 'backup') {
      const parsed = parseBackup(r.text);
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }
      const ok = await confirmAction({
        title: 'Restore this Shortlist backup?',
        message: `This replaces your profile, all resumes and the applications log with the backup from ${parsed.backup.exportedAt.slice(0, 10)}.`,
        confirmLabel: 'Replace my data',
      });
      if (ok) {
        useStore.getState().takeSnapshot('Before restoring a backup');
        replaceWorkspace(parsed.backup.workspace, parsed.backup.snapshots);
        toast('Backup restored');
        navigate(paths.dashboard());
      }
      return;
    }
    onParsed(r.draft, r.sourceLabel);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const { importFile } = await import('../lib/import/files');
      await handleResult(await importFile(file));
    } finally {
      setBusy(false);
    }
  };

  const onPaste = async () => {
    setError(null);
    const t = text.trim();
    if (!t) return;
    if (t.startsWith('{')) {
      const { importJsonText } = await import('../lib/import/files');
      await handleResult(importJsonText(t, 'Pasted JSON'));
    } else {
      onParsed(parseResumeText(t), 'Pasted text');
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void onFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import a resume</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          PDF, DOCX, plain text or JSON (Shortlist backup or JSON Resume). Files are read in your browser and never uploaded. You review
          every field before anything is saved.
        </p>
      </div>
      <Tabs
        label="Import source"
        idPrefix="import"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'file', label: 'Upload file' },
          { value: 'paste', label: 'Paste text' },
        ]}
      />
      <div id={`import-panel-${tab}`} role="tabpanel" aria-labelledby={`import-tab-${tab}`}>
        {tab === 'file' ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cx(
              'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors',
              dragging ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' : 'border-slate-300 dark:border-slate-700',
            )}
          >
            <UploadIcon size={28} className="text-slate-400" />
            <p className="text-sm text-slate-600 dark:text-slate-300">Drag a file here, or</p>
            <input
              ref={input}
              type="file"
              accept=".pdf,.docx,.txt,.md,.json"
              className="sr-only"
              id="import-file"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <label
              htmlFor="import-file"
              className={cx(
                'cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700',
                FOCUS_RING,
              )}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  input.current?.click();
                }
              }}
            >
              Choose a file
            </label>
            <p className="text-xs text-slate-500">PDF, DOCX, TXT or JSON, up to 10 MB</p>
            {busy ? <Spinner label="Reading file" /> : null}
          </div>
        ) : (
          <div className="space-y-3">
            <TextArea
              label="Resume text"
              rows={14}
              value={text}
              onValue={setText}
              placeholder="Paste your resume text here (or a JSON backup)."
            />
            <Button variant="primary" onClick={() => void onPaste()} disabled={!text.trim()}>
              Continue to review
            </Button>
          </div>
        )}
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Notice tone="info" title="How mapping works">
        Shortlist detects common headings (Summary, Skills, Experience, Projects, Education, Certifications...). Lines it cannot place are
        listed for you to assign, never dropped silently. Date of birth, age, gender, marital status, nationality, religion, photos and
        street addresses are removed. Multi-column PDFs may need more fixing.
      </Notice>
    </div>
  );
}

const TARGET_LABEL: Record<UnmappedTarget['kind'], string> = {
  discard: 'Leave out',
  summary: 'Add to summary',
  achievement: 'Achievement',
  skill: 'Skills',
  certification: 'Certification',
  language: 'Language',
  bullet: 'Bullet in...',
};

function encodeTarget(t: UnmappedTarget): string {
  return t.kind === 'bullet' ? `bullet:${t.entryId}` : t.kind;
}

function decodeTarget(v: string): UnmappedTarget {
  if (v.startsWith('bullet:')) return { kind: 'bullet', entryId: v.slice(7) };
  return { kind: v as Exclude<UnmappedTarget['kind'], 'bullet'> };
}

function ReviewStep({ initial, source, onBack }: { initial: ImportDraft; source: string; onBack: () => void }) {
  const [draft, setDraft] = useState<Profile>(() => deepClone(initial.profile));
  const [targets, setTargets] = useState<Record<string, UnmappedTarget>>({});
  const [mode, setMode] = useState<PersonalMode>('fill-empty');
  const [name, setName] = useState(() => clean(initial.profile.personal.headline) || 'Imported resume');

  const ctx = useMemo<EditorContextValue>(
    () => ({
      profile: draft,
      mode: 'draft',
      ordering: null,
      edit: (_key, fn) =>
        setDraft((d) => {
          const next = deepClone(d);
          fn(next);
          return next;
        }),
    }),
    [draft],
  );
  const counts = countFilled(draft);
  const leftOut = initial.unmapped.filter((u) => (targets[u.id] ?? { kind: 'discard' }).kind === 'discard').length;

  const create = () => {
    const store = useStore.getState();
    const finalDraft = assignUnmapped(draft, initial.unmapped, targets);
    const { profile, variant } = applyImport(store.profile, finalDraft, clean(name) || 'Imported resume', mode);
    store.takeSnapshot('Before import');
    store.edit(`import:${variant.id}`, (p, variants) => {
      Object.assign(p, profile);
      variants.push(variant);
    });
    store.markOnboarded();
    if (!store.onboarded) {
      // A first-time visitor starts from the empty placeholder resume; keep only the imported one.
      useStore.setState((st) => ({ variants: st.variants.filter((v) => v.id === variant.id) }));
    }
    toast('Resume imported');
    navigate(paths.editor(variant.id));
  };

  const entries = [
    ...draft.experience.map((e) => ({ id: e.id, label: `Experience: ${[e.title, e.company].filter(Boolean).join(', ') || 'Untitled'}` })),
    ...draft.projects.map((p) => ({ id: p.id, label: `Project: ${p.name || 'Untitled'}` })),
  ];

  return (
    <EditorContext.Provider value={ctx}>
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Review the import</h1>
            <p className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
              <FileIcon size={14} /> {source}. Check and fix each field before creating the resume.
            </p>
          </div>
          <Button variant="ghost" onClick={onBack}>
            Start over
          </Button>
        </div>

        {initial.notices.map((n) => (
          <Notice key={n} tone="warn">
            {n}
          </Notice>
        ))}
        {initial.removed.length ? (
          <Card className="p-4">
            <h2 className="text-sm font-semibold">Removed personal details ({initial.removed.length})</h2>
            <p className="mb-2 text-xs text-slate-500">These do not belong on an ATS resume and are never stored.</p>
            <ul className="space-y-1 text-sm">
              {initial.removed.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <Badge tone="red">{r.reason}</Badge>
                  <span className="text-slate-500 line-through">{r.text}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Panel title="Personal details" defaultOpen>
          <PersonalEditor />
          <fieldset className="mt-4 space-y-1">
            <legend className="text-sm font-medium">Your master profile already has personal details. What should happen?</legend>
            {(
              [
                ['fill-empty', 'Only fill fields that are empty in my profile (recommended)'],
                ['replace', 'Replace my profile details with these'],
                ['keep', 'Keep my profile details, ignore these'],
              ] as const
            ).map(([v, label]) => (
              <label key={v} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="personal-mode"
                  value={v}
                  checked={mode === v}
                  onChange={() => setMode(v)}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                {label}
              </label>
            ))}
          </fieldset>
        </Panel>
        <Panel title="Summary" defaultOpen>
          <SummaryField value={draft.summary} onChange={(v) => ctx.edit('summary', (p) => void (p.summary = v))} />
        </Panel>
        <Panel title="Skills" badge={<Badge>{counts.skills}</Badge>} defaultOpen={counts.skills > 0}>
          <SkillsEditor />
        </Panel>
        <Panel title="Experience" badge={<Badge>{counts.experience}</Badge>} defaultOpen={counts.experience > 0}>
          <ExperienceEditor />
        </Panel>
        <Panel title="Projects" badge={<Badge>{counts.projects}</Badge>} defaultOpen={counts.projects > 0}>
          <ProjectsEditor />
        </Panel>
        <Panel title="Education" badge={<Badge>{counts.education}</Badge>} defaultOpen={counts.education > 0}>
          <EducationEditor />
        </Panel>
        <Panel title="Certifications" badge={<Badge>{counts.certifications}</Badge>}>
          <CertificationsEditor />
        </Panel>
        <Panel title="Achievements" badge={<Badge>{counts.achievements}</Badge>}>
          <AchievementsEditor />
        </Panel>
        <Panel title="Languages" badge={<Badge>{counts.languages}</Badge>}>
          <LanguagesEditor />
        </Panel>

        {initial.unmapped.length ? (
          <Card className="p-4">
            <h2 className="font-semibold">Lines to assign ({initial.unmapped.length})</h2>
            <p className="mb-3 text-xs text-slate-500">
              These could not be placed automatically. Choose where each one goes, or leave it out.
            </p>
            <ul className="space-y-2">
              {initial.unmapped.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 p-2 sm:flex-row sm:items-center dark:border-slate-700"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{u.text}</p>
                    <p className="text-xs text-slate-400">From: {u.from}</p>
                  </div>
                  <label className="sr-only" htmlFor={`target-${u.id}`}>
                    Where should this go?
                  </label>
                  <select
                    id={`target-${u.id}`}
                    value={encodeTarget(targets[u.id] ?? { kind: 'discard' })}
                    onChange={(e) => setTargets((t) => ({ ...t, [u.id]: decodeTarget(e.target.value) }))}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm sm:w-64 dark:border-slate-600 dark:bg-slate-900"
                  >
                    {(['discard', 'summary', 'achievement', 'skill', 'certification', 'language'] as const).map((k) => (
                      <option key={k} value={k}>
                        {TARGET_LABEL[k]}
                      </option>
                    ))}
                    {entries.map((e) => (
                      <option key={e.id} value={`bullet:${e.id}`}>
                        Bullet in {e.label}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card className="space-y-3 p-4">
          <TextField label="Name for the new resume" value={name} onValue={setName} />
          <p className="text-xs text-slate-500">
            Imported entries are added to your master profile. The new resume shows exactly the imported content; your existing entries stay
            available but hidden in it.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={create}>
              Create resume
            </Button>
            {leftOut ? (
              <span className="text-sm text-amber-700 dark:text-amber-300">
                {leftOut} unassigned line{leftOut === 1 ? '' : 's'} will be left out.
              </span>
            ) : null}
          </div>
        </Card>
      </div>
    </EditorContext.Provider>
  );
}
