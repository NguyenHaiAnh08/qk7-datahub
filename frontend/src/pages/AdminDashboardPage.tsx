import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  KeyRound,
  ShieldAlert,
  Building,
  FileText,
  Shield,
  Activity,
  RotateCw,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  FileCheck,
  HardDrive,
  History,
  Save,
  Menu
} from 'lucide-react';
import { Header } from '../components/common/Header';
import { Sidebar } from '../components/common/Sidebar';
import { Toast, ToastState } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { StatCard } from '../components/dashboard/StatCard';
import { DistributionChart } from '../components/dashboard/DistributionChart';
import { UserTable } from '../components/users/UserTable';
import { UserFormModal } from '../components/users/UserFormModal';
import { UserCredentialsModal } from '../components/users/UserCredentialsModal';

import { dashboardApi } from '../services/dashboardApi';
import { usersApi } from '../services/usersApi';
import { formatFileSize } from '../utils/formatFileSize';
import { formatDate } from '../utils/dateUtils';
import {
  User,
  AdminStats,
  Role,
  Permission,
  Unit,
  DocumentType,
  SecurityLevel,
  AccessLog
} from '../types';

export const AdminDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Stats
  const [stats, setStats] = useState<AdminStats | null>(null);

  // Entities Data
  const [usersList, setUsersList] = useState<User[]>([]);
  const [rolesList, setRolesList] = useState<Role[]>([]);
  const [permsList, setPermsList] = useState<Permission[]>([]);
  const [unitsList, setUnitsList] = useState<Unit[]>([]);
  const [docTypesList, setDocTypesList] = useState<DocumentType[]>([]);
  const [levelsList, setLevelsList] = useState<SecurityLevel[]>([]);
  const [logsList, setLogsList] = useState<AccessLog[]>([]);

  // Search & Filters
  const [userSearch, setUserSearch] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [logFilterAction, setLogFilterAction] = useState('');

  // Modals
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [credModal, setCredModal] = useState<{ open: boolean; userId: string; username: string }>({
    open: false,
    userId: '',
    username: ''
  });

  // Generic Edit Modal for Roles, Units, DocTypes, Levels
  const [genericModal, setGenericModal] = useState<{
    open: boolean;
    type: 'roles' | 'units' | 'doctypes' | 'levels' | null;
    item: any;
  }>({
    open: false,
    type: null,
    item: null
  });
  const [genericFormData, setGenericFormData] = useState<any>({});

  // Delete Confirm Dialog
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: async () => {}
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

  // Load Data by Tab
  const loadStats = async () => {
    try {
      const data = await dashboardApi.getStats();
      setStats(data);
    } catch (err: any) {
      showToast('Lỗi tải thống kê: ' + err.message, 'error');
    }
  };

  const loadUsers = async () => {
    try {
      const data = await usersApi.getUsers();
      setUsersList(data.items || []);
    } catch (err: any) {
      showToast('Lỗi tải người dùng: ' + err.message, 'error');
    }
  };

  const loadRoles = async () => {
    try {
      const data = await dashboardApi.getRoles();
      setRolesList(data.items || []);
    } catch (err: any) {
      showToast('Lỗi tải vai trò: ' + err.message, 'error');
    }
  };

  const loadPermissions = async () => {
    try {
      const data = await dashboardApi.getPermissions();
      setPermsList(data.items || []);
    } catch (err: any) {
      showToast('Lỗi tải quyền: ' + err.message, 'error');
    }
  };

  const loadUnits = async () => {
    try {
      const data = await dashboardApi.getUnits();
      setUnitsList(data.items || []);
    } catch (err: any) {
      showToast('Lỗi tải đơn vị: ' + err.message, 'error');
    }
  };

  const loadDocTypes = async () => {
    try {
      const data = await dashboardApi.getDocumentTypes();
      setDocTypesList(data.items || []);
    } catch (err: any) {
      showToast('Lỗi tải loại văn bản: ' + err.message, 'error');
    }
  };

  const loadLevels = async () => {
    try {
      const data = await dashboardApi.getSecurityLevels();
      setLevelsList(data.items || []);
    } catch (err: any) {
      showToast('Lỗi tải mức bảo mật: ' + err.message, 'error');
    }
  };

  const loadLogs = async () => {
    try {
      const data = await dashboardApi.getAccessLogs({ action: logFilterAction || undefined });
      setLogsList(data.items || []);
    } catch (err: any) {
      showToast('Lỗi tải nhật ký: ' + err.message, 'error');
    }
  };

  useEffect(() => {
    switch (activeTab) {
      case 'overview':
        loadStats();
        break;
      case 'users':
        loadUsers();
        if (!unitsList.length) loadUnits();
        if (!levelsList.length) loadLevels();
        if (!rolesList.length) loadRoles();
        break;
      case 'roles':
        loadRoles();
        break;
      case 'permissions':
        loadPermissions();
        break;
      case 'units':
        loadUnits();
        break;
      case 'doctypes':
        loadDocTypes();
        break;
      case 'levels':
        loadLevels();
        break;
      case 'logs':
        loadLogs();
        break;
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'logs') loadLogs();
  }, [logFilterAction]);

  // Save User
  const handleSaveUser = async (userData: Partial<User>) => {
    if (selectedUser?.user_id) {
      await usersApi.updateUser(selectedUser.user_id, userData);
      showToast('Đã cập nhật thông tin quân nhân');
    } else {
      await usersApi.createUser(userData as any);
      showToast('Đã tạo quân nhân mới thành công');
    }
    loadUsers();
  };

  // Delete User
  const handleDeleteUser = (u: User) => {
    setDeleteConfirm({
      open: true,
      title: 'Xóa Người Dùng',
      message: `Bạn có chắc chắn muốn xóa tài khoản ${u.full_name} (${u.user_id})?`,
      onConfirm: async () => {
        try {
          await usersApi.deleteUser(u.user_id);
          showToast(`Đã xóa tài khoản ${u.user_id}`);
          loadUsers();
        } catch (err: any) {
          showToast('Lỗi: ' + err.message, 'error');
        } finally {
          setDeleteConfirm((prev) => ({ ...prev, open: false }));
        }
      }
    });
  };

  // Generic Save Modal
  const handleGenericSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const { type, item } = genericModal;
    try {
      if (type === 'roles') {
        if (item) {
          await dashboardApi.updateRole(item.role_id, { name: genericFormData.name });
        } else {
          await dashboardApi.createRole({ role_id: genericFormData.role_id, name: genericFormData.name });
        }
        loadRoles();
      } else if (type === 'units') {
        if (item) {
          await dashboardApi.updateUnit(item.unit_id, genericFormData);
        } else {
          await dashboardApi.createUnit(genericFormData);
        }
        loadUnits();
      } else if (type === 'doctypes') {
        if (item) {
          await dashboardApi.updateDocumentType(item.type_id, genericFormData);
        } else {
          await dashboardApi.createDocumentType(genericFormData);
        }
        loadDocTypes();
      } else if (type === 'levels') {
        if (item) {
          await dashboardApi.updateSecurityLevel(item.level_id, genericFormData);
        } else {
          await dashboardApi.createSecurityLevel({
            level_id: Number(genericFormData.level_id),
            code: genericFormData.code,
            name: genericFormData.name
          });
        }
        loadLevels();
      }
      showToast('Đã lưu thành công');
      setGenericModal({ open: false, type: null, item: null });
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    }
  };

  // Generic Delete
  const handleGenericDelete = (type: string, id: string | number, name: string) => {
    setDeleteConfirm({
      open: true,
      title: `Xóa ${type}`,
      message: `Bạn có chắc chắn muốn xóa bản ghi "${name}" (${id})?`,
      onConfirm: async () => {
        try {
          if (type === 'roles') {
            await dashboardApi.deleteRole(String(id));
            loadRoles();
          } else if (type === 'permissions') {
            await dashboardApi.deletePermission(String(id));
            loadPermissions();
          } else if (type === 'units') {
            await dashboardApi.deleteUnit(String(id));
            loadUnits();
          } else if (type === 'doctypes') {
            await dashboardApi.deleteDocumentType(String(id));
            loadDocTypes();
          } else if (type === 'levels') {
            await dashboardApi.deleteSecurityLevel(Number(id));
            loadLevels();
          }
          showToast(`Đã xóa thành công ${id}`);
        } catch (err: any) {
          showToast('Lỗi: ' + err.message, 'error');
        } finally {
          setDeleteConfirm((prev) => ({ ...prev, open: false }));
        }
      }
    });
  };

  // Filtered lists
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

  const filteredLogs = useMemo(() => {
    if (!logSearch.trim()) return logsList;
    const q = logSearch.toLowerCase().trim();
    return logsList.filter(
      (l) =>
        (l.user_id || '').toLowerCase().includes(q) ||
        (l.full_name || '').toLowerCase().includes(q) ||
        (l.action || '').toLowerCase().includes(q) ||
        (l.doc_title || '').toLowerCase().includes(q) ||
        (l.file_id || '').toLowerCase().includes(q) ||
        (l.ip || '').toLowerCase().includes(q)
    );
  }, [logsList, logSearch]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-900 transition-colors duration-200">
      {/* Header */}
      <Header
        activeNav="admin"
        title="QK7 DATAHUB"
        subtitle="Hệ Thống Quản Trị Trung Tâm & Phân Quyền Quân Khu"
      />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="lg:hidden p-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-800">
            <span className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Điều hướng</span>
            <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <Sidebar
            activeTab={activeTab as any}
            onTabChange={(id) => {
              setActiveTab(id);
              setSidebarOpen(false);
            }}
          />
        </aside>

        {/* Mobile Backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-950/60 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-950/60 space-y-6">
          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-2 text-xs shadow-sm"
            >
              <Menu className="w-4 h-4" />
              <span>Menu Quản Trị</span>
            </button>
          </div>

          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <LayoutDashboard className="w-5 h-5 text-amber-400" /> Tổng Quan Hệ Thống
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Thống kê dữ liệu hoạt động thời gian thực</p>
                </div>
                <button
                  onClick={loadStats}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" /> Làm mới
                </button>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Quân nhân & Người dùng"
                  value={stats?.users ?? '—'}
                  icon={<Users className="w-6 h-6" />}
                  color="blue"
                  subtext="Đã kích hoạt trên hệ thống"
                />
                <StatCard
                  label="Văn bản & Tài liệu"
                  value={stats?.documents ?? '—'}
                  icon={<FileCheck className="w-6 h-6" />}
                  color="emerald"
                  subtext="Lưu trữ trong kho số"
                  delay={0.05}
                />
                <StatCard
                  label="Tổng dung lượng tệp"
                  value={stats ? formatFileSize(stats.totalSize) : '—'}
                  icon={<HardDrive className="w-6 h-6" />}
                  color="purple"
                  subtext="Ổ đĩa dữ liệu an toàn"
                  delay={0.1}
                />
                <StatCard
                  label="Truy cập nhật ký 24h"
                  value={stats?.logs24h ?? '—'}
                  icon={<History className="w-6 h-6" />}
                  color="red"
                  subtext="Bản ghi kiểm toán an ninh"
                  delay={0.15}
                />
              </div>

              {/* Distribution Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <DistributionChart
                  title="Phân Bố Tài Liệu Theo Mức Bảo Mật"
                  icon={<Shield className="w-4 h-4 text-amber-400" />}
                  barColor="amber"
                  items={(stats?.byLevel || []).map((x) => ({
                    id: x.lv,
                    label: x.lvName,
                    count: x.n,
                  }))}
                />
                <DistributionChart
                  title="Phân Bố Tài Liệu Theo Thể Loại Văn Bản"
                  icon={<FileText className="w-4 h-4 text-emerald-400" />}
                  barColor="emerald"
                  items={(stats?.byType || []).map((t) => ({
                    id: t.id,
                    label: t.name,
                    count: t.n,
                  }))}
                />
              </div>
            </div>
          )}

          {/* TAB: USERS */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-400" /> Quản Lý Danh Sách Quân Nhân
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tổng số: {usersList.length} quân nhân • Phân quyền bảo mật theo cấp bậc
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Tìm theo mã, tên, đơn vị..."
                      className="w-full sm:w-64 pl-9 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                    />
                    {userSearch && (
                      <button
                        onClick={() => setUserSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
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
                    <Plus className="w-4 h-4" /> Thêm người dùng
                  </button>
                </div>
              </div>

              <UserTable
                users={filteredUsers}
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
                onDelete={handleDeleteUser}
              />
            </div>
          )}

          {/* TAB: ROLES */}
          {activeTab === 'roles' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-amber-400" /> Quản Lý Vai Trò (Roles)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Phân quyền vai trò chức năng hệ thống</p>
                </div>
                <button
                  onClick={() => {
                    setGenericFormData({ role_id: '', name: '' });
                    setGenericModal({ open: true, type: 'roles', item: null });
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Thêm vai trò
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 uppercase text-[11px] border-b border-slate-200 dark:border-slate-800 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Mã Role</th>
                      <th className="py-3 px-4">Tên vai trò</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {rolesList.map((r) => (
                      <tr key={r.role_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-amber-600 dark:text-amber-400 font-semibold">{r.role_id}</td>
                        <td className="py-3 px-4 text-slate-900 dark:text-white font-semibold">{r.name}</td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setGenericFormData({ ...r });
                              setGenericModal({ open: true, type: 'roles', item: r });
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-transparent rounded-lg mr-1.5 transition cursor-pointer"
                            title="Sửa vai trò"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleGenericDelete('roles', r.role_id, r.name)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900/70 dark:text-rose-400 dark:border-transparent rounded-lg transition cursor-pointer"
                            title="Xóa vai trò"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: PERMISSIONS */}
          {activeTab === 'permissions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-amber-500 dark:text-amber-400" /> Danh Sách Quyền (Permissions)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Các quyền hạn truy xuất trong hệ thống</p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 uppercase text-[11px] border-b border-slate-200 dark:border-slate-800 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Mã Quyền</th>
                      <th className="py-3 px-4">Tên quyền</th>
                      <th className="py-3 px-4">Mô tả</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {permsList.map((p) => (
                      <tr key={p.permission_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-amber-600 dark:text-amber-400 font-semibold">{p.permission_id}</td>
                        <td className="py-3 px-4 text-slate-900 dark:text-white font-semibold">{p.name || p.code || p.permission_id}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{p.description || '—'}</td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleGenericDelete('permissions', p.permission_id, p.name || p.code || p.permission_id)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900/70 dark:text-rose-400 dark:border-transparent rounded-lg transition cursor-pointer"
                            title="Xóa quyền"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: UNITS */}
          {activeTab === 'units' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Building className="w-5 h-5 text-amber-500 dark:text-amber-400" /> Danh Mục Đơn Vị Quân Khu
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Các phòng ban, trung đoàn, sư đoàn trực thuộc</p>
                </div>
                <button
                  onClick={() => {
                    setGenericFormData({ unit_id: '', name: '', parent_id: '' });
                    setGenericModal({ open: true, type: 'units', item: null });
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Thêm đơn vị
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 uppercase text-[11px] border-b border-slate-200 dark:border-slate-800 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Mã Đơn Vị</th>
                      <th className="py-3 px-4">Tên đơn vị</th>
                      <th className="py-3 px-4">Đơn vị cấp trên</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {unitsList.map((u) => (
                      <tr key={u.unit_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-amber-600 dark:text-amber-400 font-semibold">{u.unit_id}</td>
                        <td className="py-3 px-4 text-slate-900 dark:text-white font-semibold">{u.name}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{u.parent_id || '—'}</td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setGenericFormData({ ...u });
                              setGenericModal({ open: true, type: 'units', item: u });
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-transparent rounded-lg mr-1.5 transition cursor-pointer"
                            title="Sửa đơn vị"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleGenericDelete('units', u.unit_id, u.name)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900/70 dark:text-rose-400 dark:border-transparent rounded-lg transition cursor-pointer"
                            title="Xóa đơn vị"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: DOCTYPES */}
          {activeTab === 'doctypes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-500 dark:text-amber-400" /> Danh Mục Thể Loại Văn Bản
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Quy định các loại văn bản lưu hành trong quân khu</p>
                </div>
                <button
                  onClick={() => {
                    setGenericFormData({ type_id: '', name: '', description: '' });
                    setGenericModal({ open: true, type: 'doctypes', item: null });
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Thêm loại văn bản
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 uppercase text-[11px] border-b border-slate-200 dark:border-slate-800 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Mã Loại</th>
                      <th className="py-3 px-4">Tên loại văn bản</th>
                      <th className="py-3 px-4">Mô tả</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {docTypesList.map((dt) => (
                      <tr key={dt.type_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-amber-600 dark:text-amber-400 font-semibold">{dt.type_id}</td>
                        <td className="py-3 px-4 text-slate-900 dark:text-white font-semibold">{dt.name}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{dt.description || '—'}</td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setGenericFormData({ ...dt });
                              setGenericModal({ open: true, type: 'doctypes', item: dt });
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-transparent rounded-lg mr-1.5 transition cursor-pointer"
                            title="Sửa loại văn bản"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleGenericDelete('doctypes', dt.type_id, dt.name)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900/70 dark:text-rose-400 dark:border-transparent rounded-lg transition cursor-pointer"
                            title="Xóa loại văn bản"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: LEVELS */}
          {activeTab === 'levels' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-amber-500 dark:text-amber-400" /> Cấp Độ Bảo Mật Dữ Liệu
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Phân cấp bí mật nhà nước và quân đội (Cấp 1 - 5)</p>
                </div>
                <button
                  onClick={() => {
                    setGenericFormData({ level_id: 1, code: '', name: '' });
                    setGenericModal({ open: true, type: 'levels', item: null });
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Thêm mức bảo mật
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 uppercase text-[11px] border-b border-slate-200 dark:border-slate-800 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Cấp Số</th>
                      <th className="py-3 px-4">Mã ký hiệu</th>
                      <th className="py-3 px-4">Tên mức độ mật</th>
                      <th className="py-3 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {levelsList.map((lvl) => (
                      <tr key={lvl.level_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-amber-600 dark:text-amber-400 font-bold">Cấp {lvl.level_id}</td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{lvl.code}</td>
                        <td className="py-3 px-4 text-slate-900 dark:text-white font-semibold">{lvl.name}</td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setGenericFormData({ ...lvl });
                              setGenericModal({ open: true, type: 'levels', item: lvl });
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-transparent rounded-lg mr-1.5 transition cursor-pointer"
                            title="Sửa mức bảo mật"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleGenericDelete('levels', lvl.level_id, lvl.name)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900/70 dark:text-rose-400 dark:border-transparent rounded-lg transition cursor-pointer"
                            title="Xóa mức bảo mật"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-amber-500 dark:text-amber-400" /> Nhật Ký Hoạt Động & Kiểm Toán An Ninh
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Giám sát truy cập văn bản và thay đổi hệ thống 24/7</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={logFilterAction}
                    onChange={(e) => setLogFilterAction(e.target.value)}
                    className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500 shadow-sm"
                  >
                    <option value="">Tất cả hành động</option>
                    <option value="VIEW">VIEW (Xem tài liệu)</option>
                    <option value="DOWNLOAD">DOWNLOAD (Tải tệp)</option>
                    <option value="UPLOAD">UPLOAD (Tải lên)</option>
                    <option value="UPDATE">UPDATE (Cập nhật)</option>
                    <option value="DELETE">DELETE (Xóa tài liệu)</option>
                  </select>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      placeholder="Tìm IP, User, Tiêu đề..."
                      className="w-full sm:w-60 pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 shadow-sm"
                    />
                  </div>
                  <button
                    onClick={loadLogs}
                    className="p-2 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl transition cursor-pointer shadow-sm"
                    title="Làm mới"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 uppercase text-[11px] border-b border-slate-200 dark:border-slate-800 font-semibold">
                      <tr>
                        <th className="py-3 px-4">Thời Gian</th>
                        <th className="py-3 px-4">Quân Nhân</th>
                        <th className="py-3 px-4">Hành Động</th>
                        <th className="py-3 px-4">Văn Bản / Đối Tượng</th>
                        <th className="py-3 px-4">Địa Chỉ IP</th>
                        <th className="py-3 px-4">Ghi Chú</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                            Chưa có bản ghi nhật ký phù hợp
                          </td>
                        </tr>
                      ) : (
                        filteredLogs.map((l, idx) => (
                          <tr key={l.log_id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono text-[11px]">
                              {(l.created_at || l.timestamp) ? new Date(l.created_at || l.timestamp || '').toLocaleString('vi-VN') : '—'}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-slate-900 dark:text-white">{l.full_name || l.user_id}</span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono ml-1.5">({l.user_id})</span>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  l.action === 'DOWNLOAD'
                                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-200 dark:border-transparent'
                                    : l.action === 'VIEW'
                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-200 dark:border-transparent'
                                    : l.action === 'UPLOAD'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-200 dark:border-transparent'
                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-200 dark:border-transparent'
                                }`}
                              >
                                {l.action}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300 truncate max-w-xs">{l.doc_title || l.file_id || '—'}</td>
                            <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">{l.ip || '—'}</td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{l.note || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* User Form Modal */}
      <UserFormModal
        open={userModalOpen}
        user={selectedUser}
        units={unitsList}
        securityLevels={levelsList}
        roles={rolesList}
        existingUsers={usersList}
        onClose={() => {
          setUserModalOpen(false);
          setSelectedUser(null);
        }}
        onSave={handleSaveUser}
      />

      {/* User Credentials Modal */}
      <UserCredentialsModal
        open={credModal.open}
        userId={credModal.userId}
        defaultUsername={credModal.username}
        onClose={() => setCredModal({ open: false, userId: '', username: '' })}
        onSuccess={loadUsers}
        onToast={showToast}
      />

      {/* Generic Modal (Roles, Units, DocTypes, Levels) */}
      <AnimatePresence>
        {genericModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl text-xs space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-sm text-white capitalize">
                  {genericModal.item ? 'Chỉnh Sửa' : 'Thêm Mới'} {genericModal.type}
                </h3>
                <button
                  onClick={() => setGenericModal({ open: false, type: null, item: null })}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleGenericSave} className="space-y-3">
                {genericModal.type === 'roles' && (
                  <>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Mã Vai Trò *</label>
                      <input
                        type="text"
                        disabled={Boolean(genericModal.item)}
                        value={genericFormData.role_id || ''}
                        onChange={(e) => setGenericFormData({ ...genericFormData, role_id: e.target.value })}
                        required
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Tên Vai Trò *</label>
                      <input
                        type="text"
                        value={genericFormData.name || ''}
                        onChange={(e) => setGenericFormData({ ...genericFormData, name: e.target.value })}
                        required
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                      />
                    </div>
                  </>
                )}

                {genericModal.type === 'units' && (
                  <>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Mã Đơn Vị *</label>
                      <input
                        type="text"
                        disabled={Boolean(genericModal.item)}
                        value={genericFormData.unit_id || ''}
                        onChange={(e) => setGenericFormData({ ...genericFormData, unit_id: e.target.value })}
                        required
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Tên Đơn Vị *</label>
                      <input
                        type="text"
                        value={genericFormData.name || ''}
                        onChange={(e) => setGenericFormData({ ...genericFormData, name: e.target.value })}
                        required
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Đơn Vị Cấp Trên</label>
                      <input
                        type="text"
                        value={genericFormData.parent_id || ''}
                        onChange={(e) => setGenericFormData({ ...genericFormData, parent_id: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                      />
                    </div>
                  </>
                )}

                {genericModal.type === 'doctypes' && (
                  <>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Mã Loại *</label>
                      <input
                        type="text"
                        disabled={Boolean(genericModal.item)}
                        value={genericFormData.type_id || ''}
                        onChange={(e) => setGenericFormData({ ...genericFormData, type_id: e.target.value })}
                        required
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Tên Loại Văn Bản *</label>
                      <input
                        type="text"
                        value={genericFormData.name || ''}
                        onChange={(e) => setGenericFormData({ ...genericFormData, name: e.target.value })}
                        required
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Mô Tả</label>
                      <input
                        type="text"
                        value={genericFormData.description || ''}
                        onChange={(e) => setGenericFormData({ ...genericFormData, description: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                      />
                    </div>
                  </>
                )}

                {genericModal.type === 'levels' && (
                  <>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Cấp Độ (1 - 5) *</label>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        disabled={Boolean(genericModal.item)}
                        value={genericFormData.level_id || 1}
                        onChange={(e) => setGenericFormData({ ...genericFormData, level_id: Number(e.target.value) })}
                        required
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Mã Ký Hiệu *</label>
                      <input
                        type="text"
                        value={genericFormData.code || ''}
                        onChange={(e) => setGenericFormData({ ...genericFormData, code: e.target.value })}
                        required
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Tên Mức Bảo Mật *</label>
                      <input
                        type="text"
                        value={genericFormData.name || ''}
                        onChange={(e) => setGenericFormData({ ...genericFormData, name: e.target.value })}
                        required
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100"
                      />
                    </div>
                  </>
                )}

                <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setGenericModal({ open: false, type: null, item: null })}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-1 transition"
                  >
                    <Save className="w-3.5 h-3.5" /> Lưu lại
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={deleteConfirm.open}
        title={deleteConfirm.title}
        message={deleteConfirm.message}
        confirmText="Xác nhận xóa"
        confirmVariant="danger"
        onConfirm={deleteConfirm.onConfirm}
        onCancel={() => setDeleteConfirm((prev) => ({ ...prev, open: false }))}
      />

      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast((prev) => ({ ...prev, show: false }))} />
    </div>
  );
};
