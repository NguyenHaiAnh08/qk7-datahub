import { http } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { AdminStats } from '../types/user';
import { MetaData } from '../types/document';

/**
 * System Service — Kiểm tra kết nối hệ thống, metadata danh mục và thống kê
 */
export const systemService = {
  getHealth: async (): Promise<{ ok: boolean; db?: string; login_name?: string; now?: string }> => {
    return http(API_ENDPOINTS.SYSTEM.HEALTH);
  },

  getMeta: async (): Promise<MetaData> => {
    return http<MetaData>(API_ENDPOINTS.SYSTEM.META);
  },

  getStats: async (): Promise<AdminStats> => {
    return http<AdminStats>(API_ENDPOINTS.ADMIN.STATS);
  },
};
