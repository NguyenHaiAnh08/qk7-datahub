// frontend/src/services/militaryService.ts
import { http } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { MilitaryRank, MilitaryPosition } from '../types/user';

export const militaryService = {
  // ── CẤP BẬC ──
  getRanks: async (): Promise<{ items: MilitaryRank[] }> => {
    return http<{ items: MilitaryRank[] }>(API_ENDPOINTS.ADMIN.RANKS);
  },

  createRank: async (data: { rank_id: string; name: string; sort_order?: number }) => {
    return http(API_ENDPOINTS.ADMIN.RANKS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  updateRank: async (rankId: string, data: { name: string; sort_order?: number; active?: boolean }) => {
    return http(API_ENDPOINTS.ADMIN.RANK_DETAIL(rankId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  deleteRank: async (rankId: string) => {
    return http(API_ENDPOINTS.ADMIN.RANK_DETAIL(rankId), { method: 'DELETE' });
  },

  // ── CHỨC VỤ ──
  getPositions: async (): Promise<{ items: MilitaryPosition[] }> => {
    return http<{ items: MilitaryPosition[] }>(API_ENDPOINTS.ADMIN.POSITIONS);
  },

  createPosition: async (data: { position_id: string; name: string; sort_order?: number }) => {
    return http(API_ENDPOINTS.ADMIN.POSITIONS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  updatePosition: async (positionId: string, data: { name: string; sort_order?: number; active?: boolean }) => {
    return http(API_ENDPOINTS.ADMIN.POSITION_DETAIL(positionId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  deletePosition: async (positionId: string) => {
    return http(API_ENDPOINTS.ADMIN.POSITION_DETAIL(positionId), { method: 'DELETE' });
  },
};