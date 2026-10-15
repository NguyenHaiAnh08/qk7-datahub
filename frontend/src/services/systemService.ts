import { http } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { AdminStats } from '../types/user';
import { MetaData, SystemHealth } from '../types/document';

/**
 * System Service — Kiểm tra kết nối hệ thống, metadata danh mục và thống kê
 */
export const systemService = {
  getHealth: async (): Promise<SystemHealth> => {
    return http<SystemHealth>(API_ENDPOINTS.SYSTEM.HEALTH);
  },

  getMeta: async (): Promise<MetaData> => {
    return http<MetaData>(API_ENDPOINTS.SYSTEM.META);
  },

  getStats: async (): Promise<AdminStats> => {
    return http<AdminStats>(API_ENDPOINTS.ADMIN.STATS);
  },

  testHttpError: async (code: number, message?: string): Promise<any> => {
    const query = message ? `?msg=${encodeURIComponent(message)}` : '';
    return http(`${API_ENDPOINTS.SYSTEM.TEST_HTTP_ERROR(code)}${query}`, {
      skipErrorNotification: false,
    });
  },
};
