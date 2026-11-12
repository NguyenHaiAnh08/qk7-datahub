import React, { useState, useEffect } from 'react';
import { Radio, RefreshCw, AlertTriangle, Clock, Users, Building2, User, Square, ShieldAlert } from 'lucide-react';
import { lectureService } from '../../services/lectureService';
import { toast } from '../common/Toast';
import { TeachingSchedule } from '../../types/lecture';

interface Props {
  currentUserId?: string;
  canForceEnd: boolean; // Chỉ Chỉ huy/Admin mới có cờ này = true
}

export const LiveMonitorPanel: React.FC<Props> = ({ currentUserId, canForceEnd }) => {
  const [sessions, setSessions] = useState<TeachingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [endingId, setEndingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await lectureService.getLiveSchedules();
      setSessions(res.items || []);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Load live sessions failed:', err);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const handleEndSession = async (s: TeachingSchedule, isForce: boolean) => {
    const isOwner = s.presenter_id === currentUserId;
    const confirmMsg = isForce 
      ? `BẠN ĐANG LÀ CHỈ HUY/ADMIN.\nBạn có chắc chắn muốn BUỘC KẾT THÚC ca dạy "${s.lecture_title}" của đồng chí ${s.presenter_name}?`
      : `Bạn có chắc chắn muốn KẾT THÚC ca giảng dạy "${s.lecture_title}" tại ${s.venue_name}?`;
      
    if (!window.confirm(confirmMsg)) return;
    
    setEndingId(s.schedule_id);
    try {
      if (isForce) {
        await lectureService.forceEndSchedule(s.schedule_id);
      } else {
        await lectureService.endSchedule(s.schedule_id);
      }
      toast.success('Đã kết thúc ca giảng dạy thành công!');
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể kết thúc ca dạy');
    } finally {
      setEndingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="relative w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <Radio className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Giám sát giảng đường trực tiếp</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Đang có <strong className="text-cyan-600 dark:text-cyan-400">{sessions.length}</strong> ca hoạt động
              {lastUpdate && ` — cập nhật ${lastUpdate.toLocaleTimeString('vi-VN')}`}
            </p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /><span>Làm mới</span>
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3 bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-white/[0.08]">
          <Radio className="w-10 h-10 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Không có ca giảng dạy nào đang hoạt động</p>
          <p className="text-xs text-slate-500">Ca sẽ hiển thị khi giảng viên bấm "Mở ca dạy"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sessions.map(s => {
            const isOwner = s.presenter_id === currentUserId;
            
            // Nếu là người mở ca -> hiện nút Kết thúc ca
            // Nếu không phải người mở ca NHƯNG có quyền Chỉ huy -> hiện nút Buộc kết thúc
            const canEndOwn = isOwner;
            const canForce = !isOwner && canForceEnd;

            return (
              <div key={s.schedule_id}
                className={`bg-white dark:bg-[#111827] rounded-xl border p-4 flex flex-col gap-2 ${
                  s.is_hanging ? 'border-amber-500/50 shadow-amber-500/10 shadow-sm' : 'border-cyan-500/30'
                }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1" title={s.lecture_title}>{s.lecture_title}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{s.subject_name}</p>
                  </div>
                  {s.is_hanging && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 shrink-0 flex items-center gap-1 animate-pulse">
                      <AlertTriangle className="w-3 h-3" />TREO MÁY
                    </span>
                  )}
                </div>
                <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 text-slate-400" />
                    <span className={isOwner ? "font-bold text-cyan-600 dark:text-cyan-400" : ""}>
                      {s.presenter_rank ? `${s.presenter_rank} ` : ''}{s.presenter_name}
                      {isOwner && " (Bạn)"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    <span className="truncate">{s.venue_name} — {s.class_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-slate-400" /><span>{s.student_count} học viên</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span className="font-mono">{s.duration_minutes} phút</span>
                  </div>
                </div>

                {/* KHU VỰC NÚT ĐIỀU KHIỂN */}
                {(canEndOwn || canForce) && (
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/[0.04] flex justify-end">
                    {canEndOwn && (
                      <button
                        onClick={() => handleEndSession(s, false)}
                        disabled={endingId === s.schedule_id}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 dark:text-rose-400 dark:border-rose-800/50 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                      >
                        {endingId === s.schedule_id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5 fill-current" />}
                        <span>Tự kết thúc ca dạy</span>
                      </button>
                    )}

                    {canForce && (
                      <button
                        onClick={() => handleEndSession(s, true)}
                        disabled={endingId === s.schedule_id}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white border border-red-700 shadow-sm rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                        title="Quyền Chỉ huy/Admin: Buộc kết thúc ca của giảng viên khác"
                      >
                        {endingId === s.schedule_id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                        <span>Buộc kết thúc</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};