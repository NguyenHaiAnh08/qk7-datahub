import { http } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { User } from '../types/user';

export const usersApi = {
  getUsers: async (): Promise<{ total: number; items: User[] }> => {
    return http<{ total: number; items: User[] }>(API_ENDPOINTS.ADMIN.USERS);
  },

  createUser: async (userData: {
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
    return http(API_ENDPOINTS.ADMIN.USERS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
  },

  updateUser: async (userId: string, data: Partial<User>): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.USER_DETAIL(userId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  deleteUser: async (userId: string): Promise<{ success: boolean }> => {
    return http(API_ENDPOINTS.ADMIN.USER_DETAIL(userId), {
      method: 'DELETE',
    });
  },

  updateCredentials: async (
    userId: string,
    data: { username: string; password?: string }
  ): Promise<{ success: boolean; user_id: string; username: string }> => {
    return http(API_ENDPOINTS.ADMIN.USER_CREDENTIALS(userId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
};
