import { fixtureProfile } from './fixtures';
import { describe, expect, it } from 'vitest';
import { analyzeBullet, startsWithActionVerb } from '../src/lib/bullets';
import { analyzeJobDescription } from '../src/lib/jd';
import { countTerm, customTerm, extractTerms, findTerm } from '../src/lib/keywords';
import { resolveResume } from '../src/lib/resolve';
import { scoreResume, SCORE_NOTE } from '../src/lib/score';
import { createVariant } from '../src/lib/seed';
import type { VerifyResult } from '../src/lib/pdf/verify';

const verified: VerifyResult = { pass: true, pages: 1, checks: [{ id: 'images', label: 'No images', pass: true }] };

function strong() {
  const p = fixtureProfile();
  p.personal.linkedin = 'linkedin.com/in/rutwik';
  p.summary =
    'Web developer building fast Shopify, WordPress and React sites with strong technical SEO and Core Web Vitals focus for growing brands.';
  p.skills.push({
    id: 'c9',
    name: 'Web',
    items: ['React', 'Node.js', 'Express', 'MongoDB', 'REST APIs', 'HTML', 'CSS', 'GA4', 'Google Tag Manager'].map((n, i) => ({
      id: `w${i}`,
      name: n,
    })),
  });
  p.experience = [
    {
      id: 'e1',
      company: 'Studio',
      title: 'Web Developer',
      location: 'Mumbai',
      start: '2022-01',
      end: 'present',
      bullets: [
        { id: 'b1', text: 'Built 14 custom Shopify sections in Liquid, cutting landing page build time by 40%.' },
        { id: 'b2', text: 'Improved Core Web Vitals across 9 client sites, reducing LCP from 4.2s to 1.8s.' },
        { id: 'b3', text: 'Configured GA4 and Google Tag Manager conversion tracking for 6 Meta Ads campaigns.' },
      ],
    },
  ];
  p.education = [{ id: 'ed', institution: 'Mumbai University', degree: 'B.Sc. IT', location: '', start: '2018', end: '2021', details: '' }];
  return p;
}

describe('keywords and synonyms', () => {
  it('matches synonyms with boundaries', () => {
    expect(countTerm(findTerm('JavaScript')!, 'Wrote JS and javascript')).toBe(2);
    expect(countTerm(findTerm('JavaScript')!, 'Built with Node.js')).toBe(0);
    expect(countTerm(findTerm('Node.js')!, 'NodeJS, node and Node.js')).toBe(3);
    expect(countTerm(findTerm('React')!, 'React.js apps')).toBe(1);
    expect(countTerm(findTerm('React')!, 'react quickly to issues')).toBe(0);
    expect(countTerm(findTerm('Git')!, 'GitHub')).toBe(0);
    expect(customTerm('Klaviyo').canonical).toBe('Klaviyo');
  });
  it('requires context for ambiguous JD terms', () => {
    expect(extractTerms('Express your ideas clearly.').map((t) => t.canonical)).not.toContain('Express');
    expect(extractTerms('Node.js and Express APIs').map((t) => t.canonical)).toContain('Express');
  });
});

describe('job description analysis', () => {
  it('extracts title, years, skills and tools', () => {
    const jd = analyzeJobDescription(
      'Job Title: Shopify Developer\nWe need 3+ years of experience with Liquid, JavaScript and Klaviyo. Git required.',
    );
    expect(jd.jobTitle).toBe('Shopify Developer');
    expect(jd.minYears).toBe(3);
    expect(jd.hardSkills.map((t) => t.canonical)).toEqual(expect.arrayContaining(['Liquid', 'JavaScript']));
    expect(jd.tools.map((t) => t.canonical)).toEqual(expect.arrayContaining(['Klaviyo', 'Git', 'Shopify']));
  });
});

describe('bullet helper', () => {
  it('flags missing verb, metric and length without rewriting', () => {
    expect(startsWithActionVerb('Built a thing')).toBe(true);
    expect(startsWithActionVerb('Develops APIs')).toBe(true);
    const kinds = analyzeBullet('Responsible for the website').map((i) => i.kind);
    expect(kinds).toEqual(expect.arrayContaining(['weak', 'metric', 'short']));
    expect(analyzeBullet('Built x '.repeat(40)).map((i) => i.kind)).toContain('long');
    expect(analyzeBullet('')).toEqual([]);
  });
});

describe('score engine', () => {
  it('is deterministic and bounded with the estimate note', () => {
    const p = strong();
    const v = createVariant(p, { name: 'Web', preset: 'web' });
    const r = resolveResume(p, v);
    const a = scoreResume({ profile: p, variant: v, resume: r, pages: 1, verify: verified, now: new Date('2026-11-01') });
    const b = scoreResume({ profile: p, variant: v, resume: r, pages: 1, verify: verified, now: new Date('2026-11-01') });
    expect(a).toEqual(b);
    expect(a.total).toBeGreaterThanOrEqual(70);
    expect(a.total).toBeLessThanOrEqual(100);
    expect(a.note).toBe(SCORE_NOTE);
    expect(a.categories.map((c) => c.max)).toEqual([25, 30, 15, 15, 5, 5, 5]);
  });

  it('scores an empty-ish resume low and lists fixes', () => {
    const p = fixtureProfile();
    const v = createVariant(p, { name: 'Web', preset: 'web' });
    const s = scoreResume({ profile: p, variant: v, resume: resolveResume(p, v), pages: 1, verify: verified });
    expect(s.total).toBeLessThan(60);
    expect(s.categories.find((c) => c.id === 'bullets')?.score).toBe(0);
    expect(s.categories.find((c) => c.id === 'sections')?.items.some((i) => i.fix)).toBe(true);
  });

  it('uses the job description, separates confirmed vs unconfirmed missing keywords', () => {
    const p = strong();
    p.skills[0]!.items.push({ id: 'py', name: 'Python' });
    const v = createVariant(p, { name: 'Web', preset: 'web' });
    v.order['skillItems:' + p.skills[0]!.id] = [{ id: 'py', hidden: true }];
    v.jobDescription = 'Looking for a Full Stack Developer with React, Python, Docker and Kubernetes experience.';
    const s = scoreResume({ profile: p, variant: v, resume: resolveResume(p, v), pages: 1, verify: verified });
    expect(s.keywords.source).toBe('job');
    expect(s.keywords.matched).toContain('React');
    expect(s.keywords.missing.find((m) => m.term === 'Python')?.inProfile).toBe(true);
    expect(s.keywords.missing.find((m) => m.term === 'Docker')?.inProfile).toBe(false);
  });

  it('detects and penalises keyword stuffing', () => {
    const p = strong();
    p.summary = 'Shopify Shopify Shopify Shopify Shopify Shopify Shopify Shopify developer.';
    const v = createVariant(p, { name: 'Web', preset: 'web' });
    const clean = strong();
    clean.summary = 'Shopify developer.';
    const cv = createVariant(clean, { name: 'Web', preset: 'web' });
    const base = scoreResume({ profile: clean, variant: cv, resume: resolveResume(clean, cv), pages: 1, verify: verified });
    const s = scoreResume({ profile: p, variant: v, resume: resolveResume(p, v), pages: 1, verify: verified });
    expect(s.keywords.stuffed.map((x) => x.term)).toContain('Shopify');
    expect(base.keywords.stuffed).toEqual([]);
    expect(s.categories[1]!.score).toBeLessThan(base.categories[1]!.score);
  });

  it('suggests spelling out terms implied by MERN', () => {
    const p = fixtureProfile();
    const v = createVariant(p, { name: 'SW', preset: 'software' });
    const s = scoreResume({ profile: p, variant: v, resume: resolveResume(p, v) });
    expect(s.keywords.missing.find((m) => m.term === 'React')?.impliedBy).toBe('MERN');
  });
});
