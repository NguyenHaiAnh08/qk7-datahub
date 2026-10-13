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
    iconBg: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    valueText: 'text-white'
  },
  emerald: {
    border: 'border-l-emerald-500',
    iconBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    valueText: 'text-white'
  },
  purple: {
    border: 'border-l-purple-500',
    iconBg: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    valueText: 'text-white'
  },
  red: {
    border: 'border-l-red-500',
    iconBg: 'bg-red-500/10 border-red-500/30 text-red-400',
    valueText: 'text-rose-400'
  },
  amber: {
    border: 'border-l-amber-500',
    iconBg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    valueText: 'text-amber-400'
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
      className={`bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl border border-slate-800 shadow-sm border-l-4 ${scheme.border} transition-all hover:border-slate-700`}
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-400 font-medium tracking-wide uppercase">{label}</span>
          <h3 className={`text-2xl font-extrabold mt-1 tracking-tight ${scheme.valueText}`}>
            {value}
          </h3>
          {subtext && <p className="text-[11px] text-slate-500 mt-0.5">{subtext}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${scheme.iconBg}`}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
};
