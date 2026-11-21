import type { Profile } from '../../lib/schema';

export function countFilled(p: Profile) {
  return {
    skills: p.skills.reduce((n, c) => n + c.items.length, 0),
    experience: p.experience.length,
    projects: p.projects.length,
    education: p.education.length,
    certifications: p.certifications.length,
    achievements: p.achievements.length,
    languages: p.languages.length,
  };
}
