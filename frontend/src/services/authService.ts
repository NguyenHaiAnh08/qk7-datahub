import { http } from '../services/http';
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
  PERMISSIONS: 'qk7_permissions',
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
 * KHÔNG dùng để quyết định phân quyền — chỉ để hiển thị / optimistic UI.
 */
function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
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

/**
 * Ghi nếu có giá trị, xoá nếu undefined/rỗng — tránh stale data từ user cũ.
 */
function writeOrClear(key: string, value: string | undefined | null): void {
  if (value != null && value !== '') {
    sessionStorage.setItem(key, value);
  } else {
    sessionStorage.removeItem(key);
  }
}

/**
 * Ghi mảng string dạng JSON nếu hợp lệ, xoá key nếu undefined.
 * Phân biệt: `undefined` (chưa biết) ≠ `[]` (đã biết rỗng).
 */
function writeJsonArray(key: string, value: string[] | undefined): void {
  if (Array.isArray(value)) {
    sessionStorage.setItem(key, JSON.stringify(value));
  } else {
    sessionStorage.removeItem(key);
  }
}

/**
 * Đọc mảng string dạng JSON. Trả undefined nếu không có hoặc hỏng.
 */
function readJsonArray(key: string): string[] | undefined {
  const raw = sessionStorage.getItem(key);
  if (!raw) return undefined;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) && v.every((x) => typeof x === 'string')
      ? (v as string[])
      : undefined;
  } catch {
    return undefined;
  }
}

// ══════════════════════════════════════════════════════════════
// Auth Service
// ══════════════════════════════════════════════════════════════
export const authService = {
  /**
   * Đăng nhập — lưu JWT token + user info vào sessionStorage.
   *
   * ⚠️ FAIL-FAST: nếu backend không trả token, hoặc sessionStorage không
   * ghi được (Ẩn danh / storage bị chặn) → THROW để AuthContext biết
   * login THẤT BẠI — tránh trạng thái "login ảo".
   */
  // portal: cổng đăng nhập — 'datahub' (Trung tâm dữ liệu số) hoặc 'training' (Quản lý đào tạo, chỉ Admin/Chỉ huy).
  // Backend kiểm tra vai trò ↔ cổng và gắn cổng vào token/phiên.
  login: async (user_id: string, password: string, portal: 'datahub' | 'training' = 'datahub'): Promise<any> => { // Đổi return type thành any để linh hoạt
    const res = await http<any>(API_ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user_id.trim(), password, portal }),
    });

    // Trả về ngay để LoginForm mở Modal quét vân tay
    if (res?.require_admin_fp) {
      return res;
    }

    // ─── 1. Backend phải trả token (cho User thường) ───
    if (!res?.token) {
      authService.clearSession();
      throw new Error(
        'Máy chủ không trả về token xác thực. Vui lòng liên hệ quản trị viên hệ thống.',
      );
    }

    // ─── 2. Lưu token — THROW nếu thất bại (chỉ lưu sessionStorage trong bộ nhớ phiên) ───
    try {
      sessionStorage.setItem(STORAGE_KEYS.TOKEN, res.token);

      const ttlMs = parseExpiresIn(res.expires_in);
      if (ttlMs > 0) {
        sessionStorage.setItem(
          STORAGE_KEYS.EXPIRES_IN,
          String(Date.now() + ttlMs),
        );
      }

      // Verify round-trip (belt-and-suspenders)
      const verifyToken = sessionStorage.getItem(STORAGE_KEYS.TOKEN);
      if (!verifyToken || verifyToken !== res.token) {
        throw new Error('TOKEN_NOT_PERSISTED');
      }
    } catch (e: any) {
      authService.clearSession();
      if (e?.message === 'TOKEN_NOT_PERSISTED') {
        throw new Error(
          'Phiên đăng nhập không được lưu trữ. Trình duyệt có thể đang chặn sessionStorage.',
        );
      }
      throw new Error(
        'Trình duyệt không cho phép lưu phiên đăng nhập (có thể do chế độ Ẩn danh). ' +
          'Vui lòng tắt chế độ Ẩn danh hoặc cho phép lưu trữ trang này rồi đăng nhập lại.',
      );
    }

    return res;
  },

  /**
   * Lấy thông tin user hiện tại từ server (dùng JWT trong header).
   * Luôn chuẩn hoá về `User` với `roles/role_names/permissions` là mảng
   * (không undefined) — vì đây là nguồn chân lý.
   */
  getMe: async (): Promise<User> => {
    const res = await http<any>(API_ENDPOINTS.AUTH.ME);
    const raw: any = res && res.user ? res.user : res;
    return {
      ...raw,
      roles: Array.isArray(raw?.roles) ? raw.roles : [],
      role_names: Array.isArray(raw?.role_names) ? raw.role_names : [],
      permissions: Array.isArray(raw?.permissions) ? raw.permissions : [],
    } as User;
  },

  /** Lấy JWT token hiện tại. */
  getToken: (): string | null => {
    try {
      return sessionStorage.getItem(STORAGE_KEYS.TOKEN);
    } catch {
      return null;
    }
  },

  /** Đã có token và còn hạn không. */
  hasValidToken: (): boolean => {
    const token = authService.getToken();
    if (!token) return false;
    return !authService.isTokenExpired(0);
  },

  /**
   * Cổng của phiên hiện tại ('datahub' | 'training') — đọc từ JWT của CHÍNH TAB này (sessionStorage riêng từng tab).
   * Token cũ chưa có claim portal được coi là 'datahub'. Chỉ dùng cho giao diện; backend mới là nơi chặn thật.
   */
  getCurrentPortal: (): 'datahub' | 'training' => {
    const p: any = authService.getTokenPayload();
    return p?.portal === 'training' ? 'training' : 'datahub';
  },

  /** Decode JWT payload — chỉ dùng cho optimistic UI. */
  getTokenPayload: (): JwtPayload | null => {
    const token = authService.getToken();
    if (!token) return null;
    return decodeJwtPayload(token);
  },

  /**
   * Token hết hạn chưa (dựa trên `exp` hoặc fallback `expires_at`).
   */
  isTokenExpired: (bufferSeconds = 30): boolean => {
    const token = authService.getToken();
    if (!token) return true;

    const payload = decodeJwtPayload(token);
    if (payload && typeof payload.exp === 'number') {
      return Date.now() + bufferSeconds * 1000 >= payload.exp * 1000;
    }

    const expiresAt = sessionStorage.getItem(STORAGE_KEYS.EXPIRES_IN);
    if (expiresAt) {
      const ts = parseInt(expiresAt, 10);
      if (!isNaN(ts)) return Date.now() + bufferSeconds * 1000 >= ts;
    }

    return false;
  },

  /**
   * Lưu user info vào sessionStorage.
   *
   * Ghi cả JSON blob (`qk7_user`) — dùng làm nguồn chính khi F5 — VÀ
   * các key riêng lẻ để tương thích code cũ. Key nào `undefined` sẽ bị
   * XOÁ để tránh stale data.
   */
  saveSession: (user: User) => {
    // Xóa sạch token vân tay cũ khi lưu phiên đăng nhập mới
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('qk7_fp_token');
        Object.keys(sessionStorage).forEach((key) => {
          if (key.startsWith('qk7_fp_token')) {
            sessionStorage.removeItem(key);
          }
        });
      } catch (e) {}
    }

    // ─── Primary: full user JSON ───
    try {
      sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      try { localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user)); } catch (_) {}
    } catch (e) {
      console.warn('[authService] Failed to serialize user to sessionStorage', e);
    }

    // ─── Legacy / explicit keys ───
    writeOrClear(STORAGE_KEYS.USERNAME, user.user_id);
    writeOrClear(STORAGE_KEYS.USER_LOGIN, user.username ?? user.user_id?.toLowerCase());
    writeOrClear(STORAGE_KEYS.NAME, user.full_name);
    writeOrClear(STORAGE_KEYS.LEVEL, String(user.clearance_level_id ?? ''));
    writeOrClear(STORAGE_KEYS.UNIT, user.unit_id);
    writeOrClear(STORAGE_KEYS.UNIT_NAME, user.unit_name);
    writeOrClear(STORAGE_KEYS.POSITION, user.position);
    writeOrClear(STORAGE_KEYS.RANK, user.rank_name);
    writeOrClear(STORAGE_KEYS.CLEARANCE_NAME, user.clearance_name);
    writeOrClear(STORAGE_KEYS.CLEARANCE_CODE, user.clearance_code);
    writeOrClear(STORAGE_KEYS.STATUS, user.status);

    // ⭐ Array fields: phân biệt undefined vs [] đúng chuẩn
    writeJsonArray(STORAGE_KEYS.ROLES, user.roles);
    writeJsonArray(STORAGE_KEYS.ROLE_NAMES, user.role_names);
    writeJsonArray(STORAGE_KEYS.PERMISSIONS, user.permissions);
  },

  /** Xoá toàn bộ session — logout / token hết hạn. */
  clearSession: () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem('qk7_guest_mode');
    } catch (_) {}
    Object.values(STORAGE_KEYS).forEach((key) => {
      sessionStorage.removeItem(key);
    });
    sessionStorage.removeItem('qk7_guest_mode');
    // Xóa sạch cookie phiên cũ để chống gửi cookie hết hạn gây lỗi HTTP 401
    if (typeof document !== 'undefined') {
      try {
        const expiredCookies = ['qk7_session', 'qk7_token', 'token'];
        expiredCookies.forEach((c) => {
          document.cookie = `${c}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
        });
      } catch (_) {}
    }
    // Xóa sạch toàn bộ token vân tay tài liệu còn lưu trong sessionStorage
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('qk7_fp_token');
        Object.keys(sessionStorage).forEach((key) => {
          if (key.startsWith('qk7_fp_token')) {
            sessionStorage.removeItem(key);
          }
        });
      } catch (e) {}
    }
  },

  /**
   * Lấy user hiện tại từ sessionStorage (không gọi API).
   * Trả về null nếu chưa đăng nhập và không bật Guest mode.
   * Chỉ trả về GUEST khi cờ qk7_guest_mode được bật rõ ràng.
   */
  getCurrentSession: (): User | null => {
    // ─── 1. Primary: JSON blob ───
    const rawUser = sessionStorage.getItem(STORAGE_KEYS.USER);
    if (rawUser) {
      try {
        const parsed = JSON.parse(rawUser);
        if (parsed && parsed.user_id && parsed.user_id !== 'GUEST') {
          return {
            ...parsed,
            roles: parsed.roles,
            role_names: parsed.role_names,
            permissions: parsed.permissions,
          } as User;
        }
      } catch {
        // rơi xuống fallback
      }
    }

    // ─── 2. Explicit GUEST mode — CHỈ KHI người dùng bấm 'Đại biểu tham quan' ───
    const isGuestExplicit = sessionStorage.getItem('qk7_guest_mode') === 'true';
    if (isGuestExplicit) {
      return {
        user_id: 'GUEST',
        full_name: 'Đại biểu',
        clearance_level_id: 1,
        clearance_name: 'Công khai',
        roles: ['DELEGATE'],
        role_names: ['Đại biểu'],
        permissions: ['DOC_VIEW', 'DOC_DOWNLOAD', 'LECTURE_VIEW'],
      };
    }

    // ─── 3. Fallback: đọc từng key nếu có user_id thật ───
    const userId = sessionStorage.getItem(STORAGE_KEYS.USERNAME);
    if (userId && userId !== 'GUEST') {
      return {
        user_id: userId,
        username:
          sessionStorage.getItem(STORAGE_KEYS.USER_LOGIN) || userId.toLowerCase(),
        full_name: sessionStorage.getItem(STORAGE_KEYS.NAME) || userId,
        clearance_level_id: parseInt(
          sessionStorage.getItem(STORAGE_KEYS.LEVEL) || '1',
          10,
        ),
        unit_id: sessionStorage.getItem(STORAGE_KEYS.UNIT) || undefined,
        unit_name: sessionStorage.getItem(STORAGE_KEYS.UNIT_NAME) || undefined,
        position: sessionStorage.getItem(STORAGE_KEYS.POSITION) || undefined,
        rank_name: sessionStorage.getItem(STORAGE_KEYS.RANK) || undefined,
        clearance_name:
          sessionStorage.getItem(STORAGE_KEYS.CLEARANCE_NAME) || undefined,
        clearance_code:
          sessionStorage.getItem(STORAGE_KEYS.CLEARANCE_CODE) || undefined,
        status: sessionStorage.getItem(STORAGE_KEYS.STATUS) || 'active',
        roles: readJsonArray(STORAGE_KEYS.ROLES),
        role_names: readJsonArray(STORAGE_KEYS.ROLE_NAMES),
        permissions: readJsonArray(STORAGE_KEYS.PERMISSIONS),
      };
    }

    // Chưa đăng nhập và không bật Guest mode → Trả về null
    return null;
  },

  /**
   * Logout — gọi backend revoke session, sau đó clear local.
   * Backend lỗi vẫn phải clear local để user không bị treo.
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