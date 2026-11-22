import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { ResolvedResume } from '../../lib/resolve';
import type { Layout } from '../../lib/schema';
import { extractPdf, verifyTextLayer, type ExtractedPdf, type VerifyResult } from '../../lib/pdf/verify';

export type PdfBuild =
  { status: 'building'; previous: ReadyBuild | null } | ReadyBuild | { status: 'error'; message: string; previous: ReadyBuild | null };

export interface ReadyBuild {
  status: 'ready';
  blob: Blob;
  doc: PDFDocumentProxy;
  pages: number;
  extracted: ExtractedPdf;
  verify: VerifyResult;
  key: string;
}

export function readyOf(b: PdfBuild): ReadyBuild | null {
  return b.status === 'ready' ? b : b.previous;
}

/**
 * Generic debounced PDF build: renders a blob, opens it with pdf.js, extracts the text layer
 * and runs a verifier. Preview, page count, score and download all use this exact file.
 */
export function usePdfDocument(
  key: string,
  render: () => Promise<Blob>,
  verify: (extracted: ExtractedPdf) => VerifyResult,
  delay = 450,
): PdfBuild {
  const [build, setBuild] = useState<PdfBuild>({ status: 'building', previous: null });
  const closers = useRef<Array<() => Promise<void>>>([]);
  const generation = useRef(0);
  const fns = useRef({ render, verify });
  fns.current = { render, verify };

  useEffect(() => {
    const gen = ++generation.current;
    setBuild((b) => (b.status === 'ready' && b.key === key ? b : { status: 'building', previous: readyOf(b) }));
    const timer = setTimeout(async () => {
      try {
        const { openPdf, imageOpCodes } = await import('../../lib/pdf/pdfjs');
        const blob = await fns.current.render();
        if (gen !== generation.current) return;
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const opened = await openPdf(bytes);
        if (gen !== generation.current) {
          void opened.close();
          return;
        }
        const extracted = await extractPdf(opened.doc, imageOpCodes());
        const verified = fns.current.verify(extracted);
        if (gen !== generation.current) {
          void opened.close();
          return;
        }
        const old = closers.current.splice(0);
        closers.current.push(opened.close);
        setBuild({ status: 'ready', blob, doc: opened.doc, pages: opened.doc.numPages, extracted, verify: verified, key });
        setTimeout(() => old.forEach((c) => void c()), 1500);
      } catch (e) {
        if (gen !== generation.current) return;
        console.error(e);
        setBuild((b) => ({ status: 'error', message: 'Could not generate the PDF preview.', previous: readyOf(b) }));
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [key, delay]);

  useEffect(
    () => () => {
      generation.current += 1;
      closers.current.splice(0).forEach((c) => void c());
    },
    [],
  );

  return build;
}

/** Live build of a resume PDF. */
export function usePdfBuild(resume: ResolvedResume, layout: Layout, delay = 450): PdfBuild {
  const key = JSON.stringify([resume, layout]);
  return usePdfDocument(
    key,
    async () => (await import('../../lib/pdf/render')).renderResumePdf(resume, layout),
    (ex) => verifyTextLayer(ex, resume),
    delay,
  );
}
