import { paths } from '../router';
import { useStore } from '../store/useStore';
import { toast } from '../store/ui';
import { CheckIcon, FileIcon, TargetIcon, UploadIcon, WandIcon, BriefcaseIcon } from '../components/icons';
import { cx, FOCUS_RING } from '../components/cx';

/** The hero object: a resume sheet as a recruiter sees it, keywords marked with a highlighter. */
function ResumeSheet() {
  const kw = (t: string, delay: number) => (
    <span className="marker animate-highlight" style={{ animationDelay: `${delay}ms` }}>
      {t}
    </span>
  );
  return (
    <div className="relative mx-auto w-full max-w-[420px]" aria-hidden="true">
      <div className="rotate-[1.5deg] rounded-sm bg-white px-8 pb-10 pt-8 text-[11px] leading-[1.55] text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_20px_40px_-12px_rgba(15,23,42,0.25)] ring-1 ring-slate-200">
        <p className="text-[19px] font-bold leading-tight text-slate-950">Priya Shah</p>
        <p className="text-[12px]">Frontend Developer</p>
        <p className="mt-0.5 text-slate-500">Pune, India | priya@example.com | github.com/priyashah</p>
        <p className="mt-4 text-[12.5px] font-bold text-slate-950">Summary</p>
        <p>
          Frontend developer with 3 years building fast {kw('React', 300)} and {kw('TypeScript', 500)} apps for ecommerce brands.
        </p>
        <p className="mt-3 text-[12.5px] font-bold text-slate-950">Experience</p>
        <p className="font-semibold text-slate-950">Frontend Developer, Brightline Commerce</p>
        <p className="text-slate-500">Pune | Mar 2022 - Present</p>
        <ul className="mt-1 space-y-0.5">
          <li className="flex gap-2">
            <span>•</span>
            <span>Rebuilt checkout in {kw('React', 700)}, lifting conversion by 12%.</span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>Cut LCP from 3.9s to 1.7s through {kw('Core Web Vitals', 900)} work.</span>
          </li>
          <li className="flex gap-2">
            <span>•</span>
            <span>Wrote {kw('REST APIs', 1100)} in Node.js for 18 internal tools.</span>
          </li>
        </ul>
        <p className="mt-3 text-[12.5px] font-bold text-slate-950">Skills</p>
        <p>
          <span className="font-semibold">Frontend:</span> {kw('JavaScript', 1300)}, TypeScript, React, Next.js, Tailwind CSS
        </p>
      </div>
      <div className="absolute -bottom-5 -left-4 flex items-center gap-3 rounded-xl bg-slate-950 px-4 py-3 text-white shadow-xl sm:-left-8">
        <span className="grid h-10 w-10 place-items-center rounded-full border-[3px] border-emerald-400 text-sm font-bold tabular-nums">
          91
        </span>
        <span className="text-xs leading-snug">
          <span className="block font-semibold">ATS check passed</span>
          <span className="text-slate-300">14 of 16 job keywords matched</span>
        </span>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: <TargetIcon />,
    title: 'Tailor for each job',
    text: 'Paste a job description. See which keywords you match, which you miss, and what to fix.',
  },
  {
    icon: <FileIcon />,
    title: 'Real text PDFs',
    text: 'Single column, standard fonts, no tables or images. Every export is read back to confirm an ATS can parse it.',
  },
  {
    icon: <WandIcon />,
    title: 'Fits the page',
    text: 'Auto-fit adjusts size and spacing within ATS-safe limits to land on one page. Empty sections never print.',
  },
  {
    icon: <CheckIcon />,
    title: 'Honest score',
    text: 'A 0-100 estimate across format, keywords, sections and bullet quality, with the exact fix for each point lost.',
  },
  {
    icon: <BriefcaseIcon />,
    title: 'Cover letters and tracking',
    text: 'Write a matching cover letter, then log every application with the resume version you sent.',
  },
  {
    icon: <UploadIcon />,
    title: 'Import your old resume',
    text: 'Bring in a PDF or Word file. Review every field before it is saved. Photos and birth dates are removed.',
  },
];

const STEPS = [
  { title: 'Add your details once', text: 'Your master profile holds every job, project and skill.' },
  { title: 'Make a resume per role', text: 'Pick what to show, reorder it, choose a template.' },
  { title: 'Check and download', text: 'Fix what the score flags, then download a clean PDF.' },
];

export function WelcomePage() {
  const onboarded = useStore((s) => s.onboarded);
  const loadSample = useStore((s) => s.loadSample);
  const primary = cx(
    'inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700',
    FOCUS_RING,
  );
  const secondary = cx(
    'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
    FOCUS_RING,
  );
  return (
    <div className="w-full">
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-12 sm:pt-20 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <h1 className="text-4xl font-bold leading-[1.08] tracking-[-0.025em] text-slate-950 sm:text-[3.4rem] dark:text-white">
            Get past the resume filter.
          </h1>
          <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            Shortlist builds resumes that applicant tracking systems can read, scores them against the job you want, and shows exactly what
            to fix. Free, private, and it runs entirely in your browser.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {onboarded ? (
              <a href={paths.dashboard()} className={primary}>
                Open my resumes
              </a>
            ) : (
              <a href={paths.start()} className={primary}>
                Build my resume
              </a>
            )}
            <a href={paths.import()} className={secondary}>
              Import an existing resume
            </a>
          </div>
          {!onboarded ? (
            <button
              type="button"
              className={cx(
                'mt-4 rounded text-sm text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
                FOCUS_RING,
              )}
              onClick={() => {
                loadSample();
                toast('Sample data loaded. Replace it with your own any time.');
                window.location.hash = paths.dashboard();
              }}
            >
              Or explore with sample data first
            </button>
          ) : null}
          <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">No sign-up. No uploads. Your data never leaves this device.</p>
        </div>
        <ResumeSheet />
      </section>

      <section className="border-y border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="max-w-xl text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
            Built around how hiring software reads your resume
          </h2>
          <div className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <span className="text-indigo-600 dark:text-indigo-400">{f.icon}</span>
                <h3 className="mt-2 font-semibold text-slate-900 dark:text-slate-100">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">How it works</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-t-2 border-slate-900 pt-4 dark:border-slate-200">
              <span className="text-sm font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">Step {i + 1}</span>
              <h3 className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-slate-950 py-16 text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Your resume stays yours</h2>
            <p className="mt-3 max-w-md leading-relaxed text-slate-300">
              There is no account and no server. Everything is stored in your browser, works offline once loaded, and can be exported as a
              backup file at any time.
            </p>
          </div>
          <ul className="space-y-3 text-slate-200">
            {[
              'Never asks for date of birth, photo, gender, religion or home address',
              'Never invents experience or adds skills you have not confirmed',
              'Install it as an app on your laptop or phone',
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <CheckIcon className="mt-0.5 shrink-0 text-emerald-400" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
