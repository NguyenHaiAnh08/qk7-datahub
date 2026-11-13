import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircle, AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import { Lecture } from '../../types/lecture';

export interface RejectReasonModalProps {
  open: boolean;
  lecture: Lecture | null;
  onConfirm: (reason: string) => void | Promise<void>;
  onClose: () => void;
}

const QUICK_REASONS = [
  'Nội dung cần bổ sung tài liệu tham khảo theo quy chuẩn giáo trình',
  'Chưa cập nhật đúng mẫu giáo án điện tử và quy định giảng dạy của Nhà trường',
  'Cấp độ bảo mật chưa tương xứng với nội dung bài học',
  'Đề nghị rà soát lại số liệu kỹ thuật, sơ đồ tác chiến và câu hỏi Quiz',
];

export const RejectReasonModal: React.FC<RejectReasonModalProps> = ({
  open,
  lecture,
  onConfirm,
  onClose,
}) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setReason('');
      setSubmitting(false);
    }
  }, [open]);

  if (!open || !lecture) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12, transition: { duration: 0.15 } }}
          transition={{ type: 'spring', stiffness: 380, damping: 26, mass: 0.75 }}
          className="w-full max-w-lg bg-white/95 dark:bg-[#0c1420]/95 backdrop-blur-xl rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-2xl relative text-left"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center border bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400 shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Từ Chối Phê Duyệt Bài Giảng
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Ý kiến chỉ đạo sẽ được gửi trực tiếp tới giảng viên tác giả
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Thông tin bài giảng tóm tắt */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/[0.08] mb-4 text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                {lecture.lecture_code}
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-700 dark:text-slate-300 font-semibold truncate">
                {lecture.title}
              </span>
            </div>
            <div className="text-slate-500 flex items-center gap-2">
              <span>Tác giả: <strong className="text-slate-700 dark:text-slate-300">{lecture.author_name || 'Giảng viên'}</strong></span>
              <span>•</span>
              <span>Khoa: {lecture.faculty_name || 'Bộ môn'}</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Lý Do Từ Chối / Yêu Cầu Chỉnh Sửa <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={3}
                placeholder="Nhập chi tiết các nội dung cần sửa đổi, bổ sung..."
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-rose-600 focus:ring-1 focus:ring-rose-600 transition"
              />
            </div>

            {/* Gợi ý lý do nhanh */}
            <div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
                Gợi ý lý do nhận xét nhanh:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_REASONS.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setReason(r)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 dark:bg-slate-900 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 dark:hover:border-rose-500/30 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 transition text-left"
                  >
                    + {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={submitting || !reason.trim()}
                className="px-4 py-2 bg-gradient-to-r from-[#b91c1c] to-[#dc2626] hover:from-[#dc2626] hover:to-[#ef4444] text-white font-bold rounded-xl text-xs transition shadow-md shadow-rose-950/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>{submitting ? 'Đang gửi...' : 'Xác nhận từ chối'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

