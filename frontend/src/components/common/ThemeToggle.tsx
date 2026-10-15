import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
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

  const sizeClasses = {
    sm: 'w-8 h-8 rounded-lg text-xs',
    md: 'w-9 h-9 rounded-xl text-sm',
    lg: 'w-10 h-10 rounded-xl text-base'
  }[size];

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-4.5 h-4.5',
    lg: 'w-5 h-5'
  }[size];

  const tooltipText = isDark
    ? 'Chế độ Tối • Nhấp để đổi sang Sáng'
    : 'Chế độ Sáng • Nhấp để đổi sang Tối';

  return (
    <motion.button
      type="button"
      onClick={(e) => toggleTheme(e)}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      className={`relative ${sizeClasses} flex items-center justify-center cursor-pointer transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 select-none overflow-hidden ${
        isDark
          ? 'bg-slate-800/90 hover:bg-slate-700 text-amber-400 border border-slate-700/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_2px_8px_rgba(0,0,0,0.35)]'
          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm hover:shadow'
      } ${className}`}
      title={showTooltip ? tooltipText : undefined}
      aria-label={tooltipText}
    >
      {/* Ambient background glow ring */}
      <motion.div
        className="absolute inset-1 rounded-full pointer-events-none filter blur-[6px]"
        animate={{
          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.18)' : 'rgba(99, 102, 241, 0.12)',
          scale: [0.85, 1.15, 0.85]
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      />

      {/* Animated icon morphing & rotation */}
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.div
            key="sun"
            initial={{ rotate: -90, scale: 0.2, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0.2, opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 22
            }}
            className="relative z-10 flex items-center justify-center"
          >
            {/* Golden Sun with prominent rays as in user image */}
            <Sun
              className={`${iconSizes} text-amber-400 stroke-[2.25] drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]`}
            />
          </motion.div>
        ) : (
          <motion.div
            key="moon"
            initial={{ rotate: 90, scale: 0.2, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: -90, scale: 0.2, opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 22
            }}
            className="relative z-10 flex items-center justify-center"
          >
            {/* Elegant crescent moon outline as in user image */}
            <Moon
              className={`${iconSizes} text-slate-700 dark:text-slate-300 stroke-[2.2] drop-shadow-[0_0_4px_rgba(99,102,241,0.35)]`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
};
