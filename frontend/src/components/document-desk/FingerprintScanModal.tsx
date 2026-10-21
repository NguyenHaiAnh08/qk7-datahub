import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
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

// ⚠️ Giới hạn auto-retry để tránh spam khi user không đặt tay
const MAX_AUTO_RETRY = 2;

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
  const [retryExhausted, setRetryExhausted] = useState(false);

  const inFlightRef = useRef(false);
  const autoRetryTimerRef = useRef<any>(null);
  const abortRef = useRef<AbortController | null>(null);      // ⚠️ MỚI
  const retryCountRef = useRef(0);                             // ⚠️ MỚI
  const mountedRef = useRef(true);

  // Progressive fill animation
  useEffect(() => {
    if (phase === 'success') {
      setProgress(100);
    } else {
      setProgress(0);
    }
  }, [phase]);

  // Cleanup khi unmount — abort mọi request + timer
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();                              // ⚠️ MỚI
      abortRef.current = null;
      if (autoRetryTimerRef.current) {
        clearTimeout(autoRetryTimerRef.current);
        autoRetryTimerRef.current = null;
      }
    };
  }, []);

  // Trigger scan khi mở modal hoặc retry
  useEffect(() => {
    if (!open) {
      inFlightRef.current = false;
      retryCountRef.current = 0;
      abortRef.current?.abort();                              // ⚠️ MỚI
      abortRef.current = null;
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
    setRetryExhausted(false);
    triggerScan();
    // eslint-disable-next-line
  }, [open, fileId, attempt]);

  const triggerScan = async () => {
    // ⚠️ Hủy request cũ (nếu có) trước khi bắt đầu request mới
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;

    try {
      let deviceId: string;
      try {
        deviceId = await fingerprintService.getLocalDeviceId(2000);
      } catch {
        // ⚠️ Nếu user đã đóng modal trong 2s lấy device-id → silent exit
        if (signal.aborted || !mountedRef.current) return;
        setError('Chưa kết nối máy quét vân tay. Vui lòng bật Fingerprint Agent trên máy này.');
        setPhase('error');
        return;
      }

      if (signal.aborted || !mountedRef.current) return;

      // ⚠️ Truyền signal — khi modal đóng, request này bị abort NGAY
      const res = await fingerprintService.verify(fileId, deviceId, signal);

      // ⚠️ Nếu bị abort trong lúc chờ verify → im lặng thoát
      if (signal.aborted || !mountedRef.current) return;

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
      retryCountRef.current = 0;

      // ⚠️ Delay 900ms rồi mới mở file — nhưng phải check modal còn mở không
      setTimeout(() => {
        if (mountedRef.current && !signal.aborted) {
          onSuccess(res.fingerprint_token!);
        }
      }, 900);
    } catch (err: any) {
      // ⚠️ QUAN TRỌNG: AbortError = user đã đóng modal
      // → silent exit, KHÔNG setState, KHÔNG retry, KHÔNG hiện lỗi
      if (err?.name === 'AbortError' || signal.aborted || !mountedRef.current) {
        return;
      }

      const msg = err.message || 'Xác thực thất bại';
      const isAgentOffline = Boolean(err.data?.agent_offline);
      const isNeedsEnroll = Boolean(err.data?.needs_enroll);
      const isCancelled = Boolean(err.data?.cancelled) || err.message === 'CANCELLED';

      if (isCancelled) {
        if (retryCountRef.current < 1) {
          retryCountRef.current += 1;
          if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
          autoRetryTimerRef.current = setTimeout(() => {
            if (mountedRef.current && !signal.aborted) handleRetryInternal();
          }, 800);
          return;
        }
        setError('Quá trình quét bị gián đoạn. Vui lòng bấm Thử lại.');
        setPhase('error');
        setRetryExhausted(true);
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

        // ⚠️ Auto-retry có GIỚI HẠN (2 lần), tránh loop vô hạn
        if (retryCountRef.current < MAX_AUTO_RETRY) {
          retryCountRef.current += 1;
          if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
          const delay = 1200 * retryCountRef.current; // 1.2s, 2.4s
          autoRetryTimerRef.current = setTimeout(() => {
            if (mountedRef.current) handleRetryInternal();
          }, delay);
        } else {
          setRetryExhausted(true);
        }
      }
    } finally {
      inFlightRef.current = false;
    }
  };

  const handleRetryInternal = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (autoRetryTimerRef.current) {
      clearTimeout(autoRetryTimerRef.current);
      autoRetryTimerRef.current = null;
    }
    inFlightRef.current = false;
    setProgress(0);
    setAttempt((n) => n + 1);
  };

  const handleRetry = () => {
    retryCountRef.current = 0;
    setRetryExhausted(false);
    handleRetryInternal();
  };

  const handleCancel = () => {
    // ⚠️ BƯỚC QUAN TRỌNG NHẤT: abort request đang bay TRƯỚC KHI đóng modal
    abortRef.current?.abort();
    abortRef.current = null;
    if (autoRetryTimerRef.current) {
      clearTimeout(autoRetryTimerRef.current);
      autoRetryTimerRef.current = null;
    }
    inFlightRef.current = false;
    retryCountRef.current = 0;
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
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md max-w-[calc(100vw-32px)] mx-auto overflow-hidden shadow-2xl"
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

                {/* ⚠️ Đổi text theo trạng thái retry */}
                {!needsEnroll && !error.includes('Chưa kết nối') && (
                  retryExhausted ? (
                    <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Đã hết lượt tự động. Vui lòng bấm "Quét ngay" để thử lại.</span>
                    </div>
                  ) : (
                    <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 font-medium">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang tự động quét lại... Đặt ngón tay lên cảm biến</span>
                    </div>
                  )
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