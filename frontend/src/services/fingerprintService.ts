import { http } from './http';

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

const DEVICE_ID_URL = 'http://127.0.0.1:9001/device-id';

export const fingerprintService = {
  async getLocalDeviceId(timeoutMs: number = 2000): Promise<string> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(DEVICE_ID_URL, { signal: ctrl.signal });
      if (!res.ok) throw new Error('Agent lỗi');
      const data = await res.json();
      if (!data.device_id) throw new Error('Agent thiếu device_id');
      return data.device_id;
    } catch (err: any) {
      throw new Error('AGENT_NOT_RUNNING');
    } finally {
      clearTimeout(timer);
    }
  },

  async verify(fileId: string, deviceId: string): Promise<FingerprintVerifyResponse> {
    return http<FingerprintVerifyResponse>('/api/auth/fingerprint/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-FP': deviceId,
      },
      body: JSON.stringify({ file_id: fileId }),
      skipErrorNotification: true,
    });
  },

  async enrollForUser(userId: string, deviceId: string): Promise<{ success: boolean; user_id: string }> {
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
      }
    );
  },
  async checkStatus(userId: string): Promise<{ user_id: string; has_fingerprint: boolean; enrolled_at?: string }> {
    return http<{ user_id: string; has_fingerprint: boolean; enrolled_at?: string }>(
      `/api/admin/fingerprint/status/${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        skipErrorNotification: true,
      }
    );
  },

  async getEnrollStatus(): Promise<{ enrolling: boolean; step: number; total: number; state: string } | null> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1000);
    try {
      const res = await fetch('http://127.0.0.1:9001/enroll-status', { signal: ctrl.signal });
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