import React, { useState, useEffect } from 'react';
import {
  Clock, RefreshCw, Calendar, User, Building2, Users, TrendingUp, History, GraduationCap
} from 'lucide-react';
import { motion } from 'framer-motion';
import { lectureService } from '../../services/lectureService';
import { TeachingSchedule, HistoryKpi } from '../../types/lecture';
import { RollingNumber } from '../common/RollingNumber';
import { TacticalEmptyState } from '../common/TacticalEmptyState';
import { DateRangePicker } from '../common/DateRangePicker';

const HistoryKpiCard: React.FC<{
  label: string;
  value: number;
  suffix?: string;
  icon: any;
  tone: 'emerald' | 'amber' | 'blue' | 'purple';
  delay?: number;
  refreshKey?: number | string;
}> = ({ label, value, suffix, icon: Icon, tone, delay = 0, refreshKey }) => {
  const toneCfg = {
    emerald: {
      border: 'border-l-emerald-600 dark:border-l-emerald-500',
      bgIcon: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
      text: 'text-slate-900 dark:text-white',
    },
    amber: {
      border: 'border-l-amber-500',
      bgIcon: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
      text: 'text-slate-900 dark:text-white',
    },
    blue: {
      border: 'border-l-blue-500',
      bgIcon: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
      text: 'text-slate-900 dark:text-white',
    },
    purple: {
      border: 'border-l-purple-500',
      bgIcon: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
      text: 'text-slate-900 dark:text-white',
    },
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 360, damping: 26, delay }}
      className={`bg-white dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] border-l-4 ${toneCfg.border} shadow-2xs hover:shadow-xs relative overflow-hidden group hover:border-slate-300 dark:hover:border-white/20 transition-all flex flex-col justify-between`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
          {label}
        </span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${toneCfg.bgIcon} group-hover:scale-105 transition-transform`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex items-baseline gap-1.5 mt-2.5">
        <div className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${toneCfg.text}`}>
          <RollingNumber value={value} refreshKey={refreshKey} />
        </div>
        {suffix && (
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {suffix}
          </span>
        )}
      </div>
    </motion.div>
  );
};

export const TeachingHistoryPanel: React.FC = () => {
  const [items, setItems] = useState<TeachingSchedule[]>([]);
  const [kpi, setKpi] = useState<HistoryKpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const res = await lectureService.getHistory({
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setItems(res.items || []);
      setKpi(res.kpi || null);
    } catch (err) {
      console.error('Load history failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [fromDate, toDate]);

  return (
    <div className="space-y-4">
      {/* Bộ lọc khoảng thời gian chuẩn Kho dữ liệu chung (DateRangePicker) */}
      <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-slate-200 dark:border-white/[0.08] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <History className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              Nhật Ký & Lịch Sử Giảng Dạy Quân Sự
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tra cứu ca học đã hoàn thành và tổng hợp chỉ số sư phạm toàn học viện
            </p>
          </div>
        </div>

        {/* Cụm DateRangePicker tái sử dụng từ Kho dữ liệu chung */}
        <div className="flex items-center flex-wrap gap-2.5">
          <DateRangePicker
            startDate={fromDate}
            endDate={toDate}
            onChange={(start, end) => {
              setFromDate(start);
              setToDate(end);
              setHistoryRefreshKey((prev) => prev + 1);
            }}
            onClear={() => {
              setFromDate('');
              setToDate('');
              setHistoryRefreshKey((prev) => prev + 1);
            }}
            compact={true}
            placeholder="Khoảng thời gian giảng dạy (Từ - Đến)"
          />

          <button
            onClick={() => {
              setHistoryRefreshKey((prev) => prev + 1);
              load();
            }}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition active:scale-95 cursor-pointer border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 min-h-[38px]"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* KPI Thống kê sư phạm cuộn số RollingNumber */}
      {kpi && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <HistoryKpiCard
            label="Tổng số ca đã dạy"
            value={kpi.total_sessions || 0}
            suffix="ca"
            icon={Calendar}
            tone="blue"
            delay={0}
            refreshKey={historyRefreshKey}
          />
          <HistoryKpiCard
            label="Tổng giờ giảng bài"
            value={kpi.total_hours || 0}
            suffix="giờ"
            icon={Clock}
            tone="emerald"
            delay={0.05}
            refreshKey={historyRefreshKey}
          />
          <HistoryKpiCard
            label="Tổng lượt học viên"
            value={kpi.total_students || 0}
            suffix="lượt"
            icon={Users}
            tone="amber"
            delay={0.1}
            refreshKey={historyRefreshKey}
          />
          <HistoryKpiCard
            label="Ca giảng viên trực tiếp"
            value={kpi.teacher_led_sessions || 0}
            suffix="ca"
            icon={TrendingUp}
            tone="purple"
            delay={0.15}
            refreshKey={historyRefreshKey}
          />
        </div>
      )}

      {/* Bảng danh sách lịch sử */}
      {items.length === 0 ? (
        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-xs">
          <TacticalEmptyState
            title="Chưa có dữ liệu lịch sử trong khoảng thời gian này"
            description="Các ca giảng dạy sau khi kết thúc sẽ được lưu trữ tự động vào nhật ký hệ thống để phục vụ công tác thanh tra đào tạo và thống kê giờ giảng."
            icon={<Clock className="w-10 h-10 text-slate-400 dark:text-slate-500" />}
            onRefresh={load}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((s) => {
            const presenterFull = [s.presenter_rank, s.presenter_name].filter(Boolean).join(' ') || s.presenter_name || 'Chưa xác định';
            const venueLabel = s.venue_name || '1';
            const classLabel = s.class_name || 'Học viên';
            const studentCountLabel = s.student_count ?? 0;

            const startDate = s.start_time ? new Date(s.start_time) : null;
            const startTimeStr = startDate ? startDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--';
            const endDate = s.end_time
              ? new Date(s.end_time)
              : (startDate && s.duration_minutes
                  ? new Date(startDate.getTime() + s.duration_minutes * 60000)
                  : null);
            const endTimeStr = endDate ? endDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--';
            const dateStr = startDate ? startDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

            return (
              <div
                key={s.schedule_id}
                className="bg-white dark:bg-[#111827] p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-emerald-500/40 hover:shadow-xs transition-all"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white line-clamp-1" title={s.lecture_title}>
                      {s.lecture_title}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded border bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30 shrink-0">
                      Hoàn thành
                    </span>
                  </div>
                  <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400 mt-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Giảng viên: <strong className="font-bold text-slate-900 dark:text-white">{presenterFull}</strong></span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Giảng đường: <strong className="font-bold text-slate-900 dark:text-white">{venueLabel}</strong></span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span>Lớp: <strong className="font-bold text-slate-900 dark:text-white">{classLabel}</strong></span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                      <span>Sĩ số học viên tham gia: <strong className="font-bold text-slate-900 dark:text-white">{studentCountLabel}</strong></span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-xs">
                  <div className="text-right flex flex-col items-end justify-center">
                    <div className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {startTimeStr} - {endTimeStr}
                    </div>
                    <div className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400 mt-0.5">
                      {dateStr}
                    </div>
                  </div>
                  <span className="font-mono font-bold px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 text-xs shadow-2xs">
                    {s.duration_minutes || 0} phút
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

export default TeachingHistoryPanel;
