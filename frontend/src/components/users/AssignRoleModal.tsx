import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Table,
  Tag,
  Select,
  Input,
  Button,
  Radio,
  Dropdown,
  type TableColumnsType,
  Segmented,
  DatePicker,
  Alert,
  Tooltip,
} from 'antd';
import {
  Search,
  UserCheck,
  UserMinus,
  UserPlus,
  Shield,
  RotateCw,
  Clock,
  Calendar,
  Infinity as InfinityIcon,
} from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';

import { User, Role } from '../../types';
import { roleService } from '../../services/roleService';
import { usersApi } from '../../services/usersApi';
import { isProtectedAdminRole, isProtectedUser } from '../../constants/protectedAccounts';

export interface AssignRoleModalProps {
  open: boolean;
  roles: Role[];
  users: User[];
  targetRole?: Role | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ─── Định nghĩa kiểu dữ liệu cho Modal chọn thời hạn ───
type DurationMode = 'permanent' | 'duration' | 'custom_date';
interface AssignTarget {
  userId: string;
  roleId: string;
  currentExpiry?: string | null;
  isSwitch?: boolean;
  oldRoleId?: string;
}

export const AssignRoleModal: React.FC<AssignRoleModalProps> = ({
  open,
  roles,
  users: initialUsers,
  targetRole,
  onClose,
  onRefresh,
  onToast,
}) => {
  // State quản lý danh sách & bộ lọc
  const [usersList, setUsersList] = useState<User[]>([]);
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unassigned' | 'assigned'>('all');
  const [filterRoleId, setFilterRoleId] = useState<string>('all');

  // State loading
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // State cho Sub-modal chọn thời hạn
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);
  const [durationMode, setDurationMode] = useState<DurationMode>('permanent');
  const [durationDays, setDurationDays] = useState<number>(3);
  const [customDate, setCustomDate] = useState<Dayjs | null>(null);

  // Reset trang khi đổi bộ lọc
  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, filterStatus, filterRoleId, open]);

  // Sync users when modal opens
  useEffect(() => {
    if (open) {
      setUsersList([...initialUsers]);
      setSearchText('');
      setFilterStatus('all');
      setFilterRoleId(targetRole ? targetRole.role_id : 'all');
      setAssignTarget(null); // Reset sub-modal
    }
  }, [open, initialUsers, targetRole]);

  // Hàm làm mới
  const handleRefreshModal = async () => {
    setIsRefreshing(true);
    try {
      const res = await usersApi.getUsers();
      if (res && res.items) setUsersList(res.items);
      await onRefresh();
      onToast('Đã làm mới danh sách quân nhân thành công!', 'success');
    } catch (err: any) {
      onToast(`Lỗi làm mới: ${err.message || 'Không thể tải lại'}`, 'error');
    } finally {
      setTimeout(() => setIsRefreshing(false), 350);
    }
  };

  // Thống kê
  const stats = useMemo(() => {
    const total = usersList.length;
    const assigned = usersList.filter((u) => u.roles && u.roles.length > 0).length;
    return { total, assigned, unassigned: total - assigned };
  }, [usersList]);

  // Lọc danh sách
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      if (searchText.trim()) {
        const q = searchText.toLowerCase().trim();
        const matchId = (u.user_id || '').toLowerCase().includes(q);
        const matchName = (u.full_name || '').toLowerCase().includes(q);
        const matchRank = (u.rank_name || '').toLowerCase().includes(q);
        const matchPos = (u.position || '').toLowerCase().includes(q);
        const matchUnit = (u.unit_name || '').toLowerCase().includes(q);
        const matchRole = (u.role_names || []).some((r) => r.toLowerCase().includes(q));
        if (!matchId && !matchName && !matchRank && !matchPos && !matchUnit && !matchRole) return false;
      }

      const hasRole = Boolean(u.roles && u.roles.length > 0);
      if (filterStatus === 'unassigned' && hasRole) return false;
      if (filterStatus === 'assigned' && !hasRole) return false;

      if (filterRoleId !== 'all') {
        if (!(u.roles || []).includes(filterRoleId)) return false;
      }
      return true;
    });
  }, [usersList, searchText, filterStatus, filterRoleId]);

  // ═══════════════════════════════════════════════════
  // XỬ LÝ GÁN VAI TRÒ (Có thời hạn)
  // ═══════════════════════════════════════════════════
  const handleConfirmAssign = async () => {
    if (!assignTarget) return;

    let expiresAt: string | undefined;
    let durationParam: number | undefined;

    if (durationMode === 'duration') {
      durationParam = durationDays;
    } else if (durationMode === 'custom_date') {
      if (!customDate) return onToast('Vui lòng chọn ngày hết hạn!', 'error');
      // Set về cuối ngày 23:59:59
      expiresAt = customDate.hour(23).minute(59).second(59).toISOString();
    }

    const { userId, roleId, isSwitch, oldRoleId } = assignTarget;
    const roleObj = roles.find((r) => r.role_id === roleId);
    const roleName = roleObj?.name || roleId;
    const targetUser = usersList.find((u) => u.user_id === userId);

    setLoadingUserId(userId);
    try {
      // Nếu là đổi vai trò, gỡ cũ trước
      if (isSwitch && oldRoleId) {
        await roleService.revokeRoleFromUser(userId, oldRoleId);
      }

      // Gán mới (hoặc cập nhật hạn)
      await roleService.assignRoleToUser(userId, roleId, {
        durationDays: durationParam,
        expiresAt: expiresAt,
      });

      // Optimistic UI (cập nhật tạm thời, chờ onRefresh đồng bộ)
      setUsersList((prev) =>
        prev.map((u) => {
          if (u.user_id === userId) {
            let newRoles = [...(u.roles || [])];
            let newRoleNames = [...(u.role_names || [])];

            if (isSwitch && oldRoleId) {
              newRoles = newRoles.filter((r) => r !== oldRoleId);
            }
            if (!newRoles.includes(roleId)) {
              newRoles.push(roleId);
              newRoleNames.push(roleName);
            }
            return { ...u, roles: newRoles, role_names: newRoleNames };
          }
          return u;
        })
      );

      onToast(
        `Đã gán vai trò "${roleName}" cho ${targetUser?.full_name || userId} thành công!`,
        'success'
      );
      
      setAssignTarget(null); // Đóng sub-modal
      onRefresh();
    } catch (err: any) {
      onToast(`Lỗi gán vai trò: ${err.message || 'Không thể thực hiện'}`, 'error');
    } finally {
      setLoadingUserId(null);
    }
  };

  // ═══════════════════════════════════════════════════
  // XỬ LÝ GỠ VAI TRÒ
  // ═══════════════════════════════════════════════════
  const handleRevokeRole = async (userId: string, roleIdToRevoke: string, roleName?: string) => {
    const targetUser = usersList.find((u) => u.user_id === userId);
    const rName = roleName || roles.find((r) => r.role_id === roleIdToRevoke)?.name || roleIdToRevoke;

    setLoadingUserId(userId);
    try {
      await roleService.revokeRoleFromUser(userId, roleIdToRevoke);
      setUsersList((prev) =>
        prev.map((u) => {
          if (u.user_id === userId) {
            return {
              ...u,
              roles: (u.roles || []).filter((r) => r !== roleIdToRevoke),
              role_names: (u.role_names || []).filter((rn) => rn !== rName),
            };
          }
          return u;
        })
      );
      onToast(`Đã gỡ vai trò "${rName}" của ${targetUser?.full_name || userId}!`, 'info');
      onRefresh();
    } catch (err: any) {
      onToast(`Lỗi gỡ vai trò: ${err.message || 'Không thể thực hiện'}`, 'error');
    } finally {
      setLoadingUserId(null);
    }
  };

  // ═══════════════════════════════════════════════════
  // CẤU HÌNH CỘT BẢNG
  // ═══════════════════════════════════════════════════
  const columns: TableColumnsType<User> = [
    {
      title: 'Mã QN',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 100,
      render: (id: string) => (
        <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded text-amber-800 bg-amber-500/10 border border-amber-600/25 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/25 whitespace-nowrap">
          {id}
        </span>
      ),
    },
    {
      title: 'Họ và tên',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 200,
      render: (name: string, record: User) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-white text-xs">{name}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {[record.rank_name, record.position].filter(Boolean).join(' - ') || '—'}
          </div>
        </div>
      ),
    },
    {
      title: 'Đơn vị',
      dataIndex: 'unit_name',
      key: 'unit_name',
      width: 180,
      render: (unit: string) => (
        <span className="text-slate-600 dark:text-slate-300 text-xs truncate inline-block max-w-[170px]" title={unit || '—'}>
          {unit || '—'}
        </span>
      ),
    },
    {
      title: 'Vai trò hiện tại',
      key: 'roles',
      width: 300,
      render: (_: any, record: User) => {
        const hasRoles = record.roles && record.roles.length > 0;
        if (!hasRoles) {
          return (
            <Tag className="text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700 font-medium text-xs px-2.5 py-0.5 rounded-md" style={{ borderStyle: 'dashed' }}>
              Chưa có vai trò
            </Tag>
          );
        }

        // Giả sử backend trả về mảng `role_details` chứa {role_id, name, expires_at}
        // Nếu chưa có, fallback về hiển thị cơ bản
        const roleDetails = (record as any).role_details || [];
        const isBusy = loadingUserId === record.user_id;

        return (
          <div className="flex flex-wrap gap-1.5 items-center">
            {record.roles!.map((rId, idx) => {
              const rName = record.role_names?.[idx] || roles.find((r) => r.role_id === rId)?.name || rId;
              const detail = roleDetails.find((d: any) => d.role_id === rId);
              const expiresAt = detail?.expires_at;
              const isProtected = isProtectedAdminRole(record.user_id, rId);

              return (
                <Tooltip
                  key={rId}
                  title={
                    isProtected
                      ? '🔒 Vai trò Admin của tài khoản quản trị tối cao — Được bảo vệ hệ thống, không thể gỡ'
                      : expiresAt
                      ? `Quyền tạm thời. Hết hạn: ${dayjs(expiresAt).format('DD/MM/YYYY HH:mm')} — Bấm X để gỡ`
                      : 'Quyền vĩnh viễn — Bấm X để gỡ'
                  }
                >
                  <Tag
                    color={isProtected ? 'red' : expiresAt ? 'orange' : 'gold'}
                    closable={!isBusy && !isProtected}
                    onClose={() => {
                      if (window.confirm(`Gỡ vai trò "${rName}" của ${record.full_name}?`)) {
                        handleRevokeRole(record.user_id, rId, rName);
                      }
                    }}
                    className={`font-semibold text-xs px-2.5 py-0.5 rounded-md inline-flex items-center gap-1 shadow-2xs font-mono m-0 ${
                      isProtected ? 'cursor-not-allowed' : ''
                    }`}
                  >
                    {isProtected && <Shield className="w-3 h-3" />}
                    {rName}
                    {expiresAt && !isProtected && <Clock className="w-3 h-3" />}
                  </Tag>
                </Tooltip>
              );
            })}
          </div>
        );
      },
    },
    {
      title: 'Thao tác gán / gỡ',
      key: 'actions',
      width: 220,
      align: 'right',
      render: (_: any, record: User) => {
        const hasRoles = record.roles && record.roles.length > 0;
        const isCurrentLoading = loadingUserId === record.user_id;
        const protectedUser = isProtectedUser(record.user_id);

        if (!hasRoles) {
          // Người chưa có vai trò
          if (filterRoleId !== 'all') {
            return (
              <div className="flex items-center justify-end">
                <Button
                  type="primary" size="small" icon={<UserPlus className="w-3.5 h-3.5" />}
                  loading={isCurrentLoading}
                  onClick={() => setAssignTarget({ userId: record.user_id, roleId: filterRoleId, currentExpiry: null })}
                  style={{ fontWeight: 600, borderRadius: 6 }}
                >
                  Gán vai trò
                </Button>
              </div>
            );
          }

          const roleMenuItems = roles.map((r) => ({
            key: r.role_id,
            label: <div className="flex items-center justify-between gap-3 py-0.5 px-1 min-w-[130px]"><span className="font-semibold text-xs text-slate-800 dark:text-slate-100">{r.name}</span><span className="text-[10px] text-slate-400 font-mono">({r.role_id})</span></div>,
            onClick: () => setAssignTarget({ userId: record.user_id, roleId: r.role_id, currentExpiry: null }),
          }));

          return (
            <div className="flex items-center justify-end">
              <Dropdown menu={{ items: roleMenuItems }} trigger={['click']}>
                <Button type="primary" size="small" icon={<UserPlus className="w-3.5 h-3.5" />} loading={isCurrentLoading} style={{ fontWeight: 600, borderRadius: 6 }}>
                  Gán vai trò
                </Button>
              </Dropdown>
            </div>
          );
        }

        // ═══════════════════════════════════════════════════
        // Người đã có vai trò
        // ═══════════════════════════════════════════════════
        const roleCount = record.roles?.length || 0;

        // Chỉ các role KHÔNG bị bảo vệ mới có thể gỡ
        const revokableRoles = (record.roles || []).filter(
          (rId) => !isProtectedAdminRole(record.user_id, rId)
        );
        const revokableRoleCount = revokableRoles.length;

        // Điều kiện để nút "Gỡ" active:
        //  - Còn ít nhất 1 role không bị protect có thể gỡ
        //  - Sau khi gỡ vẫn còn ≥1 role trên user (không vi phạm LAST_ROLE_PROTECTED)
        const finalCanRevoke = revokableRoleCount > 0 && roleCount > 1;

        return (
          <div className="flex items-center justify-end gap-2">
            {/* Gán thêm role (chỉ hiện nếu còn role chưa gán) */}
            {roles.filter(r => !record.roles?.includes(r.role_id)).length > 0 && (
              <Dropdown
                trigger={['click']}
                menu={{
                  items: roles
                    .filter(r => !record.roles?.includes(r.role_id))
                    .map(r => ({
                      key: r.role_id,
                      label: r.name,
                      onClick: () => setAssignTarget({ userId: record.user_id, roleId: r.role_id, currentExpiry: null })
                    }))
                }}
              >
                <Button size="small" icon={<UserPlus className="w-3.5 h-3.5" />} title="Gán thêm vai trò" />
              </Dropdown>
            )}

            {/* Gỡ role */}
            {!finalCanRevoke ? (
              <Tooltip
                title={
                  protectedUser && roleCount === 1
                    ? '🔒 Tài khoản quản trị tối cao — Không thể gỡ role Admin duy nhất'
                    : roleCount === 1
                    ? 'Không thể gỡ — mỗi quân nhân phải có ít nhất 1 vai trò'
                    : 'Không có vai trò nào có thể gỡ'
                }
              >
                <Button
                  danger
                  size="small"
                  icon={<UserMinus className="w-3.5 h-3.5" />}
                  disabled
                  style={{ cursor: 'not-allowed', opacity: 0.4 }}
                />
              </Tooltip>
            ) : (
              <Dropdown
                trigger={['click']}
                menu={{
                  items: revokableRoles.map((rId) => {
                    const idx = (record.roles || []).indexOf(rId);
                    const rName = record.role_names?.[idx] || roles.find((r) => r.role_id === rId)?.name || rId;
                    return {
                      key: rId,
                      label: <span>Gỡ: <strong>{rName}</strong></span>,
                      onClick: () => {
                        if (window.confirm(`Gỡ vai trò "${rName}" của ${record.full_name}?`)) {
                          handleRevokeRole(record.user_id, rId, rName);
                        }
                      },
                    };
                  }),
                }}
              >
                <Button
                  danger
                  size="small"
                  icon={<UserMinus className="w-3.5 h-3.5" />}
                  loading={isCurrentLoading}
                  title={`Gỡ vai trò (${revokableRoleCount} role có thể gỡ)`}
                >
                  Gỡ ▼
                </Button>
              </Dropdown>
            )}
          </div>
        );
      },
    },
  ];

  // ═══════════════════════════════════════════════════
  // RENDER GIAO DIỆN
  // ═══════════════════════════════════════════════════
  return (
    <>
      <Modal
        open={open && !assignTarget}
        onCancel={onClose}
        footer={null}
        width={1000}
        centered
        destroyOnHidden
        className="assign-role-modal"
        title={
          <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shadow-xs">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">Phân Quyền & Gán Vai Trò</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Quản lý vai trò vĩnh viễn và tạm thời cho quân nhân</p>
            </div>
          </div>
        }
      >
        <div className="space-y-4 pt-3">
          {/* Thanh công cụ */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100/70 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <Radio.Group value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} buttonStyle="solid" size="middle">
              <Radio.Button value="all">Tất cả ({stats.total})</Radio.Button>
              <Radio.Button value="unassigned">Chưa có ({stats.unassigned})</Radio.Button>
              <Radio.Button value="assigned">Đã có ({stats.assigned})</Radio.Button>
            </Radio.Group>

            <div className="flex items-center gap-2 flex-grow sm:flex-grow-0">
              <Select
                value={filterRoleId} onChange={setFilterRoleId} style={{ width: 160 }}
                options={[{ value: 'all', label: 'Tất cả vai trò' }, ...roles.map((r) => ({ value: r.role_id, label: r.name }))]}
              />
              <Input
                placeholder="Tìm tên, mã QN..." prefix={<Search className="w-3.5 h-3.5 text-slate-400" />}
                value={searchText} onChange={(e) => setSearchText(e.target.value)} allowClear style={{ width: 220 }}
              />
            </div>
          </div>

          {/* Hướng dẫn & Làm mới */}
          <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 rounded-xl p-3 px-4 text-xs text-slate-700 dark:text-amber-200 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Bạn có thể chọn thời hạn (1 ngày, 3 ngày... hoặc đến ngày cụ thể) khi gán vai trò.</span>
            </div>
            <Button size="small" onClick={handleRefreshModal} loading={isRefreshing} icon={<RotateCw className="w-3.5 h-3.5" />}>Làm mới</Button>
          </div>

          {/* Bảng */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs bg-white dark:bg-transparent [&_.ant-pagination]:px-3 [&_.ant-pagination]:py-2">
            <Table<User>
              columns={columns}
              dataSource={filteredUsers}
              rowKey="user_id"
              size="small"
              pagination={{
                current: Math.min(Math.max(1, currentPage), Math.ceil(filteredUsers.length / 5) || 1),
                pageSize: 5,
                onChange: (page) => setCurrentPage(page),
                showSizeChanger: false,
                showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} quân nhân`,
              }}
              locale={{ emptyText: 'Không tìm thấy quân nhân nào' }}
            />
          </div>
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SUB-MODAL: CHỌN THỜI HẠN GÁN VAI TRÒ             */}
      {/* ═══════════════════════════════════════════════════ */}
      <Modal
        open={!!assignTarget}
        onCancel={() => setAssignTarget(null)}
        width={480}
        centered
        zIndex={1050}
        title={
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
            <Clock className="w-5 h-5 text-emerald-600" />
            <span className="font-bold text-base text-slate-900 dark:text-white">Chọn Thời Hạn Hiệu Lực</span>
          </div>
        }
        footer={[
          <Button key="cancel" onClick={() => setAssignTarget(null)}>Hủy</Button>,
          <Button
            key="submit"
            type="primary"
            loading={!!loadingUserId}
            onClick={handleConfirmAssign}
            className="bg-emerald-600 hover:bg-emerald-500 border-none font-semibold"
          >
            Xác Nhận Gán Quyền
          </Button>,
        ]}
      >
        <div className="py-4 space-y-4">
          <Alert
            type="info"
            showIcon
            message={
              <span className="text-xs">
                Đang gán vai trò <b>{roles.find(r => r.role_id === assignTarget?.roleId)?.name}</b> cho quân nhân <b>{usersList.find(u => u.user_id === assignTarget?.userId)?.full_name}</b>
              </span>
            }
          />

          {/* Chọn chế độ thời hạn */}
          <Segmented
            block
            value={durationMode}
            onChange={(val) => setDurationMode(val as DurationMode)}
            options={[
              { label: <div className="flex items-center gap-1"><InfinityIcon className="w-4 h-4" /> Vĩnh viễn</div>, value: 'permanent' },
              { label: <div className="flex items-center gap-1"><Clock className="w-4 h-4" /> Số ngày</div>, value: 'duration' },
              { label: <div className="flex items-center gap-1"><Calendar className="w-4 h-4" /> Chọn ngày</div>, value: 'custom_date' },
            ]}
          />

          {/* Render UI theo chế độ */}
          {durationMode === 'duration' && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Số ngày hiệu lực:</span>
              <Select
                value={durationDays}
                onChange={setDurationDays}
                style={{ width: 140 }}
                options={[
                  { label: '1 ngày', value: 1 },
                  { label: '3 ngày', value: 3 },
                  { label: '7 ngày', value: 7 },
                  { label: '14 ngày', value: 14 },
                  { label: '30 ngày', value: 30 },
                ]}
              />
            </div>
          )}

          {durationMode === 'custom_date' && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Ngày hết hạn:</span>
              <DatePicker
                value={customDate}
                onChange={setCustomDate}
                format="DD/MM/YYYY"
                placeholder="Chọn ngày"
                style={{ width: 180 }}
                disabledDate={(current) => current && current < dayjs().startOf('day').add(1, 'day')}
              />
            </div>
          )}

          {/* Preview ngày hết hạn */}
          {durationMode !== 'permanent' && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-lg">
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                {(() => {
                  if (durationMode === 'custom_date' && !customDate) return '⚠️ Vui lòng chọn ngày cụ thể.';
                  const expDate = durationMode === 'custom_date' ? customDate : dayjs().add(durationDays, 'day');
                  const daysLeft = expDate ? expDate.diff(dayjs(), 'day') : 0;
                  return <>⏰ Quyền sẽ hết hạn lúc <b>23:59 ngày {expDate?.format('DD/MM/YYYY')}</b> (còn <b>{daysLeft} ngày</b>).</>;
                })()}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};