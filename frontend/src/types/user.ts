export interface User {
  user_id: string;
  username?: string;
  full_name: string;
  rank_name?: string;
  position?: string;
  unit_id?: string;
  unit_name?: string;
  status?: 'active' | 'locked' | 'inactive' | string;
  clearance_level_id: number;
  clearance_name?: string;
  clearance_code?: string;
}

export interface Unit {
  unit_id: string;
  name: string;
  parent_id?: string;
  parent_name?: string;
}

export interface Role {
  role_id: string;
  name: string;
}

export interface Permission {
  permission_id: string;
  code?: string;
  name?: string;
  description?: string;
}

export interface AccessLog {
  log_id: string;
  user_id?: string;
  full_name?: string;
  file_id?: string;
  doc_title?: string;
  action: string;
  timestamp?: string;
  created_at?: string;
  ip?: string;
  note?: string;
}

export interface AdminStats {
  users: number;
  documents: number;
  totalSize: number;
  logs24h: number;
  byLevel: Array<{ lv: number; lvName: string; n: number }>;
  byType: Array<{ id: string; name: string; n: number }>;
  byUnit: Array<{ id: string; name: string; n: number }>;
}

export type { SecurityLevel } from './document';
