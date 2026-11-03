import { useState, useEffect, useCallback, useRef } from 'react';
import { http } from '../services/http';
import { DocumentItem } from '../types';
import { toast } from '../components/common/Toast';

// =========================================================================
// 🛠️ DEVELOPER BYPASS TOGGLE (Dành cho Lập trình viên / Tester)
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

let isWipingClipboard = false;

// Kiểm tra target có phải ô nhập liệu (input, textarea, PIN field...) không
function isInputTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable ||
    Boolean(target.closest('input, textarea, [contenteditable="true"]'))
  );
}

/**
 * Xóa sạch hoàn toàn hình ảnh trong Clipboard của Hệ điều hành.
 * Sử dụng cờ isWipingClipboard để ngăn chặn 100% đệ quy vô hạn trong execCommand('copy').
 */
export function wipeClipboard(customMessage?: string) {
  if (isWipingClipboard) return;
  isWipingClipboard = true;

  const msg =
    customMessage ||
    '⚠️ [AN NINH TRƯỜNG QUÂN SỰ QUÂN KHU 7] Dữ liệu hình ảnh đã bị hủy tự động do vi phạm quy chế bảo vệ bí mật nhà nước. Nghiêm cấm mọi hành vi chụp và trích xuất tài liệu quân sự!';

  // Phương thức 1: Clipboard API hiện đại
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(msg).catch(() => {});
    }
  } catch (_) {}

  // Phương thức 2: Fallback textarea execCommand (chạy dự phòng an toàn)
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
  } catch (_) {} finally {
    isWipingClipboard = false;
  }
}

/**
 * Xung kích hoạt xóa Clipboard liên tục đa tầng (0ms, 40ms, 100ms, 200ms, 400ms, 800ms, 1500ms, 2500ms, 4500ms).
 * Đảm bảo ngay cả khi Snipping Tool hoặc Zalo ghi đè ảnh vào Clipboard sau khi quét,
 * các xung tiếp theo sẽ lập tức tiêu diệt dữ liệu ảnh đó!
 */
export function wipeClipboardBurst(customMessage?: string) {
  wipeClipboard(customMessage);
  const pulses = [40, 100, 200, 400, 800, 1400, 2200, 3500, 5000];
  pulses.forEach((ms) => {
    setTimeout(() => {
      wipeClipboard(customMessage);
    }, ms);
  });
}

/**
 * Ẩn tức thì (0ms latency) nội dung PDF bằng CSS trực tiếp và kích hoạt màn trập đen bảo vệ
 */
export function applyInstantBlackout(_active: boolean) {
  // ⚡ Cơ chế an ninh chuyên dụng 0ms (màn trập che đen / ẩn iframe) đã được loại bỏ hoàn toàn theo yêu cầu.
  // Tài liệu hiển thị nguyên vẹn, tự nhiên, không bị giật hay chớp đen.
}

export interface UseAntiScreenshotOptions {
  document: DocumentItem | null;
  enabled?: boolean;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
}

export interface ViolationInfo {
  triggerType: 'PRINT_SCREEN' | 'WIN_SHIFT_S' | 'ZALO_CAPTURE' | 'OS_SNIPPING' | 'CLIPBOARD_PASTE' | 'DEVTOOLS_CAPTURE';
  time: string;
}

export function useAntiScreenshot({ document: docItem, enabled = true, iframeRef }: UseAntiScreenshotOptions) {
  const docLevel = docItem ? (docItem.security_level_id || (docItem as any).security_level || 1) : 1;
  const isHighSecurity = docLevel >= 3;

  // Lá chắn cảnh báo đỏ vi phạm (SecurityScreenShield)
  const [isShieldActive, setIsShieldActive] = useState(false);
  const [violationInfo, setViolationInfo] = useState<ViolationInfo | null>(null);

  // Số lần vi phạm chụp màn hình (đồng bộ với sessionStorage và CSDL)
  const [violationCount, setViolationCount] = useState<number>(() => {
    try {
      const stored = sessionStorage.getItem('qk7_screenshot_violation_count');
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  });

  // Trạng thái khóa tài khoản khi vi phạm quá 3 lần
  const [isAccountLocked, setIsAccountLocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('qk7_account_locked_screenshot') === 'true';
    } catch {
      return false;
    }
  });

  const lastAlertTimeRef = useRef<number>(0);
  const modifierKeysRef = useRef({ win: false, shift: false, ctrl: false, alt: false, time: 0 });
  
  // ⏱️ Ghi nhận timestamp độc lập của từng phím bổ trợ & chụp màn hình
  const lastWinTimeRef = useRef<number>(0);
  const lastShiftTimeRef = useRef<number>(0);
  const lastCtrlTimeRef = useRef<number>(0);
  const lastAltTimeRef = useRef<number>(0);
  const lastPrintScreenTimeRef = useRef<number>(0);

  const recentCaptureKeyRef = useRef<{ type: ViolationInfo['triggerType']; time: number } | null>(null);
  const captureArmedTimeRef = useRef<number>(0);
  const armedTriggerTypeRef = useRef<ViolationInfo['triggerType'] | null>(null);
  const disarmTimeoutRef = useRef<any>(null);
  const isShieldActiveRef = useRef<boolean>(false);
  isShieldActiveRef.current = isShieldActive;

  // Gửi báo cáo vi phạm về Gateway Backend (/api/security/screenshot-alert)
  const sendSecurityAlert = useCallback(
    async (triggerType: ViolationInfo['triggerType']) => {
      const now = Date.now();
      // Debounce ngắn 300ms chống double-call trong cùng 1 sự kiện, đảm bảo không bao giờ nuốt request vi phạm lần 4
      if (now - lastAlertTimeRef.current < 300) return null;
      lastAlertTimeRef.current = now;

      try {
        const res = await http('/api/security/screenshot-alert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file_id: docItem?.file_id || (docItem as any)?.id || null,
            document_code: docItem?.document_code || 'VĂN BẢN',
            title: docItem?.title || '',
            security_name: docItem?.security_name || (docItem as any)?.security_level_name || '',
            unit_name: docItem?.unit_name || (docItem as any)?.issuing_unit_name || '',
            trigger_type: triggerType,
            client_time: new Date().toISOString(),
          }),
        });
        return res as any;
      } catch (err) {
        console.warn('[AntiScreenshot] Không thể gửi cảnh báo về máy chủ:', err);
        return null;
      }
    },
    [docItem]
  );

  // Kích hoạt lá chắn cảnh báo vi phạm màu đỏ & quản lý khóa tài khoản
  const triggerViolation = useCallback(
    async (triggerType: ViolationInfo['triggerType']) => {
      if (isScreenshotAllowed()) return;

      // 1. Áp dụng che mờ tức thì & kích hoạt Màn trập an ninh màu đen & SecurityScreenShield đỏ
      applyInstantBlackout(true);
      setIsShieldActive(true);
      isShieldActiveRef.current = true;

      // Tính toán số lần vi phạm kế tiếp
      const nextCount = violationCount + 1;
      setViolationCount(nextCount);
      try {
        sessionStorage.setItem('qk7_screenshot_violation_count', String(nextCount));
      } catch (_) {}

      // Nếu vi phạm quá 3 lần (từ lần thứ 4 trở đi) -> Khóa ngay trên client
      if (nextCount > 3) {
        setIsAccountLocked(true);
        try {
          sessionStorage.setItem('qk7_account_locked_screenshot', 'true');
        } catch (_) {}
      }

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

      // 2. XÓA SẠCH CLIPBOARD LIÊN TỤC ĐA TẦNG (Xung kích hoạt phá hủy hình ảnh)
      wipeClipboardBurst();

      // 3. Gửi cảnh báo về máy chủ Backend (Cập nhật CSDL và khóa tài khoản thực tế)
      const serverResult = await sendSecurityAlert(triggerType);
      const finalCount = (serverResult && typeof serverResult.violation_count === 'number')
        ? Number(serverResult.violation_count)
        : nextCount;

      setViolationCount(finalCount);
      try {
        sessionStorage.setItem('qk7_screenshot_violation_count', String(finalCount));
      } catch (_) {}

      // Nếu vượt quá 3 lần vi phạm HOẶC server báo đã khóa -> Khóa tài khoản vĩnh viễn
      if (finalCount > 3 || serverResult?.is_locked || nextCount > 3) {
        setIsAccountLocked(true);
        try {
          sessionStorage.setItem('qk7_account_locked_screenshot', 'true');
        } catch (_) {}
      } else {
        setIsAccountLocked(false);
        try {
          sessionStorage.removeItem('qk7_account_locked_screenshot');
        } catch (_) {}
      }
    },
    [violationCount, sendSecurityAlert]
  );

  // 🔄 ĐỒNG BỘ SỐ LẦN VI PHẠM THỰC TẾ VÀ TRẠNG THÁI KHÓA TỪ SERVER KHI MỞ TÀI LIỆU
  useEffect(() => {
    if (!enabled) return;
    let isMounted = true;
    (async () => {
      try {
        const statusRes = (await http('/api/security/violation-status')) as any;
        if (!isMounted || !statusRes) return;
        if (typeof statusRes.violation_count === 'number') {
          setViolationCount(statusRes.violation_count);
          try {
            sessionStorage.setItem('qk7_screenshot_violation_count', String(statusRes.violation_count));
          } catch (_) {}
        }
        if (statusRes.is_locked === false) {
          setIsAccountLocked(false);
          try {
            sessionStorage.removeItem('qk7_account_locked_screenshot');
          } catch (_) {}
        } else if (statusRes.is_locked === true) {
          setIsAccountLocked(true);
          try {
            sessionStorage.setItem('qk7_account_locked_screenshot', 'true');
          } catch (_) {}
        }
      } catch (_) {}
    })();
    return () => {
      isMounted = false;
    };
  }, [enabled, docItem?.file_id]);

  useEffect(() => {
    if (!enabled || !docItem) {
      applyInstantBlackout(false);
      setIsShieldActive(false);
      isShieldActiveRef.current = false;
      setViolationInfo(null);
      return;
    }

    // 1. Bắt chặn toàn bộ phím tắt chụp màn hình ở tầng Capture bàn phím (Window Event Capture Phase)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isScreenshotAllowed()) return;

      const now = Date.now();

      // Cập nhật trạng thái các phím bổ trợ độc lập & ghi nhận timestamp phân tán
      if (e.key === 'Meta' || e.key === 'OS' || e.code === 'MetaLeft' || e.code === 'MetaRight' || e.metaKey) {
        modifierKeysRef.current.win = true;
        lastWinTimeRef.current = now;
      }
      if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.shiftKey) {
        modifierKeysRef.current.shift = true;
        lastShiftTimeRef.current = now;
      }
      if (e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight' || e.ctrlKey) {
        modifierKeysRef.current.ctrl = true;
        lastCtrlTimeRef.current = now;
      }
      if (e.key === 'Alt' || e.code === 'AltLeft' || e.code === 'AltRight' || e.altKey) {
        modifierKeysRef.current.alt = true;
        lastAltTimeRef.current = now;
      }

      const isCtrlActive = Boolean(e.ctrlKey || modifierKeysRef.current.ctrl);
      const isAltActive = Boolean(e.altKey || modifierKeysRef.current.alt);
      const isWinActive = Boolean(e.metaKey || modifierKeysRef.current.win);
      const isShiftActive = Boolean(e.shiftKey || modifierKeysRef.current.shift);

      const isCtrlAltCombo = isCtrlActive && isAltActive;
      const isWinShiftCombo = isWinActive && isShiftActive;
      const isPrintScreen = e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44;
      if (isPrintScreen) {
        lastPrintScreenTimeRef.current = now;
      }

      const isKeyS = e.key === 's' || e.key === 'S' || e.code === 'KeyS' || e.keyCode === 83 || e.which === 83;
      const isKeyA = e.key === 'a' || e.key === 'A' || e.code === 'KeyA' || e.keyCode === 65 || e.which === 65;

// Đã loại bỏ cơ chế màn trập đón đầu 0ms

      // =========================================================================
      // 🔒 KHÓA CTRL + V (DÁN) CHỈ ĐỐI VỚI VĂN BẢN BẢO MẬT CAO (CẤP 3, 4, 5)
      // =========================================================================
      const isCtrlV =
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        (e.key === 'v' || e.key === 'V' || e.code === 'KeyV');

      // ⚠️ ĐẶC BIỆT: NẾU ĐANG FOCUS VÀO INPUT / TEXTAREA (NHƯ NHẬP MÃ PIN XÁC THỰC, TÌM KIẾM...)
      // THÌ TUYỆT ĐỐI CHO PHÉP PASTE 100%, KHÔNG CHẶN, KHÔNG XÓA CLIPBOARD!
      if (isCtrlV && isInputTarget(e.target)) {
        return;
      }

      if (isCtrlV && isHighSecurity) {
        e.preventDefault();
        e.stopPropagation();
        wipeClipboard('⚠️ [BẢO MẬT QUÂN SỰ] Văn bản có bảo mật cao không được dán hoặc trích xuất.');
        toast.warning('Quy chế an ninh: Thao tác Dán (Ctrl + V) bị vô hiệu hóa khi đang xem tài liệu bảo mật.', {
          title: 'VÔ HIỆU HÓA CTRL + V',
          badge: 'PASTE-DISABLED',
        });
        return;
      }

      // =========================================================================
      // 🚨 NHẬN DIỆN THAO TÁC CHỤP MÀN HÌNH (WIN+SHIFT+S, PRINTSCREEN, CTRL+ALT+S...)
      // =========================================================================
      const isZaloCapture = isCtrlAltCombo && (isKeyS || isKeyA);
      const isWinShiftS = isWinShiftCombo && isKeyS;
      const isCtrlP = (e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P' || e.code === 'KeyP' || e.keyCode === 80);
      const isCtrlS = (e.ctrlKey || e.metaKey) && !isShiftActive && !isAltActive && isKeyS;

      if (isPrintScreen || isWinShiftS || isZaloCapture) {
        e.preventDefault();
        e.stopPropagation();

        const detectedType: ViolationInfo['triggerType'] = isPrintScreen
          ? 'PRINT_SCREEN'
          : isZaloCapture
          ? 'ZALO_CAPTURE'
          : 'WIN_SHIFT_S';

        recentCaptureKeyRef.current = {
          type: detectedType,
          time: Date.now(),
        };

        applyInstantBlackout(true);
        wipeClipboardBurst();
        triggerViolation(detectedType);
        return;
      }

      // In hoặc Lưu trái phép (Ctrl+P, Ctrl+S)
      if (isCtrlP || isCtrlS) {
        e.preventDefault();
        e.stopPropagation();
        if (isHighSecurity) {
          applyInstantBlackout(true);
          wipeClipboardBurst();
          triggerViolation('PRINT_SCREEN');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isScreenshotAllowed()) return;
      if (e.key === 'Meta' || e.key === 'OS' || e.code === 'MetaLeft' || e.code === 'MetaRight') modifierKeysRef.current.win = false;
      if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') modifierKeysRef.current.shift = false;
      if (e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight') modifierKeysRef.current.ctrl = false;
      if (e.key === 'Alt' || e.code === 'AltLeft' || e.code === 'AltRight') modifierKeysRef.current.alt = false;

      // Phím PrintScreen nhả ra -> Kích hoạt màn đen và cảnh báo đỏ ngay
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        e.stopPropagation();
        recentCaptureKeyRef.current = { type: 'PRINT_SCREEN', time: Date.now() };
        applyInstantBlackout(true);
        wipeClipboardBurst();
        triggerViolation('PRINT_SCREEN');
        return;
      }

// Đã loại bỏ cơ chế giữ màn trập đen trong handleKeyUp
    };

    // 2. Bắt sự kiện Window Blur:
    // Tuyệt đối không che văn bản khi chuột di chuyển, bấm vào tài liệu hoặc thao tác bên trong tài liệu.
    // Nhận diện chính xác 100% thao tác chụp màn hình của Hệ điều hành (Win+Shift+S, Snipping Tool, PrintScreen, Ctrl+Alt+S)
    const handleWindowBlur = () => {
      if (isScreenshotAllowed()) return;

      // 🛡️ Kiểm tra nếu tiêu điểm chuyển vào iframe PDF (người dùng click/cuộn chuột/thao tác trong tài liệu)
      const activeEl = document.activeElement;
      if (activeEl === iframeRef?.current || (activeEl && activeEl.tagName === 'IFRAME')) {
        // Thao tác chuột bình thường trong tài liệu -> Tuyệt đối không che văn bản, không phạt!
        return;
      }

      const now = Date.now();
      const recentCapture = recentCaptureKeyRef.current;
      const isRecentDirectCapture = Boolean(recentCapture && now - recentCapture.time < 2500);
      const isArmed = captureArmedTimeRef.current > 0 && now - captureArmedTimeRef.current < 2500;
      
      // Nhận diện theo timestamp phân tán: phím Win + Shift bấm trong vòng 2.5s trước khi blur
      const isWinShiftBlur = (now - lastWinTimeRef.current < 2500 && now - lastShiftTimeRef.current < 2500);
      // Nhận diện phím Ctrl + Alt bấm trong vòng 2.5s trước khi blur
      const isCtrlAltBlur = (now - lastCtrlTimeRef.current < 2500 && now - lastAltTimeRef.current < 2500);
      // Nhận diện phím PrintScreen bấm trong vòng 2.5s trước khi blur
      const isPrtScnBlur = (now - lastPrintScreenTimeRef.current < 2500);

      const isWinShiftStill = modifierKeysRef.current.win && modifierKeysRef.current.shift;
      const isCtrlAltStill = modifierKeysRef.current.ctrl && modifierKeysRef.current.alt;

      // Nếu cửa sổ bị cướp focus do thao tác chụp màn hình (Win+Shift+S, Snipping Tool, PrintScreen, Ctrl+Alt+S):
      if (isRecentDirectCapture || isArmed || isWinShiftStill || isCtrlAltStill || isWinShiftBlur || isCtrlAltBlur || isPrtScnBlur) {
        let triggerType: ViolationInfo['triggerType'] = 'WIN_SHIFT_S';
        if (recentCapture?.type) {
          triggerType = recentCapture.type;
        } else if (isPrtScnBlur) {
          triggerType = 'PRINT_SCREEN';
        } else if (isCtrlAltStill || isCtrlAltBlur) {
          triggerType = 'ZALO_CAPTURE';
        } else {
          triggerType = 'WIN_SHIFT_S';
        }

        captureArmedTimeRef.current = 0;
        armedTriggerTypeRef.current = null;
        recentCaptureKeyRef.current = null;
        lastWinTimeRef.current = 0;
        lastShiftTimeRef.current = 0;
        lastCtrlTimeRef.current = 0;
        lastAltTimeRef.current = 0;
        lastPrintScreenTimeRef.current = 0;

        // Đóng kín màn trập tức thì
        applyInstantBlackout(true);
        // Tiêu hủy Clipboard liên tục đa xung
        wipeClipboardBurst();
        // Kích hoạt Modal Cảnh Báo Đỏ
        triggerViolation(triggerType);
        return;
      }

      // Thao tác chuyển tab / Alt+Tab thông thường:
      // Không che đen, giữ nguyên tài liệu hiển thị tự nhiên
      if (isHighSecurity) {
        wipeClipboard();
      }
    };

    // 3. Khi quay lại cửa sổ (Focus):
    const handleWindowFocus = () => {
      if (isScreenshotAllowed()) return;

      // Ngay khi cửa sổ lấy lại tiêu điểm:
      // Nếu có vi phạm chụp màn hình (Snipping Tool vừa chụp xong và đưa vào clipboard):
      // GỌI NGAY wipeClipboardBurst() ĐỂ XÓA SẠCH HÌNH ẢNH TRONG CLIPBOARD!
      if (isShieldActiveRef.current || violationInfo) {
        wipeClipboardBurst();
      }

      // Nếu không có cảnh báo đỏ đang bật: mở lại tài liệu bình thường
      if (!isShieldActiveRef.current) {
        applyInstantBlackout(false);
      }
    };

    // Thao tác chuột (click/pointerdown): Reset ngay cờ phím bổ trợ để không bị nhận nhầm thành chụp màn hình
    const handlePointerDown = () => {
      captureArmedTimeRef.current = 0;
      modifierKeysRef.current = { win: false, shift: false, ctrl: false, alt: false, time: 0 };
      if (disarmTimeoutRef.current) {
        clearTimeout(disarmTimeoutRef.current);
        disarmTimeoutRef.current = null;
      }
    };

    // 4. Chặn dán nội dung hình ảnh vào hệ thống (Ctrl + V)
    const handlePaste = (e: ClipboardEvent) => {
      if (isScreenshotAllowed()) return;

      // ⚠️ ĐẶC BIỆT: NẾU ĐANG DÁN VÀO Ô INPUT / TEXTAREA (NHƯ NHẬP MÃ PIN XÁC THỰC):
      // TUYỆT ĐỐI CHO PHÉP DÁN BÌNH THƯỜNG, KHÔNG CHẶN, KHÔNG XÓA CLIPBOARD!
      if (isInputTarget(e.target)) {
        return;
      }

      if (!isHighSecurity) return; // Cho phép dán ở Cấp 1 & 2

      e.preventDefault();
      e.stopPropagation();
      wipeClipboard();

      const items = e.clipboardData?.items;
      let hasImage = false;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            hasImage = true;
            break;
          }
        }
      }

      if (hasImage) {
        triggerViolation('CLIPBOARD_PASTE');
        toast.securityAlert('Đã phát hiện và hủy bỏ hình ảnh trích xuất trái phép trong bộ nhớ tạm!', {
          title: 'CHẶN DÁN HÌNH ẢNH',
          badge: 'CLIPBOARD-BLOCKED',
        });
      } else {
        toast.warning('Quy chế an ninh: Thao tác dán (Paste) bị vô hiệu hóa khi đang xem tài liệu bảo mật.', {
          title: 'VÔ HIỆU HÓA PASTE',
          badge: 'PASTE-DISABLED',
        });
      }
    };

    // 5. Chặn copy văn bản nhạy cảm khi đang mở tài liệu bảo mật (Ctrl + C)
    const handleCopy = (e: ClipboardEvent) => {
      if (isWipingClipboard) return;
      if (isScreenshotAllowed()) return;

      // ⚠️ ĐẶC BIỆT: NẾU ĐANG COPY TRONG Ô INPUT / TEXTAREA (NHƯ COPY MÃ PIN):
      // TUYỆT ĐỐI CHO PHÉP COPY BÌNH THƯỜNG!
      if (isInputTarget(e.target)) {
        return;
      }

      // CHỈ CHẶN COPY ĐỐI VỚI VĂN BẢN BẢO MẬT CAO (CẤP 3, 4, 5):
      if (isHighSecurity) {
        e.preventDefault();
        e.stopPropagation();
        wipeClipboard('⚠️ [BẢO MẬT QUÂN SỰ] Văn bản có bảo mật cao không được sao chép.');
        toast.warning('Văn bản có bảo mật cao không được sao chép.', {
          title: 'BẢO MẬT VĂN BẢN',
          badge: 'BẢO MẬT CAO',
        });
      }
      // NẾU LÀ CẤP 1 (CÔNG KHAI) VÀ CẤP 2 (NỘI BỘ):
      // CHO PHÉP COPY BÌNH THƯỜNG, TUYỆT ĐỐI KHÔNG CÓ THÔNG BÁO GÌ CẢ, KHÔNG XÓA CLIPBOARD!
    };

    // 6. Chặn chuột phải (Context Menu) chỉ với tài liệu bảo mật cao
    const handleContextMenu = (e: MouseEvent) => {
      if (isScreenshotAllowed()) return;
      if (isInputTarget(e.target)) {
        return; // Cho phép chuột phải trong ô input để Paste/Copy
      }
      if (!isHighSecurity) return; // Cho phép chuột phải ở Cấp 1, 2 để sao chép / dán

      e.preventDefault();
      e.stopPropagation();
      toast.warning('Quy chế an ninh: Thao tác chuột phải bị vô hiệu hóa khi đang xem tài liệu bảo mật.', {
        title: 'VÔ HIỆU HÓA CHUỘT PHẢI',
        badge: 'CONTEXT-DISABLED',
      });
    };

    // 7. Gắn listener trên Window và Document
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('paste', handlePaste, true);
    window.addEventListener('copy', handleCopy, true);
    window.addEventListener('contextmenu', handleContextMenu, true);

    // 8. Gắn listener liên tục vào iframe PDF ngay khi iframe được nạp Blob
    const attachToIframe = () => {
      try {
        const iframe = iframeRef?.current;
        if (!iframe) return;
        const iframeWin = iframe.contentWindow;
        const iframeDoc = iframe.contentDocument;
        if (iframeWin) {
          iframeWin.removeEventListener('keydown', handleKeyDown, true);
          iframeWin.removeEventListener('keyup', handleKeyUp, true);
          iframeWin.addEventListener('keydown', handleKeyDown, true);
          iframeWin.addEventListener('keyup', handleKeyUp, true);
        }
        if (iframeDoc) {
          iframeDoc.removeEventListener('keydown', handleKeyDown, true);
          iframeDoc.removeEventListener('keyup', handleKeyUp, true);
          iframeDoc.removeEventListener('pointerdown', handlePointerDown, true);
          iframeDoc.addEventListener('keydown', handleKeyDown, true);
          iframeDoc.addEventListener('keyup', handleKeyUp, true);
          iframeDoc.addEventListener('pointerdown', handlePointerDown, true);
        }
      } catch (_) {}
    };

    const iframeInterval = setInterval(attachToIframe, 500);
    attachToIframe();

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('paste', handlePaste, true);
      window.removeEventListener('copy', handleCopy, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);

      clearInterval(iframeInterval);
      if (disarmTimeoutRef.current) {
        clearTimeout(disarmTimeoutRef.current);
      }
    };
  }, [enabled, docItem, triggerViolation, iframeRef, isShieldActive, isHighSecurity]);

  const dismissShield = useCallback(() => {
    // Nếu tài khoản đã bị khóa (quá 3 lần), KHÔNG cho phép đóng cảnh báo!
    if (isAccountLocked || violationCount > 3) {
      return;
    }

    applyInstantBlackout(false);
    setIsShieldActive(false);
    isShieldActiveRef.current = false;
    setViolationInfo(null);
    recentCaptureKeyRef.current = null;
    captureArmedTimeRef.current = 0;
    armedTriggerTypeRef.current = null;
    modifierKeysRef.current = { win: false, shift: false, ctrl: false, alt: false, time: 0 };
    if (typeof window !== 'undefined') {
      try {
        window.focus();
      } catch (_) {}
    }
  }, [isAccountLocked, violationCount]);

  return {
    isShieldActive,
    violationInfo,
    violationCount,
    isAccountLocked,
    dismissShield,
  };
}
