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
   * Lấy device_id của máy quét vân tay ZK9500.
   * - Trên Máy tính: Ưu tiên gọi Local Agent http://127.0.0.1:9001/device-id (timeout 1.2s).
   * - Trên iPad Air M4 (hoặc khi Local Agent chưa bật): Tự động fallback sang Express Gateway (:8000)
   *   gọi /api/admin/fingerprint/agents để lấy máy quét ZK9500 đang trực tuyến tại Server/bàn thuyết trình.
   */
    async getLocalDeviceId(timeoutMs: number = 1200): Promise<string> {
    const isIPad =
      typeof document !== 'undefined' &&
      (document.documentElement.getAttribute('data-device-mode') === 'ipad' ||
        (typeof navigator !== 'undefined' &&
          (navigator.maxTouchPoints >= 2 ||
            /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
            (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1))));

    // 1. Nếu không phải iPad, thử gọi Local Agent trước
    if (!isIPad) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);   // ← Honor full timeout (F6)
      try {
        const res = await fetch(DEVICE_ID_URL, { signal: ctrl.signal });
        if (res.ok) {
          const data = await res.json();
          if (data.device_id) return data.device_id;
        }
      } catch {
        // Local agent không có trên máy này -> fallback sang Server (silent)
      } finally {
        clearTimeout(timer);
      }
    }

    // 2. Fallback cho iPad Air M4 hoặc Server Presentation Station
    try {
      const serverAgents = await http<{ items: Array<{ device_id: string }> }>(
        '/api/admin/fingerprint/agents',
        { method: 'GET', skipErrorNotification: true }
      );
      if (serverAgents?.items?.length > 0 && serverAgents.items[0].device_id) {
        return serverAgents.items[0].device_id;
      }
    } catch {
      // Bỏ qua lỗi fallback
    }

    throw new Error('AGENT_NOT_RUNNING');
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
      body: JSON.stringify({ file_id: fileId, device_id: deviceId }),
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
   * Poll trạng thái enroll 3 bước qua Express Gateway (/api/admin/fingerprint/enroll-status?deviceId=...).
   * Express Gateway nhận sự kiện WebSocket thời gian thực từ ZK9500 Agent.
   * Dùng silent: true & skipErrorNotification: true để tuyệt đối không log lỗi vào console.
   */
  async getEnrollStatus(deviceId?: string): Promise<EnrollStatusResponse | null> {
    try {
      const query = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : '';
      const res = await http<EnrollStatusResponse>(
        `/api/admin/fingerprint/enroll-status${query}`,
        {
          method: 'GET',
          skipErrorNotification: true,
          silent: true,
        }
      );
      if (res && typeof res.step === 'number') {
        return res;
      }
    } catch {
      // Bỏ qua lỗi polling im lặng
    }
    return null;
  },
};

export default fingerprintService;