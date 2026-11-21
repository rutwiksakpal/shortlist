import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ResumeDocument } from '../src/lib/pdf/ResumeDocument';
import { extractPdf, IMAGE_OP_NAMES, type ExtractedPdf } from '../src/lib/pdf/verify';
import type { ResolvedResume } from '../src/lib/resolve';
import type { Layout } from '../src/lib/schema';

const require = createRequire(import.meta.url);
const fontDir = join(dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts') + '/';

export async function renderNode(resume: ResolvedResume, layout: Layout): Promise<Uint8Array> {
  const buf = await renderToBuffer(createElement(ResumeDocument, { resume, layout }) as Parameters<typeof renderToBuffer>[0]);
  return new Uint8Array(buf);
}

export async function extractNode(bytes: Uint8Array): Promise<ExtractedPdf> {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), standardFontDataUrl: fontDir, verbosity: 0 }).promise;
  const ops = pdfjs.OPS as unknown as Record<string, number>;
  const codes = IMAGE_OP_NAMES.map((n) => ops[n]).filter((n): n is number => typeof n === 'number');
  return extractPdf(doc as unknown as Parameters<typeof extractPdf>[0], codes);
}
