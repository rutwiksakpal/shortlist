import { z } from 'zod';

/**
 * Data model for Shortlist.
 *
 * HARD EXCLUSIONS: there are intentionally no fields for date of birth, age, gender,
 * marital status, nationality, religion, photo or full street address. Schemas are
 * strict at the profile level so such keys can never be smuggled in through imports.
 */

export const SECTION_KEYS = [
  'summary',
  'skills',
  'experience',
  'projects',
  'education',
  'certifications',
  'achievements',
  'languages',
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_TITLES: Record<SectionKey, string> = {
  summary: 'Summary',
  skills: 'Skills',
  experience: 'Experience',
  projects: 'Projects',
  education: 'Education',
  certifications: 'Certifications',
  achievements: 'Achievements',
  languages: 'Languages',
};

/** "YYYY" or "YYYY-MM". Empty string means not set. */
export const partialDateSchema = z.string().regex(/^(\d{4}(-(0[1-9]|1[0-2]))?)?$/, 'Use a valid month and year');

/** Same as partialDateSchema, plus the literal "present". */
export const endDateSchema = z.union([partialDateSchema, z.literal('present')]);

const id = z.string().min(1);

export const bulletSchema = z.object({ id, text: z.string() });
export type Bullet = z.infer<typeof bulletSchema>;

export const linkSchema = z.object({ id, label: z.string(), url: z.string() });
export type OtherLink = z.infer<typeof linkSchema>;

export const personalSchema = z
  .object({
    fullName: z.string(),
    headline: z.string(),
    email: z.string(),
    phone: z.string(),
    city: z.string(),
    state: z.string(),
    country: z.string(),
    portfolio: z.string(),
    github: z.string(),
    linkedin: z.string(),
    otherLinks: z.array(linkSchema),
  })
  .strict();
export type Personal = z.infer<typeof personalSchema>;

export const skillItemSchema = z.object({ id, name: z.string() });
export type SkillItem = z.infer<typeof skillItemSchema>;

export const skillCategorySchema = z.object({ id, name: z.string(), items: z.array(skillItemSchema) });
export type SkillCategory = z.infer<typeof skillCategorySchema>;

export const experienceSchema = z.object({
  id,
  company: z.string(),
  title: z.string(),
  location: z.string(),
  start: partialDateSchema,
  end: endDateSchema,
  bullets: z.array(bulletSchema),
});
export type Experience = z.infer<typeof experienceSchema>;

export const projectSchema = z.object({
  id,
  name: z.string(),
  stack: z.string(),
  link: z.string(),
  bullets: z.array(bulletSchema),
});
export type Project = z.infer<typeof projectSchema>;

export const educationSchema = z.object({
  id,
  institution: z.string(),
  degree: z.string(),
  location: z.string(),
  start: partialDateSchema,
  end: endDateSchema,
  details: z.string(),
});
export type Education = z.infer<typeof educationSchema>;

export const certificationSchema = z.object({
  id,
  name: z.string(),
  issuer: z.string(),
  date: partialDateSchema,
  link: z.string(),
});
export type Certification = z.infer<typeof certificationSchema>;

export const achievementSchema = z.object({ id, text: z.string() });
export type Achievement = z.infer<typeof achievementSchema>;

export const languageSchema = z.object({ id, name: z.string(), proficiency: z.string() });
export type Language = z.infer<typeof languageSchema>;

export const profileSchema = z
  .object({
    personal: personalSchema,
    summary: z.string(),
    skills: z.array(skillCategorySchema),
    experience: z.array(experienceSchema),
    projects: z.array(projectSchema),
    education: z.array(educationSchema),
    certifications: z.array(certificationSchema),
    achievements: z.array(achievementSchema),
    languages: z.array(languageSchema),
  })
  .strict();
export type Profile = z.infer<typeof profileSchema>;

/** Ordered visibility list entry used by variants. */
export const orderEntrySchema = z.object({ id: z.string(), hidden: z.boolean() });
export type OrderEntry = z.infer<typeof orderEntrySchema>;

export const PRESET_IDS = ['web', 'software', 'custom'] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export const FONT_SIZES = [10, 10.5, 11] as const;
export const SPACINGS = ['compact', 'normal', 'relaxed'] as const;
export const MARGINS = [0.6, 0.7, 0.8] as const;

export const layoutSchema = z.object({
  pageSize: z.enum(['A4', 'LETTER']),
  fontSize: z.union([z.literal(10), z.literal(10.5), z.literal(11)]),
  spacing: z.enum(SPACINGS),
  margin: z.union([z.literal(0.6), z.literal(0.7), z.literal(0.8)]),
});
export type Layout = z.infer<typeof layoutSchema>;

export const variantSchema = z.object({
  id,
  name: z.string().min(1),
  preset: z.enum(PRESET_IDS),
  customKeywords: z.array(z.string()),
  tags: z.array(z.string()),
  headline: z.string(),
  summary: z.string(),
  /**
   * Ordered visibility lists. Keys:
   * - "sections"                     order of SectionKey
   * - "skills"                       order of skill category ids
   * - "skillItems:<categoryId>"      order of skill items
   * - "experience" | "projects" | "education" | "certifications" | "achievements" | "languages"
   * - "bullets:<entryId>"            order of bullets in an experience/project entry
   */
  order: z.record(z.string(), z.array(orderEntrySchema)),
  layout: layoutSchema,
  jobDescription: z.string(),
  fileName: z.string(),
  tailoredFrom: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Variant = z.infer<typeof variantSchema>;

export const APPLICATION_STATUSES = ['Applied', 'Interview', 'Rejected', 'Offer'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const applicationSchema = z.object({
  id,
  company: z.string().min(1),
  role: z.string().min(1),
  jobLink: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  variantId: z.string(),
  variantName: z.string(),
  status: z.enum(APPLICATION_STATUSES),
  notes: z.string(),
});
export type Application = z.infer<typeof applicationSchema>;

export const workspaceSchema = z.object({
  version: z.literal(1),
  profile: profileSchema,
  variants: z.array(variantSchema).min(1),
  applications: z.array(applicationSchema),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const snapshotSchema = z.object({
  id,
  createdAt: z.string(),
  label: z.string(),
  profile: profileSchema,
  variants: z.array(variantSchema).min(1),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

/** Full JSON backup format. */
export const backupSchema = z.object({
  app: z.literal('shortlist'),
  exportedAt: z.string(),
  workspace: workspaceSchema,
  snapshots: z.array(snapshotSchema).optional(),
});
export type Backup = z.infer<typeof backupSchema>;

export const LIST_SECTIONS = ['experience', 'projects', 'education', 'certifications', 'achievements', 'languages'] as const;
export type ListSection = (typeof LIST_SECTIONS)[number];
