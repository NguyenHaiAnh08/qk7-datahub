import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, X, Users } from 'lucide-react';
import { Header } from '../components/common/Header';
import { Toast, ToastState } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { UserTable } from '../components/users/UserTable';
import { UserFormModal } from '../components/users/UserFormModal';
import { UserCredentialsModal } from '../components/users/UserCredentialsModal';
import { usersApi } from '../services/usersApi';
import { dashboardApi } from '../services/dashboardApi';
import {
  User,
  Unit,
  SecurityLevel,
  Role,
  MilitaryRank,
  MilitaryPosition,
} from '../types';

export const UsersPage: React.FC = () => {
  const [usersList, setUsersList] = useState<User[]>([]);
  const [unitsList, setUnitsList] = useState<Unit[]>([]);
  const [levelsList, setLevelsList] = useState<SecurityLevel[]>([]);
  const [rolesList, setRolesList] = useState<Role[]>([]);
  const [ranksList, setRanksList] = useState<MilitaryRank[]>([]);
  const [positionsList, setPositionsList] = useState<MilitaryPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');

  // Modals
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [credModal, setCredModal] = useState<{ open: boolean; userId: string; username: string }>({
    open: false,
    userId: '',
    username: ''
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    user: User | null;
  }>({
    open: false,
    user: null
  });

  // Toast
  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: '',
    type: 'success'
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 2800);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [uRes, unitRes, lvlRes, roleRes, metaRes] = await Promise.all([
        usersApi.getUsers(),
        dashboardApi.getUnits(),
        dashboardApi.getSecurityLevels(),
        dashboardApi.getRoles(),
        dashboardApi.getMeta(),
      ]);
      const sortedUsers = [...(uRes.items || [])].sort((a, b) => {
        const parseNum = (id?: string) => {
          const m = (id || '').match(/USR-(\d+)/i);
          return m ? parseInt(m[1], 10) : 999999;
        };
        return parseNum(a.user_id) - parseNum(b.user_id);
      });
      setUsersList(sortedUsers);
      setUnitsList(unitRes.items || []);
      setLevelsList(lvlRes.items || []);
      setRolesList(roleRes.items || []);
      setRanksList((metaRes as any).ranks || []);
      setPositionsList((metaRes as any).positions || []);
    } catch (err: any) {
      showToast('Lỗi tải dữ liệu quân nhân: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

    const handleSaveUser = async (userData: Partial<User>) => {
    if (selectedUser?.user_id) {
      await usersApi.updateUser(selectedUser.user_id, userData);
      await loadData();
      showToast('Đã cập nhật thông tin quân nhân');
    } else {
      await usersApi.createUser(userData as any);
      await loadData();
      showToast('Đã thêm quân nhân mới thành công');
    }
  };

  const handleDeleteUser = async () => {
  if (!deleteConfirm.user) return;
  try {
    await usersApi.deleteUser(deleteConfirm.user.user_id);
    setDeleteConfirm({ open: false, user: null });
    await loadData();                          // ← await trước
    showToast(`Đã xóa quân nhân ${deleteConfirm.user.full_name}`);
  } catch (err: any) {
    showToast('Lỗi: ' + err.message, 'error');
  }
};

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return usersList;
    const q = userSearch.toLowerCase().trim();
    return usersList.filter(
      (u) =>
        (u.user_id || '').toLowerCase().includes(q) ||
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.rank_name || '').toLowerCase().includes(q) ||
        (u.position || '').toLowerCase().includes(q) ||
        (u.unit_name || '').toLowerCase().includes(q) ||
        (u.role_names || []).some((rn) => rn.toLowerCase().includes(q))
    );
  }, [usersList, userSearch]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      <Header
        activeNav="admin"
        title="Trường Quân Sự Quân Khu 7"
        subtitle="Trung tâm dữ liệu số"
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="shrink-0">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5 whitespace-nowrap">
              <Users className="w-6 h-6 text-amber-500 dark:text-amber-400 shrink-0" />
              <span>Danh Sách Quân Nhân & Cán Bộ</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 whitespace-nowrap">
              Phân cấp độ bảo mật (Cấp 1 - 5), tài khoản xác thực và đơn vị công tác
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Tìm mã, họ tên, đơn vị..."
                className="w-full sm:w-64 pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
              />
              {userSearch && (
                <button
                  onClick={() => setUserSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={() => {
                setSelectedUser(null);
                setUserModalOpen(true);
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Thêm quân nhân
            </button>
          </div>
        </div>

        <UserTable
          users={filteredUsers}
          loading={loading}
          onEdit={(u) => {
            setSelectedUser(u);
            setUserModalOpen(true);
          }}
          onUpdateCredentials={(u) => {
            setCredModal({
              open: true,
              userId: u.user_id,
              username: u.username || u.user_id.toLowerCase()
            });
          }}
          onDelete={(u) => setDeleteConfirm({ open: true, user: u })}
        />
      </main>

      <UserFormModal
        open={userModalOpen}
        user={selectedUser}
        units={unitsList}
        securityLevels={levelsList}
        roles={rolesList}
        ranks={ranksList}
        positions={positionsList}
        existingUsers={usersList}
        onClose={() => {
          setUserModalOpen(false);
          setSelectedUser(null);
        }}
        onSave={handleSaveUser}
      />

      <UserCredentialsModal
        open={credModal.open}
        userId={credModal.userId}
        defaultUsername={credModal.username}
        onClose={() => setCredModal({ open: false, userId: '', username: '' })}
        onSuccess={loadData}
        onToast={showToast}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Xác Nhận Xóa Quân Nhân"
        message={`Bạn có chắc chắn muốn xóa tài khoản ${deleteConfirm.user?.full_name} (${deleteConfirm.user?.user_id})?`}
        confirmText="Xác nhận xóa"
        confirmVariant="danger"
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteConfirm({ open: false, user: null })}
      />

      <Toast toast={toast} onClose={() => setToast((prev) => ({ ...prev, show: false }))} />
    </div>
  );
};