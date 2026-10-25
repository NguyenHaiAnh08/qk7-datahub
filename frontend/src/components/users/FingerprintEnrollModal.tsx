import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, animate } from 'framer-motion';
import {
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

/**
 * CircularSpinner: SVG loading spinner perfectly centered and circular,
 * with no subpixel border-radius artifacts or lines drawn outside.
 */
export const CircularSpinner: React.FC<{
  size?: number;
  className?: string;
  strokeWidth?: number;
}> = ({ size = 16, className = 'text-red-500', strokeWidth = 2.5 }) => (
  <svg
    className={`animate-spin ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      className="opacity-20"
    />
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeDasharray="26 56"
      className="opacity-95"
    />
  </svg>
);

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
  const [enrollStep, setEnrollStep] = useState(0); // 0: chờ lần 1, 1: xong lần 1, 2: xong lần 2, 3: xong lần 3
  const [progress, setProgress] = useState(0);

  const inFlightRef = useRef(false);
  const progressRef = useRef(0);
  const currentStepRef = useRef(0);
  const deviceIdRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const animControlsRef = useRef<any>(null);
  const pollTimerRef = useRef<any>(null);

  const animateToProgress = (target: number, duration: number = 0.65) => {
    if (animControlsRef.current) {
      animControlsRef.current.stop();
    }
    animControlsRef.current = animate(progressRef.current, target, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        progressRef.current = latest;
        setProgress(latest);
      },
    });
  };

  // Progressive fill animation simulating Touch ID ridge scanning
  useEffect(() => {
    if (phase !== 'scanning') {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (phase === 'success') {
        currentStepRef.current = 3;
        setEnrollStep(3);
        animateToProgress(100, 0.4);
      } else if (phase === 'error' || phase === 'confirm_overwrite' || phase === 'checking') {
        if (animControlsRef.current) animControlsRef.current.stop();
        progressRef.current = 0;
        setProgress(0);
        setEnrollStep(0);
        currentStepRef.current = 0;
      }
      return;
    }

    // Khi bắt đầu quét: không đặt tay thì không fill màu đỏ (progress = 0)
    progressRef.current = 0;
    setProgress(0);
    setEnrollStep(0);
    currentStepRef.current = 0;

    pollTimerRef.current = setInterval(async () => {
      if (!deviceIdRef.current) return;

      const status = await fingerprintService.getEnrollStatus(deviceIdRef.current);
      if (!status || !status.enrolling) return;

      const newStep = Number(status.step) || 0;
      if (newStep > currentStepRef.current) {
        currentStepRef.current = newStep;
        setEnrollStep(newStep);
        if (newStep === 1) {
          // Lần 1: hiện đỏ 1 chút (~35%) xong dừng chờ đặt lần tiếp
          animateToProgress(35, 0.65);
        } else if (newStep === 2) {
          // Lần 2: hiện đỏ thêm (~70%) xong dừng chờ đặt lần tiếp
          animateToProgress(70, 0.65);
        } else if (newStep >= 3) {
          // Lần 3: fill đầy 100% màu đỏ
          animateToProgress(100, 0.5);
          // Đã đủ 3 lần -> dừng polling ngay
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
        }
      }
    }, 600);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [phase]);

  // Check fingerprint state on open
  useEffect(() => {
    if (!open) {
      inFlightRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    const checkAndStart = async () => {
      setError('');
      progressRef.current = 0;
      setProgress(0);
      setEnrollStep(0);
      currentStepRef.current = 0;

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

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
    // eslint-disable-next-line
  }, [open, userId]);

  const triggerEnroll = async () => {
    inFlightRef.current = true;
    setError('');

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ctrl = new AbortController();
    abortControllerRef.current = ctrl;

    try {
      let deviceId: string;
      try {
        deviceId = await fingerprintService.getLocalDeviceId(2000);
        deviceIdRef.current = deviceId;
      } catch {
        if (ctrl.signal.aborted) return;
        setError('Chưa kết nối máy quét vân tay. Vui lòng bật Fingerprint Agent trước khi thực hiện thao tác.');
        setPhase('error');
        return;
      }

      if (ctrl.signal.aborted) return;

      await fingerprintService.enrollForUser(userId, deviceId, ctrl.signal);

      if (ctrl.signal.aborted) return;

      currentStepRef.current = 3;
      setEnrollStep(3);
      animateToProgress(100, 0.4);
      setPhase('success');
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (ctrl.signal.aborted || err?.name === 'AbortError') {
        return;
      }
      if (err?.data?.cancelled || err?.message === 'CANCELLED') {
        // Bị hủy do yêu cầu mới hoặc thiết bị bận, không spam error
        return;
      }
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

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (animControlsRef.current) {
      animControlsRef.current.stop();
    }
    inFlightRef.current = false;
    onCancel();
  };

  const handleRetry = () => {
    if (animControlsRef.current) animControlsRef.current.stop();
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    inFlightRef.current = false;
    progressRef.current = 0;
    currentStepRef.current = 0;
    setProgress(0);
    setEnrollStep(0);
    setError('');
    setPhase('scanning');
    triggerEnroll();
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
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md max-w-[calc(100vw-32px)] mx-auto overflow-hidden shadow-2xl"
        >
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                  phase === 'confirm_overwrite'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                    : 'bg-red-500/10 border-red-500/30 text-red-500'
                }`}
              >
                {phase === 'scanning' ? (
                  <CircularSpinner size={16} className="text-red-500" strokeWidth={2.6} />
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
              onClick={handleCancel}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 flex flex-col items-center text-center min-h-[320px] justify-center">
            {/* Checking status */}
            {phase === 'checking' && (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <CircularSpinner size={32} className="text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
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
                {/* 3-segment progress indicator like iPhone Touch ID */}
                <div className="flex items-center justify-center gap-2 mb-3.5 w-full max-w-[210px]">
                  {[1, 2, 3].map((s) => {
                    const isDone = enrollStep >= s;
                    const isCurrent = enrollStep === s - 1;
                    return (
                      <div
                        key={s}
                        className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${
                          isDone
                            ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]'
                            : isCurrent
                            ? 'bg-red-500/40 animate-pulse'
                            : 'bg-slate-200 dark:bg-slate-800'
                        }`}
                      />
                    );
                  })}
                </div>

                <TouchIDFingerprint
                  phase={phase}
                  progress={progress}
                  pulseKey={enrollStep}
                  size="md"
                  className="mb-3.5"
                />

                <h4 className="font-bold text-base text-slate-900 dark:text-white mb-1 transition-all whitespace-nowrap">
                  {enrollStep === 0 && 'Đặt tay lên máy quét 3 lần'}
                  {enrollStep === 1 && 'Đã ghi nhận lần 1 (Lần 2/3)'}
                  {enrollStep === 2 && 'Đã ghi nhận lần 2 (Lần 3/3)'}
                  {enrollStep >= 3 && 'Hoàn tất quét 3 lần'}
                </h4>

                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 w-full whitespace-nowrap text-center transition-all">
                  {enrollStep === 0 && 'Cùng một ngón tay, đặt lên đầu đọc để bắt đầu lần 1'}
                  {enrollStep === 1 && 'Nhấc ngón tay ra và đặt lại cùng ngón tay đó để quét lần 2'}
                  {enrollStep === 2 && 'Nhấc ngón tay ra và đặt lại lần cuối cùng để hoàn tất'}
                  {enrollStep >= 3 && 'Đang hợp nhất và mã hóa dữ liệu đường vân mới...'}
                </p>

                <div className="inline-flex items-center gap-2 text-[11px] text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-3.5 py-1.5 rounded-full font-medium shadow-sm">
                  <CircularSpinner size={12} className="text-red-500 shrink-0" strokeWidth={2.8} />
                  <span>
                    {enrollStep === 0 && 'Chờ đặt ngón tay lần 1...'}
                    {enrollStep === 1 && 'Chờ nhấc ra và đặt lại lần 2...'}
                    {enrollStep === 2 && 'Chờ nhấc ra và đặt lại lần 3...'}
                    {enrollStep >= 3 && 'Đang xử lý mẫu vân tay...'}
                  </span>
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
                  onClick={handleCancel}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                >
                  Không, Thoát
                </button>
                <button
                  onClick={handleConfirmOverwrite}
                  className="px-4 py-2 bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] hover:from-[#166534] hover:to-[#15803d] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-md shadow-emerald-950/20 border border-amber-500/25 cursor-pointer"
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                  Thay thế vân tay cũ
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                >
                  {phase === 'success' ? 'Hoàn tất' : 'Hủy bỏ'}
                </button>
                {phase === 'error' && (
                  <button
                    onClick={handleRetry}
                    className="px-4 py-2 bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] hover:from-[#166534] hover:to-[#15803d] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-md shadow-emerald-950/20 border border-amber-500/25 cursor-pointer"
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