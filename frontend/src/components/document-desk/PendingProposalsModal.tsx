import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { isUserAdmin } from '../../contexts/AuthContext';
import {
  X,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Shield,
  Building,
  User,
  AlertCircle,
  Loader2,
  Calendar,
  MessageSquare,
  Sparkles,
  MinusCircle,
  PlusCircle,
  Check,
  Send,
} from 'lucide-react';
import { documentService } from '../../services/documentService';
import { toast } from '../common/Toast';
import { getInitials } from './ApprovalDiffModal';

export interface PendingProposalItem {
  proposal_id: string;
  file_id: string;
  requester_id: string;
  requester_name: string;
  requester_rank?: string;
  requester_position?: string;
  requester_unit_id?: string;
  requester_unit_name?: string;
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
  created_at: string;
}

export interface PendingProposalsModalProps {
  open: boolean;
  proposals: PendingProposalItem[];
  canApprove: boolean; // Chỉ huy hoặc Admin
  onClose: () => void;
  onRefresh: () => void;
}

export const PendingProposalsModal: React.FC<PendingProposalsModalProps> = ({
  open,
  proposals,
  canApprove,
  onClose,
  onRefresh,
}) => {
  const { user } = useAuth();

  const [selectedProposal, setSelectedProposal] = useState<PendingProposalItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionInputMode, setActionInputMode] = useState<'idle' | 'reject'>('idle');
  const [inputText, setInputText] = useState('');

  // ─────────────────────────────────────────────────────────
  // DERIVED VALUES
  // ─────────────────────────────────────────────────────────
  const activeItem = selectedProposal || (proposals.length > 0 ? proposals[0] : null);

  const isAdminRole =
    isUserAdmin(user) ||
    user?.user_id === 'USR-001' ||
    (user?.roles || []).includes('ROL-01');

  const isCommanderRole = (user?.roles || []).includes('ROL-02');
  const canSelfApprove = isAdminRole || isCommanderRole;

  const hasRealPermissionToApprove =
    canApprove && (isAdminRole || isCommanderRole);

  const isSelfRequest = activeItem?.requester_id === user?.user_id;
  const blockSelfApprove = isSelfRequest && !canSelfApprove;

  const isInternalUnit = Boolean(
    user?.unit_id &&
      activeItem &&
      (activeItem.issuing_unit_id === user.unit_id ||
        activeItem.document_issuing_unit_id === user.unit_id ||
        activeItem.requester_unit_id === user.unit_id)
  );

  if (!open) return null;

  // ─────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────
  const handleApprove = async (proposalId: string) => {
    const target = proposals.find((p) => p.proposal_id === proposalId);
    if (target && target.requester_id === user?.user_id && !canSelfApprove) {
      toast.error('Bạn không thể tự phê duyệt đề xuất của chính mình.', {
        title: 'BỊ CHẶN',
        badge: 'SELF_APPROVE_DENIED',
      });
      return;
    }

    setActionLoading(true);
    try {
      const res = await documentService.approveProposal(
        proposalId,
        isCommanderRole
          ? 'Chỉ huy cấp Phòng đã phê duyệt & chuẩn hóa'
          : 'Quản trị viên đã phê duyệt & áp dụng'
      );
      toast.success(res.message || 'Đã phê duyệt đề xuất thành công', {
        title: 'PHÊ DUYỆT THÀNH CÔNG',
        badge: 'APPROVED',
      });
      setSelectedProposal(null);
      onRefresh();
    } catch (err: any) {
      toast.error('Lỗi phê duyệt: ' + (err.message || 'Không thể thực thi'), {
        title: 'THẤT BẠI',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmAction = async (proposalId: string) => {
    const target = proposals.find((p) => p.proposal_id === proposalId);
    if (target && target.requester_id === user?.user_id && !canSelfApprove) {
      toast.error('Bạn không thể tự xử lý đề xuất của chính mình.', {
        title: 'BỊ CHẶN',
        badge: 'SELF_ACTION_DENIED',
      });
      return;
    }

    if (!inputText.trim()) {
      toast.warning(
        actionInputMode === 'reject'
          ? 'Vui lòng nhập lý do từ chối đề xuất'
          : 'Vui lòng nhập nội dung yêu cầu giải trình'
      );
      return;
    }

    setActionLoading(true);
    try {
      const noteToSend =
        actionInputMode === 'reject'
          ? inputText.trim()
          : `[YÊU CẦU GIẢI TRÌNH] ${inputText.trim()}`;

      const res = await documentService.rejectProposal(proposalId, noteToSend);
      toast.info(
        actionInputMode === 'reject'
          ? res.message || 'Đã từ chối đề xuất'
          : 'Đã gửi yêu cầu giải trình tới cán bộ',
        {
          title: actionInputMode === 'reject' ? 'ĐÃ TỪ CHỐI' : 'YÊU CẦU GIẢI TRÌNH',
          badge: actionInputMode === 'reject' ? 'REJECTED' : 'EXPLANATION_REQUIRED',
        }
      );
      setActionInputMode('idle');
      setInputText('');
      setSelectedProposal(null);
      onRefresh();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || 'Không thể thực thi'), {
        title: 'THẤT BẠI',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // DANH SÁCH DIFF FIELDS ĐỐI CHIẾU
  // ─────────────────────────────────────────────────────────────
  const isNewUpload = Boolean(
    activeItem?.deleted_reason === 'PENDING_APPROVAL' ||
    activeItem?.is_new_upload ||
    activeItem?.note?.includes('Đăng tải')
  );

  const diffFields = activeItem
    ? [
        {
          label: 'Số hiệu / Ký hiệu văn bản',
          oldValue: isNewUpload ? '(Văn bản mới)' : (activeItem.current_document_code || '—'),
          newValue: activeItem.document_code || activeItem.current_document_code || '—',
          hasChanged: isNewUpload || (
            Boolean(activeItem.document_code) &&
            activeItem.document_code !== activeItem.current_document_code
          ),
          isMono: true,
        },
        {
          label: 'Trích yếu nội dung văn bản',
          oldValue: isNewUpload ? '(Văn bản mới)' : activeItem.current_title,
          newValue: activeItem.title,
          hasChanged: isNewUpload || (activeItem.title.trim() !== activeItem.current_title.trim()),
        },
        {
          label: 'Đơn vị ban hành',
          oldValue: isNewUpload ? '(Chưa có)' : (activeItem.current_unit_name || '—'),
          newValue: activeItem.issuing_unit_name || activeItem.current_unit_name || '—',
          hasChanged: isNewUpload || (
            Boolean(activeItem.issuing_unit_name) &&
            activeItem.issuing_unit_name !== activeItem.current_unit_name
          ),
        },
        {
          label: 'Người ký ban hành',
          oldValue: isNewUpload ? '(Chưa có)' : (activeItem.current_signer || '—'),
          newValue: activeItem.signer || activeItem.current_signer || '—',
          hasChanged: isNewUpload || (
            Boolean(activeItem.signer) && activeItem.signer !== activeItem.current_signer
          ),
        },
        {
          label: 'Cấp độ bảo mật (Độ mật)',
          oldValue: isNewUpload ? '(Chưa có)' : (
            activeItem.current_security_name ||
            `Cấp ${activeItem.current_security_level_id}`
          ),
          newValue:
            activeItem.security_level_name || `Cấp ${activeItem.security_level_id}`,
          hasChanged: isNewUpload || (
            activeItem.security_level_id !== activeItem.current_security_level_id
          ),
        },
        {
          label: 'Ngày ban hành',
          oldValue: isNewUpload ? '(Chưa có)' : (activeItem.current_issued_date
            ? new Date(activeItem.current_issued_date).toLocaleDateString('vi-VN')
            : '—'),
          newValue: activeItem.issued_date
            ? new Date(activeItem.issued_date).toLocaleDateString('vi-VN')
            : activeItem.current_issued_date
            ? new Date(activeItem.current_issued_date).toLocaleDateString('vi-VN')
            : '—',
          hasChanged: isNewUpload || (
            Boolean(activeItem.issued_date) &&
            activeItem.issued_date !== activeItem.current_issued_date
          ),
        },
      ]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* ========================================================= */}
        {/* HEADER MODAL VỚI BADGE PHÂN CẤP THẨM QUYỀN              */}
        {/* ========================================================= */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                  Đề Xuất Chỉnh Sửa & Chuẩn Hóa Văn Bản
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  {proposals.length} chờ duyệt
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
                Kiểm duyệt đối chiếu trực quan thông tin do Trợ lý, Văn thư, Cơ yếu đề xuất
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================= */}
        {/* CONTENT BODY                                             */}
        {/* ========================================================= */}
        {proposals.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Hiện tại không có đề xuất chỉnh sửa nào đang chờ phê duyệt.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Mọi văn bản đều đã được đồng bộ chuẩn hóa theo phân cấp quản lý.
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
            {/* Cột 1: Danh sách đề xuất bên trái */}
            <div className="p-3 overflow-y-auto max-h-[72vh] space-y-2 bg-slate-50/30 dark:bg-slate-950/20">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 pb-1">
                Danh sách chờ xét duyệt
              </div>
              {proposals.map((item) => {
                const isSelected = activeItem?.proposal_id === item.proposal_id;
                const isOwnProposal = item.requester_id === user?.user_id;
                const itemInternal = Boolean(
                  user?.unit_id &&
                    (item.issuing_unit_id === user.unit_id ||
                      item.document_issuing_unit_id === user.unit_id ||
                      item.requester_unit_id === user.unit_id)
                );

                return (
                  <button
                    key={item.proposal_id}
                    onClick={() => {
                      setSelectedProposal(item);
                      setActionInputMode('idle');
                      setInputText('');
                    }}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500/50 shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        {item.document_code || item.current_document_code || 'VĂN BẢN'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(item.created_at).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-2 mt-1">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-2 flex-wrap">
                      <User className="w-3 h-3 shrink-0" />
                      <span className="truncate">{item.requester_name}</span>
                      {(item.deleted_reason === 'PENDING_APPROVAL' || item.is_new_upload || item.note?.includes('Đăng tải')) && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 shrink-0">
                          TẢI MỚI
                        </span>
                      )}
                      {isOwnProposal && (
                        <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0">
                          CỦA BẠN
                        </span>
                      )}
                      {itemInternal && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 shrink-0">
                          NỘI BỘ
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Cột 2 & 3: Chi tiết đối chiếu dữ liệu chuẩn hóa & Sticky Footer */}
            {activeItem && (
              <div className="md:col-span-2 flex flex-col h-full max-h-[72vh] overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
                {/* Vùng Cuộn Nội Dung Diff */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                  {/* Card Thông tin người đề xuất */}
                  <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600 to-teal-800 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm border border-white dark:border-slate-800">
                        {getInitials(activeItem.requester_name)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {activeItem.requester_name}
                          </span>
                          {activeItem.requester_rank && (
                            <span className="text-[11px] text-slate-500">
                              ({activeItem.requester_rank})
                            </span>
                          )}
                          {isInternalUnit && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                              Tài liệu nội bộ phòng
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Chức vụ: {activeItem.requester_position || 'Cán bộ nghiệp vụ'} • Gửi lúc:{' '}
                          {new Date(activeItem.created_at).toLocaleString('vi-VN')}
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                      Chờ duyệt
                    </span>
                  </div>

                  {/* GITHUB-STYLE DIFF VIEWER */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Đối Chiếu Dữ Liệu Chuẩn Hóa
                      </h3>
                      <div className="flex items-center gap-2.5 text-[10px]">
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold">
                          <MinusCircle className="w-3 h-3" /> Cũ (bị xóa)
                        </span>
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                          <PlusCircle className="w-3 h-3" /> Mới (đề xuất)
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
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div className="p-2 rounded-lg bg-red-500/10 dark:bg-red-950/30 border border-red-500/20 text-red-700 dark:text-red-400 flex items-start gap-1.5">
                                  <span className="font-mono font-bold text-red-500 shrink-0 select-none">-</span>
                                  <span className={`line-through break-words ${field.isMono ? 'font-mono' : ''}`}>
                                    {field.oldValue}
                                  </span>
                                </div>
                                <div className="p-2 rounded-lg bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-semibold flex items-start gap-1.5">
                                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0 select-none">+</span>
                                  <span className={`break-words ${field.isMono ? 'font-mono' : ''}`}>
                                    {field.newValue}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }
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

                      {/* File PDF mới thay thế */}
                      {activeItem.new_stored_path && (
                        <div className="p-3 bg-blue-50/40 dark:bg-blue-950/20">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5" />
                              {isNewUpload ? 'Tệp PDF Văn Bản Mới Đăng Tải' : 'Tệp PDF Đính Kèm Thay Thế'}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                              FILE MỚI
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-200 text-xs font-mono flex items-center gap-2">
                            <span className="font-bold text-blue-600">+</span>
                            <span>
                              {activeItem.new_original_name || 'tai_lieu_chuan_hoa.pdf'}
                            </span>
                            {activeItem.new_file_size && (
                              <span className="text-slate-400 font-sans text-[11px] ml-auto">
                                ({Math.round(activeItem.new_file_size / 1024)} KB)
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lý do đề xuất */}
                  {activeItem.note && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2 shadow-xs">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block text-amber-800 dark:text-amber-300 mb-0.5 font-bold">
                          Lý do đề xuất:
                        </strong>
                        <p className="italic">"{activeItem.note}"</p>
                      </div>
                    </div>
                  )}

                  {/* Cảnh báo tự duyệt */}
                  {blockSelfApprove && (
                    <div className="flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/30 p-3 rounded-xl border border-rose-300 dark:border-rose-800">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Bạn không thể tự phê duyệt hoặc từ chối đề xuất do chính mình tạo ra.
                        Vui lòng chuyển cho Chỉ huy hoặc Quản trị viên khác xử lý.
                      </span>
                    </div>
                  )}
                </div>

                {/* ========================================================= */}
                {/* STICKY FOOTER: COMMANDER ACTION HUB                       */}
                {/* ========================================================= */}
                <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-3.5 shrink-0 z-10">
                  {actionInputMode === 'reject' ? (
                    <div className="space-y-2 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-red-700 dark:text-red-400 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                          <span>Nhập lý do từ chối đề xuất (Bắt buộc):</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setActionInputMode('idle');
                            setInputText('');
                          }}
                          className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                        >
                          Quay lại
                        </button>
                      </div>

                      <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Nêu rõ lý do từ chối để cán bộ chỉnh sửa lại (ví dụ: Số hiệu chưa chính xác, thiếu ngày ban hành...)"
                        rows={2}
                        autoFocus
                        disabled={actionLoading}
                        className="w-full p-2.5 rounded-xl border border-red-300 dark:border-red-800/60 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                      />

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActionInputMode('idle');
                            setInputText('');
                          }}
                          disabled={actionLoading}
                          className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmAction(activeItem.proposal_id)}
                          disabled={actionLoading || !inputText.trim()}
                          className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition shadow-xs"
                        >
                          {actionLoading ? (
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
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {hasRealPermissionToApprove ? (
                          <span>Chỉ huy / Quản trị viên chịu trách nhiệm phê duyệt.</span>
                        ) : (
                          <span className="italic">
                            Đề xuất đang ở trạng thái chờ Chỉ huy hoặc Quản trị viên duyệt.
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                        {hasRealPermissionToApprove && !blockSelfApprove && (
                          <>
                            {/* NÚT 1: TỪ CHỐI (Ghost viền đỏ) */}
                            <button
                              type="button"
                              onClick={() => setActionInputMode('reject')}
                              disabled={actionLoading}
                              className="px-4 py-2 border border-red-500 text-red-600 dark:text-red-400 hover:bg-red-500/10 font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Từ chối</span>
                            </button>

                            {/* NÚT 2: PHÊ DUYỆT & CẬP NHẬT (Solid Xanh Lục Quân Đậm) */}
                            <button
                              type="button"
                              onClick={() => handleApprove(activeItem.proposal_id)}
                              disabled={actionLoading}
                              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/20 transition cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                              {actionLoading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              )}
                              <span>{isNewUpload ? 'Phê duyệt & Tiếp nhận văn bản' : 'Phê duyệt & Cập nhật'}</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
