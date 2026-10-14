import { http } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { AccessLog } from '../types/user';

/**
 * Log Service — Nhật ký truy vết an ninh (Access Log)
 */
export const logService = {
  getAccessLogs: async (
    params: { user?: string; action?: string } = {}
  ): Promise<{ total: number; items: AccessLog[] }> => {
    const searchParams = new URLSearchParams();
    if (params.user) searchParams.append('user', params.user);
    if (params.action) searchParams.append('action', params.action);
    const qs = searchParams.toString();
    return http<{ total: number; items: AccessLog[] }>(
      `${API_ENDPOINTS.LOGS.LIST}${qs ? `?${qs}` : ''}`
    );
  },
};
