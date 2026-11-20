import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowUp } from 'lucide-react';

export interface ReadingProgress {
  currentPage: number;
  totalPages: number;
  percent: number;
  isCompleted: boolean;
}

export interface DocumentReadingRingProps {
  currentPage: number;
  totalPages: number;
  percent: number;
  isCompleted?: boolean;
  size?: number;
  strokeWidth?: number;
  variant?: 'header' | 'floating' | 'compact';
  onClick?: () => void;
  className?: string;
}

/**
 * ⭕ Document Reading Completion Ring (Vòng chỉ báo hoàn thành đọc tài liệu)
 * Thiết kế tối ưu độ tương phản cao (High-Contrast Dual-Theme UX/UI):
 * - Không bị chìm hay đè màu ở cả Light Mode lẫn Dark Mode.
 * - 3 trạng thái trực quan rõ rệt:
 *   1. Chưa đọc / Bắt đầu (0%): Viền rõ ràng, số trang in đậm đen/trắng nét cao.
 *   2. Đang đọc (1% - 99%): Vòng tiến độ xanh ngọc lục bảo (Emerald) tương phản mạnh, số % sắc nét.
 *   3. Đã đọc hết (100%): Huy hiệu xanh Emerald rực rỡ, dấu tích (✓) TRẮNG TINH nổi bật kèm viền sáng.
 */
export const DocumentReadingRing: React.FC<DocumentReadingRingProps> = ({
  currentPage,
  totalPages,
  percent,
  isCompleted: propIsCompleted,
  size: propSize,
  strokeWidth: propStrokeWidth,
  variant = 'header',
  onClick,
  className = '',
}) => {
  const safeTotal = Math.max(1, totalPages);
  const safeCurrent = Math.max(1, Math.min(currentPage, safeTotal));
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  const isCompleted = propIsCompleted ?? (safePercent === 100);

  // Kích thước chuẩn theo từng biến thể để hiển thị số và icon rõ nét nhất
  const size = propSize || (variant === 'floating' ? 44 : variant === 'header' ? 32 : 36);
  const strokeWidth = propStrokeWidth || (variant === 'floating' ? 3.6 : 3.2);

  // SVG Geometry
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Clockwise offset: circumference - (percent / 100) * circumference
  const strokeDashoffset = circumference - (safePercent / 100) * circumference;

  const tooltipTitle = isCompleted
    ? `Đã hoàn thành toàn bộ ${safeTotal} trang tài liệu (100%). Bấm để cuộn về đầu trang (Trang 1).`
    : safeCurrent > 1 || safePercent > 0
    ? `Tiến độ đọc: Trang ${safeCurrent}/${safeTotal} (${safePercent}%). Bấm để cuộn về đầu trang (Trang 1).`
    : `Tài liệu gồm ${safeTotal} trang. Đang ở đầu trang 1 (0%). Bấm để cuộn đọc tiếp.`;

  // SVG Circular Ring Core
  const renderSvgRing = () => (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90 origin-center block"
      >
        {/* Vòng nền mờ (track) */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={`${
            isCompleted
              ? variant === 'floating'
                ? 'stroke-emerald-400/50'
                : 'stroke-emerald-200 dark:stroke-emerald-800'
              : 'stroke-slate-300 dark:stroke-slate-700'
          } transition-colors duration-300`}
        />

        {/* Đường viền màu tiến độ (progress stroke) */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`${
            isCompleted
              ? variant === 'floating'
                ? 'stroke-white'
                : 'stroke-emerald-600 dark:stroke-emerald-400'
              : safePercent > 0
              ? 'stroke-emerald-600 dark:stroke-emerald-400'
              : 'stroke-transparent'
          } transition-colors duration-300`}
          initial={false}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        />
      </svg>

      {/* Hiển thị trung tâm vòng tròn theo 3 trạng thái với độ tương phản cao tuyệt đối */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <AnimatePresence mode="wait">
          {isCompleted ? (
            <motion.div
              key="completed-check"
              initial={{ scale: 0.2, rotate: -30, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
              className={`flex items-center justify-center ${
                variant === 'floating'
                  ? 'text-white'
                  : 'text-emerald-700 dark:text-emerald-300'
              }`}
            >
              <Check
                className={`${
                  variant === 'floating' ? 'w-5 h-5 text-white' : 'w-4 h-4 text-emerald-700 dark:text-emerald-300'
                } stroke-[3.5] drop-shadow-xs`}
              />
            </motion.div>
          ) : safePercent === 0 ? (
            <motion.span
              key="zero-state"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className={`font-mono font-black tabular-nums leading-none tracking-tight ${
                variant === 'floating' ? 'text-[11px]' : 'text-[9.5px]'
              } text-slate-800 dark:text-slate-100`}
            >
              {safeTotal > 1 ? `1/${safeTotal}` : '0%'}
            </motion.span>
          ) : (
            <motion.span
              key="progress-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`font-mono font-black tabular-nums leading-none tracking-tight ${
                variant === 'floating' ? 'text-[11px]' : 'text-[10px]'
              } text-slate-950 dark:text-white`}
            >
              {safePercent}%
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  // 1. Dạng Header (Badge Pill nổi bật trên thanh công cụ)
  if (variant === 'header') {
    return (
      <button
        type="button"
        onClick={onClick}
        title={tooltipTitle}
        className={`group flex items-center gap-2 px-2.5 py-1 rounded-xl border-2 transition-all cursor-pointer select-none ${
          isCompleted
            ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-600 dark:border-emerald-400 shadow-sm text-emerald-950 dark:text-emerald-50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
            : safePercent > 0
            ? 'bg-white dark:bg-slate-800/90 border-slate-300 dark:border-slate-600 shadow-xs text-slate-900 dark:text-white hover:border-slate-400 dark:hover:border-slate-500'
            : 'bg-white dark:bg-slate-800/90 border-slate-300 dark:border-slate-600 shadow-xs text-slate-800 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500'
        } ${className}`}
      >
        {renderSvgRing()}

        <div className="hidden sm:flex flex-col text-left leading-tight pr-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[10px] uppercase font-extrabold tracking-wider ${
                isCompleted
                  ? 'text-emerald-800 dark:text-emerald-300'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Tiến độ đọc
            </span>
            {isCompleted && (
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`text-xs font-mono font-black tabular-nums ${
                isCompleted
                  ? 'text-emerald-950 dark:text-emerald-100'
                  : 'text-slate-950 dark:text-white'
              }`}
            >
              {isCompleted ? 'Đã đọc xong' : `Trang ${safeCurrent}/${safeTotal}`}
            </span>
            <span
              className={`text-[11px] font-mono font-extrabold ${
                isCompleted
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : safePercent > 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              ({safePercent}%)
            </span>
          </div>
        </div>
      </button>
    );
  }

  // 2. Dạng Floating HUD Widget (Nổi góc dưới màn hình trang đọc)
  if (variant === 'floating') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`fixed sm:absolute bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 ${className}`}
      >
        <button
          type="button"
          onClick={onClick}
          title={tooltipTitle}
          className={`group flex items-center gap-2.5 p-2 rounded-full transition-all cursor-pointer hover:scale-105 active:scale-95 ${
            isCompleted
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-2 border-white shadow-[0_6px_25px_rgba(5,150,105,0.45)] ring-4 ring-emerald-500/30'
              : 'bg-white dark:bg-slate-900/95 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-600 shadow-[0_8px_30px_rgba(0,0,0,0.18)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.6)] ring-1 ring-slate-900/10 dark:ring-white/15 hover:border-emerald-600 dark:hover:border-emerald-400'
          }`}
        >
          {renderSvgRing()}

          <div className="pr-2 hidden group-hover:flex flex-col text-left transition-all max-w-[140px]">
            <span
              className={`text-[9.5px] uppercase font-extrabold tracking-wider ${
                isCompleted ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {isCompleted ? 'Đã đọc xong 100%' : 'Tiến độ đọc'}
            </span>
            <span
              className={`text-xs font-mono font-black whitespace-nowrap leading-none mt-0.5 flex items-center gap-1 ${
                isCompleted ? 'text-white' : 'text-slate-900 dark:text-white'
              }`}
            >
              <span>{isCompleted ? 'Lên đầu trang' : `Trang ${safeCurrent}/${safeTotal}`}</span>
              <ArrowUp
                className={`w-3.5 h-3.5 ${
                  isCompleted ? 'text-emerald-200' : 'text-slate-400 group-hover:text-emerald-500'
                }`}
              />
            </span>
          </div>
        </button>
      </motion.div>
    );
  }

  // 3. Dạng Compact (Chỉ vòng tròn)
  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltipTitle}
      className={`relative inline-flex items-center justify-center p-0.5 rounded-full transition-transform hover:scale-105 cursor-pointer ${className}`}
    >
      {renderSvgRing()}
    </button>
  );
};
