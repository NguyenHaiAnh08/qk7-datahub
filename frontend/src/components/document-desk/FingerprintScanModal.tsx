import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fingerprint,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Cable,
} from 'lucide-react';
import { fingerprintService } from '../../services/fingerprintService';

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
  const [attempt, setAttempt] = useState(0);
  const [needsEnroll, setNeedsEnroll] = useState(false);

  useEffect(() => {
    if (!open) return;
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
      setPhase('success');
      setTimeout(() => onSuccess(res.fingerprint_token!), 700);
    } catch (err: any) {
      const msg = err.message || 'Xác thực thất bại';
      if (err.data?.agent_offline) {
        setError('Chưa kết nối máy quét vân tay. Vui lòng bật Fingerprint Agent trên máy này.');
      } else if (err.data?.needs_enroll) {
        setError('Bạn chưa đăng ký vân tay. Vui lòng liên hệ quản trị viên để đăng ký.');
        setNeedsEnroll(true);
      } else if (err.status === 408) {
        setError('Hết thời gian chờ quét. Vui lòng thử lại.');
      } else {
        setError(msg);
      }
      setPhase('error');
    }
  };

  const handleRetry = () => {
    setAttempt((n) => n + 1);
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
                  Đặt ngón tay lên máy quét
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Vui lòng đặt ngón tay đã đăng ký lên đầu đọc ZK9500
                </p>
                <div className="flex items-center gap-2 text-[11px] text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/30 px-3 py-1.5 rounded-full">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Đang chờ quét vân tay...
                </div>
              </>
            )}

            {phase === 'success' && (
              <>
                <div className="w-24 h-24 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-5">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white mb-1">
                  Xác thực thành công
                </h4>
                {score !== null && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                    Score: {score}
                  </p>
                )}
              </>
            )}

            {phase === 'error' && (
              <>
                <div className="w-24 h-24 rounded-full bg-rose-500/15 border-2 border-rose-500/40 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-5">
                  {needsEnroll ? (
                    <Cable className="w-12 h-12" />
                  ) : (
                    <AlertCircle className="w-12 h-12" />
                  )}
                </div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white mb-1">
                  {needsEnroll ? 'Chưa đăng ký vân tay' : 'Xác thực thất bại'}
                </h4>
                <p className="text-xs text-rose-600 dark:text-rose-400 max-w-xs">
                  {error}
                </p>
              </>
            )}
          </div>

          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <button
              onClick={onCancel}
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
                Thử lại
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};