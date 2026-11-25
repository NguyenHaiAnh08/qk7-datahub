import React, { useEffect, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { documentService } from '../../services/documentService';
import { toast } from '../common/Toast';
import { ApprovalDiffModal, DiffProposalData } from './ApprovalDiffModal';
import { OwnerReviewSection } from './OwnerReviewSection';
import { approvalService } from '../../services/approvalService';

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
  const [ownerCount, setOwnerCount] = useState<number>(0);
  const [showOwner, setShowOwner] = useState<boolean>(true);

  // Đếm đề xuất đang chờ tôi (người đăng) xem — hiện ngay cả khi còn đề xuất khác chờ chỉ huy
  useEffect(() => {
    if (!open) return;
    approvalService.awaitingOwner()
      .then((r) => { const n = (r.items || []).length; setOwnerCount(n); setShowOwner(n > 0); })
      .catch(() => setOwnerCount(0));
  }, [open, proposals.length]);

  if (!open) return null;

  // Có đề xuất chờ tôi xem: ưu tiên hiện trước, kể cả khi danh sách chỉ huy duyệt không rỗng
  if (proposals.length > 0 && ownerCount > 0 && showOwner) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-2xl relative">
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
          <OwnerReviewSection onCount={setOwnerCount} onChanged={onRefresh} />
          <button
            onClick={() => setShowOwner(false)}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
          >
            Xem {proposals.length} đề xuất đang chờ chỉ huy / admin duyệt →
          </button>
        </div>
      </div>
    );
  }

  // Không có đề xuất nào ở bước chỉ huy duyệt (có thể vẫn có đề xuất đang chờ tôi — người đăng — xem)
  if (proposals.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full ${ownerCount > 0 ? 'max-w-3xl max-h-[85vh] overflow-y-auto text-left' : 'max-w-md text-center'} p-6 space-y-4 shadow-2xl relative`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <OwnerReviewSection onCount={setOwnerCount} onChanged={onRefresh} />
          {ownerCount === 0 && (<>
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
          <p className="text-[11px] text-slate-400">
            Bạn đã gửi đề xuất sửa văn bản của đơn vị khác? Xem và <b>rút lại</b> tại{' '}
            <a href="/my-approvals" className="underline text-emerald-700 dark:text-emerald-400">Yêu cầu của tôi</a>.
          </p>
          </>)}
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
      if ((res as any).validated) {
        toast.info(res.message || 'Đã thẩm định — chờ Chỉ huy cấp trên xác nhận', { title: 'ĐÃ THẨM ĐỊNH', badge: 'CHỜ CHỈ HUY' });
      } else {
        toast.success(res.message || 'Đã phê duyệt đề xuất thành công', {
          title: 'PHÊ DUYỆT THÀNH CÔNG',
          badge: 'APPROVED',
        });
      }
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
      if ((res as any).validated) {
        toast.info(res.message || 'Đã ghi nhận đề nghị từ chối — chờ Chỉ huy cấp trên xác nhận', { title: 'ĐÃ THẨM ĐỊNH', badge: 'CHỜ CHỈ HUY' });
      } else {
        toast.success(res.message || 'Đã từ chối đề xuất thành công', {
          title: 'ĐÃ TỪ CHỐI',
          badge: 'REJECTED',
        });
      }
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
    <>
    {ownerCount > 0 && (
      <button
        onClick={() => setShowOwner(true)}
        className="fixed bottom-4 left-4 z-[70] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-lg cursor-pointer"
      >
        ← Có {ownerCount} đề xuất sửa đang chờ bạn xem
      </button>
    )}
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
    </>
  );
};

export default PendingProposalsModal;
