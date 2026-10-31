import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  ExternalLink,
  Maximize2,
  Minimize2,
  FileText,
  Calendar,
  Building,
  Shield,
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
  const { user } = useAuth();
  const clearanceLevel = propClearanceLevel ?? (user?.clearance_level_id || 1);

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);

  const [fingerprintToken, setFingerprintToken] = useState<string | null>(null);
  const [showScanModal, setShowScanModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const modalContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (typeof window !== 'undefined' && !window.document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    if (typeof window !== 'undefined') {
      window.document.addEventListener('fullscreenchange', handleFullscreenChange);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.document.removeEventListener('fullscreenchange', handleFullscreenChange);
      }
    };
  }, []);

  const docLevel = document ? (document.security_level_id || 1) : 1;
  const canView = !document || docLevel <= clearanceLevel;
  const canDownload = !document || (docLevel <= 2 && docLevel <= clearanceLevel);
  const isSecretLevel = docLevel >= 3;

  // ✅ SỬA clearBiometricSession: Chỉ xóa token của file hiện tại + dọn key global cũ
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

      const release = await fileService.prepareDownload(
        document.file_id,
        document.original_name || `${document.document_code}.pdf`,
        fingerprintToken || undefined,
        signal
      );

      return () => {
        release();
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

  const handleToggleFullscreen = () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      try {
        if (modalContainerRef.current?.requestFullscreen) {
          modalContainerRef.current.requestFullscreen().catch(() => {});
        }
      } catch (e) {}
    } else {
      setIsFullscreen(false);
      try {
        if (typeof window !== 'undefined' && window.document.fullscreenElement && window.document.exitFullscreen) {
          window.document.exitFullscreen().catch(() => {});
        }
      } catch (e) {}
    }
  };

  const handleClose = () => {
    clearBiometricSession();
    if (isFullscreen) {
      try {
        if (typeof window !== 'undefined' && window.document.fullscreenElement && window.document.exitFullscreen) {
          window.document.exitFullscreen().catch(() => {});
        }
      } catch (e) {}
      setIsFullscreen(false);
    }
    onClose();
  };

  const handleOpenNewTab = () => {
    if (!blobUrl || !document) return;

    const titleEscaped = (document.title || 'Văn bản QK7 DataHub')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const codeEscaped = (document.document_code || 'VĂN BẢN')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const securityEscaped = (document.security_name || document.security_level_name || `Cấp ${document.security_level_id || 1}`)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${codeEscaped} - ${titleEscaped} | QK7 DataHub</title>
  <link rel="icon" type="image/png" href="/favicon.png" />
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .hud-bar {
      height: 46px;
      background: linear-gradient(90deg, #092e20 0%, #064e3b 50%, #0f172a 100%);
      border-bottom: 1px solid rgba(16, 185, 129, 0.3);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      color: #f8fafc;
      z-index: 10;
      user-select: none;
    }
    .hud-left {
      display: flex;
      align-items: center;
      gap: 10px;
      overflow: hidden;
    }
    .code-badge {
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.35);
      color: #fbbf24;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 4px;
      white-space: nowrap;
    }
    .sec-badge {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 4px;
      white-space: nowrap;
    }
    .doc-title {
      font-size: 13px;
      font-weight: 600;
      color: #e2e8f0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 50vw;
    }
    .hud-right {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
    .viewer-container {
      position: relative;
      width: 100%;
      height: calc(100% - 46px);
      background-color: #525659;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
    @media print {
      .hud-bar { display: none !important; }
      .viewer-container { height: 100% !important; background: transparent !important; }
    }
  </style>
</head>
<body>
  <div class="hud-bar">
    <div class="hud-left">
      <span class="code-badge">${codeEscaped}</span>
      <span class="doc-title">${titleEscaped}</span>
      <span class="sec-badge">${securityEscaped}</span>
    </div>
    <div class="hud-right"></div>
  </div>
  <div class="viewer-container">
    <iframe src="${blobUrl}#page=${page || 1}&toolbar=0&navpanes=0"></iframe>
  </div>
</body>
</html>`;

    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
    const htmlUrl = URL.createObjectURL(htmlBlob);
    const newTab = window.open(htmlUrl, '_blank');
    if (!newTab) {
      const a = window.document.createElement('a');
      a.href = htmlUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      window.document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  return (
    <AnimatePresence>
      <div
        key="preview-backdrop"
        ref={modalContainerRef}
        className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm transition-all duration-200 ${
          isFullscreen ? 'p-0' : 'p-2 sm:p-4 md:p-6'
        }`}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl flex flex-col mx-auto transition-all duration-200 ${
            isFullscreen
              ? 'w-full h-full max-w-none max-h-none rounded-none border-none'
              : 'rounded-2xl w-full max-w-5xl h-[92vh] max-h-[calc(100dvh-2rem)]'
          }`}
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
                    className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-bold truncate min-w-0 flex-1"
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
              {/* Nút mở PDF Toàn màn hình (Tích hợp DRM Watermark chuẩn hóa) */}
              <button
                onClick={handleOpenNewTab}
                className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-medium text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                title="Mở toàn màn hình xem PDF trong tab mới (Tích hợp Watermark bảo mật)"
              >
                <ExternalLink className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span className="hidden sm:inline">Toàn màn hình</span>
              </button>
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
                onClick={handleToggleFullscreen}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title={isFullscreen ? 'Thu nhỏ hộp thoại' : 'Phóng to hộp thoại'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
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
              <div className="relative overflow-hidden w-full h-full flex items-center justify-center">
                <iframe
                  src={`${blobUrl}#page=${page || 1}&toolbar=0&navpanes=0`}
                  title={document.title}
                  className="w-full h-full border-none"
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
          setShowScanModal(false);
          clearBiometricSession();
          if (!blobUrl) {
            onClose();
          }
        }}
      />
    </AnimatePresence>
  );
};