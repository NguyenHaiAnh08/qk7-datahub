import React, { useState, useEffect } from 'react';
import {
  Radio, RefreshCw, AlertTriangle, Clock, Users, Building2, User,
  Square, ShieldAlert, Monitor, Sparkles, BookOpen, Layers, HelpCircle, CheckCircle2
} from 'lucide-react';
import { lectureService } from '../../services/lectureService';
import { toast } from '../common/Toast';
import { TeachingSchedule } from '../../types/lecture';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { TacticalEmptyState } from '../common/TacticalEmptyState';

interface Props {
  currentUserId?: string;
  canForceEnd: boolean;
}

export const LiveMonitorPanel: React.FC<Props> = ({ currentUserId, canForceEnd }) => {
  const [sessions, setSessions] = useState<TeachingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [endingId, setEndingId] = useState<string | null>(null);

  // Confirm dialog state
  const [confirmTarget, setConfirmTarget] = useState<{
    session: TeachingSchedule;
    isForce: boolean;
  } | null>(null);

  const load = async () => {
    try {
      const res = await lectureService.getLiveSchedules();
      setSessions(res.items || []);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Load live sessions failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // 5s thay vì 15s để đồng bộ tiến độ slide và thời gian tức thời
    return () => clearInterval(t);
  }, []);

  const handleConfirmEnd = async () => {
    if (!confirmTarget) return;
    const { session: s, isForce } = confirmTarget;
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
      setConfirmTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header bar của Radar Giám sát */}
      <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 animate-ping opacity-75" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
              <span>Hệ Thống Giám Sát Giảng Đường Trực Tiếp</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                Live Radar
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Đang có <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{sessions.length}</strong> giảng đường đang vận hành
              {lastUpdate && ` — cập nhật lần cuối lúc ${lastUpdate.toLocaleTimeString('vi-VN')}`}
            </p>
          </div>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition active:scale-95 cursor-pointer border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Làm mới radar</span>
        </button>
      </div>

      {/* Trạng thái không có ca giảng dạy */}
      {sessions.length === 0 ? (
        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-xs">
          <TacticalEmptyState
            title="Tất cả các giảng đường hiện đang trống"
            description="Hiện không có ca giảng dạy nào đang diễn ra trong phân hệ. Ca học sẽ tự động xuất hiện trên Radar khi giảng viên bấm 'Mở ca dạy' từ danh sách bài giảng đã xuất bản."
            icon={<Monitor className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />}
            onRefresh={load}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map((s) => {
            const isOwner = s.presenter_id === currentUserId;
            const canEndOwn = isOwner;
            const canForce = !isOwner && canForceEnd;

            return (
              <div
                key={s.schedule_id}
                className={`bg-white dark:bg-[#111827] rounded-2xl border p-5 flex flex-col gap-3.5 transition-all shadow-xs relative ${
                  s.is_hanging
                    ? 'border-amber-500/60 bg-amber-50/20 dark:bg-amber-950/10 shadow-amber-500/10'
                    : 'border-slate-200 dark:border-white/[0.08] hover:border-emerald-500/40'
                }`}
              >
                {/* Giảng đường & Trạng thái */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-white/[0.04] pb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-700 dark:text-emerald-400 font-bold">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                        {s.venue_name.toLowerCase().startsWith('giảng đường') ? s.venue_name : `Giảng đường: ${s.venue_name}`}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        Lớp: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{s.class_name || 'Học viên'}</strong>
                      </div>
                    </div>
                  </div>

                  {s.is_hanging ? (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-400 dark:border-amber-500/40 shrink-0 flex items-center gap-1 animate-pulse">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      CẢNH BÁO TREO CA
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 shrink-0 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      ĐANG GIẢNG BÀI
                    </span>
                  )}
                </div>

                {/* Tiêu đề bài giảng */}
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1" title={s.lecture_title}>
                    {s.lecture_title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    Môn: {s.subject_name || 'Quân sự'}
                  </p>
                </div>

                {/* 3 Ô thông tin chi tiết độc lập */}
                <div className="space-y-2 text-xs">
                  {/* Ô 1: Giảng viên & Chức danh / Chức vụ */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/[0.06] flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-300/40">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-none uppercase tracking-wider">
                        Cán bộ giảng dạy
                      </span>
                      <span className={`font-bold text-slate-900 dark:text-white truncate block mt-0.5 text-xs ${isOwner ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
                        {s.presenter_rank ? `${s.presenter_rank} ` : ''}{s.presenter_name}
                      </span>
                    </div>
                  </div>

                  {/* 2 Ô hàng dưới: Sĩ số học viên & Thời lượng ca giảng */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Ô 2: Sĩ số học viên — Hiển thị "X / Y HV" khi có sĩ số chính thức */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/[0.06] flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-300/40">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-none uppercase tracking-wider">
                          Sĩ số
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono truncate block mt-0.5 text-xs">
                          {s.student_count}
                          {s.class_student_total != null && (
                            <span className="text-amber-600 dark:text-amber-400">
                              {' / '}{s.class_student_total}
                            </span>
                          )}
                          <span className="font-normal text-slate-500 dark:text-slate-400"> HV</span>
                        </span>
                      </div>
                    </div>

                    {/* Ô 3: Thời lượng chuẩn đồng bộ với phòng chiếu */}
                    {(() => {
                      const elapsedMinutes = s.start_time
                        ? Math.max(0, Math.floor((Date.now() - new Date(s.start_time).getTime()) / 60000))
                        : (s.duration_minutes || 0);

                      return (
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/[0.06] flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-300/40">
                            <Clock className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-none uppercase tracking-wider">
                              Thời lượng
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono truncate block mt-0.5 text-xs">
                              {elapsedMinutes} phút
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Quiz kích hoạt (nếu có) */}
                  {typeof s.quiz_activated_count === 'number' && s.quiz_activated_count > 0 && (
                    <div className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300/40 dark:border-amber-700/40 flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-xs">
                      <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>{s.quiz_activated_count} Quiz đã kích hoạt cho học viên</span>
                    </div>
                  )}
                </div>

                {/* 🆕 TIẾN ĐỘ CA DẠY — UX/UI ĐẲNG CẤP, RÕ RÀNG % VÀ ĐOẠN ĐANG DẠY */}
                {(() => {
                  const slidePercent = s.slide_total && s.slide_total > 0
                    ? Math.round(((s.slide_index || 0) / s.slide_total) * 100)
                    : 0;
                  const rawPercent = s.scorm_progress !== undefined && s.scorm_progress !== null
                    ? Math.round(s.scorm_progress * 100)
                    : slidePercent;
                  const percent = Math.min(100, Math.max(0, rawPercent));
                  const isDone = percent >= 100;
                  const isRunning = percent > 0 && percent < 100;
                  const elapsedMinutes = s.start_time
                    ? Math.max(0, Math.floor((Date.now() - new Date(s.start_time).getTime()) / 60000))
                    : (s.duration_minutes || 0);

                  return (
                    <div className="p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 space-y-2.5 shadow-2xs">
                      {/* Tiêu đề tiến độ + Vị trí / Đoạn bài giảng đang dạy */}
                      <div className="flex items-center justify-between text-xs font-semibold gap-2">
                        <span className="text-slate-800 dark:text-slate-200 flex items-center gap-1.5 font-bold">
                          <Monitor className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          Tiến độ bài giảng
                        </span>

                        {/* Đoạn bài giảng / Slide đang dạy */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {s.slide_total ? (
                            <span className="font-mono text-emerald-800 dark:text-emerald-300 text-[11px] font-bold tabular-nums bg-emerald-100/80 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-300/60 dark:border-emerald-600/40 shadow-2xs">
                              Đang dạy: Slide {s.slide_index || Math.max(1, Math.ceil((percent / 100) * s.slide_total))}/{s.slide_total}
                            </span>
                          ) : isDone ? (
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-700">
                              Trọn bài
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              {s.current_page ? `Trang ${s.current_page}` : 'Khởi động ca'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Thanh Track Tiến độ gradient sống động có glow */}
                      <div className="w-full h-3 bg-slate-200/90 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 relative border border-slate-300/60 dark:border-slate-700/60 shadow-inner">
                        <div
                          style={{ width: `${Math.max(percent, isRunning ? 2 : 0)}%` }}
                          className={`h-full rounded-full transition-all duration-700 ease-out relative ${
                            isDone
                              ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-400 shadow-xs'
                              : isRunning
                              ? 'bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-500 shadow-xs'
                              : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        />
                      </div>

                      {/* Dòng trạng thái theo đề xuất Chỉ huy: Tiến độ ca dạy: 54% | 100% Hoàn thành */}
                      <div className="flex items-center justify-between text-xs">
                        {isDone ? (
                          <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                            <span>Tiến độ ca dạy: <strong className="font-extrabold font-mono text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm">100% Hoàn thành</strong></span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                            <span className="text-slate-600 dark:text-slate-400 font-medium">Tiến độ ca dạy:</span>
                            <strong className="font-extrabold font-mono text-sky-600 dark:text-sky-400 text-xs sm:text-sm">
                              {percent}%
                            </strong>
                            {isRunning && (
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse ml-0.5" />
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          {s.is_hanging ? (
                            <span className="text-rose-600 dark:text-rose-400 animate-pulse font-extrabold flex items-center gap-1 text-[10px]">
                              ⚠️ CẢNH BÁO QUÁ GIỜ
                            </span>
                          ) : isDone ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold text-[11px] bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-700/50">
                              ✓ Sẵn sàng kết thúc ca
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              Đã dạy {elapsedMinutes} phút
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Nút điều khiển ca dạy */}
                {(canEndOwn || canForce) && (
                  <div className="mt-auto pt-2 border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-end gap-2">
                    {canEndOwn && (
                      <button
                        type="button"
                        onClick={() => setConfirmTarget({ session: s, isForce: false })}
                        disabled={endingId === s.schedule_id}
                        className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
                      >
                        {endingId === s.schedule_id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Square className="w-3.5 h-3.5 fill-current" />
                        )}
                        <span>Kết thúc ca dạy</span>
                      </button>
                    )}

                    {canForce && (
                      <button
                        type="button"
                        onClick={() => setConfirmTarget({ session: s, isForce: true })}
                        disabled={endingId === s.schedule_id}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-[#b91c1c] to-[#dc2626] hover:from-[#dc2626] hover:to-[#ef4444] text-white border border-rose-700 shadow-xs rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
                        title="Quyền Chỉ huy/Admin: Buộc kết thúc ca dạy bị treo"
                      >
                        {endingId === s.schedule_id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ShieldAlert className="w-3.5 h-3.5" />
                        )}
                        <span>Buộc kết thúc ca treo</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ConfirmDialog thay thế hoàn toàn window.confirm */}
      <ConfirmDialog
        open={!!confirmTarget}
        title={confirmTarget?.isForce ? 'Xác nhận Buộc Kết Thúc Ca Giảng Dạy' : 'Xác nhận Kết Thúc Ca Giảng Dạy'}
        description={
          confirmTarget?.isForce
            ? `Đồng chí đang thực hiện quyền Chỉ huy/Admin để BUỘC KẾT THÚC ca giảng dạy "${confirmTarget.session.lecture_title}" của giảng viên ${confirmTarget.session.presenter_name}. Hành động này sẽ giải phóng giảng đường "${confirmTarget.session.venue_name}" ngay lập tức.`
            : `Đồng chí có chắc chắn muốn KẾT THÚC ca giảng dạy "${confirmTarget?.session.lecture_title}" tại ${confirmTarget?.session.venue_name}? Dữ liệu thời lượng và tiến độ sẽ được lưu vào Lịch sử giảng dạy.`
        }
        confirmText={confirmTarget?.isForce ? 'Buộc kết thúc ngay' : 'Kết thúc ca học'}
        cancelText="Quay lại"
        isDestructive={true}
        onConfirm={handleConfirmEnd}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
};