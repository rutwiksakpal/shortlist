import { formatDate, formatRange } from './dates';
import { SECTION_KEYS, SECTION_TITLES, type OrderEntry, type Profile, type SectionKey, type Variant } from './schema';
import { sanitizeForPdf, stripBulletPrefix } from './text';
import { clean } from './utils';
import { displayUrl, isValidUrl, toHref } from './validation';

/**
 * Resolves the master profile + a variant into exactly what is printed.
 * This is the single place that enforces the "no blank space / no empty output" rule:
 * every empty field, entry, bullet, hidden item or empty section is removed here, so the
 * preview and the PDF can never show stray headings, separators or placeholders.
 */

export interface ContactItem {
  kind: 'location' | 'email' | 'phone' | 'link';
  text: string;
  href?: string;
}

export interface LinkOut {
  text: string;
  href: string;
}

export interface ResolvedExperience {
  id: string;
  title: string;
  company: string;
  location: string;
  dates: string;
  bullets: string[];
}

export interface ResolvedProject {
  id: string;
  name: string;
  stack: string;
  link?: LinkOut;
  bullets: string[];
}

export interface ResolvedEducation {
  id: string;
  institution: string;
  degree: string;
  location: string;
  dates: string;
  details: string;
}

export interface ResolvedCertification {
  id: string;
  name: string;
  issuer: string;
  date: string;
  link?: LinkOut;
}

export type ResolvedSection =
  | { key: 'summary'; title: string; text: string }
  | { key: 'skills'; title: string; groups: Array<{ id: string; name: string; items: string[] }> }
  | { key: 'experience'; title: string; entries: ResolvedExperience[] }
  | { key: 'projects'; title: string; entries: ResolvedProject[] }
  | { key: 'education'; title: string; entries: ResolvedEducation[] }
  | { key: 'certifications'; title: string; entries: ResolvedCertification[] }
  | { key: 'achievements'; title: string; items: string[] }
  | { key: 'languages'; title: string; items: string[] };

export interface ResolvedResume {
  name: string;
  headline: string;
  contact: ContactItem[];
  sections: ResolvedSection[];
  meta: { title: string; author: string; subject: string; keywords: string };
}

const s = (value: string | undefined | null): string => sanitizeForPdf(clean(value));

/** Visible ids in variant order. Ids missing from the order list are appended as visible. */
export function visibleIds(order: OrderEntry[] | undefined, ids: string[]): string[] {
  return orderedEntries(order, ids)
    .filter((e) => !e.hidden)
    .map((e) => e.id);
}

/** Every id with its hidden flag, in variant order. Unknown ids are dropped, new ids appended. */
export function orderedEntries(order: OrderEntry[] | undefined, ids: string[]): OrderEntry[] {
  const existing = new Set(ids);
  const seen = new Set<string>();
  const out: OrderEntry[] = [];
  for (const entry of order ?? []) {
    if (existing.has(entry.id) && !seen.has(entry.id)) {
      out.push({ id: entry.id, hidden: entry.hidden });
      seen.add(entry.id);
    }
  }
  for (const id of ids) {
    if (!seen.has(id)) out.push({ id, hidden: false });
  }
  return out;
}

function pick<T extends { id: string }>(items: T[], order: OrderEntry[] | undefined): T[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return visibleIds(
    order,
    items.map((i) => i.id),
  )
    .map((id) => byId.get(id))
    .filter((i): i is T => Boolean(i));
}

function resolveBullets(bullets: Array<{ id: string; text: string }>, order: OrderEntry[] | undefined): string[] {
  return pick(bullets, order)
    .map((b) => s(stripBulletPrefix(b.text)))
    .filter(Boolean);
}

function linkOut(url: string): LinkOut | undefined {
  const v = clean(url);
  if (!v || !isValidUrl(v)) return undefined;
  return { text: sanitizeForPdf(displayUrl(v)), href: toHref(v) };
}

export function resolveContact(profile: Profile): ContactItem[] {
  const p = profile.personal;
  const items: ContactItem[] = [];
  const location = [p.city, p.state, p.country].map(s).filter(Boolean).join(', ');
  if (location) items.push({ kind: 'location', text: location });
  const email = s(p.email);
  if (email) items.push({ kind: 'email', text: email, href: `mailto:${email}` });
  const phone = s(p.phone);
  if (phone) items.push({ kind: 'phone', text: phone, href: `tel:${phone.replace(/[^\d+]/g, '')}` });
  const links = [p.portfolio, p.github, p.linkedin, ...p.otherLinks.map((l) => l.url)];
  for (const url of links) {
    const l = linkOut(url);
    if (l) items.push({ kind: 'link', text: l.text, href: l.href });
  }
  return items;
}

export function sectionOrder(variant: Variant): OrderEntry[] {
  return orderedEntries(variant.order.sections, [...SECTION_KEYS]);
}

export function resolveResume(profile: Profile, variant: Variant): ResolvedResume {
  const name = s(profile.personal.fullName);
  const headline = s(variant.headline) || s(profile.personal.headline);
  const sections: ResolvedSection[] = [];
  const o = variant.order;

  for (const key of visibleIds(o.sections, [...SECTION_KEYS]) as SectionKey[]) {
    const title = SECTION_TITLES[key];
    switch (key) {
      case 'summary': {
        const text = s(variant.summary) || s(profile.summary);
        if (text) sections.push({ key, title, text });
        break;
      }
      case 'skills': {
        const groups = pick(profile.skills, o.skills)
          .map((cat) => ({
            id: cat.id,
            name: s(cat.name),
            items: pick(cat.items, o[`skillItems:${cat.id}`])
              .map((i) => s(i.name))
              .filter(Boolean),
          }))
          .filter((g) => g.items.length > 0);
        if (groups.length) sections.push({ key, title, groups });
        break;
      }
      case 'experience': {
        const entries = pick(profile.experience, o.experience)
          .map((e) => ({
            id: e.id,
            title: s(e.title),
            company: s(e.company),
            location: s(e.location),
            dates: formatRange(e.start, e.end),
            bullets: resolveBullets(e.bullets, o[`bullets:${e.id}`]),
          }))
          .filter((e) => e.title || e.company || e.bullets.length);
        if (entries.length) sections.push({ key, title, entries });
        break;
      }
      case 'projects': {
        const entries = pick(profile.projects, o.projects)
          .map((p) => {
            const link = linkOut(p.link);
            return {
              id: p.id,
              name: s(p.name),
              stack: s(p.stack),
              ...(link ? { link } : {}),
              bullets: resolveBullets(p.bullets, o[`bullets:${p.id}`]),
            };
          })
          .filter((p) => p.name || p.bullets.length);
        if (entries.length) sections.push({ key, title, entries });
        break;
      }
      case 'education': {
        const entries = pick(profile.education, o.education)
          .map((e) => ({
            id: e.id,
            institution: s(e.institution),
            degree: s(e.degree),
            location: s(e.location),
            dates: formatRange(e.start, e.end),
            details: s(e.details),
          }))
          .filter((e) => e.institution || e.degree);
        if (entries.length) sections.push({ key, title, entries });
        break;
      }
      case 'certifications': {
        const entries = pick(profile.certifications, o.certifications)
          .map((c) => {
            const link = linkOut(c.link);
            return {
              id: c.id,
              name: s(c.name),
              issuer: s(c.issuer),
              date: formatDate(c.date),
              ...(link ? { link } : {}),
            };
          })
          .filter((c) => c.name);
        if (entries.length) sections.push({ key, title, entries });
        break;
      }
      case 'achievements': {
        const items = pick(profile.achievements, o.achievements)
          .map((a) => s(stripBulletPrefix(a.text)))
          .filter(Boolean);
        if (items.length) sections.push({ key, title, items });
        break;
      }
      case 'languages': {
        const items = pick(profile.languages, o.languages)
          .map((l) => {
            const n = s(l.name);
            const p = s(l.proficiency);
            return n ? (p ? `${n} (${p})` : n) : '';
          })
          .filter(Boolean);
        if (items.length) sections.push({ key, title, items });
        break;
      }
    }
  }

  const docTitle = [name, headline].filter(Boolean).join(' - ') || 'Resume';
  const keywords = sections.flatMap((sec) => (sec.key === 'skills' ? sec.groups.flatMap((g) => g.items) : [])).join(', ');
  return {
    name,
    headline,
    contact: resolveContact(profile),
    sections,
    meta: { title: docTitle, author: name, subject: headline ? `Resume - ${headline}` : 'Resume', keywords },
  };
}

/** Joins non-empty parts with a separator; never leaves stray separators. */
export function joinFilled(parts: Array<string | undefined>, sep: string): string {
  return parts
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(sep);
}

/** Text lines in the exact reading order the PDF renders. Used by scoring and tests. */
export function resumeLines(r: ResolvedResume): string[] {
  const lines: string[] = [];
  if (r.name) lines.push(r.name);
  if (r.headline) lines.push(r.headline);
  if (r.contact.length) lines.push(r.contact.map((c) => c.text).join(' | '));
  for (const sec of r.sections) {
    lines.push(sec.title.toUpperCase());
    switch (sec.key) {
      case 'summary':
        lines.push(sec.text);
        break;
      case 'skills':
        for (const g of sec.groups) lines.push(g.name ? `${g.name}: ${g.items.join(', ')}` : g.items.join(', '));
        break;
      case 'experience':
        for (const e of sec.entries) {
          lines.push(joinFilled([joinFilled([e.title, e.company], ', '), e.location, e.dates], ' | '));
          lines.push(...e.bullets);
        }
        break;
      case 'projects':
        for (const p of sec.entries) {
          lines.push(joinFilled([p.name, p.stack, p.link?.text], ' | '));
          lines.push(...p.bullets);
        }
        break;
      case 'education':
        for (const e of sec.entries) {
          lines.push(joinFilled([joinFilled([e.degree, e.institution], ', '), e.location, e.dates], ' | '));
          if (e.details) lines.push(e.details);
        }
        break;
      case 'certifications':
        for (const c of sec.entries) lines.push(joinFilled([c.name, c.issuer, c.date, c.link?.text], ' | '));
        break;
      case 'achievements':
        lines.push(...sec.items);
        break;
      case 'languages':
        lines.push(sec.items.join(', '));
        break;
    }
  }
  return lines;
}

export function resumePlainText(r: ResolvedResume): string {
  return resumeLines(r).join('\n');
}

/** All bullets printed in experience and projects, with their entry context. */
export function printedBullets(r: ResolvedResume): Array<{ text: string; ended: boolean }> {
  const out: Array<{ text: string; ended: boolean }> = [];
  for (const sec of r.sections) {
    if (sec.key === 'experience') {
      for (const e of sec.entries) {
        const ended = !/Present$/.test(e.dates);
        for (const b of e.bullets) out.push({ text: b, ended });
      }
    }
    if (sec.key === 'projects') {
      for (const p of sec.entries) for (const b of p.bullets) out.push({ text: b, ended: false });
    }
  }
  return out;
}
