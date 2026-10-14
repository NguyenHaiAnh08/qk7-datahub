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
    return http<User>(API_ENDPOINTS.AUTH.ME);
  },

  saveSession: (user: User) => {
    sessionStorage.setItem('qk7_username', user.user_id);
    sessionStorage.setItem('qk7_name', user.full_name);
    sessionStorage.setItem('qk7_level', String(user.clearance_level_id));
    if (user.unit_id) sessionStorage.setItem('qk7_unit', user.unit_id);
    if (user.position) sessionStorage.setItem('qk7_position', user.position);
    if (user.rank_name) sessionStorage.setItem('qk7_rank', user.rank_name);
    if (user.clearance_name) sessionStorage.setItem('qk7_clearance_name', user.clearance_name);
  },

  clearSession: () => {
    sessionStorage.removeItem('qk7_username');
    sessionStorage.removeItem('qk7_name');
    sessionStorage.removeItem('qk7_level');
    sessionStorage.removeItem('qk7_unit');
    sessionStorage.removeItem('qk7_position');
    sessionStorage.removeItem('qk7_rank');
    sessionStorage.removeItem('qk7_clearance_name');
  },

  getCurrentSession: (): User => {
    const userId = sessionStorage.getItem('qk7_username');
    if (!userId) {
      return {
        user_id: 'GUEST',
        full_name: 'Khách',
        clearance_level_id: 1,
        clearance_name: 'Công khai',
      };
    }
    return {
      user_id: userId,
      full_name: sessionStorage.getItem('qk7_name') || userId,
      clearance_level_id: parseInt(sessionStorage.getItem('qk7_level') || '1', 10),
      unit_id: sessionStorage.getItem('qk7_unit') || undefined,
      position: sessionStorage.getItem('qk7_position') || undefined,
      rank_name: sessionStorage.getItem('qk7_rank') || undefined,
      clearance_name: sessionStorage.getItem('qk7_clearance_name') || undefined,
    };
  },
};
