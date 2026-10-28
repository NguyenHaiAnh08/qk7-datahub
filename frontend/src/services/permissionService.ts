import { http } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { Permission, UserPermissionResponse } from '../types/user';

export const permissionService = {
  // ─── CATALOG ───
  getPermissions: async (): Promise<{ total: number; items: Permission[] }> => {
    return http<{ total: number; items: Permission[] }>(API_ENDPOINTS.ADMIN.PERMISSIONS);
  },

  createPermission: async (data: {
    permission_id: string;
    code: string;
    description?: string | null;
    group_code: string;
    subgroup_key?: string | null;
    subgroup_label?: string | null;
    subgroup_order?: number;
    subgroup_tone?: string;
    sort_order?: number;
  }): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.PERMISSIONS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  updatePermission: async (
    permId: string,
    data: {
      description?: string | null;
      group_code?: string;
      subgroup_key?: string | null;
      subgroup_label?: string | null;
      subgroup_order?: number;
      subgroup_tone?: string;
      sort_order?: number;
    }
  ): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.PERMISSION_DETAIL(permId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  deletePermission: async (permId: string): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.PERMISSION_DETAIL(permId), { method: 'DELETE' });
  },

  // ─── USER DIRECT PERMISSIONS ───
  getUserPermissions: async (userId: string): Promise<UserPermissionResponse> => {
    return http<UserPermissionResponse>(API_ENDPOINTS.ADMIN.USER_PERMISSIONS(userId));
  },

  grantUserPermission: async (
    userId: string,
    permission_id: string,
    opts?: { expires_at?: string | null; note?: string }
  ) => {
    return http(API_ENDPOINTS.ADMIN.USER_PERMISSIONS(userId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission_id, ...opts }),
    });
  },

  revokeUserPermission: async (
    userId: string,
    permissionId: string
  ): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.USER_PERMISSION_DETAIL(userId, permissionId), {
      method: 'DELETE',
    });
  },

  // ─── ROLE PERMISSIONS ───
  getRolePermissions: async (roleId: string): Promise<{ items: Permission[] }> => {
    return http<{ items: Permission[] }>(API_ENDPOINTS.ADMIN.ROLE_PERMISSIONS(roleId));
  },

  assignPermissionToRole: async (
    roleId: string,
    permission_id: string
  ): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.ROLE_PERMISSIONS(roleId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission_id }),
    });
  },

  revokePermissionFromRole: async (
    roleId: string,
    permissionId: string
  ): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.ROLE_PERMISSION_DETAIL(roleId, permissionId), {
      method: 'DELETE',
    });
  },
};