import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import 'pdfjs-dist/web/pdf_viewer.css';
import { Loader2 } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const EMPTY_STROKES: HighlighterStroke[] = [];

export interface HighlighterStroke {
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

export interface PdfPagesViewerProps {
  blobUrl: string;
  fileId: string;
  securityLevel?: number;
  isHighlighterActive: boolean;
  highlighterColor: string;
  onStrokeCountChange?: (count: number) => void;
  highlighterRef?: React.MutableRefObject<{ undo: () => void; clear: () => void; getStrokeCount: () => number } | null>;
}

export const PdfPagesViewer: React.FC<PdfPagesViewerProps> = React.memo(({
  blobUrl,
  fileId,
  securityLevel = 1,
  isHighlighterActive,
  highlighterColor,
  onStrokeCountChange,
  highlighterRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }[]>([]);
  
  // Lưu trữ nét vẽ theo từng trang: Map<pageNumber, HighlighterStroke[]>
  const [pageStrokes, setPageStrokes] = useState<Record<number, HighlighterStroke[]>>({});

  const storageKey = `qk7_pdf_highlighter_${fileId}`;
  const isHighSecurity = securityLevel >= 3;

  // Load nét vẽ từ localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setPageStrokes(parsed);
        const total = (Object.values(parsed) as any[]).reduce((sum: number, list: any) => sum + (list?.length || 0), 0);
        onStrokeCountChange?.(total);
      } else {
        setPageStrokes({});
        onStrokeCountChange?.(0);
      }
    } catch {
      setPageStrokes({});
      onStrokeCountChange?.(0);
    }
  }, [fileId, storageKey, onStrokeCountChange]);

  // Expose Undo và Clear cho thanh công cụ
  useEffect(() => {
    if (!highlighterRef) return;
    highlighterRef.current = {
      undo: () => {
        setPageStrokes((prev) => {
          const pageNums = Object.keys(prev).map(Number).sort((a, b) => b - a);
          for (const p of pageNums) {
            const list = prev[p];
            if (list && list.length > 0) {
              const newList = [...list];
              newList.pop();
              const nextState = { ...prev, [p]: newList };
              try {
                localStorage.setItem(storageKey, JSON.stringify(nextState));
              } catch (_) {}
              const total = (Object.values(nextState) as any[]).reduce((sum: number, l: any) => sum + (l?.length || 0), 0);
              onStrokeCountChange?.(total);
              return nextState;
            }
          }
          return prev;
        });
      },
      clear: () => {
        setPageStrokes({});
        try {
          localStorage.removeItem(storageKey);
        } catch (_) {}
        onStrokeCountChange?.(0);
      },
      getStrokeCount: () => {
        return (Object.values(pageStrokes) as any[]).reduce((sum: number, list: any) => sum + (list?.length || 0), 0);
      },
    };
  }, [highlighterRef, pageStrokes, storageKey, onStrokeCountChange]);

  // Phím tắt Ctrl + Z để Hoàn tác
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        if (highlighterRef?.current) {
          e.preventDefault();
          e.stopPropagation();
          highlighterRef.current.undo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [highlighterRef]);

  // Tải PDF bằng pdfjsLib
  const pdfDocRef = useRef<any>(null);

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);

    (async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({
          url: blobUrl,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
          cMapPacked: true,
        });
        const doc = await loadingTask.promise;
        if (isCancelled) return;

        pdfDocRef.current = doc;
        setNumPages(doc.numPages);

        // Lấy kích thước trang
        const dims: { width: number; height: number }[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 1.0 });
          dims.push({ width: viewport.width, height: viewport.height });
        }
        if (!isCancelled) {
          setPageDimensions(dims);
          setLoading(false);
        }
      } catch (err) {
        console.warn('[PdfPagesViewer] Error loading document with pdfjs:', err);
        if (!isCancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [blobUrl]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full overflow-y-auto bg-slate-100 dark:bg-slate-950 flex flex-col items-center py-6 px-2 sm:px-4 relative transition-colors ${
        isHighSecurity ? 'select-none' : 'select-text'
      }`}
      style={{
        scrollbarWidth: 'thin',
      }}
    >
      <style>{`
        .textLayer {
          position: absolute;
          inset: 0;
          overflow: hidden;
          opacity: 1;
          line-height: 1;
          -webkit-text-size-adjust: none;
          text-size-adjust: none;
          forced-color-adjust: none;
          transform-origin: 0 0;
          z-index: 10;
        }
        .textLayer :is(span, br) {
          color: transparent;
          position: absolute;
          white-space: pre;
          cursor: text;
          transform-origin: 0% 0%;
        }
        .textLayer ::selection {
          background: rgba(37, 99, 235, 0.45) !important;
          color: transparent !important;
        }
        .textLayer ::-moz-selection {
          background: rgba(37, 99, 235, 0.45) !important;
          color: transparent !important;
        }
      `}</style>

      {loading && (
        <div className="flex flex-col items-center justify-center p-12 text-slate-300 space-y-3 my-auto">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-sm font-medium">Đang khởi tạo hiển thị trang văn bản chất lượng cao...</p>
        </div>
      )}

      {!loading && numPages > 0 && (
        <div className="flex flex-col items-center space-y-6 w-full max-w-4xl">
          {Array.from({ length: numPages }, (_, index) => {
            const pageNum = index + 1;
            const originalDim = pageDimensions[index] || { width: 595, height: 842 };
            return (
              <SinglePdfPage
                key={`pdf-page-${pageNum}`}
                pdfDoc={pdfDocRef.current}
                pageNum={pageNum}
                securityLevel={securityLevel}
                originalWidth={originalDim.width}
                originalHeight={originalDim.height}
                isHighlighterActive={isHighlighterActive}
                highlighterColor={highlighterColor}
                strokes={pageStrokes[pageNum] || EMPTY_STROKES}
                onSaveStroke={(newStroke) => {
                  setPageStrokes((prev) => {
                    const currentList = prev[pageNum] || EMPTY_STROKES;
                    const nextList = [...currentList, newStroke];
                    const nextState = { ...prev, [pageNum]: nextList };
                    try {
                      localStorage.setItem(storageKey, JSON.stringify(nextState));
                    } catch (_) {}
                    const total = (Object.values(nextState) as any[]).reduce((sum: number, l: any) => sum + (l?.length || 0), 0);
                    onStrokeCountChange?.(total);
                    return nextState;
                  });
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});

interface SinglePdfPageProps {
  pdfDoc: any;
  pageNum: number;
  securityLevel: number;
  originalWidth: number;
  originalHeight: number;
  isHighlighterActive: boolean;
  highlighterColor: string;
  strokes: HighlighterStroke[];
  onSaveStroke: (stroke: HighlighterStroke) => void;
}

const SinglePdfPage: React.FC<SinglePdfPageProps> = React.memo(({
  pdfDoc,
  pageNum,
  securityLevel,
  originalWidth,
  originalHeight,
  isHighlighterActive,
  highlighterColor,
  strokes,
  onSaveStroke,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const highlightCanvasRef = useRef<HTMLCanvasElement>(null);

  const [displayWidth, setDisplayWidth] = useState<number>(originalWidth);
  const [displayHeight, setDisplayHeight] = useState<number>(originalHeight);

  const isLowSecurity = securityLevel <= 2; // Cấp 1 Công khai & Cấp 2 Nội bộ

  // Vẽ lại toàn bộ strokes của trang này lên highlightCanvas
  const redrawStrokes = useCallback(() => {
    const canvas = highlightCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    strokes.forEach((stroke) => {
      if (!stroke.points || stroke.points.length === 0) return;
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.42;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      const p0 = stroke.points[0];
      ctx.moveTo(p0.x, p0.y);

      if (stroke.points.length === 1) {
        ctx.lineTo(p0.x + 0.1, p0.y + 0.1);
      } else {
        for (let i = 1; i < stroke.points.length; i++) {
          const p = stroke.points[i];
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
      ctx.restore();
    });
  }, [strokes]);

  // Render trang PDF và TextLayer bằng pdf.js
  useEffect(() => {
    if (!pdfDoc) return;
    let renderTask: any = null;

    (async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const parentWidth = containerRef.current?.parentElement?.clientWidth || window.innerWidth;
        const targetWidth = Math.min(880, Math.max(360, parentWidth - 48));
        const scale = targetWidth / originalWidth;
        const viewport = page.getViewport({ scale });

        const dpr = Math.min(2, window.devicePixelRatio || 1);

        setDisplayWidth(viewport.width);
        setDisplayHeight(viewport.height);

        // 1. Render Canvas PDF
        const pdfCanvas = pdfCanvasRef.current;
        if (pdfCanvas) {
          pdfCanvas.width = viewport.width * dpr;
          pdfCanvas.height = viewport.height * dpr;
          pdfCanvas.style.width = `${viewport.width}px`;
          pdfCanvas.style.height = `${viewport.height}px`;

          const ctx = pdfCanvas.getContext('2d');
          if (ctx) {
            ctx.scale(dpr, dpr);
            renderTask = page.render({
              canvasContext: ctx,
              viewport: viewport,
            });
            await renderTask.promise;
          }
        }

        // 2. Render TextLayer (Cho phép bôi đen, sao chép Ctrl+C, chuột phải ở Cấp 1 & 2)
        const textContainer = textLayerRef.current;
        if (textContainer && isLowSecurity) {
          textContainer.innerHTML = '';
          textContainer.style.width = `${viewport.width}px`;
          textContainer.style.height = `${viewport.height}px`;
          textContainer.style.setProperty('--scale-factor', `${viewport.scale}`);

          const textContent = await page.getTextContent();
          await pdfjsLib.renderTextLayer({
            textContentSource: textContent,
            container: textContainer,
            viewport: viewport,
            textDivs: [],
          }).promise;
        }

        // 3. Chuẩn bị Canvas Highlight
        const hlCanvas = highlightCanvasRef.current;
        if (hlCanvas) {
          hlCanvas.width = viewport.width * dpr;
          hlCanvas.height = viewport.height * dpr;
          hlCanvas.style.width = `${viewport.width}px`;
          hlCanvas.style.height = `${viewport.height}px`;

          const hlCtx = hlCanvas.getContext('2d');
          if (hlCtx) {
            hlCtx.scale(dpr, dpr);
          }
          redrawStrokes();
        }
      } catch (e: any) {
        if (e.name !== 'RenderingCancelledException') {
          console.warn(`[Page ${pageNum}] Render error:`, e);
        }
      }
    })();

    return () => {
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch (_) {}
      }
    };
  }, [pdfDoc, pageNum, originalWidth, originalHeight, isLowSecurity]);

  // Vẽ lại khi strokes thay đổi
  useEffect(() => {
    redrawStrokes();
  }, [redrawStrokes]);

  // Thao tác vẽ bút dạ quang trên trang này
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<{ x: number; y: number }[]>([]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = highlightCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isHighlighterActive) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const pos = getPos(e);
    currentPointsRef.current = [pos];

    const canvas = highlightCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = highlighterColor;
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x + 0.1, pos.y + 0.1);
    ctx.stroke();
    ctx.restore();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isHighlighterActive || !isDrawingRef.current) return;
    const pos = getPos(e);
    const pts = currentPointsRef.current;
    const last = pts[pts.length - 1];
    if (Math.hypot(pos.x - last.x, pos.y - last.y) < 2) return;

    pts.push(pos);

    const canvas = highlightCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = highlighterColor;
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.restore();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isHighlighterActive || !isDrawingRef.current) return;
    isDrawingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}

    if (currentPointsRef.current.length > 0) {
      const newStroke: HighlighterStroke = {
        color: highlighterColor,
        width: 20,
        points: [...currentPointsRef.current],
      };
      currentPointsRef.current = [];
      onSaveStroke(newStroke);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative bg-white shadow-2xl ring-1 ring-slate-900/10 dark:ring-white/10 rounded-sm transition-transform duration-150 overflow-hidden ${
        isLowSecurity ? 'select-text' : 'select-none'
      }`}
      style={{
        width: displayWidth,
        height: displayHeight,
      }}
    >
      {/* 📄 Lớp 1: Canvas PDF hiển thị nét chữ & Watermark */}
      <canvas ref={pdfCanvasRef} className="block w-full h-full pointer-events-none select-none" />

      {/* 🔤 Lớp 2: TextLayer DOM (Cho phép bôi đen, sao chép Ctrl+C và dán Ctrl+V ở Cấp 1 & 2) */}
      {isLowSecurity && (
        <div
          ref={textLayerRef}
          className={`textLayer ${
            isHighlighterActive ? 'pointer-events-none select-none' : 'pointer-events-auto select-text'
          }`}
          style={{
            zIndex: 10,
          }}
        />
      )}

      {/* 🖊️ Lớp 3: Canvas Bút dạ quang (ĂN CỨNG THEO TÀI LIỆU GIỐNG WATERMARK) */}
      <canvas
        ref={highlightCanvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`absolute inset-0 w-full h-full ${
          isHighlighterActive
            ? 'cursor-crosshair opacity-100 pointer-events-auto z-20'
            : 'pointer-events-none opacity-90 z-5'
        }`}
        style={{
          touchAction: isHighlighterActive ? 'none' : 'auto',
        }}
      />

      {/* Số trang góc dưới */}
      <div className="absolute bottom-2 right-3 px-2 py-0.5 rounded text-[10px] font-mono font-medium text-slate-400 bg-slate-50/80 border border-slate-200 pointer-events-none z-20">
        Trang {pageNum}
      </div>
    </div>
  );
});
