import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';

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
}

export const DistributionChart: React.FC<DistributionChartProps> = ({
  title,
  icon,
  items,
  maxCount,
  barColor = 'amber',
  emptyMessage = 'Chưa có dữ liệu thống kê'
}) => {
  const calculatedMax = maxCount ?? Math.max(...items.map((i) => i.count), 1);

  const barColorClasses = {
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
  }[barColor];

  const countColorClasses = {
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
  }[barColor];

  return (
    <div className="bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl border border-slate-800 shadow-sm">
      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
        {icon}
        <span>{title}</span>
      </h3>

      {items.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-3 text-xs">
          {items.map((item) => {
            const percentage = calculatedMax > 0 ? (item.count / calculatedMax) * 100 : 0;
            return (
              <div key={item.id} className="flex items-center justify-between gap-3">
                <span className="text-slate-300 truncate max-w-[180px] sm:max-w-[220px]" title={item.label}>
                  {item.label}
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-28 sm:w-36 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(4, percentage))}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className={`h-full ${item.color || barColorClasses}`}
                    />
                  </div>
                  <span className={`font-bold w-8 text-right ${countColorClasses}`}>
                    {item.count}
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
