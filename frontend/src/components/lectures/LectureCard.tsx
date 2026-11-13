import React from 'react';
import {
  FileText, Layers, FileCode, Send, Check, X,
  Play, Archive, Hash, Building2, User, AlertTriangle, Edit, RotateCcw, Eye,
  HelpCircle, Shield, CheckCircle2, Clock
} from 'lucide-react';
import { Lecture, ContentType, LectureStatus } from '../../types/lecture';

const STATUS_STYLES: Record<LectureStatus, { label: string; badgeCls: string; step: number }> = {
  DRAFT:            { label: 'Bản nháp',          badgeCls: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700', step: 1 },
  PENDING_FACULTY:  { label: 'Chờ Khoa duyệt',    badgeCls: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30', step: 2 },
  PENDING_TRAINING: { label: 'Chờ BGH duyệt',     badgeCls: 'bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40', step: 3 },
  PUBLISHED:        { label: 'Đã xuất bản',       badgeCls: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30', step: 4 },
  REJECTED:         { label: 'Cần chỉnh sửa',     badgeCls: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30', step: 1 },
  ARCHIVED:         { label: 'Lưu trữ',           badgeCls: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/60 dark:text-slate-500 dark:border-slate-800', step: 0 },
};

const CONTENT_CONFIG: Record<ContentType, { icon: typeof FileText; label: string; badgeCls: string; iconCls: string }> = {
  PDF: {
    icon: FileText,
    label: 'Tài liệu PDF',
    badgeCls: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
    iconCls: 'text-rose-600 dark:text-rose-400',
  },
  SCORM: {
    icon: Layers,
    label: 'Gói SCORM',
    badgeCls: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    iconCls: 'text-amber-600 dark:text-amber-400',
  },
  HTML5: {
    icon: FileCode,
    label: 'Gói HTML5',
    badgeCls: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    iconCls: 'text-emerald-600 dark:text-emerald-400',
  },
};

const SECURITY_LEVEL_LABELS: Record<number, { label: string; cls: string }> = {
  1: { label: 'Cấp 1 — Công khai', cls: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25' },
  2: { label: 'Cấp 2 — Nội bộ',    cls: 'text-sky-700 bg-sky-50 dark:bg-sky-500/10 dark:text-sky-400 border-sky-200 dark:border-sky-500/25' },
  3: { label: 'Cấp 3 — Mật',      cls: 'text-amber-700 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/25' },
  4: { label: 'Cấp 4 — Tối mật',  cls: 'text-rose-700 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200 dark:border-rose-500/25' },
  5: { label: 'Cấp 5 — Tuyệt mật', cls: 'text-rose-900 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300 border-rose-300 dark:border-rose-500/40 font-bold' },
};

export interface LectureCardProps {
  lecture: Lecture;
  viewMode: 'grid' | 'table';
  currentUserId?: string;
  isAdmin: boolean;
  canApprove: boolean;
  canArchive: boolean;
  canStartSchedule: boolean;
  canEdit: boolean;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onEdit: () => void;
  onView: () => void;
  onStartSession: () => void;
}

export const LectureCard: React.FC<LectureCardProps> = ({
  lecture, viewMode, currentUserId, isAdmin, canApprove, canArchive, canStartSchedule, canEdit,
  onSubmit, onApprove, onReject, onArchive, onRestore, onEdit, onView, onStartSession,
}) => {
  const statusCfg = STATUS_STYLES[lecture.status] || STATUS_STYLES.DRAFT;
  const contentCfg = CONTENT_CONFIG[lecture.content_type] || CONTENT_CONFIG.PDF;
  const ContentIcon = contentCfg.icon;
  const secCfg = SECURITY_LEVEL_LABELS[lecture.security_level_id] || SECURITY_LEVEL_LABELS[2];

  const isAuthor = isAdmin || (currentUserId && currentUserId === lecture.author_id);
  const isDraftOrRejected = lecture.status === 'DRAFT' || lecture.status === 'REJECTED';
  const isPendingFaculty  = lecture.status === 'PENDING_FACULTY';
  const isPendingTraining = lecture.status === 'PENDING_TRAINING';
  const isPublished       = lecture.status === 'PUBLISHED';
  const isArchived        = lecture.status === 'ARCHIVED';

  type Action = { label: string; icon: typeof FileText; onClick: () => void; cls: string };
  const actions: Action[] = [];

  // 1. Xem chi tiết
  actions.push({
    label: 'Xem chi tiết',
    icon: Eye,
    onClick: onView,
    cls: 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
  });

  // 2. Tác giả: Sửa, Gửi duyệt, Mở ca dạy
  if (isAuthor) {
    if (isDraftOrRejected && canEdit) {
      actions.push({
        label: 'Chỉnh sửa',
        icon: Edit,
        onClick: onEdit,
        cls: 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30'
      });
      actions.push({
        label: 'Gửi duyệt',
        icon: Send,
        onClick: onSubmit,
        cls: 'bg-[#166534] hover:bg-[#14532d] text-white border border-emerald-600 shadow-xs'
      });
    }

    // Mở ca dạy khi đã PUBLISHED
    if (isPublished && canStartSchedule) {
      actions.push({
        label: 'Mở ca dạy',
        icon: Play,
        onClick: onStartSession,
        cls: 'bg-gradient-to-r from-[#166534] to-[#15803d] hover:from-[#15803d] hover:to-[#16a34a] text-white font-bold border border-emerald-500/40 shadow-xs'
      });
    }
  }

  // 3. Quyền phê duyệt 2 tầng (Chỉ huy Khoa / Đào tạo / BGH)
  if (canApprove) {
    if (isPendingFaculty) {
      actions.push(
        { label: 'Duyệt Khoa', icon: Check, onClick: onApprove, cls: 'bg-[#166534] hover:bg-[#14532d] text-white font-bold border border-emerald-600' },
        { label: 'Từ chối',    icon: X,     onClick: onReject,  cls: 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30' },
      );
    }
    if (isPendingTraining) {
      actions.push(
        { label: 'Duyệt BGH', icon: Check, onClick: onApprove, cls: 'bg-[#166534] hover:bg-[#14532d] text-white font-bold border border-emerald-600' },
        { label: 'Từ chối',   icon: X,     onClick: onReject,  cls: 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30' },
      );
    }
  }

  // 4. Quyền Lưu trữ / Khôi phục
  if (canArchive) {
    if (!isArchived) {
      actions.push({
        label: 'Lưu trữ',
        icon: Archive,
        onClick: onArchive,
        cls: 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-400'
      });
    } else {
      actions.push({
        label: 'Khôi phục',
        icon: RotateCcw,
        onClick: onRestore,
        cls: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
      });
    }
  }

  // ── TABLE VIEW ──
  if (viewMode === 'table') {
    return (
      <div className="bg-white dark:bg-[#111827] p-3 rounded-xl border border-slate-200 dark:border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-emerald-500/40 hover:shadow-xs transition-all">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 ${contentCfg.iconCls}`}>
            <ContentIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-slate-900 dark:text-white truncate" title={lecture.title}>
                {lecture.title}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${contentCfg.badgeCls}`}>
                {lecture.content_type}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${secCfg.cls}`}>
                {secCfg.label.split('—')[0].trim()}
              </span>
            </div>
            <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">{lecture.lecture_code}</span>
              <span>Môn: <strong className="text-slate-700 dark:text-slate-300">{lecture.subject_name || '—'}</strong></span>
              <span className="truncate">Khoa: {lecture.faculty_name || '—'}</span>
              <span>GV: {lecture.author_name || '—'}</span>
              {typeof lecture.quiz_count === 'number' && lecture.quiz_count > 0 && (
                <span className="text-amber-700 dark:text-amber-400 font-semibold">• {lecture.quiz_count} câu hỏi Quiz</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border whitespace-nowrap ${statusCfg.badgeCls}`}>
            {statusCfg.label}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {actions.map((a, i) => {
              const I = a.icon;
              return (
                <button
                  key={i}
                  onClick={a.onClick}
                  className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${a.cls}`}
                >
                  <I className="w-3.5 h-3.5" />
                  <span>{a.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── GRID VIEW (TACTICAL COMMAND CARD) ──
  return (
    <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-4 flex flex-col gap-3.5 hover:border-emerald-500/40 hover:shadow-md transition-all h-full relative group">
      
      {/* Header Card: Icon định dạng + Badge trạng thái & Bảo mật */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0 shadow-2xs ${contentCfg.iconCls}`}>
            <ContentIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${contentCfg.badgeCls}`}>
                {contentCfg.label}
              </span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${secCfg.cls}`}>
                {secCfg.label.split('—')[0].trim()}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
              <Hash className="w-3 h-3 text-slate-400" />
              <span className="font-bold text-emerald-800 dark:text-emerald-400">{lecture.lecture_code}</span>
            </div>
          </div>
        </div>

        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap shadow-2xs ${statusCfg.badgeCls}`}>
          {statusCfg.label}
        </span>
      </div>

      {/* Tiêu đề bài giảng */}
      <div className="flex-1 min-w-0">
        <h3
          className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors"
          title={lecture.title}
        >
          {lecture.title}
        </h3>
      </div>

      {/* Mini Stepper: Quy trình phê duyệt 2 tầng quân sự */}
      {!isArchived && (
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/[0.05]">
          <div className="flex items-center justify-between text-[10px] font-semibold mb-1.5">
            <span className="text-slate-500 dark:text-slate-400">Tiến trình duyệt 2 tầng:</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">
              {lecture.status === 'PUBLISHED' ? 'Hoàn tất xuất bản' : `Bước ${statusCfg.step}/4`}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1 items-center">
            {/* Step 1: Nháp */}
            <div className={`h-1.5 rounded-full transition-all ${statusCfg.step >= 1 ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`} title="Bước 1: Soạn thảo bài giảng" />
            {/* Step 2: Duyệt Khoa */}
            <div className={`h-1.5 rounded-full transition-all ${statusCfg.step >= 2 ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`} title="Bước 2: Khoa/Bộ môn duyệt" />
            {/* Step 3: Duyệt BGH */}
            <div className={`h-1.5 rounded-full transition-all ${statusCfg.step >= 3 ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`} title="Bước 3: Phòng Đào tạo & BGH duyệt" />
            {/* Step 4: Xuất bản */}
            <div className={`h-1.5 rounded-full transition-all ${statusCfg.step >= 4 ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`} title="Bước 4: Sẵn sàng giảng dạy" />
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 dark:text-slate-500 mt-1 font-medium">
            <span>Soạn thảo</span>
            <span>Khoa duyệt</span>
            <span>BGH duyệt</span>
            <span>Xuất bản</span>
          </div>
        </div>
      )}

      {/* Thông báo từ chối có lý do */}
      {lecture.status === 'REJECTED' && lecture.reject_reason && (
        <div className="flex items-start gap-2 text-[11px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-xl border border-rose-200 dark:border-rose-500/30 leading-relaxed">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div>
            <strong className="block text-[10px] uppercase tracking-wider text-rose-800 dark:text-rose-400">Yêu cầu hiệu chỉnh:</strong>
            <span className="line-clamp-2">{lecture.reject_reason}</span>
          </div>
        </div>
      )}

      {/* Metadata chi tiết */}
      <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-white/[0.04] pt-2.5">
        <div className="flex items-center justify-between gap-1 truncate">
          <span className="text-slate-400 shrink-0">Môn học:</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={lecture.subject_name}>
            {lecture.subject_name || '—'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-1 truncate">
          <span className="text-slate-400 shrink-0">Khoa / Bộ môn:</span>
          <span className="font-medium text-slate-700 dark:text-slate-300 truncate" title={lecture.faculty_name}>
            {lecture.faculty_name || '—'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-1 truncate">
          <span className="text-slate-400 shrink-0">Giảng viên:</span>
          <span className="font-medium text-slate-700 dark:text-slate-300 truncate" title={lecture.author_name}>
            {lecture.author_rank ? `${lecture.author_rank} ` : ''}{lecture.author_name || '—'}
          </span>
        </div>
        {typeof lecture.quiz_count === 'number' && lecture.quiz_count > 0 && (
          <div className="flex items-center justify-between gap-1 text-amber-700 dark:text-amber-400 pt-1 border-t border-dashed border-slate-200 dark:border-slate-800">
            <span className="flex items-center gap-1 font-semibold">
              <HelpCircle className="w-3.5 h-3.5" /> Bộ câu hỏi Quiz:
            </span>
            <span className="font-mono font-bold">{lecture.quiz_count} câu</span>
          </div>
        )}
      </div>

      {/* Action buttons dứt khoát */}
      {actions.length > 0 && (
        <div className="flex items-center flex-wrap gap-1.5 pt-2.5 border-t border-slate-100 dark:border-white/[0.04] mt-auto">
          {actions.map((a, i) => {
            const I = a.icon;
            return (
              <button
                key={i}
                type="button"
                onClick={a.onClick}
                className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs ${a.cls}`}
              >
                <I className="w-3.5 h-3.5 shrink-0" />
                <span>{a.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
