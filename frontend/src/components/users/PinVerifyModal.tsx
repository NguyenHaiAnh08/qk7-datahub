import { createPortal } from 'react-dom';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ShieldCheck, KeyRound, X, Loader2, AlertTriangle } from 'lucide-react';
import { pinService } from '../../services/pinService';
import { userService } from '../../services/userService';
import { toast } from '../common/Toast';

export interface PinVerifyModalProps {
  open: boolean;
  pinChallengeToken: string;
  securityLevelId: number;
  documentLabel?: string;
  onSuccess: (fingerprintToken: string) => void;
  onCancel: () => void;
}

const PIN_LENGTH = 6;

export const PinVerifyModal: React.FC<PinVerifyModalProps> = ({
  open,
  pinChallengeToken,
  securityLevelId,
  documentLabel,
  onSuccess,
  onCancel,
}) => {
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shakeKey, setShakeKey] = useState(0);
  const [pinRequestSending, setPinRequestSending] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  // ✅ Nhận diện lỗi rate-limit (khớp message "Quá nhiều lần nhập mã PIN...")
  const isRateLimitError = /quá nhiều|rate.?limit|thử lại sau/i.test(error);

  // Reset state khi mở modal
  useEffect(() => {
    if (open) {
      setDigits(Array(PIN_LENGTH).fill(''));
      setError('');
      setLoading(false);
      setPinRequestSending(false);
      setTimeout(() => inputsRef.current[0]?.focus(), 200);
    }
  }, [open]);

  // Safety-net: khi modal đóng (open true → false), ép blur ô input đang focus
  // để password manager không cache giá trị PIN
  useEffect(() => {
    if (!open) {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  }, [open]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    if (error) setError('');
    const char = value.slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    if (char && index < PIN_LENGTH - 1) inputsRef.current[index + 1]?.focus();
    if (next.every((d) => d) && char) void submit(next.join(''));
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) inputsRef.current[index - 1]?.focus();
    else if (e.key === 'ArrowLeft' && index > 0) inputsRef.current[index - 1]?.focus();
    else if (e.key === 'ArrowRight' && index < PIN_LENGTH - 1) inputsRef.current[index + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH);
    if (text.length === PIN_LENGTH) {
      e.preventDefault();
      setDigits(text.split(''));
      void submit(text);
    }
  };

  const submit = useCallback(
    async (value: string) => {
      if (loading) return;
      if (value.length !== PIN_LENGTH) {
        setError('Mã PIN phải đủ 6 chữ số');
        setShakeKey((k) => k + 1);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const res = await pinService.verify(pinChallengeToken, value);
        if (res.success && res.fingerprint_token) {
          // ✅ Blur trước khi bàn giao token → tránh browser "nhớ" ô PIN
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          setDigits(Array(PIN_LENGTH).fill(''));
          onSuccess(res.fingerprint_token);
        } else {
          throw new Error('Không nhận được token sau xác thực PIN');
        }
      } catch (err: any) {
        setError(err?.message || 'Xác thực PIN thất bại');
        setShakeKey((k) => k + 1);
        setDigits(Array(PIN_LENGTH).fill(''));
        setTimeout(() => inputsRef.current[0]?.focus(), 100);
      } finally {
        setLoading(false);
      }
    },
    [loading, pinChallengeToken, onSuccess]
  );

  // ✅ Đóng modal AN TOÀN: blur + clear trước khi gọi onCancel
  const handleClose = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setDigits(Array(PIN_LENGTH).fill(''));
    setError('');
    onCancel();
  }, [onCancel]);

  // ✅ Gửi yêu cầu cấp lại PIN khi user quên
  const handleForgotPin = async () => {
    if (pinRequestSending || loading) return;
    setPinRequestSending(true);
    try {
      await userService.requestPin(documentLabel || '');
      toast.success('Đã gửi yêu cầu cấp lại PIN đến Admin!');
      handleClose();
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi gửi yêu cầu cấp lại PIN');
      setPinRequestSending(false);
    }
  };

  if (!open) return null;

  const modal = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={loading ? undefined : handleClose}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16, transition: { duration: 0.15 } }}
          transition={{ type: 'spring', stiffness: 380, damping: 26, mass: 0.75 }}
          className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-[#0c1420]/95 border border-emerald-200 dark:border-emerald-500/30"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-400/40 text-amber-700 dark:text-amber-300">
                <KeyRound className="w-5 h-5" strokeWidth={2.2} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Xác Thực Mã PIN Cấp {securityLevelId}</h3>
                <p className="text-[11px] mt-0.5 text-slate-500 dark:text-slate-400">
                  {securityLevelId >= 5 ? 'TUYỆT MẬT' : 'TỐI MẬT'} · Nhập PIN 6 số do Admin cấp
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

          <div className="flex items-center gap-2 text-[11px] px-3 py-2 rounded-lg mb-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Vân tay đã hợp lệ — còn bước PIN cuối cùng</span>
          </div>

          {documentLabel && (
            <div className="text-xs px-3 py-2 rounded-lg mb-4 truncate bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
              <span className="font-semibold">Văn bản:</span> {documentLabel}
            </div>
          )}

          {/* 6 ô PIN */}
          <div key={shakeKey} className={shakeKey > 0 ? 'animate-[pinShake_0.42s_ease-in-out]' : ''}>
            <div className="grid grid-cols-6 gap-2 mb-3">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { inputsRef.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="new-password"
                  name={`pin-digit-${i}`}
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  disabled={loading}
                  className={`w-full aspect-square text-center text-xl font-bold rounded-xl border-2 font-mono tabular-nums transition-all focus:outline-none disabled:opacity-50 ${
                    error
                      ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200'
                      : d
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300'
                      : 'border-slate-300 bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-900 dark:text-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/30'
                  }`}
                  aria-label={`Chữ số ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Hiển thị lỗi — style riêng cho rate-limit */}
          {error && (
            isRateLimitError ? (
              <div className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl mb-3 text-xs font-semibold border border-rose-500/20 text-center">
                ⚠️ Quá nhiều lần nhập mã PIN. Vui lòng thử lại sau 1 phút.
              </div>
            ) : (
              <div className="flex items-start gap-1.5 text-xs px-3 py-2 rounded-lg mb-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 text-rose-700 dark:text-rose-300" role="alert">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )
          )}

          {/* ✅ Khi có lỗi → hiện khu vực "Quên PIN + Hotline" */}
          {error && (
            <div className="flex flex-col gap-2 mt-1 mb-4 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleForgotPin}
                disabled={loading || pinRequestSending}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
              >
                {pinRequestSending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <KeyRound className="w-3.5 h-3.5" />
                )}
                <span>
                  {pinRequestSending ? 'Đang gửi yêu cầu...' : 'Quên mã PIN? Gửi yêu cầu cấp lại'}
                </span>
              </button>

              <p className="text-center text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Hoặc liên hệ Hotline Admin:{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">0987.654.321</strong>
              </p>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 mt-5 pt-3 border-t border-slate-200/60 dark:border-slate-800/60">
            <div className="text-[10px] text-slate-400 dark:text-slate-500">Bước 2/2 · PIN 6 số</div>
            <div className="flex items-center gap-2">
              <button
                type="button" onClick={handleClose} disabled={loading}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer disabled:opacity-40"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void submit(digits.join(''))}
                disabled={loading || digits.join('').length !== PIN_LENGTH}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white transition cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] hover:from-[#166534] hover:to-[#15803d] border border-amber-500/30 shadow-md"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                <span>Xác nhận</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
};

export default PinVerifyModal;