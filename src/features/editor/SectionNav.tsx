import { CheckIcon } from '../../components/icons';
import { cx, FOCUS_RING } from '../../components/cx';
import { openPanel, type StrengthItem } from './strength';

const NAV = [
  ['panel-target', 'Target role'],
  ['panel-template', 'Template'],
  ['panel-personal', 'Personal details'],
  ['panel-sections', 'Section order'],
  ['panel-skills', 'Skills'],
  ['panel-experience', 'Experience'],
  ['panel-projects', 'Projects'],
  ['panel-education', 'Education'],
  ['panel-certifications', 'Certifications'],
  ['panel-achievements', 'Achievements'],
  ['panel-languages', 'Languages'],
  ['panel-layout', 'Page and layout'],
  ['panel-history', 'Version history'],
] as const;

interface Strength {
  percent: number;
  items: StrengthItem[];
}

export function StrengthCard({ strength }: { strength: Strength }) {
  const missing = strength.items.filter((i) => !i.done);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">Profile strength</p>
        <p className="text-sm font-semibold tabular-nums">{strength.percent}%</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden="true">
        <div
          className={cx('h-full rounded-full transition-[width]', strength.percent === 100 ? 'bg-emerald-500' : 'bg-indigo-600')}
          style={{ width: `${strength.percent}%` }}
        />
      </div>
      {missing.length ? (
        <ul className="mt-3 space-y-1">
          {missing.slice(0, 5).map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => openPanel(i.panel)}
                className={cx(
                  'rounded text-left text-xs text-slate-600 underline-offset-2 hover:text-indigo-700 hover:underline dark:text-slate-300 dark:hover:text-indigo-300',
                  FOCUS_RING,
                )}
              >
                Add: {i.label}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
          <CheckIcon size={12} /> Every essential is filled in.
        </p>
      )}
    </div>
  );
}

/** Sticky left rail on wide screens: jump to any section, plus the strength checklist. */
export function SectionNav({ strength }: { strength: Strength }) {
  return (
    <aside className="hidden 2xl:block">
      <div className="sticky top-[7.5rem] space-y-4">
        <StrengthCard strength={strength} />
        <nav aria-label="Editor sections">
          <ul className="space-y-0.5">
            {NAV.map(([id, label]) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => openPanel(id)}
                  className={cx(
                    'w-full rounded-md px-2.5 py-1.5 text-left text-sm text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100',
                    FOCUS_RING,
                  )}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
