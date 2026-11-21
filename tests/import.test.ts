import { describe, expect, it } from 'vitest';
import { parseResumeText } from '../src/lib/import/parse';
import { stripSensitiveLine } from '../src/lib/import/sensitive';

const SAMPLE = `RESUME
Priya Sharma
Full Stack Developer
Flat 12, Shanti Nagar Road, Andheri East, Mumbai 400069
priya.sharma@example.com | +91 98200 12345 | linkedin.com/in/priyasharma | github.com/priyas
Mumbai, India
Date of Birth: 12/03/1998
Gender: Female | Nationality: Indian

PROFESSIONAL SUMMARY
Developer with 3 years of experience building React and Node.js apps
for ecommerce brands.

Technical Skills
Languages: JavaScript, TypeScript, Python
Frameworks: React, Node.js, Express
Git, Docker

Work Experience
Software Engineer | Acme Corp | Mumbai, India
Jan 2022 - Present
• Built a checkout service handling 20k orders per day.
• Reduced page load time by 35% by moving images to a CDN and
lazy loading below-the-fold sections.
Junior Developer at Beta Labs
June 2020 – Dec 2021
- Maintained 15 client WordPress sites.

Projects
Shortlist | React, TypeScript | github.com/priyas/shortlist
• Created a resume builder used by 200 people.

Education
B.E. Computer Engineering
University of Mumbai | 2016 - 2020
CGPA: 8.4/10

Certifications
AWS Certified Cloud Practitioner - Amazon Web Services, 2023

Hobbies
Chess, trekking

Languages
English (Fluent), Hindi, Marathi

Personal Details
Marital Status: Single
Religion: Hindu`;

describe('import parsing', () => {
  const draft = parseResumeText(SAMPLE);
  const p = draft.profile;

  it('maps contact details', () => {
    expect(p.personal.fullName).toBe('Priya Sharma');
    expect(p.personal.headline).toBe('Full Stack Developer');
    expect(p.personal.email).toBe('priya.sharma@example.com');
    expect(p.personal.phone).toBe('+91 98200 12345');
    expect(p.personal.linkedin).toBe('linkedin.com/in/priyasharma');
    expect(p.personal.github).toBe('github.com/priyas');
    expect(p.personal.city).toBe('Mumbai');
    expect(p.personal.country).toBe('India');
  });

  it('strips DOB, gender, nationality, marital status, religion and street address with a notice', () => {
    const reasons = draft.removed.map((r) => r.reason);
    expect(reasons).toEqual(
      expect.arrayContaining(['Date of birth', 'Gender', 'Nationality', 'Marital status', 'Religion', 'Street address']),
    );
    const everything = JSON.stringify(p) + JSON.stringify(draft.unmapped);
    for (const bad of ['1998', 'Female', 'Indian', 'Hindu', 'Shanti Nagar', '400069']) expect(everything).not.toContain(bad);
    expect(draft.notices.join(' ')).toMatch(/Removed personal details/);
  });

  it('maps summary, skills and experience', () => {
    expect(p.summary).toBe('Developer with 3 years of experience building React and Node.js apps for ecommerce brands.');
    expect(p.skills.map((c) => c.name)).toEqual(['Languages', 'Frameworks', 'Skills']);
    expect(p.skills[2]?.items.map((i) => i.name)).toEqual(['Git', 'Docker']);
    expect(p.experience).toHaveLength(2);
    const [a, b] = p.experience;
    expect(a).toMatchObject({
      title: 'Software Engineer',
      company: 'Acme Corp',
      location: 'Mumbai, India',
      start: '2022-01',
      end: 'present',
    });
    expect(a?.bullets.map((x) => x.text)).toEqual([
      'Built a checkout service handling 20k orders per day.',
      'Reduced page load time by 35% by moving images to a CDN and lazy loading below-the-fold sections.',
    ]);
    expect(b).toMatchObject({ title: 'Junior Developer', company: 'Beta Labs', start: '2020-06', end: '2021-12' });
  });

  it('maps projects, education, certifications and languages', () => {
    expect(p.projects[0]).toMatchObject({ name: 'Shortlist', stack: 'React, TypeScript', link: 'github.com/priyas/shortlist' });
    expect(p.education[0]).toMatchObject({
      degree: 'B.E. Computer Engineering',
      institution: 'University of Mumbai',
      start: '2016',
      end: '2020',
      details: 'CGPA: 8.4/10',
    });
    expect(p.certifications[0]).toMatchObject({ name: 'AWS Certified Cloud Practitioner', issuer: 'Amazon Web Services', date: '2023' });
    expect(p.languages.map((l) => `${l.name}/${l.proficiency}`)).toEqual(['English/Fluent', 'Hindi/', 'Marathi/']);
  });

  it('never silently drops content: unknown sections go to unmapped', () => {
    const texts = draft.unmapped.map((u) => u.text);
    expect(texts).toEqual(expect.arrayContaining(['RESUME', 'Chess, trekking']));
  });

  it('keeps non-sensitive segments of a mixed line', () => {
    const r = stripSensitiveLine('Mumbai, India | DOB: 01-01-1999 | +91 90000 00000', true);
    expect(r.kept).toBe('Mumbai, India | +91 90000 00000');
    expect(r.removed[0]?.reason).toBe('Date of birth');
  });
});
