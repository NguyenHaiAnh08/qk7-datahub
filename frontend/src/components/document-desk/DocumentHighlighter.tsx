import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';

export interface HighlighterStroke {
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

export interface DocumentHighlighterRef {
  clear: () => void;
  undo: () => void;
  getStrokeCount: () => number;
}

export interface DocumentHighlighterProps {
  fileId: string;
  active: boolean;
  color: string;
  strokeWidth?: number;
  onStrokesChange?: (count: number) => void;
}

export const HIGHLIGHTER_COLORS = [
  { id: 'yellow', name: 'Vàng dạ quang', value: '#facc15', bgClass: 'bg-yellow-400', borderClass: 'border-yellow-300' },
  { id: 'green', name: 'Xanh lá dạ quang', value: '#4ade80', bgClass: 'bg-emerald-400', borderClass: 'border-emerald-300' },
  { id: 'blue', name: 'Xanh dương dạ quang', value: '#38bdf8', bgClass: 'bg-sky-400', borderClass: 'border-sky-300' },
  { id: 'rose', name: 'Hồng cam dạ quang', value: '#fb7185', bgClass: 'bg-rose-400', borderClass: 'border-rose-300' },
];

export const DocumentHighlighter = forwardRef<DocumentHighlighterRef, DocumentHighlighterProps>(
  ({ fileId, active, color, strokeWidth = 22, onStrokesChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const strokesRef = useRef<HighlighterStroke[]>([]);
    const isDrawingRef = useRef(false);
    const currentStrokeRef = useRef<HighlighterStroke | null>(null);

    const storageKey = `qk7_highlighter_${fileId}`;

    // Vẽ lại toàn bộ nét ghi chú cố định lên canvas
    const redrawAll = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      strokesRef.current.forEach((stroke) => {
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
    }, []);

    // Khởi tạo kích thước canvas theo container
    const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.parentElement) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      redrawAll();
    }, [redrawAll]);

    // Load strokes từ localStorage khi đổi fileId
    useEffect(() => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          strokesRef.current = JSON.parse(saved);
        } else {
          strokesRef.current = [];
        }
      } catch (_) {
        strokesRef.current = [];
      }
      onStrokesChange?.(strokesRef.current.length);
      resizeCanvas();
    }, [storageKey, resizeCanvas, onStrokesChange]);

    // Lắng nghe resize window
    useEffect(() => {
      const handleResize = () => resizeCanvas();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, [resizeCanvas]);

    // Phím tắt Ctrl + Z để Hoàn tác (Undo) nét vẽ khi đang bật bút
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
          if (strokesRef.current.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            strokesRef.current.pop();
            try {
              localStorage.setItem(storageKey, JSON.stringify(strokesRef.current));
            } catch (_) {}
            redrawAll();
            onStrokesChange?.(strokesRef.current.length);
          }
        }
      };
      window.addEventListener('keydown', handleKeyDown, true);
      return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [storageKey, redrawAll, onStrokesChange]);

    // Expose methods cho parent component
    useImperativeHandle(ref, () => ({
      clear: () => {
        strokesRef.current = [];
        try {
          localStorage.removeItem(storageKey);
        } catch (_) {}
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
        onStrokesChange?.(0);
      },
      undo: () => {
        if (strokesRef.current.length > 0) {
          strokesRef.current.pop();
          try {
            localStorage.setItem(storageKey, JSON.stringify(strokesRef.current));
          } catch (_) {}
          redrawAll();
          onStrokesChange?.(strokesRef.current.length);
        }
      },
      getStrokeCount: () => strokesRef.current.length,
    }));

    // Tọa độ pointer chuẩn xác theo khung nhìn tài liệu
    const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!active) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      isDrawingRef.current = true;

      const pos = getPointerPos(e);
      const newStroke: HighlighterStroke = {
        color,
        width: strokeWidth,
        points: [pos],
      };
      currentStrokeRef.current = newStroke;

      // Vẽ ngay điểm đầu tiên
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.42;
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x + 0.1, pos.y + 0.1);
      ctx.stroke();
      ctx.restore();
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!active || !isDrawingRef.current || !currentStrokeRef.current) return;

      const pos = getPointerPos(e);
      const points = currentStrokeRef.current.points;
      const prevPos = points[points.length - 1];

      // Chỉ thêm điểm khi chuột di chuyển > 2px để nét vẽ mềm mại
      const dist = Math.hypot(pos.x - prevPos.x, pos.y - prevPos.y);
      if (dist < 2) return;

      points.push(pos);

      // Vẽ đoạn nối tiếp tức thì
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.42;
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(prevPos.x, prevPos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.restore();
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!active || !isDrawingRef.current) return;
      isDrawingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}

      if (currentStrokeRef.current && currentStrokeRef.current.points.length > 0) {
        strokesRef.current.push(currentStrokeRef.current);
        currentStrokeRef.current = null;

        // Lưu vào localStorage
        try {
          localStorage.setItem(storageKey, JSON.stringify(strokesRef.current));
        } catch (_) {}

        onStrokesChange?.(strokesRef.current.length);
        redrawAll();
      }
    };

    return (
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`absolute inset-0 z-20 w-full h-full select-none transition-opacity duration-150 ${
          active ? 'cursor-crosshair opacity-100' : 'pointer-events-none opacity-90'
        }`}
        style={{
          touchAction: active ? 'none' : 'auto',
        }}
      />
    );
  }
);

DocumentHighlighter.displayName = 'DocumentHighlighter';
