import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Drawer } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { PinManageModal } from '../components/users/PinManageModal';
import { LectureCatalogsPage } from './LectureCatalogsPage';
import { LectureBuildingsPage } from './LectureBuildingsPage';


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
  Bell,
  AlertCircle,
  Lock,
  GraduationCap,
  BookOpen,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Database,
  Fingerprint,
  Sparkles,
} from 'lucide-react';

import { TrashPage } from './TrashPage';
import { SessionsPage } from './SessionsPage';
import { useAuth } from '../hooks/useAuth';
import { useDeviceMode } from '../contexts/DeviceModeContext';
import { Header } from '../components/common/Header';
import { Sidebar, ADMIN_NAV_GROUPS } from '../components/common/Sidebar';
import { Toast, ToastState } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { StatCard } from '../components/dashboard/StatCard';
import { DistributionChart } from '../components/dashboard/DistributionChart';
import { UnitTreeTable, getUnitCategory } from '../components/dashboard/UnitTreeTable';
import { SecurityAuditLog } from '../components/dashboard/SecurityAuditLog';
import { UserTable } from '../components/users/UserTable';
import { UserFormModal } from '../components/users/UserFormModal';
import { UserCredentialsModal } from '../components/users/UserCredentialsModal';
import { AssignRoleModal } from '../components/users/AssignRoleModal';
import { FingerprintEnrollModal } from '../components/users/FingerprintEnrollModal';
import { GrantPermissionModal } from '../components/users/GrantPermissionModal';
import { RolePermissionModal } from '../components/users/RolePermissionModal';
import { ApprovalQueuePage } from './ApprovalQueuePage';
import { ProtectedPermissionsConfigPage } from './ProtectedPermissionsConfigPage';
import { isApprovalRequired } from '../utils/approvalUtils';
import { useApprovalContext } from '../contexts/ApprovalContext';
import { useSearchParams } from 'react-router-dom';
import { Tooltip } from 'antd';

import { dashboardApi } from '../services/dashboardApi';
import { permissionService } from '../services/permissionService';
import { usersApi } from '../services/usersApi';
import { lectureService } from '../services/lectureService';
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

// Cấu hình hiển thị chuẩn quân sự cho 5 Cấp Độ Bảo Mật Dữ Liệu
const LEVEL_CONFIGS: Record<number, {
  label: string;
  badgeBg: string;
  badgeText: string;
  border: string;
  badgeDot: string;
  requires2FA: boolean;
  desc: string;
}> = {
  1: {
    label: 'Công khai',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500/30',
    badgeDot: 'bg-emerald-500',
    requires2FA: false,
    desc: 'Phổ biến rộng rãi, cán bộ chiến sĩ và công chúng được phép tiếp cận',
  },
  2: {
    label: 'Nội bộ',
    badgeBg: 'bg-sky-500/15',
    badgeText: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-500/30',
    badgeDot: 'bg-sky-500',
    requires2FA: false,
    desc: 'Lưu hành trong nội bộ đơn vị, không công khai ra ngoài mạng diện rộng',
  },
  3: {
    label: 'Mật',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-500/30',
    badgeDot: 'bg-amber-500',
    requires2FA: true,
    desc: 'Bí mật quân sự; bắt buộc quét vân tay 2FA cấp token 5 phút để giải mã / xem',
  },
  4: {
    label: 'Tối mật',
    badgeBg: 'bg-rose-500/15',
    badgeText: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-500/30',
    badgeDot: 'bg-rose-500',
    requires2FA: true,
    desc: 'Tài liệu tối mật tác chiến; chỉ dành cho cán bộ có thẩm quyền cấp 4 kèm vân tay',
  },
  5: {
    label: 'Tuyệt mật',
    badgeBg: 'bg-purple-500/15',
    badgeText: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-500/30',
    badgeDot: 'bg-purple-500',
    requires2FA: true,
    desc: 'Mức mật tuyệt đối; kiểm soát nghiêm ngặt nhất với kiểm toán an ninh SOC thời gian thực',
  },
};

const ADMIN_NAV_TABS: Array<{ id: string; label: string; icon: any; permission?: string }> =
  ADMIN_NAV_GROUPS.flatMap((g) => g.items);

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
  { value: 'LECTURE',     label: '🎓 Bài giảng' },
  { value: 'COMMAND',     label: '📊 Chỉ huy' },
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
    return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30';
  }
  if (g === 'SYSTEM' || g === 'SYSTEM_STATS') {
    return 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30';
  }
  if (g === 'ROLE') {
    return 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/30';
  }
  if (g === 'USER') {
    return 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30';
  }
  if (g === 'FINGERPRINT') {
    return 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-500/30';
  }
  if (g === 'AUDIT') {
    return 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border-indigo-500/30';
  }
  if (g === 'APPROVAL') {
    return 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30';
  }
  if (g === 'AI') {
    return 'bg-violet-500/15 text-violet-800 dark:text-violet-300 border-violet-500/30';
  }
  return 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30';
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

// ============================================================
// COMPONENT — CHỈ KHAI BÁO 1 LẦN
// ============================================================
export const AdminDashboardPage: React.FC = () => {
  const { deviceMode, orientation, screenWidth } = useDeviceMode();
  const { user, isAdmin, hasPermission } = useAuth();
  const { count: approvalCount } = useApprovalContext();

  // ⭐ URL ↔ activeTab sync
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') || 'overview';

  const [activeTab, setActiveTab] = useState(urlTab);
  const [sidebarOpen, setSidebarOpen] = useState(false);  // ✅ chỉ khai báo 1 lần

  // ⭐ handleTabChange memo hoá để dùng an toàn trong useEffect deps
  const handleTabChange = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      if (tabId === 'overview') {
        setSearchParams({}, { replace: true });
      } else {
        setSearchParams({ tab: tabId }, { replace: true });
      }
    },
    [setSearchParams]
  );

  // Sync URL → state (khi user bấm Back/Forward hoặc vào từ Header)
  useEffect(() => {
    if (urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab]);

  const visibleTabs = useMemo(
    () => ADMIN_NAV_TABS.filter((t) => !t.permission || hasPermission(t.permission)),
    [hasPermission]
  );

  // Nếu tab hiện tại không được phép → nhảy sang tab hợp lệ đầu tiên
  useEffect(() => {
    if (visibleTabs.length === 0) return;
    const ids = visibleTabs.map((t) => t.id);
    if (!ids.includes(activeTab)) {
      handleTabChange(ids[0]);
    }
  }, [visibleTabs, activeTab, handleTabChange]);

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
  const [lectureStats, setLectureStats] = useState<{
    total: number;
    published: number;
    pending: number;
    draft: number;
    liveSchedulesCount: number;
    liveStudentsCount: number;
    liveVenueName?: string;
    subjectsCount: number;
    classesCount: number;
    venuesCount: number;
    scormCount: number;
    secretCount: number;
    readinessRate: number;
  } | null>(null);
  const [loadingLectureStats, setLoadingLectureStats] = useState(false);
  const [isDataSectionExpanded, setIsDataSectionExpanded] = useState(true);
  const [isLectureSectionExpanded, setIsLectureSectionExpanded] = useState(true);
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

  // === LISTS ===
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

  const [userSearch, setUserSearch] = useState('');

// ✅ state mới: lọc người đang chờ cấp PIN
const [filterPinPending, setFilterPinPending] = useState(false);

// ✅ đếm số user đang chờ cấp PIN — dùng ở badge trên nút bấm
const pinPendingCount = useMemo(
  () => usersList.filter((u) => u.pin_requested && !u.has_pin).length,
  [usersList]
);

  // Search & Filter state cho Ranks và Positions
  const [rankSearch, setRankSearch] = useState('');
  const [rankStatusFilter, setRankStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [positionSearch, setPositionSearch] = useState('');
  const [positionStatusFilter, setPositionStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Danh sách cấp bậc sau khi tìm kiếm và lọc trạng thái
  const filteredRanks = useMemo(() => {
    let result = [...ranksList];
    if (rankSearch.trim()) {
      const q = rankSearch.toLowerCase().trim();
      result = result.filter(
        (r) =>
          (r.rank_id || '').toLowerCase().includes(q) ||
          (r.name || '').toLowerCase().includes(q)
      );
    }
    if (rankStatusFilter === 'active') {
      result = result.filter((r) => r.active !== false);
    } else if (rankStatusFilter === 'inactive') {
      result = result.filter((r) => r.active === false);
    }
    return result;
  }, [ranksList, rankSearch, rankStatusFilter]);

  // Danh sách chức vụ sau khi tìm kiếm và lọc trạng thái
  const filteredPositions = useMemo(() => {
    let result = [...positionsList];
    if (positionSearch.trim()) {
      const q = positionSearch.toLowerCase().trim();
      result = result.filter(
        (p) =>
          (p.position_id || '').toLowerCase().includes(q) ||
          (p.name || '').toLowerCase().includes(q)
      );
    }
    if (positionStatusFilter === 'active') {
      result = result.filter((p) => p.active !== false);
    } else if (positionStatusFilter === 'inactive') {
      result = result.filter((p) => p.active === false);
    }
    return result;
  }, [positionsList, positionSearch, positionStatusFilter]);

  // Search state cho Roles
  const [roleSearch, setRoleSearch] = useState('');

  // Danh sách vai trò sau khi tìm kiếm
  const filteredRoles = useMemo(() => {
    if (!roleSearch.trim()) return rolesList;
    const q = roleSearch.toLowerCase().trim();
    return rolesList.filter(
      (r) =>
        (r.role_id || '').toLowerCase().includes(q) ||
        (r.name || '').toLowerCase().includes(q)
    );
  }, [rolesList, roleSearch]);

  // Search & Filter state cho Permissions
  const [permSearch, setPermSearch] = useState('');
  const [permGroupFilter, setPermGroupFilter] = useState('ALL');

  // Danh sách quyền hạn sau khi tìm kiếm và lọc nhóm
  const filteredPerms = useMemo(() => {
    let result = permsList;
    if (permGroupFilter !== 'ALL') {
      result = result.filter(
        (p: any) => ((p.group_code || 'SYSTEM').toUpperCase()) === permGroupFilter
      );
    }
    if (permSearch.trim()) {
      const q = permSearch.toLowerCase().trim();
      result = result.filter(
        (p: any) =>
          (p.permission_id || '').toLowerCase().includes(q) ||
          (p.code || p.name || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q) ||
          (p.group_code || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [permsList, permSearch, permGroupFilter]);

  // Các nhóm quyền duy nhất để tạo filter chips
  const permGroups = useMemo(() => {
    const groups = new Set<string>();
    permsList.forEach((p: any) => {
      const g = (p.group_code || 'SYSTEM').toUpperCase();
      if (g) groups.add(g);
    });
    return Array.from(groups).sort();
  }, [permsList]);

  // === MODALS ===
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [pinManageModal, setPinManageModal] = useState<{ open: boolean; user: User | null }>({
    open: false, user: null,
  });

  const [credModal, setCredModal] = useState<{ open: boolean; userId: string; username: string }>({
    open: false, userId: '', username: '',
  });

  const [assignRoleModal, setAssignRoleModal] = useState<{ open: boolean; selectedRole: Role | null }>({
    open: false, selectedRole: null,
  });

  const [fpEnrollModal, setFpEnrollModal] = useState<{ open: boolean; user: User | null }>({
    open: false, user: null,
  });

  const [grantPermModal, setGrantPermModal] = useState<{ open: boolean; user: User | null }>({
    open: false, user: null,
  });

  const [rolePermModal, setRolePermModal] = useState<{ open: boolean; role: Role | null }>({
    open: false, role: null,
  });

  const [genericModal, setGenericModal] = useState<{
    open: boolean;
    type: 'roles' | 'units' | 'doctypes' | 'levels' | 'ranks' | 'positions' | 'permissions' | null;
    item: any;
  }>({ open: false, type: null, item: null });

  const [genericFormData, setGenericFormData] = useState<any>({});

  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  }>({ open: false, title: '', message: '', onConfirm: async () => {} });

  const [toast, setToast] = useState<ToastState>({
    show: false, message: '', type: 'success',
  });

  // ⭐ memo hoá showToast để dùng an toàn trong các useEffect
  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      setToast({ show: true, message, type });
      setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 2800);
    },
    []
  );

  // === LOADERS ===
  const loadStats = async () => {
    try {
      const data = await dashboardApi.getStats();
      setStats(data);
    } catch (err: any) {
      showToast('Lỗi tải thống kê: ' + err.message, 'error');
    }
  };

  const loadLectureStats = async () => {
    setLoadingLectureStats(true);
    try {
      const [lecturesRes, liveRes, subjectsRes, classesRes, venuesRes] = await Promise.allSettled([
        lectureService.list(),
        lectureService.getLiveSchedules(),
        lectureService.getSubjects(),
        lectureService.getClasses(),
        lectureService.getVenues(),
      ]);

      const items = lecturesRes.status === 'fulfilled' ? lecturesRes.value?.items || [] : [];
      const active = items.filter((l: any) => l.status !== 'DELETED');
      const total = active.length;
      const published = active.filter((l: any) => l.status === 'PUBLISHED').length;
      const pending = active.filter((l: any) => l.status === 'PENDING_FACULTY' || l.status === 'PENDING_TRAINING').length;
      const draft = active.filter((l: any) => l.status === 'DRAFT' || l.status === 'REJECTED').length;
      const scormCount = active.filter((l: any) => Boolean(l.scorm_entry_point || l.content_type === 'SCORM')).length;
      const secretCount = active.filter((l: any) => (l.security_level_id || 1) >= 3).length;
      const readinessRate = total > 0 ? Math.round((published / total) * 100) : 0;

      const liveItems = liveRes.status === 'fulfilled' ? liveRes.value?.items || [] : [];
      const liveSchedulesCount = liveItems.length;
      const liveStudentsCount = liveItems.reduce((acc: number, curr: any) => acc + (curr.student_count || 0), 0);
      const liveVenueName = liveItems.length > 0 ? (liveItems[0].venue_name || liveItems[0].class_name) : undefined;

      const subjectsCount = subjectsRes.status === 'fulfilled' ? (subjectsRes.value || []).length : 0;
      const classesCount = classesRes.status === 'fulfilled' ? (classesRes.value || []).length : 0;
      const venuesCount = venuesRes.status === 'fulfilled' ? (venuesRes.value || []).length : 0;

      setLectureStats({
        total,
        published,
        pending,
        draft,
        liveSchedulesCount,
        liveStudentsCount,
        liveVenueName,
        subjectsCount,
        classesCount,
        venuesCount,
        scormCount,
        secretCount,
        readinessRate,
      });
    } catch (err: any) {
      console.warn('Không thể nạp thống kê bài giảng số:', err);
      setLectureStats({
        total: 0,
        published: 0,
        pending: 0,
        draft: 0,
        liveSchedulesCount: 0,
        liveStudentsCount: 0,
        subjectsCount: 0,
        classesCount: 0,
        venuesCount: 0,
        scormCount: 0,
        secretCount: 0,
        readinessRate: 0,
      });
    } finally {
      setLoadingLectureStats(false);
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
        loadLectureStats();
        break;
      case 'users':
        loadUsers();
        
        // ✅ FIX: Dùng API /api/meta (Public) thay vì 4 API Admin để tránh lỗi 403
        dashboardApi.getMeta().then((meta) => {
          setUnitsList(meta.units || []);
          setLevelsList(meta.levels || []);
          setRanksList((meta as any).ranks || []);
          setPositionsList((meta as any).positions || []);
        }).catch(() => {});

        // Vẫn giữ loadRoles vì Meta không có Roles
        if (!rolesList.length) {
           dashboardApi.getCreatableRoles().then(res => setRolesList(res.items)).catch(() => {});
        }
        break;
      case 'roles':
        loadRoles();
        if (!usersList.length) loadUsers();
        break;
      case 'permissions': loadPermissions(); break;
      case 'units':       loadUnits();       break;
      case 'doctypes':    loadDocTypes();    break;
      case 'levels':      loadLevels();      break;
      case 'ranks':       loadRanks();       break;
      case 'positions':   loadPositions();   break;
      case 'logs':
      case 'sessions':
      case 'trash':
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

// === USER CRUD ===
  const handleSaveUser = async (
    userData: Partial<User> & { role_id?: string; roles?: string[]; expires_at?: string | null }
  ) => {
    try {
      if (selectedUser?.user_id) {
        // 1. Tách role_id, roles, expires_at ra khỏi object để không gửi nhầm lên API updateUser
        const { role_id, roles: newRoleIds, expires_at, ...updateData } = userData;

        // 2. Cập nhật thông tin cơ bản (Tên, chức vụ, đơn vị, độ mật...)
        await usersApi.updateUser(selectedUser.user_id, updateData);

        // 3. ✅ ATOMIC: Cập nhật vai trò qua 1 endpoint PUT duy nhất (nếu có thay đổi)
        // Server wrap DELETE cũ + INSERT mới trong transaction → tránh trạng thái mất role giữa chừng
        const currentRoles = selectedUser.roles || [];
        if (Array.isArray(newRoleIds)) {
          // Nhiều vai trò: chỉ gọi khi tập vai trò thực sự đổi; server giữ nguyên các vai trò không đổi
          const same =
            newRoleIds.length === currentRoles.length && newRoleIds.every((r) => currentRoles.includes(r));
          if (!same) {
            await usersApi.setUserRoles(selectedUser.user_id, newRoleIds, expires_at ?? null);
          }
        } else if (role_id !== undefined && role_id !== (currentRoles[0] || null)) {
          const newRoles = role_id ? [role_id] : [];
          await usersApi.setUserRoles(selectedUser.user_id, newRoles, expires_at ?? null);
        }

        showToast('Đã cập nhật thông tin quân nhân thành công');
      } else {
        // Tạo mới: Form đã gửi kèm role_id, Backend sẽ tự xử lý
        await usersApi.createUser(userData as any);
        showToast('Đã tạo quân nhân mới thành công');
      }
    } catch (err: any) {
      showToast('Lỗi: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      // Luôn tải lại danh sách để UI đồng bộ với DB kể cả khi cập nhật chỉ thành công một phần
      await loadUsers();
    }
  };

  const handleDeleteUser = (u: User) => {
    setDeleteConfirm({
      open: true,
      title: 'Xóa Người Dùng',
      message: `Bạn có chắc chắn muốn xóa tài khoản ${u.full_name} (${u.user_id})?`,
      onConfirm: async () => {
        try {
          const res: any = await usersApi.deleteUser(u.user_id);
          await loadUsers();
          if (isApprovalRequired(res)) return;
          showToast(`Đã xóa tài khoản ${u.user_id}`);
        } catch (err: any) {
          showToast('Lỗi: ' + err.message, 'error');
        } finally {
          setDeleteConfirm((prev) => ({ ...prev, open: false }));
        }
      },
    });
  };

  // === GENERIC SAVE (catalog CRUD) ===
  const handleGenericSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const { type, item } = genericModal;
    try {
      if (type === 'roles') {
        if (item) await dashboardApi.updateRole(item.role_id, { name: genericFormData.name });
        else      await dashboardApi.createRole({ role_id: genericFormData.role_id, name: genericFormData.name });
        loadRoles();
      } else if (type === 'units') {
        if (item) await dashboardApi.updateUnit(item.unit_id, genericFormData);
        else      await dashboardApi.createUnit(genericFormData);
        loadUnits();
      } else if (type === 'doctypes') {
        if (item) await dashboardApi.updateDocumentType(item.type_id, genericFormData);
        else      await dashboardApi.createDocumentType(genericFormData);
        loadDocTypes();
      } else if (type === 'levels') {
        if (item) await dashboardApi.updateSecurityLevel(item.level_id, genericFormData);
        else      await dashboardApi.createSecurityLevel({
          level_id: Number(genericFormData.level_id),
          code: genericFormData.code,
          name: genericFormData.name,
        });
        loadLevels();
      } else if (type === 'ranks') {
        if (item) await dashboardApi.updateRank(item.rank_id, genericFormData);
        else      await dashboardApi.createRank(genericFormData);
        loadRanks();
      } else if (type === 'positions') {
        if (item) await dashboardApi.updatePosition(item.position_id, genericFormData);
        else      await dashboardApi.createPosition(genericFormData);
        loadPositions();
      } else if (type === 'permissions') {
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
            showToast('Backend chưa hỗ trợ sửa quyền — cần thêm PUT /api/admin/permissions/:id', 'error');
            return;
          }
          const { permission_id, code, ...updateBody } = payload;
          await api.updatePermission(item.permission_id, updateBody);
        } else {
          if (typeof api.createPermission !== 'function') {
            showToast('Thiếu dashboardApi.createPermission — kiểm tra services/dashboardApi.ts', 'error');
            return;
          }
          if (!payload.permission_id) { showToast('Thiếu Permission ID', 'error'); return; }
          if (!payload.code)          { showToast('Thiếu mã code', 'error'); return; }
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

  const handleGenericDelete = (type: string, id: string | number, name: string) => {
    setDeleteConfirm({
      open: true,
      title: `Xóa ${type}`,
      message: `Đồng chí có chắc chắn muốn xóa bản ghi "${name}" (${id})?`,
      onConfirm: async () => {
        try {
          let res: any = null;
          if (type === 'roles')            res = await dashboardApi.deleteRole(String(id));
          else if (type === 'permissions') res = await dashboardApi.deletePermission(String(id));
          else if (type === 'units')       res = await dashboardApi.deleteUnit(String(id));
          else if (type === 'doctypes')    res = await dashboardApi.deleteDocumentType(String(id));
          else if (type === 'levels')      res = await dashboardApi.deleteSecurityLevel(Number(id));
          else if (type === 'ranks')       res = await dashboardApi.deleteRank(String(id));
          else if (type === 'positions')   res = await dashboardApi.deletePosition(String(id));

          if (type === 'roles')            loadRoles();
          else if (type === 'permissions') loadPermissions();
          else if (type === 'units')       loadUnits();
          else if (type === 'doctypes')    loadDocTypes();
          else if (type === 'levels')      loadLevels();
          else if (type === 'ranks')       loadRanks();
          else if (type === 'positions')   loadPositions();

          if (isApprovalRequired(res)) return;

          if (type === 'ranks' && res?.soft_deleted) {
            showToast(`Đã ẩn cấp bậc "${name}" khỏi dropdown`, 'info');
          } else if (type === 'positions' && res?.soft_deleted) {
            showToast(`Đã ẩn chức vụ "${name}" khỏi dropdown`, 'info');
          } else {
            showToast(`Đã xóa ${type} ${id}`);
          }
        } catch (err: any) {
          showToast('Lỗi: ' + err.message, 'error');
        } finally {
          setDeleteConfirm((prev) => ({ ...prev, open: false }));
        }
      },
    });
  };

  const filteredUsers = useMemo(() => {
  let result = usersList;

    // 1️⃣ Lọc theo từ khóa tìm kiếm
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase().trim();
      result = result.filter(
        (u) =>
          (u.user_id || '').toLowerCase().includes(q) ||
          (u.full_name || '').toLowerCase().includes(q) ||
          (u.rank_name || '').toLowerCase().includes(q) ||
          (u.position || '').toLowerCase().includes(q) ||
          (u.unit_name || '').toLowerCase().includes(q) ||
          (u.role_names || []).some((rn) => rn.toLowerCase().includes(q))
      );
    }

    // 2️⃣ Lọc người đang chờ cấp PIN (badge đỏ)
    if (filterPinPending) {
      result = result.filter((u) => u.pin_requested && !u.has_pin);
    }

    return result;
  }, [usersList, userSearch, filterPinPending]);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-200 dark:bg-[#090e17] text-slate-900 dark:text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-900 transition-colors duration-200">
      <Header
        activeNav="admin"
        title="Trường Quân Sự Quân Khu 7"
        subtitle="Trung tâm dữ liệu số"
        onToggleMobileMenu={() => setSidebarOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden relative">
        {!isPortraitMode && (
          <aside
            className={`flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md overflow-x-hidden transition-all duration-300 ${sidebarWidthClass}`}
          >
            <Sidebar
              activeTab={activeTab as any}
              onTabChange={(id) => {
                handleTabChange(id);   // ✅ sync URL
                setSidebarOpen(false);
              }}
              collapsed={sidebarCollapsed}
              onToggleCollapse={toggleSidebarCollapsed}
              counts={{ approvals: approvalCount }}
            />
          </aside>
        )}

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
                handleTabChange(id);   // ✅ sync URL
                setSidebarOpen(false);
              }}
              onClose={() => setSidebarOpen(false)}
              collapsed={false}
            />
          </Drawer>
        )}

        <main className="flex-1 min-w-0 overflow-y-auto p-3.5 sm:p-5 lg:p-6 xl:p-8 bg-slate-200 dark:bg-slate-950/60 space-y-5 scroll-smooth overscroll-contain">
          {isPortraitMode && (
            <div className="flex items-center gap-1.5 sm:gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800/80 select-none">
              <button
                type="button"
                onClick={() => scrollTabStrip('left')}
                className="shrink-0 p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400 transition cursor-pointer"
                title="Cuộn danh mục sang trái"
                aria-label="Cuộn sang trái"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div
                ref={tabStripRef}
                onWheel={handleTabStripWheel}
                className="flex-1 flex items-center overflow-x-auto no-scrollbar gap-1.5 py-0.5 scroll-smooth"
              >
                {visibleTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const isSectionStart = tab.id === 'approvals' || tab.id === 'lec-subjects' || tab.id === 'protection_config';
                  return (
                    <React.Fragment key={tab.id}>
                      {isSectionStart && (
                        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 shrink-0 mx-1" />
                      )}
                      <button
                        data-tab-id={tab.id}
                        onClick={() => handleTabChange(tab.id)}   // ✅ sync URL
                        className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
                          isActive
                            ? 'bg-[#166534] text-white shadow-xs dark:bg-emerald-600/25 dark:text-emerald-300 dark:border dark:border-emerald-500/40'
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span>{tab.label}</span>
                        {tab.id === 'approvals' && approvalCount > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                            {approvalCount > 99 ? '99+' : approvalCount}
                          </span>
                        )}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>

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

          {/* ============== TAB PANELS ============== */}

          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Header Tổng quan */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <LayoutDashboard className="w-5 h-5 text-amber-500 dark:text-amber-400" /> Tổng Quan Hệ Thống
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Thống kê dữ liệu hoạt động thời gian thực trên toàn bộ các phân hệ
                  </p>
                </div>
                <button
                  onClick={async () => {
                    setOverviewRefreshKey((prev) => prev + 1);
                    await Promise.all([loadStats(), loadLectureStats()]);
                    showToast('Đã làm mới dữ liệu tổng quan!', 'success');
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0"
                >
                  <RotateCw className="w-3.5 h-3.5" /> Làm mới
                </button>
              </div>

              {/* ======================================================== */}
              {/* KHUNG 1: TỔNG QUAN VĂN BẢN SỐ (Tài liệu / Văn bản số)    */}
              {/* ======================================================== */}
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-xs transition-all duration-300">
                {/* Header Khung Văn bản số */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                      <Database className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                          Tổng Quan Văn Bản Số
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                          Kho Văn Bản Số
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        Quân nhân, văn bản số hóa, dung lượng lưu trữ an toàn và nhật ký an ninh
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsDataSectionExpanded((prev) => !prev)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer select-none"
                      title={isDataSectionExpanded ? 'Thu gọn khung Văn bản số' : 'Mở rộng khung Văn bản số'}
                    >
                      {isDataSectionExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                          <span className="hidden sm:inline">Thu gọn</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                          <span className="hidden sm:inline">Mở rộng</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Nội dung Khung Văn bản số */}
                {isDataSectionExpanded ? (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className={
                      isIPadLandscape
                        ? 'grid grid-cols-4 gap-3'
                        : isIPadPortrait
                          ? 'grid grid-cols-2 gap-3'
                          : 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4'
                    }>
                      <StatCard label="Quân nhân & Người dùng" loading={!stats} value={stats?.users ?? "—"}      icon={<Users className="w-6 h-6" />}      color="blue"    subtext="Đã kích hoạt trên hệ thống" refreshKey={overviewRefreshKey} />
                      <StatCard label="Văn bản & Tài liệu" loading={!stats} value={stats?.documents ?? "—"}  icon={<FileCheck className="w-6 h-6" />}  color="emerald" subtext="Lưu trữ trong kho số"       delay={0.05} refreshKey={overviewRefreshKey} />
                      <StatCard label="Tổng dung lượng tệp" loading={!stats} value={stats ? formatFileSize(stats.totalSize) : "—"} icon={<HardDrive className="w-6 h-6" />} color="amber" subtext="Ổ đĩa dữ liệu an toàn"      delay={0.1}  refreshKey={overviewRefreshKey} />
                      <StatCard label="Truy cập nhật ký 24h" loading={!stats} value={stats?.logs24h ?? "—"}    icon={<History className="w-6 h-6" />}    color="red"     subtext="Bản ghi kiểm toán an ninh" delay={0.15} refreshKey={overviewRefreshKey} />
                    </div>

                    <div className={
                      isIPadLandscape
                        ? 'grid grid-cols-2 gap-4'
                        : isIPadPortrait
                          ? 'grid grid-cols-1 gap-4'
                          : 'grid grid-cols-1 xl:grid-cols-2 gap-4'
                    }>
                      <DistributionChart
                        title="Phân Bố Tài Liệu Theo Mức Bảo Mật"
                        icon={<Shield className="w-4 h-4 text-amber-500 dark:text-amber-400" />}
                        barColor="amber"
                        items={(stats?.byLevel || []).map((x) => ({ id: x.lv, label: x.lvName, count: x.n }))}
                        refreshKey={overviewRefreshKey}
                      />
                      <DistributionChart
                        title="Phân Bố Tài Liệu Theo Thể Loại Văn Bản"
                        icon={<FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                        barColor="emerald"
                        items={(stats?.byType || []).map((t) => ({ id: t.id, label: t.name, count: t.n }))}
                        refreshKey={overviewRefreshKey}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-white/[0.04] text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between flex-wrap gap-2">
                    <span className="font-medium">
                      Quân nhân: <b className="text-slate-800 dark:text-slate-200">{stats?.users ?? '—'}</b> • 
                      Văn bản: <b className="text-slate-800 dark:text-slate-200">{stats?.documents ?? '—'}</b> • 
                      Dung lượng: <b className="text-slate-800 dark:text-slate-200">{stats ? formatFileSize(stats.totalSize) : '—'}</b> • 
                      Nhật ký 24h: <b className="text-slate-800 dark:text-slate-200">{stats?.logs24h ?? '—'}</b>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsDataSectionExpanded(true)}
                      className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                    >
                      Bấm để xem chi tiết
                    </button>
                  </div>
                )}
              </div>

              {/* ======================================================== */}
              {/* KHUNG 2: TỔNG QUAN BÀI GIẢNG SỐ (Giảng đường / Học viện) */}
              {/* ======================================================== */}
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-xs transition-all duration-300">
                {/* Header Khung Bài giảng số */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/20 shrink-0">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                          Tổng Quan Bài Giảng Số
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30">
                          Học Viện Số
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        Quản trị bài giảng điện tử, quy trình duyệt 2 tầng quân sự và sẵn sàng giảng dạy
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsLectureSectionExpanded((prev) => !prev)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer select-none"
                      title={isLectureSectionExpanded ? 'Thu gọn khung Bài giảng số' : 'Mở rộng khung Bài giảng số'}
                    >
                      {isLectureSectionExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                          <span className="hidden sm:inline">Thu gọn</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                          <span className="hidden sm:inline">Mở rộng</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Nội dung Khung Bài giảng số */}
                {isLectureSectionExpanded ? (
                  <div className="space-y-3.5 sm:space-y-4 animate-in fade-in duration-200">
                    {/* TẦNG 1: TACTICAL LIVE STATUS BAR (Nhịp đập Giảng đường & Tác chiến Số) */}
                    <div className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-r from-slate-50 via-slate-50/80 to-blue-50/40 dark:from-slate-950/80 dark:via-slate-900/60 dark:to-blue-950/20 border border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                      {/* Chip 1: Trực chiến Giảng đường (Radar Pulse) */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        {lectureStats && lectureStats.liveSchedulesCount > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-semibold shrink-0">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                            </span>
                            <span>ĐANG LÊN LỚP ({lectureStats.liveSchedulesCount})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold shrink-0">
                            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                            <span>GIẢNG ĐƯỜNG TRỰC CHIẾN</span>
                          </span>
                        )}
                        <span className="text-slate-600 dark:text-slate-300 font-medium truncate text-xs">
                          {lectureStats && lectureStats.liveSchedulesCount > 0
                            ? `${lectureStats.liveSchedulesCount} tiết giảng trực tuyến • ${lectureStats.liveStudentsCount} học viên${lectureStats.liveVenueName ? ` (${lectureStats.liveVenueName})` : ''}`
                            : 'Hệ thống phòng học sẵn sàng nạp phiên giảng dạy mới'}
                        </span>
                      </div>

                      {/* Các chỉ số mini tác chiến bên phải */}
                      <div className="flex items-center gap-3.5 flex-wrap text-[11px] shrink-0 text-slate-500 dark:text-slate-400">
                        {/* Mini Gauge: Tỷ lệ sẵn sàng */}
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Sẵn sàng huấn luyện:</span>
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                                style={{ width: `${lectureStats?.readinessRate ?? 0}%` }}
                              />
                            </div>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{lectureStats?.readinessRate ?? 0}%</span>
                          </div>
                        </div>

                        <span className="hidden md:inline text-slate-300 dark:text-slate-700">|</span>

                        {/* Chip Giáo án Cấp Mật */}
                        <div className="flex items-center gap-1.5" title="Giáo án tác chiến Cấp 3 (Mật) & Cấp 4 (Tối Mật) yêu cầu 2FA vân tay">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                          <span>Giáo án Mật:</span>
                          <b className="font-mono text-slate-800 dark:text-slate-200">{lectureStats?.secretCount ?? 0} bài (2FA)</b>
                        </div>

                        <span className="hidden md:inline text-slate-300 dark:text-slate-700">|</span>

                        {/* Chip SCORM Tương tác */}
                        <div className="flex items-center gap-1.5" title="Gói bài giảng điện tử chuẩn SCORM đa phương tiện tương tác">
                          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                          <span>Gói SCORM:</span>
                          <b className="font-mono text-slate-800 dark:text-slate-200">{lectureStats?.scormCount ?? 0} tương tác</b>
                        </div>
                      </div>
                    </div>

                    {/* TẦNG 2: LƯỚI 6 THẺ KPI TÁC CHIẾN (Bố cục 3 thẻ trên, 3 thẻ dưới) */}
                    <div className={
                      isIPadLandscape
                        ? 'grid grid-cols-3 gap-3 sm:gap-3.5'
                        : isIPadPortrait
                          ? 'grid grid-cols-2 sm:grid-cols-3 gap-3'
                          : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4'
                    }>
                      <StatCard
                        label="Tổng số bài giảng"
                        loading={loadingLectureStats || !lectureStats}
                        value={lectureStats?.total ?? "—"}
                        icon={<BookOpen className="w-5 h-5" />}
                        color="blue"
                        subtext="Toàn bộ phân hệ quản lý"
                        delay={0.0}
                        refreshKey={overviewRefreshKey}
                      />
                      <StatCard
                        label="Sẵn sàng giảng dạy"
                        loading={loadingLectureStats || !lectureStats}
                        value={lectureStats?.published ?? "—"}
                        icon={<CheckCircle2 className="w-5 h-5" />}
                        color="emerald"
                        subtext="Đã xuất bản (Published)"
                        delay={0.05}
                        refreshKey={overviewRefreshKey}
                      />
                      <StatCard
                        label="Đang chờ duyệt 2 tầng"
                        loading={loadingLectureStats || !lectureStats}
                        value={lectureStats?.pending ?? "—"}
                        icon={<Clock className="w-5 h-5" />}
                        color="amber"
                        subtext="Cấp Khoa & BGH phê duyệt"
                        delay={0.1}
                        refreshKey={overviewRefreshKey}
                      />
                      <StatCard
                        label="Bản nháp / Cần sửa"
                        loading={loadingLectureStats || !lectureStats}
                        value={lectureStats?.draft ?? "—"}
                        icon={<FileText className="w-5 h-5" />}
                        color="purple"
                        subtext="Đang biên soạn & hoàn thiện"
                        delay={0.15}
                        refreshKey={overviewRefreshKey}
                      />
                      <StatCard
                        label="Môn học Quân sự"
                        loading={loadingLectureStats || !lectureStats}
                        value={lectureStats?.subjectsCount ?? "—"}
                        icon={<Award className="w-5 h-5" />}
                        color="cyan"
                        subtext="Chương trình đào tạo"
                        delay={0.2}
                        refreshKey={overviewRefreshKey}
                      />
                      <StatCard
                        label="Lớp & Giảng đường"
                        loading={loadingLectureStats || !lectureStats}
                        value={lectureStats ? `${lectureStats.classesCount} / ${lectureStats.venuesCount}` : "—"}
                        icon={<Users className="w-5 h-5" />}
                        color="indigo"
                        subtext="Lớp đào tạo / Phòng học"
                        delay={0.25}
                        refreshKey={overviewRefreshKey}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="py-2.5 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-white/[0.04] text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between flex-wrap gap-2.5">
                    <div className="flex items-center gap-2 flex-wrap font-medium">
                      <span>
                        Tổng số: <b className="text-slate-800 dark:text-slate-200 font-mono">{lectureStats?.total ?? '—'}</b>
                      </span>
                      <span>•</span>
                      <span>
                        Sẵn sàng: <b className="text-emerald-700 dark:text-emerald-400 font-mono">{lectureStats?.published ?? '—'} ({lectureStats?.readinessRate ?? 0}%)</b>
                      </span>
                      <span>•</span>
                      <span>
                        Chờ duyệt: <b className="text-amber-700 dark:text-amber-400 font-mono">{lectureStats?.pending ?? '—'}</b>
                      </span>
                      <span>•</span>
                      <span>
                        Bản nháp: <b className="text-purple-700 dark:text-purple-400 font-mono">{lectureStats?.draft ?? '—'}</b>
                      </span>
                      <span>•</span>
                      <span>
                        Môn học: <b className="text-cyan-700 dark:text-cyan-400 font-mono">{lectureStats?.subjectsCount ?? '—'}</b>
                      </span>
                      <span>•</span>
                      <span>
                        Lớp/Phòng: <b className="text-indigo-700 dark:text-indigo-400 font-mono">{lectureStats?.classesCount ?? '—'}/{lectureStats?.venuesCount ?? '—'}</b>
                      </span>
                      {lectureStats && lectureStats.liveSchedulesCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                            Đang lên lớp: {lectureStats.liveSchedulesCount}
                          </span>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsLectureSectionExpanded(true)}
                      className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer select-none"
                    >
                      Mở rộng bảng chỉ số HUD →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

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

              {/* ✅ NÚT LỌC NGƯỜI CHỜ CẤP PIN */}
              <button
                type="button"
                onClick={() => setFilterPinPending((v) => !v)}
                title={filterPinPending ? 'Bấm để bỏ lọc' : 'Chỉ hiện người đang chờ Admin cấp PIN'}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  filterPinPending
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm border border-rose-700'
                    : pinPendingCount > 0
                    ? 'bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 animate-pulse'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <AlertCircle className="w-4 h-4" />
                <span>Chờ cấp PIN</span>
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                    filterPinPending
                      ? 'bg-white/25 text-white'
                      : pinPendingCount > 0
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {pinPendingCount}
                </span>
                </button>

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
                onEdit={(u) => { setSelectedUser(u); setUserModalOpen(true); }}
                onUpdateCredentials={(u) => setCredModal({
                  open: true,
                  userId: u.user_id,
                  username: u.username || u.user_id.toLowerCase(),
                })}
                onDelete={handleDeleteUser}
                onEnrollFingerprint={(u) => setFpEnrollModal({ open: true, user: u })}
                onGrantPermission={(u) => setGrantPermModal({ open: true, user: u })}
                onViewPermissions={(u) => setGrantPermModal({ open: true, user: u })}
                onUnlock={async (u) => {
                  try {
                    const res = await usersApi.unlockUser(u.user_id);
                    if (res?.success) {
                      showToast(`Đã mở khóa tài khoản thành công cho quân nhân ${u.full_name} (${u.user_id})!`, 'success');
                      loadUsers();
                      loadStats();
                    }
                  } catch (err: any) {
                    showToast('Lỗi khi mở khóa tài khoản: ' + err.message, 'error');
                  }
                }}
                onManagePin={(u) => setPinManageModal({ open: true, user: u })}
              />
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="space-y-4">
              {/* Executive Header Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50/90 via-white to-amber-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/40 border border-amber-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-80 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_70%)] pointer-events-none" />
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 max-w-2xl">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-500/20 border border-amber-300/80 dark:border-amber-500/30 flex items-center justify-center shrink-0 shadow-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      <KeyRound className="w-6 h-6 stroke-[2.2]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                          Quản Lý Vai Trò & Phân Quyền
                        </h1>
                        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold font-mono bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                          RBAC Access Control
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        Thiết lập danh mục các vai trò tác chiến và phân bổ thẩm quyền trong hệ thống. Riêng vai trò Quản trị viên tối cao (Admin) sở hữu đặc quyền bypass toàn bộ bộ lọc phân quyền.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start lg:self-center shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        loadUsers();
                        setAssignRoleModal({ open: true, selectedRole: null });
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-[#14532d] via-[#166534] to-[#15803d] hover:from-[#166534] hover:to-[#15803d] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-950/20 border border-amber-500/25 active:scale-95"
                      title="Gán vai trò cho quân nhân"
                    >
                      <UserCheck className="w-4 h-4" /> <span>Gán vai trò</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGenericFormData({ role_id: getNextRoleId(rolesList), name: '' });
                        setGenericModal({ open: true, type: 'roles', item: null });
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
                      title="Thêm vai trò mới"
                    >
                      <Plus className="w-4 h-4" /> <span>Thêm vai trò</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tactical Search & Toolbar */}
              <div className="p-3 bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={roleSearch}
                    onChange={(e) => setRoleSearch(e.target.value)}
                    placeholder="Tìm theo mã vai trò hoặc tên vai trò..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition"
                  />
                  {roleSearch && (
                    <button
                      type="button"
                      onClick={() => setRoleSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Hiển thị <span className="font-bold text-slate-800 dark:text-slate-200">{filteredRoles.length}</span> / {rolesList.length} vai trò
                  </span>
                </div>
              </div>

              {/* Roles Table */}
              <div className="bg-white dark:bg-slate-900/90 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 min-w-[650px]">
                    <thead className="bg-slate-50 dark:bg-slate-900/95 text-slate-500 dark:text-slate-400 uppercase text-[11px] border-b border-slate-200 dark:border-slate-800 font-semibold tracking-wider">
                      <tr>
                        <th className="py-3.5 px-4 w-36 whitespace-nowrap">Mã Vai Trò</th>
                        <th className="py-3.5 px-4 w-60 whitespace-nowrap">Tên Vai Trò</th>
                        <th className="py-3.5 px-4 whitespace-nowrap">Đặc Tính Phân Quyền & Thẩm Quyền</th>
                        <th className="py-3.5 px-4 text-right w-36 whitespace-nowrap">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {filteredRoles.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-slate-400 dark:text-slate-500">
                            <div className="flex flex-col items-center gap-2">
                              <KeyRound className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                              <span className="text-sm font-semibold">Không tìm thấy vai trò nào</span>
                              <span className="text-xs">Thử thay đổi từ khóa tìm kiếm hoặc bấm "Thêm vai trò".</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredRoles.map((r) => {
                          const isSuperAdmin = r.role_id === 'ROL-01';

                          return (
                            <tr key={r.role_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className="font-mono text-xs px-2.5 py-1 rounded-md text-amber-800 bg-amber-500/10 border border-amber-600/25 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/25 font-bold tracking-wider inline-block">
                                  {r.role_id}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-900 dark:text-white font-bold text-sm whitespace-nowrap">
                                {r.name}
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                {isSuperAdmin ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                    <span>Quản trị viên tối cao • Bypass toàn bộ phân quyền</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                    <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>Vai trò tác chiến • Phân quyền theo ma trận RBAC</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1.5">
                                {isSuperAdmin ? (
                                  <Tooltip title="Role Admin bypass toàn quyền — không cần phân quyền" placement="top" arrow>
                                    <button
                                      disabled
                                      className="p-1.5 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 rounded-lg cursor-not-allowed opacity-60"
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5" />
                                    </button>
                                  </Tooltip>
                                ) : (
                                  <Tooltip title="Phân quyền chi tiết cho vai trò này" placement="top" arrow>
                                    <button
                                      onClick={() => setRolePermModal({ open: true, role: r })}
                                      className="p-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 dark:text-amber-300 dark:border-amber-500/30 rounded-lg transition cursor-pointer active:scale-95 shadow-xs"
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                    </button>
                                  </Tooltip>
                                )}
                                <Tooltip title="Sửa thông tin vai trò" placement="top" arrow>
                                  <button
                                    onClick={() => {
                                      setGenericFormData({ ...r });
                                      setGenericModal({ open: true, type: 'roles', item: r });
                                    }}
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-transparent rounded-lg transition cursor-pointer active:scale-95 shadow-xs"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                </Tooltip>
                                {(() => {
                                  const needsApproval = !isAdmin;
                                  return (
                                    <Tooltip
                                      title={
                                        needsApproval
                                          ? '⚠️ Yêu cầu quyền Admin để xóa vai trò — bấm để gửi yêu cầu phê duyệt'
                                          : 'Xóa vai trò'
                                      }
                                      placement="top"
                                      arrow
                                    >
                                      <button
                                        onClick={() => handleGenericDelete('roles', r.role_id, r.name)}
                                        className={`p-1.5 rounded-lg transition cursor-pointer active:scale-95 shadow-xs ${
                                          needsApproval
                                            ? 'bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-500 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-400 dark:border-slate-700 hover:text-amber-600 dark:hover:text-amber-400'
                                            : 'bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900/70 dark:text-rose-400 dark:border-transparent'
                                        }`}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </Tooltip>
                                  );
                                })()}
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

                    {activeTab === 'permissions' && (
            <div className="space-y-4">
              {/* Executive Header Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50/90 via-white to-amber-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/40 border border-amber-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-80 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_70%)] pointer-events-none" />
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 max-w-2xl">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-500/20 border border-amber-300/80 dark:border-amber-500/30 flex items-center justify-center shrink-0 shadow-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      <ShieldAlert className="w-6 h-6 stroke-[2.2]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                          Danh Sách Quyền Hạn Hệ Thống
                        </h1>
                        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold font-mono bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                          {permsList.length} Quyền Hạn
                        </span>
                        {isReorderingPerms && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 animate-pulse">
                            <RotateCw className="w-3 h-3 animate-spin" /> Đang lưu thứ tự sắp xếp...
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        Định nghĩa các quyền hạn truy xuất chức năng hệ thống QK7 DataHub. Bấm giữ biểu tượng grip (⋮⋮) ở cột đầu tiên và kéo thả để sắp xếp thứ tự ưu tiên quyền.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start lg:self-center shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={async () => {
                        await loadPermissions();
                        showToast('Đã làm mới danh sách quyền!', 'success');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
                      title="Làm mới danh sách quyền"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-slate-500" />
                      <span>Làm mới</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextOrder = (permsList.length + 1) * 10;
                        setGenericFormData(buildPermissionFormData(null, nextOrder));
                        setGenericModal({ open: true, type: 'permissions', item: null });
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
                      title="Thêm quyền mới vào hệ thống"
                    >
                      <Plus className="w-4 h-4" /> <span>Thêm quyền</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tactical Search & Group Filters Toolbar */}
              <div className="p-3.5 bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={permSearch}
                      onChange={(e) => setPermSearch(e.target.value)}
                      placeholder="Tìm theo mã quyền (PERM-...), tên quyền (DOC_...), mô tả..."
                      className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition"
                    />
                    {permSearch && (
                      <button
                        type="button"
                        onClick={() => setPermSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium self-end sm:self-center shrink-0">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-500/20 text-[11px] font-semibold">
                      <GripVertical className="w-3.5 h-3.5 shrink-0" /> Kéo thả dòng để xếp thứ tự
                    </span>
                    <span>
                      Hiển thị <span className="font-bold text-slate-800 dark:text-slate-200">{filteredPerms.length}</span> / {permsList.length} quyền
                    </span>
                  </div>
                </div>

                {/* Group Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  <button
                    type="button"
                    onClick={() => setPermGroupFilter('ALL')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                      permGroupFilter === 'ALL'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Tất cả ({permsList.length})
                  </button>
                  {permGroups.map((grp) => {
                    const count = permsList.filter((p: any) => ((p.group_code || 'SYSTEM').toUpperCase()) === grp).length;
                    const isSelected = permGroupFilter === grp;
                    return (
                      <button
                        key={grp}
                        type="button"
                        onClick={() => setPermGroupFilter(grp)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer border ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 dark:bg-amber-400 dark:text-slate-950 dark:border-amber-400 font-bold'
                            : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                        }`}
                      >
                        {grp} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Permissions Table with 100% Intact Drag & Drop */}
              <div className="bg-white dark:bg-slate-900/90 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs transition-colors duration-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 min-w-[760px]">
                    <thead className="bg-slate-50 dark:bg-slate-900/95 text-slate-500 dark:text-slate-400 uppercase text-[11px] border-b border-slate-200 dark:border-slate-800 font-semibold tracking-wider">
                      <tr>
                        <th className="py-3.5 px-3 text-center w-12" title="Bấm giữ và kéo thả để sắp xếp thứ tự">
                          <GripVertical className="w-4 h-4 mx-auto text-slate-400" />
                        </th>
                        <th className="py-3.5 px-4 w-36 whitespace-nowrap">Mã Quyền</th>
                        <th className="py-3.5 px-4 w-52 whitespace-nowrap">Tên Quyền / Mã Code</th>
                        <th className="py-3.5 px-4 min-w-[200px]">Mô Tả Chức Năng</th>
                        <th className="py-3.5 px-4 w-36 whitespace-nowrap">Phân Nhóm</th>
                        <th className="py-3.5 px-4 text-right w-28 whitespace-nowrap">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {filteredPerms.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                            <div className="flex flex-col items-center gap-2">
                              <ShieldAlert className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                              <span className="text-sm font-semibold">Không tìm thấy quyền hạn nào phù hợp</span>
                              <span className="text-xs">Thử thay đổi từ khóa tìm kiếm hoặc chọn nhóm khác.</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredPerms.map((p, filteredIndex) => {
                          const realIndex = permsList.findIndex((item) => item.permission_id === p.permission_id);
                          const isBeingDragged = draggedPermIndex === realIndex;
                          const isOver = dragOverPermIndex === realIndex;

                          return (
                            <tr
                              key={p.permission_id}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                if (dragOverPermIndex !== realIndex) {
                                  setDragOverPermIndex(realIndex);
                                }
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                handleReorderPerms(realIndex);
                              }}
                              className={`transition-colors duration-150 ${
                                isBeingDragged
                                  ? 'opacity-30 bg-emerald-500/10 dark:bg-emerald-500/20'
                                  : isOver
                                  ? 'border-t-2 border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10'
                                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                              }`}
                            >
                              {/* 0. Cột Thao tác Kéo Thả (Drag Handle) */}
                              <td className="py-3 px-3 text-center w-12">
                                <div
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', String(realIndex));
                                    e.dataTransfer.effectAllowed = 'move';
                                    setDraggedPermIndex(realIndex);
                                  }}
                                  onDragEnd={() => {
                                    setDraggedPermIndex(null);
                                    setDragOverPermIndex(null);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
                                  title="Bấm giữ và kéo thả để đổi thứ tự quyền"
                                >
                                  <GripVertical className="w-4 h-4" />
                                </div>
                              </td>

                              {/* 1. Mã Quyền */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span className="font-mono text-xs px-2.5 py-1 rounded-md text-amber-800 bg-amber-500/10 border border-amber-600/25 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/25 font-bold tracking-wider inline-block">
                                  {p.permission_id}
                                </span>
                              </td>

                              {/* 2. Tên quyền (Mã code UPPER_SNAKE) */}
                              <td className="py-3 px-4 font-mono text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                {p.code || p.name || p.permission_id}
                              </td>

                              {/* 3. Mô tả */}
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                                {p.description || '—'}
                              </td>

                              {/* 4. Nhóm (Group Badge) */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span
                                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shadow-xs inline-flex items-center gap-1 ${getPermissionGroupBadge(
                                    (p as any).group_code
                                  )}`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                                  {(p as any).group_code || 'SYSTEM'}
                                </span>
                              </td>

                              {/* 5. Cột Thao tác */}
                              <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                                <Tooltip title="Chỉnh sửa quyền này" placement="top" arrow>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setGenericFormData(buildPermissionFormData(p));
                                      setGenericModal({ open: true, type: 'permissions', item: p });
                                    }}
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-transparent rounded-lg transition cursor-pointer active:scale-95 shadow-xs"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                </Tooltip>
                                <Tooltip title="Xóa quyền này" placement="top" arrow>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleGenericDelete('permissions', p.permission_id, p.name || p.code || p.permission_id)
                                    }
                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900/70 dark:text-rose-400 dark:border-transparent rounded-lg transition cursor-pointer active:scale-95 shadow-xs"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </Tooltip>
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

                    {activeTab === 'units' && (
            <UnitTreeTable
              units={unitsList}
              onAddRoot={() => {
                setGenericFormData({ unit_id: '', name: '', parent_id: '', unit_type: 'trung_uong' });
                setGenericModal({ open: true, type: 'units', item: null });
              }}
              onAddChild={(parentUnit) => {
                let defaultType = 'phong';
                const parentCat = parentUnit.unit_type || getUnitCategory(parentUnit);
                if (parentUnit.unit_id === 'QK7') defaultType = 'su_doan';
                else if (parentUnit.unit_id === 'TQS') defaultType = 'khoa';
                else if (parentCat === 'su_doan') defaultType = 'trung_doan';
                else if (parentCat === 'trung_doan') defaultType = 'tieu_doan';
                else if (parentCat === 'tieu_doan') defaultType = 'dai_doi';
                else if (parentCat === 'dai_doi') defaultType = 'to';
                else if (parentCat === 'khoa') defaultType = 'bo_mon';
                else if (parentCat === 'trung_tam') defaultType = 'ban';
                else if (parentCat === 'bo_mon') defaultType = 'to';
                else if (parentCat === 'phong' || parentCat === 'ban') defaultType = 'to';
                setGenericFormData({ unit_id: '', name: '', parent_id: parentUnit.unit_id, unit_type: defaultType });
                setGenericModal({ open: true, type: 'units', item: null });
              }}
              onEdit={(u) => {
                setGenericFormData({ ...u, unit_type: u.unit_type || getUnitCategory(u) });
                setGenericModal({ open: true, type: 'units', item: u });
              }}
              onDelete={(u) => handleGenericDelete('units', u.unit_id, u.name)}
              onToast={(msg, type) => showToast(msg, type)}
            />
          )}

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

          {activeTab === 'levels' && (
            <div className="space-y-4">
              {/* Executive Header Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50/90 via-white to-amber-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/40 border border-amber-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-80 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_70%)] pointer-events-none" />
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 max-w-2xl">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-500/20 border border-amber-300/80 dark:border-amber-500/30 flex items-center justify-center shrink-0 shadow-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                          Cấp Độ Bảo Mật Dữ Liệu
                        </h1>
                        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold font-mono bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                          Clearance Cấp 1 - 5
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        Phân cấp 5 mức độ mật nhà nước và quốc phòng. Quy định quyền xem/tải và kích hoạt bắt buộc xác thực sinh trắc học vân tay 2FA từ Cấp 3 trở lên.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => loadLevels()}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
                      title="Tải lại danh sách"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-slate-500" />
                      <span>Đồng bộ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGenericFormData({ level_id: (levelsList.length || 0) + 1, code: '', name: '' });
                        setGenericModal({ open: true, type: 'levels', item: null });
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs shrink-0"
                    >
                      <Plus className="w-4 h-4" /> <span>Thêm mức bảo mật</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Bảng danh sách Cấp độ bảo mật */}
              <div className="bg-white dark:bg-slate-900/90 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 min-w-[700px]">
                    <thead className="bg-slate-50 dark:bg-slate-900/95 text-slate-500 dark:text-slate-400 uppercase text-[11px] border-b border-slate-200 dark:border-slate-800 font-semibold tracking-wider">
                      <tr>
                        <th className="py-3.5 px-4 w-28 whitespace-nowrap">Cấp Số</th>
                        <th className="py-3.5 px-4 w-36 whitespace-nowrap">Mã Ký Hiệu</th>
                        <th className="py-3.5 px-4 whitespace-nowrap">Tên Mức Độ Mật</th>
                        <th className="py-3.5 px-4 whitespace-nowrap">Quy Chuẩn An Ninh & Xác Thực</th>
                        <th className="py-3.5 px-4 text-right w-24 whitespace-nowrap">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {levelsList.map((lvl) => {
                        const conf = LEVEL_CONFIGS[lvl.level_id] || {
                          label: lvl.name,
                          badgeBg: 'bg-slate-500/10',
                          badgeText: 'text-slate-700 dark:text-slate-300',
                          border: 'border-slate-300',
                          badgeDot: 'bg-slate-500',
                          requires2FA: lvl.level_id >= 3,
                          desc: 'Cấp độ bảo mật dữ liệu',
                        };
                        return (
                          <tr key={lvl.level_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono border ${conf.badgeBg} ${conf.badgeText} ${conf.border}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${conf.badgeDot}`} />
                                Cấp {lvl.level_id}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {lvl.code}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div>
                                <span className="text-slate-900 dark:text-white font-bold text-sm block">
                                  {lvl.name}
                                </span>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                                  {conf.desc}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              {conf.requires2FA ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                  <Fingerprint className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                  <span>Bắt buộc Vân tay 2FA (ZKTeco ZK9500)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                  <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>Xác thực tài khoản (Clearance)</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <button
                                type="button"
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
                                type="button"
                                onClick={() => handleGenericDelete('levels', lvl.level_id, lvl.name)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900/70 dark:text-rose-400 dark:border-transparent rounded-lg transition-all cursor-pointer btn-tactile active:scale-95"
                                title="Xóa mức bảo mật"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ranks' && (
            <div className="space-y-4">
              {/* Executive Header Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50/90 via-white to-yellow-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/40 border border-amber-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-80 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_70%)] pointer-events-none" />
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 max-w-2xl">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-500/20 border border-amber-300/80 dark:border-amber-500/30 flex items-center justify-center shrink-0 shadow-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      <Award className="w-6 h-6 stroke-[2.2]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                          Danh Mục Cấp Bậc Quân Hàm
                        </h1>
                        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold font-mono bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                          {ranksList.length} cấp bậc
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        Chuẩn hóa cấp bậc quân đội theo quy định Bộ Quốc phòng. Số thứ tự nhỏ hiển thị ưu tiên trước trong dropdown hồ sơ quân nhân.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => loadRanks()}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
                      title="Tải lại danh sách"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-slate-500" />
                      <span>Đồng bộ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGenericFormData({ rank_id: getNextRankId(ranksList), name: '', sort_order: (ranksList.length + 1) * 10 });
                        setGenericModal({ open: true, type: 'ranks', item: null });
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs shrink-0"
                    >
                      <Plus className="w-4 h-4" /> <span>Thêm cấp bậc</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tactical Filter Toolbar */}
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={rankSearch}
                    onChange={(e) => setRankSearch(e.target.value)}
                    placeholder="Tìm theo mã (R-01...) hoặc tên cấp bậc (Đại tá, Thượng tá...)"
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                  {rankSearch && (
                    <button
                      type="button"
                      onClick={() => setRankSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setRankStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      rankStatusFilter === 'all'
                        ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    Tất cả ({ranksList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRankStatusFilter('active')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      rankStatusFilter === 'active'
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Đang dùng ({ranksList.filter((r) => r.active !== false).length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRankStatusFilter('inactive')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      rankStatusFilter === 'inactive'
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    <span>Đã ẩn ({ranksList.filter((r) => r.active === false).length})</span>
                  </button>
                </div>
              </div>

              {/* Bảng Cấp Bậc Quân Hàm */}
              <div className="bg-white dark:bg-slate-900/90 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 min-w-[700px]">
                    <thead className="bg-slate-50 dark:bg-slate-900/95 text-slate-500 dark:text-slate-400 uppercase text-[11px] border-b border-slate-200 dark:border-slate-800 font-semibold tracking-wider">
                      <tr>
                        <th className="py-3.5 px-4 w-28 whitespace-nowrap">Mã</th>
                        <th className="py-3.5 px-4">Tên Cấp Bậc Quân Hàm</th>
                        <th className="py-3.5 px-4 w-40 whitespace-nowrap">Thứ Tự Ưu Tiên</th>
                        <th className="py-3.5 px-4 w-36 whitespace-nowrap">Trạng Thái</th>
                        <th className="py-3.5 px-4 text-right w-24 whitespace-nowrap">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {filteredRanks.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400 dark:text-slate-500">
                            Không tìm thấy cấp bậc nào phù hợp với bộ lọc
                          </td>
                        </tr>
                      ) : (
                        filteredRanks.map((r) => (
                          <tr key={r.rank_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                                {r.rank_id}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="text-slate-900 dark:text-white font-bold text-sm">
                                {r.name}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px] border border-slate-200 dark:border-slate-700">
                                Thứ tự: {r.sort_order ?? 0}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {r.active !== false ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  <span>Đang dùng</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                  <span>Đã ẩn</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <button
                                type="button"
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
                                type="button"
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

          {activeTab === 'positions' && (
            <div className="space-y-4">
              {/* Executive Header Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-sky-50/90 via-white to-indigo-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/40 border border-sky-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-80 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_70%)] pointer-events-none" />
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 max-w-2xl">
                    <div className="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-500/20 border border-sky-300/80 dark:border-sky-500/30 flex items-center justify-center shrink-0 shadow-xs text-sky-700 dark:text-sky-400 mt-0.5">
                      <Briefcase className="w-6 h-6 stroke-[2.2]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                          Danh Mục Chức Vụ
                        </h1>
                        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold font-mono bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-500/40">
                          {positionsList.length} chức vụ
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        Chuẩn hóa chức vụ chỉ huy, giảng dạy và quản lý. Số thứ tự nhỏ hiển thị ưu tiên trước trong dropdown hồ sơ quân nhân.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => loadPositions()}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs"
                      title="Tải lại danh sách"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-slate-500" />
                      <span>Đồng bộ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGenericFormData({ position_id: getNextPositionId(positionsList), name: '', sort_order: (positionsList.length + 1) * 10 });
                        setGenericModal({ open: true, type: 'positions', item: null });
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-xs shrink-0"
                    >
                      <Plus className="w-4 h-4" /> <span>Thêm chức vụ</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tactical Filter Toolbar */}
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={positionSearch}
                    onChange={(e) => setPositionSearch(e.target.value)}
                    placeholder="Tìm theo mã (P-01...) hoặc tên chức vụ (Hiệu trưởng, Chính ủy, Trợ lý...)"
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  />
                  {positionSearch && (
                    <button
                      type="button"
                      onClick={() => setPositionSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setPositionStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      positionStatusFilter === 'all'
                        ? 'bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-500/40 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    Tất cả ({positionsList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPositionStatusFilter('active')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      positionStatusFilter === 'active'
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Đang dùng ({positionsList.filter((p) => p.active !== false).length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPositionStatusFilter('inactive')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      positionStatusFilter === 'inactive'
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    <span>Đã ẩn ({positionsList.filter((p) => p.active === false).length})</span>
                  </button>
                </div>
              </div>

              {/* Bảng Chức Vụ */}
              <div className="bg-white dark:bg-slate-900/90 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 min-w-[700px]">
                    <thead className="bg-slate-50 dark:bg-slate-900/95 text-slate-500 dark:text-slate-400 uppercase text-[11px] border-b border-slate-200 dark:border-slate-800 font-semibold tracking-wider">
                      <tr>
                        <th className="py-3.5 px-4 w-28 whitespace-nowrap">Mã</th>
                        <th className="py-3.5 px-4">Tên Chức Vụ</th>
                        <th className="py-3.5 px-4 w-40 whitespace-nowrap">Thứ Tự Ưu Tiên</th>
                        <th className="py-3.5 px-4 w-36 whitespace-nowrap">Trạng Thái</th>
                        <th className="py-3.5 px-4 text-right w-24 whitespace-nowrap">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {filteredPositions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400 dark:text-slate-500">
                            Không tìm thấy chức vụ nào phù hợp với bộ lọc
                          </td>
                        </tr>
                      ) : (
                        filteredPositions.map((p) => (
                          <tr key={p.position_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-bold text-sky-700 dark:text-sky-400 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
                                {p.position_id}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="text-slate-900 dark:text-white font-bold text-sm">
                                {p.name}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px] border border-slate-200 dark:border-slate-700">
                                Thứ tự: {p.sort_order ?? 0}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {p.active !== false ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  <span>Đang dùng</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                  <span>Đã ẩn</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <button
                                type="button"
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
                                type="button"
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

          {activeTab === 'logs' && (<SecurityAuditLog showToast={showToast} />)}
          {activeTab === 'sessions' && <SessionsPage embedded />}
          {activeTab === 'trash' && <TrashPage embedded />}
          {activeTab === 'approvals' && (
            <ApprovalQueuePage />
          )}
          {activeTab === 'protection_config' && (
            <ProtectedPermissionsConfigPage />
          )}

          {activeTab === 'lec-subjects'   && <LectureCatalogsPage catalogType="subjects" />}
          {activeTab === 'lec-classes'    && <LectureCatalogsPage catalogType="classes" />}
          {activeTab === 'lec-classrooms' && <LectureCatalogsPage catalogType="classrooms" />}
          {activeTab === 'lec-buildings'  && <LectureBuildingsPage />}
        </main>
      </div>

      {/* ============== MODALS ============== */}

      <UserFormModal
        open={userModalOpen}
        user={selectedUser}
        units={unitsList}
        securityLevels={levelsList}
        currentUserClearance={user?.clearance_level_id || 1}
        isAdminUser={isAdmin}
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
        onSuccess={loadUsers}
        onToast={showToast}
      />


            <PinManageModal
        open={pinManageModal.open}
        user={pinManageModal.user}
        onClose={() => setPinManageModal({ open: false, user: null })}
        onChanged={loadUsers}
        onToast={showToast}
      />


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

      {createPortal(
        <AnimatePresence>
          {genericModal.open && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.15 }}
                className={`bg-white dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl w-full ${
                  genericModal.type === 'permissions' ? 'max-w-2xl' : 'max-w-md'
                } p-6 shadow-2xl text-xs space-y-4`}
              >
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                      {genericModal.type === 'levels' ? (
                        <ShieldCheck className="w-5 h-5" />
                      ) : genericModal.type === 'ranks' ? (
                        <Award className="w-5 h-5" />
                      ) : genericModal.type === 'positions' ? (
                        <Briefcase className="w-5 h-5" />
                      ) : genericModal.type === 'units' ? (
                        <Building className="w-5 h-5" />
                      ) : genericModal.type === 'roles' ? (
                        <ShieldAlert className="w-5 h-5" />
                      ) : genericModal.type === 'doctypes' ? (
                        <FileText className="w-5 h-5" />
                      ) : (
                        <KeyRound className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white">
                        {genericModal.item ? 'Chỉnh Sửa' : 'Thêm Mới'}{' '}
                        {genericModal.type === 'units' ? 'Đơn Vị'
                          : genericModal.type === 'roles' ? 'Vai Trò'
                            : genericModal.type === 'doctypes' ? 'Loại Văn Bản'
                              : genericModal.type === 'levels' ? 'Mức Bảo Mật'
                                : genericModal.type === 'ranks' ? 'Cấp Bậc Quân Hàm'
                                  : genericModal.type === 'positions' ? 'Chức Vụ'
                                    : genericModal.type === 'permissions' ? 'Quyền (Permission)'
                                      : genericModal.type}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Điền thông tin chuẩn hóa và bấm &ldquo;Lưu lại&rdquo; để cập nhật hệ thống
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGenericModal({ open: false, type: null, item: null })}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
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
                        <input type="text" readOnly disabled value={genericFormData.role_id || ''} placeholder="VD: ROL-07"
                          className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 font-mono cursor-not-allowed opacity-80"
                          title="Mã vai trò được hệ thống tự động sinh theo thứ tự" />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Tên Vai Trò *</label>
                        <input type="text" value={genericFormData.name || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, name: e.target.value })} required
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20" />
                      </div>
                    </>
                  )}

                  {genericModal.type === 'units' && (
                    <>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-sm">Mã Đơn Vị *</label>
                        <input type="text" value={genericFormData.unit_id || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, unit_id: e.target.value })} required
                          placeholder="VD: QK7, TQS, BQP, U-CT..."
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-sm font-mono font-medium focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20" />
                        {genericModal.item && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            Lưu ý: Thay đổi mã đơn vị sẽ tự động đồng bộ sang tất cả văn bản, tài khoản và đơn vị trực thuộc.
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-sm">Tên Đơn Vị *</label>
                        <input type="text" value={genericFormData.name || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, name: e.target.value })} required
                          placeholder="VD: Trường Quân sự Quân khu 7"
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-sm font-medium" />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-sm">Phân Loại Đơn Vị *</label>
                        <select value={genericFormData.unit_type || 'phong'}
                          onChange={(e) => setGenericFormData({ ...genericFormData, unit_type: e.target.value })} required
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 font-medium text-sm cursor-pointer">
                          <option value="trung_uong">Cấp Trung ương / Bộ</option>
                          <option value="quan_khu">Cấp Quân khu</option>
                          <option value="su_doan">Sư đoàn</option>
                          <option value="trung_doan">Trung đoàn / Lữ đoàn</option>
                          <option value="tieu_doan">Tiểu đoàn</option>
                          <option value="dai_doi">Đại đội</option>
                          <option value="ban_chi_huy">Ban Chỉ huy</option>
                          <option value="nha_truong">Nhà trường / Viện</option>
                          <option value="trung_tam">Trung tâm</option>
                          <option value="co_quan">Cơ quan</option>
                          <option value="khoa">Khoa</option>
                          <option value="bo_mon">Bộ môn</option>
                          <option value="phong">Phòng</option>
                          <option value="ban">Ban</option>
                          <option value="to">Tổ</option>
                          <option value="lop">Lớp</option>
                        </select>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Quy định cấp bậc hiển thị và thẩm quyền quản lý của đơn vị</p>
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-sm">Đơn Vị Cấp Trên</label>
                        <select value={genericFormData.parent_id || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, parent_id: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 font-medium text-sm cursor-pointer">
                          <option value="">Cấp cao nhất (Không có cấp trên)</option>
                          {[...unitsList]
                            .filter((u) => !genericModal.item || u.unit_id !== genericModal.item.unit_id)
                            .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
                            .map((u) => (
                              <option key={u.unit_id} value={u.unit_id}>{u.name}</option>
                            ))}
                        </select>
                      </div>
                    </>
                  )}

                  {genericModal.type === 'doctypes' && (
                    <>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Mã Loại *</label>
                        <input type="text" disabled={Boolean(genericModal.item)} value={genericFormData.type_id || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, type_id: e.target.value })} required
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 disabled:opacity-50 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20" />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Tên Loại Văn Bản *</label>
                        <input type="text" value={genericFormData.name || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, name: e.target.value })} required
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20" />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Mô Tả</label>
                        <input type="text" value={genericFormData.description || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, description: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20" />
                      </div>
                    </>
                  )}

                  {genericModal.type === 'levels' && (
                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">Cấp Độ Bảo Mật (1 - 5) *</label>
                        <input type="number" min="1" max="5" disabled={Boolean(genericModal.item)}
                          value={genericFormData.level_id || 1}
                          onChange={(e) => setGenericFormData({ ...genericFormData, level_id: Number(e.target.value) })} required
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono text-sm disabled:opacity-50 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20" />
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Cấp 1: Công khai • Cấp 2: Nội bộ • Cấp 3: Mật • Cấp 4: Tối mật • Cấp 5: Tuyệt mật</p>
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">Mã Ký Hiệu * (UPPER_CASE)</label>
                        <input type="text" value={genericFormData.code || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, code: e.target.value.toUpperCase() })} required
                          placeholder="VD: CONFIDENTIAL"
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono text-sm uppercase focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20" />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">Tên Mức Bảo Mật *</label>
                        <input type="text" value={genericFormData.name || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, name: e.target.value })} required
                          placeholder="VD: Mật"
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20" />
                      </div>
                    </div>
                  )}

                  {genericModal.type === 'ranks' && (
                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">Mã Cấp Bậc (Tự động)</label>
                        <input type="text" readOnly disabled value={genericFormData.rank_id || ''} placeholder="VD: R-21"
                          className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 font-mono text-sm cursor-not-allowed opacity-80"
                          title="Mã cấp bậc được hệ thống tự động sinh theo thứ tự" />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">Tên Cấp Bậc Quân Hàm *</label>
                        <input type="text" value={genericFormData.name || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, name: e.target.value })}
                          placeholder="VD: Trung tá QNCN" required
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20" />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">Thứ Tự Ưu Tiên Hiển Thị</label>
                        <input type="number" value={genericFormData.sort_order ?? 0}
                          onChange={(e) => setGenericFormData({ ...genericFormData, sort_order: Number(e.target.value) })}
                          placeholder="VD: 10, 20, 30..."
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20" />
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Số thứ tự nhỏ hơn sẽ hiển thị trước trong danh sách chọn</p>
                      </div>
                      {genericModal.item && (
                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                          <input type="checkbox" checked={genericFormData.active !== false}
                            onChange={(e) => setGenericFormData({ ...genericFormData, active: e.target.checked })}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
                          <span>Kích hoạt sử dụng cấp bậc này</span>
                        </label>
                      )}
                    </div>
                  )}

                  {genericModal.type === 'positions' && (
                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">Mã Chức Vụ (Tự động)</label>
                        <input type="text" readOnly disabled value={genericFormData.position_id || ''} placeholder="VD: P-19"
                          className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 font-mono text-sm cursor-not-allowed opacity-80"
                          title="Mã chức vụ được hệ thống tự động sinh theo thứ tự" />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">Tên Chức Vụ *</label>
                        <input type="text" value={genericFormData.name || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, name: e.target.value })}
                          placeholder="VD: Phó phòng Kỹ thuật" required
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20" />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">Thứ Tự Ưu Tiên Hiển Thị</label>
                        <input type="number" value={genericFormData.sort_order ?? 0}
                          onChange={(e) => setGenericFormData({ ...genericFormData, sort_order: Number(e.target.value) })}
                          placeholder="VD: 10, 20, 30..."
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20" />
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Số thứ tự nhỏ hơn sẽ hiển thị trước trong danh sách chọn</p>
                      </div>
                      {genericModal.item && (
                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                          <input type="checkbox" checked={genericFormData.active !== false}
                            onChange={(e) => setGenericFormData({ ...genericFormData, active: e.target.checked })}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
                          <span>Kích hoạt sử dụng chức vụ này</span>
                        </label>
                      )}
                    </div>
                  )}

                  {genericModal.type === 'permissions' && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Mã Permission ID *</label>
                          <input type="text" value={genericFormData.permission_id || ''}
                            onChange={(e) => setGenericFormData({ ...genericFormData, permission_id: e.target.value })}
                            disabled={Boolean(genericModal.item)} placeholder="PERM-DOC-10" required
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono disabled:opacity-50 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20" />
                        </div>
                        <div>
                          <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Mã code (UPPER_SNAKE) *</label>
                          <input type="text" value={genericFormData.code || ''}
                            onChange={(e) => setGenericFormData({ ...genericFormData, code: e.target.value.toUpperCase() })}
                            disabled={Boolean(genericModal.item)} placeholder="DOC_EXPORT" required
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono disabled:opacity-50 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Mô tả</label>
                        <input type="text" value={genericFormData.description || ''}
                          onChange={(e) => setGenericFormData({ ...genericFormData, description: e.target.value })}
                          placeholder="Xuất văn bản ra PDF..."
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20" />
                      </div>

                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Nhóm (group_code) *</label>
                        <select value={genericFormData.group_code || 'DOCUMENT'}
                          onChange={(e) => setGenericFormData({ ...genericFormData, group_code: e.target.value })} required
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 cursor-pointer focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20">
                          {PERMISSION_GROUPS.map((g) => (
                            <option key={g.value} value={g.value}>{g.label}</option>
                          ))}
                        </select>
                      </div>

                      <fieldset className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl p-3.5 space-y-3">
                        <legend className="px-2 text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                          Phân loại con (Subgroup)
                        </legend>

                        <div>
                          <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Subgroup key</label>
                          <input type="text" value={genericFormData.subgroup_key || ''}
                            onChange={(e) => setGenericFormData({ ...genericFormData, subgroup_key: e.target.value })}
                            placeholder="doc-view, doc-edit, doc-danger..."
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20" />
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                            Dùng chung với quyền khác trong cùng nhóm. VD: <code className="font-mono text-amber-500">doc-view</code>
                          </p>
                        </div>
                        <div>
                          <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Nhãn hiển thị</label>
                          <input type="text" value={genericFormData.subgroup_label || ''}
                            onChange={(e) => setGenericFormData({ ...genericFormData, subgroup_label: e.target.value })}
                            placeholder="Xem & Tra cứu"
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                              Thứ tự trong nhóm
                            </label>
                            <input type="number" min={0} max={999} value={genericFormData.subgroup_order ?? 50}
                              onChange={(e) => setGenericFormData({ ...genericFormData, subgroup_order: Number(e.target.value) })}
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20" />
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">10 = đầu, 99 = cuối</p>
                          </div>
                          <div>
                            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Mức độ nguy hiểm (tone)</label>
                            <select value={genericFormData.subgroup_tone || 'read'}
                              onChange={(e) => setGenericFormData({ ...genericFormData, subgroup_tone: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 cursor-pointer focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20">
                              {PERMISSION_TONES.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </fieldset>

                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Sort order tổng (thanh tab)</label>
                        <input type="number" value={genericFormData.sort_order ?? 0}
                          onChange={(e) => setGenericFormData({ ...genericFormData, sort_order: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20" />
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-2.5">
                  <button type="button" onClick={() => setGenericModal({ open: false, type: null, item: null })}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-transparent rounded-xl transition font-medium cursor-pointer">
                    Hủy bỏ
                  </button>
                  <button type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer active:scale-95">
                    <Save className="w-3.5 h-3.5" /> Lưu lại
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    )}

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

      <Toast toast={toast} onClose={() => setToast((prev) => ({ ...prev, show: false }))} />
    </div>
  );
};