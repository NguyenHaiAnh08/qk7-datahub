import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fingerprint,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
} from 'lucide-react';
import { fingerprintService } from '../../services/fingerprintService';

export interface FingerprintEnrollModalProps {
  open: boolean;
  userId: string;
  userName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

type Phase = 'scanning' | 'success' | 'error';

export const FingerprintEnrollModal: React.FC<FingerprintEnrollModalProps> = ({
  open,
  userId,
  userName,
  onSuccess,
  onCancel,
}) => {
  const [phase, setPhase] = useState<Phase>('scanning');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    setPhase('scanning');
    setError('');
    triggerEnroll();
    // eslint-disable-next-line
  }, [open, userId, attempt]);

  const triggerEnroll = async () => {
    try {
      let deviceId: string;
      try {
        deviceId = await fingerprintService.getLocalDeviceId(2000);
      } catch {
        setError('Máy này chưa cài Fingerprint Agent. Vui lòng bật Agent trước khi enroll.');
        setPhase('error');
        return;
      }

      await fingerprintService.enrollForUser(userId, deviceId);
      setPhase('success');
      setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch (err: any) {
      const msg = err.message || 'Enroll thất bại';
      if (err.data?.agent_offline) {
        setError('Chưa kết nối máy quét vân tay.');
      } else if (err.status === 408) {
        setError('Hết thời gian chờ quét 3 lần (60s). Vui lòng thử lại.');
      } else {
        setError(msg);
      }
      setPhase('error');
    }
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

          <div className="p-8 flex flex-col items-center text-center min-h-[280px] justify-center">
            {phase === 'scanning' && (
              <>
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-24 h-24 rounded-full bg-purple-500/15 border-2 border-purple-500/40 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-5"
                >
                  <Fingerprint className="w-12 h-12" />
                </motion.div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white mb-1">
                  Đặt tay lên máy quét 3 lần
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 max-w-xs">
                  Cùng một ngón tay, nhấc ra và đặt lại giữa các lần quét
                </p>
                <div className="flex items-center gap-2 text-[11px] text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/30 px-3 py-1.5 rounded-full">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Đang chờ quét 3 lần (tối đa 60s)...
                </div>
              </>
            )}

            {phase === 'success' && (
              <>
                <div className="w-24 h-24 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-5">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white mb-1">
                  Đăng ký thành công
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Vân tay đã được lưu cho {userName}
                </p>
              </>
            )}

            {phase === 'error' && (
              <>
                <div className="w-24 h-24 rounded-full bg-rose-500/15 border-2 border-rose-500/40 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-5">
                  <AlertCircle className="w-12 h-12" />
                </div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white mb-1">
                  Đăng ký thất bại
                </h4>
                <p className="text-xs text-rose-600 dark:text-rose-400 max-w-xs">{error}</p>
              </>
            )}
          </div>

          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            >
              Đóng
            </button>
            {phase === 'error' && (
              <button
                onClick={() => setAttempt((n) => n + 1)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-md shadow-purple-600/30 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Thử lại
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};