import { http } from './http';

// ─────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────

export interface FingerprintVerifyResponse {
  success: boolean;
  required: boolean;
  fingerprint_token: string | null;
  // [v5.1] Cấp 4-5 yêu cầu PIN
  require_pin?: boolean;
  pin_challenge_token?: string;
  pin_expires_in?: string;
  security_level_id?: number;
  // Cũ
  expires_in?: string;
  score?: number;
  error?: string;
  agent_offline?: boolean;
  needs_enroll?: boolean;
  needs_admin_pin?: boolean;
}

export interface FingerprintStatusResponse {
  user_id: string;
  has_fingerprint: boolean;
  has_pin?: boolean;
  enrolled_at?: string;
}

export interface EnrollStatusResponse {
  enrolling: boolean;
  step: number;
  total: number;
  state: string;
}

// Local Fingerprint Agent chạy trên loopback (HTTPS nếu có cert, ngược lại HTTP).
// getLocalDeviceId() tự thử cả https/http; có thể ép bằng VITE_FINGERPRINT_AGENT_URL.
const AGENT_BASE_OVERRIDE =
  (import.meta.env.VITE_FINGERPRINT_AGENT_URL as string) || '';

// Nhớ địa chỉ Local Agent đã phản hồi thành công để lần sau không thử sai giao thức.
let lastWorkingAgentUrl = '';



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

async getLocalDeviceId(timeoutMs: number = 2500): Promise<string> {
  const isHttpsPage =
    typeof window !== 'undefined' && window.location.protocol === 'https:';

  const isIPad =
    typeof document !== 'undefined' &&
    (
      document.documentElement.getAttribute('data-device-mode') === 'ipad' ||
      (
        typeof navigator !== 'undefined' &&
        (
          navigator.maxTouchPoints >= 2 ||
          /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
          (
            /Macintosh/i.test(navigator.userAgent) &&
            navigator.maxTouchPoints > 1
          )
        )
      )
    );

  const fetchGatewayAgents = async (): Promise<string[]> => {
    try {
      // 1. Thử trực tiếp endpoint /api/fingerprint/device-id
      try {
        const direct = await http<{ device_id: string }>(
          '/api/fingerprint/device-id',
          {
            method: 'GET',
            skipErrorNotification: true,
            silent: true,
            signal: AbortSignal.timeout(Math.min(timeoutMs, 1500)),
          }
        );
        if (direct?.device_id && typeof direct.device_id === 'string' && direct.device_id.trim()) {
          return [direct.device_id.trim()];
        }
      } catch (_) {}

      // 2. Dự phòng danh sách /api/fingerprint/agents-online
      const res = await http<{ items: Array<{ device_id: string }> }>(
        '/api/fingerprint/agents-online',
        {
          method: 'GET',
          skipErrorNotification: true,
          silent: true,
          signal: AbortSignal.timeout(Math.min(timeoutMs, 3000)),
        }
      );
      return (res?.items ?? [])
        .map((i) => (typeof i?.device_id === 'string' ? i.device_id.trim() : ''))
        .filter(Boolean);
    } catch (error) {
      console.warn('[Fingerprint] Không lấy được danh sách agent từ Gateway:', error);
      return [];
    }
  };

  // iPad/điện thoại không có đầu đọc cục bộ: dùng đầu đọc online tại Server/bàn thuyết trình.
  if (isIPad) {
    const agents = await fetchGatewayAgents();
    if (agents.length > 0) return agents[0];
    throw new Error('AGENT_NOT_RUNNING');
  }

  // PC: LUÔN ưu tiên Local Agent của chính máy này (127.0.0.1) để nhiều máy con
  // cùng kết nối 1 Server mà không bị gán nhầm đầu đọc của máy khác.
  const override = AGENT_BASE_OVERRIDE.replace(/\/+$/, '');
  const candidates = Array.from(
    new Set(
      [
        lastWorkingAgentUrl,
        override,
        'https://127.0.0.1:9001',
        ...(isHttpsPage ? [] : ['http://127.0.0.1:9001']),
      ].filter(Boolean)
    )
  );

  for (const url of candidates) {
    try {
      const res = await fetch(`${url}/device-id`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(Math.min(timeoutMs, 1500)),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (typeof data?.device_id === 'string' && data.device_id.trim()) {
        lastWorkingAgentUrl = url;
        return data.device_id.trim();
      }
    } catch (_) {
      // thử ứng viên tiếp theo
    }
  }

  // Fallback: Lấy qua Gateway khi Local Agent chưa phản hồi trực tiếp (vd: trình duyệt chặn mixed content HTTPS)
  const agents = await fetchGatewayAgents();
  if (agents.length > 0) {
    if (agents.length > 1) {
      console.warn('[Fingerprint] Có nhiều agent online, tự động chọn agent đầu tiên:', agents[0]);
    }
    return agents[0];
  }

  throw new Error('AGENT_NOT_RUNNING');
},


  /**
   * Xác thực vân tay cho 1 file cụ thể.
   * @param signal AbortSignal — để FE có thể hủy request khi user đóng modal.
   */
     /**
   * Xác thực vân tay cho 1 file cụ thể.
   * @param signal AbortSignal — để FE có thể hủy request khi user đóng modal.
   */
  async verify(
    fileId: string,
    deviceId: string,
    signal?: AbortSignal
  ): Promise<FingerprintVerifyResponse> {
    // Tạo timeout 40s chống treo
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 40000);

    // Kết hợp signal từ bên ngoài (nếu user bấm Hủy) và signal timeout (an toàn cho mọi trình duyệt)
    const controller = new AbortController();
    const abortHandler = () => controller.abort();

    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', abortHandler);
    }

    const timeoutHandler = () => controller.abort();
    timeoutController.signal.addEventListener('abort', timeoutHandler);

    try {
      return await http<FingerprintVerifyResponse>('/api/auth/fingerprint/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-FP': deviceId,
        },
        body: JSON.stringify({ file_id: fileId, device_id: deviceId }),
        skipErrorNotification: true,
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err.name === 'AbortError' && !signal?.aborted) {
        throw new Error('Quá thời gian chờ phản hồi từ máy quét (40s). Vui lòng kiểm tra lại cáp USB và phần mềm Agent.');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', abortHandler);
      timeoutController.signal.removeEventListener('abort', timeoutHandler);
    }
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