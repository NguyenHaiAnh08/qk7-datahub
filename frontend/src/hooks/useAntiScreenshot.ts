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
  const pulses = [60, 150, 300, 600, 1000, 1800, 3000];
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
      htmlEl.style.opacity = '0.02';
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
  const preemptiveArmedRef = useRef<boolean>(false);

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

      // Cập nhật trạng thái các phím bổ trợ
      if (e.key === 'Meta' || e.key === 'OS') modifierKeysRef.current.win = true;
      if (e.key === 'Shift') modifierKeysRef.current.shift = true;
      if (e.key === 'Control') modifierKeysRef.current.ctrl = true;
      if (e.key === 'Alt') modifierKeysRef.current.alt = true;
      modifierKeysRef.current.time = Date.now();

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
      // ⚡ MÀN TRẬP BẢO MẬT ĐÓN ĐẦU 0MS (PRE-EMPTIVE SHUTTER):
      // Khi ngón tay người dùng bắt đầu đè (Win + Shift) hoặc (Ctrl + Alt):
      // Lập tức đóng màn trập đen trước khi phím 'S' được kích hoạt!
      // Khi Snipping Tool đóng băng màn hình, khung hình PDF đã là màu đen tuyền!
      // =========================================================================
      const isPreemptiveCombination =
        (e.shiftKey && (e.metaKey || modifierKeysRef.current.win)) || // Đang giữ Win + Shift
        (e.ctrlKey && e.altKey); // Đang giữ Ctrl + Alt

      if (isPreemptiveCombination) {
        preemptiveArmedRef.current = true;
        applyInstantBlackout(true);
      }

      // Phím PrintScreen độc lập hoặc đi kèm Alt / Ctrl / Win / Shift
      const isPrintScreen = e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44;

      // Windows Snipping Tool: Win + Shift + S hoặc Ctrl + Shift + S
      const isWinShiftS =
        ((e.metaKey || modifierKeysRef.current.win) && e.shiftKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) ||
        (e.shiftKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS') && (e.metaKey || modifierKeysRef.current.win));

      // Zalo Screenshot: BẮT BUỘC ĐỒNG THỜI CẢ Ctrl VÀ Alt VÀ phím S (Tuyệt đối không kiểm tra rời rạc!)
      const isZaloCapture =
        e.ctrlKey && e.altKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS');

      // WeChat / phần mềm chụp ngoài khác: Ctrl + Alt + A
      const isThirdPartyCapture =
        e.ctrlKey && e.altKey && (e.key === 'a' || e.key === 'A' || e.code === 'KeyA');

      // Windows Game Bar Record / Screenshot: Win + Alt + R hoặc Win + Alt + G / Win + Alt + PrintScreen
      const isGameBarRecord =
        (e.metaKey || modifierKeysRef.current.win) &&
        e.altKey &&
        (e.key === 'r' || e.key === 'R' || e.key === 'g' || e.key === 'G' || e.code === 'KeyR' || e.code === 'KeyG');

      // macOS Screenshot: Cmd + Shift + 3 / 4 / 5
      const isMacScreenshot = e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5');

      // In ấn / Xuất PDF: Ctrl + P hoặc Cmd + P
      const isCtrlP = (e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P' || e.code === 'KeyP');

      // Lưu trang web: Ctrl + S (không kèm shift/alt)
      const isCtrlS =
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        !e.altKey &&
        (e.key === 's' || e.key === 'S' || e.code === 'KeyS');

      if (
        isPrintScreen ||
        isWinShiftS ||
        isZaloCapture ||
        isThirdPartyCapture ||
        isGameBarRecord ||
        isMacScreenshot ||
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
          : isThirdPartyCapture
          ? 'OS_SNIPPING'
          : 'PRINT_SCREEN';

        recentCaptureKeyRef.current = {
          type: detectedType,
          time: Date.now(),
        };

        applyInstantBlackout(true);
        wipeClipboardBurst();
        triggerViolation(detectedType);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isScreenshotAllowed()) return;
      if (e.key === 'Meta' || e.key === 'OS') modifierKeysRef.current.win = false;
      if (e.key === 'Shift') modifierKeysRef.current.shift = false;
      if (e.key === 'Control') modifierKeysRef.current.ctrl = false;
      if (e.key === 'Alt') modifierKeysRef.current.alt = false;

      // Phím PrintScreen nhả ra
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        e.stopPropagation();
        recentCaptureKeyRef.current = { type: 'PRINT_SCREEN', time: Date.now() };
        applyInstantBlackout(true);
        wipeClipboardBurst();
        triggerViolation('PRINT_SCREEN');
        return;
      }

      // Nếu nhả phím bổ trợ mà không có vi phạm nào (và lá chắn đỏ chưa kích hoạt):
      // Mở lại màn trập an toàn sau 200ms
      const stillHoldingModifiers =
        (e.shiftKey && (e.metaKey || modifierKeysRef.current.win)) ||
        (e.ctrlKey && e.altKey);

      if (!stillHoldingModifiers && preemptiveArmedRef.current && !isShieldActive) {
        preemptiveArmedRef.current = false;
        setTimeout(() => {
          if (!isShieldActive && !preemptiveArmedRef.current) {
            applyInstantBlackout(false);
          }
        }, 200);
      }
    };

    // 2. Bắt sự kiện Window Blur:
    // TUYỆT ĐỐI CHỈ CẢNH BÁO KHI VỪA CÓ PHÍM TẮT CHỤP ẢNH THỰC TẾ (PrintScreen, Win+Shift+S, Ctrl+Alt+S)
    // Thao tác bấm các phím khác (Shift, Ctrl, Alt đơn lẻ, chữ hoa, tìm kiếm...), rê chuột ra ngoài,
    // chuyển sang Màn hình 2, click đổi tab -> HOÀN TOÀN KHÔNG BỊ CẢNH BÁO, BỎ QUA 100%!
    const handleWindowBlur = () => {
      if (isScreenshotAllowed()) return;

      const now = Date.now();
      const recentCapture = recentCaptureKeyRef.current;

      // CHỈ KÍCH HOẠT KHI CÓ PHÍM CHỤP MÀN HÌNH THỰC TẾ VỪA ĐƯỢC BẤM TRONG VÒNG 400MS
      if (recentCapture && now - recentCapture.time < 400) {
        applyInstantBlackout(true);
        wipeClipboardBurst();
        triggerViolation(recentCapture.type);
        recentCaptureKeyRef.current = null;
        return;
      }

      // Xóa cờ đón đầu nếu cửa sổ blur mà không có phím chụp
      if (preemptiveArmedRef.current && !isShieldActive) {
        preemptiveArmedRef.current = false;
        applyInstantBlackout(false);
      }

      // Kiểm tra nếu tiêu điểm chuyển vào trong iframe PDF (người dùng vừa click vào nội dung PDF để cuộn/đọc)
      const activeEl = window.document.activeElement;
      const isEnteringIframe =
        activeEl === iframeRef?.current ||
        (activeEl && (activeEl.tagName === 'IFRAME' || Boolean(activeEl.closest('.secure-pdf-content'))));

      if (isEnteringIframe) {
        // Thao tác click đọc văn bản -> Hoàn trả tiêu điểm cho Window sau 60ms để không mất khả năng bắt phím tắt các lần sau
        setTimeout(() => {
          try {
            window.focus();
          } catch (_) {}
        }, 60);
      }

      // BẢO VỆ CHỦ ĐỘNG KHI TÀI LIỆU MỞ SẴN:
      // Khi cửa sổ mất focus (người dùng mở app khác hoặc kích hoạt chụp từ bên ngoài):
      // Xóa bộ nhớ tạm 1 lần để ngăn chặn việc dán trộm, NHƯNG TUYỆT ĐỐI KHÔNG BÁO ĐỘNG NHẦM!
      wipeClipboard();
    };

    // 3. Khi quay lại cửa sổ
    const handleWindowFocus = () => {
      if (isScreenshotAllowed()) return;
      wipeClipboard();
      if (!isShieldActive) {
        applyInstantBlackout(false);
      }
    };

    // 4. Chặn dán nội dung hình ảnh vào hệ thống (Ctrl + V)
    const handlePaste = (e: ClipboardEvent) => {
      if (isScreenshotAllowed()) return;
      // Chặn 100% mọi hành vi paste trong lúc đang mở xem tài liệu bảo mật
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

    // 6. Định kỳ giữ tiêu điểm sẵn sàng trên Window để bắt trọn phím tắt liên tục
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
    preemptiveArmedRef.current = false;
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
