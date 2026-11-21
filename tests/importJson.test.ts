import { describe, expect, it } from 'vitest';
import { mapJsonResume } from '../src/lib/import/jsonResume';
import { applyImport, assignUnmapped } from '../src/lib/import/apply';
import { seedProfile } from '../src/lib/seed';
import { resolveResume } from '../src/lib/resolve';

describe('JSON Resume import', () => {
  it('maps fields and strips sensitive keys', () => {
    const d = mapJsonResume({
      basics: {
        name: 'A B',
        label: 'Dev',
        email: 'a@b.co',
        image: 'photo.jpg',
        birthDate: '1999-01-01',
        location: { city: 'Pune', address: '12 MG Road', countryCode: 'IN' },
        profiles: [{ network: 'GitHub', url: 'https://github.com/ab' }],
      },
      work: [{ name: 'Co', position: 'Dev', startDate: '2021-03', highlights: ['Built 3 apps'] }],
      skills: [{ name: 'Web', keywords: ['React'] }],
      interests: [{ name: 'Chess' }],
    })!;
    expect(d.profile.personal).toMatchObject({ fullName: 'A B', city: 'Pune', country: 'IN', github: 'https://github.com/ab' });
    expect(d.profile.experience[0]).toMatchObject({ company: 'Co', start: '2021-03', end: 'present' });
    expect(JSON.stringify(d.profile)).not.toMatch(/photo|1999|MG Road/);
    expect(d.removed.map((r) => r.reason)).toEqual(expect.arrayContaining(['Photo', 'Street address', 'birthDate']));
    expect(d.unmapped.map((u) => u.text)).toContain('Chess');
  });

  it('applies an import as a new variant showing only imported content', () => {
    const master = seedProfile();
    const d = mapJsonResume({
      basics: { name: 'Other' },
      work: [{ name: 'Co', position: 'Dev', highlights: ['Did x'] }],
      skills: [{ name: 'Languages', keywords: ['JavaScript', 'Go'] }],
    })!;
    const draft = assignUnmapped(d.profile, [{ id: 'u', text: 'Won hackathon', from: 'x' }], { u: { kind: 'achievement' } });
    const { profile, variant } = applyImport(master, draft, 'Imported', 'fill-empty');
    expect(profile.personal.fullName).toBe('Rutwik Sakpal');
    const r = resolveResume(profile, variant);
    const skills = r.sections.find((s) => s.key === 'skills');
    expect(skills?.key === 'skills' && skills.groups.map((g) => g.items)).toEqual([['JavaScript', 'Go']]);
    expect(r.sections.map((s) => s.key)).toEqual(['skills', 'experience', 'achievements']);
  });
});
