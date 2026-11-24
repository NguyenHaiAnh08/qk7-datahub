import React from 'react';
import { X, BookOpen, User, Building2, Shield, Calendar, HelpCircle, AlertTriangle } from 'lucide-react';
import { Lecture, LectureStatus } from '../../types/lecture';
import { ApprovalStepper } from '../common/ApprovalStepper';

interface Props {
  open: boolean;
  lecture: Lecture | null;
  onClose: () => void;
  onOpenReader?: () => void;
}

const STATUS_CONFIG: Record<LectureStatus, { label: string; color: string; bg: string; border: string }> = {
  DRAFT: { label: 'Bản nháp', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' },
  PENDING_FACULTY: { label: 'Chờ Khoa duyệt', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  PENDING_TRAINING: { label: 'Chờ BGH duyệt', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  PUBLISHED: { label: 'Đã xuất bản', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  REJECTED: { label: 'Bị từ chối', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
  ARCHIVED: { label: 'Đã lưu trữ', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-500/15', border: 'border-amber-300 dark:border-amber-500/30' },
  DELETED: { label: 'Đã xóa (Thùng rác)', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
};

const FORMAT_CONFIG: Record<string, { label: string; badge: string }> = {
  PDF: { label: 'Văn bản PDF', badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
  SCORM: { label: 'Gói chuẩn SCORM', badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  HTML5: { label: 'Tương tác HTML5', badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
};

export const LectureDetailModal: React.FC<Props> = ({ open, lecture, onClose, onOpenReader }) => {
  if (!open || !lecture) return null;

  const statusCfg = STATUS_CONFIG[lecture.status] || STATUS_CONFIG.DRAFT;
  const formatCfg = FORMAT_CONFIG[lecture.content_type] || FORMAT_CONFIG.PDF;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-900/80">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white shrink-0">Hồ sơ bài giảng</h3>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 tabular-nums font-semibold">
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
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[38px] min-w-[38px] flex items-center justify-center shrink-0"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto overflow-x-hidden">
          {/* Title & Badge */}
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-3 mb-2 min-w-0">
              <h2
                className="text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-2 [overflow-wrap:anywhere] [word-break:break-word] overflow-hidden min-w-0 flex-1"
                title={lecture.title}
              >
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

          {/* Mini Stepper Flow (Lucian #444) */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-white/[0.06]">
            <ApprovalStepper
              status={lecture.status}
              headerLabel="Tiến trình thẩm định & phê duyệt:"
              steps={['Soạn thảo', 'Khoa/Bộ môn', 'Ban Giám hiệu', 'Xuất bản']}
            />
          </div>

          {/* Telemetry Matrix Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-white/[0.06]">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Môn học</span>
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
        <div className="p-3 px-5 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            {lecture.status === 'PUBLISHED' && onOpenReader && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenReader();
                }}
                className="px-4 py-2 bg-gradient-to-r from-[#166534] to-[#15803d] hover:from-[#15803d] hover:to-[#16a34a] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Đọc bài giảng</span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition active:scale-[0.98] min-h-[36px]"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default LectureDetailModal;
