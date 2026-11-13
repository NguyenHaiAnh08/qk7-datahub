import React from 'react';
import { X, BookOpen, User, Building2, Shield, Calendar, HelpCircle, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { Lecture, LectureStatus } from '../../types/lecture';

interface Props {
  open: boolean;
  lecture: Lecture | null;
  onClose: () => void;
}

const STATUS_CONFIG: Record<LectureStatus, { label: string; color: string; bg: string; border: string }> = {
  DRAFT: { label: 'Bản nháp', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' },
  PENDING_FACULTY: { label: 'Chờ Khoa duyệt', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  PENDING_TRAINING: { label: 'Chờ BGH duyệt', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  PUBLISHED: { label: 'Đã xuất bản', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  REJECTED: { label: 'Bị từ chối', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
  ARCHIVED: { label: 'Đã lưu trữ', color: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
};

const FORMAT_CONFIG: Record<string, { label: string; badge: string }> = {
  PDF: { label: 'Văn bản PDF', badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
  SCORM: { label: 'Gói chuẩn SCORM', badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  HTML5: { label: 'Tương tác HTML5', badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
};

export const LectureDetailModal: React.FC<Props> = ({ open, lecture, onClose }) => {
  if (!open || !lecture) return null;

  const statusCfg = STATUS_CONFIG[lecture.status] || STATUS_CONFIG.DRAFT;
  const formatCfg = FORMAT_CONFIG[lecture.content_type] || FORMAT_CONFIG.PDF;

  // Mini stepper states
  const stages = [
    { key: 'DRAFT', label: 'Soạn thảo' },
    { key: 'FACULTY', label: 'Khoa/Bộ môn' },
    { key: 'TRAINING', label: 'Ban Giám hiệu' },
    { key: 'PUBLISHED', label: 'Xuất bản' },
  ];

  const getStageState = (index: number) => {
    if (lecture.status === 'PUBLISHED') return 'completed';
    if (lecture.status === 'REJECTED') {
      return index === 0 ? 'completed' : 'rejected';
    }
    if (lecture.status === 'PENDING_TRAINING') {
      if (index <= 1) return 'completed';
      if (index === 2) return 'current';
      return 'pending';
    }
    if (lecture.status === 'PENDING_FACULTY') {
      if (index === 0) return 'completed';
      if (index === 1) return 'current';
      return 'pending';
    }
    if (lecture.status === 'DRAFT') {
      if (index === 0) return 'current';
      return 'pending';
    }
    return 'pending';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">Hồ sơ bài giảng</h3>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 tabular-nums font-semibold shrink-0">
                  {lecture.lecture_code || 'CHƯA CÓ MÃ'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Mã định danh hệ thống: <span className="font-mono">{lecture.lecture_id}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[38px] min-w-[38px] flex items-center justify-center"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto">
          {/* Title & Badge */}
          <div>
            <div className="flex items-start justify-between gap-3 mb-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                {lecture.title}
              </h2>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0 ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
                {statusCfg.label}
              </span>
            </div>

            {/* Reject reason warning if rejected */}
            {lecture.status === 'REJECTED' && lecture.reject_reason && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-rose-700 dark:text-rose-300 mb-3">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="min-w-0">
                  <span className="font-bold block text-[11px]">Lý do từ chối:</span>
                  <p className="text-xs whitespace-pre-line mt-0.5">{lecture.reject_reason}</p>
                </div>
              </div>
            )}
          </div>

          {/* Mini Stepper Flow */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-white/[0.06]">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
              Tiến trình thẩm định & phê duyệt
            </div>
            <div className="grid grid-cols-4 gap-1.5 relative">
              {stages.map((st, idx) => {
                const state = getStageState(idx);
                return (
                  <div key={st.key} className="flex flex-col items-center text-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors mb-1 ${
                      state === 'completed'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : state === 'current'
                        ? 'bg-amber-500 text-white animate-pulse'
                        : state === 'rejected'
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                    }`}>
                      {state === 'completed' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : state === 'current' ? (
                        <Clock className="w-3.5 h-3.5" />
                      ) : state === 'rejected' ? (
                        <X className="w-3.5 h-3.5" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span className={`text-[10px] font-medium leading-tight ${
                      state === 'current' ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-600 dark:text-slate-400'
                    }`}>
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Telemetry Matrix Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-white/[0.06]">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Môn học trực thuộc</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{lecture.subject_name || 'Chưa gán môn'}</span>
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-white/[0.06]">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Khoa / Bộ môn</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{lecture.faculty_name || 'Chưa gán khoa'}</span>
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-white/[0.06]">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Giảng viên / Tác giả</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">
                  {lecture.author_rank ? `${lecture.author_rank} ` : ''}
                  {lecture.author_name || 'Khuyết danh'}
                </span>
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-white/[0.06]">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Cấp độ bảo mật</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>{lecture.security_name || `Cấp ${lecture.security_level_id}`}</span>
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-white/[0.06]">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Định dạng số hóa</span>
              <span className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-[11px] border ${formatCfg.badge}`}>
                {formatCfg.label}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-white/[0.06]">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Câu hỏi Quiz tương tác</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-mono tabular-nums font-bold">{lecture.quiz_count ?? 0}</span> câu hỏi
              </span>
            </div>
          </div>

          {/* Timeline & Metadata */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-200 dark:border-white/[0.06]">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              Khởi tạo: <span className="font-mono tabular-nums">{lecture.created_at ? new Date(lecture.created_at).toLocaleDateString('vi-VN') : '—'}</span>
            </span>
            <span className="font-mono tabular-nums">
              Cập nhật: {lecture.updated_at ? new Date(lecture.updated_at).toLocaleDateString('vi-VN') : '—'}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 px-5 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-end bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold transition active:scale-[0.98] min-h-[38px]"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default LectureDetailModal;
