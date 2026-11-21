import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { analyzeJobDescription } from '../../lib/jd';
import { ROLE_PRESETS } from '../../lib/keywords';
import { clean } from '../../lib/utils';
import { navigate, paths } from '../../router';
import { useStore } from '../../store/useStore';
import { toast } from '../../store/ui';
import { Dialog } from '../../components/Dialog';
import { Button, Select, TextArea, TextField } from '../../components/ui';

const newSchema = z
  .object({
    name: z.string().trim().min(1, 'Give this resume a name').max(80, 'Keep it under 80 characters'),
    preset: z.enum(['web', 'software', 'custom']),
    keywords: z.string(),
  })
  .refine((v) => v.preset !== 'custom' || v.keywords.trim().length > 0, {
    path: ['keywords'],
    message: 'Add a few keywords for this custom role',
  });
type NewForm = z.infer<typeof newSchema>;

export function NewResumeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addVariant = useStore((s) => s.addVariant);
  const { register, handleSubmit, watch, reset, formState } = useForm<NewForm>({
    resolver: zodResolver(newSchema),
    defaultValues: { name: '', preset: 'web', keywords: '' },
  });
  useEffect(() => {
    if (open) reset({ name: '', preset: 'web', keywords: '' });
  }, [open, reset]);
  const preset = watch('preset');
  const submit = handleSubmit((v) => {
    const id = addVariant({
      name: v.name.trim(),
      preset: v.preset,
      customKeywords: v.keywords.split(',').map(clean).filter(Boolean),
      ...(v.preset === 'custom' ? { headline: v.name.trim() } : {}),
    });
    onClose();
    navigate(paths.editor(id));
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New resume"
      description="Uses your master profile. You choose what to show in this resume."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="new-resume-form">
            Create resume
          </Button>
        </>
      }
    >
      <form id="new-resume-form" className="space-y-3" onSubmit={submit} noValidate>
        <TextField
          label="Resume name"
          placeholder="e.g. Shopify Developer"
          autoFocus
          error={formState.errors.name?.message}
          {...register('name')}
        />
        <Select label="Role profile" {...register('preset')}>
          {ROLE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="custom">Custom role (my own keyword list)</option>
        </Select>
        {preset === 'custom' ? (
          <TextArea
            label="Role keywords"
            rows={3}
            placeholder="e.g. Shopify, Liquid, Klaviyo, CRO, A/B testing"
            hint="Comma separated. Used for scoring when no job description is pasted."
            error={formState.errors.keywords?.message}
            {...register('keywords')}
          />
        ) : null}
      </form>
    </Dialog>
  );
}

const renameSchema = z.object({ name: z.string().trim().min(1, 'Name is required').max(80, 'Keep it under 80 characters') });

export function RenameDialog({ open, variantId, onClose }: { open: boolean; variantId: string | null; onClose: () => void }) {
  const variant = useStore((s) => s.variants.find((v) => v.id === variantId));
  const renameVariant = useStore((s) => s.renameVariant);
  const { register, handleSubmit, reset, formState } = useForm<{ name: string }>({
    resolver: zodResolver(renameSchema),
    defaultValues: { name: '' },
  });
  useEffect(() => {
    if (open) reset({ name: variant?.name ?? '' });
  }, [open, variant?.name, reset]);
  const submit = handleSubmit((v) => {
    if (variantId) renameVariant(variantId, v.name.trim());
    onClose();
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Rename resume"
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="rename-form">
            Save
          </Button>
        </>
      }
    >
      <form id="rename-form" onSubmit={submit} noValidate>
        <TextField label="Name" autoFocus error={formState.errors.name?.message} {...register('name')} />
      </form>
    </Dialog>
  );
}

const tailorSchema = z.object({
  company: z.string().trim().min(1, 'Company is required').max(80),
  role: z.string().trim().max(80),
  jobDescription: z.string(),
});
type TailorForm = z.infer<typeof tailorSchema>;

export function TailorDialog({ open, variantId, onClose }: { open: boolean; variantId: string | null; onClose: () => void }) {
  const source = useStore((s) => s.variants.find((v) => v.id === variantId));
  const duplicateVariant = useStore((s) => s.duplicateVariant);
  const { register, handleSubmit, reset, formState, setValue, getValues } = useForm<TailorForm>({
    resolver: zodResolver(tailorSchema),
    defaultValues: { company: '', role: '', jobDescription: '' },
  });
  useEffect(() => {
    if (open) reset({ company: '', role: '', jobDescription: '' });
  }, [open, reset]);
  const submit = handleSubmit((v) => {
    if (!source) return;
    const role = v.role.trim() || analyzeJobDescription(v.jobDescription).jobTitle || source.headline;
    const id = duplicateVariant(source.id, `${v.company.trim()} - ${role || source.name}`, {
      jobDescription: v.jobDescription,
      headline: role || source.headline,
      tags: Array.from(new Set([...source.tags.filter((t) => t !== 'preset'), 'tailored', v.company.trim().toLowerCase()])),
      tailoredFrom: source.id,
    });
    onClose();
    toast('Tailored copy created');
    navigate(paths.editor(id));
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Tailor for this job"
      description={source ? `Creates a copy of "${source.name}" for one application. The original stays unchanged.` : undefined}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="tailor-form">
            Create tailored copy
          </Button>
        </>
      }
    >
      <form id="tailor-form" className="space-y-3" onSubmit={submit} noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Company" autoFocus error={formState.errors.company?.message} {...register('company')} />
          <TextField label="Job title" hint="Leave empty to detect it from the job description." {...register('role')} />
        </div>
        <TextArea
          label="Job description"
          rows={10}
          placeholder="Paste the full job description. Keywords, tools and years of experience will be analysed locally."
          {...register('jobDescription', {
            onBlur: () => {
              if (!getValues('role').trim()) {
                const title = analyzeJobDescription(getValues('jobDescription')).jobTitle;
                if (title) setValue('role', title);
              }
            },
          })}
        />
      </form>
    </Dialog>
  );
}
