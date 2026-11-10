import React, { useState } from 'react';
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
  // Lấy 2 từ cuối: Nguyễn Thị Ánh Tuyết -> ÁT, Nguyễn Hải Anh -> HA
  const penult = parts[parts.length - 2];
  const last = parts[parts.length - 1];
  return (penult.charAt(0) + last.charAt(0)).toUpperCase();
};

export const ApprovalDiffModal: React.FC<ApprovalDiffModalProps> = ({
  open,
  proposal,
  onClose,
  onApprove,
  onReject,
  isProcessing = false,
}) => {
  const { user } = useAuth();

  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  if (!open || !proposal) return null;

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
      (proposal.issuing_unit_id === user.unit_id ||
        proposal.document_issuing_unit_id === user.unit_id ||
        proposal.requester_unit_id === user.unit_id)
  );

  const isSelfRequest = proposal.requester_id === user?.user_id;
  const blockSelfApprove = isSelfRequest && !canApprove;

  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      toast.warning('Vui lòng nhập lý do từ chối yêu cầu.');
      return;
    }
    await onReject(proposal.proposal_id, rejectReason.trim());
    setIsRejecting(false);
    setRejectReason('');
  };

  const handleQuickApprove = async () => {
    await onApprove(
      proposal.proposal_id,
      isCommanderRole
        ? 'Chỉ huy cấp Phòng đã phê duyệt & chuẩn hóa'
        : 'Quản trị viên đã phê duyệt & áp dụng'
    );
  };

  // ─────────────────────────────────────────────────────────────
  // SO SÁNH DỮ LIỆU ĐỐI CHIẾU
  // ─────────────────────────────────────────────────────────────
  const isNewUpload = Boolean(
    proposal.is_new_upload ||
    proposal.deleted_reason === 'PENDING_APPROVAL' ||
    proposal.note?.includes('Đăng tải')
  );

  const diffFields = [
    {
      label: 'Số hiệu / Ký hiệu văn bản',
      oldValue: isNewUpload ? '(Văn bản mới)' : (proposal.current_document_code || '—'),
      newValue: proposal.document_code || proposal.current_document_code || '—',
      hasChanged: isNewUpload || (
        Boolean(proposal.document_code) &&
        proposal.document_code !== proposal.current_document_code
      ),
      isMono: true,
    },
    {
      label: 'Trích yếu nội dung văn bản',
      oldValue: isNewUpload ? '(Văn bản mới)' : proposal.current_title,
      newValue: proposal.title,
      hasChanged: isNewUpload || (proposal.title.trim() !== proposal.current_title.trim()),
    },
    {
      label: 'Đơn vị ban hành',
      oldValue: isNewUpload ? '(Chưa có)' : (proposal.current_unit_name || '—'),
      newValue: proposal.issuing_unit_name || proposal.current_unit_name || '—',
      hasChanged: isNewUpload || (
        Boolean(proposal.issuing_unit_name) &&
        proposal.issuing_unit_name !== proposal.current_unit_name
      ),
    },
    {
      label: 'Người ký ban hành',
      oldValue: isNewUpload ? '(Chưa có)' : (proposal.current_signer || '—'),
      newValue: proposal.signer || proposal.current_signer || '—',
      hasChanged: isNewUpload || (
        Boolean(proposal.signer) && proposal.signer !== proposal.current_signer
      ),
    },
    {
      label: 'Cấp độ bảo mật (Độ mật)',
      oldValue: isNewUpload ? '(Chưa có)' : (
        proposal.current_security_name ||
        `Cấp ${proposal.current_security_level_id}`
      ),
      newValue:
        proposal.security_level_name || `Cấp ${proposal.security_level_id}`,
      hasChanged: isNewUpload || (
        proposal.security_level_id !== proposal.current_security_level_id
      ),
    },
    {
      label: 'Ngày ban hành',
      oldValue: isNewUpload ? '(Chưa có)' : (proposal.current_issued_date
        ? new Date(proposal.current_issued_date).toLocaleDateString('vi-VN')
        : '—'),
      newValue: proposal.issued_date
        ? new Date(proposal.issued_date).toLocaleDateString('vi-VN')
        : proposal.current_issued_date
        ? new Date(proposal.current_issued_date).toLocaleDateString('vi-VN')
        : '—',
      hasChanged: isNewUpload || (
        Boolean(proposal.issued_date) &&
        proposal.issued_date !== proposal.current_issued_date
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* ========================================================= */}
        {/* HEADER MODAL VỚI BADGE PHÂN CẤP THẨM QUYỀN              */}
        {/* ========================================================= */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                  {isNewUpload ? 'Phê Duyệt Đăng Tải Văn Bản Mới' : 'Kiểm Duyệt Yêu Cầu Chỉnh Sửa'}
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                  {proposal.proposal_id}
                </span>

                {/* 🎖️ BADGE PHÂN CẤP THẨM QUYỀN DUYỆT */}
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
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                Đối chiếu trực quan dữ liệu hiện tại với dữ liệu đề xuất theo chuẩn quân sự
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50 shrink-0 ml-2"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================= */}
        {/* BODY: THÔNG TIN NGƯỜI ĐỀ XUẤT & ĐỐI CHIẾU DỮ LIỆU       */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-slate-950/20">
          {/* Card Hồ Sơ Người Đề Xuất */}
          <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600 to-teal-800 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-md shadow-emerald-950/20 border-2 border-white dark:border-slate-800">
                {getInitials(proposal.requester_name)}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {proposal.requester_name || 'Cán bộ đề xuất'}
                  </span>
                  {proposal.requester_rank && (
                    <span className="text-xs text-slate-500 font-medium">
                      ({proposal.requester_rank})
                    </span>
                  )}
                  {isInternalUnit && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 flex items-center gap-1">
                      <Building className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      Tài liệu nội bộ phòng
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-3 flex-wrap">
                  <span>
                    Chức vụ: <strong>{proposal.requester_position || 'Cán bộ nghiệp vụ'}</strong>
                  </span>
                  {(proposal.requester_unit_name || proposal.current_unit_name || proposal.issuing_unit_name) && (
                    <span>
                      Đơn vị: <strong>{proposal.requester_unit_name || proposal.current_unit_name || proposal.issuing_unit_name}</strong>
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3 h-3" />
                    {proposal.created_at && !isNaN(new Date(proposal.created_at).getTime()) ? new Date(proposal.created_at).toLocaleString('vi-VN') : 'Mới gửi'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0">
                Chờ duyệt
              </span>
            </div>
          </div>

          {/* ĐỐI CHIẾU DỮ LIỆU CHUẨN HÓA CONTAINER */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Đối Chiếu Dữ Liệu Chuẩn Hóa
              </h3>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold">
                  <MinusCircle className="w-3 h-3" /> Dữ liệu cũ (bị sửa)
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                  <PlusCircle className="w-3 h-3" /> Dữ liệu mới (đề xuất)
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80 shadow-xs">
              {diffFields.map((field, idx) => {
                if (field.hasChanged) {
                  return (
                    <div
                      key={idx}
                      className="p-3 bg-amber-50/25 dark:bg-amber-950/15 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {field.label}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                          CÓ THAY ĐỔI
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        {/* Cũ (Đỏ gạch ngang) */}
                        <div className="p-2.5 rounded-lg bg-red-500/10 dark:bg-red-950/30 border border-red-500/20 text-red-700 dark:text-red-400 flex items-start gap-2">
                          <span className="font-mono font-bold text-red-500 shrink-0 select-none">-</span>
                          <span className={`line-through break-words ${field.isMono ? 'font-mono' : ''}`}>
                            {field.oldValue}
                          </span>
                        </div>
                        {/* Mới (Xanh lục đậm) */}
                        <div className="p-2.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-semibold flex items-start gap-2">
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0 select-none">+</span>
                          <span className={`break-words ${field.isMono ? 'font-mono' : ''}`}>
                            {field.newValue}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Trường không đổi: hiển thị gọn gàng 1 dòng tinh tế
                return (
                  <div
                    key={idx}
                    className="px-3.5 py-2 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <span className="text-slate-500 dark:text-slate-400 font-medium w-1/3 truncate">
                      {field.label}
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 font-semibold w-1/2 truncate">
                      {field.oldValue}
                    </span>
                    <span className="text-[10px] text-slate-400 italic shrink-0">
                      (Giữ nguyên)
                    </span>
                  </div>
                );
              })}

              {/* Tệp PDF thay thế (nếu có) */}
              {proposal.new_stored_path && (
                <div className="p-3 bg-blue-50/40 dark:bg-blue-950/20">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      Tệp PDF Đính Kèm Thay Thế
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                      FILE MỚI
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-200 text-xs font-mono flex items-center gap-2">
                    <span className="font-bold text-blue-600">+</span>
                    <span>
                      {proposal.new_original_name || 'tai_lieu_chuan_hoa.pdf'}
                    </span>
                    {proposal.new_file_size && (
                      <span className="text-slate-400 font-sans text-[11px] ml-auto">
                        ({Math.round(proposal.new_file_size / 1024)} KB)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Lý do đề xuất của cán bộ */}
          {proposal.note && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2 shadow-xs">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-amber-800 dark:text-amber-300 mb-0.5 font-bold">
                  Lý do đề xuất từ cán bộ:
                </strong>
                <p className="italic">"{proposal.note}"</p>
              </div>
            </div>
          )}

          {/* CẢNH BÁO CHẶN TỰ DUYỆT (TẦNG UI) */}
          {blockSelfApprove && (
            <div className="flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/30 p-3 rounded-xl border border-rose-300 dark:border-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Bạn không thể tự phê duyệt hoặc từ chối đề xuất do chính mình tạo ra.
                Vui lòng chuyển cho Chỉ huy hoặc Quản trị viên khác kiểm duyệt.
              </span>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* STICKY FOOTER: COMMANDER ACTION HUB (2 BUTTONS ONLY)      */}
        {/* ========================================================= */}
        <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 shrink-0 z-10">
          {/* KHUNG NHẬP LÝ DO KHI BẤM TỪ CHỐI */}
          {isRejecting ? (
            <div className="space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-red-700 dark:text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span>Nhập lý do từ chối yêu cầu (bắt buộc để báo về cho cán bộ):</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsRejecting(false);
                    setRejectReason('');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                >
                  Quay lại
                </button>
              </div>

              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Nêu rõ lý do từ chối để cán bộ chỉnh sửa lại (ví dụ: Số hiệu chưa chính xác, thiếu ngày ban hành...)"
                rows={2}
                autoFocus
                disabled={isProcessing}
                className="w-full p-2.5 rounded-xl border border-red-300 dark:border-red-800/60 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsRejecting(false);
                    setRejectReason('');
                  }}
                  disabled={isProcessing}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={isProcessing || !rejectReason.trim()}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition shadow-xs"
                >
                  {isProcessing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Xác nhận từ chối</span>
                </button>
              </div>
            </div>
          ) : (
            /* 2 NÚT HÀNH ĐỘNG DUY NHẤT: TỪ CHỐI & PHÊ DUYỆT */
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
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

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                {canApprove && !blockSelfApprove ? (
                  <>
                    {/* NÚT 1: TỪ CHỐI (Ghost viền đỏ) */}
                    <button
                      type="button"
                      onClick={() => setIsRejecting(true)}
                      disabled={isProcessing}
                      className="flex-1 sm:flex-none px-4 py-2 border border-red-500 text-red-600 dark:text-red-400 hover:bg-red-500/10 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Từ chối</span>
                    </button>

                    {/* NÚT 2: PHÊ DUYỆT & CẬP NHẬT (Solid Xanh Lục Quân Đậm) */}
                    <button
                      type="button"
                      onClick={handleQuickApprove}
                      disabled={isProcessing}
                      className="flex-1 sm:flex-none px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/30 transition cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      )}
                      <span>{isNewUpload ? 'Phê duyệt & Tiếp nhận văn bản' : 'Phê duyệt & Cập nhật'}</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Đóng cửa sổ
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
