import { http } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { User } from '../types/user';

// ══════════════════════════════════════════════════════════════
// Storage Keys
// ══════════════════════════════════════════════════════════════
const STORAGE_KEYS = {
  TOKEN: 'qk7_token',
  EXPIRES_IN: 'qk7_token_expires',
  USER: 'qk7_user',
  USERNAME: 'qk7_username',
  USER_LOGIN: 'qk7_user_login',
  NAME: 'qk7_name',
  LEVEL: 'qk7_level',
  UNIT: 'qk7_unit',
  UNIT_NAME: 'qk7_unit_name',
  POSITION: 'qk7_position',
  RANK: 'qk7_rank',
  CLEARANCE_NAME: 'qk7_clearance_name',
  CLEARANCE_CODE: 'qk7_clearance_code',
  STATUS: 'qk7_status',
  ROLES: 'qk7_roles',
  ROLE_NAMES: 'qk7_role_names',
} as const;

// ══════════════════════════════════════════════════════════════
// Response Interfaces
// ══════════════════════════════════════════════════════════════
export interface LoginResponse {
  success: boolean;
  token: string;
  expires_in: string;   // "8h", "1d"...
  user: User;
}

export interface JwtPayload {
  user_id: string;
  clearance_level_id: number;
  roles: string[];
  iat: number;
  exp: number;
}

// ══════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════

/**
 * Parse JWT payload mà không cần verify chữ ký.
 * Dùng để đọc thông tin user_id/clearance từ token (server đã verify rồi).
 * KHÔNG dùng để quyết định phân quyền — chỉ dùng để hiển thị/optimistic UI.
 */
function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    // Padding base64
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Chuyển "8h"/"1d"/"30m" thành milliseconds. Trả 0 nếu không parse được.
 */
function parseExpiresIn(value: string | undefined): number {
  if (!value) return 0;
  const match = value.match(/^(\d+)\s*([smhd])$/i);
  if (!match) return 0;
  const n = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return n * (multipliers[unit] || 0);
}

// ══════════════════════════════════════════════════════════════
// Auth Service
// ══════════════════════════════════════════════════════════════
export const authService = {
  /**
   * Đăng nhập — lưu JWT token + user info vào sessionStorage.
   *
   * ⚠️ FAIL-FAST: Nếu backend không trả token, HOẶC sessionStorage không
   * lưu được (VD: chế độ Ẩn danh), hàm sẽ THROW để AuthContext biết
   * login thực sự THẤT BẠI — tránh trạng thái "login ảo" (có user nhưng
   * không có token → mọi request sau đều 401).
   */
  login: async (user_id: string, password: string): Promise<LoginResponse> => {
    const res = await http<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user_id.trim(), password }),
    });

    // ─── 1. Kiểm tra backend có trả token không ───
    if (!res?.token) {
      // Xóa sạch session cũ (nếu có) để tránh trạng thái nửa vời
      authService.clearSession();
      throw new Error(
        'Máy chủ không trả về token xác thực. Vui lòng liên hệ quản trị viên hệ thống.'
      );
    }

    // ─── 2. Lưu token vào sessionStorage — THROW nếu thất bại ───
    try {
      sessionStorage.setItem(STORAGE_KEYS.TOKEN, res.token);

      // Ghi nhận thời điểm hết hạn (fallback nếu JWT không có exp)
      const ttlMs = parseExpiresIn(res.expires_in);
      if (ttlMs > 0) {
        sessionStorage.setItem(
          STORAGE_KEYS.EXPIRES_IN,
          String(Date.now() + ttlMs)
        );
      }

      // ─── 3. Verify token thực sự đã lưu được (belt-and-suspenders) ───
      const verifyToken = sessionStorage.getItem(STORAGE_KEYS.TOKEN);
      if (!verifyToken || verifyToken !== res.token) {
        throw new Error('TOKEN_NOT_PERSISTED');
      }
    } catch (e: any) {
      // Dọn dẹp sạch để không có trạng thái "nửa đăng nhập"
      authService.clearSession();

      if (e?.message === 'TOKEN_NOT_PERSISTED') {
        throw new Error(
          'Phiên đăng nhập không được lưu trữ. Trình duyệt có thể đang chặn sessionStorage.'
        );
      }

      // Nguyên nhân phổ biến: chế độ Ẩn danh (Private Browsing), extension chặn storage,
      // hoặc trình duyệt hết dung lượng sessionStorage
      throw new Error(
        'Trình duyệt không cho phép lưu phiên đăng nhập (có thể do chế độ Ẩn danh). ' +
        'Vui lòng tắt chế độ Ẩn danh hoặc cho phép lưu trữ trang web này rồi đăng nhập lại.'
      );
    }

    return res;
  },

  /**
   * Lấy thông tin user hiện tại từ server (dùng JWT trong header).
   */
  getMe: async (): Promise<User> => {
    const res = await http<any>(API_ENDPOINTS.AUTH.ME);
    if (res && res.user) {
      return res.user as User;
    }
    return res as User;
  },

  /**
   * 🔑 Lấy JWT token hiện tại (dùng cho http.ts và fileService).
   */
  getToken: (): string | null => {
    try {
      return sessionStorage.getItem(STORAGE_KEYS.TOKEN);
    } catch {
      return null;
    }
  },

  /**
   * 🔑 Kiểm tra nhanh đã có token và token còn hạn không.
   * Dùng để guard trước khi render ProtectedRoute hoặc gọi API quan trọng.
   */
  hasValidToken: (): boolean => {
    const token = authService.getToken();
    if (!token) return false;
    return !authService.isTokenExpired(0);
  },

  /**
   * 🔑 Decode JWT payload để lấy user_id, clearance, roles.
   * Dùng cho optimistic UI (KHÔNG dùng để quyết định auth).
   */
  getTokenPayload: (): JwtPayload | null => {
    const token = authService.getToken();
    if (!token) return null;
    return decodeJwtPayload(token);
  },

  /**
   * 🔑 Kiểm tra token đã hết hạn chưa (dựa trên exp hoặc fallback expires_in).
   */
  isTokenExpired: (bufferSeconds = 30): boolean => {
    const token = authService.getToken();
    if (!token) return true;

    // Ưu tiên đọc `exp` trong payload
    const payload = decodeJwtPayload(token);
    if (payload && typeof payload.exp === 'number') {
      // Buffer 30s để tránh race khi request gửi đúng lúc exp
      return Date.now() + bufferSeconds * 1000 >= payload.exp * 1000;
    }

    // Fallback: dùng thời điểm expires tính từ lúc login
    const expiresAt = sessionStorage.getItem(STORAGE_KEYS.EXPIRES_IN);
    if (expiresAt) {
      const ts = parseInt(expiresAt, 10);
      if (!isNaN(ts)) return Date.now() + bufferSeconds * 1000 >= ts;
    }

    return false;
  },

  /**
   * Lưu user info vào sessionStorage (gọi sau login hoặc refreshProfile).
   */
  saveSession: (user: User) => {
    try {
      sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } catch (e) {
      console.warn('[authService] Failed to serialize user to sessionStorage', e);
    }

    // Legacy keys — giữ tương thích ngược với code cũ đọc trực tiếp
    sessionStorage.setItem(STORAGE_KEYS.USERNAME, user.user_id);
    sessionStorage.setItem(STORAGE_KEYS.NAME, user.full_name);
    sessionStorage.setItem(STORAGE_KEYS.LEVEL, String(user.clearance_level_id));
    if (user.username) sessionStorage.setItem(STORAGE_KEYS.USER_LOGIN, user.username);
    if (user.unit_id) sessionStorage.setItem(STORAGE_KEYS.UNIT, user.unit_id);
    if (user.unit_name) sessionStorage.setItem(STORAGE_KEYS.UNIT_NAME, user.unit_name);
    if (user.position) sessionStorage.setItem(STORAGE_KEYS.POSITION, user.position);
    if (user.rank_name) sessionStorage.setItem(STORAGE_KEYS.RANK, user.rank_name);
    if (user.clearance_name) sessionStorage.setItem(STORAGE_KEYS.CLEARANCE_NAME, user.clearance_name);
    if (user.clearance_code) sessionStorage.setItem(STORAGE_KEYS.CLEARANCE_CODE, user.clearance_code);
    if (user.status) sessionStorage.setItem(STORAGE_KEYS.STATUS, user.status);
    if (user.roles) sessionStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(user.roles));
    if (user.role_names) sessionStorage.setItem(STORAGE_KEYS.ROLE_NAMES, JSON.stringify(user.role_names));
  },

  /**
   * Xóa toàn bộ session (đăng xuất / logout / token hết hạn).
   */
  clearSession: () => {
    Object.values(STORAGE_KEYS).forEach((key) => {
      sessionStorage.removeItem(key);
    });
  },

  /**
   * Lấy user hiện tại từ sessionStorage (không gọi API).
   * Trả GUEST nếu chưa đăng nhập.
   */
  getCurrentSession: (): User => {
    // Ưu tiên đọc từ session JSON đầy đủ
    const rawUser = sessionStorage.getItem(STORAGE_KEYS.USER);
    if (rawUser) {
      try {
        const parsed = JSON.parse(rawUser);
        if (parsed && parsed.user_id) {
          return parsed;
        }
      } catch {
        // Fallback đọc từng key
      }
    }

    const userId = sessionStorage.getItem(STORAGE_KEYS.USERNAME);
    if (!userId || userId === 'GUEST') {
      return {
        user_id: 'GUEST',
        full_name: 'Khách',
        clearance_level_id: 1,
        clearance_name: 'Công khai',
      };
    }

    let roles: string[] | undefined;
    let roleNames: string[] | undefined;
    try {
      const rawRoles = sessionStorage.getItem(STORAGE_KEYS.ROLES);
      if (rawRoles) roles = JSON.parse(rawRoles);
      const rawRoleNames = sessionStorage.getItem(STORAGE_KEYS.ROLE_NAMES);
      if (rawRoleNames) roleNames = JSON.parse(rawRoleNames);
    } catch {
      // ignore
    }

    return {
      user_id: userId,
      username: sessionStorage.getItem(STORAGE_KEYS.USER_LOGIN) || userId.toLowerCase(),
      full_name: sessionStorage.getItem(STORAGE_KEYS.NAME) || userId,
      clearance_level_id: parseInt(sessionStorage.getItem(STORAGE_KEYS.LEVEL) || '1', 10),
      unit_id: sessionStorage.getItem(STORAGE_KEYS.UNIT) || undefined,
      unit_name: sessionStorage.getItem(STORAGE_KEYS.UNIT_NAME) || undefined,
      position: sessionStorage.getItem(STORAGE_KEYS.POSITION) || undefined,
      rank_name: sessionStorage.getItem(STORAGE_KEYS.RANK) || undefined,
      clearance_name: sessionStorage.getItem(STORAGE_KEYS.CLEARANCE_NAME) || undefined,
      clearance_code: sessionStorage.getItem(STORAGE_KEYS.CLEARANCE_CODE) || undefined,
      status: sessionStorage.getItem(STORAGE_KEYS.STATUS) || 'active',
      roles,
      role_names: roleNames,
    };
  },


  /**
   * Logout — gọi backend để revoke session, sau đó clear local.
   * Nếu backend lỗi vẫn phải clear local để user không bị treo.
   */
  logout: async (): Promise<void> => {
    try {
      await http(API_ENDPOINTS.AUTH.LOGOUT, {
        method: 'POST',
        skipErrorNotification: true,
        silent: true,
      });
    } catch {
      // ignore
    } finally {
      authService.clearSession();
    }
  },
};