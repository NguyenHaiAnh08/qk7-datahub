import { http } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { Unit } from '../types/user';

/**
 * Unit Service — Quản lý đơn vị ban ngành trực thuộc Quân Khu 7
 */
export const unitService = {
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
};
