import { createPortal } from 'react-dom';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, Copy, Check, RefreshCw, X, Loader2, AlertTriangle, KeySquare } from 'lucide-react';
import { userService } from '../../services/userService';
import { User } from '../../types/user';

export interface PinManageModalProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onChanged?: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const PinManageModal: React.FC<PinManageModalProps> = ({
  open, user, onClose, onChanged, onToast,
}) => {
  const [loading, setLoading] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [copied, setCopied] = useState(false);
  // ✅ state mới: lưu lỗi để hiển thị ngay trên modal
  const [errorMsg, setErrorMsg] = useState('');

  const hasPin = user?.has_pin === true;

  const handleGenerate = async () => {
    if (!user) return;
    setLoading(true);
    setErrorMsg(''); // ✅ Reset lỗi trước mỗi lần sinh PIN
    try {
      const res = await userService.generatePin(user.user_id);
      setNewPin(res.pin);
      onToast(`Đã cấp PIN mới cho ${res.full_name}. Hãy ghi lại và trao trực tiếp!`, 'success');
      onChanged?.();
    } catch (err: any) {
      const msg = err.message || 'Lỗi sinh PIN';
      setErrorMsg(msg);         // ✅ Hiển thị lỗi trực tiếp trên modal (phòng khi toast bị khuất)
      onToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!newPin) return;
    navigator.clipboard.writeText(newPin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setNewPin('');
    setCopied(false);
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

          {!newPin ? (
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
                    {hasPin ? 'Quân nhân đã có thể mở tài liệu Cấp 4-5' : 'Quân nhân sẽ bị chặn khi mở Cấp 4-5'}
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

              <button
                type="button" onClick={handleGenerate} disabled={loading}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] hover:from-[#166534] hover:to-[#15803d] border border-amber-500/30 shadow-md"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span>{hasPin ? 'Random PIN mới (ghi đè PIN cũ)' : 'Random PIN mới'}</span>
              </button>

              <div className="mt-3 text-[10px] px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                <strong>Lưu ý:</strong> Hệ thống chỉ random PIN 6 số, không cho nhập tay. PIN chỉ hiển thị 1 lần duy nhất.
              </div>
            </>
          ) : (
            <>
              <div className="p-3 rounded-xl border text-center mb-4 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40">
                <div className="text-[11px] font-semibold mb-2 text-emerald-700 dark:text-emerald-300">
                  MÃ PIN MỚI CỦA QUÂN NHÂN
                </div>
                <div className="text-3xl font-bold tracking-[0.4em] font-mono tabular-nums py-3 text-emerald-900 dark:text-white">
                  {newPin}
                </div>
                <button
                  type="button" onClick={handleCopy}
                  className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
                </button>
              </div>

              <div className="flex items-start gap-2 text-[11px] px-3 py-2 rounded-lg mb-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 text-rose-700 dark:text-rose-300">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span><strong>Chỉ hiển thị 1 lần!</strong> Ghi lại và trao <strong>trực tiếp</strong> cho quân nhân. Không thể khôi phục PIN này.</span>
              </div>

              <button
                type="button" onClick={handleClose}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition cursor-pointer active:scale-95 bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] hover:from-[#166534] hover:to-[#15803d] border border-amber-500/30 shadow-md"
              >
                Đã ghi lại — Đóng
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