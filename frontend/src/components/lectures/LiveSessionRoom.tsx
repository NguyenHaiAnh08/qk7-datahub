import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Square, Clock, Users, BookOpen, ExternalLink, Loader2, AlertTriangle,
} from 'lucide-react';
import { Lecture, TeachingSchedule } from '../../types/lecture';

interface Props {
  open: boolean;
  session: TeachingSchedule;
  lecture: Lecture;
  onEnd: () => void | Promise<void>;
}

const MAX_MINUTES = 300; // 5 tiếng

// Tính số phút đã trôi qua kể từ session.start_time
const computeElapsed = (startIso: string): number => {
  const start = new Date(startIso).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 60_000));
};

// Build URL trình chiếu (dùng cho nút "Mở tab mới")
const buildLaunchUrl = (lecture: Lecture): string => {
  if (lecture.content_type === 'PDF') {
    return lecture.document_id ? `/api/files/${lecture.document_id}/view` : '';
  }
  if (lecture.content_type === 'SCORM') {
    return `/api/lectures/${lecture.lecture_id}/scorm/launch`;
  }
  return `/api/lectures/${lecture.lecture_id}/html5/launch`;
};

export const LiveSessionRoom: React.FC<Props> = ({ open, session, lecture, onEnd }) => {
  const [elapsed, setElapsed] = useState<number>(() => computeElapsed(session.start_time));
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (!open) return;
    setElapsed(computeElapsed(session.start_time));
    // Cập nhật mỗi 30 giây — hiển thị phút, không cần realtime từng giây
    const timer = setInterval(() => {
      setElapsed(computeElapsed(session.start_time));
    }, 30_000);
    return () => clearInterval(timer);
  }, [open, session.start_time]);

  const launchUrl = useMemo(() => buildLaunchUrl(lecture), [lecture]);

  const handleEnd = useCallback(async () => {
    if (ending) return;
    if (!window.confirm('Bạn có chắc muốn kết thúc ca giảng dạy?')) return;
    setEnding(true);
    try {
      await onEnd();
    } finally {
      setEnding(false);
    }
  }, [onEnd, ending]);

  const handleOpenNewTab = useCallback(() => {
    if (launchUrl) window.open(launchUrl, '_blank', 'noopener,noreferrer');
  }, [launchUrl]);

  // ── Hàm render nội dung dựa trên loại file ──
  const renderContent = () => {
    if (lecture.content_type === 'PDF') {
      if (!lecture.document_id) {
        return (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-400">
            <AlertTriangle className="w-10 h-10 text-amber-400" />
            <p className="text-sm font-semibold">Không có tài liệu đính kèm (document_id)</p>
          </div>
        );
      }
      return (
        <iframe
          src={`/api/files/${lecture.document_id}/view`}
          className="w-full h-full border-0 bg-gray-100"
          title="PDF Viewer"
        />
      );
    }

    // SCORM hoặc HTML5
    const targetUrl = lecture.content_type === 'SCORM'
      ? `/api/lectures/${lecture.lecture_id}/scorm/launch`
      : `/api/lectures/${lecture.lecture_id}/html5/launch`;

    return (
      <iframe
        src={targetUrl}
        className="w-full h-full border-0 bg-white"
        title={`${lecture.content_type} Player`}

        // ✅ QUAN TRỌNG: Cấp quyền cho ActivePresenter HTML5
        allow="autoplay; fullscreen; microphone; camera; encrypted-media; picture-in-picture"

        // ✅ Sandbox: Cho phép script, popup, form, same-origin (để gọi API nội bộ)
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-downloads"

        // ✅ Bỏ qua hạn chế Referrer (tránh lỗi tải media)
        referrerPolicy="no-referrer"
      />
    );
  };

  if (!open || !lecture) return null;

  const isNearLimit = elapsed >= MAX_MINUTES - 20;
  const isOverLimit = elapsed >= MAX_MINUTES;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col text-slate-100">
      {/* ── HEADER ── */}
      <div className="h-16 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-lg gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h1
              className="font-bold text-sm sm:text-base text-white truncate"
              title={lecture.title}
            >
              {lecture.title}
            </h1>
            <div className="flex items-center gap-2.5 text-[11px] text-slate-400 mt-0.5 flex-wrap">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> {session.student_count ?? 0} HV
              </span>
              {session.class_name && (
                <>
                  <span>•</span>
                  <span className="truncate max-w-[140px]" title={session.class_name}>{session.class_name}</span>
                </>
              )}
              {session.venue_name && (
                <>
                  <span>•</span>
                  <span className="truncate max-w-[140px]" title={session.venue_name}>{session.venue_name}</span>
                </>
              )}
              {(lecture.subject_name || session.subject_name) && (
                <>
                  <span>•</span>
                  <span className="truncate max-w-[200px]">
                    {lecture.subject_name || session.subject_name}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-mono font-bold ${
              isOverLimit
                ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                : isNearLimit
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-slate-800 border-slate-600 text-emerald-400'
            }`}
            title={isOverLimit ? 'Đã vượt quá thời lượng tối đa' : undefined}
          >
            {isNearLimit ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            <span>{elapsed} / {MAX_MINUTES} phút</span>
          </div>

          <button
            type="button"
            onClick={handleOpenNewTab}
            disabled={!launchUrl || ending}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded-lg text-xs font-semibold transition disabled:opacity-40"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Mở tab mới</span>
          </button>

          <button
            type="button"
            onClick={handleEnd}
            disabled={ending}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 shadow-md shadow-rose-950/40"
          >
            {ending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang kết thúc...</span>
              </>
            ) : (
              <>
                <Square className="w-4 h-4" />
                <span>Kết thúc ca dạy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── BODY: Trình chiếu ── */}
      <div className="flex-1 overflow-hidden bg-slate-900 relative">
        {renderContent()}
      </div>
    </div>
  );
};

export default LiveSessionRoom;