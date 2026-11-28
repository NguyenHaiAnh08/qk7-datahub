import { createPortal } from 'react-dom';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, CheckCircle2, Eye, RefreshCw, X, Loader2, AlertTriangle, KeySquare } from 'lucide-react';
import { userService } from '../../services/userService';
import { User } from '../../types/user';

export interface PinManageModalProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onChanged?: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const PRIMARY = 'w-full !min-h-[44px] rounded-xl text-xs font-bold text-white transition cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 bg-emerald-800 hover:bg-emerald-700 border border-amber-500/30 shadow-md';
const SECONDARY = 'w-full !min-h-[44px] rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700';

export const PinManageModal: React.FC<PinManageModalProps> = ({
  open, user, onClose, onChanged, onToast,
}) => {
  const [loading, setLoading] = useState(false);
  const [doneMessage, setDoneMessage] = useState('');
  const [confirmRotate, setConfirmRotate] = useState(false);
  // ✅ state mới: lưu lỗi để hiển thị ngay trên modal
  const [errorMsg, setErrorMsg] = useState('');

  const hasPin = user?.has_pin === true;
  const hasFingerprint = Boolean(user?.has_fingerprint);
  const viewable = user?.pin_viewable === true;

  const handleIssue = async (rotate: boolean) => {
    if (!user) return;
    setLoading(true);
    setErrorMsg(''); // ✅ Reset lỗi trước mỗi lần cấp
    try {
      const res = await userService.generatePin(user.user_id, rotate);
      setDoneMessage(res.message);
      onToast(res.message, 'success');
      onChanged?.();
    } catch (err: any) {
      const msg = err.message || 'Lỗi cấp mã PIN';
      setErrorMsg(msg);         // ✅ Hiển thị lỗi trực tiếp trên modal (phòng khi toast bị khuất)
      onToast(msg, 'error');
    } finally {
      setLoading(false);
      setConfirmRotate(false);
    }
  };

  const handleClose = () => {
    setDoneMessage('');
    setConfirmRotate(false);
    setErrorMsg(''); // ✅ Reset lỗi khi đóng
    onClose();
  };

  if (!open || !user) return null;

  const modal = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={loading ? undefined : handleClose}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12, transition: { duration: 0.15 } }}
          transition={{ type: 'spring', stiffness: 380, damping: 26, mass: 0.75 }}
          className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-[#0c1420]/95 border border-cyan-200 dark:border-cyan-500/30"
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-cyan-50 dark:bg-cyan-500/15 border border-cyan-300 dark:border-cyan-400/40 text-cyan-700 dark:text-cyan-300">
                <KeyRound className="w-5 h-5" strokeWidth={2.2} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Quản Lý Mã PIN</h3>
                <p className="text-[11px] mt-0.5 text-slate-500 dark:text-slate-400">
                  {user.full_name} ({user.user_id})
                </p>
              </div>
            </div>
            <button
              type="button" onClick={handleClose} disabled={loading}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!doneMessage ? (
            <>
              {/* Trạng thái */}
              <div className={`p-4 rounded-xl border flex items-center gap-3 mb-4 ${
                hasPin
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700'
              }`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  hasPin
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                    : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
                }`}>
                  <KeySquare className="w-5 h-5" />
                </div>
                <div>
                  <div className={`text-xs font-bold ${
                    hasPin ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'
                  }`}>
                    {hasPin ? 'Đã cấp PIN' : 'Chưa cấp PIN'}
                  </div>
                  <div className="text-[10px] mt-0.5 text-slate-500 dark:text-slate-500">
                    {hasPin ? 'Mã đang dùng được giữ nguyên' : 'Quân nhân sẽ bị chặn khi mở Cấp 4-5'}
                  </div>
                </div>
              </div>

              {/* ✅ Hiển thị lỗi trực tiếp trên modal (phòng khi toast bị khuất) */}
              {errorMsg && (
                <div className="p-3 mb-3 rounded-xl border flex items-start gap-2 bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-[11px]">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span><strong>Lỗi:</strong> {errorMsg}</span>
                </div>
              )}

              {/* Điều kiện để quân nhân xem được mã */}
              {(!hasFingerprint || (hasPin && !viewable)) && (
                <div className="p-3 mb-3 rounded-xl border flex items-start gap-2 bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {!hasFingerprint && 'Quân nhân chưa đăng ký vân tay nên không xem lại được mã PIN. '}
                    {hasPin && !viewable && 'Mã hiện tại cấp theo cơ chế cũ, chưa xem lại được; nếu quân nhân đã quên, hãy đổi mã mới.'}
                  </span>
                </div>
              )}

              {!hasPin ? (
                <button type="button" onClick={() => handleIssue(false)} disabled={loading} className={PRIMARY}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  <span>Cấp mã PIN</span>
                </button>
              ) : confirmRotate ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                    Đổi mã mới sẽ làm mã đang dùng hết hiệu lực ngay. Tiếp tục?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setConfirmRotate(false)} disabled={loading} className={SECONDARY}>Hủy</button>
                    <button type="button" onClick={() => handleIssue(true)} disabled={loading} className="!min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50">
                      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>Đổi mã mới</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <button type="button" onClick={() => handleIssue(false)} disabled={loading || !viewable} className={PRIMARY}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                    <span>Cho quân nhân xem lại mã PIN</span>
                  </button>
                  <button type="button" onClick={() => setConfirmRotate(true)} disabled={loading || !hasFingerprint} className={SECONDARY}>
                    <RefreshCw className="w-4 h-4" />
                    <span>Đổi mã PIN mới</span>
                  </button>
                </div>
              )}

              <div className="mt-3 text-[11px] px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                Hệ thống tự sinh mã 6 số. <strong>Người cấp không nhìn thấy mã</strong>; chỉ quân nhân xem được ở nút chuông.
              </div>
            </>
          ) : (
            <>
              <div className="p-4 rounded-xl border mb-4 flex items-start gap-2 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{doneMessage}</span>
              </div>

              <button type="button" onClick={handleClose} className={PRIMARY}>
                Đóng
              </button>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
};

export default PinManageModal;