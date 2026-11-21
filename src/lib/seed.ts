import { presetById } from './keywords';
import { SECTION_KEYS, type Layout, type PresetId, type Profile, type Variant, type Workspace } from './schema';
import { defaultFileName, nowIso, uid } from './utils';

export const DEFAULT_LAYOUT: Layout = { pageSize: 'A4', fontSize: 10.5, spacing: 'normal', margin: 0.7 };

export function emptyProfile(): Profile {
  return {
    personal: {
      fullName: '',
      headline: '',
      email: '',
      phone: '',
      city: '',
      state: '',
      country: '',
      portfolio: '',
      github: '',
      linkedin: '',
      otherLinks: [],
    },
    summary: '',
    skills: [],
    experience: [],
    projects: [],
    education: [],
    certifications: [],
    achievements: [],
    languages: [],
  };
}

/**
 * Seed data from the brief. Experience, projects and education are intentionally empty:
 * no employment history is invented.
 */
export function seedProfile(): Profile {
  const p = emptyProfile();
  p.personal = {
    fullName: 'Rutwik Sakpal',
    headline: 'Web Developer',
    email: 'work@codewithrutwik.space',
    phone: '+91 9637782385',
    city: 'Thane, Mumbai',
    state: '',
    country: 'India',
    portfolio: 'codewithrutwik.space',
    github: 'github.com/rutwiksakpal',
    linkedin: '',
    otherLinks: [],
  };
  const item = (name: string) => ({ id: uid('sk'), name });
  p.skills = [
    { id: uid('cat'), name: 'Languages', items: [item('JavaScript'), item('TypeScript')] },
    { id: uid('cat'), name: 'Stacks', items: [item('MERN')] },
    {
      id: uid('cat'),
      name: 'CMS & Platforms',
      items: [item('Shopify/Liquid'), item('WordPress/Elementor'), item('GoHighLevel')],
    },
    { id: uid('cat'), name: 'Marketing', items: [item('SEO')] },
  ];
  return p;
}

export interface NewVariantInput {
  name: string;
  preset: PresetId;
  headline?: string;
  summary?: string;
  customKeywords?: string[];
  tags?: string[];
}

export function createVariant(profile: Profile, input: NewVariantInput): Variant {
  const preset = input.preset === 'custom' ? undefined : presetById(input.preset);
  const headline = input.headline ?? preset?.headline ?? profile.personal.headline;
  const ts = nowIso();
  return {
    id: uid('var'),
    name: input.name,
    preset: input.preset,
    customKeywords: input.customKeywords ?? [],
    tags: input.tags ?? [],
    headline,
    summary: input.summary ?? profile.summary,
    order: { sections: SECTION_KEYS.map((id) => ({ id, hidden: false })) },
    layout: { ...DEFAULT_LAYOUT },
    jobDescription: '',
    fileName: defaultFileName(profile.personal.fullName, input.name),
    createdAt: ts,
    updatedAt: ts,
  };
}

export function seedWorkspace(): Workspace {
  const profile = seedProfile();
  return {
    version: 1,
    profile,
    variants: [
      createVariant(profile, { name: 'Web Developer', preset: 'web', tags: ['preset'] }),
      createVariant(profile, { name: 'Software Developer', preset: 'software', tags: ['preset'] }),
    ],
    applications: [],
  };
}
