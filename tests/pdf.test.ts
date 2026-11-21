// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveResume } from '../src/lib/resolve';
import { createVariant, DEFAULT_LAYOUT, emptyProfile, seedProfile } from '../src/lib/seed';
import { countPdfPages } from '../src/lib/pdf/render';
import { verifyTextLayer } from '../src/lib/pdf/verify';
import type { Profile } from '../src/lib/schema';
import { extractNode, renderNode } from './helpers';

function fullProfile(): Profile {
  const p = seedProfile();
  p.personal.linkedin = 'linkedin.com/in/example';
  p.summary = 'Web developer building fast Shopify and React sites with a focus on Core Web Vitals.';
  p.experience = [
    {
      id: 'e1',
      company: 'Example Studio',
      title: 'Web Developer',
      location: 'Mumbai, India',
      start: '2023-01',
      end: 'present',
      bullets: [
        { id: 'b1', text: 'Built 12 custom Shopify sections, cutting page build time by 40%.' },
        { id: 'b2', text: '' },
        { id: 'b3', text: 'Improved LCP from 4.1s to 1.9s – using “lazy” loading → ₹ savings 🚀' },
      ],
    },
  ];
  p.projects = [
    {
      id: 'p1',
      name: 'Shortlist',
      stack: '',
      link: 'github.com/rutwiksakpal/shortlist',
      bullets: [{ id: 'pb', text: 'Created an ATS resume builder.' }],
    },
  ];
  p.education = [
    { id: 'ed', institution: 'Mumbai University', degree: 'B.Sc. Computer Science', location: '', start: '2018', end: '2021', details: '' },
  ];
  return p;
}

describe('PDF export', () => {
  it('produces real selectable text that passes the text-layer check', async () => {
    const p = fullProfile();
    const v = createVariant(p, { name: 'Web Developer', preset: 'web' });
    const r = resolveResume(p, v);
    const bytes = await renderNode(r, DEFAULT_LAYOUT);
    const ex = await extractNode(bytes);
    const result = verifyTextLayer(ex, r);
    expect(result.checks.filter((c) => !c.pass)).toEqual([]);
    expect(ex.title).toBe('Rutwik Sakpal - Web Developer');
    expect(ex.author).toBe('Rutwik Sakpal');
    expect(ex.imageCount).toBe(0);
    expect(countPdfPages(bytes)).toBe(ex.pages);
    const text = ex.lines.join('\n');
    expect(text).toContain('work@codewithrutwik.space | +91 9637782385 | codewithrutwik.space');
    expect(text).toContain('Jan 2023 - Present');
    expect(text).toContain('Improved LCP from 4.1s to 1.9s - using "lazy" loading -> INR savings');
    expect(text).not.toMatch(/🚀|�/);
  });

  it('empty fields produce no output in the PDF (no headings, separators or placeholders)', async () => {
    const p = emptyProfile();
    p.personal.fullName = 'Asha Rao';
    p.personal.email = 'asha@example.com';
    p.experience = [{ id: 'e', company: '', title: 'Developer', location: '', start: '', end: '', bullets: [{ id: 'b', text: ' ' }] }];
    p.projects = [{ id: 'p', name: '', stack: '', link: '', bullets: [] }];
    p.skills = [{ id: 'c', name: 'Tools', items: [] }];
    const v = createVariant(p, { name: 'X', preset: 'custom', headline: '' });
    const r = resolveResume(p, v);
    const ex = await extractNode(await renderNode(r, DEFAULT_LAYOUT));
    expect(ex.lines).toEqual(['Asha Rao', 'asha@example.com', 'EXPERIENCE', 'Developer']);
    const text = ex.lines.join('\n');
    for (const bad of ['SKILLS', 'PROJECTS', 'SUMMARY', 'EDUCATION', 'N/A', '|', '•']) expect(text).not.toContain(bad);
  });

  it('page size toggles between A4 and US Letter', async () => {
    const p = fullProfile();
    const v = createVariant(p, { name: 'Web', preset: 'web' });
    const r = resolveResume(p, v);
    const a4 = await renderNode(r, { ...DEFAULT_LAYOUT, pageSize: 'A4' });
    const letter = await renderNode(r, { ...DEFAULT_LAYOUT, pageSize: 'LETTER' });
    const dec = new TextDecoder('latin1');
    expect(dec.decode(a4)).toMatch(/MediaBox \[0 0 595\.2\d* 841\.8\d*\]/);
    expect(dec.decode(letter)).toMatch(/MediaBox \[0 0 612 792\]/);
  });
});
