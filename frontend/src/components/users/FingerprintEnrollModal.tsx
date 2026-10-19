import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Fingerprint,
} from 'lucide-react';
import { fingerprintService } from '../../services/fingerprintService';
import { TouchIDFingerprint } from '../common/TouchIDFingerprint';

export interface FingerprintEnrollModalProps {
  open: boolean;
  userId: string;
  userName: string;
  hasFingerprint?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

type Phase = 'checking' | 'confirm_overwrite' | 'scanning' | 'success' | 'error';

export const FingerprintEnrollModal: React.FC<FingerprintEnrollModalProps> = ({
  open,
  userId,
  userName,
  hasFingerprint: propHasFingerprint,
  onSuccess,
  onCancel,
}) => {
  const [phase, setPhase] = useState<Phase>('checking');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState(0);

  const inFlightRef = useRef(false);

  // Progressive fill animation simulating Touch ID ridge scanning
  useEffect(() => {
    let timer: any;
    if (phase === 'scanning') {
      setProgress(25);
      timer = setInterval(() => {
        setProgress((prev) => (prev < 80 ? prev + 15 : prev));
      }, 3000);
    } else if (phase === 'success') {
      setProgress(100);
    } else if (phase === 'error' || phase === 'confirm_overwrite' || phase === 'checking') {
      setProgress(0);
    }
    return () => clearInterval(timer);
  }, [phase]);

  // Check fingerprint state on open
  useEffect(() => {
    if (!open) {
      inFlightRef.current = false;
      return;
    }

    const checkAndStart = async () => {
      setError('');
      setProgress(0);

      // If prop already indicates user has fingerprint
      if (propHasFingerprint === true) {
        setPhase('confirm_overwrite');
        return;
      }
      if (propHasFingerprint === false) {
        setPhase('scanning');
        triggerEnroll();
        return;
      }

      // If undefined, query backend checkStatus
      setPhase('checking');
      try {
        const res = await fingerprintService.checkStatus(userId);
        if (res.has_fingerprint) {
          setPhase('confirm_overwrite');
        } else {
          setPhase('scanning');
          triggerEnroll();
        }
      } catch {
        // Fallback: start scanning directly
        setPhase('scanning');
        triggerEnroll();
      }
    };

    checkAndStart();
    // eslint-disable-next-line
  }, [open, userId, attempt]);

  const triggerEnroll = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setError('');

    try {
      let deviceId: string;
      try {
        deviceId = await fingerprintService.getLocalDeviceId(2000);
      } catch {
        setError('Máy chưa bật Fingerprint Agent. Vui lòng bật Agent trước khi thực hiện thao tác.');
        setPhase('error');
        return;
      }

      await fingerprintService.enrollForUser(userId, deviceId);
      setProgress(100);
      setPhase('success');
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      const msg = err.message || 'Enroll thất bại';
      if (err.data?.agent_offline) {
        setError('Chưa kết nối máy quét vân tay. Vui lòng bật Fingerprint Agent.');
      } else if (err.status === 408) {
        setError('Hết thời gian chờ quét 3 lần (60s). Vui lòng thử lại.');
      } else {
        setError(msg.replace(/\s*\(score=\d+\)/gi, ''));
      }
      setPhase('error');
    } finally {
      inFlightRef.current = false;
    }
  };

  const handleConfirmOverwrite = () => {
    inFlightRef.current = false;
    setPhase('scanning');
    triggerEnroll();
  };

  const handleRetry = () => {
    inFlightRef.current = false;
    setProgress(0);
    setAttempt((n) => n + 1);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div
        key="fingerprint-enroll-modal-overlay"
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
      >
        <motion.div
          key="fingerprint-enroll-modal-card"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
        >
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                  phase === 'confirm_overwrite'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                    : 'bg-red-500/10 border-red-500/30 text-red-500'
                }`}
              >
                {phase === 'scanning' ? (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
                ) : (
                  <Fingerprint className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Đăng Ký Vân Tay
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {userName} ({userId})
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 flex flex-col items-center text-center min-h-[310px] justify-center">
            {/* Checking status */}
            {phase === 'checking' && (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600 dark:text-purple-400" />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Đang kiểm tra dữ liệu vân tay của người dùng...
                </p>
              </div>
            )}

            {/* Overwrite Confirmation */}
            {phase === 'confirm_overwrite' && (
              <>
                <TouchIDFingerprint
                  phase="idle"
                  progress={100}
                  size="sm"
                  className="mb-3.5 opacity-90"
                />
                <h4 className="font-bold text-base text-slate-900 dark:text-white mb-1.5">
                  Đã có dữ liệu vân tay
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 whitespace-nowrap leading-relaxed">
                  Tài khoản của <strong className="text-slate-800 dark:text-slate-200">{userName}</strong> hiện đã có vân tay trên hệ thống.
                </p>
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs px-3.5 py-2.5 rounded-xl text-left max-w-sm w-full flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    Đồng chí có muốn <strong>thay thế và dán đè</strong> vân tay cũ bằng vân tay mới không?
                  </span>
                </div>
              </>
            )}

            {/* Scanning In Progress */}
            {phase === 'scanning' && (
              <>
                <TouchIDFingerprint
                  phase={phase}
                  progress={progress}
                  size="md"
                  className="mb-4"
                />
                <h4 className="font-bold text-base text-slate-900 dark:text-white mb-1">
                  Đặt tay lên máy quét 3 lần
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 max-w-xs">
                  Cùng một ngón tay, nhấc ra và đặt lại giữa các lần quét
                </p>
                <div className="flex items-center gap-2 text-[11px] text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-3.5 py-1.5 rounded-full font-medium">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Đang quét và ghi nhận đường vân mới...
                </div>
              </>
            )}

            {/* Success */}
            {phase === 'success' && (
              <>
                <TouchIDFingerprint
                  phase="success"
                  progress={100}
                  size="md"
                  className="mb-4"
                />
                <div className="flex items-center justify-center gap-1.5 mb-1 text-emerald-600 dark:text-emerald-400 font-bold text-base">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Cập nhật vân tay thành công</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Đã ghi đè mẫu vân tay mới cho {userName}
                </p>
              </>
            )}

            {/* Error */}
            {phase === 'error' && (
              <>
                <div className="w-20 h-20 rounded-full bg-rose-500/15 border-2 border-rose-500/40 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4">
                  <AlertCircle className="w-10 h-10" />
                </div>
                <div className="flex items-center justify-center gap-1.5 mb-1 text-rose-500 font-bold text-base">
                  <span>Đăng ký thất bại</span>
                </div>
                <p className="text-xs text-rose-600 dark:text-rose-400 max-w-xs">{error}</p>
              </>
            )}
          </div>

          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            {phase === 'confirm_overwrite' ? (
              <>
                <button
                  onClick={onCancel}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                >
                  Không, Thoát
                </button>
                <button
                  onClick={handleConfirmOverwrite}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-md shadow-purple-600/30 cursor-pointer"
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                  Thay thế vân tay cũ
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onCancel}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                >
                  {phase === 'success' ? 'Hoàn tất' : 'Hủy bỏ'}
                </button>
                {phase === 'error' && (
                  <button
                    onClick={handleRetry}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-md shadow-purple-600/30 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Thử lại
                  </button>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};