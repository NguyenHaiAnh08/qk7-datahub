import { http } from './http';

export interface CommandOverview {
  generated_at: string;
  scope: { restricted: boolean; root_unit: string | null };
  clearance: number;
  documents: { total: number; new_7d: number; new_30d: number };
  by_level: Array<{ level_id: number; name: string; n: number }>;
  by_unit: Array<{ unit_id: string; name: string; n: number }>;
  by_type: Array<{ type_id: string; name: string; n: number }>;
  approvals: { pending_requests: number; pending_proposals: number };
  lectures: { by_status: Record<string, number> };
  teaching: {
    ongoing_now: number;
    hanging: number;
    completed_today: number;
    minutes_today: number;
    minutes_30d: number;
  };
  rooms: { total: number; maintenance: number; in_session: number };
  security: {
    failed_logins_24h: number;
    screenshot_attempts_24h: number;
    sensitive_views_24h: number;
  };
  /** Tên các khối số liệu truy vấn lỗi ở backend (khối đó hiển thị rỗng) */
  degraded: string[];
}

export const commandService = {
  getOverview: (): Promise<CommandOverview> => http<CommandOverview>('/api/command/overview'),
};
