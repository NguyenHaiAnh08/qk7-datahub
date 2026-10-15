import { http } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { Role } from '../types/user';

/**
 * Role Service — Quản lý vai trò người dùng trong hệ thống
 */
export const roleService = {
  getRoles: async (): Promise<{ total: number; items: Role[] }> => {
    return http<{ total: number; items: Role[] }>(API_ENDPOINTS.ADMIN.ROLES);
  },

  createRole: async (data: { role_id: string; name: string }): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.ROLES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  updateRole: async (roleId: string, data: { name: string }): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.ROLE_DETAIL(roleId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  deleteRole: async (roleId: string): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.ROLE_DETAIL(roleId), {
      method: 'DELETE',
    });
  },
};
