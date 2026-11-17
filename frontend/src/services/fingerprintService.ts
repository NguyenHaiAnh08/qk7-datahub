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

// Local Fingerprint Agent chạy HTTP trên loopback.
// Không tự đổi sang HTTPS theo giao thức của website.
// Agent hiện tại chỉ khởi tạo HTTPServer, không có HTTPS listener.
const AGENT_BASE =
  (import.meta.env.VITE_FINGERPRINT_AGENT_URL as string) ||
  'http://127.0.0.1:9001';

const DEVICE_ID_URL = `${AGENT_BASE.replace(/\/+$/, '')}/device-id`;
const ENROLL_STATUS_URL = `${AGENT_BASE.replace(/\/+$/, '')}/enroll-status`;


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

  // 1. Máy tính: ưu tiên lấy Device ID trực tiếp từ Agent localhost.
  if (!isIPad) {
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        timeoutMs
      );

      let res: Response;

      try {
        res = await fetch(DEVICE_ID_URL, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
          },
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeoutId);
      }

      if (!res.ok) {
        throw new Error(`AGENT_HTTP_${res.status}`);
      }

      const data = await res.json();

      if (
        typeof data?.device_id === 'string' &&
        data.device_id.trim().length > 0
      ) {
        return data.device_id.trim();
      }

      throw new Error('AGENT_DEVICE_ID_EMPTY');
    } catch (error) {
      console.warn(
        '[Fingerprint] Không lấy được Device ID từ Local Agent:',
        error
      );
    }
  }

  // 2. Fallback cho iPad hoặc máy không lấy được Device ID local.
  // Endpoint này có thể yêu cầu đăng nhập; không bỏ qua xác thực.
  try {
    const serverAgents = await http<{
      items: Array<{ device_id: string }>;
    }>(
      '/api/fingerprint/agents-online',
      {
        method: 'GET',
        skipErrorNotification: true,
        silent: true,
        signal: AbortSignal.timeout(3500),
      }
    );

    const deviceId = serverAgents?.items?.find(
      (item) =>
        typeof item?.device_id === 'string' &&
        item.device_id.trim().length > 0
    )?.device_id;

    if (deviceId) {
      return deviceId.trim();
    }
  } catch (error) {
    console.warn(
      '[Fingerprint] Không lấy được Device ID từ Backend fallback:',
      error
    );
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