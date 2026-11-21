import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { ResolvedResume } from '../resolve';

export interface ExtractedPdf {
  pages: number;
  lines: string[];
  title: string;
  author: string;
  imageCount: number;
}

interface TextItemLike {
  str: string;
  transform: number[];
  hasEOL?: boolean;
}

function isTextItem(item: unknown): item is TextItemLike {
  return typeof item === 'object' && item !== null && 'str' in item && 'transform' in item;
}

/** Image painting operator codes in pdf.js (paintImageXObject, paintInlineImageXObject, paintImageMaskXObject...). */
export const IMAGE_OP_NAMES = ['paintImageXObject', 'paintInlineImageXObject', 'paintImageMaskXObject', 'paintImageXObjectRepeat'];

/**
 * Extracts text lines in reading order (top-to-bottom, left-to-right per page) using pdf.js.
 * Works with both the browser build and the Node "legacy" build.
 */
export async function extractPdf(doc: PDFDocumentProxy, imageOps?: number[]): Promise<ExtractedPdf> {
  const lines: string[] = [];
  let imageCount = 0;
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const rows: Array<{ y: number; parts: Array<{ x: number; s: string }> }> = [];
    for (const item of content.items) {
      if (!isTextItem(item) || item.str === '') continue;
      const x = item.transform[4] ?? 0;
      const y = item.transform[5] ?? 0;
      let row = rows.find((r) => Math.abs(r.y - y) < 2.5);
      if (!row) {
        row = { y, parts: [] };
        rows.push(row);
      }
      row.parts.push({ x, s: item.str });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const row of rows) {
      row.parts.sort((a, b) => a.x - b.x);
      const line = row.parts
        .map((p) => p.s)
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      if (line) lines.push(line);
    }
    if (imageOps && imageOps.length) {
      const ops = await page.getOperatorList();
      imageCount += ops.fnArray.filter((fn) => imageOps.includes(fn)).length;
    }
    page.cleanup();
  }
  const meta = await doc.getMetadata().catch(() => null);
  const info = (meta?.info ?? {}) as Record<string, unknown>;
  return {
    pages: doc.numPages,
    lines,
    title: typeof info.Title === 'string' ? info.Title : '',
    author: typeof info.Author === 'string' ? info.Author : '',
    imageCount,
  };
}

export interface VerifyCheck {
  id: string;
  label: string;
  pass: boolean;
  detail?: string;
}

export interface VerifyResult {
  pass: boolean;
  checks: VerifyCheck[];
  pages: number;
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** Confirms name, email and headings are present in the text layer and in reading order. */
export function verifyTextLayer(extracted: ExtractedPdf, resume: ResolvedResume): VerifyResult {
  const lines = extracted.lines.map(norm);
  const full = lines.join('\n');
  const checks: VerifyCheck[] = [];

  const findLine = (needle: string, from = 0): number => {
    const n = norm(needle);
    for (let i = from; i < lines.length; i += 1) if (lines[i]!.includes(n)) return i;
    return -1;
  };

  checks.push({
    id: 'text',
    label: 'PDF contains selectable text',
    pass: extracted.lines.length > 0,
    detail: extracted.lines.length ? `${extracted.lines.length} text lines extracted` : 'No text found',
  });

  const nameIdx = resume.name ? findLine(resume.name) : -1;
  checks.push({
    id: 'name',
    label: 'Name is in the text layer',
    pass: Boolean(resume.name) && nameIdx >= 0,
    detail: resume.name ? (nameIdx >= 0 ? undefined : 'Name not found') : 'Name is empty',
  });

  const email = resume.contact.find((c) => c.kind === 'email')?.text ?? '';
  const emailIdx = email ? findLine(email) : -1;
  checks.push({
    id: 'email',
    label: 'Email is in the text layer',
    pass: Boolean(email) && emailIdx >= 0,
    detail: email ? (emailIdx >= 0 ? undefined : 'Email not found') : 'Email is empty',
  });

  let cursor = Math.max(nameIdx, emailIdx, 0);
  let headingsOk = true;
  const missing: string[] = [];
  for (const sec of resume.sections) {
    const idx = findLine(sec.title.toUpperCase(), cursor);
    if (idx < 0) {
      headingsOk = false;
      missing.push(sec.title);
    } else {
      cursor = idx + 1;
    }
  }
  checks.push({
    id: 'headings',
    label: 'Section headings present',
    pass: headingsOk,
    detail: headingsOk
      ? `${resume.sections.length} heading${resume.sections.length === 1 ? '' : 's'} found`
      : `Missing or out of order: ${missing.join(', ')}`,
  });

  const orderOk = nameIdx >= 0 && emailIdx >= 0 && nameIdx <= emailIdx && headingsOk;
  checks.push({
    id: 'order',
    label: 'Reading order: name, contact, then sections',
    pass: orderOk,
  });

  const garbled = Array.from(full).some((ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return code === 0xfffd || (code < 0x20 && ch !== '\n' && ch !== '\t');
  });
  checks.push({
    id: 'clean',
    label: 'No unreadable characters',
    pass: !garbled,
    detail: garbled ? 'Some characters did not extract cleanly' : undefined,
  });

  checks.push({
    id: 'images',
    label: 'No images in the PDF',
    pass: extracted.imageCount === 0,
  });

  const titleOk = norm(extracted.title) === norm(resume.meta.title);
  checks.push({
    id: 'meta',
    label: 'PDF title and author metadata set',
    pass: titleOk && norm(extracted.author) === norm(resume.meta.author),
    detail: extracted.title ? `Title: ${extracted.title}` : 'No title metadata',
  });

  return { pass: checks.every((c) => c.pass), checks, pages: extracted.pages };
}
