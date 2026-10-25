import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Modal, Input, Spin, Empty, Alert, Tooltip } from 'antd';
import {
  Shield, Lock, Search, CheckCircle2, AlertTriangle, ChevronDown,
  ChevronRight, Zap, Calendar, X, Minus,
  FileText, Users, KeyRound, ShieldAlert, BookOpen, Fingerprint,
  Activity, Bot, Settings, Monitor,
} from 'lucide-react';

import { permissionService } from '../../services/permissionService';
import {
  User,
  Permission,
  UserPermissionResponse,
  PermissionRow,
  PermissionUIState,
  PermissionSource,
  SubGroupInfo,
  SubGroupTone,
} from '../../types/user';
import {
  SUBGROUP_TONE_STYLE,
  TONE_PRIORITY,
  getSubGroupFromPermission,
} from '../../constants/permissionSubGroups';

// ═══════════════════════════════════════════════════════════
// GROUP CONFIG — icon/màu theo group_code (10 nhóm)
// ═══════════════════════════════════════════════════════════
const GROUP_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ElementType;
    color: string;
    bg: string;
    border: string;
    description: string;
  }
> = {
  DOCUMENT: {
    label: 'Văn bản', icon: FileText,
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-500/30',
    description: 'Tra cứu, đăng tải, tải về tài liệu',
  },
  USER: {
    label: 'Người dùng', icon: Users,
    color: 'text-sky-700 dark:text-sky-400',
    bg: 'bg-sky-50 dark:bg-sky-500/10',
    border: 'border-sky-200 dark:border-sky-500/30',
    description: 'Quản lý tài khoản quân nhân',
  },
  ROLE: {
    label: 'Vai trò', icon: KeyRound,
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/30',
    description: 'CRUD vai trò hệ thống',
  },
  PERMISSION: {
    label: 'Quyền', icon: ShieldAlert,
    color: 'text-rose-700 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-500/10',
    border: 'border-rose-200 dark:border-rose-500/30',
    description: 'Quản lý danh mục quyền',
  },
  CATALOG: {
    label: 'Danh mục', icon: BookOpen,
    color: 'text-purple-700 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-500/10',
    border: 'border-purple-200 dark:border-purple-500/30',
    description: 'Đơn vị, loại VB, cấp bậc, chức vụ',
  },
  FINGERPRINT: {
    label: 'Sinh trắc', icon: Fingerprint,
    color: 'text-cyan-700 dark:text-cyan-400',
    bg: 'bg-cyan-50 dark:bg-cyan-500/10',
    border: 'border-cyan-200 dark:border-cyan-500/30',
    description: 'Vân tay ZKTeco ZK9500',
  },
  AUDIT: {
    label: 'Kiểm toán', icon: Activity,
    color: 'text-indigo-700 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-500/10',
    border: 'border-indigo-200 dark:border-indigo-500/30',
    description: 'Nhật ký SOC và xuất Excel',
  },
  AI: {
    label: 'Trợ lý AI', icon: Bot,
    color: 'text-teal-700 dark:text-teal-400',
    bg: 'bg-teal-50 dark:bg-teal-500/10',
    border: 'border-teal-200 dark:border-teal-500/30',
    description: 'Hỏi đáp RAG, study-book',
  },
  SYSTEM: {
    label: 'Hệ thống', icon: Settings,
    color: 'text-slate-700 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-700/40',
    border: 'border-slate-300 dark:border-slate-600/40',
    description: 'Dashboard, health check',
  },
  SESSION: {
    label: 'Phiên', icon: Monitor,
    color: 'text-lime-700 dark:text-lime-400',
    bg: 'bg-lime-50 dark:bg-lime-500/10',
    border: 'border-lime-200 dark:border-lime-500/30',
    description: 'Quản lý phiên đăng nhập',
  },
};

const DANGEROUS_CODES = new Set(['DOC_PURGE', 'PERMISSION_DELETE', 'ROLE_DELETE', 'USER_DELETE']);

// ═══════════════════════════════════════════════════════════
// PROPS
// ═══════════════════════════════════════════════════════════
export interface GrantPermissionModalProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════
export const GrantPermissionModal: React.FC<GrantPermissionModalProps> = ({
  open, user, onClose, onSaved, onToast,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<PermissionRow[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'role' | 'direct' | 'available'>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showGrantDialog, setShowGrantDialog] = useState<PermissionRow | null>(null);
  const [grantExpiresAt, setGrantExpiresAt] = useState('');
  const [grantNote, setGrantNote] = useState('');

  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ─── Load & merge ───
  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    setSearch('');
    setTab('all');

    Promise.all([
      permissionService.getPermissions(),
      permissionService.getUserPermissions(user.user_id),
    ])
      .then(([catalog, userPerms]) => {
        const allPerms = (catalog.items || []) as Permission[];
        const response = userPerms as UserPermissionResponse;

        const roleMap = new Map<
          string,
          Array<{ role_id: string; role_name: string; expires_at?: string | null }>
        >();
        for (const rp of response.from_roles || []) {
          if (!roleMap.has(rp.permission_id)) roleMap.set(rp.permission_id, []);
          roleMap.get(rp.permission_id)!.push({
            role_id: rp.role_id,
            role_name: rp.role_name,
            expires_at: rp.expires_at ?? null,
          });
        }

        const directMap = new Map<string, UserPermissionResponse['direct_grants'][number]>();
        for (const dg of response.direct_grants || []) directMap.set(dg.permission_id, dg);

        const merged: PermissionRow[] = allPerms
          .map((p): PermissionRow => {
            const roleSources = roleMap.get(p.permission_id) || [];
            const directGrant = directMap.get(p.permission_id);
            const hasRole = roleSources.length > 0;
            const hasDirect = Boolean(directGrant);

            const source: PermissionSource =
              hasRole && hasDirect ? 'both'
              : hasRole ? 'role'
              : hasDirect ? 'direct'
              : 'none';

            const ui_state: PermissionUIState =
              hasRole && hasDirect ? 'direct_active'
              : hasRole ? 'inherited'
              : hasDirect ? 'direct_active'
              : 'available';

            return {
              ...p,
              source,
              role_sources: roleSources,
              direct_grant: directGrant,
              ui_state,
              subgroup: getSubGroupFromPermission(p),
            };
          })
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

        setRows(merged);
        setExpandedGroups(new Set(merged.map((r) => r.group_code || 'SYSTEM')));
      })
      .catch((err) => onToast('Lỗi tải quyền: ' + err.message, 'error'))
      .finally(() => setLoading(false));
  }, [open, user, onToast]);

  // ─── Stats ───
  const stats = useMemo(() => {
    let fromRole = 0, direct = 0, effective = 0, available = 0, pendingGrants = 0, pendingRevokes = 0;
    for (const r of rows) {
      if (r.source === 'role' || r.source === 'both') fromRole++;
      if (r.source === 'direct' || r.source === 'both') direct++;
      if (r.ui_state !== 'available' && r.ui_state !== 'pending_revoke') effective++;
      if (r.ui_state === 'available') available++;
      if (r.ui_state === 'pending_grant') pendingGrants++;
      if (r.ui_state === 'pending_revoke') pendingRevokes++;
    }
    return { fromRole, direct, effective, available, pendingGrants, pendingRevokes };
  }, [rows]);

  // ─── Filter ───
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === 'role' && r.source !== 'role' && r.source !== 'both') return false;
      if (tab === 'direct' && r.source !== 'direct' && r.source !== 'both' && r.ui_state !== 'pending_grant') return false;
      if (tab === 'available' && r.source !== 'none' && r.ui_state !== 'pending_grant') return false;
      if (q) {
        const hay = `${r.code || ''} ${r.description || ''} ${r.permission_id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, tab, search]);

  // ─── Group 2 tầng: group_code → subgroup_key → rows ───
  const groupedData = useMemo(() => {
    const byGroup = new Map<string, PermissionRow[]>();
    for (const r of filteredRows) {
      const g = r.group_code || 'SYSTEM';
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(r);
    }

    return Object.keys(GROUP_CONFIG)
      .filter((g) => byGroup.has(g))
      .map((group_code) => {
        const rowsInGroup = byGroup.get(group_code)!;

        const bySub = new Map<string, PermissionRow[]>();
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
              info: {
                ...subRows[0].subgroup,
                tone: maxTone,
                mixedTone: tones.size > 1,
              } as SubGroupInfo,
              rows: subRows.sort((a, b) =>
                (a.code || '').localeCompare(b.code || '')
              ),
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

  const handleTogglePermission = (row: PermissionRow) => {
    if (row.ui_state === 'inherited') {
      onToast('Quyền này kế thừa từ vai trò. Muốn gỡ phải chỉnh vai trò.', 'info');
      return;
    }
    if (row.ui_state === 'direct_active') {
      setRows((prev) =>
        prev.map((r) =>
          r.permission_id === row.permission_id ? { ...r, ui_state: 'pending_revoke' } : r
        )
      );
      return;
    }
    if (row.ui_state === 'pending_revoke') {
      setRows((prev) =>
        prev.map((r) =>
          r.permission_id === row.permission_id ? { ...r, ui_state: 'direct_active' } : r
        )
      );
      return;
    }
    if (row.ui_state === 'available') {
      setShowGrantDialog(row);
      setGrantExpiresAt('');
      setGrantNote('');
      return;
    }
    if (row.ui_state === 'pending_grant') {
      setRows((prev) =>
        prev.map((r) =>
          r.permission_id === row.permission_id
            ? { ...r, ui_state: 'available', pending_expires_at: null, pending_note: '' }
            : r
        )
      );
    }
  };

  const confirmGrantDialog = () => {
    if (!showGrantDialog) return;
    setRows((prev) =>
      prev.map((r) =>
        r.permission_id === showGrantDialog.permission_id
          ? {
              ...r,
              ui_state: 'pending_grant',
              pending_expires_at: grantExpiresAt || null,
              pending_note: grantNote,
            }
          : r
      )
    );
    setShowGrantDialog(null);
  };

  const handleSelectAllSubGroup = (subRows: PermissionRow[]) => {
    const available = subRows.filter((r) => r.ui_state === 'available');
    if (available.length === 0) return;
    setRows((prev) =>
      prev.map((r) =>
        available.some((a) => a.permission_id === r.permission_id)
          ? { ...r, ui_state: 'pending_grant', pending_expires_at: null, pending_note: '' }
          : r
      )
    );
    onToast(`Đã chọn ${available.length} quyền chờ lưu.`, 'success');
  };

  const handleScrollToGroup = (groupCode: string) => {
    setExpandedGroups((prev) => new Set(prev).add(groupCode));
    setTimeout(() => {
      groupRefs.current[groupCode]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleSave = async () => {
    if (!user) return;
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
        await permissionService.grantUserPermission(user.user_id, g.permission_id, {
          expires_at: g.pending_expires_at || null,
          note: g.pending_note || undefined,
        });
      }
      for (const r of revokes) {
        await permissionService.revokeUserPermission(user.user_id, r.permission_id);
      }
      onToast(`Đã lưu: +${grants.length} grant, -${revokes.length} revoke`, 'success');
      onSaved();
      onClose();
    } catch (err: any) {
      onToast('Lỗi lưu: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!open || !user) return null;

  const isAdminUser = (user.roles || []).includes('ROL-01');

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        width={1080}
        centered
        footer={null}
        destroyOnHidden
        title={
          <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/15 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Gán Quyền Trực Tiếp</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {user.full_name} ({user.user_id})
                {user.rank_name && <> • {user.rank_name}</>}
                {user.position && <> • {user.position}</>}
                {user.clearance_name && (
                  <> • <span className="text-amber-600 dark:text-amber-400 font-semibold">{user.clearance_name}</span></>
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
            {isAdminUser && (
              <Alert
                type="warning"
                showIcon
                icon={<AlertTriangle className="w-4 h-4" />}
                message={<span className="text-xs font-semibold">Tài khoản có vai trò Admin (ROL-01) — đã bypass toàn quyền</span>}
                description={<span className="text-[11px]">Các grant bên dưới chỉ dự phòng khi bị gỡ vai trò Admin. Hệ thống vẫn bỏ qua danh sách quyền khi là Admin.</span>}
              />
            )}

            {/* 4 KPI */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <StatBox icon={<Lock className="w-4 h-4" />} label="Từ vai trò" value={stats.fromRole} color="text-amber-600 dark:text-amber-400" bg="bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30" />
              <StatBox icon={<Zap className="w-4 h-4" />} label="Trực tiếp" value={stats.direct} color="text-purple-600 dark:text-purple-400" bg="bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30" />
              <StatBox icon={<CheckCircle2 className="w-4 h-4" />} label="Đang hiệu lực" value={stats.effective} color="text-emerald-600 dark:text-emerald-400" bg="bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30" />
              <StatBox icon={<Minus className="w-4 h-4" />} label="Có thể thêm" value={stats.available} color="text-slate-600 dark:text-slate-400" bg="bg-slate-100 dark:bg-slate-700/40 border-slate-200 dark:border-slate-600/40" />
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
                {([
                  { k: 'all',       l: `Tất cả (${rows.length})` },
                  { k: 'role',      l: `Từ role (${stats.fromRole})` },
                  { k: 'direct',    l: `Trực tiếp (${stats.direct})` },
                  { k: 'available', l: `Chưa cấp (${stats.available})` },
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
                size="middle"
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

            {/* Group pills nav */}
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

            {/* 2 tầng: Group → Sub-group */}
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
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{cfg.description}</div>
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-2 space-y-2">
                          {subgroups.map(({ key, info, rows: subRows }) => {
                            const tone = SUBGROUP_TONE_STYLE[info.tone];
                            const subAvailable = subRows.filter((r) => r.ui_state === 'available').length;
                            const subActive = subRows.filter(
                              (r) => r.ui_state !== 'available' && r.ui_state !== 'pending_revoke'
                            ).length;

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
                                      {subActive}/{subRows.length}
                                    </span>
                                  </div>
                                  {subAvailable > 0 && (
                                    <button
                                      onClick={() => handleSelectAllSubGroup(subRows)}
                                      className={`text-[10px] font-semibold ${tone.text} hover:underline px-1.5 py-0.5 rounded hover:bg-white/50 dark:hover:bg-black/20`}
                                    >
                                      + Chọn {subAvailable}
                                    </button>
                                  )}
                                </div>
                                <div className="bg-white dark:bg-slate-900/60 divide-y divide-slate-100 dark:divide-slate-800/40">
                                  {subRows.map((row) => (
                                    <PermissionItem
                                      key={row.permission_id}
                                      row={row}
                                      onToggle={() => handleTogglePermission(row)}
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
                    +{stats.pendingGrants} thêm
                  </span>
                )}
                {stats.pendingRevokes > 0 && (
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">
                    -{stats.pendingRevokes} gỡ
                  </span>
                )}
                {stats.pendingGrants === 0 && stats.pendingRevokes === 0 && (
                  <span className="text-slate-400">Không có thay đổi</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || (stats.pendingGrants === 0 && stats.pendingRevokes === 0)}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {saving ? 'Đang lưu...' : `Lưu ${stats.pendingGrants + stats.pendingRevokes} thay đổi`}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Dialog con: chọn thời hạn + note khi grant */}
      <Modal
        open={Boolean(showGrantDialog)}
        onCancel={() => setShowGrantDialog(null)}
        width={460}
        centered
        zIndex={1050}
        title={
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
            <Calendar className="w-4 h-4 text-purple-600" />
            <span className="font-bold text-sm">Cấp quyền: {showGrantDialog?.code}</span>
          </div>
        }
        footer={[
          <button
            key="cancel"
            onClick={() => setShowGrantDialog(null)}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold"
          >
            Hủy
          </button>,
          <button
            key="ok"
            onClick={confirmGrantDialog}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
          >
            Xác nhận
          </button>,
        ]}
      >
        <div className="py-3 space-y-3 text-xs">
          <p className="text-slate-600 dark:text-slate-400">{showGrantDialog?.description}</p>
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
              Ngày hết hạn (để trống = vĩnh viễn)
            </label>
            <input
              type="date"
              value={grantExpiresAt}
              min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
              onChange={(e) => setGrantExpiresAt(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
              Ghi chú (tùy chọn)
            </label>
            <input
              type="text"
              value={grantNote}
              onChange={(e) => setGrantNote(e.target.value)}
              placeholder="VD: Cấp tạm cho nhiệm vụ đặc biệt..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-sm"
            />
          </div>
        </div>
      </Modal>
    </>
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

const PermissionItem: React.FC<{
  row: PermissionRow;
  onToggle: () => void;
}> = ({ row, onToggle }) => {
  const isDangerous = DANGEROUS_CODES.has(row.code || '');
  const isPendingGrant = row.ui_state === 'pending_grant';
  const isPendingRevoke = row.ui_state === 'pending_revoke';
  const isInherited = row.ui_state === 'inherited';
  const isDirectActive = row.ui_state === 'direct_active';
  const isBoth = row.source === 'both';

  const checked = isInherited || isDirectActive || isPendingGrant || isBoth;
  const disabled = isInherited;

  return (
    <div
      className={`px-3 py-2 flex items-start gap-2.5 transition ${
        isPendingGrant ? 'bg-emerald-50/60 dark:bg-emerald-500/5'
        : isPendingRevoke ? 'bg-rose-50/60 dark:bg-rose-500/5'
        : isInherited ? 'bg-slate-50/60 dark:bg-slate-800/20'
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
          : checked ? 'bg-purple-600 border-purple-600 text-white'
          : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'
        }`}
        title={disabled ? 'Quyền này kế thừa từ vai trò' : 'Bấm để thay đổi'}
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

          {isInherited && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
              <Lock className="w-2.5 h-2.5" /> Từ role
            </span>
          )}
          {isDirectActive && row.source === 'direct' && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-100 dark:bg-purple-500/15 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30">
              <Zap className="w-2.5 h-2.5" /> Trực tiếp
            </span>
          )}
          {isBoth && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-gradient-to-r from-amber-100 to-purple-100 dark:from-amber-500/20 dark:to-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30">
              <Lock className="w-2.5 h-2.5" />+<Zap className="w-2.5 h-2.5" /> Cả 2
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
            <Tooltip title="Quyền này có thể gây mất dữ liệu — chỉ cấp khi thực sự cần">
              <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30">
                ⚠️ Nguy hiểm
              </span>
            </Tooltip>
          )}

          {isDirectActive && row.direct_grant?.expires_at && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-500/30">
              ⏰ {new Date(row.direct_grant.expires_at).toLocaleDateString('vi-VN')}
            </span>
          )}
          {isPendingGrant && row.pending_expires_at && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
              ⏰ {new Date(row.pending_expires_at).toLocaleDateString('vi-VN')}
            </span>
          )}
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
          {row.description || '—'}
        </div>

        {isInherited && row.role_sources && row.role_sources.length > 0 && (
          <div className="text-[10px] text-amber-700 dark:text-amber-400/80 mt-0.5">
            Qua vai trò: {row.role_sources.map((r) => r.role_name).join(', ')}
          </div>
        )}

        {isDirectActive && row.direct_grant && (
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            Cấp bởi {row.direct_grant.granted_by || 'hệ thống'} •{' '}
            {new Date(row.direct_grant.granted_at).toLocaleDateString('vi-VN')}
            {row.direct_grant.note && <> • &quot;{row.direct_grant.note}&quot;</>}
          </div>
        )}

        {isPendingRevoke && isBoth && (
          <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
            ⚠️ Sau khi gỡ direct, quyền vẫn còn qua vai trò
          </div>
        )}
      </div>
    </div>
  );
};

export default GrantPermissionModal;