import { http } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { SecurityLevel } from '../types/document';

/**
 * SecurityLevel Service — Quản lý 5 cấp độ bảo mật quân sự
 */
export const securityLevelService = {
  getSecurityLevels: async (): Promise<{ total: number; items: SecurityLevel[] }> => {
    return http<{ total: number; items: SecurityLevel[] }>(API_ENDPOINTS.ADMIN.SECURITY_LEVELS);
  },

  createSecurityLevel: async (data: { level_id: number; code: string; name: string }): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.SECURITY_LEVELS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  updateSecurityLevel: async (levelId: number, data: { code: string; name: string }): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.SECURITY_LEVEL_DETAIL(levelId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  deleteSecurityLevel: async (levelId: number): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.SECURITY_LEVEL_DETAIL(levelId), {
      method: 'DELETE',
    });
  },
};
