import React from 'react';
import {
  FileText, Layers, FileCode, Send, Check, X,
  Play, Archive, Hash, Building2, User, AlertTriangle, Edit, RotateCcw, Eye
} from 'lucide-react';
import { Lecture, ContentType, LectureStatus } from '../../types/lecture';

const STATUS_STYLES: Record<LectureStatus, { label: string; cls: string }> = {
  DRAFT:            { label: 'Nháp',            cls: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
  PENDING_FACULTY:  { label: 'Chờ Khoa duyệt',  cls: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30' },
  PENDING_TRAINING: { label: 'Chờ BGH duyệt',   cls: 'bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30' },
  PUBLISHED:        { label: 'Đã xuất bản',     cls: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30' },
  REJECTED:         { label: 'Bị từ chối',      cls: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30' },
  ARCHIVED:         { label: 'Lưu trữ',         cls: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/50 dark:text-slate-500 dark:border-slate-800' },
};

const CONTENT_ICONS: Record<ContentType, typeof FileText> = { PDF: FileText, HTML5: FileCode, SCORM: Layers };
const CONTENT_COLORS: Record<ContentType, string> = {
  PDF:   'text-rose-600 dark:text-rose-400',
  HTML5: 'text-cyan-600 dark:text-cyan-400',
  SCORM: 'text-purple-600 dark:text-purple-400',
};

export interface LectureCardProps {
  lecture: Lecture;
  viewMode: 'grid' | 'table';
  currentUserId?: string;
  isAdmin: boolean;
  canApprove: boolean;
  canArchive: boolean; // CHỈ HUY mới có quyền này
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
  const status = STATUS_STYLES[lecture.status];
  const ContentIcon = CONTENT_ICONS[lecture.content_type] || FileText;
  const contentColor = CONTENT_COLORS[lecture.content_type] || '';

  const isAuthor = isAdmin || (currentUserId && currentUserId === lecture.author_id);
  
  const isDraftOrRejected = lecture.status === 'DRAFT' || lecture.status === 'REJECTED';
  const isPendingFaculty  = lecture.status === 'PENDING_FACULTY';
  const isPendingTraining = lecture.status === 'PENDING_TRAINING';
  const isPublished       = lecture.status === 'PUBLISHED';
  const isArchived        = lecture.status === 'ARCHIVED';

  type Action = { label: string; icon: typeof FileText; onClick: () => void; cls: string };
  const actions: Action[] = [];

  // 1. Ai cũng có thể xem chi tiết
  actions.push({ label: 'Xem chi tiết', icon: Eye, onClick: onView, cls: 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300' });

  // 2. Quyền của Giáo viên (Tác giả): Sửa, Gửi duyệt, Mở ca dạy
  if (isAuthor) {
    if (isDraftOrRejected && canEdit) {
      actions.push({ label: 'Chỉnh sửa', icon: Edit, onClick: onEdit, cls: 'bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800' });
      actions.push({ label: 'Gửi duyệt', icon: Send, onClick: onSubmit, cls: 'bg-cyan-600 hover:bg-cyan-500 text-white' });
    }
    
    // Mở ca dạy (Chỉ khi đã được duyệt PUBLISHED)
    if (isPublished && canStartSchedule) {
      actions.push({ label: 'Mở ca dạy', icon: Play, onClick: onStartSession, cls: 'bg-[#0e7490] hover:bg-[#0891b2] text-white' });
    }
  }

  // 3. Quyền của Chỉ huy: Lưu trữ / Khôi phục
  if (canArchive) {
    if (!isArchived) {
      actions.push({ label: 'Lưu trữ', icon: Archive, onClick: onArchive, cls: 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300' });
    } else {
      actions.push({ label: 'Khôi phục', icon: RotateCcw, onClick: onRestore, cls: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' });
    }
  }

  // 4. Quyền của Người duyệt (Chỉ huy/BGH): Duyệt hoặc Từ chối
  if (canApprove) {
    if (isPendingFaculty) {
      actions.push(
        { label: 'Duyệt Khoa', icon: Check, onClick: onApprove, cls: 'bg-emerald-600 hover:bg-emerald-500 text-white' },
        { label: 'Từ chối',    icon: X,     onClick: onReject,  cls: 'bg-rose-600 hover:bg-rose-500 text-white' },
      );
    }
    if (isPendingTraining) {
      actions.push(
        { label: 'Duyệt BGH', icon: Check, onClick: onApprove, cls: 'bg-emerald-600 hover:bg-emerald-500 text-white' },
        { label: 'Từ chối',   icon: X,     onClick: onReject,  cls: 'bg-rose-600 hover:bg-rose-500 text-white' },
      );
    }
  }

  // ── TABLE VIEW ──
  if (viewMode === 'table') {
    return (
      <div className="bg-white dark:bg-[#111827] p-3 rounded-lg border border-slate-200 dark:border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-cyan-500/40 transition-colors">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 ${contentColor}`}>
            <ContentIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm text-slate-900 dark:text-white truncate" title={lecture.title}>{lecture.title}</div>
            <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="font-mono">{lecture.lecture_code}</span>
              <span>{lecture.subject_name}</span>
              <span className="truncate">{lecture.faculty_name}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ${status.cls}`}>{status.label}</span>
          {actions.map((a, i) => {
            const I = a.icon;
            return (
              <button key={i} onClick={a.onClick} className={`text-[10px] font-semibold px-2 py-1 rounded-md flex items-center gap-1 transition active:scale-95 ${a.cls}`}>
                <I className="w-3 h-3" /><span>{a.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── GRID VIEW ──
  return (
    <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-white/[0.08] p-4 flex flex-col gap-3 hover:border-cyan-500/40 hover:shadow-md transition-all h-full">
      <div className="flex items-start justify-between gap-2">
        <div className={`w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 ${contentColor}`}>
          <ContentIcon className="w-5 h-5" />
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${status.cls}`}>{status.label}</span>
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2" title={lecture.title}>{lecture.title}</h3>
        <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <Hash className="w-3 h-3" /><span className="font-mono">{lecture.lecture_code}</span>
        </div>
      </div>

      {lecture.status === 'REJECTED' && lecture.reject_reason && (
        <div className="flex items-start gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 p-2 rounded-lg border border-rose-200 dark:border-rose-500/30">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
          <span className="line-clamp-2">{lecture.reject_reason}</span>
        </div>
      )}

      <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-white/[0.04] pt-2.5">
        <div className="flex items-center gap-1.5 truncate">
          <FileText className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="truncate" title={lecture.subject_name}>{lecture.subject_name || '—'}</span>
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="truncate" title={lecture.faculty_name}>{lecture.faculty_name || '—'}</span>
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <User className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="truncate" title={lecture.author_name}>
            {lecture.author_rank ? `${lecture.author_rank} ` : ''}{lecture.author_name || '—'}
          </span>
        </div>
      </div>

      {actions.length > 0 && (
        <div className="flex items-center flex-wrap gap-1.5 pt-2 border-t border-slate-100 dark:border-white/[0.04]">
          {actions.map((a, i) => {
            const I = a.icon;
            return (
              <button key={i} onClick={a.onClick}
                className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-md flex items-center gap-1 transition active:scale-95 ${a.cls}`}>
                <I className="w-3 h-3" /><span>{a.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
