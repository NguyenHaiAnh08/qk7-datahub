// =========================================================================
// CÔNG TẮC "CHO PHÉP CHỤP MÀN HÌNH" (kiểm thử) — CHỈ QUẢN TRỊ VIÊN
//   - Chỉ có hiệu lực khi MÁY CHỦ xác nhận tài khoản đang đăng nhập có vai trò ROL-01
//     (AuthProvider gọi setScreenshotAdmin sau khi hỏi /api/auth/me). Mã quản trị viên đã xác nhận
//     chỉ giữ trong bộ nhớ, nên sửa localStorage / sessionStorage không bật được.
//   - Lựa chọn bật/tắt lưu riêng cho từng tài khoản quản trị trên trình duyệt đó.
// =========================================================================
export const SCREENSHOT_SWITCH_EVENT = 'qk7_screenshot_switch_changed';

const STORAGE_PREFIX = 'qk7_allow_screenshot:';
let verifiedAdminId: string | null = null;

const notify = () => window.dispatchEvent(new CustomEvent(SCREENSHOT_SWITCH_EVENT));

/** null = phiên hiện tại không phải Quản trị viên (hoặc chưa được máy chủ xác nhận) */
export function setScreenshotAdmin(userId: string | null): void {
  if (verifiedAdminId === userId) return;
  verifiedAdminId = userId;
  notify();
}

export function canUseScreenshotSwitch(): boolean {
  return verifiedAdminId !== null;
}

export function isScreenshotAllowed(): boolean {
  if (!verifiedAdminId) return false;
  try {
    return localStorage.getItem(STORAGE_PREFIX + verifiedAdminId) === 'true';
  } catch {
    return false;
  }
}

export function setScreenshotAllowed(allowed: boolean): void {
  if (!verifiedAdminId) return;
  try {
    if (allowed) localStorage.setItem(STORAGE_PREFIX + verifiedAdminId, 'true');
    else localStorage.removeItem(STORAGE_PREFIX + verifiedAdminId);
  } catch {
    // trình duyệt chặn lưu trữ: giữ trạng thái bảo vệ
  }
  notify();
}
