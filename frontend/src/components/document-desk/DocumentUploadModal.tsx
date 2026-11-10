import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  X,
  Save,
  Loader2,
  FileText,
  Sparkles,
  AlertCircle,
  Plus,
  Minus,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
  Eye,
  RefreshCw,
  Shield,
  Fingerprint,
} from 'lucide-react';
import { TreeSelect } from 'antd';
import { Dropzone } from './Dropzone';
import { DocumentItem, DocumentType, Unit, SecurityLevel } from '../../types';
import { documentService, ParseDocumentResult, CheckDuplicateResult } from '../../services/documentService';
import { buildUnitTree } from '../../utils/unitTree';
import { PdfPagesViewer } from './PdfPagesViewer';
import { DynamicWatermark } from '../common/DynamicWatermark';
import { stampWatermarkOnPdf } from '../../utils/pdfWatermark';
import { formatUserDisplayName, formatWatermarkDateTime } from '../../hooks/useFloatingWatermark';
import { fileService } from '../../services/fileService';
import { FingerprintScanModal } from '../users/FingerprintScanModal';
import { useAuth } from '../../hooks/useAuth';

export type ParseStatus = 'idle' | 'classifying' | 'ocr_processing' | 'extracting' | 'done' | 'error';

export interface DocumentUploadModalProps {
  open: boolean;
  document?: DocumentItem | null;
  types: DocumentType[];
  units: Unit[];
  levels: SecurityLevel[];
  onClose: () => void;
  onSave: (formData: FormData, isEdit: boolean) => Promise<any> | any;
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  open,
  document,
  types,
  units,
  levels,
  onClose,
  onSave,
  onToast,
}) => {
  const { user } = useAuth();
  const isEdit = Boolean(document);

  // ── Form Input States ──
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [typeId, setTypeId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [securityLevel, setSecurityLevel] = useState<number | ''>('');
  const [signer, setSigner] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [summary, setSummary] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // ── Cây đơn vị cho TreeSelect ──
  const unitTree = useMemo(() => buildUnitTree(units), [units]);
  const rootUnitKeys = useMemo(() => unitTree.map((node) => String(node.key)), [unitTree]);
  const [treeExpandedKeys, setTreeExpandedKeys] = useState<string[]>([]);

  useEffect(() => {
    if (rootUnitKeys.length > 0) {
      setTreeExpandedKeys(rootUnitKeys);
    }
  }, [rootUnitKeys]);

  // ── Auto-parse PDF (Đa giai đoạn & Timeout UX) ──
  const [parsing, setParsing] = useState(false);
  const [parseStatus, setParseStatus] = useState<ParseStatus>('idle');
  const [parseTimeoutWarning, setParseTimeoutWarning] = useState(false);
  const [parseResult, setParseResult] = useState<ParseDocumentResult | null>(null);
  const [parseError, setParseError] = useState('');
  const parsedFileRef = useRef<File | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<CheckDuplicateResult | null>(null);
  const [allowOverride, setAllowOverride] = useState(false);
  const [proposalReason, setProposalReason] = useState('Đề xuất chuẩn hóa thông tin văn bản');

  // ── PDF Real-time Local Preview & Split-Pane States ──
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewFileType, setPreviewFileType] = useState<'empty' | 'pdf' | 'office'>('empty');
  const [previewFileName, setPreviewFileName] = useState<string>('');
  const [isWatermarkedOnBlob, setIsWatermarkedOnBlob] = useState<boolean>(false);
  const previewUrlRef = useRef<string | null>(null);
  previewUrlRef.current = previewUrl;

  // Responsive tab switcher cho màn hình nhỏ (< lg)
  const [activeMobileTab, setActiveMobileTab] = useState<'form' | 'preview'>('form');

  // 🛡️ Sinh trắc học vân tay cho văn bản Cấp 3+ ở chế độ Hiệu Chỉnh
  const [showScanModal, setShowScanModal] = useState<boolean>(false);
  const [fingerprintToken, setFingerprintToken] = useState<string | null>(null);

  // Tránh prefill lặp lại gây nhấp nháy hoặc ghi đè dữ liệu đang gõ
  const initializedDocIdRef = useRef<string | null>(null);
  const prevSelectedFileRef = useRef<File | null>(null);

  // 🔒 Khóa cuộn trang web cha (document-desk) để loại bỏ 100% thanh cuộn kép
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

  // 🚪 Phím tắt Esc đóng modal an toàn
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (showConfirmModal) {
          setShowConfirmModal(false);
          return;
        }
        if (showScanModal) {
          setShowScanModal(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, showConfirmModal, showScanModal, onClose]);

  // Tải văn bản PDF gốc từ máy chủ khi ở chế độ Hiệu Chỉnh (ổn định & không bị gọi lặp lại)
  const loadOriginalDocumentPdf = useCallback(
    async (docFileId?: string, fpToken?: string | null) => {
      const targetFileId = docFileId || document?.file_id;
      if (!targetFileId) return;

      const docLevel = document?.security_level_id || 1;
      const userClearance = user?.clearance_level_id || 1;

      if (docLevel > userClearance) {
        setPreviewFileType('pdf');
        setPreviewError(`Cấp độ bảo mật của bạn (Cấp ${userClearance}) không đủ điều kiện xem trước tệp văn bản này.`);
        setPreviewLoading(false);
        return;
      }

      const sessionToken =
        fpToken ||
        fingerprintToken ||
        (typeof window !== 'undefined'
          ? sessionStorage.getItem(`qk7_fp_token_${targetFileId}`)
          : null);

      if (docLevel >= 3 && !sessionToken) {
        setPreviewFileType('pdf');
        setPreviewFileName(document?.original_name || `${document?.document_code}.pdf`);
        setPreviewError('BIOMETRIC_REQUIRED');
        setPreviewLoading(false);
        return;
      }

      setPreviewLoading(true);
      setPreviewError(null);
      setPreviewFileType('pdf');
      setPreviewFileName(document?.original_name || `${document?.document_code}.pdf`);

      try {
        const fileResult = await fileService.fetchFileBlobWithMeta(
          targetFileId,
          '0',
          sessionToken || undefined
        );
        const userDisplayName = formatUserDisplayName(user?.full_name, user?.username);
        const timeStr = formatWatermarkDateTime(fileResult.serverTime);

        // Đóng dấu Sparse Dynamic Watermark trực tiếp vào PDF
        const stampedBlob = await stampWatermarkOnPdf(fileResult.blob, {
          userDisplayName,
          timeStr,
          traceId: fileResult.traceId,
          opacity: 0.18,
        });

        const newUrl = URL.createObjectURL(stampedBlob);
        setPreviewUrl((prev) => {
          if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
          return newUrl;
        });
        setIsWatermarkedOnBlob(true);
        if (sessionToken && sessionToken !== fingerprintToken) {
          setFingerprintToken(sessionToken);
        }
      } catch (err: any) {
        if ((err.status === 403 || err.require_fingerprint) && docLevel >= 3) {
          setPreviewError('BIOMETRIC_REQUIRED');
        } else {
          setPreviewError(err.message || 'Không thể tải bản xem trước tệp văn bản từ máy chủ.');
        }
      } finally {
        setPreviewLoading(false);
      }
    },
    [
      document?.file_id,
      document?.security_level_id,
      document?.original_name,
      document?.document_code,
      user?.full_name,
      user?.username,
      user?.clearance_level_id,
      fingerprintToken,
    ]
  );

  // Prefill on edit & Reset form on open/close — CHỈ chạy khi open hoặc file_id thay đổi
  useEffect(() => {
    if (!open) {
      initializedDocIdRef.current = null;
      prevSelectedFileRef.current = null;
      return;
    }

    const currentId = document?.file_id || '__NEW__';
    if (initializedDocIdRef.current === currentId) {
      // Đã khởi tạo cho văn bản này rồi, không chạy lại để tránh nhấp nháy hoặc đè dữ liệu user đang gõ
      return;
    }
    initializedDocIdRef.current = currentId;

    if (document) {
      setCode(document.document_code || '');
      setTitle(document.title || '');
      setTypeId(document.doc_type_id || document.type_id || '');
      setUnitId(document.issuing_unit_id || document.unit_id || '');
      setSecurityLevel(document.security_level_id || '');
      setSigner(document.signer || '');
      const rawDate = document.issued_date || document.issue_date;
      setIssueDate(rawDate ? rawDate.split('T')[0] : '');
      setSummary(document.summary || '');
      setSelectedFile(null);
      setActiveMobileTab('form');

      // Tự động nạp PDF hiện tại của văn bản ở chế độ Hiệu Chỉnh
      loadOriginalDocumentPdf(document.file_id);
    } else {
      setCode('');
      setTitle('');
      setTypeId('');
      setUnitId('');
      setSecurityLevel('');
      setSigner('');
      setIssueDate('');
      setSummary('');
      setSelectedFile(null);
      setPreviewUrl((prev) => {
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });
      setPreviewFileType('empty');
      setPreviewFileName('');
      setPreviewError(null);
      setPreviewLoading(false);
      setIsWatermarkedOnBlob(false);
      setActiveMobileTab('form');
    }
    setError('');
    setShowConfirmModal(false);
    setParseResult(null);
    setParseError('');
    setParseStatus('idle');
    setParseTimeoutWarning(false);
    parsedFileRef.current = null;
  }, [open, document?.file_id, loadOriginalDocumentPdf]);

  // ── Xử lý Real-time Local Preview khi người dùng kéo/thả hoặc chọn tệp mới ──
  useEffect(() => {
    // Nếu tệp không thay đổi (ví dụ user đang gõ text vào form), KHÔNG làm gì cả!
    if (prevSelectedFileRef.current === selectedFile) {
      return;
    }
    prevSelectedFileRef.current = selectedFile;

    if (!selectedFile) {
      if (isEdit && document?.file_id) {
        loadOriginalDocumentPdf(document.file_id);
      } else {
        setPreviewUrl((prev) => {
          if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
          return null;
        });
        setPreviewFileType('empty');
        setPreviewFileName('');
        setPreviewError(null);
        setPreviewLoading(false);
        setIsWatermarkedOnBlob(false);
      }
      return;
    }

    const isPdf =
      selectedFile.type === 'application/pdf' ||
      selectedFile.name.toLowerCase().endsWith('.pdf');

    setPreviewFileName(selectedFile.name);

    if (!isPdf) {
      setPreviewUrl((prev) => {
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });
      setPreviewFileType('office');
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    // ⚡ Real-time Local Preview: Tạo Object URL tức thì 0ms mà KHÔNG CẦN chờ server
    const instantUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return instantUrl;
    });
    setPreviewFileType('pdf');
    setPreviewError(null);
    setIsWatermarkedOnBlob(false);

    // Đóng dấu Sparse Dynamic Watermark trên nền client (pdf-lib)
    let isCancelled = false;
    const userDisplayName = formatUserDisplayName(user?.full_name, user?.username);
    const timeStr = formatWatermarkDateTime(new Date());

    stampWatermarkOnPdf(selectedFile, {
      userDisplayName,
      timeStr,
      opacity: 0.18,
    })
      .then((stampedBlob) => {
        if (isCancelled) return;
        const stampedUrl = URL.createObjectURL(stampedBlob);
        setPreviewUrl((prev) => {
          if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
          return stampedUrl;
        });
        setIsWatermarkedOnBlob(true);
      })
      .catch((err) => {
        console.warn('[stampWatermarkOnPdf] Fallback to raw local preview:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedFile, isEdit, document?.file_id, user?.full_name, user?.username, loadOriginalDocumentPdf]);

  // Dọn dẹp URL khi unmount để phòng chống rò rỉ bộ nhớ (Memory leak)
  useEffect(() => {
    return () => {
      if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  // ── Auto-parse PDF khi user chọn file mới ──
  useEffect(() => {
    if (!selectedFile) {
      parsedFileRef.current = null;
      setParseResult(null);
      setParseError('');
      setDuplicateInfo(null);
      setAllowOverride(false);
      return;
    }
    if (isEdit) return;
    if (parsedFileRef.current === selectedFile) return;
    parsedFileRef.current = selectedFile;

    setParsing(true);
    setParseStatus('classifying');
    setParseTimeoutWarning(false);
    setParseError('');
    setDuplicateInfo(null);
    setAllowOverride(false);

    // Trước khi gọi API: trạng thái 'classifying'
    setParseStatus('classifying');

    // Sau 1.2s nếu server đang phân tích/scan -> chuyển sang 'ocr_processing'
    const stageTimer = setTimeout(() => {
      setParseStatus((prev) => (prev === 'classifying' ? 'ocr_processing' : prev));
    }, 1200);

    // Cảnh báo nếu thời gian chờ vượt quá 30 giây (văn bản scan phức tạp)
    const timeoutTimer = setTimeout(() => {
      setParseTimeoutWarning(true);
    }, 30000);

    documentService
      .parseDocument(selectedFile)
      .then((parseRes) => {
        setParseStatus('extracting');
        if (parseRes.success && parseRes.parsed) {
          const p = parseRes.parsed;
          if (p.document_code) setCode(p.document_code);
          if (p.title) setTitle(p.title);
          if (p.issued_date) setIssueDate(p.issued_date);
          if (p.doc_type_code && types.some((t) => t.type_id === p.doc_type_code)) {
            setTypeId(p.doc_type_code);
          }
          const signerParts = [p.signer, p.signer_position].filter(Boolean);
          if (signerParts.length > 0) setSigner(signerParts.join(' — '));
          const parsedUnitId = p.issuer_unit_id || p.issuer_parent_unit_id;
          if (parsedUnitId && units.some((u) => u.unit_id === parsedUnitId)) {
            setUnitId(parsedUnitId);
          }
          setParseResult(parseRes);
          setParseStatus('done');
        } else if (parseRes.error) {
          setParseError(parseRes.error);
          setParseStatus('error');
        }

        if (parseRes.duplicate_check) {
          setDuplicateInfo(parseRes.duplicate_check);
        }
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.warn('[parse PDF] Lỗi phân tích văn bản');
        setParseError(err?.message || 'Không thể đọc PDF. Vui lòng nhập tay.');
        setParseStatus('error');
      })
      .finally(() => {
        clearTimeout(stageTimer);
        clearTimeout(timeoutTimer);
        setParsing(false);
      });
  }, [selectedFile, isEdit, types, units]);

  // ── Toàn bộ Khung Xem PDF Phải được Memoize Độc Lập ──
  // Khi người dùng gõ vào bất kỳ ô input nào (code, title, signer, v.v.), React KHÔNG BAO GIỜ re-render
  // hay xoá canvas của PdfPagesViewer, triệt tiêu 100% hiện tượng giật nháy (flicker).
  const memoizedPdfViewer = useMemo(() => {
    if (previewLoading) {
      return (
        <div className="flex flex-col items-center justify-center space-y-3 p-8 text-slate-600 dark:text-slate-300 my-auto select-none">
          <Loader2 className="w-9 h-9 animate-spin text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-semibold">Đang tải và chuẩn bị bản xem trước đối chiếu...</p>
          <p className="text-xs text-slate-500 font-mono">Đang đóng dấu Watermark bảo mật...</p>
        </div>
      );
    }

    if (previewError === 'BIOMETRIC_REQUIRED') {
      return (
        <div className="p-8 max-w-md mx-auto text-center space-y-4 bg-white dark:bg-slate-900/90 border border-amber-200 dark:border-amber-500/30 rounded-2xl shadow-xl my-auto">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-xs">
            <Fingerprint className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30">
              <Shield className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Văn bản Cấp {document?.security_level_id || 3} ({document?.security_name || 'Bảo mật'})
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white text-base">Yêu Cầu Xác Thực Sinh Trắc Học</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Văn bản có độ mật Cấp 3 trở lên. Vui lòng quét vân tay để mở và đối chiếu tệp PDF gốc lưu trữ trên hệ thống.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowScanModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-amber-950/20 transition cursor-pointer"
          >
            <Fingerprint className="w-4 h-4" />
            <span>Quét vân tay ngay</span>
          </button>
        </div>
      );
    }

    if (previewError && previewError !== 'BIOMETRIC_REQUIRED') {
      return (
        <div className="p-8 max-w-md mx-auto text-center space-y-4 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-500/30 rounded-2xl shadow-xl my-auto">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-slate-900 dark:text-white text-base">Không Thể Tải Bản Xem Trước</h4>
            <p className="text-xs text-rose-600 dark:text-rose-300 leading-relaxed">{previewError}</p>
          </div>
          {isEdit && (
            <button
              type="button"
              onClick={() => loadOriginalDocumentPdf(document?.file_id, fingerprintToken)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Thử tải lại</span>
            </button>
          )}
        </div>
      );
    }

    if (previewFileType === 'office') {
      return (
        <div className="p-8 max-w-md mx-auto text-center space-y-4 bg-white dark:bg-slate-900/90 border border-blue-200 dark:border-slate-800 rounded-2xl shadow-xl my-auto">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
            <FileText className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-900 dark:text-white text-base truncate max-w-xs mx-auto">
              {previewFileName}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Định dạng tài liệu văn phòng (Word / Excel). Tính năng xem trước đối chiếu thời gian thực áp dụng trực tiếp cho tệp PDF. Hệ thống vẫn lưu trữ và bóc tách dữ liệu tệp bình thường khi bạn lưu.
            </p>
          </div>
        </div>
      );
    }

    if (previewFileType === 'empty' || !previewUrl) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center my-auto select-none max-w-md mx-auto">
          <div className="w-24 h-24 rounded-3xl bg-white dark:bg-slate-900 border-2 border-dashed border-emerald-300 dark:border-emerald-700/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-6 shadow-xl shadow-slate-200/50 dark:shadow-none relative group">
            <FileText className="w-12 h-12 stroke-[1.6] text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform" />
            <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
            Khung Xem Trước Văn Bản Đối Chiếu
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
            Kéo thả file PDF vào khung bên trái để xem trước nội dung tại đây. Hệ thống hỗ trợ đối chiếu thông tin song song và bóc tách dữ liệu tức thì.
          </p>
          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              Watermark Động Trống Trải
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span>Hỗ trợ PDF đến 50MB</span>
          </div>
        </div>
      );
    }

    return (
      <div className="relative w-full h-full overflow-hidden flex flex-col items-center">
        <PdfPagesViewer
          blobUrl={previewUrl}
          fileId={
            document?.file_id ||
            (selectedFile ? `local_${selectedFile.name}` : 'preview_temp')
          }
          securityLevel={document?.security_level_id || 1}
          isHighlighterActive={false}
          highlighterColor="#facc15"
        />

        {/* Lớp Watermark Động Trống Trải (Sparse Dynamic Watermark) bổ trợ */}
        {!isWatermarkedOnBlob && (
          <DynamicWatermark
            customText={`${formatUserDisplayName(user?.full_name, user?.username)} - ${formatWatermarkDateTime(new Date())}`}
            targetOpacity={0.18}
          />
        )}
      </div>
    );
  }, [
    previewLoading,
    previewError,
    previewFileType,
    previewUrl,
    document?.file_id,
    document?.security_level_id,
    document?.original_name,
    document?.document_code,
    document?.security_name,
    selectedFile?.name,
    isWatermarkedOnBlob,
    previewFileName,
    isEdit,
    user?.full_name,
    user?.username,
    fingerprintToken,
    loadOriginalDocumentPdf,
  ]);

  if (!open) return null;

  // ── Kiểm tra điền đủ các trường bắt buộc ──
  const isFormValid = Boolean(
    (isEdit || selectedFile) &&
      code.trim() &&
      signer.trim() &&
      title.trim() &&
      typeId &&
      unitId &&
      securityLevel !== '' &&
      issueDate
  );

  const selectedType = types.find((t) => t.type_id === typeId);
  const selectedTypeName = selectedType ? selectedType.name : typeId;

  const selectedUnit = units.find((u) => u.unit_id === unitId);
  const selectedUnitName = selectedUnit ? selectedUnit.name : unitId;

  const selectedLevel = levels.find((l) => l.level_id === Number(securityLevel));
  const selectedSecurityLevelName = selectedLevel ? selectedLevel.name : '';

  const formatDateDisplay = (dStr: string) => {
    if (!dStr) return '—';
    try {
      const [y, m, d] = dStr.split('-');
      if (y && m && d) return `${d}/${m}/${y}`;
      return dStr;
    } catch {
      return dStr;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getSecurityBadgeClass = (name: string) => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('tuyệt mật')) {
      return 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30';
    }
    if (lower.includes('tối mật')) {
      return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25';
    }
    if (lower.includes('mật')) {
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
    }
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isFormValid) {
      setError('Vui lòng điền đầy đủ tất cả các trường dữ liệu bắt buộc (*)!');
      return;
    }

    setShowConfirmModal(true);
  };

  const executeSave = async () => {
    setError('');
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('proposal_note', proposalReason.trim() || 'Đề xuất chuẩn hóa thông tin văn bản');
      formData.append('note', proposalReason.trim() || 'Đề xuất chuẩn hóa thông tin văn bản');
      formData.append('document_code', code.trim());
      formData.append('title', title.trim());
      if (typeId) {
        formData.append('doc_type_id', typeId);
        formData.append('type_id', typeId);
      }
      if (unitId) {
        formData.append('issuing_unit_id', unitId);
        formData.append('unit_id', unitId);
      }
      if (securityLevel !== '') {
        formData.append('security_level_id', String(securityLevel));
      }
      if (signer) formData.append('signer', signer.trim());
      if (issueDate) {
        formData.append('issued_date', issueDate);
        formData.append('issue_date', issueDate);
      }
      if (summary) formData.append('summary', summary.trim());

      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      if (allowOverride) {
        formData.append('force_upload', '1');
      }

      const saveRes: any = await onSave(formData, isEdit);
      if (onToast && !saveRes?.pending_approval) {
        onToast(
          isEdit
            ? `Đã cập nhật văn bản ${code} thành công!`
            : `Đã tiếp nhận văn bản ${code} thành công!`,
          'success'
        );
      }
      setShowConfirmModal(false);
      onClose();
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('[DocumentUploadModal] Lỗi tiếp nhận văn bản');
      setError(err.message || 'Thao tác không thành công, vui lòng thử lại!');
      setShowConfirmModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        key="split-pane-digitization-modal"
        className="fixed inset-0 z-50 flex h-screen w-screen bg-slate-950/70 dark:bg-black/80 backdrop-blur-sm overflow-hidden select-none transition-colors"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.99 }}
          transition={{ duration: 0.18 }}
          className="grid grid-cols-12 h-full w-full bg-white dark:bg-slate-900 overflow-hidden"
        >
          {/* ══════════════════════════════════════════════════════════════════════
              KHUNG BÊN TRÁI: FORM NHẬP LIỆU & ĐỐI CHIẾU (35% - 40% width)
              - Light mode: Nền sáng tinh tế, viền phân cách rõ nét
              - Thanh cuộn dọc độc lập: overflow-y-auto
          ══════════════════════════════════════════════════════════════════════ */}
          <div
            className={`col-span-12 lg:col-span-5 xl:col-span-4 2xl:col-span-4 flex-col h-full bg-slate-50/40 dark:bg-slate-900 border-r border-slate-200/90 dark:border-slate-800 z-10 shadow-lg lg:shadow-none overflow-hidden ${
              activeMobileTab === 'preview' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Header Form Trái */}
            <div className="p-4 sm:p-5 border-b border-slate-200/90 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900/95 shadow-2xs">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200/90 dark:from-emerald-950/40 dark:to-emerald-900/20 dark:border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0 shadow-xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                      {isEdit ? 'Hiệu Chỉnh Văn Bản' : 'Tiếp Nhận & Lưu Trữ Văn Bản Mới'}
                    </h3>
                    <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/90 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30 shrink-0">
                      {isEdit ? 'Hiệu chỉnh' : 'Số hóa'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium">
                    {isEdit
                      ? `Mã tệp: ${document?.file_id}`
                      : 'Điền đầy đủ thông tin định danh & bảo mật đối chiếu'}
                  </p>
                </div>
              </div>

              {/* Mobile Controls (Chỉ hiển thị trên màn hình nhỏ < lg) */}
              <div className="lg:hidden flex items-center space-x-1.5 shrink-0">
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setActiveMobileTab('form')}
                    className={`px-2 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                      activeMobileTab === 'form'
                        ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Biểu mẫu
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMobileTab('preview')}
                    className={`px-2 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                      activeMobileTab === 'preview'
                        ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Xem PDF {selectedFile || isEdit ? '•' : ''}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Đóng (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Form Body: Cuộn độc lập không ảnh hưởng PDF bên phải */}
            <form
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6 space-y-4 text-xs select-text bg-white dark:bg-slate-900"
              style={{ scrollbarWidth: 'thin' }}
            >
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-400 font-medium flex items-start gap-2 shadow-2xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Dropzone Kéo/Thả Tệp */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
                  Tệp văn bản{' '}
                  {isEdit ? (
                    <span className="text-slate-400 font-normal">(Chọn tệp mới nếu muốn thay thế tệp cũ)</span>
                  ) : (
                    <span className="text-rose-500 font-bold">*</span>
                  )}
                </label>
                <Dropzone selectedFile={selectedFile} onFileSelect={setSelectedFile} />
              </div>

              {/* Trạng thái Auto-parse PDF & Trích xuất AI */}
              {!parsing && parseResult && !parseError && (() => {
                const filled = Object.values(parseResult.parsed).filter(
                  (v) => v !== null && v !== undefined && String(v).trim() !== ''
                ).length;
                return (
                  <div className="p-3 bg-emerald-50/90 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs space-y-1 shadow-2xs">
                    <div className="flex items-center gap-2 font-semibold">
                      <Sparkles className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        Đã tự động điền {filled} trường
                        {parseResult.usedOcr && ' (đã dùng OCR cho số ẩn)'}
                      </span>
                    </div>
                    <div className="text-[11px] text-emerald-700/85 dark:text-emerald-300/85">
                      Vui lòng đối chiếu với trang PDF bên phải trước khi lưu. Bạn có thể chỉnh sửa bất kỳ trường nào.
                    </div>
                  </div>
                );
              })()}

              {parsing && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 rounded-xl text-blue-800 dark:text-blue-300 text-xs shadow-2xs">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0 text-blue-600 dark:text-blue-400" />
                    <span className="font-medium">
                      {parseStatus === 'classifying' && 'Đang phân tích cấu trúc PDF...'}
                      {parseStatus === 'ocr_processing' && 'Đang nhận dạng ký tự quang học (có thể mất vài giây)...'}
                      {parseStatus === 'extracting' && 'Đang trích xuất dữ liệu văn bản...'}
                      {!['classifying', 'ocr_processing', 'extracting'].includes(parseStatus) &&
                        'Đang đọc nội dung PDF và điền form...'}
                    </span>
                  </div>

                  {parseTimeoutWarning && (
                    <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30 rounded-xl text-amber-800 dark:text-amber-300 text-xs shadow-2xs">
                      <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                      <div>
                        <span className="italic text-[11px] text-amber-700 dark:text-amber-300">
                          Hệ thống đang xử lý văn bản scan phức tạp, vui lòng đợi trong giây lát...
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!parsing && parseError && (
                <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30 rounded-xl text-amber-800 dark:text-amber-300 text-xs shadow-2xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Không tự động đọc được PDF: {parseError}. Vui lòng nhập thông tin thủ công.</span>
                </div>
              )}

              {!parsing && duplicateInfo?.sha_duplicate && (
                <div className="p-3 bg-rose-50 border border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30 rounded-xl space-y-2 shadow-2xs">
                  <div className="flex items-center gap-2 font-semibold text-rose-800 dark:text-rose-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>File này đã tồn tại trong hệ thống (SHA-256 trùng)</span>
                  </div>
                  <div className="text-[11px] text-rose-700 dark:text-rose-400 space-y-1 pl-6">
                    {duplicateInfo.matches.by_sha256.slice(0, 3).map((d) => (
                      <div key={d.file_id}>
                        • <span className="font-mono font-medium">{d.document_code || d.file_id}</span> — {d.title}
                      </div>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-[11px] text-rose-800 dark:text-rose-300 cursor-pointer pt-1 pl-6 font-medium">
                    <input
                      type="checkbox"
                      checked={allowOverride}
                      onChange={(e) => setAllowOverride(e.target.checked)}
                      className="cursor-pointer"
                    />
                    <span>Tôi muốn ghi đè — vẫn lưu file này (tạo bản ghi mới)</span>
                  </label>
                </div>
              )}

              {!parsing && !duplicateInfo?.sha_duplicate && duplicateInfo?.code_duplicate && (
                <div className="p-3 bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30 rounded-xl space-y-2 shadow-2xs">
                  <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Cảnh báo: Số hiệu văn bản đã tồn tại</span>
                  </div>
                  <div className="text-[11px] text-amber-800 dark:text-amber-400 space-y-1 pl-6">
                    {duplicateInfo.matches.by_code.slice(0, 3).map((d) => (
                      <div key={d.file_id}>
                        • <span className="font-mono font-medium">{d.document_code}</span> — {d.title}
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 pl-6">
                    Vẫn có thể lưu nếu đây là văn bản sửa đổi / đính chính.
                  </div>
                </div>
              )}

              {/* Khối Input: Số hiệu & Người ký */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Số hiệu / Ký hiệu văn bản <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Ví dụ: 125/QĐ-QK7"
                    className="w-full px-3 py-2 bg-slate-50/70 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 shadow-2xs transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Người ký ban hành <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={signer}
                    onChange={(e) => setSigner(e.target.value)}
                    placeholder="Họ tên, chức danh người ký..."
                    className="w-full px-3 py-2 bg-slate-50/70 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 shadow-2xs transition-colors"
                  />
                </div>
              </div>

              {/* Trích yếu nội dung văn bản */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Trích yếu nội dung văn bản <span className="text-rose-500 font-bold">*</span>
                </label>
                <textarea
                  rows={2}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Về việc chỉ đạo triển khai kế hoạch bảo đảm an toàn..."
                  className="w-full px-3 py-2 bg-slate-50/70 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 resize-none leading-relaxed shadow-2xs transition-colors"
                />
              </div>

              {/* Khối Input: Loại văn bản & Độ mật bảo quản */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Loại văn bản <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <select
                    value={typeId}
                    onChange={(e) => setTypeId(e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-50/70 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 transition-colors shadow-2xs ${
                      typeId ? 'text-slate-900 dark:text-slate-100 font-medium' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    <option value="" className="text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900">
                      Chọn loại văn bản
                    </option>
                    {types.map((t) => (
                      <option
                        key={t.type_id}
                        value={t.type_id}
                        className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900"
                      >
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Độ mật bảo quản <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <select
                    value={securityLevel}
                    onChange={(e) => setSecurityLevel(e.target.value ? Number(e.target.value) : '')}
                    className={`w-full px-3 py-2 bg-slate-50/70 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 transition-colors shadow-2xs ${
                      securityLevel !== '' ? 'text-slate-900 dark:text-slate-100 font-medium' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    <option value="" className="text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900">
                      Chọn độ mật
                    </option>
                    {levels.map((lvl) => (
                      <option
                        key={lvl.level_id}
                        value={lvl.level_id}
                        className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900"
                      >
                        {lvl.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Đơn vị ban hành (TreeSelect) */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Đơn vị ban hành <span className="text-rose-500 font-bold">*</span>
                </label>
                <div className="unit-treeselect-wrapper" style={{ position: 'relative', width: '100%' }}>
                  <TreeSelect
                    value={unitId || undefined}
                    onChange={(val) => setUnitId(val || '')}
                    treeData={unitTree}
                    placeholder="Chọn đơn vị ban hành"
                    allowClear
                    treeExpandedKeys={treeExpandedKeys}
                    onTreeExpand={(keys) => setTreeExpandedKeys(keys as string[])}
                    onOpenChange={(visible) => {
                      if (visible && rootUnitKeys.length > 0) {
                        setTreeExpandedKeys(rootUnitKeys);
                      }
                    }}
                    treeLine={{ showLeafIcon: false }}
                    switcherIcon={(nodeProps: any) => {
                      if (nodeProps.isLeaf) return null;
                      const isExpanded = Boolean(nodeProps.expanded);
                      return (
                        <span
                          className={`qk7-tree-switcher-btn ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}
                          title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                        >
                          {isExpanded ? (
                            <Minus className="w-3 h-3 stroke-[2.5]" />
                          ) : (
                            <Plus className="w-3 h-3 stroke-[2.5]" />
                          )}
                        </span>
                      );
                    }}
                    treeNodeLabelProp="name"
                    treeNodeFilterProp="name"
                    filterTreeNode={(input: string, node: any) =>
                      String(node.name || '').toLowerCase().includes(input.toLowerCase().trim())
                    }
                    getPopupContainer={(trigger) => (trigger.parentElement as HTMLElement) || window.document.body}
                    className="qk7-treeselect w-full"
                    classNames={{ popup: { root: 'qk7-unit-treeselect-popup' } }}
                    style={{ width: '100%', height: 38 }}
                    popupMatchSelectWidth={false}
                    styles={{
                      popup: {
                        root: {
                          minWidth: 280,
                          maxWidth: 'min(520px, 90vw)',
                          maxHeight: 380,
                          overflowX: 'hidden',
                          overflowY: 'auto',
                        },
                      },
                    }}
                  />
                </div>
              </div>

              {/* Ngày ban hành & Tóm tắt ghi chú */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Ngày ban hành <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-50/70 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 transition-colors shadow-2xs ${
                      issueDate ? 'text-slate-900 dark:text-slate-100 font-medium' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Tóm tắt ghi chú <span className="text-slate-400 font-normal text-[11px]">(tùy chọn)</span>
                  </label>
                  <input
                    type="text"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Ghi chú thêm về văn bản..."
                    className="w-full px-3 py-2 bg-slate-50/70 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 shadow-2xs transition-colors"
                  />
                </div>
              </div>
            </form>

            {/* Sticky Footer Form Trái */}
            <div className="p-4 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 backdrop-blur-sm flex items-center justify-between gap-3 shrink-0 shadow-2xs">
              <div className="min-w-0">
                {!isFormValid && (
                  <span className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5 font-medium truncate">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    <span className="truncate">Chưa điền đủ thông tin bắt buộc (*)</span>
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer shadow-2xs"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isFormValid || submitting || (duplicateInfo?.sha_duplicate && !allowOverride)}
                  className={`px-4 py-2 font-bold text-xs rounded-xl flex items-center gap-1.5 transition ${
                    isFormValid
                      ? 'bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] hover:from-[#166534] hover:to-[#15803d] text-white cursor-pointer shadow-md shadow-emerald-950/20 border border-amber-500/25'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700/60 cursor-not-allowed shadow-none'
                  }`}
                  title={!isFormValid ? 'Vui lòng điền đầy đủ các thông tin bắt buộc (*)' : undefined}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang xử lý...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>{isEdit ? 'Cập nhật văn bản' : 'Lưu trữ văn bản'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════════
              KHUNG BÊN PHẢI: PDF VIEWER ĐỐI CHIẾU THỜI GIAN THỰC (60% - 65% width)
              - Light mode: Nền slate-100 tinh tế, nổi bật trang giấy trắng
              - Nút X (Đóng) to rõ ràng đặt tại góc trên cùng bên phải
              - Thanh cuộn dọc độc lập: cuộn form trái không làm trôi PDF phải
          ══════════════════════════════════════════════════════════════════════ */}
          <div
            className={`col-span-12 lg:col-span-7 xl:col-span-8 2xl:col-span-8 flex-col h-full relative bg-slate-100 dark:bg-[#070b12] overflow-hidden transition-colors ${
              activeMobileTab === 'form' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Top Bar Khung PDF Phải: Sáng thanh lịch ở Light Mode, Đậm chất ở Dark Mode */}
            <div className="p-3 sm:p-4 border-b border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-950/90 backdrop-blur-sm flex items-center justify-between shrink-0 text-slate-800 dark:text-white z-20 shadow-2xs">
              <div className="flex items-center space-x-3 overflow-hidden min-w-0 flex-1 mr-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0 shadow-2xs">
                  <Eye className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                      {previewFileName || (isEdit ? document?.original_name || `${code || 'Văn bản'}.pdf` : 'Khung Xem Trước Đối Chiếu')}
                    </span>
                    {selectedFile && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30 whitespace-nowrap shrink-0">
                        ⚡ Local Preview tức thì
                      </span>
                    )}
                    {!selectedFile && isEdit && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30 whitespace-nowrap shrink-0">
                        Văn bản gốc máy chủ
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {previewFileType === 'pdf'
                      ? 'Đối chiếu thời gian thực • Sparse Dynamic Watermark tự động kích hoạt'
                      : 'Hỗ trợ hiển thị trực quan dữ liệu đối chiếu'}
                  </p>
                </div>
              </div>

              {/* Góc Trên Phải: Nút X (Đóng) to rõ ràng thay thế hoàn toàn vị trí của bút dạ quang */}
              <div className="flex items-center space-x-2 shrink-0">
                {/* Mobile Button: Quay về Form nhập liệu trên mobile */}
                <button
                  type="button"
                  onClick={() => setActiveMobileTab('form')}
                  className="lg:hidden px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Về biểu mẫu
                </button>

                {/* ❌ Nút Đóng (X) To, Đẹp & Trực Quan tại vị trí góc trên cùng bên phải */}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 transition cursor-pointer flex items-center justify-center group shadow-2xs"
                  title="Đóng (Esc)"
                  aria-label="Đóng (Esc)"
                >
                  <X className="w-5 h-5 group-hover:scale-110 transition-transform text-slate-600 dark:text-slate-300" />
                </button>
              </div>
            </div>

            {/* Nội dung Trình Xem PDF Phải — Render qua memoized node hoàn toàn không giật nháy */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-[#070b12] transition-colors">
              {memoizedPdfViewer}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Modal Xác Nhận Dữ Liệu Trước Khi Lưu Chính Thức ── */}
      {showConfirmModal && (
        <div
          key="confirm-modal"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] transition-colors duration-200"
          >
            {/* Header xác nhận */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/70">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Xác Nhận Dữ Liệu Văn Bản
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Vui lòng rà soát kỹ các trường dữ liệu trước khi lưu trữ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nội dung đối soát dữ liệu */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs select-text">
              {/* Card tệp đính kèm */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Tệp văn bản đính kèm
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {selectedFile ? selectedFile.name : document?.original_name || 'Tệp hiện tại'}
                  </div>
                  {selectedFile && (
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Dung lượng: {formatFileSize(selectedFile.size)}
                    </div>
                  )}
                </div>
              </div>

              {/* Bảng chi tiết thông tin */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950/40">
                <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Số hiệu / Ký hiệu:</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                    {code.trim()}
                  </span>
                </div>

                <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Người ký ban hành:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {signer.trim()}
                  </span>
                </div>

                <div className="p-3 sm:px-4 flex flex-col gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Trích yếu nội dung:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs leading-relaxed">
                    {title.trim()}
                  </span>
                </div>

                <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Loại văn bản:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedTypeName || '—'}
                  </span>
                </div>

                <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Đơn vị ban hành:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-right sm:max-w-[65%]">
                    {selectedUnitName || '—'}
                  </span>
                </div>

                <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Độ mật bảo quản:</span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getSecurityBadgeClass(
                      selectedSecurityLevelName
                    )}`}
                  >
                    {selectedSecurityLevelName || '—'}
                  </span>
                </div>

                <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Ngày ban hành:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatDateDisplay(issueDate)}
                  </span>
                </div>

                {summary.trim() && (
                  <div className="p-3 sm:px-4 flex flex-col gap-1">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Ghi chú:</span>
                    <span className="text-slate-700 dark:text-slate-300 italic">{summary.trim()}</span>
                  </div>
                )}
              </div>

              {/* Lý do đề xuất chỉnh sửa văn bản (chế độ sửa) */}
              {isEdit && (
                <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      Lý do đề xuất chỉnh sửa văn bản:
                    </label>
                    <span className="text-[10px] text-slate-500 italic">Có thể giữ nguyên hoặc sửa lại</span>
                  </div>
                  <textarea
                    value={proposalReason}
                    onChange={(e) => setProposalReason(e.target.value)}
                    rows={2}
                    placeholder="Nhập lý do đề xuất chỉnh sửa văn bản..."
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/60 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 leading-relaxed font-sans"
                  />
                </div>
              )}
            </div>

            {/* Footer hành động xác nhận */}
            <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Quay lại chỉnh sửa</span>
              </button>
              <button
                type="button"
                onClick={executeSave}
                disabled={submitting}
                className="px-4 py-2 bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] hover:from-[#166534] hover:to-[#15803d] text-white font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-950/20 border border-amber-500/25 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang lưu trữ...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isEdit ? 'Xác nhận & Cập nhật' : 'Xác nhận & Lưu trữ'}</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Modal Quét Vân Tay Xác Thực Cho Cấp 3+ Trong Chế Độ Sửa ── */}
      <FingerprintScanModal
        key="fingerprint-scan-modal-upload"
        open={showScanModal}
        fileId={document?.file_id || ''}
        onSuccess={(token) => {
          setShowScanModal(false);
          const validToken = token || '';
          setFingerprintToken(validToken || null);
          if (validToken && document?.file_id && typeof window !== 'undefined') {
            try {
              sessionStorage.setItem(`qk7_fp_token_${document.file_id}`, validToken);
            } catch (e) {}
          }
          if (document) {
            loadOriginalDocumentPdf(document.file_id, validToken || null);
          }
        }}
        onCancel={() => {
          setShowScanModal(false);
        }}
      />
    </AnimatePresence>
  );
};

// Export alias để hỗ trợ nếu có component gọi tên DocumentEditModal
export const DocumentEditModal = DocumentUploadModal;
