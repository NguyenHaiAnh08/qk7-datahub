import { PdfPagesViewer } from './PdfPagesViewer';
import { HIGHLIGHTER_COLORS } from './DocumentHighlighter';
import { Highlighter, Trash2, Undo2 } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  FileText,
  Calendar,
  Building,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { DocumentItem } from '../../types';
import { fileService } from '../../services/fileService';
import { formatDate } from '../../utils/dateUtils';
import { formatFileSize } from '../../utils/formatFileSize';
import { useAuth } from '../../hooks/useAuth';
import { FingerprintScanModal } from '../users/FingerprintScanModal';
import { CompactDownloadButton } from '../common/CompactDownloadButton';
import { AccessDeniedCard } from '../common/AccessDeniedCard';
import { toast } from '../common/Toast';
import {
  formatUserDisplayName,
  formatWatermarkDateTime,
} from '../../hooks/useFloatingWatermark';
import { stampWatermarkOnPdf } from '../../utils/pdfWatermark';
import { useAntiScreenshot } from '../../hooks/useAntiScreenshot';
import { SecurityScreenShield } from '../common/SecurityScreenShield';

export interface DocumentPreviewModalProps {
  open: boolean;
  document: DocumentItem | null;
  userClearanceLevel?: number;
  initialToken?: string | null;
  page?: number;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  open,
  document,
  userClearanceLevel: propClearanceLevel,
  initialToken: propInitialToken,
  page = 1,
  onClose,
}) => {
  const { user, logout } = useAuth();
  const clearanceLevel = propClearanceLevel ?? (user?.clearance_level_id || 1);

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);

  const [fingerprintToken, setFingerprintToken] = useState<string | null>(null);
  const [showScanModal, setShowScanModal] = useState(false);
  const modalContainerRef = React.useRef<HTMLDivElement>(null);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  // 🖊️ Bút dạ quang ghi chú (Hỗ trợ toàn diện từ Cấp 1 đến Cấp 5)
  const [isHighlighterActive, setIsHighlighterActive] = useState<boolean>(false);
  const [highlighterColor, setHighlighterColor] = useState<string>(HIGHLIGHTER_COLORS[0].value);
  const [strokeCount, setStrokeCount] = useState<number>(0);
  const highlighterRef = React.useRef<{ undo: () => void; clear: () => void; getStrokeCount: () => number } | null>(null);

  // 🛡️ Chống chụp màn hình & cảnh báo an ninh (PrintScreen, Win+Shift+S, Quá 3 lần khóa tài khoản)
  const { isShieldActive, violationInfo, violationCount, isAccountLocked, dismissShield } = useAntiScreenshot({
    document,
    enabled: open && Boolean(document),
    iframeRef,
  });

  const docLevel = document ? (document.security_level_id || 1) : 1;
  const canView = !document || docLevel <= clearanceLevel;
  const canDownload = !document || (docLevel <= 2 && docLevel <= clearanceLevel);
  const isSecretLevel = docLevel >= 3;

  // 🔒 Khóa cuộn trang web cha (document-desk) để loại bỏ 100% thanh cuộn kép (double scrollbar)
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const prevBodyOverflow = window.document.body.style.overflow;
    const prevHtmlOverflow = window.document.documentElement.style.overflow;
    window.document.body.style.overflow = 'hidden';
    window.document.documentElement.style.overflow = 'hidden';
    return () => {
      window.document.body.style.overflow = prevBodyOverflow;
      window.document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [open]);

  // 🚪 Khi bấm phím Esc hoặc người dùng thoát Fullscreen -> TỰ ĐỘNG THOÁT TÀI LIỆU
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const winDoc = window.document;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };

    const handleFsChange = () => {
      if (!winDoc.fullscreenElement && open) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    winDoc.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      winDoc.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, [open]);

  const clearBiometricSession = () => {
    setFingerprintToken(null);
    if (typeof window !== 'undefined' && document?.file_id) {
      try {
        sessionStorage.removeItem(`qk7_fp_token_${document.file_id}`);
        // Xóa luôn key global nếu trước đó có sót lại
        sessionStorage.removeItem('qk7_fp_token');
      } catch (e) {}
    }
  };

  const loadPdfBlob = async (docId: string, fpToken?: string | null) => {
    if (!canView) {
      setError(`Cấp độ bảo mật của bạn (Cấp ${clearanceLevel}) không đủ điều kiện xem văn bản này.`);
      setLoading(false);
      return;
    }

    // Biometric Guard: Ưu tiên token truyền vào → state phiên hiện hành → sessionStorage per-file.
    // Token được bind chặt với file_id ở server-side (JWT claim file_id) nên không thể dùng chéo file khác.
    // ✅ SỬA: thêm fallback đọc từ sessionStorage cho đúng file này để đồng bộ với fileService
    const sessionToken = typeof window !== 'undefined'
      ? sessionStorage.getItem(`qk7_fp_token_${docId}`)
      : null;

    const effectiveToken = fpToken || fingerprintToken || sessionToken;

    if (docLevel >= 3 && !effectiveToken) {
      setShowScanModal(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const fileResult = await fileService.fetchFileBlobWithMeta(docId, '0', effectiveToken || undefined);

      // Clock-Skew Guard: Kiểm tra chênh lệch thời gian máy trạm và máy chủ (Áp dụng cho TOÀN BỘ cấp độ tài liệu: Cấp 1 đến Cấp 5)
      // Ngưỡng 60 giây (1 phút): Chặn đứng 100% mọi hành vi chỉnh lùi/tiến giờ có chủ đích mà không gây chặn nhầm do độ trễ mạng
      const MAX_CLOCK_SKEW_MS = 60 * 1000; // 1 phút (60 giây)
      if (fileResult.clockSkewMs > MAX_CLOCK_SKEW_MS || fileResult.isClockTampered) {
        const skewSec = Math.max(1, Math.round(fileResult.clockSkewMs / 1000));
        const skewStr = skewSec >= 60 ? `${Math.round(skewSec / 60)} phút` : `${skewSec} giây`;
        setError(
          `CẢNH BÁO AN NINH: Đồng hồ máy trạm bị sai lệch ${skewStr} so với máy chủ chuẩn QK7 (Phát hiện hành vi điều chỉnh lùi/tiến giờ hệ thống). Hệ thống từ chối mở tài liệu (${document.document_code} - Cấp ${docLevel}) để ngăn ngừa hành vi làm sai lệch bằng chứng pháp lý. Vui lòng đồng bộ lại giờ chuẩn trước khi truy cập.`
        );
        setLoading(false);
        return;
      }

      const userDisplayName = formatUserDisplayName(user?.full_name, user?.username);
      // Sử dụng thời gian chuẩn từ máy chủ NTP (tuyệt đối không dùng new Date() của client)
      const timeStr = formatWatermarkDateTime(fileResult.serverTime);
      const blob = await stampWatermarkOnPdf(fileResult.blob, {
        userDisplayName,
        timeStr,
        traceId: fileResult.traceId,
        opacity: 0.18,
      });
      const url = URL.createObjectURL(blob);
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      if (effectiveToken && effectiveToken !== fingerprintToken) {
        setFingerprintToken(effectiveToken);
      }
    } catch (err: any) {
      if ((err.status === 403 || err.require_fingerprint) && docLevel >= 3) {
        setShowScanModal(true);
      } else {
        setError(err.message || 'Không thể tải tệp văn bản. Vui lòng kiểm tra quyền truy cập.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && document) {
      // Khi mở modal: ưu tiên propInitialToken, sau đó fallback sang sessionStorage per-file (đồng bộ với fileService).
      // Token được bind chặt với file_id ở server-side nên không thể dùng chéo file khác.
      // Đối với tài liệu Cấp 3+ chưa có token hợp lệ, fingerprintToken ban đầu là null nên sẽ kích hoạt quét vân tay ngay lập tức.
      const sessionToken = typeof window !== 'undefined'
        ? sessionStorage.getItem(`qk7_fp_token_${document.file_id}`)
        : null;
      const tokenToUse = propInitialToken || sessionToken || null;
      setFingerprintToken(tokenToUse);
      loadPdfBlob(document.file_id, tokenToUse);
    } else {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setError(null);
      setLoading(false);
      setShowScanModal(false);
      clearBiometricSession();
    }

    return () => {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      clearBiometricSession();
    };
    // eslint-disable-next-line
  }, [open, document?.file_id, clearanceLevel]);

  if (!open || !document) return null;

  const handleDownload = async (signal?: AbortSignal): Promise<() => void> => {
    if (!canDownload || !document) throw new Error('Không có quyền tải về');
    try {
      setDownloading(true);
      toast.info(`Đang truyền phát và chuẩn bị văn bản ${document.document_code}...`, {
        title: 'ĐANG XỬ LÝ TỆP',
        badge: 'STREAMING',
        duration: 3200,
      });

      // Tải tệp gốc sạch sẽ từ server (không chứa watermark)
      if (false && blobUrl) {
        return () => {
          const a = window.document.createElement('a');
          a.href = blobUrl;
          a.download = document.original_name || `${document.document_code}.pdf`;
          window.document.body.appendChild(a);
          try {
            a.click();
          } finally {
            a.remove();
          }
          toast.success(`Đã tải xuống thành công văn bản ${document.document_code}`, {
            title: 'TẢI TỆP HOÀN TẤT',
            badge: 'PDF-READY',
          });
        };
      }

      const sanitizedFilename = (document.original_name || `${document.document_code}.pdf`).replace(/[\/\\?%*:|"<>]/g, '_');
      const release = await fileService.prepareDownload(
        document.file_id,
        sanitizedFilename,
        fingerprintToken || undefined,
        signal
      );

      return async () => {
        await release();
        toast.success(`Đã tải xuống thành công văn bản ${document.document_code}`, {
          title: 'TẢI TỆP HOÀN TẤT',
          badge: 'PDF-READY',
        });
      };
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setError(err.message || 'Lỗi khi tải tệp');
      }
      throw err;
    } finally {
      setDownloading(false);
    }
  };

  const handleClose = () => {
    setShowScanModal(false);
    clearBiometricSession();
    setIsHighlighterActive(false);
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    try {
      if (typeof window !== 'undefined' && window.document.fullscreenElement && window.document.exitFullscreen) {
        window.document.exitFullscreen().catch(() => {});
      }
    } catch (_) {}
    onClose();
  };

  return (
    <AnimatePresence>
      <div
        key="preview-backdrop"
        ref={modalContainerRef}
        className={`fixed inset-0 z-50 flex flex-col w-screen h-screen bg-white dark:bg-slate-900 overflow-hidden ${
          isSecretLevel ? 'select-none' : 'select-text'
        }`}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="w-full h-full flex flex-col bg-white dark:bg-slate-900 overflow-hidden"
        >
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3 overflow-hidden min-w-0 flex-1 mr-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                  <span
                    className="font-mono text-xs font-semibold px-2 py-0.5 rounded text-amber-800 bg-amber-500/10 border border-amber-600/25 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/25 whitespace-nowrap shrink-0 inline-flex items-center"
                    title={document.document_code}
                  >
                    {document.document_code}
                  </span>
                  <span className="text-slate-400 text-xs shrink-0 select-none">•</span>
                  <span
                    className="text-xs sm:text-sm text-slate-900 dark:text-white font-bold truncate min-w-0 flex-1"
                    title={document.title}
                  >
                    {document.title}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap sm:flex-nowrap">
                  <span className="flex items-center gap-1 shrink-0">
                    <Building className="w-3 h-3 text-slate-400" />
                    {document.unit_name || '—'}
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {formatDate(document.issued_date || document.issue_date)}
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    <Shield className="w-3 h-3 text-amber-500" />
                    {document.security_name || document.security_level_name || `Cấp ${document.security_level_id}`}
                  </span>
                  {isSecretLevel ? (
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap">
                      Chỉ xem trực tiếp (Mật)
                    </span>
                  ) : !canDownload ? (
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap">
                      Chỉ xem trực tiếp
                    </span>
                  ) : null}
                  <span className="shrink-0">{formatFileSize(document.file_size ?? document.file_size_bytes)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              {/* 🖊️ Bút dạ quang ghi chú (Hỗ trợ toàn diện từ Cấp 1 đến Cấp 5) */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsHighlighterActive((prev) => !prev)}
                  className={`px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${
                    isHighlighterActive
                      ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  title={isHighlighterActive ? 'Đang bật bút dạ quang (Click để tắt và thao tác văn bản)' : 'Bật bút dạ quang ghi chú giáo trình'}
                >
                  <Highlighter className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {isHighlighterActive ? 'Đang vẽ ghi chú' : 'Bút dạ quang'}
                  </span>
                </button>

                {/* Bảng chọn màu bút dạ quang & nút Hoàn tác (Undo) */}
                {isHighlighterActive && (
                  <div className="flex items-center gap-1 pl-1.5 border-l border-slate-300 dark:border-slate-600">
                    {HIGHLIGHTER_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setHighlighterColor(c.value)}
                        className={`w-5 h-5 rounded-full ${c.bgClass} border transition-all cursor-pointer ${
                          highlighterColor === c.value
                            ? 'scale-115 ring-2 ring-slate-800 dark:ring-white border-white shadow-xs'
                            : 'opacity-70 hover:opacity-100 border-transparent'
                        }`}
                        title={c.name}
                      />
                    ))}
                    {strokeCount > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => highlighterRef.current?.undo()}
                          className="p-1 text-slate-500 hover:text-amber-500 dark:text-slate-300 dark:hover:text-amber-400 transition cursor-pointer ml-0.5"
                          title="Hoàn tác nét vẽ vừa bôi (Ctrl + Z)"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => highlighterRef.current?.clear()}
                          className="p-1 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition cursor-pointer"
                          title="Xóa tất cả nét ghi chú"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <CompactDownloadButton
                onDownload={handleDownload}
                onCancel={() =>
                  toast.info(`Đã hủy tải văn bản ${document.document_code}`, {
                    title: 'ĐÃ HỦY TẢI',
                    badge: 'CANCELLED',
                    duration: 2000,
                  })
                }
                disabled={!canDownload}
                disabledTitle={
                  isSecretLevel
                    ? 'Tài liệu từ Cấp 3 trở lên chỉ duy nhất cho phép xem trực tiếp, không được phép tải về máy'
                    : `Cấp độ bảo mật của bạn (Cấp ${clearanceLevel}) không đủ điều kiện tải về văn bản Cấp ${docLevel}`
                }
                size="compact"
              />
              <button
                onClick={handleClose}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Thoát tài liệu (Esc)"
                aria-label="Thoát tài liệu (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 bg-slate-100 dark:bg-slate-950 overflow-hidden relative flex items-center justify-center">
            {loading && (
              <div className="flex flex-col items-center justify-center space-y-3 p-6 text-slate-600 dark:text-slate-300">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-medium">Đang xác thực và tải văn bản PDF bảo mật...</p>
              </div>
            )}

            {!loading && error && !canView && (
              <div className="p-4 sm:p-6 w-full flex items-center justify-center">
                <AccessDeniedCard
                  compact
                  requiredClearanceLevel={docLevel}
                  requiredClearanceName={document?.security_name || document?.security_level_name || `Cấp ${docLevel}`}
                  documentTitle={document?.title}
                  documentCode={document?.document_code}
                  onClose={onClose}
                />
              </div>
            )}

            {!loading && error && canView && (
              <div className="p-6 max-w-md mx-auto text-center space-y-4 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-2xl shadow-lg">
                <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    Không thể hiển thị văn bản
                  </h4>
                  <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
                </div>
                <button
                  onClick={() => loadPdfBlob(document.file_id, fingerprintToken)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] hover:from-[#166534] hover:to-[#15803d] text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-md shadow-emerald-950/20 border border-amber-500/25"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Thử lại</span>
                </button>
              </div>
            )}

            {!loading && !error && blobUrl && (
              <div className="relative overflow-hidden w-full h-full flex flex-col items-center">
                {/* 📄 Bộ hiển thị trang PDF chuẩn + Bút dạ quang ĂN CỨNG THEO TÀI LIỆU (giống Watermark) */}
                <PdfPagesViewer
                  blobUrl={blobUrl}
                  fileId={document.file_id}
                  securityLevel={docLevel}
                  isHighlighterActive={isHighlighterActive}
                  highlighterColor={highlighterColor}
                  onStrokeCountChange={(count) => setStrokeCount(count)}
                  highlighterRef={highlighterRef}
                />

                {/* Lá chắn cảnh báo đỏ vi phạm an ninh (Liên tục & Quá 3 lần khóa tài khoản) */}
                <SecurityScreenShield
                  active={isShieldActive}
                  document={document}
                  violationInfo={violationInfo}
                  violationCount={violationCount}
                  isAccountLocked={isAccountLocked}
                  onDismiss={dismissShield}
                  onLockoutLogout={async () => {
                    clearBiometricSession();
                    onClose();
                    try {
                      await logout();
                    } catch (_) {}
                    window.location.href = '/login';
                  }}
                />
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <FingerprintScanModal
        key="fingerprint-scan-modal"
        open={showScanModal}
        fileId={document?.file_id || ""}
        onSuccess={(token) => {
          setShowScanModal(false);
          const validToken = token || "";
          setFingerprintToken(validToken || null);
          // ✅ Lưu token vào sessionStorage per-file để đồng bộ 2 chiều với fileService
          if (validToken && document?.file_id && typeof window !== 'undefined') {
            try {
              sessionStorage.setItem(`qk7_fp_token_${document.file_id}`, validToken);
            } catch (e) {}
          }
          if (document) {
            loadPdfBlob(document.file_id, validToken || null);
          }
        }}
        onCancel={() => {
          handleClose();
        }}
      />
    </AnimatePresence>
  );
};