// @vitest-environment node
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { checkCoverLetter, coverLetterFileName, resolveCoverLetter, starterDraft } from '../src/lib/coverLetter';
import { CoverLetterDocument } from '../src/lib/pdf/CoverLetterDocument';
import { verifyCoverLetterLayer } from '../src/lib/pdf/verify';
import { createVariant, DEFAULT_LAYOUT, sampleProfile } from '../src/lib/seed';
import { extractNode } from './helpers';

function setup() {
  const p = sampleProfile();
  const v = createVariant(p, { name: 'Frontend', preset: 'software' });
  v.coverLetter = { ...v.coverLetter, company: 'Acme', role: 'Frontend Developer', hiringManager: '' };
  return { p, v };
}

describe('cover letter', () => {
  it('starter draft uses only confirmed data and marks what the user must write', () => {
    const { p, v } = setup();
    const draft = starterDraft(p, v, ['React', 'TypeScript', 'Node.js']);
    expect(draft).toContain('Frontend Developer role at Acme');
    expect(draft).toContain('React, TypeScript and Node.js');
    expect(draft).toContain('Full Stack Developer at Brightline Commerce');
    expect(draft).not.toMatch(/\d+%/);
    v.coverLetter.body = draft;
    const check = checkCoverLetter(v);
    expect(check.placeholders.length).toBe(2);
    expect(check.issues.join(' ')).toMatch(/placeholder/);
  });

  it('resolves with a default greeting and omits empty recipient lines', () => {
    const { p, v } = setup();
    v.coverLetter.body = 'First paragraph.\n\n\nSecond paragraph.';
    v.coverLetter.includeDate = false;
    const r = resolveCoverLetter(p, v);
    expect(r.greeting).toBe('Dear Hiring Manager,');
    expect(r.recipient).toEqual(['Acme']);
    expect(r.paragraphs).toEqual(['First paragraph.', 'Second paragraph.']);
    expect(r.date).toBe('');
    expect(coverLetterFileName('Alex Morgan', 'Acme')).toBe('Alex_Morgan_Acme_Cover_Letter.pdf');
  });

  it('renders a one-page text PDF that passes its text-layer check', async () => {
    const { p, v } = setup();
    v.coverLetter.hiringManager = 'Ms. Rivera';
    v.coverLetter.body =
      'I am applying for the Frontend Developer role at Acme.\n\nAt Brightline Commerce I rebuilt the checkout and lifted conversion by 12%.\n\nThank you for your time.';
    const letter = resolveCoverLetter(p, v);
    const buf = await renderToBuffer(
      createElement(CoverLetterDocument, { letter, layout: DEFAULT_LAYOUT }) as Parameters<typeof renderToBuffer>[0],
    );
    const ex = await extractNode(new Uint8Array(buf));
    const result = verifyCoverLetterLayer(ex, letter);
    expect(result.checks.filter((c) => !c.pass)).toEqual([]);
    expect(ex.title).toBe('Alex Morgan - Cover Letter - Frontend Developer');
    expect(ex.lines).toContain('Dear Ms. Rivera,');
  });
});
