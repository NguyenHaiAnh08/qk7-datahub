import { http } from './http';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { AccessLog } from '../types/user';

export interface AccessLogCycleInfo {
  scope: 'active' | 'archive' | 'all';
  current_month: string;
  reset_policy: string;
}

export interface AccessLogResponse {
  total: number;
  items: AccessLog[];
  cycle?: AccessLogCycleInfo;
}

export interface ArchiveStats {
  current_month: string;
  active_month_count: number;
  total_active_table_count: number;
  archive_count: number;
  last_archived_at: string | null;
}

/**
 * Log Service — Nhật ký truy vết an ninh (Access Log)
 */
export const logService = {
  getAccessLogs: async (
    params: { user?: string; action?: string; scope?: 'active' | 'archive' | 'all' } = {}
  ): Promise<AccessLogResponse> => {
    const searchParams = new URLSearchParams();
    if (params.user) searchParams.append('user', params.user);
    if (params.action) searchParams.append('action', params.action);
    if (params.scope) searchParams.append('scope', params.scope);
    const qs = searchParams.toString();
    return http<AccessLogResponse>(
      `${API_ENDPOINTS.LOGS.LIST}${qs ? `?${qs}` : ''}`
    );
  },

  getStats: async (): Promise<ArchiveStats> => {
    return http<ArchiveStats>(`${API_ENDPOINTS.LOGS.LIST}/stats`);
  },

  triggerArchiveRun: async (): Promise<{ message: string; archivedCount: number; cutoffDate: string }> => {
    return http<{ message: string; archivedCount: number; cutoffDate: string }>(
      `${API_ENDPOINTS.LOGS.LIST}/archive-run`,
      { method: 'POST' }
    );
  },
};
