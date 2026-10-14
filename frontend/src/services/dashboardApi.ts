import { http } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { AdminStats, AccessLog, Role, Permission, Unit } from '../types/user';
import { MetaData, DocumentType, SecurityLevel } from '../types/document';

export const dashboardApi = {
  getStats: async (): Promise<AdminStats> => {
    return http<AdminStats>(API_ENDPOINTS.ADMIN.STATS);
  },

  getHealth: async (): Promise<{ ok: boolean; db?: string; login_name?: string; now?: string }> => {
    return http(API_ENDPOINTS.SYSTEM.HEALTH);
  },

  getMeta: async (): Promise<MetaData> => {
    return http<MetaData>(API_ENDPOINTS.SYSTEM.META);
  },

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

  // Roles
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

  // Permissions
  getPermissions: async (): Promise<{ total: number; items: Permission[] }> => {
    return http<{ total: number; items: Permission[] }>(API_ENDPOINTS.ADMIN.PERMISSIONS);
  },
  deletePermission: async (permId: string): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.PERMISSION_DETAIL(permId), {
      method: 'DELETE',
    });
  },

  // Units
  getUnits: async (): Promise<{ total: number; items: Unit[] }> => {
    return http<{ total: number; items: Unit[] }>(API_ENDPOINTS.ADMIN.UNITS);
  },
  createUnit: async (data: { unit_id: string; name: string; parent_id?: string }): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.UNITS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
  updateUnit: async (unitId: string, data: { name: string; parent_id?: string }): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.UNIT_DETAIL(unitId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
  deleteUnit: async (unitId: string): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.UNIT_DETAIL(unitId), {
      method: 'DELETE',
    });
  },

  // Document Types
  getDocumentTypes: async (): Promise<{ total: number; items: DocumentType[] }> => {
    return http<{ total: number; items: DocumentType[] }>(API_ENDPOINTS.ADMIN.DOCUMENT_TYPES);
  },
  createDocumentType: async (data: { type_id: string; name: string; description?: string }): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.DOCUMENT_TYPES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
  updateDocumentType: async (typeId: string, data: { name: string; description?: string }): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.DOCUMENT_TYPE_DETAIL(typeId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
  deleteDocumentType: async (typeId: string): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.DOCUMENT_TYPE_DETAIL(typeId), {
      method: 'DELETE',
    });
  },

  // Security Levels
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
