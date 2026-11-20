import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Input } from 'antd';
import { Send, XCircle, UserCheck, ArrowRight, Clock } from 'lucide-react';
import { approvalService, OwnerReviewProposal } from '../../services/approvalService';
import { toast } from '../common/Toast';

/**
 * Đề xuất sửa văn bản (do tôi đăng) từ cán bộ đơn vị khác — tôi xem nội dung rồi
 * chuyển lên cấp trên duyệt, hoặc từ chối kèm lý do. Quá hạn sẽ tự chuyển lên cấp trên.
 */
const FIELDS: Array<{ label: string; cur: keyof OwnerReviewProposal; next: keyof OwnerReviewProposal }> = [
  { label: 'Số hiệu / ký hiệu', cur: 'current_document_code', next: 'document_code' },
  { label: 'Trích yếu', cur: 'current_title', next: 'title' },
  { label: 'Người ký', cur: 'current_signer', next: 'signer' },
  { label: 'Tóm tắt', cur: 'current_summary', next: 'summary' },
  { label: 'Ngày ban hành', cur: 'current_issued_date', next: 'issued_date' },
  { label: 'Độ mật (cấp)', cur: 'current_security_level_id', next: 'security_level_id' },
  { label: 'Loại văn bản', cur: 'current_doc_type_id', next: 'doc_type_id' },
  { label: 'Đơn vị ban hành', cur: 'current_issuing_unit_id', next: 'issuing_unit_id' },
];

const show = (v: unknown, isDate = false): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (isDate && typeof v === 'string') return v.slice(0, 10);
  return String(v);
};

export const OwnerReviewSection: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const [items, setItems] = useState<OwnerReviewProposal[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<OwnerReviewProposal | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await approvalService.awaitingOwner();
      setItems(res.items || []);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  if (items.length === 0) return null;

  const forward = async (p: OwnerReviewProposal) => {
    setBusyId(p.proposal_id);
    try {
      await approvalService.ownerForward(p.proposal_id);
      toast.success('Đã chuyển đề xuất lên cấp trên duyệt');
      await load();
      onChanged?.();
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejecting) return;
    if (!reason.trim()) { toast.warning('Vui lòng ghi lý do từ chối'); return; }
    setBusyId(rejecting.proposal_id);
    try {
      await approvalService.ownerReject(rejecting.proposal_id, reason.trim());
      toast.success('Đã từ chối đề xuất');
      setRejecting(null);
      setReason('');
      await load();
      onChanged?.();
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-amber-300/70 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <UserCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          Đề xuất sửa văn bản bạn đã đăng — chờ bạn xem xét
          <span className="ml-2 text-[11px] font-mono px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-900">{items.length}</span>
        </h2>
      </div>

      {items.map((p) => {
        const changed = FIELDS.filter((f) => show(p[f.cur], f.cur.includes('date')) !== show(p[f.next], f.next.includes('date')));
        return (
          <div key={p.proposal_id} className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {p.current_document_code || p.file_id} — {p.current_title}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Người đề xuất: <b>{p.requester_rank ? `${p.requester_rank} ` : ''}{p.requester_name || p.requester_id}</b>
                  {p.requester_unit_name ? ` · ${p.requester_unit_name}` : ''}
                </div>
                {p.note && <div className="text-xs italic text-slate-600 dark:text-slate-300 mt-1">“{p.note}”</div>}
              </div>
              {p.auto_forward_at && (
                <div className="text-[11px] text-slate-500 flex items-center gap-1 shrink-0">
                  <Clock className="w-3 h-3" />
                  Tự chuyển lên cấp trên: {new Date(p.auto_forward_at).toLocaleDateString('vi-VN')}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden text-xs">
              {changed.length === 0 && !p.new_original_name && (
                <div className="px-3 py-2 text-slate-500">Không có thay đổi về thông tin văn bản.</div>
              )}
              {changed.map((f) => (
                <div key={f.label} className="grid grid-cols-[110px_1fr_16px_1fr] gap-2 px-3 py-2 border-b last:border-b-0 border-slate-100 dark:border-slate-800 items-start">
                  <span className="font-semibold text-slate-500">{f.label}</span>
                  <span className="text-rose-700 dark:text-rose-400 line-through break-words">{show(p[f.cur], f.cur.includes('date'))}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium break-words">{show(p[f.next], f.next.includes('date'))}</span>
                </div>
              ))}
              {p.new_original_name && (
                <div className="px-3 py-2 text-slate-700 dark:text-slate-300">
                  Có thay thế tệp PDF: <b>{p.new_original_name}</b>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                disabled={busyId === p.proposal_id}
                onClick={() => { setRejecting(p); setReason(''); }}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" /> Từ chối
              </button>
              <button
                type="button"
                disabled={busyId === p.proposal_id}
                onClick={() => forward(p)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" /> Chuyển lên cấp trên duyệt
              </button>
            </div>
          </div>
        );
      })}

      <Modal
        open={!!rejecting}
        title="Từ chối đề xuất sửa văn bản"
        okText="Từ chối"
        cancelText="Hủy"
        okButtonProps={{ danger: true, loading: busyId === rejecting?.proposal_id }}
        onOk={confirmReject}
        onCancel={() => setRejecting(null)}
        destroyOnClose
      >
        <p className="text-xs text-slate-500 mb-2">Lý do sẽ được gửi tới người đề xuất.</p>
        <Input.TextArea
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ví dụ: Thông tin hiện tại là đúng theo bản gốc ký ngày…"
        />
      </Modal>
    </section>
  );
};

export default OwnerReviewSection;
