import type { ScoreResult } from '../../lib/score';
import { AlertIcon, CheckIcon, InfoIcon } from '../../components/icons';
import { Badge } from '../../components/ui';
import { cx } from '../../components/cx';
import { scoreTone } from './tone';

export function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const tone = scoreTone(score);
  return (
    <div
      className="relative grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, background: `conic-gradient(${tone.ring} ${score * 3.6}deg, rgb(148 163 184 / 0.25) 0deg)` }}
      role="img"
      aria-label={`ATS score ${score} out of 100, ${tone.label}`}
    >
      <div className="grid place-items-center rounded-full bg-white dark:bg-slate-900" style={{ width: size - 14, height: size - 14 }}>
        <span className={cx('font-bold tabular-nums', tone.text)} style={{ fontSize: Math.round(size * 0.3) }}>
          {score}
        </span>
      </div>
    </div>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden="true">
      <div
        className={cx('h-full rounded-full', pct >= 85 ? 'bg-emerald-500' : pct >= 60 ? 'bg-indigo-500' : 'bg-amber-500')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function KeywordReport({ result }: { result: ScoreResult }) {
  const k = result.keywords;
  const hiddenInProfile = k.missing.filter((m) => m.inProfile);
  const implied = k.missing.filter((m) => !m.inProfile && m.impliedBy);
  const notConfirmed = k.missing.filter((m) => !m.inProfile && !m.impliedBy);
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Compared against {k.sourceLabel}. Synonyms count (JS = JavaScript, Node = Node.js).
      </p>
      {k.matched.length ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Matched ({k.matched.length})</p>
          <ul className="flex flex-wrap gap-1.5">
            {k.matched.map((m) => (
              <li key={m}>
                <Badge tone="green">{m}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {hiddenInProfile.length ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">In your profile, hidden or missing here</p>
          <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">
            You already confirmed these elsewhere. Show them in this resume if relevant.
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {hiddenInProfile.map((m) => (
              <li key={m.term}>
                <Badge tone="indigo">{m.term}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {implied.length ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Covered by a broader term</p>
          <ul className="space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
            {implied.map((m) => (
              <li key={m.term}>
                You list <strong>{m.impliedBy}</strong>. Many ATS look for <strong>{m.term}</strong> spelled out; add it if accurate.
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {notConfirmed.length ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Missing ({notConfirmed.length})</p>
          <p className="mb-1 text-xs text-amber-700 dark:text-amber-300">Add these only if you genuinely have the experience.</p>
          <ul className="flex flex-wrap gap-1.5">
            {notConfirmed.map((m) => (
              <li key={m.term}>
                <Badge tone="slate">{m.term}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {k.stuffed.length ? (
        <p className="flex items-start gap-1 text-xs text-red-600 dark:text-red-400">
          <AlertIcon size={14} className="mt-0.5 shrink-0" />
          Possible keyword stuffing: {k.stuffed.map((s) => `${s.term} x${s.count}`).join(', ')}. Use each keyword naturally.
        </p>
      ) : null}
    </div>
  );
}

export function JdReport({ result }: { result: ScoreResult }) {
  const jd = result.jd;
  if (!jd) return null;
  const rows: Array<[string, string]> = [
    ['Job title', jd.jobTitle],
    ['Experience asked', jd.years.join('; ')],
    ['Hard skills', jd.hardSkills.map((t) => t.canonical).join(', ')],
    ['Tools', jd.tools.map((t) => t.canonical).join(', ')],
  ];
  const filled = rows.filter(([, v]) => v);
  if (!filled.length) return <p className="text-xs text-slate-500">No skills or tools recognised in this job description.</p>;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {filled.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
          <dd className="text-slate-800 dark:text-slate-200">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ScorePanel({ result, pending }: { result: ScoreResult; pending?: boolean }) {
  const tone = scoreTone(result.total);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <ScoreRing score={result.total} />
        <div>
          <p className={cx('text-lg font-semibold', tone.text)}>{tone.label}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">ATS compatibility score out of 100</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <InfoIcon size={12} /> {result.note}
          </p>
          {pending ? <p className="text-xs text-slate-400">Updating after the PDF finishes...</p> : null}
        </div>
      </div>

      <ul className="space-y-3">
        {result.categories.map((c) => (
          <li key={c.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{c.label}</h3>
              <span className="text-sm tabular-nums text-slate-600 dark:text-slate-300">
                {c.score}/{c.max}
              </span>
            </div>
            <Bar value={c.score} max={c.max} />
            <ul className="mt-2 space-y-1">
              {c.items.map((i, idx) => (
                <li key={idx} className="flex items-start gap-1.5 text-xs">
                  {i.ok ? (
                    <CheckIcon size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertIcon size={14} className="mt-0.5 shrink-0 text-amber-600" />
                  )}
                  <span className="text-slate-700 dark:text-slate-300">
                    {i.label}
                    {i.fix ? <span className="block text-slate-500 dark:text-slate-400">Fix: {i.fix}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
            {c.id === 'keywords' ? (
              <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                <KeywordReport result={result} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {result.jd ? (
        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <h3 className="mb-2 text-sm font-semibold">Job description analysis</h3>
          <JdReport result={result} />
        </div>
      ) : null}
    </div>
  );
}
