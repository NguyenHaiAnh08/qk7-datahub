import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Cable,
  Fingerprint,
} from 'lucide-react';
import { fingerprintService } from '../../services/fingerprintService';
import { TouchIDFingerprint } from '../common/TouchIDFingerprint';
import { CircularSpinner } from '../users/FingerprintEnrollModal';

export interface FingerprintScanModalProps {
  open: boolean;
  fileId: string;
  onSuccess: (fingerprintToken: string) => void;
  onCancel: () => void;
}

type Phase = 'scanning' | 'success' | 'error';

export const FingerprintScanModal: React.FC<FingerprintScanModalProps> = ({
  open,
  fileId,
  onSuccess,
  onCancel,
}) => {
  const [phase, setPhase] = useState<Phase>('scanning');
  const [error, setError] = useState<string>('');
  const [score, setScore] = useState<number | null>(null);
  const [needsEnroll, setNeedsEnroll] = useState(false);
  const [progress, setProgress] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const inFlightRef = React.useRef(false);
  const autoRetryTimerRef = React.useRef<any>(null);

  // Progressive fill animation: 0% until finger is verified, then 100%
  useEffect(() => {
    if (phase === 'success') {
      setProgress(100);
    } else {
      setProgress(0);
    }
  }, [phase]);

  // Dọn dẹp timer khi component unmount
  useEffect(() => {
    return () => {
      if (autoRetryTimerRef.current) {
        clearTimeout(autoRetryTimerRef.current);
        autoRetryTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!open) {
      inFlightRef.current = false;
      if (autoRetryTimerRef.current) {
        clearTimeout(autoRetryTimerRef.current);
        autoRetryTimerRef.current = null;
      }
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setPhase('scanning');
    setError('');
    setScore(null);
    setNeedsEnroll(false);
    triggerScan();
    // eslint-disable-next-line
  }, [open, fileId, attempt]);

  const triggerScan = async () => {
    try {
      let deviceId: string;
      try {
        deviceId = await fingerprintService.getLocalDeviceId(2000);
      } catch {
        setError(
          'Chưa kết nối máy quét vân tay. Vui lòng bật Fingerprint Agent trên máy này.'
        );
        setPhase('error');
        return;
      }

      const res = await fingerprintService.verify(fileId, deviceId);

      if (!res.required) {
        setPhase('success');
        onSuccess('');
        return;
      }
      if (!res.fingerprint_token) {
        throw new Error('Không nhận được token');
      }

      setScore(res.score ?? null);
      setProgress(100);
      setPhase('success');
      setTimeout(() => onSuccess(res.fingerprint_token!), 900);
    } catch (err: any) {
  const msg = err.message || 'Xác thực thất bại';
  const isAgentOffline = Boolean(err.data?.agent_offline);
  const isNeedsEnroll = Boolean(err.data?.needs_enroll);
  const isCancelled = Boolean(err.data?.cancelled);

    // CANCELLED: request bị request mới thay thế → KHÔNG hiện lỗi, tự retry nhanh
    if (isCancelled) {
      console.log('[FingerprintScan] Request bị cancel bởi job mới, retry sau 200ms');
      if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
      autoRetryTimerRef.current = setTimeout(() => {
        handleRetry();
      }, 200);
      return;
    }

    if (isAgentOffline) {
      setError('Chưa kết nối máy quét vân tay. Vui lòng bật Fingerprint Agent trên máy này.');
      setPhase('error');
    } else if (isNeedsEnroll) {
      setError('Bạn chưa đăng ký vân tay. Vui lòng liên hệ quản trị viên để đăng ký.');
      setNeedsEnroll(true);
      setPhase('error');
    } else {
      const cleanMsg = msg.replace(/\s*\(score=\d+\)/gi, '');
      setError(cleanMsg || 'Vân tay không khớp. Vui lòng thử lại.');
      setPhase('error');

      if (autoRetryTimerRef.current) {
        clearTimeout(autoRetryTimerRef.current);
      }
      autoRetryTimerRef.current = setTimeout(() => {
        handleRetry();
      }, 1200);
    }
  } finally {
      inFlightRef.current = false;
    }
  };

  const handleRetry = () => {
    if (autoRetryTimerRef.current) {
      clearTimeout(autoRetryTimerRef.current);
      autoRetryTimerRef.current = null;
    }
    inFlightRef.current = false;
    setProgress(0);
    setAttempt((n) => n + 1);
  };

  const handleCancel = () => {
    if (autoRetryTimerRef.current) {
      clearTimeout(autoRetryTimerRef.current);
      autoRetryTimerRef.current = null;
    }
    inFlightRef.current = false;
    onCancel();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
        >
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Fingerprint className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Xác Thực Vân Tay
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tài liệu Mật / Tối mật / Tuyệt mật
                </p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 flex flex-col items-center text-center min-h-[310px] justify-center">
            {/* Apple Touch ID Fingerprint Graphic */}
            <TouchIDFingerprint
              phase={phase}
              progress={progress}
              size="md"
              className="mb-4"
            />

            {phase === 'scanning' && (
              <>
                <h4 className="font-bold text-base text-slate-900 dark:text-white mb-1">
                  Đặt ngón tay lên máy quét
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 max-w-xs">
                  Vui lòng đặt ngón tay đã đăng ký lên đầu đọc ZK9500
                </p>
                <div className="inline-flex items-center gap-2 text-[11px] text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-3.5 py-1.5 rounded-full font-medium">
                  <CircularSpinner size={12} className="text-red-500 shrink-0" strokeWidth={2.8} />
                  <span>Đang nhận diện vân tay...</span>
                </div>
              </>
            )}

            {phase === 'success' && (
              <>
                <div className="flex items-center justify-center gap-1.5 mb-1 text-emerald-600 dark:text-emerald-400 font-bold text-base">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Quét vân tay thành công</span>
                </div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  Đang mở tài liệu...
                </p>
              </>
            )}

            {phase === 'error' && (
              <>
                <div className="flex items-center justify-center gap-1.5 mb-1 text-rose-500 font-bold text-base">
                  {needsEnroll ? (
                    <Cable className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                  <span>{needsEnroll ? 'Chưa đăng ký vân tay' : 'Xác thực thất bại'}</span>
                </div>
                <p className="text-xs text-rose-600 dark:text-rose-400 max-w-xs">
                  {error}
                </p>
                {!needsEnroll && !error.includes('Chưa kết nối') && (
                  <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 font-medium">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang tự động quét lại... Đặt ngón tay lên cảm biến</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            >
              Hủy
            </button>
            {phase === 'error' && !needsEnroll && (
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-md shadow-purple-600/30 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Quét ngay
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};