import { http } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { User } from '../types/user';

export const authService = {
  login: async (user_id: string, password: string): Promise<{ success: boolean; user: User }> => {
    return http<{ success: boolean; user: User }>(API_ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user_id.trim(), password }),
    });
  },

  getMe: async (): Promise<User> => {
    const res = await http<any>(API_ENDPOINTS.AUTH.ME);
    if (res && res.user) {
      return res.user as User;
    }
    return res as User;
  },

  saveSession: (user: User) => {
    // Lưu trọn vẹn đối tượng user
    try {
      sessionStorage.setItem('qk7_user', JSON.stringify(user));
    } catch (e) {
      console.warn('[authService] Failed to serialize user to sessionStorage', e);
    }

    // Lưu các trường khóa lẻ để tương thích ngược với http.ts và các services khác
    sessionStorage.setItem('qk7_username', user.user_id);
    sessionStorage.setItem('qk7_name', user.full_name);
    sessionStorage.setItem('qk7_level', String(user.clearance_level_id));
    if (user.username) sessionStorage.setItem('qk7_user_login', user.username);
    if (user.unit_id) sessionStorage.setItem('qk7_unit', user.unit_id);
    if (user.unit_name) sessionStorage.setItem('qk7_unit_name', user.unit_name);
    if (user.position) sessionStorage.setItem('qk7_position', user.position);
    if (user.rank_name) sessionStorage.setItem('qk7_rank', user.rank_name);
    if (user.clearance_name) sessionStorage.setItem('qk7_clearance_name', user.clearance_name);
    if (user.clearance_code) sessionStorage.setItem('qk7_clearance_code', user.clearance_code);
    if (user.status) sessionStorage.setItem('qk7_status', user.status);
    if (user.roles) sessionStorage.setItem('qk7_roles', JSON.stringify(user.roles));
    if (user.role_names) sessionStorage.setItem('qk7_role_names', JSON.stringify(user.role_names));
  },

  clearSession: () => {
    sessionStorage.removeItem('qk7_user');
    sessionStorage.removeItem('qk7_username');
    sessionStorage.removeItem('qk7_user_login');
    sessionStorage.removeItem('qk7_name');
    sessionStorage.removeItem('qk7_level');
    sessionStorage.removeItem('qk7_unit');
    sessionStorage.removeItem('qk7_unit_name');
    sessionStorage.removeItem('qk7_position');
    sessionStorage.removeItem('qk7_rank');
    sessionStorage.removeItem('qk7_clearance_name');
    sessionStorage.removeItem('qk7_clearance_code');
    sessionStorage.removeItem('qk7_status');
    sessionStorage.removeItem('qk7_roles');
    sessionStorage.removeItem('qk7_role_names');
  },

  getCurrentSession: (): User => {
    // Ưu tiên đọc từ session JSON đầy đủ
    const rawUser = sessionStorage.getItem('qk7_user');
    if (rawUser) {
      try {
        const parsed = JSON.parse(rawUser);
        if (parsed && parsed.user_id) {
          return parsed;
        }
      } catch (e) {
        // Fallback đọc từng key
      }
    }

    const userId = sessionStorage.getItem('qk7_username');
    if (!userId || userId === 'GUEST') {
      return {
        user_id: 'GUEST',
        full_name: 'Khách',
        clearance_level_id: 1,
        clearance_name: 'Công khai',
      };
    }

    let roles: string[] | undefined;
    let roleNames: string[] | undefined;
    try {
      const rawRoles = sessionStorage.getItem('qk7_roles');
      if (rawRoles) roles = JSON.parse(rawRoles);
      const rawRoleNames = sessionStorage.getItem('qk7_role_names');
      if (rawRoleNames) roleNames = JSON.parse(rawRoleNames);
    } catch {
      // ignore
    }

    return {
      user_id: userId,
      username: sessionStorage.getItem('qk7_user_login') || userId.toLowerCase(),
      full_name: sessionStorage.getItem('qk7_name') || userId,
      clearance_level_id: parseInt(sessionStorage.getItem('qk7_level') || '1', 10),
      unit_id: sessionStorage.getItem('qk7_unit') || undefined,
      unit_name: sessionStorage.getItem('qk7_unit_name') || undefined,
      position: sessionStorage.getItem('qk7_position') || undefined,
      rank_name: sessionStorage.getItem('qk7_rank') || undefined,
      clearance_name: sessionStorage.getItem('qk7_clearance_name') || undefined,
      clearance_code: sessionStorage.getItem('qk7_clearance_code') || undefined,
      status: sessionStorage.getItem('qk7_status') || 'active',
      roles,
      role_names: roleNames,
    };
  },
};
