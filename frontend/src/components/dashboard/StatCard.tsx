import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { RollingNumber } from '../common/RollingNumber';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  color?: 'blue' | 'emerald' | 'purple' | 'red' | 'amber';
  subtext?: string;
  delay?: number;
  refreshKey?: number | string;
}

const colorMap = {
  blue: {
    border: 'border-l-blue-500',
    iconText: 'text-blue-600 dark:text-blue-400',
    valueText: 'text-slate-900 dark:text-white'
  },
  emerald: {
    border: 'border-l-emerald-600 dark:border-l-emerald-500',
    iconText: 'text-emerald-600 dark:text-emerald-400',
    valueText: 'text-slate-900 dark:text-white'
  },
  purple: {
    border: 'border-l-amber-500',
    iconText: 'text-amber-600 dark:text-amber-400',
    valueText: 'text-slate-900 dark:text-white'
  },
  red: {
    border: 'border-l-rose-500',
    iconText: 'text-rose-600 dark:text-rose-400',
    valueText: 'text-rose-600 dark:text-rose-400'
  },
  amber: {
    border: 'border-l-amber-500',
    iconText: 'text-amber-600 dark:text-amber-400',
    valueText: 'text-amber-600 dark:text-amber-400'
  }
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  color = 'blue',
  subtext,
  delay = 0,
  refreshKey,
}) => {
  const scheme = colorMap[color] || colorMap.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 360, damping: 26, delay }}
      className={`group relative bg-white dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] border-l-2 ${scheme.border} transition-colors duration-150 hover:border-slate-300 dark:hover:border-white/20 min-w-0 flex flex-col justify-between`}
    >
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-xs text-slate-500 dark:text-slate-400 font-semibold truncate"
            title={label}
          >
            {label}
          </span>
          <div className={`shrink-0 opacity-80 group-hover:opacity-100 transition-opacity ${scheme.iconText}`}>
            {icon}
          </div>
        </div>
        <h3 className={`text-2xl font-bold font-mono tabular-nums mt-1.5 tracking-tight leading-none truncate ${scheme.valueText}`}>
          <RollingNumber value={value} refreshKey={refreshKey} />
        </h3>
        {subtext && (
          <p
            className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 pt-2 border-t border-slate-100 dark:border-white/[0.04] leading-tight truncate font-medium"
            title={subtext}
          >
            {subtext}
          </p>
        )}
      </div>
    </motion.div>
  );
};
