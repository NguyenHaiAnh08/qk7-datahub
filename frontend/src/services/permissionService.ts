import { http } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { Permission } from '../types/user';

/**
 * Permission Service — Quản lý phân quyền chức năng
 */
export const permissionService = {
  getPermissions: async (): Promise<{ total: number; items: Permission[] }> => {
    return http<{ total: number; items: Permission[] }>(API_ENDPOINTS.ADMIN.PERMISSIONS);
  },

  deletePermission: async (permId: string): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.PERMISSION_DETAIL(permId), {
      method: 'DELETE',
    });
  },
};
