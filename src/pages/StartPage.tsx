import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ROLE_PRESETS } from '../lib/keywords';
import { isValidEmail, isValidPhone, isValidUrl } from '../lib/validation';
import { requestPersistentStorage } from '../lib/pwa';
import { navigate, paths } from '../router';
import { useStore } from '../store/useStore';
import { CheckIcon } from '../components/icons';
import { Button, TextField } from '../components/ui';
import { cx, FOCUS_RING } from '../components/cx';

const optional = (check: (v: string) => boolean, msg: string) =>
  z
    .string()
    .trim()
    .refine((v) => !v || check(v), msg);

const schema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name'),
  headline: z.string().trim().min(2, 'Enter the job title you are aiming for'),
  email: z.string().trim().refine(isValidEmail, 'Enter a valid email'),
  phone: optional(isValidPhone, 'Include the country code, e.g. +91 98765 43210'),
  city: z.string().trim(),
  country: z.string().trim(),
  linkedin: optional(isValidUrl, 'Enter a valid link'),
  github: optional(isValidUrl, 'Enter a valid link'),
  portfolio: optional(isValidUrl, 'Enter a valid link'),
  preset: z.enum(['web', 'software', 'custom']),
});
type Form = z.infer<typeof schema>;

const STEPS = ['About you', 'Contact', 'Target role'] as const;
const STEP_FIELDS: Array<Array<keyof Form>> = [
  ['fullName', 'headline'],
  ['email', 'phone', 'city', 'country', 'linkedin', 'github', 'portfolio'],
  ['preset'],
];

const ROLE_OPTIONS = [
  ...ROLE_PRESETS.map((p) => ({
    id: p.id,
    name: p.name,
    text: `Scored against ${p.keywords.length} common ${p.name.toLowerCase()} keywords.`,
  })),
  { id: 'custom' as const, name: 'Another role', text: 'Add your own keywords later, or paste a job description.' },
];

export function StartPage() {
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const { register, handleSubmit, trigger, watch, setValue, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      fullName: '',
      headline: '',
      email: '',
      phone: '',
      city: '',
      country: '',
      linkedin: '',
      github: '',
      portfolio: '',
      preset: 'web',
    },
  });
  const preset = watch('preset');
  const e = formState.errors;

  const next = async () => {
    if (await trigger(STEP_FIELDS[step])) setStep((s) => s + 1);
  };
  const finish = handleSubmit((v) => {
    const id = completeOnboarding({ ...v, roleName: v.headline });
    void requestPersistentStorage();
    navigate(paths.editor(id));
  });

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Let's set up your profile</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Three quick steps. You can change everything later. Already have a resume?{' '}
        <a href={paths.import()} className={cx('rounded text-indigo-700 underline dark:text-indigo-300', FOCUS_RING)}>
          Import it instead
        </a>
        .
      </p>

      <ol className="mt-6 flex gap-2" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1" aria-current={i === step ? 'step' : undefined}>
            <span className={cx('block h-1 rounded-full', i <= step ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800')} />
            <span
              className={cx('mt-1.5 block text-xs', i === step ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-500')}
            >
              {i < step ? <CheckIcon size={12} className="mr-1 inline text-emerald-600" /> : null}
              {label}
            </span>
          </li>
        ))}
      </ol>

      <form
        className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (step < STEPS.length - 1) void next();
          else void finish();
        }}
        noValidate
      >
        {step === 0 ? (
          <>
            <TextField label="Full name" autoComplete="name" autoFocus error={e.fullName?.message} {...register('fullName')} />
            <TextField
              label="Job title you are aiming for"
              placeholder="e.g. Frontend Developer"
              hint="Shown under your name as your headline."
              error={e.headline?.message}
              {...register('headline')}
            />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Email" type="email" autoComplete="email" autoFocus error={e.email?.message} {...register('email')} />
              <TextField label="Phone (optional)" type="tel" autoComplete="tel" error={e.phone?.message} {...register('phone')} />
              <TextField label="City (optional)" autoComplete="address-level2" {...register('city')} />
              <TextField label="Country (optional)" autoComplete="country-name" {...register('country')} />
            </div>
            <p className="text-xs text-slate-500">Only city and country are printed. Never add a street address, date of birth or photo.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="LinkedIn (optional)"
                placeholder="linkedin.com/in/you"
                error={e.linkedin?.message}
                {...register('linkedin')}
              />
              <TextField label="GitHub (optional)" placeholder="github.com/you" error={e.github?.message} {...register('github')} />
              <TextField
                label="Portfolio (optional)"
                placeholder="yourname.dev"
                wrapperClassName="sm:col-span-2"
                error={e.portfolio?.message}
                {...register('portfolio')}
              />
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Which kind of role is this resume for?</legend>
            <div className="space-y-2" role="radiogroup">
              {ROLE_OPTIONS.map((o) => (
                <label
                  key={o.id}
                  className={cx(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                    preset === o.id
                      ? 'border-indigo-600 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/50'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-700',
                  )}
                >
                  <input
                    type="radio"
                    value={o.id}
                    checked={preset === o.id}
                    onChange={() => setValue('preset', o.id)}
                    className="mt-1 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    <span className="block text-sm font-semibold">{o.name}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{o.text}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="flex items-center justify-between pt-2">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button variant="primary" type="submit">
            {step < STEPS.length - 1 ? 'Continue' : 'Create my resume'}
          </Button>
        </div>
      </form>
    </div>
  );
}
