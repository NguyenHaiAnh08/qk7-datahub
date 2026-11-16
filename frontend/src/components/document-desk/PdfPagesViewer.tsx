import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
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
  initialPage?: number;
  securityLevel?: number;
  isHighlighterActive: boolean;
  highlighterColor: string;
  onStrokeCountChange?: (count: number) => void;
  highlighterRef?: React.MutableRefObject<{ undo: () => void; clear: () => void; getStrokeCount: () => number } | null>;
}

export const PdfPagesViewer: React.FC<PdfPagesViewerProps> = React.memo(({
  blobUrl,
  fileId,
  initialPage = 1,
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

  // Đo chiều rộng hiển thị chuẩn của container để tính toán kích thước trang đồng nhất 100% từ frame đầu tiên
  const [targetWidth, setTargetWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return Math.min(880, Math.max(360, window.innerWidth - 48));
    }
    return 880;
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        if (w > 100) {
          setTargetWidth(Math.min(880, Math.max(360, w - 48)));
        }
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);
  
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
          cMapUrl: '/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/standard_fonts/',
        });
        const doc = await loadingTask.promise;
        if (isCancelled) return;

        pdfDocRef.current = doc;
        setNumPages(doc.numPages);

        // Khởi tạo kích thước trang siêu tốc: lấy trang 1 làm kích thước chuẩn
        const firstPage = await doc.getPage(1);
        const firstVp = firstPage.getViewport({ scale: 1.0 });
        const defaultDim = { width: firstVp.width, height: firstVp.height };
        const dims: { width: number; height: number }[] = Array(doc.numPages).fill(defaultDim);

        // Nếu có initialPage cụ thể (>1), đọc trước kích thước trang đích để đảm bảo tuyệt đối chuẩn xác
        if (initialPage && initialPage > 1 && initialPage <= doc.numPages) {
          try {
            const targetP = await doc.getPage(initialPage);
            const targetVp = targetP.getViewport({ scale: 1.0 });
            dims[initialPage - 1] = { width: targetVp.width, height: targetVp.height };
          } catch (_) {}
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
  }, [blobUrl, initialPage]);

  // 📍 Tự động nhảy và cuộn chính xác 100% đến đúng số trang trích dẫn (ví dụ: Trang 267)
  useEffect(() => {
    if (loading || numPages <= 0 || !initialPage || initialPage <= 1) return;
    const targetPage = Math.min(Math.max(1, initialPage), numPages);

    const performScroll = (behavior: ScrollBehavior = 'instant') => {
      const container = containerRef.current;
      if (!container) return;
      const pageEl = container.querySelector(`[data-page="${targetPage}"]`) as HTMLElement;
      if (pageEl) {
        const containerRect = container.getBoundingClientRect();
        const pageRect = pageEl.getBoundingClientRect();
        const targetTop = container.scrollTop + (pageRect.top - containerRect.top) - 16;
        container.scrollTo({
          top: Math.max(0, targetTop),
          behavior,
        });
      }
    };

    // 1. Nhảy lập tức bằng 'instant' để tránh bị ngắt quãng/giới hạn thời gian của smooth-scroll trên tài liệu dài
    performScroll('instant');

    // 2. Tái khẳng định vị trí chính xác ở các mốc thời gian layout ổn định
    const t1 = setTimeout(() => performScroll('instant'), 50);
    const t2 = setTimeout(() => performScroll('instant'), 150);
    const t3 = setTimeout(() => performScroll('instant'), 350);
    const t4 = setTimeout(() => performScroll('instant'), 600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [loading, numPages, initialPage, fileId, targetWidth]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full overflow-y-auto overscroll-contain scrollbar-thin bg-slate-100 dark:bg-slate-950 flex flex-col items-center py-6 px-2 sm:px-4 relative transition-colors ${
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
            const originalDim = pageDimensions[index] || { width: 595.3, height: 842.0 };
            return (
              <SinglePdfPage
                key={`pdf-page-${pageNum}`}
                pdfDoc={pdfDocRef.current}
                pageNum={pageNum}
                isCitedPage={pageNum === initialPage && initialPage > 0}
                securityLevel={securityLevel}
                targetWidth={targetWidth}
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
  isCitedPage?: boolean;
  securityLevel: number;
  targetWidth: number;
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
  isCitedPage = false,
  securityLevel,
  targetWidth,
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

  // Tính toán kích thước hiển thị đồng nhất cố định (Zero Layout Shift)
  const scale = targetWidth / (originalWidth || 595.3);
  const displayWidth = targetWidth;
  const displayHeight = Math.round((originalHeight || 842.0) * scale);

  const isLowSecurity = securityLevel <= 2; // Cấp 1 Công khai & Cấp 2 Nội bộ

  // Cơ chế Virtualization qua IntersectionObserver: chỉ tải và render canvas khi ở gần viewport
  // Nếu là trang trích dẫn (isCitedPage), luôn kích hoạt render tức thì 100%
  const [isInView, setIsInView] = useState<boolean>(isCitedPage);

  useEffect(() => {
    if (isCitedPage) {
      setIsInView(true);
      return;
    }
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsInView(true);
        }
      },
      {
        rootMargin: '1200px 0px', // Đón trước 1-2 trang để người dùng cuộn mượt mà không cảm nhận độ trễ
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isCitedPage]);

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

  // Render trang PDF và TextLayer bằng pdf.js khi isInView = true
  useEffect(() => {
    if (!pdfDoc || !isInView) return;
    let renderTask: any = null;

    (async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const dpr = Math.min(2, window.devicePixelRatio || 1);

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
          const textLayer = new (pdfjsLib as any).TextLayer({
            textContentSource: textContent,
            container: textContainer,
            viewport: viewport,
          });
          await textLayer.render();
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
  }, [pdfDoc, pageNum, scale, isLowSecurity, isInView]);

  // Vẽ lại khi strokes thay đổi
  useEffect(() => {
    if (isInView) {
      redrawStrokes();
    }
  }, [redrawStrokes, isInView]);

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
      id={`pdf-page-${pageNum}`}
      data-page={pageNum}
      className={`relative bg-white shadow-2xl rounded-sm transition-all duration-300 overflow-hidden ${
        isCitedPage
          ? 'ring-4 ring-amber-500 shadow-2xl shadow-amber-500/30 z-10'
          : 'ring-1 ring-slate-900/10 dark:ring-white/10'
      } ${isLowSecurity ? 'select-text' : 'select-none'}`}
      style={{
        width: displayWidth,
        height: displayHeight,
      }}
    >
      {/* 🌟 Biểu ngữ nổi bật chỉ báo đoạn trích dẫn AI ở đầu trang */}
      {isCitedPage && (
        <div className="absolute top-0 inset-x-0 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-amber-950 text-[11px] sm:text-xs font-extrabold py-1.5 px-4 flex items-center justify-between shadow-md z-30 select-none">
          <div className="flex items-center gap-2">
            <span className="text-sm">⭐</span>
            <span className="tracking-wide">ĐOẠN TRÍCH DẪN ĐƯỢC ĐỒNG CHÍ TRỢ LÝ AI TRÍCH XUẤT</span>
          </div>
          <span className="font-mono bg-amber-950/20 text-white px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold">
            TRANG {pageNum}
          </span>
        </div>
      )}

      {/* ⏳ Khung đệm placeholder khi trang chưa vào vùng nhìn (Zero memory & Zero layout shift) */}
      {!isInView && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/40 text-slate-400 select-none">
          <div className="w-10 h-10 rounded-full border-2 border-slate-300 dark:border-slate-700 flex items-center justify-center text-xs font-mono font-bold text-slate-400 dark:text-slate-500">
            {pageNum}
          </div>
          <span className="text-[11px] font-mono mt-1.5 text-slate-400 dark:text-slate-500 font-medium">Trang {pageNum}</span>
        </div>
      )}

      {/* 📄 Lớp 1: Canvas PDF hiển thị nét chữ & Watermark */}
      <canvas ref={pdfCanvasRef} className="block w-full h-full pointer-events-none select-none" />

      {/* 🔤 Lớp 2: TextLayer DOM (Cho phép bôi đen, sao chép Ctrl+C và dán Ctrl+V ở Cấp 1 & 2) */}
      {isLowSecurity && isInView && (
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

      {/* Số trang góc dưới (có chỉ báo đoạn trích dẫn nếu đúng trang được AI trích dẫn) */}
      <div
        className={`absolute bottom-2.5 right-3 px-2.5 py-0.5 rounded text-[10px] font-mono pointer-events-none z-20 transition-all ${
          isCitedPage
            ? 'bg-amber-500 text-amber-950 font-extrabold shadow-md border border-amber-600 animate-pulse'
            : 'text-slate-400 bg-slate-50/80 dark:bg-slate-800/80 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-medium'
        }`}
      >
        {isCitedPage ? `⭐ ĐOẠN TRÍCH DẪN • TRANG ${pageNum}` : `Trang ${pageNum}`}
      </div>
    </div>
  );
});
