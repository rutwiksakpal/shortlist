import { useMemo, useState } from 'react';
import { presetById } from '../lib/keywords';
import { useMediaQuery } from '../lib/useMediaQuery';
import { navigate, paths } from '../router';
import { useStore } from '../store/useStore';
import { useResume } from '../features/useResume';
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
} from '../features/editor/SectionEditors';
import { countFilled } from '../features/editor/counts';
import { HistoryPanel, LayoutPanel, SectionsPanel, TargetPanel } from '../features/editor/VariantPanels';
import { TemplatePicker } from '../features/editor/TemplatePicker';
import { profileStrength } from '../features/editor/strength';
import { SectionNav, StrengthCard } from '../features/editor/SectionNav';
import { PdfPreview, TextLayerView } from '../features/preview/PdfPreview';
import { ScorePanel, ScoreRing } from '../features/score/ScorePanel';
import { RenameDialog } from '../features/dashboard/dialogs';
import { SaveIndicator } from '../components/SaveIndicator';
import { ChevronLeftIcon, DownloadIcon, FileIcon, PencilIcon, RedoIcon, UndoIcon } from '../components/icons';
import { Badge, Button, EmptyState, IconButton, Tabs } from '../components/ui';
import { cx } from '../components/cx';

type RightTab = 'preview' | 'score' | 'text';
type MobileTab = 'edit' | RightTab;

export function EditorPage({ id }: { id: string }) {
  const exists = useStore((s) => s.variants.some((v) => v.id === id));
  if (!exists) {
    return (
      <div className="mx-auto w-full max-w-xl p-6">
        <EmptyState title="Resume not found" action={<Button onClick={() => navigate(paths.dashboard())}>Back to resumes</Button>}>
          It may have been deleted.
        </EmptyState>
      </div>
    );
  }
  return <Editor id={id} />;
}

function Editor({ id }: { id: string }) {
  const { profile, variant, resume, build, ready, fresh, score } = useResume(id);
  const edit = useStore((s) => s.edit);
  const setOrder = useStore((s) => s.setOrder);
  const toggleHidden = useStore((s) => s.toggleHidden);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const [right, setRight] = useState<RightTab>('preview');
  const [mobile, setMobile] = useState<MobileTab>('edit');
  const [renaming, setRenaming] = useState(false);
  const desktop = useMediaQuery('(min-width: 1024px)');

  const ctx = useMemo<EditorContextValue>(
    () => ({
      profile,
      mode: 'variant',
      edit: (key, fn) => edit(key, (p) => fn(p)),
      ordering: variant
        ? {
            get: (k) => variant.order[k],
            set: (k, entries) => setOrder(variant.id, k, entries),
            toggle: (k, ids, itemId) => toggleHidden(variant.id, k, ids, itemId),
          }
        : null,
    }),
    [profile, variant, edit, setOrder, toggleHidden],
  );

  if (!variant) return null;
  const counts = countFilled(profile);
  const strength = profileStrength(profile, variant);
  const preset = presetById(variant.preset);

  const rightContent = (tab: RightTab) =>
    tab === 'preview' ? (
      <PdfPreview build={build} />
    ) : tab === 'score' ? (
      <ScorePanel result={score} pending={!fresh} />
    ) : (
      <TextLayerView build={build} />
    );

  return (
    <EditorContext.Provider value={ctx}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="sticky top-14 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-3 py-2 sm:px-4">
            <IconButton label="Back to resumes" onClick={() => navigate(paths.dashboard())}>
              <ChevronLeftIcon />
            </IconButton>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <h1 className="truncate text-base font-semibold">{variant.name}</h1>
              <IconButton label="Rename resume" onClick={() => setRenaming(true)}>
                <PencilIcon size={16} />
              </IconButton>
              <span className="hidden sm:inline">
                <Badge tone="indigo">{preset?.name ?? 'Custom role'}</Badge>
              </span>
            </div>
            <span className="hidden sm:inline">
              <SaveIndicator />
            </span>
            <div className="flex items-center">
              <IconButton label="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
                <UndoIcon />
              </IconButton>
              <IconButton label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>
                <RedoIcon />
              </IconButton>
            </div>
            <button
              type="button"
              onClick={() => {
                setRight('score');
                setMobile('score');
              }}
              className="hidden items-center gap-2 rounded-lg px-1 sm:flex"
              aria-label={`ATS score ${score.total}. Show details`}
            >
              <ScoreRing score={score.total} size={40} />
            </button>
            <Button className="hidden md:inline-flex" icon={<FileIcon size={16} />} onClick={() => navigate(paths.cover(variant.id))}>
              Cover letter
            </Button>
            <Button variant="primary" icon={<DownloadIcon size={16} />} onClick={() => navigate(paths.review(variant.id))}>
              <span className="hidden sm:inline">Review and download</span>
              <span className="sm:hidden">Download</span>
            </Button>
          </div>
          <div className="px-3 lg:hidden">
            <Tabs
              label="Editor views"
              idPrefix="mobile"
              value={mobile}
              onChange={setMobile}
              tabs={[
                { value: 'edit', label: 'Edit' },
                { value: 'preview', label: 'Preview' },
                { value: 'score', label: `Score ${score.total}` },
                { value: 'text', label: 'ATS text' },
              ]}
            />
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-[1600px] flex-1 gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
          {desktop ? <SectionNav strength={strength} /> : null}
          <div
            id="mobile-panel-edit"
            role="tabpanel"
            aria-labelledby="mobile-tab-edit"
            className={cx('space-y-3', !desktop && mobile !== 'edit' && 'hidden')}
          >
            {!desktop ? <StrengthCard strength={strength} /> : null}
            <Panel
              id="panel-target"
              title="Target role"
              subtitle="Headline, summary, keywords and job description for this resume"
              defaultOpen
            >
              <TargetPanel variant={variant} />
            </Panel>
            <Panel id="panel-template" title="Template" subtitle="Four ATS-safe designs">
              <TemplatePicker variant={variant} />
            </Panel>
            <Panel id="panel-personal" title="Personal details" subtitle="Shared by all resumes">
              <PersonalEditor />
            </Panel>
            <Panel id="panel-sections" title="Section order and visibility" subtitle="For this resume only">
              <SectionsPanel variant={variant} />
            </Panel>
            <Panel id="panel-skills" title="Skills" badge={<Badge>{counts.skills}</Badge>}>
              <SkillsEditor />
            </Panel>
            <Panel id="panel-experience" title="Experience" badge={<Badge>{counts.experience}</Badge>}>
              <ExperienceEditor />
            </Panel>
            <Panel id="panel-projects" title="Projects" badge={<Badge>{counts.projects}</Badge>}>
              <ProjectsEditor />
            </Panel>
            <Panel id="panel-education" title="Education" badge={<Badge>{counts.education}</Badge>}>
              <EducationEditor />
            </Panel>
            <Panel id="panel-certifications" title="Certifications" badge={<Badge>{counts.certifications}</Badge>}>
              <CertificationsEditor />
            </Panel>
            <Panel id="panel-achievements" title="Achievements" badge={<Badge>{counts.achievements}</Badge>}>
              <AchievementsEditor />
            </Panel>
            <Panel id="panel-languages" title="Languages" subtitle="Optional" badge={<Badge>{counts.languages}</Badge>}>
              <LanguagesEditor />
            </Panel>
            <Panel id="panel-layout" title="Page and layout" subtitle="Size, font, spacing, auto-fit, file name">
              <LayoutPanel variant={variant} resume={resume} pages={ready?.pages ?? null} />
            </Panel>
            <Panel id="panel-history" title="Version history" subtitle="Restore an earlier version">
              <HistoryPanel />
            </Panel>
          </div>

          {/* Desktop right column */}
          {desktop ? (
            <div>
              <div className="sticky top-[7.5rem] max-h-[calc(100vh-8.5rem)] overflow-y-auto rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="sticky top-0 z-10 bg-slate-100 px-3 dark:bg-slate-900">
                  <Tabs
                    label="Preview and score"
                    idPrefix="right"
                    value={right}
                    onChange={setRight}
                    tabs={[
                      { value: 'preview', label: `Preview${ready ? ` (${ready.pages} page${ready.pages === 1 ? '' : 's'})` : ''}` },
                      { value: 'score', label: `ATS score ${score.total}` },
                      { value: 'text', label: 'ATS text view' },
                    ]}
                  />
                </div>
                <div id={`right-panel-${right}`} role="tabpanel" aria-labelledby={`right-tab-${right}`} className="p-4">
                  {rightContent(right)}
                </div>
              </div>
            </div>
          ) : null}

          {/* Mobile right content */}
          {!desktop && mobile !== 'edit' ? (
            <div id={`mobile-panel-${mobile}`} role="tabpanel" aria-labelledby={`mobile-tab-${mobile}`} className="lg:hidden">
              {rightContent(mobile)}
            </div>
          ) : null}
        </div>
      </div>
      <RenameDialog open={renaming} variantId={variant.id} onClose={() => setRenaming(false)} />
    </EditorContext.Provider>
  );
}
