import { extractPdf } from '../pdf/verify';
import { parseResumeText, type ImportDraft } from './parse';
import { mapJsonResume } from './jsonResume';

export const ACCEPTED_TYPES =
  '.pdf,.docx,.txt,.md,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/json';
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export type FileImportResult =
  { kind: 'draft'; draft: ImportDraft; sourceLabel: string } | { kind: 'backup'; text: string } | { kind: 'error'; message: string };

function ext(name: string): string {
  return (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? '').toLowerCase();
}

async function readPdf(buf: ArrayBuffer): Promise<{ text: string; notices: string[] }> {
  const { openPdf, imageOpCodes } = await import('../pdf/pdfjs');
  const { doc, close } = await openPdf(buf);
  const ex = await extractPdf(doc, imageOpCodes()).finally(() => close());
  const notices: string[] = [];
  if (ex.imageCount > 0) {
    notices.push(`Removed ${ex.imageCount} image${ex.imageCount === 1 ? '' : 's'} (such as a photo). Shortlist never stores photos.`);
  }
  if (!ex.lines.length) {
    notices.push('No text found in this PDF. It may be a scanned image. Try pasting the text instead.');
  }
  return { text: ex.lines.join('\n'), notices };
}

async function readDocx(buf: ArrayBuffer): Promise<{ text: string; notices: string[] }> {
  const mammoth = (await import('mammoth/mammoth.browser.js')).default;
  let images = 0;
  await mammoth.convertToHtml(
    { arrayBuffer: buf },
    {
      convertImage: mammoth.images.imgElement(async () => {
        images += 1;
        return { src: '' };
      }),
    },
  );
  const raw = await mammoth.extractRawText({ arrayBuffer: buf });
  const notices: string[] = [];
  if (images > 0) notices.push(`Removed ${images} image${images === 1 ? '' : 's'} (such as a photo). Shortlist never stores photos.`);
  return { text: raw.value, notices };
}

export async function importFile(file: File): Promise<FileImportResult> {
  if (file.size > MAX_FILE_BYTES) return { kind: 'error', message: 'File is larger than 10 MB.' };
  const e = ext(file.name);
  try {
    if (e === 'pdf' || file.type === 'application/pdf') {
      const { text, notices } = await readPdf(await file.arrayBuffer());
      return { kind: 'draft', draft: parseResumeText(text, notices), sourceLabel: file.name };
    }
    if (e === 'docx') {
      const { text, notices } = await readDocx(await file.arrayBuffer());
      return { kind: 'draft', draft: parseResumeText(text, notices), sourceLabel: file.name };
    }
    if (e === 'doc') return { kind: 'error', message: 'Old .doc files are not supported. Save it as .docx or PDF and try again.' };
    const text = await file.text();
    if (e === 'json' || file.type === 'application/json') return importJsonText(text, file.name);
    return { kind: 'draft', draft: parseResumeText(text), sourceLabel: file.name };
  } catch (err) {
    console.error(err);
    return { kind: 'error', message: 'Could not read this file. It may be damaged or password protected.' };
  }
}

export function importJsonText(text: string, label = 'JSON'): FileImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { kind: 'error', message: 'This is not valid JSON.' };
  }
  if (typeof data === 'object' && data !== null && (data as { app?: unknown }).app === 'shortlist') {
    return { kind: 'backup', text };
  }
  const mapped = mapJsonResume(data);
  if (!mapped) return { kind: 'error', message: 'Unrecognised JSON. Use a Shortlist backup or a JSON Resume (jsonresume.org) file.' };
  return { kind: 'draft', draft: mapped, sourceLabel: label };
}
