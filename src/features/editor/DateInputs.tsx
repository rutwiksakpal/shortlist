import { useId } from 'react';
import { MONTHS, parseStoredDate, toStored, validateRange, yearOptions } from '../../lib/dates';
import { cx } from '../../components/cx';

const SELECT =
  'rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

const YEARS = yearOptions();

export function MonthYearInput({
  label,
  value,
  onChange,
  disabled,
  invalid,
  describedBy,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const id = useId();
  const parsed = value && value !== 'present' ? parseStoredDate(value) : null;
  const month = parsed?.month ?? 0;
  const year = parsed?.year ?? 0;
  const update = (m: number, y: number) => onChange(y ? toStored(y, m || null) : '');
  return (
    <fieldset className="min-w-0" aria-describedby={describedBy}>
      <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">{label}</legend>
      <div className="flex gap-1.5">
        <label htmlFor={`${id}-m`} className="sr-only">
          {label} month
        </label>
        <select
          id={`${id}-m`}
          className={cx(SELECT, 'w-[5.5rem]', invalid && 'border-red-400')}
          value={month}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onChange={(e) => update(Number(e.target.value), year || new Date().getFullYear())}
        >
          <option value={0}>Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-y`} className="sr-only">
          {label} year
        </label>
        <select
          id={`${id}-y`}
          className={cx(SELECT, 'w-[5.5rem]', invalid && 'border-red-400')}
          value={year}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onChange={(e) => update(month, Number(e.target.value))}
        >
          <option value={0}>Year</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}

export function DateRangeInput({
  start,
  end,
  onChange,
  presentLabel = 'I currently work here',
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  presentLabel?: string;
}) {
  const id = useId();
  const issue = validateRange(start, end);
  const present = end === 'present';
  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <MonthYearInput
          label="Start"
          value={start}
          onChange={(v) => onChange(v, end)}
          invalid={issue?.field === 'start'}
          describedBy={issue ? `${id}-err` : undefined}
        />
        <MonthYearInput
          label="End"
          value={present ? '' : end}
          onChange={(v) => onChange(start, v)}
          disabled={present}
          invalid={issue?.field === 'end'}
          describedBy={issue ? `${id}-err` : undefined}
        />
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            checked={present}
            onChange={(e) => onChange(start, e.target.checked ? 'present' : '')}
          />
          {presentLabel}
        </label>
      </div>
      {issue ? (
        <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {issue.message}
        </p>
      ) : null}
    </div>
  );
}
