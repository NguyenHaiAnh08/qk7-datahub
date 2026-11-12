import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, Calendar, User, Building2, Users, TrendingUp } from 'lucide-react';
import { lectureService } from '../../services/lectureService';
import { TeachingSchedule, HistoryKpi } from '../../types/lecture';

const KpiCard: React.FC<{ label: string; value: string | number; icon: any; color: 'cyan' | 'emerald' | 'amber' | 'purple' }> = ({ label, value, icon: Icon, color }) => {
  const cls = {
    cyan:    'border-l-cyan-500 text-cyan-600 dark:text-cyan-400',
    emerald: 'border-l-emerald-500 text-emerald-600 dark:text-emerald-400',
    amber:   'border-l-amber-500 text-amber-600 dark:text-amber-400',
    purple:  'border-l-purple-500 text-purple-600 dark:text-purple-400',
  }[color];
  const ic = cls.split(' ')[1];
  return (
    <div className={`bg-white dark:bg-[#111827] p-3 rounded-xl border border-slate-200 dark:border-white/[0.08] border-l-2 ${cls}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">{label}</span>
        <Icon className={`w-4 h-4 shrink-0 ${ic}`} />
      </div>
      <div className={`text-xl font-bold font-mono tabular-nums mt-1 ${ic}`}>{value}</div>
    </div>
  );
};

export const TeachingHistoryPanel: React.FC = () => {
  const [items, setItems] = useState<TeachingSchedule[]>([]);
  const [kpi, setKpi] = useState<HistoryKpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await lectureService.getHistory({ from: fromDate || undefined, to: toDate || undefined });
      setItems(res.items || []); setKpi(res.kpi || null);
    } catch (err) { console.error('Load history failed:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [fromDate, toDate]);

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2.5 shrink-0">
          <Clock className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          <span className="font-bold text-sm text-slate-900 dark:text-white">Lịch sử giảng dạy</span>
        </div>
        <div className="flex-1 flex items-center gap-2">
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs" />
          <span className="text-slate-400 text-xs">đến</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs" />
        </div>
        <button onClick={load} disabled={loading}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-40">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /><span>Làm mới</span>
        </button>
      </div>

      {kpi && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Tổng số ca"      value={kpi.total_sessions}      icon={Calendar}   color="cyan" />
          <KpiCard label="Giờ giảng dạy"   value={`${kpi.total_hours}h`}   icon={Clock}      color="emerald" />
          <KpiCard label="Học viên"        value={kpi.total_students}      icon={Users}      color="amber" />
          <KpiCard label="GV tự dạy"       value={kpi.teacher_led_sessions}icon={TrendingUp} color="purple" />
        </div>
      )}

      {items.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3 bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-white/[0.08]">
          <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Chưa có lịch sử giảng dạy</p>
          <p className="text-xs text-slate-500">Ca đã kết thúc sẽ hiển thị tại đây</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(s => (
            <div key={s.schedule_id}
              className="bg-white dark:bg-[#111827] p-3 rounded-lg border border-slate-200 dark:border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-2 hover:border-cyan-500/30 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1" title={s.lecture_title}>{s.lecture_title}</div>
                <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  <span className="flex items-center gap-1"><User className="w-3 h-3" />{s.presenter_name}</span>
                  <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{s.venue_name}</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{s.student_count} HV</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-xs">
                <span className="font-mono text-slate-600 dark:text-slate-400">
                  {new Date(s.start_time).toLocaleDateString('vi-VN')}
                </span>
                <span className="font-mono font-bold px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30">
                  {s.duration_minutes}p
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};