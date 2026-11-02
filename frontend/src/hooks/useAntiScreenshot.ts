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
 * Xung kích hoạt xóa Clipboard liên tục đa tầng (0ms, 60ms, 150ms, 300ms, 600ms, 1200ms, 2500ms).
 * Đảm bảo ngay cả khi Snipping Tool hoặc Zalo ghi đè ảnh vào Clipboard sau khi nhả chuột,
 * các xung tiếp theo sẽ lập tức tiêu diệt dữ liệu ảnh đó, không để lại dấu vết trong MS Paint hay Zalo!
 */
export function wipeClipboardBurst(customMessage?: string) {
  wipeClipboard(customMessage);
  const pulses = [50, 150, 300, 600, 1000, 1800, 2800, 4200, 6000, 8500];
  pulses.forEach((ms) => {
    setTimeout(() => {
      wipeClipboard(customMessage);
    }, ms);
  });
}

/**
 * Ẩn tức thì (0ms latency) nội dung PDF bằng CSS trực tiếp
 */
export function applyInstantBlackout(active: boolean) {
  if (typeof document === 'undefined') return;
  const elements = document.querySelectorAll('.secure-pdf-content');
  elements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (active) {
      htmlEl.style.filter = 'blur(60px)';
      htmlEl.style.opacity = '0.01';
      htmlEl.style.pointerEvents = 'none';
      htmlEl.style.visibility = 'hidden';
    } else {
      htmlEl.style.filter = '';
      htmlEl.style.opacity = '';
      htmlEl.style.pointerEvents = '';
      htmlEl.style.visibility = '';
    }
  });

  const shutter = document.getElementById('qk7-blackout-shutter');
  if (shutter) {
    shutter.style.display = active ? 'block' : 'none';
  }
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
  const recentCaptureKeyRef = useRef<{ type: ViolationInfo['triggerType']; time: number } | null>(null);
  const lastCtrlAltComboTimeRef = useRef<number>(0);
  const lastWinShiftComboTimeRef = useRef<number>(0);
  const isMouseInsideWindowRef = useRef<boolean>(true);

  // Gửi báo cáo vi phạm về Gateway Backend (/api/security/screenshot-alert)
  const sendSecurityAlert = useCallback(
    async (triggerType: ViolationInfo['triggerType']) => {
      const now = Date.now();
      if (now - lastAlertTimeRef.current < 2000) return null;
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

      // 1. Áp dụng che mờ tức thì & kích hoạt Màn trập đón đầu & SecurityScreenShield đỏ
      applyInstantBlackout(true);
      setIsShieldActive(true);

      // Tính toán số lần vi phạm kế tiếp
      const nextCount = violationCount + 1;
      setViolationCount(nextCount);
      try {
        sessionStorage.setItem('qk7_screenshot_violation_count', String(nextCount));
      } catch (_) {}

      // Nếu vi phạm quá 3 lần (tức là từ lần thứ 4 trở đi) -> KHÓA TÀI KHOẢN NGAY LẬP TỨC!
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

      // 3. Gửi cảnh báo về máy chủ Backend
      const serverResult = await sendSecurityAlert(triggerType);
      if (serverResult && typeof serverResult.violation_count === 'number') {
        const svCount = Number(serverResult.violation_count);
        setViolationCount(svCount);
        try {
          sessionStorage.setItem('qk7_screenshot_violation_count', String(svCount));
        } catch (_) {}

        if (serverResult.is_locked) {
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
      } else if (nextCount > 3) {
        setIsAccountLocked(true);
        try {
          sessionStorage.setItem('qk7_account_locked_screenshot', 'true');
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
      setViolationInfo(null);
      return;
    }

    // 1. Bắt chặn toàn bộ phím tắt chụp màn hình ở tầng Capture bàn phím (Window Event Capture Phase)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isScreenshotAllowed()) return;

      const now = Date.now();

      // Cập nhật trạng thái các phím bổ trợ (hỗ trợ cả thuộc tính trực tiếp và code phím)
      if (e.key === 'Meta' || e.key === 'OS' || e.code === 'MetaLeft' || e.code === 'MetaRight' || e.metaKey) {
        modifierKeysRef.current.win = true;
      }
      if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.shiftKey) {
        modifierKeysRef.current.shift = true;
      }
      if (e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight' || e.ctrlKey) {
        modifierKeysRef.current.ctrl = true;
      }
      if (e.key === 'Alt' || e.code === 'AltLeft' || e.code === 'AltRight' || e.altKey) {
        modifierKeysRef.current.alt = true;
      }

      // Ghi nhận dấu mốc thời gian khi tổ hợp bổ trợ đang được giữ
      const isCtrlActive = Boolean(e.ctrlKey || modifierKeysRef.current.ctrl);
      const isAltActive = Boolean(e.altKey || modifierKeysRef.current.alt);
      const isWinActive = Boolean(e.metaKey || modifierKeysRef.current.win);
      const isShiftActive = Boolean(e.shiftKey || modifierKeysRef.current.shift);

      if (isCtrlActive && isAltActive) {
        lastCtrlAltComboTimeRef.current = now;
      }
      if (isWinActive && isShiftActive) {
        lastWinShiftComboTimeRef.current = now;
      }

      // =========================================================================
      // 🔒 KHÓA BỎ HOÀN TOÀN TỔ HỢP CTRL + V / CMD + V KHI ĐANG XEM TÀI LIỆU
      // =========================================================================
      const isCtrlV =
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        (e.key === 'v' || e.key === 'V' || e.code === 'KeyV');

      if (isCtrlV) {
        e.preventDefault();
        e.stopPropagation();
        wipeClipboard();
        toast.warning('Quy chế an ninh: Thao tác Dán (Ctrl + V) bị vô hiệu hóa khi đang xem tài liệu bảo mật.', {
          title: 'VÔ HIỆU HÓA CTRL + V',
          badge: 'PASTE-DISABLED',
        });
        return;
      }

      // =========================================================================
      // 🚨 NHẬN DIỆN THAO TÁC CHỤP MÀN HÌNH (WIN+SHIFT+S, PRINTSCREEN, CTRL+ALT+S...)
      // =========================================================================
      const isKeyS = e.key === 's' || e.key === 'S' || e.code === 'KeyS' || e.keyCode === 83 || e.which === 83;
      const isKeyA = e.key === 'a' || e.key === 'A' || e.code === 'KeyA' || e.keyCode === 65 || e.which === 65;
      const isPrintScreen = e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44;

      // Zalo Chụp màn hình (Ctrl + Alt + S hoặc Ctrl + Alt + A)
      const isZaloCapture = isCtrlActive && isAltActive && (isKeyS || isKeyA);
      // Snipping Tool (Win + Shift + S)
      const isWinShiftS = isWinActive && isShiftActive && isKeyS;
      // In tài liệu trái phép (Ctrl + P)
      const isCtrlP = (e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P' || e.code === 'KeyP' || e.keyCode === 80);
      // Lưu tài liệu trái phép (Ctrl + S)
      const isCtrlS = (e.ctrlKey || e.metaKey) && !isShiftActive && !isAltActive && isKeyS;

      if (
        isPrintScreen ||
        isWinShiftS ||
        isZaloCapture ||
        isCtrlP ||
        isCtrlS
      ) {
        e.preventDefault();
        e.stopPropagation();

        const detectedType: ViolationInfo['triggerType'] = isPrintScreen
          ? 'PRINT_SCREEN'
          : isZaloCapture
          ? 'ZALO_CAPTURE'
          : isWinShiftS
          ? 'WIN_SHIFT_S'
          : 'PRINT_SCREEN';

        recentCaptureKeyRef.current = {
          type: detectedType,
          time: Date.now(),
        };

        // 1. Phủ màn đen bảo vệ tức thì 0ms (Snipping Tool / Zalo chỉ thu được màn hình đen)
        applyInstantBlackout(true);
        // 2. Tiêu hủy Clipboard liên tục
        wipeClipboardBurst();
        // 3. Bật Modal Cảnh Báo Đỏ ngay lập tức, đếm số lần vi phạm và khóa nếu > 3 lần
        triggerViolation(detectedType);
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
      }
    };

    // 2. Bắt sự kiện Window Blur:
    // Cực kỳ quan trọng: Khi Zalo hoặc Snipping Tool cướp phím S ở tầng Hệ điều hành (Global Hotkey),
    // trình duyệt sẽ bị cướp focus (blur) ngay sau khi vừa nhận tổ hợp Ctrl+Alt hoặc Win+Shift!
    const handleWindowBlur = () => {
      if (isScreenshotAllowed()) return;

      const now = Date.now();
      const recentCapture = recentCaptureKeyRef.current;
      const isRecentDirectCapture = Boolean(recentCapture && now - recentCapture.time < 2500);

      const isRecentCtrlAltBlur =
        now - lastCtrlAltComboTimeRef.current < 2000 ||
        (modifierKeysRef.current.ctrl && modifierKeysRef.current.alt);

      const isRecentWinShiftBlur =
        now - lastWinShiftComboTimeRef.current < 2000 ||
        (modifierKeysRef.current.win && modifierKeysRef.current.shift);

      // Nếu cửa sổ bị blur ngay sau khi bấm phím chụp HOẶC do Zalo/Snipping tool cướp phím S ở tầng Windows:
      if (isRecentDirectCapture || isRecentCtrlAltBlur || isRecentWinShiftBlur) {
        const triggerType: ViolationInfo['triggerType'] =
          recentCapture?.type || (isRecentCtrlAltBlur ? 'ZALO_CAPTURE' : 'WIN_SHIFT_S');

        lastCtrlAltComboTimeRef.current = 0;
        lastWinShiftComboTimeRef.current = 0;
        recentCaptureKeyRef.current = null;

        // Phủ màn đen bảo vệ tức thì 0ms (Zalo / Snipping tool chỉ thu được màn hình đen)
        applyInstantBlackout(true);
        // Tiêu hủy Clipboard
        wipeClipboardBurst();
        // 🚨 KÍCH HOẠT MODAL CẢNH BÁO ĐỎ
        triggerViolation(triggerType);
        return;
      }

      // Thao tác chuột hoặc chuyển cửa sổ thông thường: chỉ tiêu hủy Clipboard đề phòng, KHÔNG BẬT MÀN ĐEN, KHÔNG PHẠT VI PHẠM
      wipeClipboard();
    };

    // 3. Khi quay lại cửa sổ (Focus):
    const handleWindowFocus = () => {
      if (isScreenshotAllowed()) return;
      wipeClipboardBurst();

      // Nếu không có cảnh báo đỏ đang bật: mở lại tài liệu bình thường
      if (!isShieldActive) {
        applyInstantBlackout(false);
      }
    };

    // 4. Chặn dán nội dung hình ảnh vào hệ thống (Ctrl + V)
    const handlePaste = (e: ClipboardEvent) => {
      if (isScreenshotAllowed()) return;
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
      e.preventDefault();
      e.stopPropagation();
      wipeClipboard('⚠️ [BẢO MẬT QUÂN SỰ QUÂN KHU 7] Nghiêm cấm mọi hành vi sao chép, trích xuất văn bản quân sự bảo mật!');
      toast.warning('Văn bản quân sự được bảo vệ bí mật. Không được phép sao chép trích xuất nội dung.', {
        title: 'BẢO VỆ BẢN QUYỀN VĂN BẢN',
        badge: 'COPY-RESTRICTED',
      });
    };

    // 6. Chặn chuột phải (Context Menu) để ngăn mở frame trong tab mới hoặc in trộm
    const handleContextMenu = (e: MouseEvent) => {
      if (isScreenshotAllowed()) return;
      e.preventDefault();
      e.stopPropagation();
      toast.warning('Quy chế an ninh: Thao tác chuột phải bị vô hiệu hóa khi đang xem tài liệu bảo mật.', {
        title: 'VÔ HIỆU HÓA CHUỘT PHẢI',
        badge: 'CONTEXT-DISABLED',
      });
    };

    // 7. Định kỳ giữ tiêu điểm sẵn sàng trên Window để bắt trọn phím tắt liên tục
    const keepWindowFocused = () => {
      try {
        if (
          typeof window !== 'undefined' &&
          window.document.hasFocus() &&
          window.document.activeElement === iframeRef?.current
        ) {
          window.focus();
        }
      } catch (_) {}
    };

    const focusInterval = setInterval(keepWindowFocused, 400);

    // 7. Gắn listener trên Window và Document (CHỈ LẮNG NGHE PHÍM VÀ CLIPBOARD)
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('paste', handlePaste, true);
    window.addEventListener('copy', handleCopy, true);
    window.addEventListener('contextmenu', handleContextMenu, true);
    const handleMouseMove = () => { isMouseInsideWindowRef.current = true; };
    const handleMouseLeave = () => { isMouseInsideWindowRef.current = false; };
    window.addEventListener('mousemove', handleMouseMove, true);
    window.addEventListener('mouseleave', handleMouseLeave, true);

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
          iframeDoc.addEventListener('keydown', handleKeyDown, true);
          iframeDoc.addEventListener('keyup', handleKeyUp, true);
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
      window.removeEventListener('paste', handlePaste, true);
      window.removeEventListener('copy', handleCopy, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('mousemove', handleMouseMove, true);
      window.removeEventListener('mouseleave', handleMouseLeave, true);

      clearInterval(iframeInterval);
      clearInterval(focusInterval);
    };
  }, [enabled, docItem, triggerViolation, iframeRef, isShieldActive]);

  const dismissShield = useCallback(() => {
    // Nếu tài khoản đã bị khóa (quá 3 lần), KHÔNG cho phép đóng cảnh báo!
    if (isAccountLocked || violationCount > 3) {
      return;
    }

    applyInstantBlackout(false);
    setIsShieldActive(false);
    setViolationInfo(null);
    recentCaptureKeyRef.current = null;
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
