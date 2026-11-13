import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Square, Clock, Users, BookOpen, ExternalLink, Loader2, AlertTriangle, ShieldCheck, RotateCcw
} from 'lucide-react';
import { Lecture, TeachingSchedule } from '../../types/lecture';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { http } from '../../services/http';

interface Props {
  open: boolean;
  session: TeachingSchedule;
  lecture: Lecture;
  onEnd: () => void | Promise<void>;
}

interface ModeItem {
  id: string;
  title: string;
  file: string;
}

const MAX_MINUTES = 300; // 5 tiếng

// Tính số phút đã trôi qua kể từ session.start_time
const computeElapsed = (startIso: string): number => {
  const start = new Date(startIso).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 60_000));
};

// Build URL trình chiếu kèm tệp lựa chọn
const buildLaunchUrl = (lecture: Lecture, selectedFile?: string): string => {
  if (lecture.content_type === 'PDF') {
    return lecture.document_id ? `/api/files/${lecture.document_id}/view` : '';
  }
  const token = sessionStorage.getItem('qk7_token');
  const queryParts: string[] = [];
  if (token) queryParts.push(`token=${encodeURIComponent(token)}`);
  if (selectedFile) queryParts.push(`file=${encodeURIComponent(selectedFile)}`);
  const queryStr = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

  if (lecture.content_type === 'SCORM') {
    return `/api/lectures/${lecture.lecture_id}/scorm/launch${queryStr}`;
  }
  return `/api/lectures/${lecture.lecture_id}/html5/launch${queryStr}`;
};

export const LiveSessionRoom: React.FC<Props> = ({ open, session, lecture, onEnd }) => {
  const [elapsed, setElapsed] = useState<number>(() => computeElapsed(session.start_time));
  const [ending, setEnding] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [modes, setModes] = useState<ModeItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [reloadKey, setReloadKey] = useState<number>(0);

  useEffect(() => {
    setIframeLoaded(false);
    setSelectedFile('');
    setModes([]);
  }, [lecture?.lecture_id]);

    // Lưu trạng thái ca dạy vào localStorage để phục hồi khi F5
  useEffect(() => {
    if (open && session?.schedule_id && lecture?.lecture_id) {
      localStorage.setItem('qk7_active_session', JSON.stringify({
        schedule_id: session.schedule_id,
        lecture_id: lecture.lecture_id
      }));
    }
    // Không xóa ở cleanup vì nếu F5, cleanup chạy nhưng ta vẫn muốn giữ để khôi phục
  }, [open, session?.schedule_id, lecture?.lecture_id]);

  // Nạp danh sách các chế độ trình chiếu khả dụng trong gói bài giảng (ActivePresenter/SCORM/HTML5)
  useEffect(() => {
    if (!open || !lecture?.lecture_id || lecture.content_type === 'PDF') return;

    let mounted = true;
    (async () => {
      try {
        const res = await http<{ modes: ModeItem[]; current_entry: string }>(
          `/api/lectures/${lecture.lecture_id}/modes`,
          { silent: true }
        );
        if (mounted && res?.modes && res.modes.length > 0) {
          setModes(res.modes);
          // Ưu tiên chọn chế độ demo.html (Trình chiếu) nếu có
          const demoMode = res.modes.find(m => m.file === 'demo.html');
          if (demoMode) {
            setSelectedFile(demoMode.file);
          } else if (res.current_entry) {
            setSelectedFile(res.current_entry);
          } else {
            setSelectedFile(res.modes[0].file);
          }
        }
      } catch (_) {
        // Fallback mặc định
      }
    })();

    return () => {
      mounted = false;
    };
  }, [open, lecture?.lecture_id, lecture?.content_type]);

  useEffect(() => {
    if (!open) return;
    setElapsed(computeElapsed(session.start_time));
    const timer = setInterval(() => {
      setElapsed(computeElapsed(session.start_time));
    }, 30_000);
    return () => clearInterval(timer);
  }, [open, session.start_time]);

  const launchUrl = useMemo(() => buildLaunchUrl(lecture, selectedFile), [lecture, selectedFile]);

  const handleConfirmEndSession = useCallback(async () => {
    setEnding(true);
    setConfirmOpen(false);
    try {
      await onEnd();
    } finally {
      setEnding(false);
    }
  }, [onEnd]);

  const handleOpenNewTab = useCallback(() => {
    if (launchUrl) window.open(launchUrl, '_blank', 'noopener,noreferrer');
  }, [launchUrl]);

  // ─────────────────────────────────────────────────────────────
  // 🆕 TÍCH HỢP SCORM API BRIDGE ĐỂ LẤY TIẾN ĐỘ THẬT
  // ─────────────────────────────────────────────────────────────
  const scormDataRef = useRef<Record<string, string>>({});

  // Hàm gửi tiến độ lên Backend
  const sendRealProgress = useCallback(
    async (slideIndex: number, slideTotal: number, percent: number) => {
      try {
        await http(`/api/lectures/schedules/${session.schedule_id}/progress`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // ⚠️ Backend hiện chỉ đọc `current_page` → giữ tương thích
            current_page: slideIndex,
            // Các trường mở rộng — nếu backend chưa hỗ trợ sẽ bị bỏ qua
            slide_index: slideIndex,
            slide_total: slideTotal,
            scorm_progress: percent,
          }),
          silent: true,
        });
      } catch (_) {
        /* nuốt lỗi — không chặn trình chiếu */
      }
    },
    [session.schedule_id]
  );

  useEffect(() => {
    if (!open || !lecture) return;

    // Reset buffer khi đổi bài giảng để tránh lẫn dữ liệu phiên cũ
    scormDataRef.current = {};

    // ── 3. Hàm bóc tách số liệu từ chuỗi SCORM trả về
    //    (Khai báo TRƯỚC 2 object API để tránh TDZ)
    const parseScormProgress = (value: string) => {
      try {
        let current = 0;
        let total = 0;

        if (value.startsWith('{')) {
          const data = JSON.parse(value);
          current = parseInt(
            data.slideIndex || data.slide || data.currentSlide || 0,
            10
          );
          total = parseInt(
            data.slideTotal || data.totalSlides || data.total || 0,
            10
          );
        } else {
          const match = value.match(/\d+/);
          if (match) current = parseInt(match[0], 10);
        }

        if (current > 0) {
          const safeTotal = total > 0 ? total : Math.max(current, 100);
          const percent = current / safeTotal;
          sendRealProgress(current, safeTotal, percent);
        }
      } catch {
        /* dữ liệu không đúng định dạng → bỏ qua */
      }
    };

    // ── 1. SCORM 1.2 API
    (window as any).API = {
      LMSInitialize: () => 'true',
      LMSFinish: () => 'true',
      LMSGetValue: (key: string) => scormDataRef.current[key] || '',
      LMSSetValue: (key: string, value: string) => {
        scormDataRef.current[key] = value;
        if (key === 'cmi.core.lesson_location' || key === 'cmi.suspend_data') {
          parseScormProgress(value);
        }
        return 'true';
      },
      LMSCommit: () => 'true',
      LMSGetLastError: () => '0',
      LMSGetErrorString: () => '',
      LMSGetDiagnostic: () => '',
    };

    // ── 2. SCORM 2004 API
    (window as any).API_1484_11 = {
      Initialize: () => 'true',
      Terminate: () => 'true',
      GetValue: (key: string) => scormDataRef.current[key] || '',
      SetValue: (key: string, value: string) => {
        scormDataRef.current[key] = value;
        if (key === 'cmi.location' || key === 'cmi.suspend_data') {
          parseScormProgress(value);
        }
        return 'true';
      },
      Commit: () => 'true',
      GetLastError: () => '0',
      GetErrorString: () => '',
      GetDiagnostic: () => '',
    };

    // ── 4. Lắng nghe postMessage cho gói HTML5 thuần
    const handleMessage = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object') {
        if (event.data.type === 'slideChange' || event.data.type === 'progress') {
          const current = event.data.slideIndex || 0;
          const total = event.data.slideTotal || 100;
          if (current > 0) sendRealProgress(current, total, current / total);
        }
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
      delete (window as any).API;
      delete (window as any).API_1484_11;
    };
  }, [open, lecture, sendRealProgress]);

  // ── Hàm render nội dung dựa trên loại file ──
  const renderContent = () => {
    if (lecture.content_type === 'PDF') {
      if (!lecture.document_id) {
        return (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-400 bg-slate-950 p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-400 animate-bounce" />
            <h3 className="text-base font-bold text-white">Chưa tìm thấy tệp tài liệu PDF</h3>
            <p className="text-xs text-slate-400 max-w-md">
              Bài giảng này chưa được gắn mã tệp tài liệu số hóa (document_id). Vui lòng cập nhật tệp giáo án trong mục chỉnh sửa bài giảng.
            </p>
          </div>
        );
      }
      return (
        <div className="relative w-full h-full bg-slate-950">
          {!iframeLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 text-slate-300 z-10">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-xs font-semibold text-slate-400">Đang nạp tài liệu giáo án PDF...</p>
            </div>
          )}
          <iframe
            key={`pdf-${reloadKey}`}
            src={`/api/files/${lecture.document_id}/view`}
            onLoad={() => setIframeLoaded(true)}
            className="w-full h-full border-0 bg-gray-100"
            title="PDF Viewer"
          />
        </div>
      );
    }

    // SCORM hoặc HTML5
    return (
      <div className="relative w-full h-full bg-slate-950">
        {!iframeLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 text-slate-300 z-10">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-xs font-semibold text-slate-400">Đang nạp không gian bài giảng số hóa ({lecture.content_type})...</p>
          </div>
        )}
        <iframe
          key={`${lecture.lecture_id}-${reloadKey}`}
          src={launchUrl}
          onLoad={() => setIframeLoaded(true)}
          className="w-full h-full border-0 bg-white"
          title={`${lecture.content_type} Player`}
          allow="autoplay; fullscreen; microphone; camera; encrypted-media; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-downloads"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  };

  if (!open || !lecture) return null;

  const isNearLimit = elapsed >= MAX_MINUTES - 20;
  const isOverLimit = elapsed >= MAX_MINUTES;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col text-slate-100 font-sans select-none">
      {/* ── HEADER PHÒNG HỌC THÔNG MINH ── */}
      <div className="h-16 bg-[#0b121e] border-b border-white/[0.08] flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-lg gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Đang Trình Chiếu
              </span>
              <h1
                className="font-bold text-sm sm:text-base text-white truncate max-w-xs sm:max-w-md lg:max-w-lg"
                title={lecture.title}
              >
                {lecture.title}
              </h1>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-400 mt-0.5 flex-wrap">
              <span className="flex items-center gap-1 font-semibold text-slate-300">
                <Users className="w-3.5 h-3.5 text-slate-400" /> {session.student_count ?? 0} Học viên
              </span>
              {session.class_name && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="truncate max-w-[150px] font-medium" title={session.class_name}>
                    Lớp: {session.class_name}
                  </span>
                </>
              )}
              {session.venue_name && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="truncate max-w-[150px] text-emerald-400 font-semibold" title={session.venue_name}>
                    {session.venue_name}
                  </span>
                </>
              )}
              {(lecture.subject_name || session.subject_name) && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="truncate max-w-[200px] text-slate-400">
                    {lecture.subject_name || session.subject_name}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Cụm chuyển đổi chế độ bài giảng đa tương tác (ActivePresenter: Demo / Hướng dẫn / Luyện tập / Kiểm tra) */}
        {modes.length > 1 && (
          <div className="hidden xl:flex items-center bg-slate-900/90 p-1 rounded-xl border border-white/10 gap-1 shadow-inner shrink-0">
            {modes.map((m) => {
              const isActive = (selectedFile || (modes[0] && modes[0].file)) === m.file;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelectedFile(m.file);
                    setIframeLoaded(false);
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {m.title}
                </button>
              );
            })}
          </div>
        )}

        {/* Cụm điều khiển thời lượng & kết thúc */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-mono font-bold ${
              isOverLimit
                ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                : isNearLimit
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-slate-900 border-white/[0.08] text-emerald-400'
            }`}
            title={isOverLimit ? 'Đã vượt quá thời lượng tối đa' : undefined}
          >
            {isNearLimit ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : <Clock className="w-4 h-4 text-emerald-400" />}
            <span>{elapsed} / {MAX_MINUTES} phút</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setIframeLoaded(false);
              setReloadKey(k => k + 1);
            }}
            title="Tải lại nội dung bài giảng"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Tải lại</span>
          </button>

          <button
            type="button"
            onClick={handleOpenNewTab}
            disabled={!launchUrl || ending}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition disabled:opacity-40 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Mở tab mới</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={ending}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#b91c1c] to-[#dc2626] hover:from-[#dc2626] hover:to-[#ef4444] text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-md shadow-rose-950/40 cursor-pointer active:scale-95"
          >
            {ending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang kết thúc...</span>
              </>
            ) : (
              <>
                <Square className="w-4 h-4 fill-current" />
                <span>Kết thúc ca dạy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── BODY: Trình chiếu nội dung SCORM / HTML5 / PDF ── */}
      <div className="flex-1 overflow-hidden bg-slate-950 relative">
        {renderContent()}
      </div>

      {/* ConfirmDialog kết thúc ca */}
      <ConfirmDialog
        open={confirmOpen}
        title="Xác nhận kết thúc ca giảng dạy"
        description={`Đồng chí có chắc chắn muốn kết thúc ca giảng dạy bài học "${lecture.title}" tại ${session.venue_name}? Thời gian giảng dạy (${elapsed} phút) sẽ được lưu tự động vào Lịch sử đào tạo của Nhà trường.`}
        confirmText="Xác nhận kết thúc"
        cancelText="Tiếp tục giảng bài"
        isDestructive={true}
        onConfirm={handleConfirmEndSession}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};

export default LiveSessionRoom;
