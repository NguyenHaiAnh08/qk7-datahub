import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Clock,
  FileText,
  Building,
  Shield,
  MinusCircle,
  PlusCircle,
  Check,
  Send,
  AlertCircle,
  Loader2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  FileCheck,
  FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { isUserAdmin } from '../../contexts/AuthContext';
import { toast } from '../common/Toast';

export interface DiffProposalData {
  proposal_id: string;
  file_id: string;
  document_code?: string;
  title: string;
  doc_type_id?: string;
  issued_date?: string;
  issuing_unit_id?: string;
  issuing_unit_name?: string;
  signer?: string;
  summary?: string;
  security_level_id: number;
  security_level_name?: string;
  current_document_code?: string;
  current_title: string;
  current_signer?: string;
  current_security_level_id: number;
  current_security_name?: string;
  current_unit_name?: string;
  current_issued_date?: string;
  document_issuing_unit_id?: string;
  new_stored_path?: string;
  new_original_name?: string;
  new_file_size?: number;
  deleted_reason?: string;
  is_new_upload?: boolean;
  note?: string;
  requester_id: string;
  requester_name: string;
  requester_rank?: string;
  requester_position?: string;
  requester_unit_id?: string;
  requester_unit_name?: string;
  created_at: string;
}

export interface ApprovalDiffModalProps {
  open: boolean;
  proposal: DiffProposalData | null;
  /** Danh sách hàng đợi đề xuất phục vụ chuyển duyệt liên hoàn */
  proposals?: DiffProposalData[];
  /** Vị trí hiện tại trong hàng đợi */
  currentIndex?: number;
  /** Callback chuyển vị trí hồ sơ trong hàng đợi */
  onNavigate?: (newIndex: number) => void;
  onClose: () => void;
  onApprove: (proposalId: string, note?: string) => Promise<void>;
  onReject: (proposalId: string, reason: string) => Promise<void>;
  isProcessing?: boolean;
}

/** Helper lấy 2 chữ cái viết tắt của tên để làm Avatar */
export const getInitials = (name?: string): string => {
  if (!name || !name.trim()) return 'CB';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CB';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const penult = parts[parts.length - 2];
  const last = parts[parts.length - 1];
  return (penult.charAt(0) + last.charAt(0)).toUpperCase();
};

/** Các chip chọn nhanh lý do từ chối 1 chạm chuẩn quân sự */
const REJECT_QUICK_CHIPS = [
  'Thông tin trích yếu chưa chuẩn',
  'Sai số hiệu văn bản',
  'Chưa đủ căn cứ đổi độ mật',
  'Đề nghị bổ sung thêm tài liệu căn cứ',
  'Đơn vị ban hành không khớp',
];

export const ApprovalDiffModal: React.FC<ApprovalDiffModalProps> = ({
  open,
  proposal,
  proposals,
  currentIndex,
  onNavigate,
  onClose,
  onApprove,
  onReject,
  isProcessing = false,
}) => {
  const { user } = useAuth();

  // Danh sách hàng đợi duyệt liên hoàn
  const queueList = useMemo(() => {
    if (proposals && proposals.length > 0) return proposals;
    if (proposal) return [proposal];
    return [];
  }, [proposals, proposal]);

  // Quản lý vị trí hiện tại (đồng bộ giữa controlled và local state)
  const [localIndex, setLocalIndex] = useState(0);

  useEffect(() => {
    if (typeof currentIndex === 'number' && currentIndex >= 0) {
      setLocalIndex(currentIndex);
    } else if (proposal && queueList.length > 0) {
      const idx = queueList.findIndex((p) => p.proposal_id === proposal.proposal_id);
      if (idx >= 0) setLocalIndex(idx);
    }
  }, [currentIndex, proposal, queueList]);

  const activeIndex = typeof currentIndex === 'number' && onNavigate ? currentIndex : localIndex;
  const activeProposal = queueList[activeIndex] || proposal;

  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [onlyChanged, setOnlyChanged] = useState(false);

  // Khóa cuộn trang nền và lắng nghe phím ESC
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, isProcessing, onClose]);

  // Điều hướng chuyển hồ sơ liên hoàn
  const handlePrev = useCallback(() => {
    if (activeIndex > 0) {
      const nextIdx = activeIndex - 1;
      if (onNavigate) {
        onNavigate(nextIdx);
      } else {
        setLocalIndex(nextIdx);
      }
      setIsRejecting(false);
      setRejectReason('');
    }
  }, [activeIndex, onNavigate]);

  const handleNext = useCallback(() => {
    if (activeIndex < queueList.length - 1) {
      const nextIdx = activeIndex + 1;
      if (onNavigate) {
        onNavigate(nextIdx);
      } else {
        setLocalIndex(nextIdx);
      }
      setIsRejecting(false);
      setRejectReason('');
    }
  }, [activeIndex, queueList.length, onNavigate]);

  if (!open || !activeProposal) return null;

  // Xác định thẩm quyền người đang đăng nhập
  const isAdminRole =
    isUserAdmin(user) ||
    user?.user_id === 'USR-001' ||
    (user?.roles || []).some(
      (r) => String(r).toUpperCase() === 'ROL-01' || String(r).toLowerCase() === 'admin'
    );

  const pos = (user?.position || '').toLowerCase();
  const isCommanderRole =
    (user?.roles || []).some((r) => String(r).toUpperCase() === 'ROL-02') ||
    (user?.role_names || []).some((r) => {
      const s = String(r).toLowerCase();
      return (
        s.includes('chỉ huy') ||
        s.includes('trưởng phòng') ||
        s.includes('thủ trưởng') ||
        s.includes('chủ nhiệm')
      );
    }) ||
    pos.includes('chỉ huy') ||
    pos.includes('trưởng phòng') ||
    pos.includes('thủ trưởng') ||
    pos.includes('chủ nhiệm') ||
    (user?.permissions || []).includes('APPROVAL_VALIDATE');

  const canApprove = isAdminRole || isCommanderRole;

  // Kiểm tra tài liệu nội bộ phòng
  const isInternalUnit = Boolean(
    user?.unit_id &&
      (activeProposal.issuing_unit_id === user.unit_id ||
        activeProposal.document_issuing_unit_id === user.unit_id ||
        activeProposal.requester_unit_id === user.unit_id)
  );

  const isSelfRequest = activeProposal.requester_id === user?.user_id;
  const blockSelfApprove = isSelfRequest && !canApprove;

  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      toast.warning('Vui lòng nhập lý do từ chối yêu cầu.');
      return;
    }
    const currentId = activeProposal.proposal_id;
    const reasonToSend = rejectReason.trim();
    await onReject(currentId, reasonToSend);
    setIsRejecting(false);
    setRejectReason('');

    // Tự động chuyển tiếp hồ sơ tiếp theo nếu còn
    if (queueList.length > 1) {
      if (activeIndex < queueList.length - 1) {
        handleNext();
      } else if (activeIndex > 0) {
        handlePrev();
      }
    }
  };

  const handleQuickApprove = async () => {
    const currentId = activeProposal.proposal_id;
    await onApprove(
      currentId,
      isCommanderRole
        ? 'Chỉ huy cấp Phòng đã phê duyệt & chuẩn hóa'
        : 'Quản trị viên đã phê duyệt & áp dụng'
    );

    // Tự động chuyển tiếp hồ sơ tiếp theo nếu còn
    if (queueList.length > 1) {
      if (activeIndex < queueList.length - 1) {
        handleNext();
      } else if (activeIndex > 0) {
        handlePrev();
      }
    }
  };

  const handleSelectQuickChip = (chip: string) => {
    if (!rejectReason.trim()) {
      setRejectReason(chip);
    } else if (!rejectReason.includes(chip)) {
      setRejectReason((prev) => `${prev}. ${chip}`);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // SO SÁNH DỮ LIỆU ĐỐI CHIẾU SIDE-BY-SIDE
  // ─────────────────────────────────────────────────────────────
  const isNewUpload = Boolean(
    activeProposal.is_new_upload ||
    activeProposal.deleted_reason === 'PENDING_APPROVAL' ||
    activeProposal.note?.includes('Đăng tải')
  );

  const diffFields = [
    {
      label: 'Số hiệu / Ký hiệu văn bản',
      oldValue: isNewUpload ? '(Văn bản mới)' : (activeProposal.current_document_code || '—'),
      newValue: activeProposal.document_code || activeProposal.current_document_code || '—',
      hasChanged: isNewUpload || (
        Boolean(activeProposal.document_code) &&
        activeProposal.document_code !== activeProposal.current_document_code
      ),
      isMono: true,
    },
    {
      label: 'Trích yếu nội dung văn bản',
      oldValue: isNewUpload ? '(Văn bản mới)' : (activeProposal.current_title || '—'),
      newValue: activeProposal.title || '—',
      hasChanged: isNewUpload || (activeProposal.title?.trim() !== activeProposal.current_title?.trim()),
      isMono: false,
    },
    {
      label: 'Đơn vị ban hành',
      oldValue: isNewUpload ? '(Chưa có)' : (activeProposal.current_unit_name || '—'),
      newValue: activeProposal.issuing_unit_name || activeProposal.current_unit_name || '—',
      hasChanged: isNewUpload || (
        Boolean(activeProposal.issuing_unit_name) &&
        activeProposal.issuing_unit_name !== activeProposal.current_unit_name
      ),
      isMono: false,
    },
    {
      label: 'Người ký ban hành',
      oldValue: isNewUpload ? '(Chưa có)' : (activeProposal.current_signer || '—'),
      newValue: activeProposal.signer || activeProposal.current_signer || '—',
      hasChanged: isNewUpload || (
        Boolean(activeProposal.signer) && activeProposal.signer !== activeProposal.current_signer
      ),
      isMono: false,
    },
    {
      label: 'Cấp độ bảo mật (Độ mật)',
      oldValue: isNewUpload ? '(Chưa có)' : (
        activeProposal.current_security_name ||
        `Cấp ${activeProposal.current_security_level_id}`
      ),
      newValue:
        activeProposal.security_level_name || `Cấp ${activeProposal.security_level_id}`,
      hasChanged: isNewUpload || (
        activeProposal.security_level_id !== activeProposal.current_security_level_id
      ),
      isMono: false,
    },
    {
      label: 'Ngày ban hành',
      oldValue: isNewUpload ? '(Chưa có)' : (activeProposal.current_issued_date
        ? new Date(activeProposal.current_issued_date).toLocaleDateString('vi-VN')
        : '—'),
      newValue: activeProposal.issued_date
        ? new Date(activeProposal.issued_date).toLocaleDateString('vi-VN')
        : activeProposal.current_issued_date
        ? new Date(activeProposal.current_issued_date).toLocaleDateString('vi-VN')
        : '—',
      hasChanged: isNewUpload || (
        Boolean(activeProposal.issued_date) &&
        activeProposal.issued_date !== activeProposal.current_issued_date
      ),
      isMono: false,
    },
  ];

  const changedCount = diffFields.filter((f) => f.hasChanged).length;
  const visibleFields = onlyChanged ? diffFields.filter((f) => f.hasChanged) : diffFields;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden font-sans">
        {/* ========================================================= */}
        {/* BACKDROP LỚP PHỦ MỜ TẬP TRUNG SỰ CHÚ Ý                   */}
        {/* ========================================================= */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={() => !isProcessing && onClose()}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm cursor-pointer"
        />

        {/* ========================================================= */}
        {/* ULTRA-WIDE SLIDE-OVER DRAWER (85% - 90% MÀN HÌNH)         */}
        {/* ========================================================= */}
        <div className="fixed inset-y-0 right-0 z-50 flex max-w-full pointer-events-none">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
            className="pointer-events-auto w-screen lg:w-[88vw] xl:w-[85vw] max-w-[1440px] h-screen bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
          >
            {/* ========================================================= */}
            {/* STICKY HEADER: TIÊU ĐỀ + MÃ + QUEUE SWITCHER             */}
            {/* ========================================================= */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-950/80 backdrop-blur-md shrink-0 z-20">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                      {isNewUpload ? 'Phê Duyệt Đăng Tải Văn Bản Mới' : 'Kiểm Duyệt Yêu Cầu Chỉnh Sửa'}
                    </h2>
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border border-slate-300 dark:border-slate-700">
                      {activeProposal.proposal_id}
                    </span>

                    {/* BADGE PHÂN CẤP THẨM QUYỀN DUYỆT */}
                    {isCommanderRole ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40 shadow-xs flex items-center gap-1">
                        <Shield className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        Thẩm quyền duyệt: Chỉ huy cấp Phòng
                      </span>
                    ) : isAdminRole ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/40 shadow-xs flex items-center gap-1">
                        <Shield className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                        Thẩm quyền duyệt: Quản trị viên
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        Chờ Chỉ huy / Admin duyệt
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Đối chiếu trực quan dữ liệu hiện tại với dữ liệu đề xuất theo chuẩn quân sự
                  </p>
                </div>
              </div>

              {/* BỘ CHUYỂN YÊU CẦU LIÊN HOÀN (CONTINUOUS QUEUE SWITCHER) & NÚT ĐÓNG */}
              <div className="flex items-center gap-3 shrink-0 ml-4">
                {queueList.length > 1 && (
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs shadow-xs">
                    <button
                      type="button"
                      onClick={handlePrev}
                      disabled={activeIndex <= 0 || isProcessing}
                      className="px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700"
                      title="Hồ sơ trước đó (Phím [)"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Trước</span>
                    </button>
                    <span className="px-3 py-1 font-mono font-semibold text-slate-600 dark:text-slate-300 select-none">
                      Hồ sơ {activeIndex + 1} / {queueList.length}
                    </span>
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={activeIndex >= queueList.length - 1 || isProcessing}
                      className="px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700"
                      title="Hồ sơ tiếp theo (Phím ])"
                    >
                      <span className="hidden sm:inline">Tiếp</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProcessing}
                  className="p-2.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
                  title="Đóng khung duyệt (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* ========================================================= */}
            {/* DRAWER BODY: 1 LUỒNG DỌC TỪ TRÊN XUỐNG DƯỚI (NO SPLIT)   */}
            {/* ========================================================= */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 bg-slate-50/50 dark:bg-slate-950/20">
              {/* 1. KHUNG THÔNG TIN CÁN BỘ ĐỀ XUẤT */}
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-600 to-teal-800 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-md shadow-emerald-950/20 border-2 border-white dark:border-slate-800">
                    {getInitials(activeProposal.requester_name)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        {activeProposal.requester_name || 'Cán bộ đề xuất'}
                      </span>
                      {activeProposal.requester_rank && (
                        <span className="text-xs text-slate-500 font-medium">
                          ({activeProposal.requester_rank})
                        </span>
                      )}
                      {isInternalUnit && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 flex items-center gap-1">
                          <Building className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                          Tài liệu nội bộ phòng
                        </span>
                      )}
                      {isSelfRequest && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                          Hồ sơ của bạn
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-4 flex-wrap">
                      <span>
                        Chức vụ: <strong className="text-slate-700 dark:text-slate-300">{activeProposal.requester_position || 'Cán bộ nghiệp vụ'}</strong>
                      </span>
                      {(activeProposal.requester_unit_name || activeProposal.current_unit_name || activeProposal.issuing_unit_name) && (
                        <span>
                          Đơn vị: <strong className="text-slate-700 dark:text-slate-300">{activeProposal.requester_unit_name || activeProposal.current_unit_name || activeProposal.issuing_unit_name}</strong>
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        {activeProposal.created_at && !isNaN(new Date(activeProposal.created_at).getTime())
                          ? new Date(activeProposal.created_at).toLocaleString('vi-VN')
                          : 'Mới gửi'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                  <span className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                    Chờ duyệt
                  </span>
                </div>
              </div>

              {/* 2. THANH TIÊU ĐỀ BẢNG ĐỐI CHIẾU */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Đối Chiếu Dữ Liệu Chuẩn Hóa
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        changedCount > 0
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      {changedCount > 0 ? `Phát hiện ${changedCount} trường thay đổi` : 'Dữ liệu đồng nhất'}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs flex-wrap">
                    {/* Nút gạt lọc nhanh */}
                    <button
                      type="button"
                      onClick={() => setOnlyChanged((prev) => !prev)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                        onlyChanged
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 shadow-xs'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      <span>Chỉ hiện trường thay đổi</span>
                    </button>

                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 font-semibold">
                        <MinusCircle className="w-3.5 h-3.5" /> Dữ liệu cũ (bị sửa)
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                        <PlusCircle className="w-3.5 h-3.5" /> Dữ liệu mới (đề xuất)
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. BẢNG SIDE-BY-SIDE 3 CỘT (ZERO-TRUNCATION, FULL-WIDTH) */}
                <div className="w-full border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs bg-white dark:bg-slate-900">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] sm:text-xs uppercase font-bold tracking-wider">
                        <th className="w-[22%] min-w-[200px] px-5 py-3.5 bg-slate-100/70 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400">
                          Trường thông tin
                        </th>
                        <th className="w-[39%] px-5 py-3.5 bg-red-50/50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-l border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-1.5">
                            <MinusCircle className="w-3.5 h-3.5" />
                            <span>Dữ liệu hiện tại / Bản cũ</span>
                          </div>
                        </th>
                        <th className="w-[39%] px-5 py-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-l border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-1.5">
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>Dữ liệu đề xuất / Bản mới</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {visibleFields.map((field, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          {/* Cột 1: Trường thông tin */}
                          <td className="w-[22%] min-w-[200px] p-4 sm:p-5 align-top bg-slate-50/40 dark:bg-slate-900/40 font-semibold text-xs text-slate-700 dark:text-slate-300">
                            <div className="flex items-start gap-2">
                              <span className="leading-relaxed">{field.label}</span>
                              {field.hasChanged && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0 mt-0.5">
                                  ĐÃ SỬA
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Cột 2: Dữ liệu hiện tại / Bản cũ */}
                          <td
                            className={`w-[39%] p-4 sm:p-5 align-top border-l border-slate-200 dark:border-slate-800 text-xs sm:text-sm whitespace-normal break-words leading-relaxed ${
                              field.hasChanged
                                ? 'bg-red-500/[0.06] dark:bg-red-500/[0.12] text-red-600 dark:text-red-400 line-through font-medium'
                                : 'text-slate-600 dark:text-slate-400'
                            } ${field.isMono ? 'font-mono' : ''}`}
                          >
                            {field.oldValue}
                          </td>

                          {/* Cột 3: Dữ liệu đề xuất / Bản mới */}
                          <td
                            className={`w-[39%] p-4 sm:p-5 align-top text-xs sm:text-sm whitespace-normal break-words leading-relaxed ${
                              field.hasChanged
                                ? 'bg-emerald-500/[0.08] dark:bg-emerald-500/[0.15] border-l-4 border-l-emerald-500 font-bold text-emerald-800 dark:text-emerald-300'
                                : 'border-l border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                            } ${field.isMono ? 'font-mono' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <span className="whitespace-normal break-words leading-relaxed flex-1">
                                {field.newValue}
                              </span>
                              {field.hasChanged ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shrink-0 mt-0.5">
                                  Đề xuất mới
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 italic shrink-0 mt-0.5">
                                  (Giữ nguyên)
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}

                      {/* Hàng đính kèm tệp PDF mới (nếu có) */}
                      {activeProposal.new_stored_path && (
                        <tr className="hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors">
                          <td className="w-[22%] min-w-[200px] p-4 sm:p-5 align-top bg-blue-50/20 dark:bg-blue-950/10 font-semibold text-xs text-blue-700 dark:text-blue-300">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                              <span className="leading-relaxed">Tệp PDF Đính Kèm Thay Thế</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 shrink-0">
                                FILE MỚI
                              </span>
                            </div>
                          </td>
                          <td className="w-[39%] p-4 sm:p-5 align-top border-l border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-500 dark:text-slate-400 italic">
                            Tệp PDF ban đầu của văn bản
                          </td>
                          <td className="w-[39%] p-4 sm:p-5 align-top bg-blue-500/[0.08] dark:bg-blue-500/[0.15] border-l-4 border-l-blue-500">
                            <div className="flex items-center justify-between gap-3 text-xs sm:text-sm font-mono text-blue-900 dark:text-blue-200 font-semibold">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-bold text-blue-600">+</span>
                                <span className="truncate">{activeProposal.new_original_name || 'tai_lieu_chuan_hoa.pdf'}</span>
                              </div>
                              {activeProposal.new_file_size && (
                                <span className="text-[11px] text-slate-500 font-sans shrink-0">
                                  ({Math.round(activeProposal.new_file_size / 1024)} KB)
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. KHUNG LÝ DO ĐỀ XUẤT TỪ CÁN BỘ */}
              {activeProposal.note && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-xs sm:text-sm text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-xs">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-amber-800 dark:text-amber-300 mb-1 font-bold">
                      Lý do đề xuất từ cán bộ:
                    </strong>
                    <p className="italic leading-relaxed">"{activeProposal.note}"</p>
                  </div>
                </div>
              )}

              {/* 5. CẢNH BÁO CHẶN TỰ DUYỆT (TẦNG UI) */}
              {blockSelfApprove && (
                <div className="flex items-start gap-3 text-xs sm:text-sm text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/30 p-4 rounded-2xl border border-rose-300 dark:border-rose-800">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    Bạn không thể tự phê duyệt hoặc từ chối đề xuất do chính mình tạo ra.
                    Vui lòng chuyển cho Chỉ huy hoặc Quản trị viên khác kiểm duyệt.
                  </span>
                </div>
              )}
            </div>

            {/* ========================================================= */}
            {/* STICKY FOOTER & THAO TÁC PHÊ DUYỆT NHANH                 */}
            {/* ========================================================= */}
            <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 z-20">
              {isRejecting ? (
                /* KHUNG NHẬP LÝ DO TỪ CHỐI KÈM CHIP 1 CHẠM */
                <div className="w-full space-y-3 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between">
                    <label className="text-xs sm:text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <span>Nhập lý do từ chối yêu cầu (bắt buộc để gửi về cho cán bộ):</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRejecting(false);
                        setRejectReason('');
                      }}
                      className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer font-medium"
                    >
                      Quay lại
                    </button>
                  </div>

                  {/* CHIP CHỌN NHANH LÝ DO 1 CHẠM */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-slate-500 font-medium">Gợi ý nhanh:</span>
                    {REJECT_QUICK_CHIPS.map((chip, cIdx) => (
                      <button
                        key={cIdx}
                        type="button"
                        onClick={() => handleSelectQuickChip(chip)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/40 transition cursor-pointer"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Nêu rõ lý do từ chối để cán bộ chỉnh sửa lại (hoặc bấm gợi ý nhanh ở trên)..."
                    rows={2}
                    autoFocus
                    disabled={isProcessing}
                    className="w-full p-3 rounded-xl border border-red-300 dark:border-red-800/60 bg-white dark:bg-slate-950 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                  />

                  <div className="flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRejecting(false);
                        setRejectReason('');
                      }}
                      disabled={isProcessing}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmReject}
                      disabled={isProcessing || !rejectReason.trim()}
                      className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 transition shadow-xs"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      <span>Xác nhận từ chối</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* THANH THAO TÁC TIÊU CHUẨN */
                <>
                  <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    {canApprove ? (
                      <span>
                        Chỉ huy / Quản trị viên chịu trách nhiệm về tính chính xác khi phê duyệt.
                      </span>
                    ) : (
                      <span className="italic">
                        Bạn đang xem đề xuất ở chế độ đối chiếu tra cứu.
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    {canApprove && !blockSelfApprove ? (
                      <>
                        {/* NÚT 1: TỪ CHỐI */}
                        <button
                          type="button"
                          onClick={() => setIsRejecting(true)}
                          disabled={isProcessing}
                          className="flex-1 sm:flex-none px-5 py-2.5 border border-red-500/80 text-red-600 dark:text-red-400 hover:bg-red-500/10 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                          <span>Từ chối</span>
                        </button>

                        {/* NÚT 2: PHÊ DUYỆT & CẬP NHẬT (Solid Xanh Lục Quân) */}
                        <button
                          type="button"
                          onClick={handleQuickApprove}
                          disabled={isProcessing}
                          className="flex-1 sm:flex-none px-6 py-2.5 bg-[#166534] hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20 transition cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4 stroke-[2.5]" />
                          )}
                          <span>
                            {isNewUpload ? 'Phê duyệt & Tiếp nhận văn bản' : 'Phê duyệt & Cập nhật'}
                          </span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer"
                      >
                        Đóng khung duyệt
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};
