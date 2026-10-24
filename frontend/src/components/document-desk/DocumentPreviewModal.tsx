import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  ExternalLink,
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

export interface DocumentPreviewModalProps {
  open: boolean;
  document: DocumentItem | null;
  userClearanceLevel?: number;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  open,
  document,
  userClearanceLevel: propClearanceLevel,
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

  const docLevel = document ? (document.security_level_id || 1) : 1;
  const canView = !document || docLevel <= clearanceLevel;
  const canDownload = !document || (docLevel <= 2 && docLevel <= clearanceLevel);
  const isSecretLevel = docLevel >= 3;

  const loadPdfBlob = async (docId: string, fpToken?: string | null) => {
    if (!canView) {
      setError(`Cấp độ bảo mật của bạn (Cấp ${clearanceLevel}) không đủ điều kiện xem văn bản này.`);
      setLoading(false);
      return;
    }

    if (docLevel >= 3 && !fpToken) {
      setShowScanModal(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const blob = await fileService.fetchFileBlob(docId, '0', fpToken || undefined);
      const url = URL.createObjectURL(blob);
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (err: any) {
      setError(err.message || 'Không thể tải tệp văn bản. Vui lòng kiểm tra quyền truy cập.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && document) {
      setFingerprintToken(null);
      loadPdfBlob(document.file_id, null);
    } else {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setError(null);
      setLoading(false);
      setShowScanModal(false);
      setFingerprintToken(null);
    }

    return () => {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
    // eslint-disable-next-line
  }, [open, document?.file_id, clearanceLevel]);

  if (!open || !document) return null;

  const handleDownload = async () => {
    if (!canDownload) return;
    try {
      setDownloading(true);
      if (blobUrl) {
        const a = window.document.createElement('a');
        a.href = blobUrl;
        a.download = document.original_name || `${document.document_code}.pdf`;
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
      } else {
        await fileService.downloadFile(
          document.file_id,
          document.original_name || `${document.document_code}.pdf`,
          fingerprintToken || undefined
        );
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải tệp');
    } finally {
      setDownloading(false);
    }
  };

  const handleOpenNewTab = () => {
    if (blobUrl) {
      window.open(`${blobUrl}#toolbar=0&navpanes=0`, '_blank');
    } else {
      window.open(`${fileService.getViewUrl(document.file_id, '0')}#toolbar=0&navpanes=0`, '_blank');
    }
  };

  return (
    <AnimatePresence>
      <div key="preview-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl max-w-[calc(100vw-32px)] h-[92vh] max-h-[calc(100dvh-2rem)] overflow-hidden shadow-2xl flex flex-col mx-auto"
        >
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded text-amber-800 bg-amber-500/10 border border-amber-600/25 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/25">
                    {document.document_code}
                  </span>
                  <span className="text-slate-400 text-xs">•</span>
                  <span className="text-xs text-slate-800 dark:text-slate-200 font-bold truncate">
                    {document.title}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Building className="w-3 h-3 text-slate-400" />
                    {document.unit_name || '—'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {formatDate(document.issued_date || document.issue_date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3 text-amber-500" />
                    {document.security_name || document.security_level_name || `Cấp ${document.security_level_id}`}
                  </span>
                  {isSecretLevel ? (
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded">
                      Chỉ xem trực tiếp (Mật)
                    </span>
                  ) : !canDownload ? (
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded">
                      Chưa đủ quyền tải về
                    </span>
                  ) : null}
                  <span>{formatFileSize(document.file_size ?? document.file_size_bytes)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              {/* Nút mở PDF Toàn màn hình (Khắc phục hạn chế cuộn trang của Safari trên iPadOS) */}
              <button
                onClick={handleOpenNewTab}
                className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-medium text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                title="Mở PDF toàn màn hình trong tab mới (Khắc phục hạn chế cuộn trang của Safari trên iPad)"
              >
                <ExternalLink className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span className="hidden sm:inline">Toàn màn hình</span>
              </button>
              <CompactDownloadButton
                onDownload={handleDownload}
                disabled={!canDownload}
                disabledTitle={
                  isSecretLevel
                    ? 'Tài liệu từ Cấp 3 trở lên chỉ duy nhất cho phép xem trực tiếp, không được phép tải về máy'
                    : `Cấp độ bảo mật của bạn (Cấp ${clearanceLevel}) không đủ điều kiện tải về văn bản Cấp ${docLevel}`
                }
                size="compact"
              />
              <button
                onClick={onClose}
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

            {!loading && error && (
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
              <iframe
                src={`${blobUrl}#toolbar=0&navpanes=0`}
                title={document.title}
                className="w-full h-full border-none"
              />
            )}
          </div>
        </motion.div>
      </div>

      <FingerprintScanModal
        key="fingerprint-scan-modal"
        open={showScanModal}
        fileId={document?.file_id || ''}
        onSuccess={(token) => {
          setShowScanModal(false);
          setFingerprintToken(token || null);
          if (document) {
            loadPdfBlob(document.file_id, token || null);
          }
        }}
        onCancel={() => {
          setShowScanModal(false);
          onClose();
        }}
      />
    </AnimatePresence>
  );
};