import { http } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { ActiveSession } from '../types/user';

export const sessionService = {
  async listActive(userId?: string): Promise<{ items: ActiveSession[] }> {
    const qs = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
    return http<{ items: ActiveSession[] }>(`${API_ENDPOINTS.ADMIN.SESSIONS}${qs}`);
  },

  async kill(sessionId: string): Promise<{ success: boolean; killed_count: number }> {
    return http(API_ENDPOINTS.ADMIN.SESSION_DETAIL(sessionId), { method: 'DELETE' });
  },

  async killAllForUser(userId: string): Promise<{ success: boolean; revoked_count: number }> {
    return http(API_ENDPOINTS.ADMIN.USER_SESSIONS(userId), { method: 'DELETE' });
  },
};

export default sessionService;