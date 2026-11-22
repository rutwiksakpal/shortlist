import type { Profile, Variant } from '../../lib/schema';
import { clean, wordCount } from '../../lib/utils';

export interface StrengthItem {
  id: string;
  label: string;
  done: boolean;
  panel: string;
}

/** Profile strength checklist. Each item links to the editor panel that fixes it. */
export function profileStrength(profile: Profile, variant: Variant): { percent: number; items: StrengthItem[] } {
  const p = profile.personal;
  const skills = profile.skills.reduce((n, c) => n + c.items.length, 0);
  const summary = clean(variant.summary) || clean(profile.summary);
  const bullets = [...profile.experience, ...profile.projects].reduce((n, e) => n + e.bullets.filter((b) => clean(b.text)).length, 0);
  const items: StrengthItem[] = [
    { id: 'name', label: 'Name and email', done: Boolean(clean(p.fullName) && clean(p.email)), panel: 'panel-personal' },
    { id: 'phone', label: 'Phone number', done: Boolean(clean(p.phone)), panel: 'panel-personal' },
    {
      id: 'links',
      label: 'LinkedIn or portfolio',
      done: Boolean(clean(p.linkedin) || clean(p.portfolio) || clean(p.github)),
      panel: 'panel-personal',
    },
    { id: 'headline', label: 'Target job title', done: Boolean(clean(variant.headline) || clean(p.headline)), panel: 'panel-target' },
    { id: 'summary', label: 'Summary (30+ words)', done: wordCount(summary) >= 30, panel: 'panel-target' },
    { id: 'skills', label: '8+ skills', done: skills >= 8, panel: 'panel-skills' },
    {
      id: 'work',
      label: 'Experience or a project',
      done: profile.experience.length + profile.projects.length > 0,
      panel: 'panel-experience',
    },
    { id: 'bullets', label: '4+ achievement bullets', done: bullets >= 4, panel: 'panel-experience' },
    { id: 'education', label: 'Education', done: profile.education.length > 0, panel: 'panel-education' },
  ];
  const percent = Math.round((items.filter((i) => i.done).length / items.length) * 100);
  return { percent, items };
}

export const OPEN_PANEL_EVENT = 'shortlist:open-panel';

export function openPanel(id: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_PANEL_EVENT, { detail: id }));
}
