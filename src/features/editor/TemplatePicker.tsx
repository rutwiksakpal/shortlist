import { TEMPLATE_LIST, type TemplateStyle } from '../../lib/pdf/templates';
import type { Variant } from '../../lib/schema';
import { useStore } from '../../store/useStore';
import { cx, FOCUS_RING } from '../../components/cx';
import { CheckIcon } from '../../components/icons';

/** Small schematic of a page so each template can be compared at a glance. */
function Thumb({ t }: { t: TemplateStyle }) {
  const center = t.headerAlign === 'center';
  const serif = t.regular === 'Times-Roman';
  const x = (w: number) => (center ? (100 - w) / 2 : 12);
  const heading = (y: number) => (
    <rect x={12} y={y} width={t.uppercaseHeadings ? 30 : 24} height={t.uppercaseHeadings ? 3 : 3.6} rx={serif ? 0 : 1} fill="#0f172a" />
  );
  const lines = (y: number, n: number) =>
    Array.from({ length: n }, (_, i) => <rect key={i} x={16} y={y + i * 5} width={i % 2 ? 62 : 72} height={2} rx={1} fill="#94a3b8" />);
  return (
    <svg viewBox="0 0 100 130" className="block w-full" aria-hidden="true">
      <rect width="100" height="130" fill="#fff" />
      <rect x={x(serif ? 46 : 40)} y={10} width={serif ? 46 : 40} height={6} rx={serif ? 0 : 1.5} fill="#0f172a" />
      <rect x={x(28)} y={19} width={28} height={2.5} rx={1} fill="#475569" />
      <rect x={x(70)} y={24} width={70} height={2} rx={1} fill="#94a3b8" />
      {heading(34)}
      {lines(40, 3)}
      {heading(58)}
      {lines(64, 4)}
      {heading(88)}
      {lines(94, 3)}
      {heading(112)}
      {lines(118, 2)}
    </svg>
  );
}

export function TemplatePicker({ variant }: { variant: Variant }) {
  const editVariant = useStore((s) => s.editVariant);
  return (
    <div>
      <div role="radiogroup" aria-label="Resume template" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TEMPLATE_LIST.map((t) => {
          const active = variant.layout.template === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => editVariant(variant.id, `template:${variant.id}:${Date.now()}`, (d) => void (d.layout.template = t.id))}
              className={cx(
                'group rounded-lg border-2 p-1.5 text-left transition-colors',
                FOCUS_RING,
                active
                  ? 'border-indigo-600 dark:border-indigo-400'
                  : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600',
              )}
            >
              <span className="block overflow-hidden rounded ring-1 ring-slate-200 dark:ring-slate-700">
                <Thumb t={t} />
              </span>
              <span className="mt-1.5 flex items-center gap-1 px-0.5 text-sm font-medium">
                {active ? <CheckIcon size={14} className="text-indigo-600 dark:text-indigo-400" /> : null}
                {t.name}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {TEMPLATE_LIST.find((t) => t.id === variant.layout.template)?.description} Every template is single column with real text, so ATS
        parsing is the same.
      </p>
    </div>
  );
}
