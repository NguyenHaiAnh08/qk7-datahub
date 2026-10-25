import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { RollingNumber } from '../common/RollingNumber';

export interface DistributionItem {
  id: string | number;
  label: string;
  count: number;
  color?: string;
}

export interface DistributionChartProps {
  title: string;
  icon: ReactNode;
  items: DistributionItem[];
  maxCount?: number;
  barColor?: 'amber' | 'emerald' | 'blue' | 'purple';
  emptyMessage?: string;
  selectedId?: string | number;
  onItemClick?: (item: DistributionItem) => void;
  refreshKey?: number | string;
}

export const DistributionChart: React.FC<DistributionChartProps> = ({
  title,
  icon,
  items,
  maxCount,
  barColor = 'amber',
  emptyMessage = 'Chưa có dữ liệu thống kê',
  selectedId,
  onItemClick,
  refreshKey,
}) => {
  const calculatedMax = maxCount ?? Math.max(...items.map((i) => i.count), 1);

  const barColorClasses = {
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
    blue: 'bg-emerald-600',
    purple: 'bg-[#166534] dark:bg-emerald-500',
  }[barColor];

  const countColorClasses = {
    amber: 'text-amber-600 dark:text-amber-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    blue: 'text-emerald-600 dark:text-emerald-400',
    purple: 'text-[#166534] dark:text-emerald-400',
  }[barColor];

  return (
    <div className="bg-white dark:bg-[#111827] p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-white/[0.08] transition-colors duration-200 min-w-0">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        {icon}
        <span>{title}</span>
      </h3>

      {items.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-3 text-xs">
          {items.map((item) => {
            const percentage = calculatedMax > 0 ? (item.count / calculatedMax) * 100 : 0;
            const isSelected = selectedId !== undefined && String(item.id) === String(selectedId);

            return (
              <div
                key={item.id}
                onClick={() => onItemClick?.(item)}
                className={`flex items-center justify-between gap-3 min-w-0 transition-all duration-150 ${
                  onItemClick
                    ? 'cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800/60 p-1.5 -mx-1.5 rounded-lg active:scale-[0.99]'
                    : ''
                } ${
                  isSelected
                    ? 'bg-amber-500/10 dark:bg-amber-500/20 ring-1 ring-amber-500/40 p-1.5 -mx-1.5 rounded-lg'
                    : ''
                }`}
              >
                <span
                  className={`truncate min-w-0 flex-1 ${
                    isSelected
                      ? 'text-amber-700 dark:text-amber-300 font-bold'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                  title={item.label}
                >
                  {item.label}
                </span>
                <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                  <div className="w-20 sm:w-28 md:w-36 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    {item.count > 0 && (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.max(4, percentage))}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className={`h-full ${item.color || barColorClasses}`}
                      />
                    )}
                  </div>
                  <span
                    className={`font-bold w-6 sm:w-8 text-right shrink-0 font-mono tabular-nums ${
                      item.count > 0 ? countColorClasses : 'text-slate-400 dark:text-slate-600'
                    }`}
                  >
                    <RollingNumber value={item.count} refreshKey={refreshKey} rowHeight="1.2em" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
