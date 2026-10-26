import { TrashPage } from './TrashPage';
import { SessionsPage } from './SessionsPage';
import { useAuth } from '../hooks/useAuth';
import React, { useState, useEffect, useMemo } from 'react';
import { Drawer } from 'antd';
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
  ChevronLeft,
  ChevronRight,
  Award,
  Briefcase,
  UserCheck,
  Monitor,
  ShieldCheck,
  GripVertical,
} from 'lucide-react';
import { useDeviceMode } from '../contexts/DeviceModeContext';
import { Header } from '../components/common/Header';
import { Sidebar } from '../components/common/Sidebar';
import { Toast, ToastState } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { StatCard } from '../components/dashboard/StatCard';
import { DistributionChart } from '../components/dashboard/DistributionChart';
import { UnitTreeTable } from '../components/dashboard/UnitTreeTable';
import { SecurityAuditLog } from '../components/dashboard/SecurityAuditLog';
import { UserTable } from '../components/users/UserTable';
import { UserFormModal } from '../components/users/UserFormModal';
import { UserCredentialsModal } from '../components/users/UserCredentialsModal';
import { AssignRoleModal } from '../components/users/AssignRoleModal';
import { FingerprintEnrollModal } from '../components/users/FingerprintEnrollModal';
import { GrantPermissionModal } from '../components/users/GrantPermissionModal';
import { RolePermissionModal } from '../components/users/RolePermissionModal';

import { dashboardApi } from '../services/dashboardApi';
import { permissionService } from '../services/permissionService';
import { usersApi } from '../services/usersApi';
import { formatFileSize } from '../utils/formatFileSize';
import {
  User,
  AdminStats,
  Role,
  Permission,
  Unit,
  DocumentType,
  SecurityLevel,
  MilitaryRank,
  MilitaryPosition
} from '../types';

const getNextRoleId = (roles: Role[]): string => {
  const existingNums = new Set<number>();
  for (const r of roles) {
    const m = (r.role_id || '').match(/ROL-(\d+)/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > 0) existingNums.add(n);
    }
  }
  let candidate = 1;
  while (existingNums.has(candidate)) candidate++;
  return `ROL-${String(candidate).padStart(2, '0')}`;
};

const getNextRankId = (ranks: MilitaryRank[]): string => {
  const existingNums = new Set<number>();
  for (const r of ranks) {
    const m = (r.rank_id || '').match(/R-(\d+)/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > 0) existingNums.add(n);
    }
  }
  let candidate = 1;
  while (existingNums.has(candidate)) candidate++;
  return `R-${String(candidate).padStart(2, '0')}`;
};

const getNextPositionId = (positions: MilitaryPosition[]): string => {
  const existingNums = new Set<number>();
  for (const p of positions) {
    const m = (p.position_id || '').match(/P-(\d+)/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > 0) existingNums.add(n);
    }
  }
  let candidate = 1;
  while (existingNums.has(candidate)) candidate++;
  return `P-${String(candidate).padStart(2, '0')}`;
};

const ADMIN_NAV_TABS: Array<{ id: string; label: string; icon: any; permission?: string }> = [
  { id: 'overview',    label: 'Tổng quan',     icon: LayoutDashboard, permission: 'SYSTEM_STATS_VIEW' },
  { id: 'users',       label: 'Người dùng',    icon: Users,           permission: 'USER_VIEW' },
  { id: 'roles',       label: 'Vai trò',       icon: KeyRound,        permission: 'ROLE_VIEW' },
  { id: 'permissions', label: 'Quyền',         icon: ShieldAlert,     permission: 'PERMISSION_VIEW' },
  { id: 'units',       label: 'Đơn vị',        icon: Building,        permission: 'UNIT_VIEW' },
  { id: 'doctypes',    label: 'Loại văn bản',  icon: FileText,        permission: 'DOCTYPE_VIEW' },
  { id: 'levels',      label: 'Mức bảo mật',   icon: Shield,          permission: 'SECLEVEL_VIEW' },
  { id: 'ranks',       label: 'Cấp bậc',       icon: Award,           permission: 'RANK_VIEW' },
  { id: 'positions',   label: 'Chức vụ',       icon: Briefcase,       permission: 'POSITION_VIEW' },
  { id: 'logs',        label: 'Nhật ký',       icon: Activity,        permission: 'AUDIT_VIEW' },
  { id: 'sessions',    label: 'Phiên online',  icon: Monitor,         permission: 'SESSION_VIEW' },
  { id: 'trash',       label: 'Thùng rác',     icon: Trash2,          permission: 'DOC_TRASH_VIEW' },
];

// ═══════════════════════════════════════════════════════════
// CONST: Group options + tone options cho form permission
// ═══════════════════════════════════════════════════════════
const PERMISSION_GROUPS = [
  { value: 'DOCUMENT',    label: '📄 Văn bản' },
  { value: 'USER',        label: '👤 Người dùng' },
  { value: 'ROLE',        label: '🔑 Vai trò' },
  { value: 'PERMISSION',  label: '🛡️ Quyền' },
  { value: 'CATALOG',     label: '📚 Danh mục' },
  { value: 'FINGERPRINT', label: '🔒 Sinh trắc' },
  { value: 'AUDIT',       label: '📊 Kiểm toán' },
  { value: 'AI',          label: '🤖 Trợ lý AI' },
  { value: 'SYSTEM',      label: '⚙️ Hệ thống' },
  { value: 'SESSION',     label: '🖥️ Phiên' },
];

const PERMISSION_TONES = [
  { value: 'read',     label: '🟢 Read — Xem / tra cứu (an toàn)' },
  { value: 'write',    label: '🟡 Write / Edit — Ghi / chỉnh sửa (cảnh báo)' },
  { value: 'security', label: '🟣 Security — Bảo mật / phân quyền' },
  { value: 'danger',   label: '🔴 Delete / Danger — Xóa / nguy hiểm (Đỏ Quân Kỳ)' },
];

// Helper ánh xạ màu sắc chuẩn quân đội cho Group Badge
const getPermissionGroupBadge = (groupCode?: string) => {
  const g = (groupCode || '').toUpperCase();
  if (g === 'DOCUMENT') {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
  }
  if (g === 'SYSTEM') {
    return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
  }
  if (g === 'ROLE') {
    return 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30';
  }
  if (g === 'FINGERPRINT') {
    return 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30';
  }
  if (g === 'AUDIT') {
    return 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30';
  }
  return 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30';
};

// Helper khởi tạo form data cho permission (new hoặc edit)
const buildPermissionFormData = (item?: Permission | null, defaultOrder = 0) => {
  if (!item) {
    return {
      permission_id: '',
      code: '',
      description: '',
      group_code: 'DOCUMENT',
      subgroup_key: '',
      subgroup_label: '',
      subgroup_order: 50,
      subgroup_tone: 'read',
      sort_order: defaultOrder,
    };
  }
  return {
    ...item,
    group_code:     (item as any).group_code     || 'DOCUMENT',
    subgroup_key:   (item as any).subgroup_key   || '',
    subgroup_label: (item as any).subgroup_label || '',
    subgroup_order: (item as any).subgroup_order ?? 50,
    subgroup_tone:  (item as any).subgroup_tone  || 'read',
    sort_order:     (item as any).sort_order     ?? 0,
  };
};

export const AdminDashboardPage: React.FC = () => {
  const { deviceMode, orientation, screenWidth } = useDeviceMode();
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Filter tabs theo quyền — ẩn tab user không có permission
  const visibleTabs = useMemo(
    () => ADMIN_NAV_TABS.filter((t) => !t.permission || hasPermission(t.permission)),
    [hasPermission]
  );

  // Đảm bảo activeTab hợp lệ — nếu user đang ở tab không có quyền (VD: bị thu hồi),
  // tự động chuyển về tab đầu tiên họ được phép truy cập.
  useEffect(() => {
    if (visibleTabs.length === 0) return;
    const ids = visibleTabs.map((t) => t.id);
    if (!ids.includes(activeTab)) {
      setActiveTab(ids[0]);
    }
  }, [visibleTabs, activeTab]);

  const isIPadLandscape = deviceMode === 'ipad' && orientation === 'landscape';
  const isIPadPortrait = deviceMode === 'ipad' && orientation === 'portrait';

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  const isPortraitMode = isIPadPortrait || (deviceMode === 'pc' && screenWidth < 1024);
  const sidebarWidthClass = isIPadLandscape
    ? (sidebarCollapsed ? 'w-[68px]' : 'w-[190px]')
    : (sidebarCollapsed ? 'w-[76px]' : 'w-[260px]');

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [overviewRefreshKey, setOverviewRefreshKey] = useState(0);

  const tabStripRef = React.useRef<HTMLDivElement>(null);

  const scrollTabStrip = (direction: 'left' | 'right') => {
    if (tabStripRef.current) {
      tabStripRef.current.scrollBy({
        left: direction === 'left' ? -220 : 220,
        behavior: 'smooth',
      });
    }
  };

  const handleTabStripWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0 && tabStripRef.current) {
      tabStripRef.current.scrollLeft += e.deltaY;
    }
  };

  useEffect(() => {
    if (tabStripRef.current) {
      const activeEl = tabStripRef.current.querySelector<HTMLElement>(`[data-tab-id="${activeTab}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab]);

  // Entities Data
  const [usersList, setUsersList] = useState<User[]>([]);
  const [rolesList, setRolesList] = useState<Role[]>([]);
  const [permsList, setPermsList] = useState<Permission[]>([]);
  const [draggedPermIndex, setDraggedPermIndex] = useState<number | null>(null);
  const [dragOverPermIndex, setDragOverPermIndex] = useState<number | null>(null);
  const [isReorderingPerms, setIsReorderingPerms] = useState<boolean>(false);
  const [unitsList, setUnitsList] = useState<Unit[]>([]);
  const [docTypesList, setDocTypesList] = useState<DocumentType[]>([]);
  const [levelsList, setLevelsList] = useState<SecurityLevel[]>([]);
  const [ranksList, setRanksList] = useState<MilitaryRank[]>([]);
  const [positionsList, setPositionsList] = useState<MilitaryPosition[]>([]);

  // Search & Filters
  const [userSearch, setUserSearch] = useState('');

  // Modals
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [credModal, setCredModal] = useState<{ open: boolean; userId: string; username: string }>({
    open: false,
    userId: '',
    username: ''
  });

  const [assignRoleModal, setAssignRoleModal] = useState<{
    open: boolean;
    selectedRole: Role | null;
  }>({
    open: false,
    selectedRole: null,
  });

  const [fpEnrollModal, setFpEnrollModal] = useState<{ open: boolean; user: User | null }>({
    open: false, user: null,
  });

  const [grantPermModal, setGrantPermModal] = useState<{ open: boolean; user: User | null }>({
    open: false,
    user: null,
  });

    const [rolePermModal, setRolePermModal] = useState<{ open: boolean; role: Role | null }>({
    open: false,
    role: null,
  });

  // Generic Edit Modal for Roles, Units, DocTypes, Levels, Ranks, Positions, Permissions
  const [genericModal, setGenericModal] = useState<{
    open: boolean;
    type: 'roles' | 'units' | 'doctypes' | 'levels' | 'ranks' | 'positions' | 'permissions' | null;
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
      const sorted = [...(data.items || [])].sort((a, b) => {
        const parseNum = (id?: string) => {
          const m = (id || '').match(/USR-(\d+)/i);
          return m ? parseInt(m[1], 10) : 999999;
        };
        return parseNum(a.user_id) - parseNum(b.user_id);
      });
      setUsersList(sorted);
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

  const handleReorderPerms = async (targetIndex: number) => {
    if (draggedPermIndex === null || draggedPermIndex === targetIndex) {
      setDraggedPermIndex(null);
      setDragOverPermIndex(null);
      return;
    }

    const fromIndex = draggedPermIndex;
    setDraggedPermIndex(null);
    setDragOverPermIndex(null);

    const updatedList = [...permsList];
    const [movedItem] = updatedList.splice(fromIndex, 1);
    updatedList.splice(targetIndex, 0, movedItem);

    // Optimistic UI update
    setPermsList(updatedList);
    setIsReorderingPerms(true);

    try {
      const payload = updatedList.map((item, idx) => ({
        permission_id: item.permission_id,
        sort_order: (idx + 1) * 10,
      }));
      await permissionService.reorderPermissions(payload);
      showToast('Đã lưu thứ tự sắp xếp quyền thành công!', 'success');
    } catch (err: any) {
      showToast('Lỗi khi lưu thứ tự quyền: ' + (err.message || 'Thao tác thất bại'), 'error');
      await loadPermissions();
    } finally {
      setIsReorderingPerms(false);
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

  const loadRanks = async () => {
    try {
      const data = await dashboardApi.getRanks();
      setRanksList(data.items || []);
    } catch (err: any) {
      showToast('Lỗi tải cấp bậc: ' + err.message, 'error');
    }
  };

  const loadPositions = async () => {
    try {
      const data = await dashboardApi.getPositions();
      setPositionsList(data.items || []);
    } catch (err: any) {
      showToast('Lỗi tải chức vụ: ' + err.message, 'error');
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
        if (!ranksList.length) loadRanks();
        if (!positionsList.length) loadPositions();
        break;
      case 'roles':
        loadRoles();
        if (!usersList.length) loadUsers();
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
      case 'ranks':
        loadRanks();
        break;
      case 'positions':
        loadPositions();
        break;
      case 'logs':
        break;
      case 'sessions':
        break;
      case 'trash':
        break;
    }
  }, [activeTab]);

  // Save User
  const handleSaveUser = async (userData: Partial<User>) => {
    if (selectedUser?.user_id) {
      await usersApi.updateUser(selectedUser.user_id, userData);
    } else {
      await usersApi.createUser(userData as any);
    }
    await loadUsers();
    showToast(
      selectedUser?.user_id
        ? 'Đã cập nhật thông tin quân nhân'
        : 'Đã tạo quân nhân mới thành công'
    );
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
          await loadUsers();
          showToast(`Đã xóa tài khoản ${u.user_id}`);
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
      } else if (type === 'ranks') {
        if (item) {
          await dashboardApi.updateRank(item.rank_id, genericFormData);
        } else {
          await dashboardApi.createRank(genericFormData);
        }
        loadRanks();
      } else if (type === 'positions') {
        if (item) {
          await dashboardApi.updatePosition(item.position_id, genericFormData);
        } else {
          await dashboardApi.createPosition(genericFormData);
        }
        loadPositions();
      } else if (type === 'permissions') {
        // ══════════════════════════════════════════════════
        // PERMISSION: gồm 4 cột subgroup_* + group_code
        // ══════════════════════════════════════════════════
        const payload = {
          permission_id:  String(genericFormData.permission_id || '').trim(),
          code:           String(genericFormData.code || '').trim().toUpperCase(),
          description:    genericFormData.description?.trim() || null,
          group_code:     genericFormData.group_code || 'SYSTEM',
          subgroup_key:   genericFormData.subgroup_key?.trim()   || null,
          subgroup_label: genericFormData.subgroup_label?.trim() || null,
          subgroup_order: Number(genericFormData.subgroup_order) || 0,
          subgroup_tone:  genericFormData.subgroup_tone || 'read',
          sort_order:     Number(genericFormData.sort_order) || 0,
        };

        const api = dashboardApi as any;
        if (item) {
          if (typeof api.updatePermission !== 'function') {
            showToast(
              'Backend chưa hỗ trợ sửa quyền — cần thêm PUT /api/admin/permissions/:id',
              'error'
            );
            return;
          }
          // Không cho sửa permission_id / code (đã disable ở form)
          const { permission_id, code, ...updateBody } = payload;
          await api.updatePermission(item.permission_id, updateBody);
        } else {
          if (typeof api.createPermission !== 'function') {
            showToast(
              'Thiếu dashboardApi.createPermission — kiểm tra services/dashboardApi.ts',
              'error'
            );
            return;
          }
          if (!payload.permission_id) {
            showToast('Thiếu Permission ID', 'error');
            return;
          }
          if (!payload.code) {
            showToast('Thiếu mã code', 'error');
            return;
          }
          await api.createPermission(payload);
        }
        loadPermissions();
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
            showToast(`Đã xóa vai trò ${id}`);
          } else if (type === 'permissions') {
            await dashboardApi.deletePermission(String(id));
            loadPermissions();
            showToast(`Đã xóa quyền ${id}`);
          } else if (type === 'units') {
            await dashboardApi.deleteUnit(String(id));
            loadUnits();
            showToast(`Đã xóa đơn vị ${id}`);
          } else if (type === 'doctypes') {
            await dashboardApi.deleteDocumentType(String(id));
            loadDocTypes();
            showToast(`Đã xóa loại văn bản ${id}`);
          } else if (type === 'levels') {
            await dashboardApi.deleteSecurityLevel(Number(id));
            loadLevels();
            showToast(`Đã xóa mức bảo mật ${id}`);
          } else if (type === 'ranks') {
            const res: any = await dashboardApi.deleteRank(String(id));
            loadRanks();
            if (res?.soft_deleted) {
              showToast(
                `Đã ẩn cấp bậc "${name}" khỏi dropdown (${res.note || 'đang được quân nhân sử dụng'})`,
                'info',
              );
            } else {
              showToast(`Đã xóa cấp bậc ${id}`);
            }
          } else if (type === 'positions') {
            const res: any = await dashboardApi.deletePosition(String(id));
            loadPositions();
            if (res?.soft_deleted) {
              showToast(
                `Đã ẩn chức vụ "${name}" khỏi dropdown (${res.note || 'đang được quân nhân sử dụng'})`,
                'info',
              );
            } else {
              showToast(`Đã xóa chức vụ ${id}`);
            }
          }
        } catch (err: any) {
          showToast('Lỗi: ' + err.message, 'error');
        } finally {
          setDeleteConfirm((prev) => ({ ...prev, open: false }));
        }
      },
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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-[#090e17] text-slate-900 dark:text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-900 transition-colors duration-200">
      {/* Header */}
      <Header
        activeNav="admin"
        title="Trường Quân Sự Quân Khu 7"
        subtitle="Trung tâm dữ liệu số"
        onToggleMobileMenu={() => setSidebarOpen(true)}
      />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Fixed Desktop Sidebar hoặc iPad Landscape Dock Sidebar (190px / 68px) */}
        {!isPortraitMode && (
          <aside
            className={`flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md overflow-x-hidden transition-all duration-300 ${sidebarWidthClass}`}
          >
            <Sidebar
              activeTab={activeTab as any}
              onTabChange={(id) => {
                setActiveTab(id);
                setSidebarOpen(false);
              }}
              collapsed={sidebarCollapsed}
              onToggleCollapse={toggleSidebarCollapsed}
            />
          </aside>
        )}

        {/* Drawer trượt khi ở chế độ Portrait hoặc màn hình nhỏ < 1024px */}
        {isPortraitMode && (
          <Drawer
            placement="left"
            width={270}
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            styles={{ body: { padding: 0 } }}
            className="qk7-sidebar-drawer"
          >
            <Sidebar
              activeTab={activeTab as any}
              onTabChange={(id) => {
                setActiveTab(id);
                setSidebarOpen(false);
              }}
              onClose={() => setSidebarOpen(false)}
              collapsed={false}
            />
          </Drawer>
        )}

        {/* Content Area */}
        <main className="flex-1 min-w-0 overflow-y-auto p-3.5 sm:p-5 lg:p-6 xl:p-8 bg-slate-50 dark:bg-slate-950/60 space-y-5">
          {/* Mobile / iPad Portrait Menu Bar & Swipeable Tab Strip — Chuyển tab 1 chạm, không che dữ liệu */}
          {isPortraitMode && (
            <div className="flex items-center gap-1.5 sm:gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800/80 select-none">

              {/* Nút cuộn danh mục sang trái trên desktop */}
              <button
                type="button"
                onClick={() => scrollTabStrip('left')}
                className="shrink-0 p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400 transition cursor-pointer"
                title="Cuộn danh mục sang trái"
                aria-label="Cuộn sang trái"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Thanh Tab Ngang Cuộn Cảm Ứng & Lăn Bánh Xe Chuột — dùng visibleTabs (đã filter theo quyền) */}
              <div
                ref={tabStripRef}
                onWheel={handleTabStripWheel}
                className="flex-1 flex overflow-x-auto no-scrollbar gap-1.5 py-0.5 scroll-smooth"
              >
                {visibleTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      data-tab-id={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-[#166534] text-white shadow-xs dark:bg-emerald-600/25 dark:text-emerald-300 dark:border dark:border-emerald-500/40'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Nút cuộn danh mục sang phải trên desktop */}
              <button
                type="button"
                onClick={() => scrollTabStrip('right')}
                className="shrink-0 p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400 transition cursor-pointer"
                title="Cuộn danh mục sang phải"
                aria-label="Cuộn sang phải"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <LayoutDashboard className="w-5 h-5 text-amber-500 dark:text-amber-400" /> Tổng Quan Hệ Thống
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Thống kê dữ liệu hoạt động thời gian thực</p>
                </div>
                <button
                  onClick={async () => {
                    setOverviewRefreshKey((prev) => prev + 1);
                    await loadStats();
                    showToast('Đã làm mới dữ liệu tổng quan!', 'success');
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0"
                >
                  <RotateCw className="w-3.5 h-3.5" /> Làm mới
                </button>
              </div>

              {/* KPI Cards — iPad Landscape 4 cột, iPad Portrait 2x2, PC 4 cột */}
              <div
                className={
                  isIPadLandscape
                    ? 'grid grid-cols-4 gap-3'
                    : isIPadPortrait
                    ? 'grid grid-cols-2 gap-3'
                    : 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4'
                }
              >
                <StatCard
                  label="Quân nhân & Người dùng"
                  value={stats?.users ?? '—'}
                  icon={<Users className="w-6 h-6" />}
                  color="blue"
                  subtext="Đã kích hoạt trên hệ thống"
                  refreshKey={overviewRefreshKey}
                />
                <StatCard
                  label="Văn bản & Tài liệu"
                  value={stats?.documents ?? '—'}
                  icon={<FileCheck className="w-6 h-6" />}
                  color="emerald"
                  subtext="Lưu trữ trong kho số"
                  delay={0.05}
                  refreshKey={overviewRefreshKey}
                />
                <StatCard
                  label="Tổng dung lượng tệp"
                  value={stats ? formatFileSize(stats.totalSize) : '—'}
                  icon={<HardDrive className="w-6 h-6" />}
                  color="amber"
                  subtext="Ổ đĩa dữ liệu an toàn"
                  delay={0.1}
                  refreshKey={overviewRefreshKey}
                />
                <StatCard
                  label="Truy cập nhật ký 24h"
                  value={stats?.logs24h ?? '—'}
                  icon={<History className="w-6 h-6" />}
                  color="red"
                  subtext="Bản ghi kiểm toán an ninh"
                  delay={0.15}
                  refreshKey={overviewRefreshKey}
                />
              </div>

              {/* Distribution Charts — iPad Landscape 2 cột song song, iPad Portrait dọc */}
              <div
                className={
                  isIPadLandscape
                    ? 'grid grid-cols-2 gap-4'
                    : isIPadPortrait
                    ? 'grid grid-cols-1 gap-4'
                    : 'grid grid-cols-1 xl:grid-cols-2 gap-4'
                }
              >
                <DistributionChart
                  title="Phân Bố Tài Liệu Theo Mức Bảo Mật"
                  icon={<Shield className="w-4 h-4 text-amber-500 dark:text-amber-400" />}
                  barColor="amber"
                  items={(stats?.byLevel || []).map((x) => ({
                    id: x.lv,
                    label: x.lvName,
                    count: x.n,
                  }))}
                  refreshKey={overviewRefreshKey}
                />
                <DistributionChart
                  title="Phân Bố Tài Liệu Theo Thể Loại Văn Bản"
                  icon={<FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                  barColor="emerald"
                  items={(stats?.byType || []).map((t) => ({
                    id: t.id,
                    label: t.name,
                    count: t.n,
                  }))}
                  refreshKey={overviewRefreshKey}
                />
              </div>
            </div>
          )}

          {/* TAB: USERS */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4">
                <div className="shrink-0">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 whitespace-nowrap">
                    <Users className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0" />
                    <span>Quản Lý Danh Sách Quân Nhân</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap">
                    Tổng số: {usersList.length} quân nhân • Phân quyền bảo mật theo cấp bậc
                  </p>
                </div>
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                  <div className="relative flex-1 sm:flex-initial">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Tìm theo mã, tên, đơn vị..."
                      className="w-full sm:w-64 pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition shadow-2xs"
                    />
                    {userSearch && (
                      <button
                        onClick={() => setUserSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
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
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow-xs whitespace-nowrap"
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
                onEnrollFingerprint={(u) => setFpEnrollModal({ open: true, user: u })}
                onGrantPermission={(u) => setGrantPermModal({ open: true, user: u })}
                onViewPermissions={(u) => setGrantPermModal({ open: true, user: u })}
              />
            </div>
          )}

          {/* TAB: ROLES */}
          {activeTab === 'roles' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                    <span>Quản Lý Vai Trò</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Phân quyền vai trò chức năng hệ thống • Tổng số:{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{rolesList.length}</span> vai trò
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      loadUsers();
                      setAssignRoleModal({ open: true, selectedRole: null });
                    }}
                    className="px-3.5 py-2 bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] hover:from-[#166534] hover:to-[#15803d] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-950/20 border border-amber-500/25"
                  >
                    <UserCheck className="w-4 h-4" /> Gán vai trò
                  </button>
                  <button
                    onClick={() => {
                      setGenericFormData({ role_id: getNextRoleId(rolesList), name: '' });
                      setGenericModal({ open: true, type: 'roles', item: null });
                    }}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Thêm vai trò
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 min-w-[500px]">
                    <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 uppercase text-[11px] border-b border-slate-200 dark:border-slate-800 font-semibold">
                      <tr>
                        <th className="py-3 px-4">Mã Role</th>
                        <th className="py-3 px-4">Tên vai trò</th>
                        <th className="py-3 px-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    {/* ✅ FIX #3 — tbody Roles đã vá */}
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {rolesList.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-12 text-center text-slate-400 dark:text-slate-500">
                            <div className="flex flex-col items-center gap-2">
                              <KeyRound className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                              <span className="text-sm font-semibold">Chưa có vai trò nào</span>
                              <span className="text-xs">Bấm "Thêm vai trò" để tạo vai trò đầu tiên.</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        rolesList.map((r) => (
                          <tr key={r.role_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-mono text-xs px-2.5 py-1 rounded-md text-amber-800 bg-amber-500/10 border border-amber-600/25 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/25 font-bold tracking-wider inline-block">
                                {r.role_id}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-900 dark:text-white font-semibold">{r.name}</td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              {r.role_id === 'ROL-01' ? (
                                <button
                                  disabled
                                  className="p-1.5 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 rounded-lg mr-1.5 cursor-not-allowed opacity-60"
                                  title="Role Admin bypass toàn quyền — không cần phân quyền"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => setRolePermModal({ open: true, role: r })}
                                  className="p-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 dark:text-amber-300 dark:border-amber-500/30 rounded-lg mr-1.5 transition cursor-pointer"
                                  title="Phân quyền cho vai trò"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                </button>
                              )}
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
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PERMISSIONS */}
          {activeTab === 'permissions' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-amber-500 dark:text-amber-400" /> Danh Sách Quyền
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Các quyền hạn truy xuất trong hệ thống • Tổng số:{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{permsList.length}</span> quyền
                    {isReorderingPerms && (
                      <span className="ml-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-pulse">
                        • Đang lưu thứ tự mới...
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={async () => {
                      await loadPermissions();
                      showToast('Đã làm mới danh sách quyền!', 'success');
                    }}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                    title="Làm mới danh sách quyền"
                  >
                    <RotateCw className="w-3.5 h-3.5" /> Làm mới
                  </button>
                  <button
                    onClick={() => {
                      const nextOrder = (permsList.length + 1) * 10;
                      setGenericFormData(buildPermissionFormData(null, nextOrder));
                      setGenericModal({ open: true, type: 'permissions', item: null });
                    }}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95"
                    title="Thêm quyền mới vào hệ thống"
                  >
                    <Plus className="w-4 h-4" /> Thêm quyền
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900/90 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 min-w-[700px]">
                    <thead className="bg-slate-50 dark:bg-slate-900/95 text-slate-600 dark:text-slate-400 uppercase text-[11px] border-b border-slate-200 dark:border-slate-800 font-semibold tracking-wider">
                      <tr>
                        <th className="py-3 px-3 text-center w-12" title="Kéo thả để sắp xếp thứ tự">
                          <GripVertical className="w-4 h-4 mx-auto text-slate-400" />
                        </th>
                        <th className="py-3 px-4 whitespace-nowrap">Mã Quyền</th>
                        <th className="py-3 px-4 whitespace-nowrap">Tên quyền</th>
                        <th className="py-3 px-4">Mô tả</th>
                        <th className="py-3 px-4 whitespace-nowrap">Nhóm</th>
                        <th className="py-3 px-4 text-right whitespace-nowrap">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {permsList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                            Chưa có quyền nào
                          </td>
                        </tr>
                      ) : (
                        permsList.map((p, index) => {
                          const isBeingDragged = draggedPermIndex === index;
                          const isOver = dragOverPermIndex === index;

                          return (
                            <tr
                              key={p.permission_id}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                if (dragOverPermIndex !== index) {
                                  setDragOverPermIndex(index);
                                }
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                handleReorderPerms(index);
                              }}
                              className={`transition-colors duration-150 ${
                                isBeingDragged
                                  ? 'opacity-30 bg-emerald-500/10 dark:bg-emerald-500/20'
                                  : isOver
                                  ? 'border-t-2 border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                              }`}
                            >
                              {/* 0. Cột Thao tác Kéo Thả (Drag Handle) */}
                              <td className="py-3 px-3 text-center w-12">
                                <div
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', String(index));
                                    e.dataTransfer.effectAllowed = 'move';
                                    setDraggedPermIndex(index);
                                  }}
                                  onDragEnd={() => {
                                    setDraggedPermIndex(null);
                                    setDragOverPermIndex(null);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
                                  title="Bấm giữ và kéo thả để đổi thứ tự quyền"
                                >
                                  <GripVertical className="w-4 h-4" />
                                </div>
                              </td>

                              {/* 1. Mã Quyền: font-mono tabular-nums text-sm font-semibold text-amber-500 */}
                              <td className="py-3 px-4 font-mono tabular-nums text-sm text-amber-600 dark:text-amber-400 font-semibold whitespace-nowrap">
                                {p.permission_id}
                              </td>

                              {/* 2. Tên quyền (Mã code UPPER_SNAKE): font-mono text-sm text-amber-400 font-medium */}
                              <td className="py-3 px-4 font-mono text-sm text-slate-800 dark:text-amber-400 font-medium whitespace-nowrap">
                                {p.code || p.name || p.permission_id}
                              </td>

                              {/* 3. Mô tả */}
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                                {p.description || '—'}
                              </td>

                              {/* 4. Nhóm (Group Badge với màu sắc động chuẩn quân đội) */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-xs ${getPermissionGroupBadge(
                                    (p as any).group_code
                                  )}`}
                                >
                                  {(p as any).group_code || 'SYSTEM'}
                                </span>
                              </td>

                              {/* 5. Cột Thao tác */}
                              <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setGenericFormData(buildPermissionFormData(p));
                                    setGenericModal({ open: true, type: 'permissions', item: p });
                                  }}
                                  className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-transparent rounded-lg transition cursor-pointer shadow-xs active:scale-95"
                                  title="Chỉnh sửa quyền này"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleGenericDelete('permissions', p.permission_id, p.name || p.code || p.permission_id)
                                  }
                                  className="p-1.5 border border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/20 rounded-lg transition cursor-pointer shadow-xs active:scale-95"
                                  title="Xóa quyền này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: UNITS */}
          {activeTab === 'units' && (
            <UnitTreeTable
              units={unitsList}
              onAddRoot={() => {
                setGenericFormData({ unit_id: '', name: '', parent_id: '' });
                setGenericModal({ open: true, type: 'units', item: null });
              }}
              onAddChild={(parentUnit) => {
                setGenericFormData({ unit_id: '', name: '', parent_id: parentUnit.unit_id });
                setGenericModal({ open: true, type: 'units', item: null });
              }}
              onEdit={(u) => {
                setGenericFormData({ ...u });
                setGenericModal({ open: true, type: 'units', item: u });
              }}
              onDelete={(u) => handleGenericDelete('units', u.unit_id, u.name)}
              onToast={(msg, type) => showToast(msg, type)}
            />
          )}

          {/* TAB: DOCTYPES */}
          {activeTab === 'doctypes' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" /> Thêm loại văn bản
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 min-w-[560px]">
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
                          <td className="py-3 px-4 font-mono tabular-nums text-amber-600 dark:text-amber-400 font-semibold">{dt.type_id}</td>
                          <td className="py-3 px-4 text-slate-900 dark:text-white font-semibold">{dt.name}</td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{dt.description || '—'}</td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => {
                                setGenericFormData({ ...dt });
                                setGenericModal({ open: true, type: 'doctypes', item: dt });
                              }}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-transparent rounded-lg mr-1.5 transition-all cursor-pointer btn-tactile active:scale-95"
                              title="Sửa loại văn bản"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleGenericDelete('doctypes', dt.type_id, dt.name)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900/70 dark:text-rose-400 dark:border-transparent rounded-lg transition-all cursor-pointer btn-tactile active:scale-95"
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
            </div>
          )}

          {/* TAB: LEVELS */}
          {activeTab === 'levels' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" /> Thêm mức bảo mật
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 min-w-[500px]">
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
                          <td className="py-3 px-4 font-mono tabular-nums text-amber-600 dark:text-amber-400 font-bold">Cấp {lvl.level_id}</td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-mono tabular-nums">{lvl.code}</td>
                          <td className="py-3 px-4 text-slate-900 dark:text-white font-semibold">{lvl.name}</td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => {
                                setGenericFormData({ ...lvl });
                                setGenericModal({ open: true, type: 'levels', item: lvl });
                              }}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-transparent rounded-lg mr-1.5 transition-all cursor-pointer btn-tactile active:scale-95"
                              title="Sửa mức bảo mật"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleGenericDelete('levels', lvl.level_id, lvl.name)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900/70 dark:text-rose-400 dark:border-transparent rounded-lg transition-all cursor-pointer btn-tactile active:scale-95"
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
            </div>
          )}

          {/* TAB: RANKS */}
          {activeTab === 'ranks' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500 dark:text-amber-400" /> Danh Mục Cấp Bậc Quân Hàm
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Số thứ tự nhỏ hiển thị trước trong dropdown
                  </p>
                </div>
                <button
                  onClick={() => {
                    setGenericFormData({ rank_id: getNextRankId(ranksList), name: '', sort_order: ranksList.length + 1 });
                    setGenericModal({ open: true, type: 'ranks', item: null });
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" /> Thêm cấp bậc
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 min-w-[560px]">
                    <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 uppercase text-[11px] border-b border-slate-200 dark:border-slate-800 font-semibold">
                      <tr>
                        <th className="py-3 px-4">Mã</th>
                        <th className="py-3 px-4">Tên cấp bậc</th>
                        <th className="py-3 px-4">Thứ tự</th>
                        <th className="py-3 px-4">Trạng thái</th>
                        <th className="py-3 px-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {ranksList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400 dark:text-slate-500">
                            Chưa có cấp bậc nào
                          </td>
                        </tr>
                      ) : (
                        ranksList.map((r) => (
                          <tr key={r.rank_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 font-mono tabular-nums text-amber-600 dark:text-amber-400 font-semibold">{r.rank_id}</td>
                            <td className="py-3 px-4 text-slate-900 dark:text-white font-semibold">{r.name}</td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono tabular-nums">{r.sort_order ?? 0}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                  r.active !== false
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-200 dark:border-transparent'
                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-transparent'
                                }`}
                              >
                                {r.active !== false ? 'Đang dùng' : 'Đã ẩn'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <button
                                onClick={() => {
                                  setGenericFormData({ ...r });
                                  setGenericModal({ open: true, type: 'ranks', item: r });
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-transparent rounded-lg mr-1.5 transition-all cursor-pointer btn-tactile active:scale-95"
                                title="Sửa cấp bậc"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleGenericDelete('ranks', r.rank_id, r.name)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900/70 dark:text-rose-400 dark:border-transparent rounded-lg transition-all cursor-pointer btn-tactile active:scale-95"
                                title="Xóa cấp bậc"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: POSITIONS */}
          {activeTab === 'positions' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-amber-500 dark:text-amber-400" /> Danh Mục Chức Vụ
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Số thứ tự nhỏ hiển thị trước trong dropdown
                  </p>
                </div>
                <button
                  onClick={() => {
                    setGenericFormData({ position_id: getNextPositionId(positionsList), name: '', sort_order: positionsList.length + 1 });
                    setGenericModal({ open: true, type: 'positions', item: null });
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" /> Thêm chức vụ
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 min-w-[560px]">
                    <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 uppercase text-[11px] border-b border-slate-200 dark:border-slate-800 font-semibold">
                      <tr>
                        <th className="py-3 px-4">Mã</th>
                        <th className="py-3 px-4">Tên chức vụ</th>
                        <th className="py-3 px-4">Thứ tự</th>
                        <th className="py-3 px-4">Trạng thái</th>
                        <th className="py-3 px-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {positionsList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400 dark:text-slate-500">
                            Chưa có chức vụ nào
                          </td>
                        </tr>
                      ) : (
                        positionsList.map((p) => (
                          <tr key={p.position_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 font-mono tabular-nums text-amber-600 dark:text-amber-400 font-semibold">{p.position_id}</td>
                            <td className="py-3 px-4 text-slate-900 dark:text-white font-semibold">{p.name}</td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono tabular-nums">{p.sort_order ?? 0}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                  p.active !== false
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-200 dark:border-transparent'
                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-transparent'
                                }`}
                              >
                                {p.active !== false ? 'Đang dùng' : 'Đã ẩn'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <button
                                onClick={() => {
                                  setGenericFormData({ ...p });
                                  setGenericModal({ open: true, type: 'positions', item: p });
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-transparent rounded-lg mr-1.5 transition-all cursor-pointer btn-tactile active:scale-95"
                                title="Sửa chức vụ"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleGenericDelete('positions', p.position_id, p.name)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900/70 dark:text-rose-400 dark:border-transparent rounded-lg transition-all cursor-pointer btn-tactile active:scale-95"
                                title="Xóa chức vụ"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: LOGS */}
          {activeTab === 'logs' && (
            <SecurityAuditLog showToast={showToast} />
          )}
          {activeTab === 'sessions' && <SessionsPage embedded />}
          {activeTab === 'trash' && <TrashPage embedded />}
        </main>
      </div>

      {/* User Form Modal */}
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

      {/* User Credentials Modal */}
      <UserCredentialsModal
        open={credModal.open}
        userId={credModal.userId}
        defaultUsername={credModal.username}
        onClose={() => setCredModal({ open: false, userId: '', username: '' })}
        onSuccess={loadUsers}
        onToast={showToast}
      />

      {/* Assign Role Modal */}
      <AssignRoleModal
        open={assignRoleModal.open}
        roles={rolesList}
        users={usersList}
        targetRole={assignRoleModal.selectedRole}
        onClose={() => setAssignRoleModal({ open: false, selectedRole: null })}
        onRefresh={loadUsers}
        onToast={showToast}
      />

      {fpEnrollModal.open && fpEnrollModal.user && (
        <FingerprintEnrollModal
          open={fpEnrollModal.open}
          userId={fpEnrollModal.user.user_id}
          userName={fpEnrollModal.user.full_name}
          hasFingerprint={fpEnrollModal.user.has_fingerprint}
          onSuccess={() => {
            const name = fpEnrollModal.user?.full_name;
            setFpEnrollModal({ open: false, user: null });
            showToast(`Đã lưu dữ liệu vân tay cho ${name}`, 'success');
            loadUsers();
          }}
          onCancel={() => setFpEnrollModal({ open: false, user: null })}
        />
      )}

      {/* Generic Modal (Roles, Units, DocTypes, Levels, Ranks, Positions, Permissions) */}
      <AnimatePresence>
        {genericModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`bg-white dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl w-full ${
                genericModal.type === 'permissions' ? 'max-w-2xl' : 'max-w-md'
              } p-6 shadow-2xl text-xs space-y-4`}
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {genericModal.item ? 'Chỉnh Sửa' : 'Thêm Mới'}{' '}
                  {genericModal.type === 'units'
                    ? 'Đơn Vị'
                    : genericModal.type === 'roles'
                    ? 'Vai Trò'
                    : genericModal.type === 'doctypes'
                    ? 'Loại Văn Bản'
                    : genericModal.type === 'levels'
                    ? 'Mức Bảo Mật'
                    : genericModal.type === 'ranks'
                    ? 'Cấp Bậc'
                    : genericModal.type === 'positions'
                    ? 'Chức Vụ'
                    : genericModal.type === 'permissions'
                    ? 'Quyền (Permission)'
                    : genericModal.type}
                </h3>
                <button
                  onClick={() => setGenericModal({ open: false, type: null, item: null })}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleGenericSave} className="space-y-3">
                <div className="max-h-[65vh] overflow-y-auto pr-1 space-y-3">

                  {genericModal.type === 'roles' && (
                    <>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Mã Vai Trò (Tự động)</label>
                        <input
                          type="text"
                          readOnly
                          disabled
                          value={genericFormData.role_id || ''}
                          placeholder="VD: ROL-07"
                          className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 font-mono cursor-not-allowed opacity-80"
                          title="Mã vai trò được hệ thống tự động sinh theo thứ tự"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Tên Vai Trò *</label>
                        <input
                          type="text"
                          value={genericFormData.name || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, name: e.target.value })}
                          required
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
                        />
                      </div>
                    </>
                  )}

                  {genericModal.type === 'units' && (
                    <>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-sm">Mã Đơn Vị *</label>
                        <input
                          type="text"
                          disabled={Boolean(genericModal.item)}
                          value={genericFormData.unit_id || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, unit_id: e.target.value })}
                          required
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 disabled:opacity-50 text-sm font-mono font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-sm">Tên Đơn Vị *</label>
                        <input
                          type="text"
                          value={genericFormData.name || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, name: e.target.value })}
                          required
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-sm font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-sm">Đơn Vị Cấp Trên</label>
                        <select
                          value={genericFormData.parent_id || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, parent_id: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 font-medium text-sm cursor-pointer"
                        >
                          <option value="">Cấp cao nhất</option>
                          {[...unitsList]
                            .filter((u) => !genericModal.item || u.unit_id !== genericModal.item.unit_id)
                            .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
                            .map((u) => (
                              <option key={u.unit_id} value={u.unit_id}>
                                {u.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </>
                  )}

                  {genericModal.type === 'doctypes' && (
                    <>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Mã Loại *</label>
                        <input
                          type="text"
                          disabled={Boolean(genericModal.item)}
                          value={genericFormData.type_id || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, type_id: e.target.value })}
                          required
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 disabled:opacity-50 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Tên Loại Văn Bản *</label>
                        <input
                          type="text"
                          value={genericFormData.name || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, name: e.target.value })}
                          required
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Mô Tả</label>
                        <input
                          type="text"
                          value={genericFormData.description || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, description: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
                        />
                      </div>
                    </>
                  )}

                  {genericModal.type === 'levels' && (
                    <>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Cấp Độ (1 - 5) *</label>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          disabled={Boolean(genericModal.item)}
                          value={genericFormData.level_id || 1}
                          onChange={(e) => setGenericFormData({ ...genericFormData, level_id: Number(e.target.value) })}
                          required
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 disabled:opacity-50 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Mã Ký Hiệu *</label>
                        <input
                          type="text"
                          value={genericFormData.code || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, code: e.target.value })}
                          required
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Tên Mức Bảo Mật *</label>
                        <input
                          type="text"
                          value={genericFormData.name || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, name: e.target.value })}
                          required
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
                        />
                      </div>
                    </>
                  )}

                  {genericModal.type === 'ranks' && (
                    <>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Mã Cấp Bậc (Tự động)</label>
                        <input
                          type="text"
                          readOnly
                          disabled
                          value={genericFormData.rank_id || ''}
                          placeholder="VD: R-21"
                          className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 font-mono cursor-not-allowed opacity-80"
                          title="Mã cấp bậc được hệ thống tự động sinh theo thứ tự"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Tên Cấp Bậc *</label>
                        <input
                          type="text"
                          value={genericFormData.name || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, name: e.target.value })}
                          placeholder="VD: Trung sĩ QNCN"
                          required
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Thứ tự</label>
                        <input
                          type="number"
                          value={genericFormData.sort_order ?? 0}
                          onChange={(e) => setGenericFormData({ ...genericFormData, sort_order: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
                        />
                      </div>
                      {genericModal.item && (
                        <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold">
                          <input
                            type="checkbox"
                            checked={genericFormData.active !== false}
                            onChange={(e) => setGenericFormData({ ...genericFormData, active: e.target.checked })}
                          />
                          <span>Đang kích hoạt</span>
                        </label>
                      )}
                    </>
                  )}

                  {genericModal.type === 'positions' && (
                    <>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Mã Chức Vụ (Tự động)</label>
                        <input
                          type="text"
                          readOnly
                          disabled
                          value={genericFormData.position_id || ''}
                          placeholder="VD: P-19"
                          className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 font-mono cursor-not-allowed opacity-80"
                          title="Mã chức vụ được hệ thống tự động sinh theo thứ tự"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Tên Chức Vụ *</label>
                        <input
                          type="text"
                          value={genericFormData.name || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, name: e.target.value })}
                          placeholder="VD: Phó phòng Kỹ thuật"
                          required
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Thứ tự</label>
                        <input
                          type="number"
                          value={genericFormData.sort_order ?? 0}
                          onChange={(e) => setGenericFormData({ ...genericFormData, sort_order: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
                        />
                      </div>
                      {genericModal.item && (
                        <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold">
                          <input
                            type="checkbox"
                            checked={genericFormData.active !== false}
                            onChange={(e) => setGenericFormData({ ...genericFormData, active: e.target.checked })}
                          />
                          <span>Đang kích hoạt</span>
                        </label>
                      )}
                    </>
                  )}

                  {genericModal.type === 'permissions' && (
                    <>
                      {/* ─── 1. Cơ bản ─── */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                            Mã Permission ID *
                          </label>
                          <input
                            type="text"
                            value={genericFormData.permission_id || ''}
                            onChange={(e) => setGenericFormData({ ...genericFormData, permission_id: e.target.value })}
                            disabled={Boolean(genericModal.item)}
                            placeholder="PERM-DOC-10"
                            required
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono disabled:opacity-50 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                            Mã code (UPPER_SNAKE) *
                          </label>
                          <input
                            type="text"
                            value={genericFormData.code || ''}
                            onChange={(e) =>
                              setGenericFormData({ ...genericFormData, code: e.target.value.toUpperCase() })
                            }
                            disabled={Boolean(genericModal.item)}
                            placeholder="DOC_EXPORT"
                            required
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono disabled:opacity-50 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Mô tả</label>
                        <input
                          type="text"
                          value={genericFormData.description || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, description: e.target.value })}
                          placeholder="Xuất văn bản ra PDF..."
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                          Nhóm (group_code) *
                        </label>
                        <select
                          value={genericFormData.group_code || 'DOCUMENT'}
                          onChange={(e) => setGenericFormData({ ...genericFormData, group_code: e.target.value })}
                          required
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 cursor-pointer focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
                        >
                          {PERMISSION_GROUPS.map((g) => (
                            <option key={g.value} value={g.value}>{g.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* ─── 2. Phân loại con (Subgroup) ─── */}
                      <fieldset className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl p-3.5 space-y-3">
                        <legend className="px-2 text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                          Phân loại con (Subgroup)
                        </legend>

                        <div>
                          <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                            Subgroup key
                          </label>
                          <input
                            type="text"
                            value={genericFormData.subgroup_key || ''}
                            onChange={(e) => setGenericFormData({ ...genericFormData, subgroup_key: e.target.value })}
                            placeholder="doc-view, doc-edit, doc-danger..."
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                          />
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                            Dùng chung với quyền khác trong cùng nhóm. VD: <code className="font-mono text-amber-500">doc-view</code>
                          </p>
                        </div>

                        <div>
                          <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                            Nhãn hiển thị
                          </label>
                          <input
                            type="text"
                            value={genericFormData.subgroup_label || ''}
                            onChange={(e) => setGenericFormData({ ...genericFormData, subgroup_label: e.target.value })}
                            placeholder="Xem & Tra cứu"
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                              Thứ tự trong nhóm
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={999}
                              value={genericFormData.subgroup_order ?? 50}
                              onChange={(e) =>
                                setGenericFormData({ ...genericFormData, subgroup_order: Number(e.target.value) })
                              }
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                            />
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              10 = đầu, 99 = cuối
                            </p>
                          </div>

                          <div>
                            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                              Mức độ nguy hiểm (tone)
                            </label>
                            <select
                              value={genericFormData.subgroup_tone || 'read'}
                              onChange={(e) => setGenericFormData({ ...genericFormData, subgroup_tone: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 cursor-pointer focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                            >
                              {PERMISSION_TONES.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </fieldset>
                    </>
                  )}

                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setGenericModal({ open: false, type: null, item: null })}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-transparent rounded-xl transition font-medium"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm"
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

      <GrantPermissionModal
        open={grantPermModal.open}
        user={grantPermModal.user}
        onClose={() => setGrantPermModal({ open: false, user: null })}
        onSaved={loadUsers}
        onToast={showToast}
      />

      <RolePermissionModal
        open={rolePermModal.open}
        role={rolePermModal.role}
        onClose={() => setRolePermModal({ open: false, role: null })}
        onSaved={loadRoles}
        onToast={showToast}
      />

      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast((prev) => ({ ...prev, show: false }))} />
    </div>
  );
};