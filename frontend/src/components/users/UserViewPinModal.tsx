import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Copy, Fingerprint, KeyRound, Loader2, X } from 'lucide-react';
import { pinService, type PinStatus } from '../../services/pinService';
import { fingerprintService } from '../../services/fingerprintService';
import { userService } from '../../services/userService';
import { toast } from '../common/Toast';

// Máy chủ chờ đặt ngón tay tối đa khoảng 30 giây
const SCAN_TIMEOUT_MS = 45_000;

const PRIMARY = 'w-full !min-h-[44px] rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const SECONDARY = 'w-full !min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer';

/**
 * "Mã PIN của tôi" (mở từ nút chuông).
 *   - Được cấp PIN lần đầu: xem ngay.
 *   - Đã có PIN: quét vân tay của chính mình để xem lại, bất cứ lúc nào.
 */
export const UserViewPinModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [status, setStatus] = useState<PinStatus | null>(null);
  const [loadError, setLoadError] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState<'' | 'view' | 'scan' | 'request'>('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const scanRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      setStatus(await pinService.status());
    } catch (err: any) {
      setLoadError(err.message || 'Không tải được thông tin mã PIN');
    }
  }, []);

  // Mỗi lần mở là một phiên mới; đóng thì xóa mã đang hiện và hủy lượt quét
  useEffect(() => {
    if (!open) return undefined;
    load();
    return () => {
      scanRef.current?.abort();
      scanRef.current = null;
      setStatus(null);
      setPin('');
      setBusy('');
      setError('');
      setCopied(false);
    };
  }, [open, load]);

  const viewFirstTime = async () => {
    setBusy('view');
    setError('');
    try {
      setPin((await pinService.takeFirstView()).pin);
    } catch (err: any) {
      setError(err.message || 'Không lấy được mã PIN');
      await load();
    } finally {
      setBusy('');
    }
  };

  const scanAndView = async () => {
    const controller = new AbortController();
    scanRef.current?.abort();
    scanRef.current = controller;
    const timer = window.setTimeout(() => controller.abort('timeout'), SCAN_TIMEOUT_MS);
    setBusy('scan');
    setError('');
    try {
      let deviceId: string;
      try {
        deviceId = await fingerprintService.getLocalDeviceId(2000);
      } catch {
        throw new Error('Chưa kết nối máy quét vân tay. Vui lòng bật Fingerprint Agent trên máy tính này.');
      }
      if (controller.signal.aborted) return;
      const res = await pinService.reveal(deviceId, controller.signal);
      if (scanRef.current === controller) setPin(res.pin);
    } catch (err: any) {
      if (scanRef.current !== controller) return; // đã đóng bảng hoặc bấm hủy
      setError(controller.signal.aborted
        ? 'Quá thời gian chờ máy quét. Kiểm tra cáp USB và Agent rồi thử lại.'
        : err.message || 'Xác thực vân tay thất bại');
    } finally {
      window.clearTimeout(timer);
      if (scanRef.current === controller) {
        scanRef.current = null;
        setBusy('');
      }
    }
  };

  const cancelScan = () => {
    scanRef.current?.abort();
    scanRef.current = null;
    setBusy('');
  };

  const sendRequest = async () => {
    setBusy('request');
    setError('');
    try {
      await userService.requestPin();
      toast.success('Đã gửi yêu cầu cấp mã PIN. Vui lòng chờ người có thẩm quyền xử lý.');
      await load();
    } catch (err: any) {
      setError(err.message || 'Không gửi được yêu cầu');
    } finally {
      setBusy('');
    }
  };

  const copyPin = async () => {
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.warning('Trình duyệt không cho sao chép. Hãy ghi lại mã bằng tay.');
    }
  };

  if (!open) return null;

  const requestBlock = status?.request_pending ? (
    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Yêu cầu của bạn đang chờ xử lý.</p>
  ) : (
    <button type="button" onClick={sendRequest} disabled={busy !== ''} className={PRIMARY}>
      {busy === 'request' && <Loader2 className="w-4 h-4 animate-spin" />}
      {status?.has_pin ? 'Gửi yêu cầu đổi mã PIN' : 'Gửi yêu cầu cấp mã PIN'}
    </button>
  );

  const text = (value: React.ReactNode) => <p className="text-sm text-slate-600 dark:text-slate-300">{value}</p>;

  let title = 'Mã PIN của tôi';
  let body: React.ReactNode;

  if (pin) {
    body = (
      <>
        <div className="py-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-4xl font-mono tabular-nums font-bold tracking-[0.3em] text-emerald-800 dark:text-emerald-300 select-all">
          {pin}
        </div>
        <button type="button" onClick={copyPin} className={SECONDARY}>
          {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Đã sao chép' : 'Sao chép mã PIN'}
        </button>
        {text('Không đưa mã này cho người khác. Khi quên, mở lại bảng này và quét vân tay để xem.')}
        <button type="button" onClick={onClose} className={PRIMARY}>Đã ghi nhớ, đóng</button>
      </>
    );
  } else if (loadError) {
    body = (
      <>
        {text(loadError)}
        <button type="button" onClick={load} className={PRIMARY}>Thử lại</button>
      </>
    );
  } else if (!status) {
    body = <Loader2 className="w-6 h-6 animate-spin text-emerald-700 mx-auto" aria-label="Đang tải" />;
  } else if (busy === 'scan') {
    title = 'Quét vân tay';
    body = (
      <>
        <Fingerprint className="w-14 h-14 mx-auto text-emerald-700 dark:text-emerald-400 animate-pulse" />
        {text('Đặt ngón tay đã đăng ký lên máy quét.')}
        <button type="button" onClick={cancelScan} className={SECONDARY}>Hủy quét</button>
      </>
    );
  } else if (!status.ready) {
    body = text('Chức năng xem mã PIN chưa được bật trên máy chủ. Vui lòng báo Quản trị viên.');
  } else if (!status.has_pin) {
    body = (
      <>
        {text('Bạn chưa được cấp mã PIN. Mã PIN dùng khi mở tài liệu Tối mật, Tuyệt mật.')}
        {requestBlock}
      </>
    );
  } else if (status.notice === 'NEW') {
    title = 'Mã PIN mới của bạn';
    body = (
      <>
        {text('Bạn vừa được cấp mã PIN. Những lần sau cần quét vân tay để xem lại.')}
        <button type="button" onClick={viewFirstTime} disabled={busy !== ''} className={PRIMARY}>
          {busy === 'view' && <Loader2 className="w-4 h-4 animate-spin" />}
          Xem mã PIN
        </button>
      </>
    );
  } else if (!status.viewable) {
    body = (
      <>
        {text('Mã PIN của bạn được cấp theo cơ chế cũ nên chưa xem lại được. Nếu còn nhớ, hãy nhập đúng một lần khi mở tài liệu mật, sau đó sẽ xem lại được. Nếu đã quên, gửi yêu cầu đổi mã.')}
        {requestBlock}
      </>
    );
  } else if (!status.has_fingerprint) {
    body = text('Bạn chưa đăng ký vân tay nên chưa xem lại được mã PIN. Vui lòng liên hệ Quản trị viên để đăng ký.');
  } else {
    if (status.notice === 'ROTATE') title = 'Mã PIN của bạn vừa được đổi';
    body = (
      <>
        {text(status.notice === 'ROTATE'
          ? 'Mã cũ đã hết hiệu lực. Quét vân tay để xem mã mới.'
          : 'Quét vân tay của bạn để xem lại mã PIN đang dùng.')}
        <button type="button" onClick={scanAndView} disabled={busy !== ''} className={PRIMARY}>
          <Fingerprint className="w-4 h-4" />
          Quét vân tay để xem
        </button>
      </>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-label={title} className="relative bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full max-h-[90vh] overflow-y-auto p-6 text-center shadow-2xl border border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute top-2 right-2 w-11 h-11 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="w-14 h-14 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-3">
          <KeyRound className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{title}</h3>
        <div className="space-y-3">
          {body}
          {error && <p role="alert" className="text-sm font-semibold text-rose-700 dark:text-rose-400">{error}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
};
