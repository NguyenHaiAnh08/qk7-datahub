import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Modal, Input, Spin, Empty, Alert, Tooltip } from 'antd';
import {
  Shield, Search, CheckCircle2, ChevronDown, ChevronRight,
  X, Save, AlertTriangle,
  FileText, Users, KeyRound, ShieldAlert, BookOpen, Fingerprint,
  Activity, Bot, Settings, Monitor,
} from 'lucide-react';

import { permissionService } from '../../services/permissionService';
import { Role, Permission, SubGroupInfo, SubGroupTone } from '../../types/user';
import {
  SUBGROUP_TONE_STYLE,
  TONE_PRIORITY,
  getSubGroupFromPermission,
} from '../../constants/permissionSubGroups';

// ═══════════════════════════════════════════════════════════
// GROUP CONFIG — đồng bộ với GrantPermissionModal
// ═══════════════════════════════════════════════════════════
const GROUP_CONFIG: Record<string, {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
}> = {
  DOCUMENT:    { label: 'Văn bản',    icon: FileText,    color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/30' },
  USER:        { label: 'Người dùng', icon: Users,       color: 'text-sky-700 dark:text-sky-400',         bg: 'bg-sky-50 dark:bg-sky-500/10',         border: 'border-sky-200 dark:border-sky-500/30' },
  ROLE:        { label: 'Vai trò',    icon: KeyRound,    color: 'text-amber-700 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-500/10',     border: 'border-amber-200 dark:border-amber-500/30' },
  PERMISSION:  { label: 'Quyền',      icon: ShieldAlert, color: 'text-rose-700 dark:text-rose-400',       bg: 'bg-rose-50 dark:bg-rose-500/10',       border: 'border-rose-200 dark:border-rose-500/30' },
  CATALOG:     { label: 'Danh mục',   icon: BookOpen,    color: 'text-purple-700 dark:text-purple-400',   bg: 'bg-purple-50 dark:bg-purple-500/10',   border: 'border-purple-200 dark:border-purple-500/30' },
  FINGERPRINT: { label: 'Sinh trắc',  icon: Fingerprint, color: 'text-cyan-700 dark:text-cyan-400',       bg: 'bg-cyan-50 dark:bg-cyan-500/10',       border: 'border-cyan-200 dark:border-cyan-500/30' },
  AUDIT:       { label: 'Kiểm toán',  icon: Activity,    color: 'text-indigo-700 dark:text-indigo-400',   bg: 'bg-indigo-50 dark:bg-indigo-500/10',   border: 'border-indigo-200 dark:border-indigo-500/30' },
  AI:          { label: 'Trợ lý AI',  icon: Bot,         color: 'text-teal-700 dark:text-teal-400',       bg: 'bg-teal-50 dark:bg-teal-500/10',       border: 'border-teal-200 dark:border-teal-500/30' },
  SYSTEM:      { label: 'Hệ thống',   icon: Settings,    color: 'text-slate-700 dark:text-slate-400',     bg: 'bg-slate-100 dark:bg-slate-700/40',    border: 'border-slate-300 dark:border-slate-600/40' },
  SESSION:     { label: 'Phiên',      icon: Monitor,     color: 'text-lime-700 dark:text-lime-400',       bg: 'bg-lime-50 dark:bg-lime-500/10',       border: 'border-lime-200 dark:border-lime-500/30' },
};

const DANGEROUS_CODES = new Set(['DOC_PURGE', 'PERMISSION_DELETE', 'ROLE_DELETE', 'USER_DELETE', 'SESSION_KILL']);

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════
type RolePermUIState = 'assigned' | 'unassigned' | 'pending_grant' | 'pending_revoke';

interface RolePermissionRow extends Permission {
  ui_state: RolePermUIState;
  subgroup: SubGroupInfo;
}

export interface RolePermissionModalProps {
  open: boolean;
  role: Role | null;
  onClose: () => void;
  onSaved: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export const RolePermissionModal: React.FC<RolePermissionModalProps> = ({
  open, role, onClose, onSaved, onToast,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<RolePermissionRow[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'assigned' | 'unassigned' | 'changed'>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isAdminRole = role?.role_id === 'ROL-01';

  // ─── Load catalog + role permissions ───
  useEffect(() => {
    if (!open || !role) return;
    setLoading(true);
    setSearch('');
    setTab('all');

    Promise.all([
      permissionService.getPermissions(),
      permissionService.getRolePermissions(role.role_id),
    ])
      .then(([catalog, rolePerms]) => {
        const assignedIds = new Set((rolePerms.items || []).map((p) => p.permission_id));
        const merged: RolePermissionRow[] = (catalog.items || []).map((p: Permission) => ({
          ...p,
          ui_state: assignedIds.has(p.permission_id) ? 'assigned' : 'unassigned',
          subgroup: getSubGroupFromPermission(p),
        }));
        merged.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        setRows(merged);
        setExpandedGroups(new Set(merged.map((r) => r.group_code || 'SYSTEM')));
      })
      .catch((err) => onToast('Lỗi tải quyền: ' + err.message, 'error'))
      .finally(() => setLoading(false));
  }, [open, role, onToast]);

  // ─── Stats ───
  const stats = useMemo(() => {
    let assigned = 0, pendingGrants = 0, pendingRevokes = 0;
    for (const r of rows) {
      if (r.ui_state === 'assigned') assigned++;
      if (r.ui_state === 'pending_grant') pendingGrants++;
      if (r.ui_state === 'pending_revoke') pendingRevokes++;
    }
    return {
      total: rows.length,
      assigned,
      unassigned: rows.length - assigned,
      pendingGrants,
      pendingRevokes,
      totalChanges: pendingGrants + pendingRevokes,
    };
  }, [rows]);

  // ─── Filter ───
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === 'assigned' && r.ui_state !== 'assigned' && r.ui_state !== 'pending_revoke') return false;
      if (tab === 'unassigned' && r.ui_state !== 'unassigned' && r.ui_state !== 'pending_grant') return false;
      if (tab === 'changed' && r.ui_state !== 'pending_grant' && r.ui_state !== 'pending_revoke') return false;
      if (q) {
        const hay = `${r.code || ''} ${r.description || ''} ${r.permission_id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, tab, search]);

  // ─── Group 2 tầng ───
  const groupedData = useMemo(() => {
    const byGroup = new Map<string, RolePermissionRow[]>();
    for (const r of filteredRows) {
      const g = r.group_code || 'SYSTEM';
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(r);
    }

    return Object.keys(GROUP_CONFIG)
      .filter((g) => byGroup.has(g))
      .map((group_code) => {
        const rowsInGroup = byGroup.get(group_code)!;
        const bySub = new Map<string, RolePermissionRow[]>();
        for (const r of rowsInGroup) {
          if (!bySub.has(r.subgroup.key)) bySub.set(r.subgroup.key, []);
          bySub.get(r.subgroup.key)!.push(r);
        }
        const subgroups = Array.from(bySub.entries())
          .map(([key, subRows]) => {
            const tones = new Set<SubGroupTone>(subRows.map((r) => r.subgroup.tone));
            const tonesArr = Array.from(tones);
            const maxTone = tonesArr.reduce<SubGroupTone>(
              (acc, t) => (TONE_PRIORITY[t] > TONE_PRIORITY[acc] ? t : acc),
              'read'
            );
            return {
              key,
              info: { ...subRows[0].subgroup, tone: maxTone, mixedTone: tones.size > 1 } as SubGroupInfo,
              rows: subRows.sort((a, b) => (a.code || '').localeCompare(b.code || '')),
            };
          })
          .sort((a, b) => a.info.order - b.info.order);

        return { group_code, subgroups, total: rowsInGroup.length };
      });
  }, [filteredRows]);

  // ─── Handlers ───
  const toggleExpand = (groupCode: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupCode)) next.delete(groupCode);
      else next.add(groupCode);
      return next;
    });
  };

  const togglePermission = (row: RolePermissionRow) => {
    if (isAdminRole) {
      onToast('Role Admin (ROL-01) đã bypass toàn quyền — không cần gán quyền cụ thể.', 'info');
      return;
    }
    setRows((prev) =>
      prev.map((r) => {
        if (r.permission_id !== row.permission_id) return r;
        if (r.ui_state === 'assigned') return { ...r, ui_state: 'pending_revoke' };
        if (r.ui_state === 'pending_revoke') return { ...r, ui_state: 'assigned' };
        if (r.ui_state === 'unassigned') return { ...r, ui_state: 'pending_grant' };
        if (r.ui_state === 'pending_grant') return { ...r, ui_state: 'unassigned' };
        return r;
      })
    );
  };

  const handleSelectAllSubGroup = (subRows: RolePermissionRow[]) => {
    if (isAdminRole) return;
    const unassigned = subRows.filter((r) => r.ui_state === 'unassigned');
    if (unassigned.length === 0) return;
    setRows((prev) =>
      prev.map((r) =>
        unassigned.some((a) => a.permission_id === r.permission_id)
          ? { ...r, ui_state: 'pending_grant' }
          : r
      )
    );
  };

  const handleUnselectAllSubGroup = (subRows: RolePermissionRow[]) => {
    if (isAdminRole) return;
    const assigned = subRows.filter((r) => r.ui_state === 'assigned');
    if (assigned.length === 0) return;
    setRows((prev) =>
      prev.map((r) =>
        assigned.some((a) => a.permission_id === r.permission_id)
          ? { ...r, ui_state: 'pending_revoke' }
          : r
      )
    );
  };

  const handleScrollToGroup = (groupCode: string) => {
    setExpandedGroups((prev) => new Set(prev).add(groupCode));
    setTimeout(() => {
      groupRefs.current[groupCode]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleSave = async () => {
    if (!role || isAdminRole) return;
    const grants = rows.filter((r) => r.ui_state === 'pending_grant');
    const revokes = rows.filter((r) => r.ui_state === 'pending_revoke');

    if (grants.length === 0 && revokes.length === 0) {
      onToast('Không có thay đổi nào', 'info');
      onClose();
      return;
    }

    setSaving(true);
    try {
      for (const g of grants) {
        await permissionService.assignPermissionToRole(role.role_id, g.permission_id);
      }
      for (const r of revokes) {
        await permissionService.revokePermissionFromRole(role.role_id, r.permission_id);
      }
      onToast(`Đã cập nhật role ${role.name}: +${grants.length} thêm, -${revokes.length} gỡ`, 'success');
      onSaved();
      onClose();
    } catch (err: any) {
      onToast('Lỗi lưu: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!open || !role) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={1080}
      centered
      footer={null}
      destroyOnHidden
      title={
        <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Phân Quyền Cho Vai Trò
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {role.name} ({role.role_id})
              {isAdminRole && (
                <span className="ml-2 text-amber-600 dark:text-amber-400 font-semibold">
                  • Quyền Admin (bypass toàn bộ)
                </span>
              )}
            </p>
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="py-16 flex flex-col items-center gap-3">
          <Spin size="large" />
          <span className="text-xs text-slate-500">Đang tải danh mục quyền...</span>
        </div>
      ) : (
        <div className="space-y-3 pt-3">
          {isAdminRole && (
            <Alert
              type="warning"
              showIcon
              icon={<AlertTriangle className="w-4 h-4" />}
              message={<span className="text-xs font-semibold">Vai trò Admin (ROL-01) — bypass toàn quyền</span>}
              description={<span className="text-[11px]">Role này tự động pass mọi kiểm tra quyền qua hàm <code>isAdminBypass</code>. Không cần và không nên gán quyền cụ thể. Nhấn Đóng để thoát.</span>}
            />
          )}

          {/* KPI */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <StatBox icon={<Shield className="w-4 h-4" />} label="Tổng quyền" value={stats.total} color="text-slate-600 dark:text-slate-400" bg="bg-slate-100 dark:bg-slate-700/40 border-slate-200 dark:border-slate-600/40" />
            <StatBox icon={<CheckCircle2 className="w-4 h-4" />} label="Đã gán" value={stats.assigned} color="text-emerald-600 dark:text-emerald-400" bg="bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30" />
            <StatBox icon={<X className="w-4 h-4" />} label="Chưa gán" value={stats.unassigned} color="text-slate-600 dark:text-slate-400" bg="bg-slate-100 dark:bg-slate-700/40 border-slate-200 dark:border-slate-600/40" />
            <StatBox icon={<Save className="w-4 h-4" />} label="Thay đổi chờ lưu" value={stats.totalChanges} color={stats.totalChanges > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'} bg={stats.totalChanges > 0 ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30' : 'bg-slate-100 dark:bg-slate-700/40 border-slate-200 dark:border-slate-600/40'} />
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
              {([
                { k: 'all',        l: `Tất cả (${stats.total})` },
                { k: 'assigned',   l: `Đã gán (${stats.assigned})` },
                { k: 'unassigned', l: `Chưa gán (${stats.unassigned})` },
                { k: 'changed',    l: `Thay đổi (${stats.totalChanges})` },
              ] as const).map(({ k, l }) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    tab === k
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            <Input
              placeholder="Tìm mã quyền / mô tả..."
              prefix={<Search className="w-3.5 h-3.5 text-slate-400" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              className="flex-1 min-w-[220px]"
            />

            <button
              onClick={() => setExpandedGroups(new Set(groupedData.map((g) => g.group_code)))}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
            >
              Mở rộng
            </button>
            <button
              onClick={() => setExpandedGroups(new Set())}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
            >
              Thu gọn
            </button>
          </div>

          {/* Group pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {groupedData.map(({ group_code, total }) => {
              const cfg = GROUP_CONFIG[group_code] || GROUP_CONFIG.SYSTEM;
              const Icon = cfg.icon;
              return (
                <button
                  key={group_code}
                  onClick={() => handleScrollToGroup(group_code)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border transition ${cfg.bg} ${cfg.border} ${cfg.color} hover:shadow-sm`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{cfg.label}</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-white/60 dark:bg-black/20 text-[10px] font-mono">{total}</span>
                </button>
              );
            })}
          </div>

          {/* Content — 2 tầng */}
          <div className="max-h-[48vh] overflow-y-auto pr-1 space-y-2">
            {groupedData.length === 0 ? (
              <div className="py-12 text-center">
                <Empty description="Không có quyền nào khớp bộ lọc" />
              </div>
            ) : (
              groupedData.map(({ group_code, subgroups }) => {
                const cfg = GROUP_CONFIG[group_code] || GROUP_CONFIG.SYSTEM;
                const Icon = cfg.icon;
                const isExpanded = expandedGroups.has(group_code);

                return (
                  <div
                    key={group_code}
                    ref={(el) => { groupRefs.current[group_code] = el; }}
                    className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/40"
                  >
                    <button
                      onClick={() => toggleExpand(group_code)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 ${cfg.bg} hover:brightness-95 transition`}
                    >
                      <div className="flex items-center gap-2.5">
                        {isExpanded ? (
                          <ChevronDown className={`w-4 h-4 ${cfg.color}`} />
                        ) : (
                          <ChevronRight className={`w-4 h-4 ${cfg.color}`} />
                        )}
                        <div className={`w-7 h-7 rounded-lg ${cfg.bg} ${cfg.border} border flex items-center justify-center ${cfg.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <div className={`font-bold text-xs ${cfg.color}`}>
                            {cfg.label}{' '}
                            <span className="font-normal opacity-70">
                              ({subgroups.reduce((s, sg) => s + sg.rows.length, 0)} quyền / {subgroups.length} phân loại)
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-2 space-y-2">
                        {subgroups.map(({ key, info, rows: subRows }) => {
                          const tone = SUBGROUP_TONE_STYLE[info.tone];
                          const assignedCount = subRows.filter(
                            (r) => r.ui_state === 'assigned' || r.ui_state === 'pending_grant'
                          ).length;
                          const unassignedCount = subRows.filter((r) => r.ui_state === 'unassigned').length;

                          return (
                            <div key={key} className={`rounded-lg border ${tone.border} ${tone.bg} overflow-hidden`}>
                              <div className="flex items-center justify-between px-2.5 py-1.5">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${tone.dot}`} />
                                  <span className={`text-[11px] font-bold ${tone.text}`}>{info.label}</span>
                                  {info.mixedTone && (
                                    <Tooltip title="Phân loại này chứa cả quyền 'xem' và 'chỉnh sửa'">
                                      <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-white/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300">
                                        2 mức
                                      </span>
                                    </Tooltip>
                                  )}
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono border ${tone.badge}`}>
                                    {assignedCount}/{subRows.length}
                                  </span>
                                </div>
                                {!isAdminRole && (
                                  <div className="flex gap-1">
                                    {unassignedCount > 0 && (
                                      <button
                                        onClick={() => handleSelectAllSubGroup(subRows)}
                                        className={`text-[10px] font-semibold ${tone.text} hover:underline px-1.5 py-0.5 rounded hover:bg-white/50 dark:hover:bg-black/20`}
                                        title={`Gán tất cả ${unassignedCount} quyền còn lại`}
                                      >
                                        + Chọn {unassignedCount}
                                      </button>
                                    )}
                                    {assignedCount > 0 && (
                                      <button
                                        onClick={() => handleUnselectAllSubGroup(subRows)}
                                        className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:underline px-1.5 py-0.5 rounded hover:bg-white/50 dark:hover:bg-black/20"
                                        title={`Gỡ tất cả ${assignedCount} quyền đã gán`}
                                      >
                                        - Gỡ {assignedCount}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="bg-white dark:bg-slate-900/60 divide-y divide-slate-100 dark:divide-slate-800/40">
                                {subRows.map((row) => (
                                  <RolePermissionItem
                                    key={row.permission_id}
                                    row={row}
                                    disabled={isAdminRole}
                                    onToggle={() => togglePermission(row)}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs flex items-center gap-3">
              {stats.pendingGrants > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  +{stats.pendingGrants} sẽ thêm
                </span>
              )}
              {stats.pendingRevokes > 0 && (
                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                  -{stats.pendingRevokes} sẽ gỡ
                </span>
              )}
              {stats.totalChanges === 0 && (
                <span className="text-slate-400">Không có thay đổi</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {isAdminRole ? 'Đóng' : 'Hủy'}
              </button>
              {!isAdminRole && (
                <button
                  onClick={handleSave}
                  disabled={saving || stats.totalChanges === 0}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Đang lưu...' : `Lưu ${stats.totalChanges} thay đổi`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════
const StatBox: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  bg: string;
}> = ({ icon, label, value, color, bg }) => (
  <div className={`p-2.5 rounded-xl border ${bg}`}>
    <div className={`flex items-center gap-1.5 ${color} text-[11px] font-semibold`}>
      {icon}
      <span>{label}</span>
    </div>
    <div className={`text-xl font-bold mt-1 ${color}`}>{value}</div>
  </div>
);

const RolePermissionItem: React.FC<{
  row: RolePermissionRow;
  disabled: boolean;
  onToggle: () => void;
}> = ({ row, disabled, onToggle }) => {
  const isDangerous = DANGEROUS_CODES.has(row.code || '');
  const isPendingGrant = row.ui_state === 'pending_grant';
  const isPendingRevoke = row.ui_state === 'pending_revoke';
  const isAssigned = row.ui_state === 'assigned';
  const isUnassigned = row.ui_state === 'unassigned';
  const checked = isAssigned || isPendingGrant;

  return (
    <div
      className={`px-3 py-2 flex items-start gap-2.5 transition ${
        isPendingGrant ? 'bg-emerald-50/60 dark:bg-emerald-500/5'
        : isPendingRevoke ? 'bg-rose-50/60 dark:bg-rose-500/5'
        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
      }`}
    >
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition ${
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        } ${
          isPendingRevoke ? 'bg-rose-500 border-rose-500 text-white'
          : checked ? 'bg-amber-600 border-amber-600 text-white'
          : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'
        }`}
        title={disabled ? 'Role Admin bypass — không cần gán' : 'Bấm để thay đổi'}
      >
        {isPendingRevoke ? (
          <X className="w-3 h-3" />
        ) : checked ? (
          <CheckCircle2 className="w-3 h-3" />
        ) : null}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-1.5">
          <span
            className={`font-mono text-[11px] font-bold ${
              isDangerous ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-white'
            }`}
          >
            {row.code}
          </span>

          {isAssigned && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
              <CheckCircle2 className="w-2.5 h-2.5" /> Đã gán
            </span>
          )}
          {isUnassigned && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
              Chưa gán
            </span>
          )}
          {isPendingGrant && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
              + Sẽ thêm
            </span>
          )}
          {isPendingRevoke && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30">
              - Sẽ gỡ
            </span>
          )}

          {Boolean(row.is_system) && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
              🏷️ Hệ thống
            </span>
          )}

          {isDangerous && (
            <Tooltip title="Quyền nguy hiểm — cấp cho role này sẽ áp cho mọi user có role">
              <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30">
                ⚠️ Nguy hiểm
              </span>
            </Tooltip>
          )}
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
          {row.description || '—'}
        </div>
      </div>
    </div>
  );
};

export default RolePermissionModal;