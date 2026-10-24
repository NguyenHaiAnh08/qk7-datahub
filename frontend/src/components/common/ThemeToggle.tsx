/* <!-- Lucian UX/UI Prompt #219 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#219 --> */
import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../hooks/useTheme';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  size = 'md',
  showTooltip = true
}) => {
  const { isDark, toggleTheme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const sizeClasses = {
    sm: 'w-8 h-8 rounded-lg text-xs',
    md: 'w-9 h-9 rounded-xl text-sm',
    lg: 'w-10 h-10 rounded-xl text-base'
  }[size];

  const pixelSize = {
    sm: 16,
    md: 18,
    lg: 20
  }[size];

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-[18px] h-[18px]',
    lg: 'w-5 h-5'
  }[size];

  const tooltipText = isDark
    ? 'Chế độ Tối • Nhấp để đổi sang Sáng'
    : 'Chế độ Sáng • Nhấp để đổi sang Tối';

  // Tính toán chính xác tọa độ tâm nút bấm (--cx, --cy) khi click
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (buttonRef.current) {
      const b = buttonRef.current.getBoundingClientRect();
      const cx = (b.left + b.width / 2).toFixed(0) + 'px';
      const cy = (b.top + b.height / 2).toFixed(0) + 'px';
      document.documentElement.style.setProperty('--cx', cx);
      document.documentElement.style.setProperty('--cy', cy);
    }
    toggleTheme(e);
  };

  return (
    <motion.button
      ref={buttonRef}
      type="button"
      onClick={handleClick}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      className={`u219-tg relative ${sizeClasses} flex items-center justify-center cursor-pointer transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 select-none overflow-hidden ${
        isDark
          ? 'bg-slate-800/90 hover:bg-slate-700 text-amber-400 border border-slate-700/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_2px_8px_rgba(0,0,0,0.35)]'
          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm hover:shadow'
      } ${className}`}
      title={showTooltip ? tooltipText : undefined}
      aria-label={tooltipText}
      aria-pressed={isDark}
    >
      {/* Ambient background glow ring */}
      <motion.div
        className="absolute inset-1 rounded-full pointer-events-none filter blur-[6px]"
        animate={{
          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.18)' : 'rgba(22, 101, 52, 0.12)',
          scale: [0.85, 1.15, 0.85]
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      />

      {/* Hiệu ứng xoay icon SVG Mặt trời / Mặt trăng theo thông số Lucian #219: cubic-bezier(.3,1.4,.5,1) */}
      <div className="relative z-10 flex items-center justify-center pointer-events-none">
        {isDark ? (
          /* SVG Sun chuẩn Lucian #219 với tone Vàng Kim Quân Hiệu */
          <svg
            viewBox="0 0 16 16"
            width={pixelSize}
            height={pixelSize}
            aria-hidden="true"
            className={`${iconSizes} text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]`}
          >
            <circle cx="8" cy="8" r="3" fill="currentColor" />
            <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M8 1.5v1.4M8 13.1v1.4M1.5 8h1.4M13.1 8h1.4M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
            </g>
          </svg>
        ) : (
          /* SVG Moon chuẩn Lucian #219 */
          <svg
            viewBox="0 0 16 16"
            width={pixelSize}
            height={pixelSize}
            aria-hidden="true"
            className={`${iconSizes} text-slate-700 dark:text-slate-300 drop-shadow-[0_0_4px_rgba(22,101,52,0.25)]`}
          >
            <path d="M13.5 9.8A5.6 5.6 0 0 1 6.2 2.5a5.6 5.6 0 1 0 7.3 7.3z" fill="currentColor" />
          </svg>
        )}
      </div>
    </motion.button>
  );
};
