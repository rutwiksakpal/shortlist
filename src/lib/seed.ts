import { presetById } from './keywords';
import { EMPTY_COVER_LETTER, SECTION_KEYS, type Layout, type PresetId, type Profile, type Variant, type Workspace } from './schema';
import { defaultFileName, nowIso, uid } from './utils';

export const DEFAULT_LAYOUT: Layout = { template: 'simple', pageSize: 'A4', fontSize: 10.5, spacing: 'normal', margin: 0.7 };

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
 * Fictional sample profile so new visitors can explore the app.
 * Clearly marked as sample data; it is never mixed into a user's own profile.
 */
export function sampleProfile(): Profile {
  const p = emptyProfile();
  p.personal = {
    fullName: 'Alex Morgan',
    headline: 'Full Stack Developer',
    email: 'alex.morgan@example.com',
    phone: '+1 555 010 2030',
    city: 'Austin',
    state: 'TX',
    country: 'USA',
    portfolio: 'alexmorgan.dev',
    github: 'github.com/alexmorgan-sample',
    linkedin: 'linkedin.com/in/alexmorgan-sample',
    otherLinks: [],
  };
  p.summary =
    'Full stack developer with 4 years of experience building fast, accessible web apps with React, Node.js and TypeScript. Known for improving Core Web Vitals and shipping features that move conversion metrics.';
  const item = (name: string) => ({ id: uid('sk'), name });
  p.skills = [
    { id: uid('cat'), name: 'Languages', items: ['JavaScript', 'TypeScript', 'HTML', 'CSS', 'SQL'].map(item) },
    { id: uid('cat'), name: 'Frameworks', items: ['React', 'Next.js', 'Node.js', 'Express', 'Tailwind CSS'].map(item) },
    { id: uid('cat'), name: 'Tools', items: ['Git', 'Docker', 'PostgreSQL', 'MongoDB', 'GA4', 'Jest'].map(item) },
  ];
  const b = (text: string) => ({ id: uid('b'), text });
  p.experience = [
    {
      id: uid('exp'),
      company: 'Brightline Commerce',
      title: 'Full Stack Developer',
      location: 'Austin, TX',
      start: '2022-03',
      end: 'present',
      bullets: [
        b('Built a React and Node.js checkout used by 40,000 monthly customers, lifting conversion by 12%.'),
        b('Reduced Largest Contentful Paint from 3.9s to 1.7s by adding image CDN delivery and code splitting.'),
        b('Led migration of 18 REST endpoints to TypeScript, cutting production errors by 35%.'),
      ],
    },
    {
      id: uid('exp'),
      company: 'Pixel Harbor Studio',
      title: 'Web Developer',
      location: 'Remote',
      start: '2020-06',
      end: '2022-02',
      bullets: [
        b('Delivered 25 client websites on WordPress and Shopify with custom themes and sections.'),
        b('Set up GA4 and Google Tag Manager conversion tracking for 12 ecommerce stores.'),
      ],
    },
  ];
  p.projects = [
    {
      id: uid('prj'),
      name: 'TaskFlow',
      stack: 'Next.js, PostgreSQL, Prisma',
      link: 'github.com/alexmorgan-sample/taskflow',
      bullets: [b('Created a team task board with real-time updates used by 300 beta users.')],
    },
  ];
  p.education = [
    {
      id: uid('edu'),
      institution: 'University of Texas at Austin',
      degree: 'B.S. Computer Science',
      location: 'Austin, TX',
      start: '2016',
      end: '2020',
      details: '',
    },
  ];
  p.certifications = [
    { id: uid('cert'), name: 'AWS Certified Cloud Practitioner', issuer: 'Amazon Web Services', date: '2023-05', link: '' },
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
    coverLetter: { ...EMPTY_COVER_LETTER },
    fileName: defaultFileName(profile.personal.fullName, input.name),
    createdAt: ts,
    updatedAt: ts,
  };
}

/** Brand-new visitor: empty profile, one resume, onboarding not done yet. */
export function seedWorkspace(): Workspace {
  const profile = emptyProfile();
  return {
    version: 1,
    onboarded: false,
    profile,
    variants: [createVariant(profile, { name: 'My resume', preset: 'web' })],
    applications: [],
  };
}

/** Fictional sample workspace for exploring the app. */
export function sampleWorkspace(): Workspace {
  const profile = sampleProfile();
  return {
    version: 1,
    onboarded: true,
    profile,
    variants: [
      createVariant(profile, { name: 'Full Stack Developer', preset: 'software', tags: ['sample'] }),
      createVariant(profile, { name: 'Web Developer', preset: 'web', tags: ['sample'] }),
    ],
    applications: [],
  };
}
