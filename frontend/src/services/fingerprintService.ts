import { http } from './http';

// ─────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────

export interface FingerprintVerifyResponse {
  success: boolean;
  required: boolean;
  fingerprint_token: string | null;
  expires_in?: string;
  score?: number;
  error?: string;
  agent_offline?: boolean;
  needs_enroll?: boolean;
}

export interface FingerprintStatusResponse {
  user_id: string;
  has_fingerprint: boolean;
  enrolled_at?: string;
}

export interface EnrollStatusResponse {
  enrolling: boolean;
  step: number;
  total: number;
  state: string;
}

// ─────────────────────────────────────────────────────────────
// Local Agent URLs — gom lại để tránh magic string
// ─────────────────────────────────────────────────────────────

const AGENT_BASE = 'http://127.0.0.1:9001';
const DEVICE_ID_URL = `${AGENT_BASE}/device-id`;
const ENROLL_STATUS_URL = `${AGENT_BASE}/enroll-status`;

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export const fingerprintService = {
  /**
   * Lấy device_id của máy quét vân tay đang chạy trên máy trạm.
   * Ném Error('AGENT_NOT_RUNNING') nếu agent chưa bật hoặc timeout.
   */
  async getLocalDeviceId(timeoutMs: number = 2000): Promise<string> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(DEVICE_ID_URL, { signal: ctrl.signal });
      if (!res.ok) throw new Error('Agent lỗi');
      const data = await res.json();
      if (!data.device_id) throw new Error('Agent thiếu device_id');
      return data.device_id;
    } catch {
      throw new Error('AGENT_NOT_RUNNING');
    } finally {
      clearTimeout(timer);
    }
  },

  /**
   * Xác thực vân tay cho 1 file cụ thể.
   * @param signal AbortSignal — để FE có thể hủy request khi user đóng modal.
   */
  async verify(
    fileId: string,
    deviceId: string,
    signal?: AbortSignal
  ): Promise<FingerprintVerifyResponse> {
    return http<FingerprintVerifyResponse>('/api/auth/fingerprint/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-FP': deviceId,
      },
      body: JSON.stringify({ file_id: fileId }),
      skipErrorNotification: true,
      signal,
    });
  },

  /**
   * Enroll (đăng ký) vân tay cho 1 user — yêu cầu admin cấp 4+.
   * @param signal (tùy chọn) — có thể abort khi đóng modal enroll.
   */
  async enrollForUser(
    userId: string,
    deviceId: string,
    signal?: AbortSignal
  ): Promise<{ success: boolean; user_id: string }> {
    return http<{ success: boolean; user_id: string }>(
      `/api/admin/fingerprint/enroll/${encodeURIComponent(userId)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-FP': deviceId,
        },
        body: JSON.stringify({}),
        skipErrorNotification: true,
        signal,
      }
    );
  },

  /**
   * Kiểm tra user đã đăng ký vân tay chưa.
   */
  async checkStatus(userId: string): Promise<FingerprintStatusResponse> {
    return http<FingerprintStatusResponse>(
      `/api/admin/fingerprint/status/${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        skipErrorNotification: true,
      }
    );
  },

  /**
   * Poll trạng thái enroll 3 bước từ Local Agent (127.0.0.1:9001).
   * Trả null nếu agent chưa bật hoặc timeout 1s.
   */
  async getEnrollStatus(): Promise<EnrollStatusResponse | null> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1000);
    try {
      const res = await fetch(ENROLL_STATUS_URL, { signal: ctrl.signal });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  },
};

export default fingerprintService;