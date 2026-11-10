import React, { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { documentService } from '../../services/documentService';
import { toast } from '../common/Toast';
import { ApprovalDiffModal, DiffProposalData } from './ApprovalDiffModal';

export interface PendingProposalItem extends DiffProposalData {
  file_id: string;
  [key: string]: any;
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
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  if (!open) return null;

  // Trường hợp không có đề xuất nào đang chờ duyệt
  if (proposals.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 text-center space-y-4 shadow-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Không Có Đề Xuất Chờ Duyệt
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Hiện tại không có yêu cầu chỉnh sửa hay chuẩn hóa văn bản nào đang chờ phê duyệt. Toàn bộ hồ sơ đã được đồng bộ.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
          >
            Đóng thông báo
          </button>
        </div>
      </div>
    );
  }

  const activeIndex = Math.min(selectedIndex, proposals.length - 1);
  const currentProposal = proposals[activeIndex] || proposals[0];

  const handleApprove = async (proposalId: string, note?: string) => {
    setIsProcessing(true);
    try {
      const res = await documentService.approveProposal(
        proposalId,
        note || 'Chỉ huy / Quản trị viên đã phê duyệt & chuẩn hóa'
      );
      toast.success(res.message || 'Đã phê duyệt đề xuất thành công', {
        title: 'PHÊ DUYỆT THÀNH CÔNG',
        badge: 'APPROVED',
      });
      onRefresh();
      if (proposals.length <= 1) {
        onClose();
      }
    } catch (err: any) {
      toast.error('Lỗi phê duyệt: ' + (err.message || 'Không thể thực thi'), {
        title: 'THẤT BẠI',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (proposalId: string, reason: string) => {
    setIsProcessing(true);
    try {
      const res = await documentService.rejectProposal(proposalId, reason);
      toast.success(res.message || 'Đã từ chối đề xuất thành công', {
        title: 'ĐÃ TỪ CHỐI',
        badge: 'REJECTED',
      });
      onRefresh();
      if (proposals.length <= 1) {
        onClose();
      }
    } catch (err: any) {
      toast.error('Lỗi từ chối: ' + (err.message || 'Không thể thực thi'), {
        title: 'THẤT BẠI',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ApprovalDiffModal
      open={open}
      proposal={currentProposal}
      proposals={proposals}
      currentIndex={activeIndex}
      onNavigate={(newIdx) => setSelectedIndex(newIdx)}
      onClose={onClose}
      onApprove={handleApprove}
      onReject={handleReject}
      isProcessing={isProcessing}
    />
  );
};

export default PendingProposalsModal;
