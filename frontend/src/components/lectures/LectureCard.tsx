import React from 'react';
import {
  FileText, Layers, FileCode, Send, Check, X,
  Play, Trash2, Hash, User, AlertTriangle, Edit, Eye,
  HelpCircle, Shield, CheckCircle2, Clock, BookOpen
} from 'lucide-react';
import { Lecture, ContentType, LectureStatus, reviewStageOf } from '../../types/lecture';
import { ApprovalStepper } from '../common/ApprovalStepper';

const STATUS_STYLES: Record<LectureStatus, { label: string; badgeCls: string; step: number }> = {
  DRAFT:            { label: 'Bản nháp',          badgeCls: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700', step: 1 },
  PENDING_FACULTY:  { label: 'Chờ Khoa duyệt',    badgeCls: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30', step: 2 },
  PENDING_TRAINING: { label: 'Chờ BGH duyệt',     badgeCls: 'bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40', step: 3 },
  PUBLISHED:        { label: 'Đã xuất bản',       badgeCls: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30', step: 4 },
  REJECTED:         { label: 'Cần chỉnh sửa',     badgeCls: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30', step: 1 },
  ARCHIVED:         { label: 'Lưu trữ',           badgeCls: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30', step: 0 },
  DELETED:          { label: 'Đã xóa (Thùng rác)', badgeCls: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30', step: 0 },
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
  /**
   * 'list'    — trang Danh sách: chỉ Xem chi tiết + Mở ca dạy (không thao tác CRUD/duyệt)
   * 'compose' — trang Soạn & duyệt: chỉnh sửa, gửi duyệt, duyệt, xóa/khôi phục (không mở ca)
   * Không truyền = hiện đủ như trước.
   */
  mode?: 'list' | 'compose';
  viewMode: 'grid' | 'table';
  currentUserId?: string;
  isAdmin: boolean;
  canApprove: boolean;
  /** Admin/Chỉ huy duyệt chính thức; false = chỉ thẩm định (chờ Chỉ huy cấp trên xác nhận) */
  isFinalApprover?: boolean;
  canArchive: boolean;        // Admin/Chỉ huy: xóa mềm mọi bài chưa chờ duyệt/xuất bản
  canDelete?: boolean;        // có quyền LECTURE_DELETE: tác giả xóa mềm bài của mình (Bản nháp/Cần sửa)
  canStartSchedule: boolean;
  canEdit: boolean;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
  onSoftDelete: () => void;   // chuyển vào thùng rác (Quản trị mới khôi phục / xóa vĩnh viễn)
  onEdit: () => void;
  onView: () => void;
  onRead?: () => void;
  onStartSession: () => void;
}

export const LectureCard: React.FC<LectureCardProps> = ({
  lecture, mode, viewMode, currentUserId, isAdmin, canApprove, isFinalApprover = true, canArchive, canDelete, canStartSchedule, canEdit,
  onSubmit, onApprove, onReject, onSoftDelete, onEdit, onView, onRead, onStartSession,
}) => {
  const statusCfg = STATUS_STYLES[lecture.status] || STATUS_STYLES.DRAFT;
  const secCfg = SECURITY_LEVEL_LABELS[lecture.security_level_id] || SECURITY_LEVEL_LABELS[2];

  const isAuthor = isAdmin || (currentUserId && currentUserId === lecture.author_id);
  const isDraftOrRejected = lecture.status === 'DRAFT' || lecture.status === 'REJECTED';
  const isPublished       = lecture.status === 'PUBLISHED';
  // Bước đang chờ duyệt: của bài mới hoặc của bản cập nhật (bài vẫn xuất bản bản cũ)
  const stage             = reviewStageOf(lecture);
  const hasUpdate         = isPublished && !!lecture.update_status && mode !== 'list';
  const isPendingFaculty  = stage === 'PENDING_FACULTY';
  const isPendingTraining = stage === 'PENDING_TRAINING';
  const updateTag = hasUpdate ? (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${STATUS_STYLES[stage].badgeCls}`}
      title="Học viên vẫn xem bản đang xuất bản cho đến khi bản mới được duyệt xong"
    >
      Bản mới: {STATUS_STYLES[stage].label}
    </span>
  ) : null;
  const isArchived        = lecture.status === 'ARCHIVED';   // legacy — giữ để tương thích
  const isDeleted         = lecture.status === 'DELETED';    // 🆕 — trong thùng rác

  // Đã được người có quyền duyệt (không phải Chỉ huy) thẩm định — còn chờ Chỉ huy cấp trên xác nhận
  const validatedTag = lecture.validated_by && (isPendingFaculty || isPendingTraining) ? (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30"
      title={`${lecture.validate_decision === 'REJECT' ? 'Đề nghị từ chối' : 'Đề nghị duyệt'}${lecture.validate_note ? ': ' + lecture.validate_note : ''} — chờ Chỉ huy cấp trên xác nhận`}
    >
      Đã thẩm định: {lecture.validated_by_name || lecture.validated_by}
    </span>
  ) : null;

  type Action = { label: string; icon: typeof FileText; onClick: () => void; cls: string };
  const actions: Action[] = [];
  const allowTeach = mode !== 'compose';
  const allowManage = mode !== 'list';

  // 1a. Đọc / Xem bài giảng khi đã PUBLISHED (Dành cho tất cả mọi người bao gồm Đại biểu)
  if (isPublished && onRead) {
    actions.push({
      label: 'Đọc bài giảng',
      icon: BookOpen,
      onClick: onRead,
      cls: 'bg-[#166534] hover:bg-[#14532d] text-white font-bold border border-emerald-600 shadow-xs'
    });
  }

  // 1b. Mở ca dạy khi đã PUBLISHED (Ưu tiên số 1 theo yêu cầu chỉ huy: giảng viên tác giả hoặc có quyền can_teach)
  if (allowTeach && isPublished && (isAuthor || lecture.can_teach) && canStartSchedule) {
    actions.push({
      label: 'Mở ca dạy',
      icon: Play,
      onClick: onStartSession,
      cls: 'bg-gradient-to-r from-[#166534] to-[#15803d] hover:from-[#15803d] hover:to-[#16a34a] text-white font-bold border border-emerald-500/40 shadow-xs'
    });
  }

  // 2. Quyền phê duyệt 2 tầng (Chỉ huy Khoa / Đào tạo / BGH) — ưu tiên đứng đầu khi bài giảng đang chờ duyệt
  if (allowManage && canApprove) {
    if (isPendingFaculty) {
      actions.push(
        { label: isFinalApprover ? (hasUpdate ? 'Duyệt bản mới' : 'Duyệt') : 'Thẩm định', icon: Check, onClick: onApprove, cls: 'bg-[#166534] hover:bg-[#14532d] text-white font-bold border border-emerald-600 shadow-xs' },
        { label: isFinalApprover ? 'Từ chối' : 'Đề nghị từ chối', icon: X, onClick: onReject, cls: 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30' },
      );
    }
    if (isPendingTraining) {
      actions.push(
        { label: isFinalApprover ? (hasUpdate ? 'Duyệt bản mới' : 'Duyệt') : 'Thẩm định', icon: Check, onClick: onApprove, cls: 'bg-[#166534] hover:bg-[#14532d] text-white font-bold border border-emerald-600 shadow-xs' },
        { label: isFinalApprover ? 'Từ chối' : 'Đề nghị từ chối', icon: X, onClick: onReject, cls: 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30' },
      );
    }
  }

  // 3. Gửi duyệt & Chỉnh sửa (Thứ tự chuẩn: Gửi duyệt -> Chỉnh sửa -> Xem chi tiết -> Xóa)
  //    - Gửi duyệt: CHỈ đúng tác giả (backend chặn mọi người khác, kể cả Admin) → không hiện nút cho người khác.
  //    - Chỉnh sửa: tác giả hoặc Admin (backend cho phép Admin sửa hộ).
  const isLectureOwner = !!currentUserId && currentUserId === lecture.author_id;
  // Thành viên cùng khoa/phòng (máy chủ đánh dấu in_my_faculty) và Admin cũng quản lý được bài này ở trang Soạn
  const canManageThis = isAdmin || isLectureOwner || !!lecture.in_my_faculty;
  if (allowManage && isLectureOwner && isDraftOrRejected && canEdit) {
    actions.push({
      label: 'Gửi duyệt',
      icon: Send,
      onClick: onSubmit,
      cls: 'bg-[#166534] hover:bg-[#14532d] text-white border border-emerald-600 shadow-xs'
    });
  }
  // Sửa: Admin mọi trạng thái (trừ thùng rác); tác giả/thành viên cùng khoa: bản nháp, cần hiệu chỉnh, hoặc bài đã xuất bản của khoa mình
  //       (bài đã xuất bản do người không phải Admin sửa sẽ phải qua Chỉ huy duyệt nếu quyền này bị Admin khóa duyệt)
  const canEditThis = allowManage && canEdit && canManageThis && !isDeleted
    && (isAdmin || isDraftOrRejected || isPublished);
  if (canEditThis) {
    actions.push({
      label: 'Chỉnh sửa',
      icon: Edit,
      onClick: onEdit,
      cls: 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30'
    });
  }

  // 4. Xem chi tiết
  actions.push({
    label: 'Xem chi tiết',
    icon: Eye,
    onClick: onView,
    cls: 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
  });

  // 5. Xóa mềm → chuyển vào Thùng rác của trang Quản trị (KHÔNG hiển thị khi đang chờ duyệt / đã xuất bản).
  //    Khôi phục và xóa vĩnh viễn chỉ Admin làm ở trang Quản trị → Thùng rác, không còn nút ở đây.
  const isPendingApproval = lecture.status === 'PENDING_FACULTY' || lecture.status === 'PENDING_TRAINING';
  //    Admin xóa mềm mọi trạng thái; người khác (tác giả/cùng khoa) không xóa bài đang chờ duyệt.
  if (allowManage && !isDeleted && (isAdmin || (!isPendingApproval && (canArchive || canDelete) && canManageThis))) {
    actions.push({
      label: 'Xóa',
      icon: Trash2,
      onClick: onSoftDelete,
      cls: 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 dark:bg-red-500/15 dark:hover:bg-red-500/25 dark:text-red-300 dark:border-red-500/30'
    });
  }

  // ── TABLE VIEW ──
  if (viewMode === 'table') {
    return (
      <div className="bg-white dark:bg-[#111827] p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-emerald-500/40 hover:shadow-xs transition-all">
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300/40 dark:border-emerald-700/40 flex items-center justify-center shrink-0 text-emerald-700 dark:text-emerald-400 font-bold mt-0.5 sm:mt-0">
            <Hash className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            {/* Header dòng 1: Tiêu đề + Cấp bảo mật + Trạng thái (Đã xuất bản / Lưu trữ nằm kế cấp bảo mật) */}
            <div className="flex items-start gap-2 flex-wrap min-w-0">
              <span
                className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2 [overflow-wrap:anywhere] [word-break:break-word] cursor-pointer hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors max-w-full"
                onClick={onView}
                title={lecture.title}
              >
                {lecture.title}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 ${secCfg.cls}`}>
                {secCfg.label.split('—')[0].trim()}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap shadow-2xs shrink-0 ${statusCfg.badgeCls}`}>
                {statusCfg.label}
              </span>
              {updateTag}
              {validatedTag}
            </div>

            {hasUpdate && stage === 'REJECTED' && lecture.update_reject_reason && (
              <p className="text-[11px] text-rose-700 dark:text-rose-300 line-clamp-2">
                Bản mới cần hiệu chỉnh: {lecture.update_reject_reason}
              </p>
            )}

            {/* Dòng trên: Mã bài giảng & Môn học (in đậm giá trị) */}
            <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
              <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded text-[11px]">
                #{lecture.lecture_code}
              </span>
              <span>Môn: <strong className="text-slate-900 dark:text-slate-100 font-bold">{lecture.subject_name || '—'}</strong></span>
            </div>

            {/* Dòng dưới: Khoa / Bộ môn & GV (in đậm giá trị) */}
            <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span>Khoa: <strong className="text-slate-900 dark:text-slate-100 font-bold">{lecture.faculty_name || '—'}</strong></span>
              <span>GV: <strong className="text-slate-900 dark:text-slate-100 font-bold">{lecture.author_rank ? `${lecture.author_rank} ` : ''}{lecture.author_name || '—'}</strong></span>
              {typeof lecture.quiz_count === 'number' && lecture.quiz_count > 0 && (
                <span className="text-amber-700 dark:text-amber-400 font-bold">• {lecture.quiz_count} câu hỏi Quiz</span>
              )}
            </div>
          </div>
        </div>

        {/* Nút thao tác ở bên phải */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {actions.map((a, i) => {
            const I = a.icon;
            return (
              <button
                key={i}
                type="button"
                onClick={a.onClick}
                className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs ${a.cls}`}
              >
                <I className="w-3.5 h-3.5" />
                <span>{a.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── GRID VIEW (TACTICAL COMMAND CARD) ──
  return (
    <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-white/[0.08] p-4 flex flex-col gap-3 hover:border-emerald-500/40 hover:shadow-md transition-all h-full relative group min-w-0 overflow-hidden">
      
      {/* 1. Header Card: Mã bài giảng nổi bật + Cấp độ & Trạng thái (Bỏ badge Gói) */}
      <div className="flex items-center justify-between gap-2">
        {/* Mã danh sách bài giảng nổi bật — hiển thị đầy đủ 100% mã bài giảng */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300/70 dark:border-emerald-700/60 font-mono text-xs font-bold text-emerald-800 dark:text-emerald-300 shadow-2xs tracking-wide">
          <Hash className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{lecture.lecture_code}</span>
        </div>

        {/* Cụm Cấp độ bảo mật & Trạng thái xuất bản */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border shadow-2xs ${secCfg.cls}`}>
            {secCfg.label.split('—')[0].trim()}
          </span>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap shadow-2xs ${statusCfg.badgeCls}`}>
            {statusCfg.label}
          </span>
          {validatedTag}
        </div>
      </div>

      {updateTag && <div className="flex justify-end">{updateTag}</div>}

      {/* 2. Tên danh sách bài giảng (Hero Title — tối đa 2 dòng + ... + chống tràn tuyệt đối) */}
      <div className="min-w-0 overflow-hidden">
        <h3
          className="font-bold text-[15px] text-slate-900 dark:text-white line-clamp-2 [overflow-wrap:anywhere] [word-break:break-word] leading-snug group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors cursor-pointer"
          onClick={onView}
          title={lecture.title}
        >
          {lecture.title}
        </h3>
      </div>

      {/* 3. Mini Stepper: Quy trình duyệt 2 tầng quân sự (Lucian #444) */}
      {!isArchived && !isDeleted && (
        <div className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/[0.04]">
          <ApprovalStepper
            status={hasUpdate ? stage : lecture.status}
            headerLabel={hasUpdate ? 'Duyệt bản mới:' : undefined}
            compact
          />
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

      {hasUpdate && stage === 'REJECTED' && lecture.update_reject_reason && (
        <div className="flex items-start gap-2 text-[11px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-xl border border-rose-200 dark:border-rose-500/30 leading-relaxed">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div>
            <strong className="block text-[10px] uppercase tracking-wider text-rose-800 dark:text-rose-400">Bản mới cần hiệu chỉnh:</strong>
            <span className="line-clamp-2">{lecture.update_reject_reason}</span>
          </div>
        </div>
      )}

      {/* Metadata chi tiết */}
      <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-white/[0.04] pt-2">
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

      {/* Action buttons — Lưới Bento 2 hàng tự cân đối khi có từ 4–5 nút, giữ nguyên đầy đủ chữ & icon, chống tràn 100% */}
      {actions.length > 0 && (() => {
        const renderBtn = (a: Action, key: string | number, minWClass = 'min-w-[78px]') => {
          const I = a.icon;
          return (
            <button
              key={key}
              type="button"
              onClick={a.onClick}
              className={`flex-1 ${minWClass} text-[11px] font-semibold px-2.5 py-1.5 rounded-lg flex items-center justify-center gap-1 whitespace-nowrap transition active:scale-95 cursor-pointer shadow-2xs ${a.cls}`}
            >
              <I className="w-3.5 h-3.5 shrink-0" />
              <span>{a.label}</span>
            </button>
          );
        };

        if (actions.length >= 4) {
          const topRow = actions.slice(0, 2);
          const bottomRow = actions.slice(2);
          return (
            <div className="flex flex-col gap-1.5 pt-2.5 border-t border-slate-100 dark:border-white/[0.04] mt-auto">
              <div className="flex items-center flex-wrap gap-1.5">
                {topRow.map((a, i) => renderBtn(a, `top-${i}`, 'min-w-[110px]'))}
              </div>
              <div className="flex items-center flex-wrap gap-1.5">
                {bottomRow.map((a, i) => renderBtn(a, `bot-${i}`, 'min-w-[76px]'))}
              </div>
            </div>
          );
        }

        return (
          <div className="flex items-center flex-wrap gap-1.5 pt-2.5 border-t border-slate-100 dark:border-white/[0.04] mt-auto">
            {actions.map((a, i) => renderBtn(a, i, 'min-w-[78px]'))}
          </div>
        );
      })()}
    </div>
  );
};
