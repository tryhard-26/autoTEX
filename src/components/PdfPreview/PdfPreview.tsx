import React, { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  AlertCircle,
  ArrowUpRight,
  Copy,
  Check,
  Crosshair,
} from 'lucide-react';
import { Tooltip } from '../common/Tooltip';
import { DiagnosticItem } from '../../types/compiler';
import { copyToClipboard } from '../../utils/clipboard';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfSyncTarget {
  page: number;
  y: number; // PDF points from page top
  nonce: number; // forces re-scroll for repeated targets
}

interface PdfPreviewProps {
  pdfUrl: string | null;
  isCompiling: boolean;
  errors: DiagnosticItem[];
  syncTarget?: PdfSyncTarget | null;
  onRefresh: () => void;
  onNavigateToError: (file: string, line: number) => void;
  /** Double-click on a page: PDF points from the page's top-left corner. */
  onPdfClick?: (page: number, x: number, y: number) => void;
  onSyncFromCursor?: () => void;
}

type ZoomMode = 'width' | 'page' | number;
const PAGE_GAP = 12;
const PADDING = 16;

const toolBtn = 'p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-[#20222a] disabled:opacity-40';

export const PdfPreview: React.FC<PdfPreviewProps> = ({
  pdfUrl,
  isCompiling,
  errors,
  syncTarget,
  onRefresh,
  onNavigateToError,
  onPdfClick,
  onSyncFromCursor,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageSizes, setPageSizes] = useState<{ width: number; height: number }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoomMode, setZoomMode] = useState<ZoomMode>('width');
  const [containerSize, setContainerSize] = useState({ width: 600, height: 800 });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [marker, setMarker] = useState<{ page: number; y: number } | null>(null);
  const [copiedError, setCopiedError] = useState(false);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);

  // Load document. The previous document stays on screen until the new one is ready.
  useEffect(() => {
    if (!pdfUrl) {
      setDoc(null);
      setPageSizes([]);
      return;
    }
    let cancelled = false;
    const task = pdfjs.getDocument({ url: pdfUrl });
    task.promise
      .then(async (loaded) => {
        const sizes = await Promise.all(
          Array.from({ length: loaded.numPages }, async (_, i) => {
            const vp = (await loaded.getPage(i + 1)).getViewport({ scale: 1 });
            return { width: vp.width, height: vp.height };
          })
        );
        if (cancelled) return task.destroy();
        loadingTaskRef.current?.destroy();
        loadingTaskRef.current = task;
        setDoc(loaded);
        setPageSizes(sizes);
        setLoadError(null);
      })
      .catch((e) => !cancelled && setLoadError(e?.message || 'Failed to load PDF'));
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  // Track container size for fit modes.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerSize({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const base = pageSizes[0] ?? { width: 595, height: 842 };
  const scale =
    zoomMode === 'width'
      ? Math.max(0.25, (containerSize.width - PADDING * 2) / base.width)
      : zoomMode === 'page'
      ? Math.max(0.25, Math.min((containerSize.width - PADDING * 2) / base.width, (containerSize.height - PADDING * 2) / base.height))
      : zoomMode;

  // Track which pages are on (or near) screen; only those get rendered.
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([0]));
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !doc) return;
    const io = new IntersectionObserver(
      (entries) =>
        setVisiblePages((prev) => {
          const next = new Set(prev);
          for (const e of entries) {
            const i = Number((e.target as HTMLElement).dataset.page);
            e.isIntersecting ? next.add(i) : next.delete(i);
          }
          return next;
        }),
      { root, rootMargin: '100% 0px' } // one screen of look-ahead above and below
    );
    canvasRefs.current.forEach((c) => c?.parentElement && io.observe(c.parentElement));
    return () => io.disconnect();
  }, [doc, pageSizes]);

  // Render visible pages that aren't current for this doc + scale. Each page is drawn off-screen and
  // copied in when done, so a recompile swaps pages without flashing white.
  const renderedRef = useRef(new Map<number, { doc: PDFDocumentProxy; scale: number }>());
  useEffect(() => {
    if (!doc) return;
    const tasks: RenderTask[] = [];
    const dpr = window.devicePixelRatio || 1;
    let cancelled = false;
    for (const i of visiblePages) {
      const canvas = canvasRefs.current[i];
      const done = renderedRef.current.get(i);
      if (!canvas || i >= doc.numPages || (done?.doc === doc && done.scale === scale)) continue;
      (async () => {
        const page = await doc.getPage(i + 1);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: scale * dpr });
        const off = document.createElement('canvas');
        off.width = Math.floor(viewport.width);
        off.height = Math.floor(viewport.height);
        const task = page.render({ canvas: off, canvasContext: off.getContext('2d')!, viewport });
        tasks.push(task);
        try {
          await task.promise;
        } catch {
          return; // cancelled
        }
        if (cancelled) return;
        canvas.width = off.width;
        canvas.height = off.height;
        canvas.getContext('2d')!.drawImage(off, 0, 0);
        renderedRef.current.set(i, { doc, scale });
      })();
    }
    return () => {
      cancelled = true;
      tasks.forEach((t) => t.cancel());
    };
  }, [doc, scale, visiblePages]);

  const pageTop = (page: number) => {
    let top = PADDING;
    for (let i = 0; i < page - 1; i++) top += (pageSizes[i]?.height ?? base.height) * scale + PAGE_GAP;
    return top;
  };

  const goToPage = (page: number, yPoints = 0) => {
    const el = scrollRef.current;
    if (!el || !doc) return;
    const p = Math.min(Math.max(1, page), doc.numPages);
    el.scrollTo({ top: pageTop(p) + yPoints * scale - (yPoints ? el.clientHeight / 3 : PADDING) });
  };

  // Forward SyncTeX: scroll to the target and briefly mark it.
  useEffect(() => {
    if (!syncTarget || !doc) return;
    goToPage(syncTarget.page, syncTarget.y);
    setMarker({ page: syncTarget.page, y: syncTarget.y });
    const timer = setTimeout(() => setMarker(null), 1500);
    return () => clearTimeout(timer);
  }, [syncTarget, doc]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || !doc) return;
    const probe = el.scrollTop + el.clientHeight / 3;
    let page = 1;
    while (page < doc.numPages && pageTop(page + 1) <= probe) page++;
    if (page !== currentPage) {
      setCurrentPage(page);
      setPageInput(String(page));
    }
  };

  const zoomBy = (factor: number) => setZoomMode(Math.min(4, Math.max(0.25, Math.round(scale * factor * 100) / 100)));

  const primaryError = errors.find((e) => e.type === 'error');
  const numPages = doc?.numPages ?? 0;

  return (
    <div className="h-full flex flex-col bg-[#14151a] border-l border-[#20222a] overflow-hidden select-none">
      {/* Toolbar */}
      <div className="h-8 border-b border-[#20222a] bg-[#14151a] flex items-center justify-between px-2 gap-2 text-xs font-mono text-neutral-400 shrink-0">
        <div className="flex items-center gap-1">
          <Tooltip content="Previous page">
            <button className={toolBtn} disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>
              <ChevronLeft size={13} />
            </button>
          </Tooltip>
          <input
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && goToPage(parseInt(pageInput, 10) || 1)}
            onBlur={() => setPageInput(String(currentPage))}
            className="w-8 text-center bg-[#1a1b22] border border-[#272933] rounded text-[11px] text-neutral-300 focus:outline-none focus:border-blue-500"
            aria-label="Page number"
          />
          <span className="text-[11px]">/ {numPages || '–'}</span>
          <Tooltip content="Next page">
            <button className={toolBtn} disabled={currentPage >= numPages} onClick={() => goToPage(currentPage + 1)}>
              <ChevronRight size={13} />
            </button>
          </Tooltip>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip content="Zoom out">
            <button className={toolBtn} onClick={() => zoomBy(1 / 1.15)}>
              <ZoomOut size={13} />
            </button>
          </Tooltip>
          <span className="text-[11px] w-10 text-center">{Math.round(scale * 100)}%</span>
          <Tooltip content="Zoom in">
            <button className={toolBtn} onClick={() => zoomBy(1.15)}>
              <ZoomIn size={13} />
            </button>
          </Tooltip>
          <button
            className={`px-1.5 py-0.5 rounded text-[11px] ${zoomMode === 'width' ? 'bg-[#22252e] text-neutral-200' : 'hover:bg-[#20222a]'}`}
            onClick={() => setZoomMode('width')}
          >
            Width
          </button>
          <button
            className={`px-1.5 py-0.5 rounded text-[11px] ${zoomMode === 'page' ? 'bg-[#22252e] text-neutral-200' : 'hover:bg-[#20222a]'}`}
            onClick={() => setZoomMode('page')}
          >
            Page
          </button>
        </div>

        <div className="flex items-center gap-1">
          {isCompiling && <span className="text-[11px] text-neutral-500">Compiling…</span>}
          {onSyncFromCursor && (
            <Tooltip content="Show cursor position in PDF">
              <button className={toolBtn} disabled={!doc} onClick={onSyncFromCursor}>
                <Crosshair size={13} />
              </button>
            </Tooltip>
          )}
          <Tooltip content="Recompile" shortcut="⌘Enter">
            <button className={toolBtn} onClick={onRefresh}>
              <RotateCw size={13} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Compile error banner: the last PDF stays visible underneath */}
      {primaryError && !isCompiling && (
        <div className="bg-rose-950/40 border-b border-rose-800/40 px-3 py-2 flex items-center justify-between text-xs text-rose-200 font-mono shrink-0 select-text">
          <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
            <AlertCircle size={14} className="text-rose-400 shrink-0" />
            <span className="truncate">
              Compilation failed · {primaryError.file}:{primaryError.line} · {primaryError.message}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={async () => {
                if (await copyToClipboard(`${primaryError.file}:${primaryError.line}: ${primaryError.message}`)) {
                  setCopiedError(true);
                  setTimeout(() => setCopiedError(false), 2000);
                }
              }}
              className="px-2 py-0.5 rounded bg-rose-950/70 hover:bg-rose-900/90 text-rose-200 text-[11px] flex items-center gap-1 border border-rose-800/50"
              title="Copy error message"
            >
              {copiedError ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              <span>{copiedError ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={() => onNavigateToError(primaryError.file, primaryError.line)}
              className="px-2 py-0.5 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-100 text-[11px] flex items-center gap-1"
            >
              <span>Open error</span>
              <ArrowUpRight size={11} />
            </button>
          </div>
        </div>
      )}

      {/* Pages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 bg-[#1a1b22] overflow-auto relative">
        {doc ? (
          <div className="flex flex-col items-center" style={{ padding: PADDING, gap: PAGE_GAP }}>
            {pageSizes.map((size, i) => (
              <div
                key={i}
                data-page={i}
                className="relative bg-white shadow shrink-0"
                style={{ width: size.width * scale, height: size.height * scale }}
                onDoubleClick={(e) => {
                  if (!onPdfClick) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  onPdfClick(i + 1, (e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale);
                }}
                title={onPdfClick ? 'Double-click to jump to source' : undefined}
              >
                <canvas
                  ref={(el) => {
                    canvasRefs.current[i] = el;
                  }}
                  style={{ width: '100%', height: '100%', display: 'block' }}
                />
                {marker?.page === i + 1 && (
                  <div
                    className="absolute left-0 right-0 h-5 bg-blue-500/25 border-y border-blue-500/60 pointer-events-none"
                    style={{ top: marker.y * scale - 14 }}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-center font-mono text-xs text-neutral-500">
            {isCompiling ? (
              <p>Compiling…</p>
            ) : loadError ? (
              <p className="text-rose-300">{loadError}</p>
            ) : (
              <div>
                <p className="text-neutral-400 font-medium mb-1">No PDF</p>
                <p className="text-[11px]">Press ⌘Enter to compile.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
