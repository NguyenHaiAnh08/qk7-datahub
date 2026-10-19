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

  getUserRoles: async (userId: string): Promise<{ items: Array<{ role_id: string; name: string }> }> => {
    return http<{ items: Array<{ role_id: string; name: string }> }>(API_ENDPOINTS.ADMIN.USER_ROLES(userId));
  },

  assignRoleToUser: async (userId: string, roleId: string): Promise<{ success: boolean }> => {
    return http<{ success: boolean }>(API_ENDPOINTS.ADMIN.USER_ROLES(userId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: roleId }),
    });
  },

  revokeRoleFromUser: async (userId: string, roleId: string): Promise<{ success: boolean }> => {
    return http<{ success: boolean }>(API_ENDPOINTS.ADMIN.USER_ROLE_DETAIL(userId, roleId), {
      method: 'DELETE',
    });
  },
};
