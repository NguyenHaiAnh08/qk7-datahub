import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Table,
  Tag,
  Select,
  Input,
  Button,
  Radio,
  Space,
  Popconfirm,
  Badge,
  Tooltip,
  Dropdown,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  Search,
  UserCheck,
  UserMinus,
  UserPlus,
  Shield,
  RotateCw,
  X,
  ArrowRightLeft,
  Filter,
} from 'lucide-react';
import { User, Role } from '../../types';
import { roleService } from '../../services/roleService';
import { usersApi } from '../../services/usersApi';

export interface AssignRoleModalProps {
  open: boolean;
  roles: Role[];
  users: User[];
  targetRole?: Role | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
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
  // Local list of users to enable instant optimistic UI update
  const [usersList, setUsersList] = useState<User[]>([]);
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unassigned' | 'assigned'>('all');
  const [filterRoleId, setFilterRoleId] = useState<string>('all');

  // Loading state per user row
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

  // Key để reset triệt để ô chọn đổi vai trò về trống
  const [switchRoleKey, setSwitchRoleKey] = useState<number>(0);

  // Trạng thái đang làm mới dữ liệu
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Hàm xử lý làm mới danh sách dữ liệu trong modal
  const handleRefreshModal = async () => {
    setIsRefreshing(true);
    try {
      // 1. Tải trực tiếp danh sách người dùng mới nhất từ backend
      const res = await usersApi.getUsers();
      if (res && res.items) {
        setUsersList(res.items);
      }
      // 2. Đồng bộ callback với component cha
      await onRefresh();
      onToast('Đã làm mới danh sách quân nhân thành công!', 'success');
    } catch (err: any) {
      onToast(`Lỗi làm mới: ${err.message || 'Không thể tải lại'}`, 'error');
    } finally {
      setTimeout(() => setIsRefreshing(false), 350);
    }
  };

  // Sync users when modal opens or initialUsers changes
  useEffect(() => {
    if (open) {
      setUsersList([...initialUsers]);
      setSearchText('');
      setFilterStatus('all');
      if (targetRole) {
        setFilterRoleId(targetRole.role_id);
      } else {
        setFilterRoleId('all');
      }
    }
  }, [open, initialUsers, targetRole]);

  // Default role ID to assign if user doesn't pick one
  const defaultAssignRoleId = useMemo(() => {
    if (targetRole) return targetRole.role_id;
    if (roles.length > 0) return roles[0].role_id;
    return '';
  }, [targetRole, roles]);

  // Statistics
  const stats = useMemo(() => {
    const total = usersList.length;
    const assigned = usersList.filter((u) => u.roles && u.roles.length > 0).length;
    const unassigned = total - assigned;
    return { total, assigned, unassigned };
  }, [usersList]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      // 1. Text Search
      if (searchText.trim()) {
        const q = searchText.toLowerCase().trim();
        const matchId = (u.user_id || '').toLowerCase().includes(q);
        const matchName = (u.full_name || '').toLowerCase().includes(q);
        const matchRank = (u.rank_name || '').toLowerCase().includes(q);
        const matchPos = (u.position || '').toLowerCase().includes(q);
        const matchUnit = (u.unit_name || '').toLowerCase().includes(q);
        const matchRole = (u.role_names || []).some((r) => r.toLowerCase().includes(q));
        if (!matchId && !matchName && !matchRank && !matchPos && !matchUnit && !matchRole) {
          return false;
        }
      }

      // 2. Filter status: all, unassigned, assigned
      const hasRole = Boolean(u.roles && u.roles.length > 0);
      if (filterStatus === 'unassigned' && hasRole) return false;
      if (filterStatus === 'assigned' && !hasRole) return false;

      // 3. Filter specific role
      if (filterRoleId !== 'all') {
        const hasSpecificRole = (u.roles || []).includes(filterRoleId);
        if (!hasSpecificRole) return false;
      }

      return true;
    });
  }, [usersList, searchText, filterStatus, filterRoleId]);

  // Gán vai trò cho user
  const handleAssignRole = async (userId: string, roleIdToAssign: string) => {
    if (!roleIdToAssign) {
      onToast('Vui lòng chọn vai trò cần gán!', 'error');
      return;
    }

    const roleObj = roles.find((r) => r.role_id === roleIdToAssign);
    const roleName = roleObj ? roleObj.name : roleIdToAssign;
    const targetUser = usersList.find((u) => u.user_id === userId);

    setLoadingUserId(userId);
    try {
      await roleService.assignRoleToUser(userId, roleIdToAssign);

      // Cập nhật optimistic local state ngay lập tức
      setUsersList((prev) =>
        prev.map((u) => {
          if (u.user_id === userId) {
            const currentRoles = u.roles || [];
            const currentRoleNames = u.role_names || [];
            const newRoles = Array.from(new Set([...currentRoles, roleIdToAssign]));
            const newRoleNames = Array.from(new Set([...currentRoleNames, roleName]));
            return {
              ...u,
              roles: newRoles,
              role_names: newRoleNames,
            };
          }
          return u;
        })
      );

      onToast(
        `Đã gán vai trò "${roleName}" cho quân nhân ${targetUser?.full_name || userId} thành công!`,
        'success'
      );
      // Đồng bộ dữ liệu gốc ngầm
      onRefresh();
    } catch (err: any) {
      onToast(`Lỗi gán vai trò: ${err.message || 'Không thể thực hiện'}`, 'error');
    } finally {
      setLoadingUserId(null);
    }
  };

  // Gỡ 1 vai trò cụ thể của user
  const handleRevokeRole = async (userId: string, roleIdToRevoke: string, roleName?: string) => {
    const targetUser = usersList.find((u) => u.user_id === userId);
    const rName = roleName || roles.find((r) => r.role_id === roleIdToRevoke)?.name || roleIdToRevoke;

    setLoadingUserId(userId);
    try {
      await roleService.revokeRoleFromUser(userId, roleIdToRevoke);

      // Cập nhật optimistic local state ngay lập tức
      setUsersList((prev) =>
        prev.map((u) => {
          if (u.user_id === userId) {
            const newRoles = (u.roles || []).filter((r) => r !== roleIdToRevoke);
            const newRoleNames = (u.role_names || []).filter((rn) => rn !== rName);
            return {
              ...u,
              roles: newRoles,
              role_names: newRoleNames,
            };
          }
          return u;
        })
      );

      onToast(
        `Đã gỡ vai trò "${rName}" của quân nhân ${targetUser?.full_name || userId} thành công!`,
        'info'
      );
      onRefresh();
    } catch (err: any) {
      onToast(`Lỗi gỡ vai trò: ${err.message || 'Không thể thực hiện'}`, 'error');
    } finally {
      setLoadingUserId(null);
    }
  };

  // Gỡ toàn bộ vai trò của user (áp dụng khi user có nhiều vai trò)
  const handleRevokeAllRoles = async (userId: string) => {
    const targetUser = usersList.find((u) => u.user_id === userId);
    const userRoles = targetUser?.roles || [];
    if (!userRoles.length) return;

    setLoadingUserId(userId);
    try {
      for (const rId of userRoles) {
        await roleService.revokeRoleFromUser(userId, rId);
      }

      setUsersList((prev) =>
        prev.map((u) => {
          if (u.user_id === userId) {
            return {
              ...u,
              roles: [],
              role_names: [],
            };
          }
          return u;
        })
      );

      onToast(`Đã gỡ toàn bộ vai trò của quân nhân ${targetUser?.full_name || userId}!`, 'info');
      onRefresh();
    } catch (err: any) {
      onToast(`Lỗi gỡ vai trò: ${err.message || 'Không thể thực hiện'}`, 'error');
    } finally {
      setLoadingUserId(null);
    }
  };

  // Đổi vai trò trực tiếp (gỡ vai trò cũ và gán vai trò mới)
  const handleSwitchRole = async (userId: string, oldRoleId: string, newRoleId: string) => {
    if (!newRoleId || oldRoleId === newRoleId) return;
    const oldRoleName = roles.find((r) => r.role_id === oldRoleId)?.name || oldRoleId;
    const newRoleName = roles.find((r) => r.role_id === newRoleId)?.name || newRoleId;
    const targetUser = usersList.find((u) => u.user_id === userId);

    setLoadingUserId(userId);
    try {
      // 1. Gỡ vai trò cũ
      await roleService.revokeRoleFromUser(userId, oldRoleId);
      // 2. Gán vai trò mới
      await roleService.assignRoleToUser(userId, newRoleId);

      // Cập nhật local state
      setUsersList((prev) =>
        prev.map((u) => {
          if (u.user_id === userId) {
            const filteredRoles = (u.roles || []).filter((r) => r !== oldRoleId);
            const filteredNames = (u.role_names || []).filter((rn) => rn !== oldRoleName);
            return {
              ...u,
              roles: [...filteredRoles, newRoleId],
              role_names: [...filteredNames, newRoleName],
            };
          }
          return u;
        })
      );

      // Reset ô chuyển vai trò về trạng thái trống hoàn toàn
      setSwitchRoleKey((prev) => prev + 1);

      onToast(
        `Đã chuyển vai trò từ "${oldRoleName}" sang "${newRoleName}" cho ${targetUser?.full_name || userId}!`,
        'success'
      );
      onRefresh();
    } catch (err: any) {
      onToast(`Lỗi đổi vai trò: ${err.message || 'Không thể thực hiện'}`, 'error');
    } finally {
      setLoadingUserId(null);
    }
  };

  // Cấu hình các cột của Ant Design Table
  const columns: ColumnsType<User> = [
    {
      title: 'Mã QN',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 100,
      render: (id: string) => (
        <span className="font-mono text-amber-600 dark:text-amber-400 font-bold text-xs">{id}</span>
      ),
    },
    {
      title: 'Họ và tên',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 230,
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
      width: 150,
      render: (unit: string) => (
        <span className="text-slate-600 dark:text-slate-300 text-xs">{unit || '—'}</span>
      ),
    },
    {
      title: 'Vai trò hiện tại',
      key: 'roles',
      width: 200,
      render: (_: any, record: User) => {
        const hasRoles = record.roles && record.roles.length > 0;
        if (!hasRoles) {
          return (
            <Tag
              className="text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700 font-medium text-xs px-2.5 py-0.5 rounded-md"
              style={{ borderStyle: 'dashed' }}
            >
              Chưa có vai trò
            </Tag>
          );
        }
        return (
          <div className="flex flex-wrap gap-1.5 items-center">
            {record.roles!.map((rId, idx) => {
              const rName =
                record.role_names && record.role_names[idx]
                  ? record.role_names[idx]
                  : roles.find((r) => r.role_id === rId)?.name || rId;
              return (
                <Tag
                  key={rId}
                  color="purple"
                  className="font-semibold text-xs px-2.5 py-0.5 rounded-md inline-flex items-center shadow-2xs"
                >
                  {rName}
                </Tag>
              );
            })}
          </div>
        );
      },
    },
    {
      title: 'Thao tác gán / gỡ',
      key: 'actions',
      width: 250,
      align: 'right',
      render: (_: any, record: User) => {
        const hasRoles = record.roles && record.roles.length > 0;
        const isCurrentLoading = loadingUserId === record.user_id;

        // TRƯỜNG HỢP 1: NGƯỜI DÙNG CHƯA CÓ VAI TRÒ
        // -> CHỈ hiện duy nhất nút "Gán vai trò", KHÔNG hiện ô chọn vai trò.
        if (!hasRoles) {
          // Nếu đang lọc theo 1 vai trò cụ thể: gán ngay vai trò đó
          if (filterRoleId !== 'all') {
            const roleObj = roles.find((r) => r.role_id === filterRoleId);
            const roleName = roleObj ? roleObj.name : filterRoleId;
            return (
              <div className="flex items-center justify-end">
                <Button
                  type="primary"
                  size="small"
                  icon={<UserPlus className="w-3.5 h-3.5" />}
                  loading={isCurrentLoading}
                  onClick={() => handleAssignRole(record.user_id, filterRoleId)}
                  style={{
                    fontWeight: 600,
                    borderRadius: 6,
                  }}
                  title={`Gán vai trò "${roleName}"`}
                >
                  Gán vai trò
                </Button>
              </div>
            );
          }

          // Khi lọc tất cả vai trò: bấm "Gán vai trò" xổ menu danh sách vai trò để chọn gán
          const roleMenuItems = roles.map((r) => ({
            key: r.role_id,
            label: (
              <div className="flex items-center justify-between gap-3 py-0.5 px-1 min-w-[130px]">
                <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">{r.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">({r.role_id})</span>
              </div>
            ),
            onClick: () => handleAssignRole(record.user_id, r.role_id),
          }));

          return (
            <div className="flex items-center justify-end">
              <Dropdown menu={{ items: roleMenuItems }} trigger={['click']}>
                <Button
                  type="primary"
                  size="small"
                  icon={<UserPlus className="w-3.5 h-3.5" />}
                  loading={isCurrentLoading}
                  style={{
                    fontWeight: 600,
                    borderRadius: 6,
                  }}
                >
                  Gán vai trò
                </Button>
              </Dropdown>
            </div>
          );
        }

        // TRƯỜNG HỢP 2: NGƯỜI DÙNG ĐÃ CÓ VAI TRÒ
        // -> Hiện nút "Gỡ vai trò" và bộ chọn nhanh để đổi sang vai trò khác
        const isMultiRole = record.roles!.length > 1;
        const primaryRoleId = record.roles![0];
        const primaryRoleName =
          (record.role_names && record.role_names[0]) ||
          roles.find((r) => r.role_id === primaryRoleId)?.name ||
          primaryRoleId;

        return (
          <div className="flex items-center justify-end gap-2">
            {/* Đổi nhanh sang vai trò khác (nếu chỉ có 1 vai trò) */}
            {!isMultiRole && (
              <Select
                key={`switch-${record.user_id}-${primaryRoleId}-${switchRoleKey}`}
                size="small"
                value={null}
                placeholder="Đổi vai trò..."
                style={{ width: 120 }}
                onChange={(newRoleId) => handleSwitchRole(record.user_id, primaryRoleId, newRoleId)}
                options={roles
                  .filter((r) => !record.roles!.includes(r.role_id))
                  .map((r) => ({
                    value: r.role_id,
                    label: r.name,
                  }))}
              />
            )}

            {/* Nút Gỡ vai trò */}
            <Popconfirm
              title={isMultiRole ? 'Xác nhận gỡ tất cả vai trò' : 'Xác nhận gỡ vai trò'}
              description={
                isMultiRole
                  ? `Quân nhân đang có ${record.roles!.length} vai trò. Bạn có chắc muốn gỡ toàn bộ vai trò của ${record.full_name}?`
                  : `Bạn có chắc muốn gỡ vai trò "${primaryRoleName}" của ${record.full_name}?`
              }
              onConfirm={() =>
                isMultiRole
                  ? handleRevokeAllRoles(record.user_id)
                  : handleRevokeRole(record.user_id, primaryRoleId, primaryRoleName)
              }
              okText={isMultiRole ? 'Gỡ tất cả' : 'Gỡ vai trò'}
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Button
                danger
                size="small"
                icon={<UserMinus className="w-3.5 h-3.5" />}
                loading={isCurrentLoading}
                style={{
                  fontWeight: 600,
                  borderRadius: 6,
                }}
              >
                {isMultiRole ? 'Gỡ tất cả' : 'Gỡ vai trò'}
              </Button>
            </Popconfirm>
          </div>
        );
      },
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={940}
      centered
      destroyOnHidden
      className="assign-role-modal"
      title={
        <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-500/15 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-xs">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
              Phân Quyền & Gán Vai Trò Người Dùng
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Quản lý gán vai trò cho quân nhân và thu hồi / luân chuyển vai trò trong hệ thống
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-4 pt-3">
        {/* Thanh công cụ lọc & tìm kiếm */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100/70 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
          {/* Radio lọc trạng thái */}
          <Radio.Group
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            buttonStyle="solid"
            size="middle"
          >
            <Radio.Button value="all">
              Tất cả ({stats.total})
            </Radio.Button>
            <Radio.Button value="unassigned">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400 inline-block"></span>
                Chưa có vai trò ({stats.unassigned})
              </span>
            </Radio.Button>
            <Radio.Button value="assigned">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span>
                Đã có vai trò ({stats.assigned})
              </span>
            </Radio.Button>
          </Radio.Group>

          {/* Lọc theo vai trò cụ thể & Tìm kiếm */}
          <div className="flex items-center gap-2 flex-grow sm:flex-grow-0">
            <Select
              value={filterRoleId}
              onChange={setFilterRoleId}
              style={{ width: 160 }}
              options={[
                { value: 'all', label: 'Tất cả vai trò' },
                ...roles.map((r) => ({
                  value: r.role_id,
                  label: r.name,
                })),
              ]}
              placeholder="Lọc vai trò"
            />

            <Input
              placeholder="Tìm tên, mã QN, đơn vị..."
              prefix={<Search className="w-3.5 h-3.5 text-slate-400" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ width: 220 }}
            />
          </div>
        </div>

        {/* Hướng dẫn thao tác nhanh & nút Làm mới */}
        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 rounded-xl p-3 px-4 text-xs text-slate-700 dark:text-purple-200 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
            <span className="leading-relaxed">
              <strong className="text-purple-700 dark:text-purple-300 font-semibold">Gợi ý:</strong> Chọn vai trò rồi bấm <strong className="text-purple-700 dark:text-purple-300 font-semibold">"Gán vai trò"</strong> đối với người chưa có vai trò. Bấm <strong className="text-rose-600 dark:text-rose-400 font-semibold">"Gỡ vai trò"</strong> đối với người đã có vai trò để thu hồi hoặc chuyển sang vai trò khác.
            </span>
          </div>
          <button
            type="button"
            disabled={isRefreshing}
            onClick={handleRefreshModal}
            className="px-2.5 py-1 text-xs rounded-lg bg-white dark:bg-purple-900/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700/50 flex items-center gap-1.5 font-medium cursor-pointer whitespace-nowrap flex-shrink-0 transition-colors shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed"
            title="Tải lại danh sách"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-purple-600 dark:text-purple-400' : ''}`} />
            <span>{isRefreshing ? 'Đang tải...' : 'Làm mới'}</span>
          </button>
        </div>

        {/* Bảng danh sách người dùng */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs bg-white dark:bg-transparent">
          <Table<User>
            columns={columns}
            dataSource={filteredUsers}
            rowKey="user_id"
            size="small"
            pagination={{
              pageSize: 7,
              showSizeChanger: false,
              showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} người dùng`,
            }}
            locale={{
              emptyText: 'Không tìm thấy người dùng nào phù hợp',
            }}
          />
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
          <span>
            Hiển thị <strong>{filteredUsers.length}</strong> / <strong>{usersList.length}</strong> quân nhân
          </span>
        </div>
      </div>
    </Modal>
  );
};
