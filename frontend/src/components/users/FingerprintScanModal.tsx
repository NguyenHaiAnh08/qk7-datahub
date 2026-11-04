import { createPortal } from 'react-dom';
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Cable,
  Fingerprint,
  KeyRound,           // ← gộp vào đây
} from 'lucide-react';
import { fingerprintService } from '../../services/fingerprintService';
import { http } from '../../services/http';
import { userService } from '../../services/userService';   // ✅ FIX #1: import
import { TouchIDFingerprint } from '../common/TouchIDFingerprint';
import { CircularSpinner } from './FingerprintEnrollModal';
import { PinVerifyModal } from './PinVerifyModal';

export interface FingerprintScanModalProps {
  open: boolean;
  fileId?: string;
  purpose?: 'file_access' | 'admin_login';
  tempTicket?: string;
  onSuccess: (fingerprintToken: string) => void;
  onCancel: () => void;
  // ✅ FIX #2: thêm onToast vào interface
  onToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

type Phase = 'scanning' | 'success' | 'error';

const MAX_AUTO_RETRY = 2;

export const FingerprintScanModal: React.FC<FingerprintScanModalProps> = ({
  open,
  fileId = '',
  purpose = 'file_access',
  tempTicket,
  onSuccess,
  onCancel,
  onToast = () => {},        // ✅ FIX #2: default no-op
}) => {
  const [phase, setPhase] = useState<Phase>('scanning');
  const [error, setError] = useState<string>('');
  const [score, setScore] = useState<number | null>(null);
  const [needsEnroll, setNeedsEnroll] = useState(false);
  const [progress, setProgress] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [retryExhausted, setRetryExhausted] = useState(false);
  const [pinChallenge, setPinChallenge] = useState<{ token: string; level: number } | null>(null);
  const [pinNotSet, setPinNotSet] = useState(false);
  // ✅ state mới cho nút gửi yêu cầu cấp PIN (loading + message inline dưới nút)
  const [pinReqLoading, setPinReqLoading] = useState(false);
  const [pinReqMessage, setPinReqMessage] = useState('');

  const inFlightRef = useRef(false);
  const autoRetryTimerRef = useRef<any>(null);
  const abortRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    setProgress(phase === 'success' ? 100 : 0);
  }, [phase]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
      if (autoRetryTimerRef.current) {
        clearTimeout(autoRetryTimerRef.current);
        autoRetryTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!open) {
      inFlightRef.current = false;
      retryCountRef.current = 0;
      abortRef.current?.abort();
      abortRef.current = null;
      if (autoRetryTimerRef.current) {
        clearTimeout(autoRetryTimerRef.current);
        autoRetryTimerRef.current = null;
      }
      // ✅ FIX #5: reset state khi đóng modal để lần mở sau không dính lỗi cũ
      setPinChallenge(null);
      setPinNotSet(false);
      setRetryExhausted(false);
      setNeedsEnroll(false);
      setError('');
      setScore(null);
      setPhase('scanning');
      // ✅ reset state gửi PIN
      setPinReqLoading(false);
      setPinReqMessage('');
      return;
    }
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setPhase('scanning');
    setError('');
    setScore(null);
    setNeedsEnroll(false);
    setRetryExhausted(false);
    setPinNotSet(false);
    setPinReqMessage('');
    triggerScan();
    // eslint-disable-next-line
  }, [open, fileId, attempt]);

  const triggerScan = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;

    try {
      let deviceId: string;
      try {
        deviceId = await fingerprintService.getLocalDeviceId(2000);
      } catch {
        if (signal.aborted || !mountedRef.current) return;
        setError('Chưa kết nối máy quét vân tay. Vui lòng bật Fingerprint Agent trên máy này.');
        setPhase('error');
        return;
      }

      if (signal.aborted || !mountedRef.current) return;

      // ── Nhánh 1: 2FA admin login ──
      if (purpose === 'admin_login') {
        if (!tempTicket) {
          setError('Thiếu vé xác thực tạm thời. Vui lòng đăng nhập lại.');
          setPhase('error');
          return;
        }
        const res: any = await http('/api/auth/login/admin-fp-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ temp_ticket: tempTicket, device_id: deviceId }),
          signal,
        });
        if (signal.aborted || !mountedRef.current) return;
        setScore(res.score || 100);
        setProgress(100);
        setPhase('success');
        retryCountRef.current = 0;
        setTimeout(() => {
          if (mountedRef.current && !signal.aborted) onSuccess(res.token);
        }, 900);
        return;
      }

      // ── Nhánh 2: xác thực xem file ──
      const res = await fingerprintService.verify(fileId, deviceId, signal);
      if (signal.aborted || !mountedRef.current) return;

      if (!res.required) { setPhase('success'); onSuccess(''); return; }

      // Cấp 4-5 đã có PIN → mở modal nhập PIN
      if (res.require_pin && res.pin_challenge_token) {
        setScore(res.score ?? null);
        setProgress(100);
        setPhase('success');
        retryCountRef.current = 0;
        setPinChallenge({
          token: res.pin_challenge_token,
          level: res.security_level_id ?? 4,
        });
        return;
      }

      // Cấp 3: token có sẵn
      if (!res.fingerprint_token) throw new Error('Không nhận được token');
      setScore(res.score ?? null);
      setProgress(100);
      setPhase('success');
      retryCountRef.current = 0;
      setTimeout(() => {
        if (mountedRef.current && !signal.aborted) onSuccess(res.fingerprint_token!);
      }, 900);
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal.aborted || !mountedRef.current) return;

      const msg = err.message || 'Xác thực thất bại';
      const isAgentOffline = Boolean(
        err.data?.agent_offline ||
        err.data?.device_offline ||
        /DEVICE_OFFLINE/i.test(msg) ||
        /Không tìm thấy.+đầu đọc/i.test(msg) ||
        /Chưa kết nối máy quét/i.test(msg)
      );
      const isNeedsEnroll = Boolean(err.data?.needs_enroll);
      const isPinNotSet = Boolean(err.data?.needs_admin_pin) || err.data?.code === 'PIN_NOT_SET';
      const isTemplateCorrupted =
        err.data?.code === 'TEMPLATE_DECRYPT_FAILED' || /Template vân tay bị hỏng/i.test(msg);
      const isCancelled = Boolean(err.data?.cancelled) || err.message === 'CANCELLED';
      const isTimeout =
        Boolean(err.data?.timeout) || err.status === 408 || /Hết thời gian/i.test(msg);
      const isDeviceError = Boolean(err.data?.device_error) || /Lỗi máy quét/i.test(msg);

      console.error('[FingerprintScanModal] ❌ Lỗi xác thực vân tay:', {
        message: err.message,
        code: err.data?.code,
        details: err.data?.details,
        purpose,
        fileId,
      });

      if (isCancelled) {
        if (retryCountRef.current < 1) {
          retryCountRef.current += 1;
          if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
          autoRetryTimerRef.current = setTimeout(() => {
            if (mountedRef.current && !signal.aborted) handleRetryInternal();
          }, 800);
          return;
        }
        setError('Quá trình quét bị gián đoạn. Vui lòng bấm Quét ngay.');
        setPhase('error');
        setRetryExhausted(true);
        return;
      }

      if (isAgentOffline) {
        setError(
          err.data?.error ||
          'Chưa kết nối hoặc chưa mở được đầu đọc vân tay ZK9500. Vui lòng kiểm tra cáp USB và Agent.'
        );
        setPhase('error');
        setRetryExhausted(true);
      } else if (isTimeout) {
        setError('Hết thời gian chờ đặt ngón tay lên máy quét (quá 30 giây). Vui lòng bấm "Quét ngay" để thử lại.');
        setPhase('error');
        setRetryExhausted(true);
      } else if (isDeviceError) {
        setError(err.data?.error || 'Lỗi thiết bị máy quét vân tay ZK9500.');
        setPhase('error');
        setRetryExhausted(true);
      } else if (isPinNotSet) {
        setError(
          'Tài khoản chưa được cấp mã PIN. Vui lòng gửi yêu cầu đến Quản trị viên (USR-001) để được cấp PIN trước khi mở tài liệu Cấp 4-5.'
        );
        setPhase('error');
        setPinNotSet(true);
        setRetryExhausted(true);
      } else if (isNeedsEnroll) {
        setError('Bạn chưa đăng ký vân tay. Vui lòng liên hệ quản trị viên để đăng ký.');
        setNeedsEnroll(true);
        setPhase('error');
        setRetryExhausted(true);
      } else if (isTemplateCorrupted) {
        setError(
          err.data?.details ||
          'Template vân tay bị hỏng hoặc sai khóa mã hóa hệ thống. Cần đăng ký lại (re-enroll).'
        );
        setPhase('error');
        setRetryExhausted(true);
      } else {
        const cleanMsg = msg.replace(/\s*\(score=\d+\)/gi, '');
        setError(cleanMsg || 'Vân tay không khớp. Vui lòng thử lại.');
        setPhase('error');

        if (retryCountRef.current < MAX_AUTO_RETRY) {
          retryCountRef.current += 1;
          if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
          const delay = 1200 * retryCountRef.current;
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
    setPinNotSet(false);
    setPinReqMessage('');
    handleRetryInternal();
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (autoRetryTimerRef.current) {
      clearTimeout(autoRetryTimerRef.current);
      autoRetryTimerRef.current = null;
    }
    inFlightRef.current = false;
    retryCountRef.current = 0;
    setPinChallenge(null);
    onCancel();
  };

  if (!open) return null;

  const modalNode = (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/30 dark:bg-black/50 backdrop-blur-md transition-all duration-300"
        onClick={handleCancel}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="bg-white/95 dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800/90 rounded-3xl w-full max-w-md mx-auto overflow-hidden shadow-2xl backdrop-blur-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                <Fingerprint className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {purpose === 'admin_login' ? 'Xác Thực Quản Trị Viên' : 'Xác Thực Vân Tay'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {purpose === 'admin_login'
                    ? 'Yêu cầu xác thực 2 lớp (2FA) cho Admin'
                    : 'Tài liệu Mật / Tối mật / Tuyệt mật'}
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
                  {purpose === 'admin_login'
                    ? 'Vui lòng đặt ngón tay của Quản trị viên tối cao lên đầu đọc ZK9500'
                    : 'Vui lòng đặt ngón tay đã đăng ký lên đầu đọc ZK9500'}
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
                  <span>Xác thực thành công</span>
                </div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  {purpose === 'admin_login' ? 'Đang vào hệ thống...' : 'Đang mở tài liệu...'}
                </p>
              </>
            )}

            {phase === 'error' && (
              <>
                <div className="flex items-center justify-center gap-1.5 mb-1 text-rose-500 font-bold text-base">
                  {needsEnroll ? <Cable className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  <span>{needsEnroll ? 'Chưa đăng ký vân tay' : 'Xác thực thất bại'}</span>
                </div>
                <p className="text-xs text-rose-600 dark:text-rose-400 max-w-xs">{error}</p>

                {!needsEnroll && !error.includes('Chưa kết nối') && (
                  retryExhausted ? (
                    <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Đã hết lượt tự động. Vui lòng bấm "Quét ngay" để thử lại.</span>
                    </div>
                  ) : (
                    <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
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
              {pinNotSet ? 'Đóng' : 'Hủy'}
            </button>

            {pinNotSet ? (
              // ✅ Nút gửi yêu cầu cấp PIN: chống double-click + loading + thông báo inline dưới nút
              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={async () => {
                    if (pinReqLoading) return;
                    setPinReqLoading(true);
                    setPinReqMessage('');
                    try {
                      await userService.requestPin(fileId);
                      setPinReqMessage('✅ Đã gửi yêu cầu thành công! Vui lòng liên hệ Admin.');
                      // Đợi 2 giây để người dùng đọc thông báo rồi đóng modal
                      setTimeout(() => {
                        // Chỉ đóng nếu modal chưa bị đóng thủ công & component còn mount
                        if (mountedRef.current && abortRef.current !== null) {
                          handleCancel();
                        }
                      }, 2000);
                    } catch (e: any) {
                      setPinReqMessage(`❌ ${e?.message || 'Lỗi gửi yêu cầu'}`);
                    } finally {
                      if (mountedRef.current) setPinReqLoading(false);
                    }
                  }}
                  disabled={pinReqLoading || pinReqMessage.includes('✅')}
                  className="px-4 py-2 bg-gradient-to-r from-[#166534] to-[#15803d] hover:from-[#14532d] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pinReqLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="w-3.5 h-3.5" />
                  )}
                  {pinReqLoading ? 'Đang gửi...' : 'Gửi yêu cầu cấp PIN'}
                </button>

                {/* Hiển thị thông báo ngay dưới nút */}
                {pinReqMessage && (
                  <span
                    className={`text-[11px] font-semibold text-right max-w-[250px] ${
                      pinReqMessage.includes('✅') ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {pinReqMessage}
                  </span>
                )}
              </div>
            ) : phase === 'error' && !needsEnroll && (
              // ✅ FIX #4: bỏ điều kiện !retryExhausted → luôn cho phép bấm "Quét ngay"
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] hover:from-[#166534] hover:to-[#15803d] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-md shadow-emerald-950/20 border border-amber-500/25 cursor-pointer"
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

  const rendered = (
    <>
      {modalNode}
      <PinVerifyModal
        open={Boolean(pinChallenge)}
        pinChallengeToken={pinChallenge?.token || ''}
        securityLevelId={pinChallenge?.level || 4}
        documentLabel={fileId}
        onSuccess={(finalToken) => {
          setPinChallenge(null);
          onSuccess(finalToken);
        }}
        onCancel={() => {
          setPinChallenge(null);
          handleCancel();
        }}
      />
    </>
  );

  return typeof document !== 'undefined'
    ? createPortal(rendered, document.body)
    : rendered;
};

export default FingerprintScanModal;