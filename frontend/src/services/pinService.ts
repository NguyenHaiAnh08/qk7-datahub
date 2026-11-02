import { http } from './http';

export interface PinVerifyResponse {
  success: boolean;
  fingerprint_token: string;
  expires_in: string;
}

export const pinService = {
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