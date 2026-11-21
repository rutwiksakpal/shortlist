import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { IMAGE_OP_NAMES } from './verify';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export const STANDARD_FONT_DATA_URL = `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`;

export interface OpenedPdf {
  doc: PDFDocumentProxy;
  close: () => Promise<void>;
}

/** Browser-side pdf.js loader. Call close() when done to free the worker document. */
export async function openPdf(data: Uint8Array | ArrayBuffer): Promise<OpenedPdf> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const task = pdfjs.getDocument({ data: bytes, standardFontDataUrl: STANDARD_FONT_DATA_URL });
  const doc = await task.promise;
  return { doc, close: () => task.destroy() };
}

export function imageOpCodes(): number[] {
  const ops = pdfjs.OPS as unknown as Record<string, number>;
  return IMAGE_OP_NAMES.map((n) => ops[n]).filter((n): n is number => typeof n === 'number');
}
