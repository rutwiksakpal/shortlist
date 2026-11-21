import { createVariant } from '../seed';
import { LIST_SECTIONS, type ListSection, type OrderEntry, type Personal, type Profile, type Variant } from '../schema';
import { clean, deepClone, uid } from '../utils';
import type { UnmappedLine } from './parse';

export type UnmappedTarget =
  | { kind: 'discard' }
  | { kind: 'summary' }
  | { kind: 'achievement' }
  | { kind: 'skill' }
  | { kind: 'certification' }
  | { kind: 'language' }
  | { kind: 'bullet'; entryId: string };

export type PersonalMode = 'fill-empty' | 'replace' | 'keep';

/** Applies the user's choices for lines the parser could not place. */
export function assignUnmapped(draft: Profile, lines: UnmappedLine[], targets: Record<string, UnmappedTarget>): Profile {
  const p = deepClone(draft);
  for (const line of lines) {
    const t = targets[line.id] ?? { kind: 'discard' };
    const text = clean(line.text);
    if (!text) continue;
    switch (t.kind) {
      case 'discard':
        break;
      case 'summary':
        p.summary = clean(`${p.summary} ${text}`);
        break;
      case 'achievement':
        p.achievements.push({ id: uid('ach'), text });
        break;
      case 'skill': {
        let cat = p.skills.find((c) => c.name === 'Skills');
        if (!cat) {
          cat = { id: uid('cat'), name: 'Skills', items: [] };
          p.skills.push(cat);
        }
        for (const name of text
          .split(/\s*[,|;]\s*/)
          .map(clean)
          .filter(Boolean))
          cat.items.push({ id: uid('sk'), name });
        break;
      }
      case 'certification':
        p.certifications.push({ id: uid('cert'), name: text, issuer: '', date: '', link: '' });
        break;
      case 'language':
        p.languages.push({ id: uid('lang'), name: text, proficiency: '' });
        break;
      case 'bullet': {
        const entry = p.experience.find((e) => e.id === t.entryId) ?? p.projects.find((e) => e.id === t.entryId);
        entry?.bullets.push({ id: uid('b'), text });
        break;
      }
    }
  }
  return p;
}

function mergePersonal(master: Personal, incoming: Personal, mode: PersonalMode): Personal {
  if (mode === 'keep') return master;
  const out: Personal = { ...master, otherLinks: [...master.otherLinks] };
  const keys = ['fullName', 'headline', 'email', 'phone', 'city', 'state', 'country', 'portfolio', 'github', 'linkedin'] as const;
  for (const k of keys) {
    const v = clean(incoming[k]);
    if (!v) continue;
    if (mode === 'replace' || !clean(out[k])) out[k] = v;
  }
  for (const l of incoming.otherLinks) {
    if (clean(l.url) && !out.otherLinks.some((x) => x.url === l.url)) out.otherLinks.push(l);
  }
  return out;
}

export interface ApplyResult {
  profile: Profile;
  variant: Variant;
}

/**
 * Merges the reviewed import into the master profile and creates a resume (variant) that
 * shows exactly the imported content. Existing master items stay, hidden in the new variant.
 */
export function applyImport(master: Profile, imported: Profile, name: string, mode: PersonalMode): ApplyResult {
  const profile = deepClone(master);
  profile.personal = mergePersonal(master.personal, imported.personal, mode);
  if (!clean(profile.summary) && clean(imported.summary)) profile.summary = imported.summary;

  const importedIds: Record<ListSection, Set<string>> = {
    experience: new Set(imported.experience.map((x) => x.id)),
    projects: new Set(imported.projects.map((x) => x.id)),
    education: new Set(imported.education.map((x) => x.id)),
    certifications: new Set(imported.certifications.map((x) => x.id)),
    achievements: new Set(imported.achievements.map((x) => x.id)),
    languages: new Set(imported.languages.map((x) => x.id)),
  };
  profile.experience.push(...imported.experience);
  profile.projects.push(...imported.projects);
  profile.education.push(...imported.education);
  profile.certifications.push(...imported.certifications);
  profile.achievements.push(...imported.achievements);
  profile.languages.push(...imported.languages);

  // Skills: merge into same-named categories, de-duplicated case-insensitively.
  const visibleCats = new Set<string>();
  const visibleItems = new Map<string, Set<string>>();
  for (const cat of imported.skills) {
    let target = profile.skills.find((c) => c.name.trim().toLowerCase() === cat.name.trim().toLowerCase());
    if (!target) {
      target = { id: cat.id, name: cat.name, items: [] };
      profile.skills.push(target);
    }
    visibleCats.add(target.id);
    const vis = visibleItems.get(target.id) ?? new Set<string>();
    for (const item of cat.items) {
      const existing = target.items.find((i) => i.name.trim().toLowerCase() === item.name.trim().toLowerCase());
      if (existing) vis.add(existing.id);
      else {
        target.items.push(item);
        vis.add(item.id);
      }
    }
    visibleItems.set(target.id, vis);
  }

  const variant = createVariant(profile, {
    name,
    preset: 'custom',
    headline: clean(imported.personal.headline) || profile.personal.headline,
    summary: clean(imported.summary) || profile.summary,
    tags: ['imported'],
  });
  const order = (ids: string[], visible: Set<string>): OrderEntry[] => ids.map((id) => ({ id, hidden: !visible.has(id) }));
  for (const key of LIST_SECTIONS) {
    variant.order[key] = order(
      profile[key].map((x) => x.id),
      importedIds[key],
    );
  }
  variant.order.skills = order(
    profile.skills.map((c) => c.id),
    visibleCats,
  );
  for (const cat of profile.skills) {
    variant.order[`skillItems:${cat.id}`] = order(
      cat.items.map((i) => i.id),
      visibleItems.get(cat.id) ?? new Set(),
    );
  }
  return { profile, variant };
}
