import { http } from './http';

export interface PinVerifyResponse {
  success: boolean;
  fingerprint_token: string;
  expires_in: string;
}

export interface PinStatus {
  ready: boolean;
  has_pin: boolean;
  viewable: boolean;
  has_fingerprint: boolean;
  request_pending: boolean;
  notice: 'NEW' | 'ROTATE' | 'REVIEW' | null;
}

export const pinService = {
  status: async (): Promise<PinStatus> => http<PinStatus>('/api/user/pin-status', { skipErrorNotification: true }),

  /** Xem lần đầu (không cần vân tay) — chỉ khi status.notice = 'NEW' */
  takeFirstView: async (): Promise<{ pin: string }> =>
    http<{ pin: string }>('/api/user/my-pin', { skipErrorNotification: true }),

  /** Xem lại mã PIN: máy chủ chỉ trả mã sau khi quét đúng vân tay trên đầu đọc deviceId */
  reveal: async (deviceId: string, signal: AbortSignal): Promise<{ pin: string }> =>
    http<{ pin: string }>('/api/user/my-pin/reveal', {
      method: 'POST',
      headers: { 'X-Device-FP': deviceId },
      skipErrorNotification: true,
      signal,
    }),

  verify: async (pinChallengeToken: string, pin: string): Promise<PinVerifyResponse> => {
    return http<PinVerifyResponse>('/api/auth/pin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin_challenge_token: pinChallengeToken, pin }),
      skipErrorNotification: true,
    });
  },
};

export default pinService;