import { useState, useEffect, useCallback, useRef } from 'react';
import { http } from '../services/http';
import { DocumentItem } from '../types';
import { toast } from '../components/common/Toast';

// =========================================================================
// 🛠️ DEVELOPER BYPASS TOGGLE (Dành cho Lập trình viên / Tester)
// =========================================================================
// - Đặt false (Mặc định): Bật cơ chế bảo vệ an ninh nghiêm ngặt chống chụp màn hình.
// - Đặt true: Cho phép lập trình viên chụp ảnh màn hình làm việc/báo cáo bình thường.
// Bạn cũng có thể bật/tắt nhanh trên giao diện (Menu Profile) hoặc gõ trong Console F12:
//   localStorage.setItem('qk7_dev_allow_screenshot', 'true')
// =========================================================================
export const DEV_ALLOW_SCREENSHOT = false;

export function isScreenshotAllowed(): boolean {
  if (DEV_ALLOW_SCREENSHOT) return true;
  if (typeof window !== 'undefined') {
    if (localStorage.getItem('qk7_dev_allow_screenshot') === 'true') return true;
    if ((window as any).__QK7_ALLOW_SCREENSHOT__ === true) return true;
  }
  return false;
}

export function setDevScreenshotAllowed(allowed: boolean): void {
  if (typeof window !== 'undefined') {
    if (allowed) {
      localStorage.setItem('qk7_dev_allow_screenshot', 'true');
    } else {
      localStorage.removeItem('qk7_dev_allow_screenshot');
    }
    window.dispatchEvent(new CustomEvent('qk7_dev_screenshot_changed', { detail: { allowed } }));
  }
}

/**
 * Xóa sạch hoàn toàn hình ảnh trong Clipboard của Hệ điều hành.
 * Ghi đè bằng thông điệp cảnh báo an ninh để khi người dùng nhấn Ctrl + V sẽ KHÔNG CÓ HÌNH ẢNH.
 */
export function wipeClipboard(customMessage?: string) {
  const msg =
    customMessage ||
    '⚠️ [AN NINH TRƯỜNG QUÂN SỰ QUÂN KHU 7] Dữ liệu hình ảnh đã bị hủy tự động do vi phạm quy chế bảo vệ bí mật nhà nước. Nghiêm cấm mọi hành vi chụp và trích xuất tài liệu quân sự!.';

  // Phương thức 1: Clipboard API hiện đại
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(msg).catch(() => {});
    }
  } catch (_) {}

  // Phương thức 2: Fallback textarea execCommand (chạy song song để chắc chắn ghi đè bộ nhớ tạm)
  try {
    if (typeof document !== 'undefined') {
      const el = document.createElement('textarea');
      el.value = msg;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      el.style.top = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  } catch (_) {}
}

/**
 * Ẩn tức thì (0ms latency, bỏ qua chu kỳ render React) nội dung PDF bằng CSS trực tiếp
 */
export function applyInstantBlackout(active: boolean) {
  if (typeof document === 'undefined') return;
  const elements = document.querySelectorAll('.secure-pdf-content');
  elements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (active) {
      htmlEl.style.filter = 'blur(80px)';
      htmlEl.style.opacity = '0';
      htmlEl.style.visibility = 'hidden';
      htmlEl.style.pointerEvents = 'none';
    } else {
      htmlEl.style.filter = '';
      htmlEl.style.opacity = '';
      htmlEl.style.visibility = '';
      htmlEl.style.pointerEvents = '';
    }
  });
}

export interface UseAntiScreenshotOptions {
  document: DocumentItem | null;
  enabled?: boolean;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
}

export interface ViolationInfo {
  triggerType: 'PRINT_SCREEN' | 'WIN_SHIFT_S';
  time: string;
}

export function useAntiScreenshot({ document, enabled = true, iframeRef }: UseAntiScreenshotOptions) {
  const [isShieldActive, setIsShieldActive] = useState(false);
  const [violationInfo, setViolationInfo] = useState<ViolationInfo | null>(null);

  const lastAlertTimeRef = useRef<number>(0);
  const pendingBlurRef = useRef<boolean>(false);

  // Gửi báo cáo vi phạm về Gateway Backend (/api/security/screenshot-alert)
  const sendSecurityAlert = useCallback(
    async (triggerType: 'PRINT_SCREEN' | 'WIN_SHIFT_S') => {
      const now = Date.now();
      // Chống spam gọi API liên tiếp trong vòng 3 giây
      if (now - lastAlertTimeRef.current < 3000) return;
      lastAlertTimeRef.current = now;

      try {
        await http('/api/security/screenshot-alert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file_id: document?.file_id || (document as any)?.id || null,
            document_code: document?.document_code || 'VĂN BẢN',
            title: document?.title || '',
            security_name: document?.security_name || (document as any)?.security_level_name || '',
            unit_name: document?.unit_name || (document as any)?.issuing_unit_name || '',
            trigger_type: triggerType,
            client_time: new Date().toISOString(),
          }),
        });
      } catch (err) {
        console.warn('[AntiScreenshot] Không thể gửi cảnh báo về máy chủ:', err);
      }
    },
    [document]
  );

  // Kích hoạt lá chắn bảo vệ và dọn sạch clipboard
  const triggerViolation = useCallback(
    (triggerType: 'PRINT_SCREEN' | 'WIN_SHIFT_S') => {
      if (isScreenshotAllowed()) return;

      // 1. Áp dụng che mờ tức thì trên DOM
      applyInstantBlackout(true);
      setIsShieldActive(true);

      const currentTimeStr =
        new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) +
        ' ' +
        new Date().toLocaleDateString('vi-VN');

      setViolationInfo({
        triggerType,
        time: currentTimeStr,
      });

      // 2. XÓA SẠCH CLIPBOARD HỆ ĐIỀU HÀNH NGAY LẬP TỨC CHO CẢ 2 TRƯỜNG HỢP
      // Ngăn chặn hoàn toàn việc nhấn Ctrl + V ra hình ảnh
      wipeClipboard();

      // Xóa nhắc lại sau 200ms, 500ms và 1000ms để ghi đè mọi luồng ghi trễ của OS
      setTimeout(() => wipeClipboard(), 200);
      setTimeout(() => wipeClipboard(), 500);
      setTimeout(() => wipeClipboard(), 1000);

      sendSecurityAlert(triggerType);
    },
    [sendSecurityAlert]
  );

  useEffect(() => {
    if (!enabled || !document) {
      applyInstantBlackout(false);
      setIsShieldActive(false);
      setViolationInfo(null);
      pendingBlurRef.current = false;
      return;
    }

    // 1. Kiểm tra phím tắt chụp màn hình (PrintScreen, Win+Shift+S, Cmd+Shift+3/4)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isScreenshotAllowed()) return;

      const isPrintScreen = e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44;
      const isWinShiftS =
        ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) ||
        (e.shiftKey && (e.key === 's' || e.key === 'S') && e.metaKey);
      const isMacScreenshot = e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5');

      if (isPrintScreen || isWinShiftS || isMacScreenshot) {
        e.preventDefault();
        e.stopPropagation();
        applyInstantBlackout(true);
        wipeClipboard();
        triggerViolation(isPrintScreen ? 'PRINT_SCREEN' : 'WIN_SHIFT_S');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isScreenshotAllowed()) return;
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        e.stopPropagation();
        applyInstantBlackout(true);
        wipeClipboard();
        triggerViolation('PRINT_SCREEN');
      }
    };

    // 2. Bắt sự kiện Window Blur (ngay khi Win+Shift+S hoặc phần mềm chụp ảnh ngoài kích hoạt)
    const handleWindowBlur = () => {
      if (isScreenshotAllowed()) return;
      // Che đen tức thời 0ms trên DOM trước khi Windows chụp khung hình
      applyInstantBlackout(true);
      setIsShieldActive(true);
      pendingBlurRef.current = true;
    };

    // 3. Khi người dùng nhấp lại vào cửa sổ trình duyệt (Focus trở lại)
    const handleWindowFocus = () => {
      if (isScreenshotAllowed()) return;
      if (pendingBlurRef.current) {
        pendingBlurRef.current = false;
        // Dọn sạch Clipboard liên tục ngay khi lấy lại focus
        wipeClipboard();
        setTimeout(() => wipeClipboard(), 150);
        setTimeout(() => wipeClipboard(), 400);
        setTimeout(() => wipeClipboard(), 800);
        triggerViolation('WIN_SHIFT_S');
      }
    };

    // 4. Chặn dán nội dung hình ảnh vào hệ thống (Ctrl + V)
    const handlePaste = (e: ClipboardEvent) => {
      if (isScreenshotAllowed()) return;
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            e.stopPropagation();
            wipeClipboard();
            toast.securityAlert('Đã phát hiện và hủy bỏ hình ảnh trích xuất trái phép trong bộ nhớ tạm!', {
              title: 'CHẶN DÁN HÌNH ẢNH',
              badge: 'CLIPBOARD-BLOCKED',
            });
            return;
          }
        }
      }
    };

    // 5. Gắn listener trên Window và Document
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('paste', handlePaste, true);

    // 6. Gắn listener trực tiếp vào iframe PDF (nếu đã load xong)
    let iframeDoc: Document | null = null;
    let iframeWin: Window | null = null;
    try {
      if (iframeRef?.current && iframeRef.current.contentWindow) {
        iframeWin = iframeRef.current.contentWindow;
        iframeDoc = iframeRef.current.contentDocument;
        if (iframeWin) {
          iframeWin.addEventListener('keydown', handleKeyDown, true);
          iframeWin.addEventListener('keyup', handleKeyUp, true);
          iframeWin.addEventListener('blur', handleWindowBlur);
          iframeWin.addEventListener('focus', handleWindowFocus);
        }
        if (iframeDoc) {
          iframeDoc.addEventListener('keydown', handleKeyDown, true);
          iframeDoc.addEventListener('keyup', handleKeyUp, true);
        }
      }
    } catch (_) {}

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('paste', handlePaste, true);

      try {
        if (iframeWin) {
          iframeWin.removeEventListener('keydown', handleKeyDown, true);
          iframeWin.removeEventListener('keyup', handleKeyUp, true);
          iframeWin.removeEventListener('blur', handleWindowBlur);
          iframeWin.removeEventListener('focus', handleWindowFocus);
        }
        if (iframeDoc) {
          iframeDoc.removeEventListener('keydown', handleKeyDown, true);
          iframeDoc.removeEventListener('keyup', handleKeyUp, true);
        }
      } catch (_) {}
    };
  }, [enabled, document, triggerViolation, iframeRef]);

  const dismissShield = useCallback(() => {
    applyInstantBlackout(false);
    setIsShieldActive(false);
    setViolationInfo(null);
    pendingBlurRef.current = false;
  }, []);

  return {
    isShieldActive,
    violationInfo,
    dismissShield,
  };
}
