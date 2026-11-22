import { emptyProfile } from '../src/lib/seed';
import type { Profile } from '../src/lib/schema';
import { uid } from '../src/lib/utils';

/** Test-only profile (fake contact details). Experience, projects and education are empty. */
export function fixtureProfile(): Profile {
  const p = emptyProfile();
  p.personal = {
    fullName: 'Rutwik Sakpal',
    headline: 'Web Developer',
    email: 'work@example.dev',
    phone: '+91 90000 12345',
    city: 'Thane, Mumbai',
    state: '',
    country: 'India',
    portfolio: 'example.dev',
    github: 'github.com/rutwiksakpal',
    linkedin: '',
    otherLinks: [],
  };
  const item = (name: string) => ({ id: uid('sk'), name });
  p.skills = [
    { id: uid('cat'), name: 'Languages', items: [item('JavaScript'), item('TypeScript')] },
    { id: uid('cat'), name: 'Stacks', items: [item('MERN')] },
    { id: uid('cat'), name: 'CMS & Platforms', items: [item('Shopify/Liquid'), item('WordPress/Elementor'), item('GoHighLevel')] },
    { id: uid('cat'), name: 'Marketing', items: [item('SEO')] },
  ];
  return p;
}
