/* <!-- Lucian UX/UI Prompt #004 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#004 --> */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Check, X, Loader2 } from 'lucide-react';

export interface CompactDownloadButtonProps {
  onDownload: (signal?: AbortSignal) => Promise<(() => void) | void> | (() => void) | void;
  onCancel?: () => void;
  disabled?: boolean;
  disabledTitle?: string;
  size?: 'normal' | 'compact' | 'icon'; // 'normal' cho DocumentCard, 'compact' cho Toolbar/Header, 'icon' cho Action Table
  fileSize?: string;
  idleLabel?: string;
  doneLabel?: string;
  showLabelOnCompact?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

type DownloadState = 'idle' | 'run' | 'fold' | 'done';

export const CompactDownloadButton: React.FC<CompactDownloadButtonProps> = ({
  onDownload,
  onCancel,
  disabled = false,
  disabledTitle,
  size = 'normal',
  fileSize,
  idleLabel = 'Tải về',
  doneLabel = 'Đã tải xuống',
  showLabelOnCompact,
  icon,
  className = '',
}) => {
  const [state, setState] = useState<DownloadState>('idle');
  const [progress, setProgress] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const foldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const releaseActionRef = useRef<(() => void) | null>(null);
  const isCancelledRef = useRef<boolean>(false);

  const DURATION = 3200; // 3200ms motion duration as specified in prompt #004

  const cancelDownload = useCallback(
    (triggerCallback = true) => {
      isCancelledRef.current = true;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      releaseActionRef.current = null;

      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      if (foldTimerRef.current) clearTimeout(foldTimerRef.current);

      setState('idle');
      setProgress(0);
      startTimeRef.current = null;

      if (triggerCallback) {
        onCancel?.();
      }
    },
    [onCancel]
  );

  const handleStartDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // If already running, clicking again cancels immediately as specified in #004
    if (state === 'run') {
      cancelDownload(true);
      return;
    }

    if (disabled || state !== 'idle') return;

    isCancelledRef.current = false;
    setState('run');
    setProgress(0);
    startTimeRef.current = performance.now();

    const controller = new AbortController();
    abortControllerRef.current = controller;
    releaseActionRef.current = null;

    // Trigger onDownload in background and hold the release callback until UI is done
    let downloadTask: Promise<any>;
    try {
      const result = onDownload(controller.signal);
      if (result instanceof Promise) {
        downloadTask = result
          .then((releaseFn) => {
            if (typeof releaseFn === 'function') {
              releaseActionRef.current = releaseFn;
            }
            return releaseFn;
          })
          .catch((err) => {
            if (controller.signal.aborted || err?.name === 'AbortError') {
              return;
            }
            console.error('Download error:', err);
            cancelDownload(false);
            throw err;
          });
      } else {
        if (typeof result === 'function') {
          releaseActionRef.current = result;
        }
        downloadTask = Promise.resolve();
      }
    } catch (err) {
      console.error('Download start error:', err);
      cancelDownload(false);
      return;
    }

    const animate = (now: number) => {
      if (isCancelledRef.current || !startTimeRef.current) return;
      const elapsed = now - startTimeRef.current;
      const pct = Math.min(100, (elapsed / DURATION) * 100);
      setProgress(pct);

      if (pct < 100) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Reached 100%: Enter 'fold' state momentarily
        setState('fold');

        const foldTimerPromise = new Promise((resolve) => {
          foldTimerRef.current = setTimeout(resolve, 260);
        });

        // Wait for both fold spinner (260ms) and background download task to finish
        Promise.all([downloadTask, foldTimerPromise])
          .then(() => {
            if (isCancelledRef.current) return;

            // Transition to 'done' state
            setState('done');

            // CRITICAL REQUIREMENT: Release the file to disk now that UI UX is done!
            if (releaseActionRef.current) {
              try {
                releaseActionRef.current();
              } catch (e) {
                console.error('Error executing file release:', e);
              }
              releaseActionRef.current = null;
            }

            // Reset to idle after 2000ms
            resetTimerRef.current = setTimeout(() => {
              if (isCancelledRef.current) return;
              setState('idle');
              setProgress(0);
              startTimeRef.current = null;
            }, 2000);
          })
          .catch((err) => {
            if (!controller.signal.aborted && err?.name !== 'AbortError') {
              cancelDownload(false);
            }
          });
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      if (foldTimerRef.current) clearTimeout(foldTimerRef.current);
    };
  }, []);

  const isIcon = size === 'icon';
  const isCompact = size === 'compact';
  const etaSeconds = Math.max(1, Math.ceil(((100 - progress) / 100) * (DURATION / 1000)));
  const shouldShowLabel = !isIcon && (!isCompact || showLabelOnCompact || idleLabel !== 'Tải về');

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
          ${
            isIcon
              ? 'w-8 h-8 p-1.5 rounded-lg'
              : isCompact
              ? 'h-[36px] py-1.5 px-2.5 sm:px-3 rounded-xl text-xs'
              : 'min-h-[40px] py-2 px-3.5 rounded-xl text-xs'
          }
          ${className}
        `}
      >
        {icon || <Download className={`${isIcon ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-slate-400 dark:text-slate-500 shrink-0`} />}
        {shouldShowLabel && (
          <span className={isCompact ? 'hidden sm:inline text-xs' : 'text-xs whitespace-nowrap'}>
            {idleLabel}
          </span>
        )}
      </button>
    );
  }

  let stateClasses = '';
  if (state === 'idle') {
    if (isIcon) {
      stateClasses =
        'bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 shadow-xs';
    } else if (isCompact) {
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
          ? `Đang tiến hành: ${Math.round(progress)}% (Bấm để hủy)`
          : state === 'done'
          ? doneLabel
          : idleLabel
      }
      aria-valuenow={state === 'run' ? Math.round(progress) : undefined}
      aria-valuemin={state === 'run' ? 0 : undefined}
      aria-valuemax={state === 'run' ? 100 : undefined}
      aria-live="polite"
      title={state === 'run' ? 'Bấm để hủy' : disabledTitle || idleLabel}
      style={
        {
          '--p': `${progress}%`,
        } as React.CSSProperties
      }
      className={`
        u004-btn group shrink-0 select-none cursor-pointer flex items-center justify-center
        ${
          isIcon
            ? state === 'run'
              ? 'h-8 min-w-[58px] px-2 rounded-lg text-xs font-semibold'
              : 'w-8 h-8 p-1.5 rounded-lg text-xs font-semibold'
            : isCompact
            ? 'h-[36px] py-1.5 px-2.5 sm:px-3 rounded-xl text-xs font-medium'
            : 'min-h-[40px] py-2 px-3.5 rounded-xl text-xs font-semibold'
        }
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
            {icon || <Download className={`${isIcon ? 'w-3.5 h-3.5' : 'w-4 h-4'} shrink-0 transition-transform duration-200 group-hover:translate-y-0.5`} />}
            {shouldShowLabel && (
              <span className={isCompact ? 'hidden sm:inline text-xs whitespace-nowrap' : 'text-xs whitespace-nowrap'}>
                {idleLabel}
              </span>
            )}
          </>
        )}

        {state === 'run' && (
          <>
            {isHovering ? (
              <span className="flex items-center gap-0.5 text-rose-500 dark:text-rose-400 font-bold text-[10px] animate-fadeIn">
                <X className={`${isIcon ? 'w-3 h-3' : 'w-3.5 h-3.5'} shrink-0`} />
                <span>Hủy</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 font-mono text-[11px] font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                <Loader2 className={`${isIcon ? 'w-3 h-3' : 'w-3.5 h-3.5'} animate-spin text-emerald-600 dark:text-emerald-400 shrink-0`} />
                <span>{Math.round(progress)}%</span>
                {!isCompact && !isIcon && (
                  <span className="text-[10px] text-slate-600 dark:text-slate-300 font-sans font-medium hidden sm:inline">
                    · ~{etaSeconds}s
                  </span>
                )}
                {fileSize && !isCompact && !isIcon && (
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal hidden lg:inline">
                    · {fileSize}
                  </span>
                )}
              </span>
            )}
          </>
        )}

        {state === 'fold' && (
          <div className={`${isIcon ? 'w-3.5 h-3.5 border-[1.5px]' : 'w-4 h-4 border-2'} rounded-full border-white/60 border-t-white animate-spin shrink-0`} />
        )}

        {state === 'done' && (
          <span className="flex items-center gap-1 text-white font-bold text-xs whitespace-nowrap">
            <Check className={`${isIcon ? 'w-3.5 h-3.5' : 'w-4 h-4'} u004-check shrink-0`} />
            {shouldShowLabel && (
              <span className={isCompact ? 'hidden sm:inline text-xs whitespace-nowrap' : 'text-xs whitespace-nowrap'}>
                {doneLabel}
              </span>
            )}
          </span>
        )}
      </div>
    </button>
  );
};
