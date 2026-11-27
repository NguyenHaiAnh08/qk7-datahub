import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { installPreviewScormApi } from './previewScormApi';
import { X, BookOpen, Shield, Maximize2, Minimize2, AlertTriangle, RefreshCw, FileText, Layers, ExternalLink } from 'lucide-react';
import { Lecture } from '../../types/lecture';
import { getAuthHeaders } from '../../services/http';
import { PdfPagesViewer } from '../document-desk/PdfPagesViewer';
import { DocumentReadingRing, ReadingProgress } from '../common/DocumentReadingRing';
import { SegmentedTabs } from '../common/SegmentedTabs';
import { useAuth } from '../../hooks/useAuth';
import { formatUserDisplayName, formatWatermarkDateTime } from '../../hooks/useFloatingWatermark';
import { stampWatermarkOnPdf } from '../../utils/pdfWatermark';

interface Props {
  open: boolean;
  lecture: Lecture | null;
  onClose: () => void;
}

interface ModeItem {
  id: string;
  title: string;
  file: string;
}

export const LectureViewerModal: React.FC<Props> = ({ open, lecture, onClose }) => {
  const { user } = useAuth();
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string>('');
  const [isBlobWatermarked, setIsBlobWatermarked] = useState<boolean>(true);
  const [watermarkText, setWatermarkText] = useState<string>('');
  const [modes, setModes] = useState<ModeItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [reloadKey, setReloadKey] = useState(0);

  // ⭕ Vòng chỉ báo hoàn thành đọc tài liệu (Document Reading Completion Ring)
  const [readingProgress, setReadingProgress] = useState<ReadingProgress>({
    currentPage: 1,
    totalPages: 1,
    percent: 0,
    isCompleted: false,
  });
  const viewerRef = useRef<{ scrollToPage: (page: number) => void; scrollToTop: () => void; scrollToNext: () => void } | null>(null);

  // Nạp PDF nếu là dạng PDF
  useEffect(() => {
    setReadingProgress({
      currentPage: 1,
      totalPages: 1,
      percent: 0,
      isCompleted: false,
    });

    if (!open || !lecture || lecture.content_type !== 'PDF') {
      setPdfBlobUrl('');
      return;
    }

    let active = true;
    let objUrl = '';
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const headers: Record<string, string> = { ...getAuthHeaders() };
        try {
          const fp = sessionStorage.getItem(`qk7_fp_lecture_${lecture.lecture_id}`);
          if (fp) headers['X-Fingerprint-Token'] = fp;
        } catch {}

        const res = await fetch(`/api/lectures/${encodeURIComponent(lecture.lecture_id)}/pdf`, { headers });
        if (!res.ok) {
          let msg = `Không thể tải tệp PDF (Mã lỗi ${res.status})`;
          try {
            const j = await res.json();
            if (j?.error) msg = j.error;
          } catch {}
          throw new Error(msg);
        }

        const rawBlob = await res.blob();
        if (!active) return;
        const serverDateStr = res.headers.get('X-Server-Time') || res.headers.get('Date');
        const serverTime = serverDateStr ? new Date(serverDateStr) : new Date();
        const userDisplayName = formatUserDisplayName(user?.full_name, user?.username);
        const timeStr = formatWatermarkDateTime(serverTime);
        const stampedBlob = await stampWatermarkOnPdf(rawBlob, {
          userDisplayName,
          timeStr,
          opacity: 0.18,
        });
        if (!active) return;
        setIsBlobWatermarked((stampedBlob as any).__isWatermarked !== false);
        setWatermarkText(`${userDisplayName} - ${timeStr}`);
        objUrl = URL.createObjectURL(stampedBlob);
        setPdfBlobUrl(objUrl);
        setLoading(false);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || 'Lỗi khi tải tài liệu PDF bài giảng');
        setLoading(false);
      }
    })();

    return () => {
      active = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [open, lecture?.lecture_id, lecture?.content_type, reloadKey]);

  // API SCORM xem trước: phải có TRƯỚC khi gói bài giảng trong iframe chạy (useLayoutEffect)
  useLayoutEffect(() => {
    if (!open || !lecture || lecture.content_type === 'PDF') return;
    return installPreviewScormApi();
  }, [open, lecture?.lecture_id, lecture?.content_type, selectedFile, reloadKey]);

  // Nạp danh sách modes nếu là SCORM/HTML5
  useEffect(() => {
    if (!open || !lecture || lecture.content_type === 'PDF') {
      setModes([]);
      setSelectedFile('');
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const headers: Record<string, string> = { ...getAuthHeaders() };
        const res = await fetch(`/api/lectures/${encodeURIComponent(lecture.lecture_id)}/modes`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (active && data?.modes && data.modes.length > 0) {
            setModes(data.modes);
            const home = data.modes.find((m: ModeItem) => m.id === 'index' || m.file === 'index.html');
            setSelectedFile(home ? home.file : data.current_entry || data.modes[0].file);
          }
        }
      } catch {
        // Fallback: dùng entry mặc định
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [open, lecture?.lecture_id, lecture?.content_type]);

  if (!open || !lecture) return null;

  const buildLaunchUrl = () => {
    const token = sessionStorage.getItem('qk7_token');
    const fp = sessionStorage.getItem(`qk7_fp_lecture_${lecture.lecture_id}`);
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (fp) params.set('fp', fp);
    if (selectedFile) params.set('file', selectedFile);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const type = lecture.content_type === 'SCORM' ? 'scorm' : 'html5';
    return `/api/lectures/${encodeURIComponent(lecture.lecture_id)}/${type}/launch${qs}`;
  };

  const isPdf = lecture.content_type === 'PDF';
  const iframeSrc = isPdf ? pdfBlobUrl : buildLaunchUrl();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
        fullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-5xl h-[88vh]'
      }`}>
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              {isPdf ? (
                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate" title={lecture.title}>
                  {lecture.title}
                </h3>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-semibold shrink-0">
                  {lecture.lecture_code || 'BÀI GIẢNG'}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold shrink-0">
                  {lecture.content_type}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {lecture.subject_name ? `Môn: ${lecture.subject_name}` : ''}
                {lecture.author_name ? ` · Tác giả: ${lecture.author_name}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* ⭕ Document Reading Completion Ring cho bài giảng dạng PDF */}
            {isPdf && pdfBlobUrl && (
              <DocumentReadingRing
                currentPage={readingProgress.currentPage}
                totalPages={readingProgress.totalPages}
                percent={readingProgress.percent}
                isCompleted={readingProgress.isCompleted}
                variant="header"
                onClick={() => {
                  if (readingProgress.currentPage > 1 || readingProgress.percent > 0) {
                    viewerRef.current?.scrollToTop();
                  } else {
                    viewerRef.current?.scrollToNext();
                  }
                }}
              />
            )}

            {/* Bộ chọn mode nếu có nhiều file html */}
            {modes.length > 1 && (
              <SegmentedTabs
                ariaLabel="Chọn chế độ trình chiếu bài giảng"
                size="xs"
                className="hidden sm:inline-flex mr-2"
                value={selectedFile}
                onChange={setSelectedFile}
                items={modes.map((m) => ({
                  value: m.file,
                  label: m.title,
                  activeTone: 'emerald',
                }))}
              />
            )}

            <button
              type="button"
              onClick={() => setReloadKey(k => k + 1)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Tải lại nội dung"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setFullscreen(!fullscreen)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition hidden sm:flex"
              title={fullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            >
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="flex-1 min-h-0 bg-slate-950/5 dark:bg-slate-950/40 relative">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 dark:bg-slate-900/80 z-10 backdrop-blur-xs">
              <RefreshCw className="w-7 h-7 text-emerald-600 dark:text-emerald-400 animate-spin" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Đang chuẩn bị nội dung bài giảng điện tử...
              </p>
            </div>
          )}

          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Không thể hiển thị bài giảng
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                {error}
              </p>
              <button
                type="button"
                onClick={() => setReloadKey(k => k + 1)}
                className="mt-2 px-4 py-2 bg-[#166534] hover:bg-[#14532d] text-white rounded-xl text-xs font-bold transition"
              >
                Thử lại
              </button>
            </div>
          ) : isPdf ? (
            pdfBlobUrl ? (
              <div className="w-full h-full relative overflow-hidden">
                <PdfPagesViewer
                  blobUrl={pdfBlobUrl}
                  fileId={lecture.lecture_id}
                  securityLevel={lecture.security_level_id || 1}
                  isHighlighterActive={false}
                  highlighterColor="#fbbf24"
                  onReadingProgressChange={(prog) => setReadingProgress(prog)}
                  viewerRef={viewerRef}
                  showFloatingProgressRing={true}
                  fallbackWatermarkText={!isBlobWatermarked ? watermarkText : undefined}
                />
              </div>
            ) : null
          ) : iframeSrc ? (
            <iframe
              key={`${iframeSrc}-${reloadKey}`}
              src={iframeSrc}
              className="w-full h-full border-0 bg-white dark:bg-slate-900"
              title={lecture.title}
              onLoad={() => setLoading(false)}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};
