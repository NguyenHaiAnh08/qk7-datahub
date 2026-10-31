import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  ArrowRight,
  Shield,
  Building,
  User,
  AlertCircle,
  Loader2,
  Calendar,
} from 'lucide-react';
import { documentService } from '../../services/documentService';
import { toast } from '../common/Toast';

export interface PendingProposalItem {
  proposal_id: string;
  file_id: string;
  requester_id: string;
  requester_name: string;
  requester_rank?: string;
  requester_position?: string;
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
  new_stored_path?: string;
  new_original_name?: string;
  new_file_size?: number;
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
  const [selectedProposal, setSelectedProposal] = useState<PendingProposalItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  if (!open) return null;

  const activeItem = selectedProposal || (proposals.length > 0 ? proposals[0] : null);

  const handleApprove = async (proposalId: string) => {
    setActionLoading(true);
    try {
      const res = await documentService.approveProposal(proposalId, 'Chỉ huy / Admin đã phê duyệt đề xuất chuẩn hóa');
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

  const handleReject = async (proposalId: string) => {
    if (!rejectReason.trim()) {
      toast.error('Vui lòng nhập lý do từ chối đề xuất', { title: 'YÊU CẦU LÝ DO' });
      return;
    }
    setActionLoading(true);
    try {
      const res = await documentService.rejectProposal(proposalId, rejectReason.trim());
      toast.info(res.message || 'Đã từ chối đề xuất', {
        title: 'ĐÃ TỪ CHỐI',
        badge: 'REJECTED',
      });
      setShowRejectInput(false);
      setRejectReason('');
      setSelectedProposal(null);
      onRefresh();
    } catch (err: any) {
      toast.error('Lỗi từ chối: ' + (err.message || 'Không thể thực thi'), {
        title: 'THẤT BẠI',
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Đề Xuất Chỉnh Sửa & Chuẩn Hóa Văn Bản</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  {proposals.length} chờ duyệt
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Kiểm duyệt và chuẩn hóa thông tin do Trợ lý, Văn thư, Cơ yếu, IT đề xuất chỉnh sửa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {proposals.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
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
            {/* Cột 1: Danh sách đề xuất */}
            <div className="p-3 overflow-y-auto max-h-[70vh] space-y-2">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 pb-1">
                Danh sách chờ xét duyệt
              </div>
              {proposals.map((item) => {
                const isSelected = activeItem?.proposal_id === item.proposal_id;
                return (
                  <button
                    key={item.proposal_id}
                    onClick={() => {
                      setSelectedProposal(item);
                      setShowRejectInput(false);
                      setRejectReason('');
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500/50 shadow-sm'
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
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                      <User className="w-3 h-3 shrink-0" />
                      <span className="truncate">{item.requester_name}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Cột 2 & 3: Chi tiết đối chiếu Cũ vs Mới */}
            {activeItem && (
              <div className="md:col-span-2 p-4 sm:p-6 overflow-y-auto max-h-[70vh] space-y-5 bg-slate-50/50 dark:bg-slate-950/20">
                {/* Thông tin người đề xuất */}
                <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">
                        {activeItem.requester_name} {activeItem.requester_rank ? `(${activeItem.requester_rank})` : ''}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Chức vụ: {activeItem.requester_position || 'Cán bộ nghiệp vụ'} • Gửi lúc: {new Date(activeItem.created_at).toLocaleString('vi-VN')}
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                    Chờ duyệt
                  </span>
                </div>

                {/* Bảng so sánh Old vs New */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Bảng đối chiếu thông tin chuẩn hóa
                  </h3>
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                    {/* Hàng 1: Số hiệu */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 p-3 gap-2">
                      <div>
                        <div className="text-[10px] text-slate-400 font-semibold uppercase">Số hiệu hiện tại</div>
                        <div className="font-mono text-slate-600 dark:text-slate-400 line-through mt-0.5">
                          {activeItem.current_document_code || '—'}
                        </div>
                      </div>
                      <div className="sm:border-l sm:border-slate-200 dark:sm:border-slate-800 sm:pl-3">
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase">Số hiệu đề xuất</div>
                        <div className="font-mono text-emerald-700 dark:text-emerald-300 font-bold mt-0.5">
                          {activeItem.document_code || 'Giữ nguyên'}
                        </div>
                      </div>
                    </div>

                    {/* Hàng 2: Trích yếu tiêu đề */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 p-3 gap-2">
                      <div>
                        <div className="text-[10px] text-slate-400 font-semibold uppercase">Trích yếu hiện tại</div>
                        <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                          {activeItem.current_title}
                        </div>
                      </div>
                      <div className="sm:border-l sm:border-slate-200 dark:sm:border-slate-800 sm:pl-3">
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase">Trích yếu đề xuất mới</div>
                        <div className="text-emerald-800 dark:text-emerald-200 font-medium mt-0.5">
                          {activeItem.title}
                        </div>
                      </div>
                    </div>

                    {/* Hàng 3: Đơn vị & Người ký */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 p-3 gap-2">
                      <div>
                        <div className="text-[10px] text-slate-400 font-semibold uppercase">Đơn vị & Người ký hiện tại</div>
                        <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                          {activeItem.current_unit_name || '—'} • {activeItem.current_signer || '—'}
                        </div>
                      </div>
                      <div className="sm:border-l sm:border-slate-200 dark:sm:border-slate-800 sm:pl-3">
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase">Đơn vị & Người ký đề xuất</div>
                        <div className="text-slate-800 dark:text-slate-200 font-medium mt-0.5">
                          {activeItem.issuing_unit_name || activeItem.issuing_unit_id || 'Giữ nguyên'} • {activeItem.signer || 'Giữ nguyên'}
                        </div>
                      </div>
                    </div>

                    {/* Hàng 4: Cấp độ bảo mật */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 p-3 gap-2">
                      <div>
                        <div className="text-[10px] text-slate-400 font-semibold uppercase">Cấp mật hiện tại</div>
                        <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                          {activeItem.current_security_name || `Cấp ${activeItem.current_security_level_id}`}
                        </div>
                      </div>
                      <div className="sm:border-l sm:border-slate-200 dark:sm:border-slate-800 sm:pl-3">
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase">Cấp mật đề xuất</div>
                        <div className="text-emerald-700 dark:text-emerald-300 font-bold mt-0.5">
                          {activeItem.security_level_name || `Cấp ${activeItem.security_level_id}`}
                        </div>
                      </div>
                    </div>

                    {/* Hàng 5: Tệp đính kèm mới */}
                    {activeItem.new_stored_path && (
                      <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20">
                        <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase">Tệp PDF đính kèm thay thế</div>
                        <div className="text-blue-800 dark:text-blue-200 font-medium mt-0.5 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" />
                          <span>{activeItem.new_original_name || 'file_chuan_hoa.pdf'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ghi chú của người đề xuất */}
                {activeItem.note && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-900 dark:text-amber-200">
                    <span className="font-semibold">Lý do đề xuất: </span>
                    <span>{activeItem.note}</span>
                  </div>
                )}

                {/* Khung nhập lý do từ chối */}
                {showRejectInput && (
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 rounded-xl space-y-2">
                    <label className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                      Lý do từ chối đề xuất (bắt buộc):
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Nhập lý do chưa chấp thuận để cán bộ sửa đổi nắm được..."
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                      rows={2}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowRejectInput(false)}
                        className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(activeItem.proposal_id)}
                        disabled={actionLoading}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs cursor-pointer disabled:opacity-50"
                      >
                        {actionLoading ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Nút hành động duyệt / từ chối */}
                <div className="pt-2 flex items-center justify-end gap-3">
                  {canApprove ? (
                    <>
                      {!showRejectInput && (
                        <button
                          type="button"
                          onClick={() => setShowRejectInput(true)}
                          disabled={actionLoading}
                          className="px-4 py-2 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Từ Chối Đề Xuất</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleApprove(activeItem.proposal_id)}
                        disabled={actionLoading}
                        className="px-5 py-2 bg-[#166534] hover:bg-[#15803d] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-950/20 transition cursor-pointer disabled:opacity-50"
                      >
                        {actionLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        <span>Phê Duyệt & Áp Dụng Ngay</span>
                      </button>
                    </>
                  ) : (
                    <div className="text-xs text-slate-500 italic">
                      Đề xuất đang ở trạng thái chờ Chỉ huy hoặc Quản trị viên duyệt.
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

