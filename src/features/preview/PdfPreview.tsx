import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { AlertIcon } from '../../components/icons';
import { Spinner } from '../../components/ui';
import { readyOf, type PdfBuild } from './usePdfBuild';

function PageCanvas({ doc, pageNumber, width, total }: { doc: PDFDocumentProxy; pageNumber: number; width: number; total: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(1.414);
  useEffect(() => {
    let task: RenderTask | null = null;
    let cancelled = false;
    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled || !ref.current) return;
        const base = page.getViewport({ scale: 1 });
        setRatio(base.height / base.width);
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const viewport = page.getViewport({ scale: (width / base.width) * dpr });
        const canvas = ref.current;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        task = page.render({ canvas, viewport });
        await task.promise;
      } catch {
        // Rendering was cancelled or the document was replaced by a newer build.
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber, width]);
  return (
    <figure className="mx-auto" style={{ width }}>
      <canvas
        ref={ref}
        role="img"
        aria-label={`Resume page ${pageNumber} of ${total}`}
        className="block w-full bg-white shadow-md ring-1 ring-slate-200 dark:ring-slate-700"
        style={{ height: width * ratio }}
      />
      <figcaption className="mt-1 text-center text-xs text-slate-500 dark:text-slate-400">
        Page {pageNumber} of {total}
      </figcaption>
    </figure>
  );
}

export function PdfPreview({ build }: { build: PdfBuild }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setWidth(Math.max(240, Math.min(760, Math.floor(el.clientWidth - 8))));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const ready = readyOf(build);
  return (
    <div ref={box} className="relative">
      <div className="sr-only" aria-live="polite">
        {build.status === 'ready' ? `Preview updated, ${build.pages} page${build.pages === 1 ? '' : 's'}.` : ''}
      </div>
      {build.status !== 'ready' && build.status !== 'error' ? (
        <div className="absolute right-2 top-2 z-10 rounded-md bg-white/90 px-2 py-1 shadow dark:bg-slate-900/90">
          <Spinner label={ready ? 'Updating' : 'Rendering PDF'} />
        </div>
      ) : null}
      {build.status === 'error' ? (
        <p role="alert" className="mb-2 flex items-center gap-2 text-sm text-red-600">
          <AlertIcon size={16} /> {build.message}
        </p>
      ) : null}
      {ready ? (
        <div className="space-y-4">
          {Array.from({ length: ready.pages }, (_, i) => (
            <PageCanvas key={i} doc={ready.doc} pageNumber={i + 1} width={width} total={ready.pages} />
          ))}
        </div>
      ) : (
        <div
          className="mx-auto aspect-[1/1.414] w-full max-w-[560px] animate-pulse rounded bg-white shadow-md dark:bg-slate-800"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/** What an ATS sees: the extracted text layer, line by line. */
export function TextLayerView({ build }: { build: PdfBuild }) {
  const ready = readyOf(build);
  if (!ready) return <Spinner label="Extracting text" />;
  return (
    <div>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        This is the plain text extracted from the PDF with pdf.js, in reading order. It is roughly what an ATS parser reads.
      </p>
      <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs leading-relaxed text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
        {ready.extracted.lines.join('\n')}
      </pre>
    </div>
  );
}
