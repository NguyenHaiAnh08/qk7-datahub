/* <!-- Lucian UX/UI Prompt #004 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#004 --> */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Check, X, Loader2 } from 'lucide-react';

export interface CompactDownloadButtonProps {
  onDownload: () => Promise<void> | void;
  disabled?: boolean;
  disabledTitle?: string;
  size?: 'normal' | 'compact'; // 'normal' cho DocumentCard, 'compact' cho PDF Viewer Header
  fileSize?: string;
  className?: string;
}

type DownloadState = 'idle' | 'run' | 'fold' | 'done';

export const CompactDownloadButton: React.FC<CompactDownloadButtonProps> = ({
  onDownload,
  disabled = false,
  disabledTitle,
  size = 'normal',
  fileSize,
  className = '',
}) => {
  const [state, setState] = useState<DownloadState>('idle');
  const [progress, setProgress] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const foldTimerRef = useRef<NodeJS.Timeout | null>(null);

  const DURATION = 3200; // 3200ms motion duration as specified in prompt #004

  const cancelDownload = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    if (foldTimerRef.current) clearTimeout(foldTimerRef.current);
    setState('idle');
    setProgress(0);
    startTimeRef.current = null;
  }, []);

  const handleStartDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // If already running, clicking again cancels immediately as specified in #004
    if (state === 'run') {
      cancelDownload();
      return;
    }

    if (disabled || state !== 'idle') return;

    setState('run');
    setProgress(0);
    startTimeRef.current = performance.now();

    // Trigger the actual download action concurrently
    try {
      const result = onDownload();
      if (result instanceof Promise) {
        result.catch(() => {
          // If error occurs, revert smoothly
          cancelDownload();
        });
      }
    } catch {
      cancelDownload();
      return;
    }

    const animate = (now: number) => {
      if (!startTimeRef.current) return;
      const elapsed = now - startTimeRef.current;
      const pct = Math.min(100, (elapsed / DURATION) * 100);
      setProgress(pct);

      if (pct < 100) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Reached 100%: Enter 'fold' state momentarily, then 'done'
        setState('fold');
        foldTimerRef.current = setTimeout(() => {
          setState('done');
          // Reset to idle after 2000ms
          resetTimerRef.current = setTimeout(() => {
            setState('idle');
            setProgress(0);
            startTimeRef.current = null;
          }, 2000);
        }, 260);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      if (foldTimerRef.current) clearTimeout(foldTimerRef.current);
    };
  }, []);

  // When disabled (Enforces Security Clearance & Secret Level 3-5 constraints)
  if (disabled) {
    return (
      <button
        disabled
        title={disabledTitle}
        className={`
          flex items-center justify-center gap-1.5 cursor-not-allowed opacity-60
          bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700
          text-slate-400 dark:text-slate-500 font-semibold select-none
          ${size === 'compact' ? 'h-[36px] py-1.5 px-2.5 sm:px-3 rounded-lg text-xs' : 'min-h-[40px] py-2 px-3.5 rounded-xl text-xs'}
          ${className}
        `}
      >
        <Download className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
        <span className={size === 'compact' ? 'hidden sm:inline' : 'text-xs'}>Tải về</span>
      </button>
    );
  }

  // Base sizing and theme styles based on location
  const isCompact = size === 'compact';
  const etaSeconds = Math.max(1, Math.ceil(((100 - progress) / 100) * (DURATION / 1000)));

  let stateClasses = '';
  if (state === 'idle') {
    if (isCompact) {
      stateClasses =
        'bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] hover:from-[#166534] hover:to-[#15803d] text-white border border-amber-500/25 shadow-md shadow-emerald-950/20';
    } else {
      stateClasses =
        'bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300';
    }
  } else if (state === 'run') {
    stateClasses =
      'bg-slate-100 dark:bg-slate-900 border border-emerald-500/50 text-slate-900 dark:text-white shadow-inner';
  } else if (state === 'fold') {
    stateClasses =
      'bg-[#166534] text-white border border-emerald-400/60 is-fold';
  } else if (state === 'done') {
    stateClasses =
      'bg-[#166534] dark:bg-emerald-600 text-white border border-emerald-400 shadow-sm';
  }

  return (
    <button
      type="button"
      onClick={handleStartDownload}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      role={state === 'run' ? 'progressbar' : 'button'}
      aria-label={
        state === 'run'
          ? `Đang tải: ${Math.round(progress)}% (Bấm để hủy)`
          : state === 'done'
          ? 'Đã tải xuống thành công'
          : 'Tải về máy'
      }
      aria-valuenow={state === 'run' ? Math.round(progress) : undefined}
      aria-valuemin={state === 'run' ? 0 : undefined}
      aria-valuemax={state === 'run' ? 100 : undefined}
      aria-live="polite"
      title={state === 'run' ? 'Bấm để hủy tải' : 'Tải về máy'}
      style={
        {
          '--p': `${progress}%`,
        } as React.CSSProperties
      }
      className={`
        u004-btn group shrink-0 select-none cursor-pointer flex items-center justify-center
        ${isCompact ? 'h-[36px] py-1.5 px-2.5 sm:px-3 rounded-lg text-xs font-medium' : 'min-h-[40px] py-2 px-3.5 rounded-xl text-xs font-semibold'}
        ${stateClasses}
        ${className}
      `}
    >
      {/* Background Progress Bar Track (Chỉ hiện khi state === 'run') */}
      {state === 'run' && (
        <div className="u004-track" aria-hidden="true">
          <div className="u004-bar" />
          <div className="u004-shine" />
        </div>
      )}

      {/* Button Content by State */}
      <div className="u004-content">
        {state === 'idle' && (
          <>
            <Download className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-y-0.5" />
            <span className={isCompact ? 'hidden sm:inline' : 'text-xs whitespace-nowrap'}>
              Tải về
            </span>
          </>
        )}

        {state === 'run' && (
          <>
            {isHovering ? (
              <span className="flex items-center gap-1 text-rose-500 dark:text-rose-400 font-bold text-[11px] animate-fadeIn">
                <X className="w-3.5 h-3.5 shrink-0" />
                <span>Hủy</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{Math.round(progress)}%</span>
                {!isCompact && (
                  <span className="text-[10px] text-slate-600 dark:text-slate-300 font-sans font-medium hidden sm:inline">
                    · ~{etaSeconds}s
                  </span>
                )}
                {fileSize && !isCompact && (
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal hidden lg:inline">
                    · {fileSize}
                  </span>
                )}
              </span>
            )}
          </>
        )}

        {state === 'fold' && (
          <div className="w-4 h-4 rounded-full border-2 border-white/60 border-t-white animate-spin shrink-0" />
        )}

        {state === 'done' && (
          <span className="flex items-center gap-1 text-white font-bold text-xs whitespace-nowrap">
            <Check className="w-4 h-4 u004-check shrink-0" />
            <span className={isCompact ? 'hidden sm:inline' : 'inline'}>Đã tải xuống</span>
          </span>
        )}
      </div>
    </button>
  );
};
