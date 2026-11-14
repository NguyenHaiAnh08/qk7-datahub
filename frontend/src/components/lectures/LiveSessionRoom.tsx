import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Square, Clock, Users, BookOpen, Loader2, AlertTriangle, ShieldCheck, RotateCcw,
  GraduationCap, Building2, User, CheckCircle2, X
} from 'lucide-react';
import { Lecture, TeachingSchedule } from '../../types/lecture';
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

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastSentProgress = useRef<{ index: number; total: number } | null>(null);
  const modesRef = useRef<ModeItem[]>([]);

  useEffect(() => {
    modesRef.current = modes;
  }, [modes]);

  useEffect(() => {
    setIframeLoaded(false);
    setSelectedFile('');
    setModes([]);
    lastSentProgress.current = null;
  }, [lecture?.lecture_id]);

  // Lưu trạng thái ca dạy vào localStorage theo presenter_id để phục hồi khi F5 biệt lập theo từng tài khoản
  useEffect(() => {
    if (open && session?.schedule_id && lecture?.lecture_id && session?.presenter_id) {
      const userKey = `qk7_active_session_${session.presenter_id}`;
      try {
        localStorage.setItem(userKey, JSON.stringify({
          schedule_id: session.schedule_id,
          lecture_id: lecture.lecture_id,
          presenter_id: session.presenter_id,
        }));
        // Dọn dẹp key toàn cục cũ không có namespace để tránh rò rỉ phiên
        localStorage.removeItem('qk7_active_session');
      } catch {}
    }
  }, [open, session?.schedule_id, lecture?.lecture_id, session?.presenter_id]);

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
          // Chuẩn hóa thứ tự điều hướng: Menu tổng hợp (Home) -> Minh họa -> Hướng dẫn -> Luyện tập -> Kiểm tra
          const MODE_ORDER: Record<string, number> = {
            index: 1,
            demo: 2,
            tutorial: 3,
            practice: 4,
            test: 5,
          };
          const sorted = [...res.modes].sort((a, b) => {
            const orderA = MODE_ORDER[a.id] || 99;
            const orderB = MODE_ORDER[b.id] || 99;
            return orderA - orderB;
          });
          const normalizedModes = sorted.map(m => {
            if (m.id === 'demo' && m.title.includes('(')) {
              return { ...m, title: 'Minh họa' };
            }
            return m;
          });
          setModes(normalizedModes);

          // Tự động vào Menu tổng hợp (index.html) như trang Home mặc định theo yêu cầu
          const homeMode = normalizedModes.find(m => m.id === 'index' || m.file === 'index.html');
          if (homeMode) {
            setSelectedFile(homeMode.file);
          } else if (res.current_entry) {
            setSelectedFile(res.current_entry);
          } else {
            setSelectedFile(normalizedModes[0]?.file || '');
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

  // Đồng bộ thời gian ca dạy mỗi 10 giây
  useEffect(() => {
    if (!open) return;
    setElapsed(computeElapsed(session.start_time));
    const timer = setInterval(() => {
      setElapsed(computeElapsed(session.start_time));
    }, 10_000);
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

  // ─────────────────────────────────────────────────────────────
  // 🆕 TÍCH HỢP SCORM & ACTIVEPRESENTER BRIDGE ĐỂ LẤY TIẾN ĐỘ THẬT
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
            current_page: slideIndex,
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

  // 🔄 ĐỒNG BỘ HEADER KHI NGƯỜI DÙNG CLICK LIÊN KẾT TRONG MENU TỔNG HỢP (index.html)
  const syncHeaderWithIframe = useCallback(() => {
    try {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow) return;
      const win = iframe.contentWindow;
      const searchParams = new URLSearchParams(win.location?.search || '');
      const queryFile = searchParams.get('file');
      const pathname = win.location?.pathname || '';
      const pathFile = pathname.split('/').pop() || '';
      const currentFile = queryFile || pathFile;
      if (!currentFile || currentFile === 'launch') return;

      const matchedMode = modes.find((m) => {
        const mFile = (m.file || '').split('/').pop()?.toLowerCase();
        return mFile === currentFile.toLowerCase();
      });

      if (matchedMode && matchedMode.file !== selectedFile) {
        setSelectedFile(matchedMode.file);
      }
    } catch (_) {
      // Bỏ qua lỗi cross-origin nếu có
    }
  }, [modes, selectedFile]);

  // 🎯 QUÉT TIẾN ĐỘ SLIDE ACTIVEPRESENTER / SCORM THẬT TỪ IFRAME
  const inspectIframeProgress = useCallback(() => {
    try {
      const iframe = iframeRef.current;
      if (!iframe) return;

      let cur = 0;
      let tot = 0;

      // 1. Quét phần tử DOM của ActivePresenter Player
      const doc = iframe.contentDocument;
      if (doc) {
        const indexEl = doc.querySelector('.ap-tool-slide-index');
        const countEl = doc.querySelector('.ap-tool-slide-count');
        if (indexEl) cur = parseInt(indexEl.textContent || '0', 10);
        if (countEl) tot = parseInt(countEl.textContent || '0', 10);

        // Quét mục lục TOC nếu bottom bar chưa nạp xong
        if (!cur) {
          const selectedToc = doc.querySelector('.ap-toc-entry.selected, .ap-toc-entry-content-text.selected');
          if (selectedToc) {
            const numEl = selectedToc.closest('.ap-toc-entry')?.querySelector('.ap-toc-entry-numbering');
            const n = parseInt(numEl?.textContent || '0', 10);
            if (n > 0) cur = n;
          }
        }
      }

      // 2. Quét biến Runtime ActivePresenter nếu DOM bị ẩn
      if (!cur && (iframe.contentWindow as any)?.AtomiAP?.presentations?.length) {
        const prez = (iframe.contentWindow as any).AtomiAP.presentations[0];
        if (prez) {
          if (typeof prez.slideIndex === 'function') cur = prez.slideIndex() + 1;
          if (typeof prez.slideCount === 'function') tot = prez.slideCount();
        }
      }

      if (cur > 0) {
        const safeTotal = tot > 0 ? tot : Math.max(cur, 66);
        const percent = Math.min(1, +(cur / safeTotal).toFixed(4));

        if (!lastSentProgress.current || lastSentProgress.current.index !== cur || lastSentProgress.current.total !== safeTotal) {
          lastSentProgress.current = { index: cur, total: safeTotal };
          sendRealProgress(cur, safeTotal, percent);
        }
      }
    } catch (_) {
      // Nuốt lỗi an toàn
    }
  }, [sendRealProgress]);

  // Handler khi iframe tải xong
  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
    syncHeaderWithIframe();
    inspectIframeProgress();

    try {
      const iframe = iframeRef.current;
      const win = iframe?.contentWindow;
      if (win) {
        const onNav = () => {
          syncHeaderWithIframe();
          setTimeout(inspectIframeProgress, 200);
          setTimeout(syncHeaderWithIframe, 300);
        };

        win.addEventListener('click', () => {
          setTimeout(onNav, 150);
          setTimeout(onNav, 450);
        });
        win.addEventListener('hashchange', onNav);
        win.addEventListener('popstate', onNav);
      }
    } catch (_) {}
  }, [syncHeaderWithIframe, inspectIframeProgress]);

  // Polling liên tục kiểm tra slide & điều hướng iframe mỗi 2 giây
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      syncHeaderWithIframe();
      inspectIframeProgress();
    }, 2000);
    return () => clearInterval(interval);
  }, [open, syncHeaderWithIframe, inspectIframeProgress]);

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

    // ── 4. Lắng nghe postMessage cho gói HTML5 thuần & ActivePresenter mode switcher
    const handleMessage = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object') {
        // 🔄 Bắt sự kiện chuyển chế độ khi click nút trong file HTML (index.html: openPrez)
        if (event.data.type === 'AP_CHANGE_MODE' && event.data.file) {
          const rawFile = String(event.data.file).replace(/\\/g, '/');
          const targetName = rawFile.split('/').pop()?.toLowerCase() || '';
          const matched = modesRef.current.find((m) => {
            const mFile = (m.file || '').split('/').pop()?.toLowerCase();
            return mFile === targetName;
          });
          if (matched && matched.file !== selectedFile) {
            setSelectedFile(matched.file);
            setIframeLoaded(false);
          }
          return;
        }

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
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-950 p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 animate-bounce" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Chưa tìm thấy tệp tài liệu PDF</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md">
              Bài giảng này chưa được gắn mã tệp tài liệu số hóa (document_id). Vui lòng cập nhật tệp giáo án trong mục chỉnh sửa bài giảng.
            </p>
          </div>
        );
      }
      return (
        <div className="relative w-full h-full bg-slate-100 dark:bg-slate-950">
          {!iframeLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/90 dark:bg-slate-950/90 text-slate-700 dark:text-slate-300 z-10 backdrop-blur-xs">
              <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-500 animate-spin" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Đang nạp tài liệu giáo án PDF...</p>
            </div>
          )}
          <iframe
            key={`pdf-${reloadKey}`}
            src={`/api/files/${lecture.document_id}/view`}
            onLoad={() => setIframeLoaded(true)}
            className="w-full h-full border-0 bg-white dark:bg-slate-900"
            title="PDF Viewer"
          />
        </div>
      );
    }

    // SCORM hoặc HTML5
    return (
      <div className="relative w-full h-full bg-slate-100 dark:bg-slate-950">
        {!iframeLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/90 dark:bg-slate-950/90 text-slate-700 dark:text-slate-300 z-10 backdrop-blur-xs">
            <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-500 animate-spin" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Đang nạp không gian bài giảng số hóa ({lecture.content_type})...</p>
          </div>
        )}
        <iframe
          ref={iframeRef}
          key={`${lecture.lecture_id}-${selectedFile || 'default'}-${reloadKey}`}
          src={launchUrl}
          onLoad={handleIframeLoad}
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
    <div className="fixed inset-0 z-[9999] bg-slate-100 dark:bg-slate-950 flex flex-col text-slate-900 dark:text-slate-100 font-sans select-none transition-colors duration-200">
      {/* ── HEADER PHÒNG HỌC THÔNG MINH (Chuẩn UX/UI Đa giao diện Sáng / Tối) ── */}
      <div className="min-h-16 py-2 bg-white/95 dark:bg-[#0b121e]/95 backdrop-blur-md border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-xs dark:shadow-lg gap-3 transition-colors duration-200">
        {/* Khối bên trái: Bố cục Đang trình chiếu, Tên bài giảng & Thông số phân hệ */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 dark:border-emerald-500/30 flex items-center justify-center shrink-0 shadow-2xs">
            <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            {/* Dòng 1: Badge Trạng thái + Tên bài giảng nổi bật */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30 inline-flex items-center gap-1.5 shrink-0 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Đang Trình Chiếu
              </span>
              <h1
                className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-xs md:max-w-sm lg:max-w-md xl:max-w-lg leading-tight"
                title={lecture.title}
              >
                {lecture.title}
              </h1>
            </div>

            {/* Dòng 2: Thông tin chi tiết chuẩn mực (in đậm rõ ràng, tự co giãn thông minh) */}
            <div className="flex items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
              {/* Sĩ số */}
              <span className="hidden md:inline-flex items-center gap-1 shrink-0">
                <span>Sĩ số:</span>
                <strong className="font-bold text-slate-900 dark:text-white">
                  {session.student_count ?? 0} Học viên
                </strong>
              </span>

              {session.class_name && (
                <>
                  <span className="hidden md:inline text-slate-300 dark:text-slate-700 select-none">•</span>
                  <span className="hidden md:inline-flex items-center gap-1 shrink-0">
                    <span>Lớp:</span>
                    <strong className="font-bold text-slate-900 dark:text-white truncate max-w-[130px]" title={session.class_name}>
                      {session.class_name}
                    </strong>
                  </span>
                </>
              )}

              {/* Giảng đường: luôn hiển thị */}
              {session.venue_name && (
                <>
                  <span className="hidden md:inline text-slate-300 dark:text-slate-700 select-none">•</span>
                  <span className="inline-flex items-center gap-1 shrink-0">
                    <span>Giảng đường:</span>
                    <strong className="font-bold text-slate-900 dark:text-white truncate max-w-[120px]" title={session.venue_name}>
                      {session.venue_name.replace(/^giảng đường\s*:?\s*/i, '')}
                    </strong>
                  </span>
                </>
              )}

              {/* Môn học: luôn hiển thị */}
              {(lecture.subject_name || session.subject_name) && (
                <>
                  <span className="text-slate-300 dark:text-slate-700 select-none">•</span>
                  <span className="inline-flex items-center gap-1 shrink-0">
                    <span>Môn:</span>
                    <strong className="font-bold text-slate-900 dark:text-white truncate max-w-[160px] sm:max-w-[200px]" title={lecture.subject_name || session.subject_name}>
                      {lecture.subject_name || session.subject_name}
                    </strong>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Cụm chuyển đổi chế độ bài giảng đa tương tác (ActivePresenter: Demo / Hướng dẫn / Luyện tập / Kiểm tra) */}
        {modes.length > 1 && (
          <div className="hidden xl:flex items-center bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200 dark:border-white/10 gap-1 shadow-inner shrink-0">
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
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800/60'
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
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-mono font-bold transition-colors ${
              isOverLimit
                ? 'bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-500/20 dark:border-rose-500 dark:text-rose-300 animate-pulse'
                : isNearLimit
                ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-500/20 dark:border-amber-500 dark:text-amber-300'
                : 'bg-slate-100 border-slate-200 text-emerald-700 dark:bg-slate-900 dark:border-white/[0.08] dark:text-emerald-400'
            }`}
            title={isOverLimit ? 'Đã vượt quá thời lượng tối đa' : undefined}
          >
            {isNearLimit ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            ) : (
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            )}
            <span>{elapsed} phút</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setIframeLoaded(false);
              setReloadKey(k => k + 1);
            }}
            title="Tải lại nội dung bài giảng"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Tải lại</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={ending}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-md shadow-rose-950/20 cursor-pointer active:scale-95"
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

      {/* ── MODAL CHIẾN THUẬT: XÁC NHẬN KẾT THÚC CA GIẢNG DẠY (Dignified Military UX/UI) ── */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-white/[0.1] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header với logo Học viện / Sư phạm Quân sự */}
            <div className="p-6 pb-4 border-b border-slate-100 dark:border-white/[0.06] flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  Xác nhận kết thúc ca giảng dạy
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Đồng chí xác nhận hoàn tất nội dung giảng dạy và bàn giao giảng đường số hóa
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Thẻ tóm tắt thông tin ca dạy */}
            <div className="p-6 space-y-4">
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-white/[0.06] p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Bài học</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">{lecture.title}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-200/60 dark:border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-amber-500 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-400 block">Giảng đường</span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block">{session.venue_name}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-400 block">Lớp học</span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block">{session.class_name || 'Lớp học'}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-200/60 dark:border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-violet-500 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-400 block">Thời lượng giảng</span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono truncate block">{elapsed} phút</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-cyan-500 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-400 block">Sĩ số học viên</span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono truncate block">{session.student_count} đồng chí</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Thời gian giảng dạy và tiến độ ca dạy sẽ được tự động lưu trữ vào Lịch sử đào tạo của Nhà trường.</span>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer active:scale-95"
              >
                Tiếp tục giảng bài
              </button>

              <button
                type="button"
                onClick={handleConfirmEndSession}
                disabled={ending}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition shadow-md shadow-emerald-950/20 flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {ending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang lưu & kết thúc...</span>
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Xác nhận kết thúc ca</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveSessionRoom;
