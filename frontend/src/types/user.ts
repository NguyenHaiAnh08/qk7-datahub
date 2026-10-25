export interface User {
  user_id: string;
  username?: string;
  password?: string;
  full_name: string;
  rank_name?: string;
  position?: string;
  unit_id?: string;
  unit_name?: string;
  status?: 'active' | 'locked' | 'inactive' | string;
  clearance_level_id: number;
  clearance_name?: string;
  clearance_code?: string;
  roles?: string[];
  role_names?: string[];
  has_fingerprint?: boolean;
  permissions?: string[];       
  created_at?: string;
  updated_at?: string;
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
  group_code: string;  
  is_system?: boolean | number;
  sort_order?: number; 
  // ─── Subgroup (DB-driven) ───
  subgroup_key?: string | null;
  subgroup_label?: string | null;
  subgroup_order?: number;
  subgroup_tone?: 'read' | 'write' | 'security' | 'danger';
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

export interface MilitaryRank {
  rank_id: string;
  name: string;
  sort_order?: number;
  active?: boolean;
}

export interface MilitaryPosition {
  position_id: string;
  name: string;
  sort_order?: number;
  active?: boolean;
}

export interface UserPermissionGrant {
  permission_id: string;
  code: string;
  description?: string;
  group_code: string;
  granted_by?: string | null;
  granted_at: string;
  expires_at?: string | null;
  note?: string | null;
}

export interface UserPermissionFromRole {
  permission_id: string;
  code: string;
  description?: string;
  group_code: string;
  role_id: string;
  role_name: string;
  expires_at?: string | null;
  // 4 trường subgroup backend trả về
  subgroup_key?: string | null;
  subgroup_label?: string | null;
  subgroup_order?: number;
  subgroup_tone?: 'read' | 'write' | 'security' | 'danger';
}

export interface UserPermissionResponse {
  user_id: string;
  effective_codes: string[];
  from_roles: UserPermissionFromRole[];
  direct_grants: UserPermissionGrant[];
}

export interface UserRoleDetail {
  role_id: string;
  name: string;
  is_primary: boolean;
  expires_at: string | null;
  granted_at: string;
  granted_by?: string | null;
  note?: string | null;
  expired?: number;
}

export interface ActiveSession {
  session_id: string;
  user_id: string;
  full_name: string;
  rank?: string;
  position?: string;
  ip?: string;
  user_agent?: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  minutes_idle: number;
}

export type { SecurityLevel } from './document';

// ═══════════════════════════════════════════════════════════
// PERMISSION SUBGROUP + UI STATE
// ═══════════════════════════════════════════════════════════

export type SubGroupTone = 'read' | 'write' | 'security' | 'danger';

export interface SubGroupInfo {
  key: string;
  label: string;
  order: number;
  tone: SubGroupTone;
  /** true khi 1 sub-group chứa quyền có tone khác nhau (VD: _VIEW=read + _MANAGE=write) */
  mixedTone?: boolean;
}

export type PermissionSource = 'role' | 'direct' | 'both' | 'none';

export type PermissionUIState =
  | 'inherited'      // chỉ từ role — không tick trực tiếp được
  | 'direct_active'  // direct grant đang active
  | 'pending_grant'  // mới chọn — chờ lưu
  | 'pending_revoke' // đã active — chờ gỡ
  | 'available';     // chưa cấp

export interface PermissionRow extends Permission {
  source: PermissionSource;
  role_sources?: Array<{
    role_id: string;
    role_name: string;
    expires_at?: string | null;
  }>;
  direct_grant?: UserPermissionGrant;
  ui_state: PermissionUIState;
  pending_expires_at?: string | null;
  pending_note?: string;
  subgroup: SubGroupInfo;
}
