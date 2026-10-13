import {
  User,
  DocumentItem,
  MetaData,
  AdminStats,
  AccessLog,
  Role,
  Permission,
  Unit,
  DocumentType,
  SecurityLevel
} from '../types';

/**
 * Lấy header xác thực người dùng hiện tại từ sessionStorage
 */
export function getAuthHeaders(): Record<string, string> {
  const userId = sessionStorage.getItem('qk7_username') || 'GUEST';
  const clearance = sessionStorage.getItem('qk7_level') || '1';
  return {
    'X-User-Id': userId,
    'X-Clearance': String(clearance)
  };
}

/**
 * Generic request helper
 */
async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type') || '';
  let data: any = null;
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => ({}));
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = (typeof data === 'object' && data?.error) ? data.error : `Lỗi HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  // ─── AUTH ───
  login: async (user_id: string, password: string): Promise<{ success: boolean; user: User }> => {
    return request<{ success: boolean; user: User }>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user_id.trim(), password })
    });
  },

  getMe: async (): Promise<User> => {
    return request<User>('/api/auth/me');
  },

  getHealth: async (): Promise<{ ok: boolean; db?: string; login_name?: string; now?: string }> => {
    return request('/api/health');
  },

  // ─── METADATA ───
  getMeta: async (): Promise<MetaData> => {
    return request<MetaData>('/api/meta');
  },

  // ─── DOCUMENTS ───
  getDocuments: async (params: {
    code?: string;
    title?: string;
    type?: string;
    unit?: string;
    from?: string;
    to?: string;
    lv?: number | string;
  } = {}): Promise<{ total: number; items: DocumentItem[] }> => {
    const searchParams = new URLSearchParams();
    if (params.code) searchParams.append('code', params.code);
    if (params.title) searchParams.append('title', params.title);
    if (params.type) searchParams.append('type', params.type);
    if (params.unit) searchParams.append('unit', params.unit);
    if (params.from) searchParams.append('from', params.from);
    if (params.to) searchParams.append('to', params.to);
    if (params.lv) searchParams.append('lv', String(params.lv));

    const qs = searchParams.toString();
    return request<{ total: number; items: DocumentItem[] }>(`/api/documents${qs ? `?${qs}` : ''}`);
  },

  getDocumentById: async (fileId: string): Promise<DocumentItem> => {
    return request<DocumentItem>(`/api/documents/${encodeURIComponent(fileId)}`);
  },

  uploadDocument: async (formData: FormData): Promise<{ success: boolean; file_id: string; stored_path: string; sha256: string }> => {
    // Không thêm Content-Type header để browser tự đặt boundary cho multipart/form-data
    return request('/api/documents/upload', {
      method: 'POST',
      body: formData
    });
  },

  updateDocument: async (fileId: string, formData: FormData): Promise<{ success: boolean; file_id: string; replaced_file: boolean; stored_path: string }> => {
    return request(`/api/documents/${encodeURIComponent(fileId)}`, {
      method: 'PUT',
      body: formData
    });
  },

  deleteDocument: async (fileId: string): Promise<{ success: boolean; file_id: string }> => {
    return request(`/api/documents/${encodeURIComponent(fileId)}`, {
      method: 'DELETE'
    });
  },

  getFileViewUrl: (fileId: string, download = false): string => {
    return `/api/files/${encodeURIComponent(fileId)}/view${download ? '?download=1' : ''}`;
  },

  getAccessLogs: async (params: { user?: string; action?: string } = {}): Promise<{ total: number; items: AccessLog[] }> => {
    const searchParams = new URLSearchParams();
    if (params.user) searchParams.append('user', params.user);
    if (params.action) searchParams.append('action', params.action);
    const qs = searchParams.toString();
    return request<{ total: number; items: AccessLog[] }>(`/api/access-logs${qs ? `?${qs}` : ''}`);
  },

  // ─── ADMIN DASHBOARD ───
  getAdminStats: async (): Promise<AdminStats> => {
    return request<AdminStats>('/api/admin/stats');
  },

  getAdminUsers: async (): Promise<{ total: number; items: User[] }> => {
    return request<{ total: number; items: User[] }>('/api/admin/users');
  },

  createAdminUser: async (userData: {
    user_id: string;
    username: string;
    password: string;
    full_name: string;
    rank_name?: string;
    position?: string;
    unit_id?: string;
    status?: string;
    clearance_level_id: number;
  }): Promise<{ success: boolean; user_id: string; username: string }> => {
    return request('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
  },

  updateAdminUser: async (userId: string, data: Partial<User>): Promise<{ success: boolean }> => {
    return request(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  deleteAdminUser: async (userId: string): Promise<{ success: boolean }> => {
    return request(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    });
  },

  updateAdminCredentials: async (userId: string, data: { username: string; password?: string }): Promise<{ success: boolean; user_id: string; username: string }> => {
    return request(`/api/admin/users/${encodeURIComponent(userId)}/credentials`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  getAdminRoles: async (): Promise<{ total: number; items: Role[] }> => {
    return request<{ total: number; items: Role[] }>('/api/admin/roles');
  },

  createAdminRole: async (data: { role_id: string; name: string }): Promise<{ success: boolean }> => {
    return request('/api/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  updateAdminRole: async (roleId: string, data: { name: string }): Promise<{ success: boolean }> => {
    return request(`/api/admin/roles/${encodeURIComponent(roleId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  deleteAdminRole: async (roleId: string): Promise<{ success: boolean }> => {
    return request(`/api/admin/roles/${encodeURIComponent(roleId)}`, {
      method: 'DELETE'
    });
  },

  getAdminPermissions: async (): Promise<{ total: number; items: Permission[] }> => {
    return request<{ total: number; items: Permission[] }>('/api/admin/permissions');
  },

  deleteAdminPermission: async (permId: string): Promise<{ success: boolean }> => {
    return request(`/api/admin/permissions/${encodeURIComponent(permId)}`, {
      method: 'DELETE'
    });
  },

  getAdminUnits: async (): Promise<{ total: number; items: Unit[] }> => {
    return request<{ total: number; items: Unit[] }>('/api/admin/units');
  },

  createAdminUnit: async (data: { unit_id: string; name: string; parent_id?: string }): Promise<{ success: boolean }> => {
    return request('/api/admin/units', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  updateAdminUnit: async (unitId: string, data: { name: string; parent_id?: string }): Promise<{ success: boolean }> => {
    return request(`/api/admin/units/${encodeURIComponent(unitId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  deleteAdminUnit: async (unitId: string): Promise<{ success: boolean }> => {
    return request(`/api/admin/units/${encodeURIComponent(unitId)}`, {
      method: 'DELETE'
    });
  },

  getAdminDocTypes: async (): Promise<{ total: number; items: DocumentType[] }> => {
    return request<{ total: number; items: DocumentType[] }>('/api/admin/document-types');
  },

  createAdminDocType: async (data: { type_id: string; name: string; description?: string }): Promise<{ success: boolean }> => {
    return request('/api/admin/document-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  updateAdminDocType: async (typeId: string, data: { name: string; description?: string }): Promise<{ success: boolean }> => {
    return request(`/api/admin/document-types/${encodeURIComponent(typeId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  deleteAdminDocType: async (typeId: string): Promise<{ success: boolean }> => {
    return request(`/api/admin/document-types/${encodeURIComponent(typeId)}`, {
      method: 'DELETE'
    });
  },

  getAdminSecurityLevels: async (): Promise<{ total: number; items: SecurityLevel[] }> => {
    return request<{ total: number; items: SecurityLevel[] }>('/api/admin/security-levels');
  },

  createAdminSecurityLevel: async (data: { level_id: number; code: string; name: string }): Promise<{ success: boolean }> => {
    return request('/api/admin/security-levels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  updateAdminSecurityLevel: async (levelId: number, data: { code: string; name: string }): Promise<{ success: boolean }> => {
    return request(`/api/admin/security-levels/${levelId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  deleteAdminSecurityLevel: async (levelId: number): Promise<{ success: boolean }> => {
    return request(`/api/admin/security-levels/${levelId}`, {
      method: 'DELETE'
    });
  }
};
