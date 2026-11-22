import { resolveContact, type ContactItem } from './resolve';
import type { Profile, Variant } from './schema';
import { sanitizeForPdf } from './text';
import { clean, fileSafe, wordCount } from './utils';

export interface ResolvedCoverLetter {
  name: string;
  headline: string;
  contact: ContactItem[];
  date: string;
  recipient: string[];
  greeting: string;
  paragraphs: string[];
  closing: string;
  signature: string;
  meta: { title: string; author: string };
}

const s = (v: string) => sanitizeForPdf(clean(v));

export function formatLetterDate(d: Date = new Date()): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function splitParagraphs(body: string): string[] {
  return body
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => s(p))
    .filter(Boolean);
}

/** Exactly what is printed. Empty lines and fields are omitted. */
export function resolveCoverLetter(profile: Profile, variant: Variant, now: Date = new Date()): ResolvedCoverLetter {
  const c = variant.coverLetter;
  const name = s(profile.personal.fullName);
  const headline = s(variant.headline) || s(profile.personal.headline);
  const recipient = [s(c.hiringManager), s(c.company)].filter(Boolean);
  const manager = s(c.hiringManager);
  const role = s(c.role);
  return {
    name,
    headline,
    contact: resolveContact(profile),
    date: c.includeDate ? formatLetterDate(now) : '',
    recipient,
    greeting: manager ? `Dear ${manager},` : 'Dear Hiring Manager,',
    paragraphs: splitParagraphs(c.body),
    closing: s(c.closing) || 'Sincerely,',
    signature: name,
    meta: {
      title: [name, 'Cover Letter', role || s(c.company)].filter(Boolean).join(' - '),
      author: name,
    },
  };
}

/**
 * Builds a starter structure from data the user has already confirmed (headline, visible
 * skills, most recent role). It never invents achievements; the user writes those.
 */
export function starterDraft(profile: Profile, variant: Variant, skills: string[]): string {
  const c = variant.coverLetter;
  const role = clean(c.role) || clean(variant.headline) || 'this';
  const company = clean(c.company) || 'your company';
  const headline = clean(variant.headline) || clean(profile.personal.headline);
  const top = skills.slice(0, 4);
  const latest = profile.experience.find((e) => e.end === 'present') ?? profile.experience[0];
  const skillText = top.length > 1 ? `${top.slice(0, -1).join(', ')} and ${top[top.length - 1]}` : (top[0] ?? '');
  const p1 = `I am writing to apply for the ${role} role at ${company}.${headline ? ` As a ${headline}${skillText ? ` working with ${skillText}` : ''}, I would welcome the chance to contribute to your team.` : ''}`;
  const p2 = latest
    ? `In my ${latest.end === 'present' ? 'current' : 'recent'} role as ${clean(latest.title) || 'a developer'}${clean(latest.company) ? ` at ${clean(latest.company)}` : ''}, I [describe one specific result with a real number].`
    : `[Describe one project or result that shows you can do this job, with a real number if you have one].`;
  const p3 = `[Explain why ${company} specifically interests you and how your skills match what the job asks for].`;
  const p4 = `Thank you for your time and consideration. I would be glad to discuss how I can help ${company}.`;
  return [p1, p2, p3, p4].join('\n\n');
}

export interface LetterCheck {
  placeholders: string[];
  words: number;
  issues: string[];
}

export function checkCoverLetter(variant: Variant): LetterCheck {
  const body = variant.coverLetter.body;
  const placeholders = Array.from(body.matchAll(/\[[^\]]{1,200}\]/g)).map((m) => m[0]);
  const words = wordCount(body);
  const issues: string[] = [];
  if (!clean(body)) issues.push('The letter is empty.');
  if (placeholders.length)
    issues.push(`Replace ${placeholders.length} bracketed placeholder${placeholders.length === 1 ? '' : 's'} with your own words.`);
  if (words > 0 && words < 150) issues.push(`Only ${words} words. Most cover letters are 250-400 words.`);
  if (words > 450) issues.push(`${words} words. Keep it under 400 so it fits on one page.`);
  if (!clean(variant.coverLetter.company)) issues.push('Add the company name.');
  return { placeholders, words, issues };
}

export function coverLetterFileName(fullName: string, company: string): string {
  return [fileSafe(fullName) || 'Cover', fileSafe(company), 'Cover_Letter'].filter(Boolean).join('_') + '.pdf';
}
