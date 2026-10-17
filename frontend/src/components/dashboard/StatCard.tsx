import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  color?: 'blue' | 'emerald' | 'purple' | 'red' | 'amber';
  subtext?: string;
  delay?: number;
}

const colorMap = {
  blue: {
    border: 'border-l-blue-500',
    iconBg: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
    valueText: 'text-slate-900 dark:text-white'
  },
  emerald: {
    border: 'border-l-emerald-500',
    iconBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
    valueText: 'text-slate-900 dark:text-white'
  },
  purple: {
    border: 'border-l-purple-500',
    iconBg: 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400',
    valueText: 'text-slate-900 dark:text-white'
  },
  red: {
    border: 'border-l-red-500',
    iconBg: 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400',
    valueText: 'text-rose-600 dark:text-rose-400'
  },
  amber: {
    border: 'border-l-amber-500',
    iconBg: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
    valueText: 'text-amber-600 dark:text-amber-400'
  }
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  color = 'blue',
  subtext,
  delay = 0
}) => {
  const scheme = colorMap[color] || colorMap.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`bg-white dark:bg-slate-900/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 ${scheme.border} transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0`}
    >
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <span
            className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold tracking-wide uppercase block truncate"
            title={label}
          >
            {label}
          </span>
          <h3 className={`text-xl sm:text-2xl font-black mt-1 tracking-tight leading-tight truncate ${scheme.valueText}`}>
            {value}
          </h3>
          {subtext && (
            <p
              className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-tight line-clamp-1"
              title={subtext}
            >
              {subtext}
            </p>
          )}
        </div>
        <div
          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl border flex items-center justify-center shrink-0 ${scheme.iconBg}`}
        >
          {icon}
        </div>
      </div>
    </motion.div>
  );
};
