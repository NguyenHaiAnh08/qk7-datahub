/**
 * API của bảng đo hiệu năng (chỉ Quản trị viên ROL-01, chỉ đọc).
 */
import { http } from './http';

export interface ServerStep {
  n: number;
  type: string;
  name: string;
  start_ms: number | null;
  ms: number;
  cpu_ms: number | null;
  rss_mb: number | null;
  heap_mb: number | null;
  after_response?: boolean;
  values: Record<string, string | number>;
}

export interface ServerTrace {
  id: string;
  seq: number;
  at: number;
  method: string;
  path: string;
  route: string | null;
  status: number | null;
  user: string | null;
  finished: boolean;
  aborted?: boolean;
  concurrent: number;
  ms: number;
  ttfb_ms: number | null;
  cpu_ms?: number;
  rss_mb?: number;
  heap_mb?: number;
  db_ms: number;
  db_n: number;
  ext_ms: number;
  in_kb?: number;
  out_kb?: number;
  step_count: number;
  dropped_steps: number;
  steps?: ServerStep[];
}

export interface BackgroundStep extends Omit<ServerStep, 'n'> {
  seq: number;
  at: number;
}

export interface StepSummary {
  type: string;
  name: string;
  count: number;
  total_ms: number;
  avg_ms: number;
  p95_ms: number;
  max_ms: number;
  cpu_ms: number;
  avg_cpu_ms: number;
}

export interface SystemSample {
  at: number;
  cpu_system_pct: number | null;
  cpu_node_pct: number | null;
  mem_used_mb: number;
  rss_mb: number;
  heap_used_mb: number;
  heap_total_mb: number;
  external_mb: number;
  loop_mean_ms: number | null;
  loop_max_ms: number | null;
  active_requests: number;
  sql_pool_size: number | null;
  sql_pool_busy: number | null;
  sql_pool_waiting: number | null;
}

type Failed = { error: string };

export interface SystemReport {
  at: number;
  sample_ms: number;
  host: { name: string; platform: string; cpu_model: string; cpu_count: number; mem_total_mb: number; uptime_s: number };
  node: { pid: number; version: string; uptime_s: number };
  current: SystemSample;
  history: SystemSample[];
  processes: Failed | {
    pid: number; name: string; memory_mb: number; private_mb: number | null;
    cpu_seconds: number | null; cpu_pct: number | null; is_gateway: boolean;
  }[];
  disk: Failed | { total_gb: number; free_gb: number; used_gb: number; used_pct: number };
  folders: Failed | { name: string; files: number; mb: number }[];
  database: Failed | { files: { type: string; mb: number }[]; connections: number | null };
  services: Failed | { name: string; address: string; up: boolean; ms: number | null }[];
  gpu: Failed | { name: string; util_pct: number; memory_used_mb: number; memory_total_mb: number }[];
}

const get = <T,>(path: string) =>
  http<T>(`/api/admin/perf${path}`, { silent: true, skipErrorNotification: true });

export const perfService = {
  traces: (limit = 300, full = false) =>
    get<{ enabled: boolean; traces: ServerTrace[] }>(`/traces?limit=${limit}${full ? '&full=1' : ''}`),
  trace: (id: string) => get<ServerTrace>(`/traces/${encodeURIComponent(id)}`),
  steps: () => get<{ enabled: boolean; steps: StepSummary[] }>('/steps'),
  background: () => get<{ items: BackgroundStep[] }>('/background?limit=500'),
  system: () => get<SystemReport>('/system'),
};
