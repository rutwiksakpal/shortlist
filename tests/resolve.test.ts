import { fixtureProfile } from './fixtures';
import { describe, expect, it } from 'vitest';
import { resolveResume, resumePlainText } from '../src/lib/resolve';
import { createVariant, emptyProfile } from '../src/lib/seed';
import { profileSchema } from '../src/lib/schema';

function blankBits() {
  const p = emptyProfile();
  p.personal.fullName = 'Asha Rao';
  p.personal.email = 'asha@example.com';
  p.experience = [
    { id: 'e1', company: '', title: '', location: '', start: '', end: '', bullets: [{ id: 'b1', text: '   ' }] },
    {
      id: 'e2',
      company: 'Acme',
      title: 'Developer',
      location: '',
      start: '2022-01',
      end: 'present',
      bullets: [
        { id: 'b2', text: '' },
        { id: 'b3', text: 'Built things' },
      ],
    },
  ];
  p.projects = [{ id: 'p1', name: '', stack: '', link: '', bullets: [] }];
  p.education = [{ id: 'ed1', institution: '', degree: '', location: '', start: '', end: '', details: '' }];
  p.skills = [{ id: 'c1', name: 'Empty', items: [{ id: 's1', name: ' ' }] }];
  p.certifications = [{ id: 'cert1', name: '', issuer: 'X', date: '', link: '' }];
  p.achievements = [{ id: 'a1', text: '' }];
  p.languages = [{ id: 'l1', name: '', proficiency: 'Fluent' }];
  return p;
}

describe('resolveResume - no empty output', () => {
  it('omits empty sections, entries, bullets and their headings', () => {
    const p = blankBits();
    const v = createVariant(p, { name: 'Test', preset: 'custom', headline: '' });
    const r = resolveResume(p, v);
    expect(r.sections.map((s) => s.key)).toEqual(['experience']);
    const exp = r.sections[0];
    if (exp?.key !== 'experience') throw new Error('expected experience');
    expect(exp.entries).toHaveLength(1);
    expect(exp.entries[0]?.bullets).toEqual(['Built things']);
    expect(exp.entries[0]?.location).toBe('');
  });

  it('contact line joins only filled items', () => {
    const p = blankBits();
    const v = createVariant(p, { name: 'Test', preset: 'custom', headline: '' });
    const r = resolveResume(p, v);
    expect(r.contact.map((c) => c.text)).toEqual(['asha@example.com']);
    const text = resumePlainText(r);
    expect(text).not.toMatch(/N\/A|\|\s*\||\|\s*$|^\s*\||,\s*,|:\s*$/m);
  });

  it('hidden items are omitted', () => {
    const p = fixtureProfile();
    const v = createVariant(p, { name: 'Web', preset: 'web' });
    v.order.sections = v.order.sections!.map((e) => (e.id === 'skills' ? { ...e, hidden: true } : e));
    const r = resolveResume(p, v);
    expect(r.sections.find((s) => s.key === 'skills')).toBeUndefined();
  });

  it('fixture profile passes the strict schema', () => {
    const p = fixtureProfile();
    expect(p.experience).toEqual([]);
    expect(p.projects).toEqual([]);
    expect(p.education).toEqual([]);
    expect(profileSchema.safeParse(p).success).toBe(true);
  });

  it('strict schema rejects excluded personal fields', () => {
    const p = fixtureProfile() as unknown as { personal: Record<string, unknown> };
    p.personal.dateOfBirth = '1999-01-01';
    expect(profileSchema.safeParse(p).success).toBe(false);
  });
});
