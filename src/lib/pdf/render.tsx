import { pdf } from '@react-pdf/renderer';
import type { ResolvedResume } from '../resolve';
import type { Layout } from '../schema';
import { AUTO_FIT_STEPS } from './layout';
import { ResumeDocument } from './ResumeDocument';
import { CoverLetterDocument } from './CoverLetterDocument';
import type { ResolvedCoverLetter } from '../coverLetter';

export async function renderResumePdf(resume: ResolvedResume, layout: Layout): Promise<Blob> {
  return pdf(<ResumeDocument resume={resume} layout={layout} />).toBlob();
}

/** Counts pages by scanning page objects. Works on react-pdf output without a full parse. */
export function countPdfPages(bytes: Uint8Array): number {
  let text = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    text += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const matches = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g);
  return matches ? matches.length : 0;
}

export interface FitResult {
  layout: Layout;
  pages: number;
  exceedsTwoPages: boolean;
}

/**
 * Auto-fit: picks the most comfortable layout that fits on one page, otherwise the most
 * comfortable that fits on two. Font stays within 10-11pt and margins within 0.6-0.8in.
 */
export async function autoFit(base: Layout, countPages: (layout: Layout) => Promise<number>): Promise<FitResult> {
  const results: Array<{ layout: Layout; pages: number }> = [];
  for (const step of AUTO_FIT_STEPS) {
    const layout: Layout = { ...base, ...step };
    const pages = await countPages(layout);
    results.push({ layout, pages });
    if (pages <= 1) return { layout, pages, exceedsTwoPages: false };
  }
  const two = results.find((r) => r.pages <= 2);
  if (two) return { ...two, exceedsTwoPages: false };
  const last = results[results.length - 1]!;
  return { ...last, exceedsTwoPages: true };
}

export async function pageCountFor(resume: ResolvedResume, layout: Layout): Promise<number> {
  const blob = await renderResumePdf(resume, layout);
  return countPdfPages(new Uint8Array(await blob.arrayBuffer()));
}

export async function renderCoverLetterPdf(letter: ResolvedCoverLetter, layout: Layout): Promise<Blob> {
  return pdf(<CoverLetterDocument letter={letter} layout={layout} />).toBlob();
}
