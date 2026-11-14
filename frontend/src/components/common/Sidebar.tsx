import React from 'react';
import { Tooltip } from 'antd';
import {
  LayoutDashboard,
  Users,
  KeyRound,
  ShieldAlert,
  Building,
  FileText,
  Shield,
  Activity,
  Award,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Trash2,
  Monitor,
  Bell,
  Lock,
  BookOpen,
  GraduationCap,
  Building2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';

/** @deprecated Dùng chuỗi id trực tiếp — giữ type cũ để tương thích caller legacy. */
export type AdminTab =
  | 'overview'
  | 'users'
  | 'roles'
  | 'permissions'
  | 'units'
  | 'doctypes'
  | 'levels'
  | 'ranks'
  | 'positions'
  | 'logs'
  | 'sessions'
  | 'trash'
  | 'protection_config'
  | 'approvals'
  | string;

export interface NavItem {
  id: string;
  label: string;
  icon: any;
  permission?: string;
}

export interface NavGroup {
  id: string;
  title?: string;
  items: NavItem[];
}

/**
 * Cấu trúc phân nhóm Navigation Sidebar chuẩn kiến trúc QK7 DataHub:
 * 1. ĐIỀU HÀNH CHUNG: Tổng quan
 * 2. PHÂN HỆ DỮ LIỆU SỐ: Phê duyệt yêu cầu, Loại văn bản
 * 3. HỆ THỐNG & BẢO MẬT: Khóa bảo vệ, Người dùng, Vai trò, Quyền, Đơn vị, Mức bảo mật, Cấp bậc, Chức vụ, Nhật ký, Phiên online, Thùng rác
 * (Sẵn sàng mở rộng thêm Bài giảng số, Học liệu số, Thư viện số trong tương lai)
 */
export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    id: 'general',
    items: [
      { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard, permission: 'SYSTEM_STATS_VIEW' },
    ],
  },
  {
    id: 'digital_data',
    title: 'Dữ liệu số',
    items: [
      { id: 'approvals', label: 'Phê duyệt yêu cầu', icon: Bell, permission: 'APPROVAL_VALIDATE' },
      { id: 'doctypes',  label: 'Loại văn bản',      icon: FileText, permission: 'DOCTYPE_VIEW' },
    ],
  },
  {
    id: 'system_security',
    title: 'Hệ thống & Bảo mật',
    items: [
      { id: 'protection_config', label: 'Khóa bảo vệ',   icon: Lock,        permission: 'PERMISSION_VIEW' },
      { id: 'users',             label: 'Người dùng',    icon: Users,       permission: 'USER_VIEW' },
      { id: 'roles',             label: 'Vai trò',       icon: KeyRound,    permission: 'ROLE_VIEW' },
      { id: 'permissions',       label: 'Quyền',         icon: ShieldAlert, permission: 'PERMISSION_VIEW' },
      { id: 'units',             label: 'Đơn vị',        icon: Building,    permission: 'UNIT_VIEW' },
      { id: 'levels',            label: 'Mức bảo mật',   icon: Shield,      permission: 'SECLEVEL_VIEW' },
      { id: 'ranks',             label: 'Cấp bậc',       icon: Award,       permission: 'RANK_VIEW' },
      { id: 'positions',         label: 'Chức vụ',       icon: Briefcase,   permission: 'POSITION_VIEW' },
      { id: 'logs',              label: 'Nhật ký',       icon: Activity,    permission: 'AUDIT_VIEW' },
      { id: 'sessions',          label: 'Phiên online',  icon: Monitor,     permission: 'SESSION_VIEW' },
      { id: 'trash',             label: 'Thùng rác',     icon: Trash2,      permission: 'DOC_TRASH_VIEW' },
    ],
  },

  {
    id: 'lecture_catalogs',
    title: 'Bài giảng số',
    items: [
      { id: 'lec-subjects',   label: 'Môn học',     icon: BookOpen,     permission: 'SUBJECT_VIEW' },
      { id: 'lec-classes',    label: 'Lớp học',     icon: GraduationCap, permission: 'CLASS_VIEW' },
      { id: 'lec-classrooms', label: 'Giảng đường', icon: Building2,    permission: 'CLASSROOM_VIEW' },
    ],
  },
];

export interface SidebarProps {
  activeTab?: string;
  activeId?: string;
  onTabChange?: (tab: any) => void;
  onSelect?: (id: any) => void;
  /** @deprecated Không còn dùng trong render — giữ để tương thích caller cũ. */
  open?: boolean;
  onClose?: () => void;
  counts?: Record<string, number>;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  activeId,
  onTabChange,
  onSelect,
  onClose,
  counts,
  collapsed = false,
  onToggleCollapse,
}) => {
  const { hasPermission } = useAuth();
  const { isDark } = useTheme();
  const currentTab = activeTab || activeId || 'overview';

  const handleSelect = (id: string) => {
    onTabChange?.(id);
    onSelect?.(id);
    onClose?.();
  };

  // Lọc từng nhóm theo quyền của user
  const visibleGroups = React.useMemo(() => {
    return ADMIN_NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || hasPermission(item.permission)),
    })).filter((group) => group.items.length > 0);
  }, [hasPermission]);

  // Quản lý trạng thái thu gọn/mở rộng từng phân nhóm khi Sidebar mở rộng
  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({});

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Tự động mở phân nhóm chứa tab đang được chọn để không làm gián đoạn người dùng
  React.useEffect(() => {
    const activeGroup = visibleGroups.find((g) => g.items.some((i) => i.id === currentTab));
    if (activeGroup && collapsedGroups[activeGroup.id]) {
      setCollapsedGroups((prev) => ({
        ...prev,
        [activeGroup.id]: false,
      }));
    }
  }, [currentTab, visibleGroups]);

  // Nếu không có bất kỳ mục nào được phép hiển thị, ẩn toàn bộ Sidebar
  if (visibleGroups.length === 0) {
    return null;
  }

  return (
    <div className="h-full flex flex-col justify-between bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 select-none overflow-x-hidden">
      <div className="p-2 sm:p-2.5 pb-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {/* Sidebar Header with Toggle button */}
        <div
          className={`py-2 px-1 flex items-center ${
            collapsed ? 'justify-center' : 'justify-between'
          } border-b border-slate-100 dark:border-slate-800/80 mb-2`}
        >
          {!collapsed && (
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate pl-1">
              Danh mục Quản trị
            </span>
          )}
          {onToggleCollapse && (
            <Tooltip
              title={
                collapsed ? (
                  <div className="text-left py-0.5 select-none">
                    <div className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                      Mở rộng danh mục quản trị
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Xem đầy đủ tên phân nhóm & bài mục
                    </div>
                  </div>
                ) : undefined
              }
              placement="right"
              mouseEnterDelay={0.08}
              overlayClassName="qk7-sidebar-tooltip"
              color={isDark ? '#0f172a' : '#ffffff'}
              overlayInnerStyle={{
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '8px 12px',
                boxShadow: isDark
                  ? '0 16px 36px -4px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05)'
                  : '0 12px 28px -4px rgba(15, 23, 42, 0.14), 0 4px 10px -2px rgba(15, 23, 42, 0.05)',
              }}
            >
              <button
                onClick={onToggleCollapse}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer group"
                title={!collapsed ? 'Thu gọn danh mục quản trị' : undefined}
                aria-label={collapsed ? 'Mở rộng danh mục quản trị' : 'Thu gọn danh mục quản trị'}
              >
                {collapsed ? (
                  <ChevronRight className="w-4 h-4 text-emerald-700 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                ) : (
                  <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                )}
              </button>
            </Tooltip>
          )}
        </div>

        {/* Render từng nhóm navigation */}
        {visibleGroups.map((group, groupIdx) => {
          const isGroupCollapsed = !collapsed && !!collapsedGroups[group.id];

          return (
            <div key={group.id} className="space-y-1">
              {/* Tiêu đề nhóm khi Sidebar mở rộng (có tính năng click thu gọn / mở rộng) */}
              {group.title && !collapsed && (
                <div
                  className={`px-1 pt-2 pb-1 ${
                    groupIdx > 0 ? 'mt-2 border-t border-slate-100 dark:border-slate-800/60' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleGroupCollapse(group.id)}
                    className="w-full flex items-center justify-between px-1.5 py-1 rounded-lg text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 uppercase tracking-wider transition cursor-pointer select-none group"
                    title={isGroupCollapsed ? `Mở rộng ${group.title}` : `Thu gọn ${group.title}`}
                    aria-expanded={!isGroupCollapsed}
                  >
                    <span className="truncate">{group.title}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 font-mono">
                        {group.items.length}
                      </span>
                      {isGroupCollapsed ? (
                        <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-transform duration-200" />
                      ) : (
                        <ChevronUp className="w-3 h-3 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-transform duration-200" />
                      )}
                    </div>
                  </button>
                </div>
              )}

              {/* Tactical Segment Divider giữa các nhóm khi Sidebar thu gọn */}
              {groupIdx > 0 && collapsed && (
                <div className="py-2 px-1 flex items-center justify-center">
                  <div className="w-6 h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent" />
                </div>
              )}

              {/* Danh sách items trong nhóm (Accordion Animation) */}
              <AnimatePresence initial={false}>
                {(!isGroupCollapsed || collapsed) && (
                  <motion.div
                    initial={!collapsed ? { opacity: 0, height: 0 } : undefined}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={!collapsed ? { opacity: 0, height: 0 } : undefined}
                    transition={{ duration: 0.18, ease: 'easeInOut' }}
                    className="space-y-1 overflow-hidden"
                  >
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = currentTab === item.id;
                      const count = counts?.[item.id];
                      const hasCount = typeof count === 'number' && count > 0;
                      const displayCount = hasCount ? (count > 99 ? '99+' : String(count)) : null;

                      const buttonElement = (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item.id)}
                          className={`w-full flex items-center ${
                            collapsed ? 'justify-center p-2.5 relative' : 'justify-start space-x-3 px-3 py-2'
                          } rounded-xl text-xs transition-all duration-150 cursor-pointer group select-none ${
                            isActive
                              ? collapsed
                                ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold shadow-xs'
                                : 'bg-emerald-500/15 border-l-4 border-emerald-500 text-emerald-700 dark:text-emerald-400 border-t border-b border-r border-emerald-500/25 font-semibold shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80 font-medium border border-transparent'
                          }`}
                        >
                          {/* Tactical Active Indicator Bar (vạch chỉ thị cạnh trái phát quang hoàn hảo khi thu gọn) */}
                          {collapsed && isActive && (
                            <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-emerald-600 dark:bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
                          )}

                          {/* Vùng Icon căn giữa hoàn hảo khi thu gọn (Zero-Misalignment) */}
                          <div className="relative inline-flex items-center justify-center shrink-0">
                            <Icon
                              className={`w-4 h-4 flex-shrink-0 group-hover:scale-110 transition-transform duration-150 ${
                                isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'
                              }`}
                            />
                            {/* Chỉ số thông báo dạng số mũ bình phương (a²) góc trên bên phải khi Sidebar thu gọn */}
                            {collapsed && hasCount && (
                              <span
                                className="absolute -top-2 -right-2.5 inline-flex items-center justify-center min-w-[15px] h-[15px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold shadow-xs leading-none ring-2 ring-white dark:ring-slate-900 pointer-events-none select-none tabular-nums animate-in fade-in zoom-in duration-200"
                                title={`${count} chờ xử lý`}
                              >
                                {displayCount}
                              </span>
                            )}
                          </div>

                          {/* Nhãn và Badge khi mở rộng Sidebar */}
                          {!collapsed && (
                            <>
                              <span className="truncate flex-1 text-left">{item.label}</span>
                              {hasCount && (
                                <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold shrink-0 shadow-xs tabular-nums">
                                  {displayCount}
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      );

                      if (collapsed) {
                        const isDigitalData = group.id === 'digital_data';
                        const isSystemSec = group.id === 'system_security';

                        return (
                          <Tooltip
                            key={item.id}
                            overlayClassName="qk7-sidebar-tooltip"
                            color={isDark ? '#0f172a' : '#ffffff'}
                            mouseEnterDelay={0.06}
                            placement="right"
                            overlayInnerStyle={{
                              backgroundColor: isDark ? '#0f172a' : '#ffffff',
                              border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #e2e8f0',
                              borderRadius: 10,
                              padding: '8px 12px',
                              boxShadow: isDark
                                ? '0 16px 36px -4px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05)'
                                : '0 12px 28px -4px rgba(15, 23, 42, 0.14), 0 4px 10px -2px rgba(15, 23, 42, 0.05)',
                            }}
                            title={
                              <div className="text-left py-0.5 select-none min-w-[125px]">
                                {/* Header nhóm ngữ cảnh */}
                                {group.title ? (
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <div
                                      className={`text-[9.5px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                                        isDigitalData
                                          ? 'text-emerald-700 dark:text-emerald-400'
                                          : isSystemSec
                                          ? 'text-indigo-600 dark:text-indigo-400'
                                          : 'text-slate-500 dark:text-slate-400'
                                      }`}
                                    >
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full shrink-0 inline-block ${
                                          isDigitalData
                                            ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]'
                                            : isSystemSec
                                            ? 'bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.8)]'
                                            : 'bg-slate-400'
                                        }`}
                                      />
                                      <span className="truncate">{group.title}</span>
                                    </div>
                                    {isActive && (
                                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 shrink-0">
                                        Đang mở
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <div className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 inline-block" />
                                      <span>Điều hành chung</span>
                                    </div>
                                    {isActive && (
                                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 shrink-0">
                                        Đang mở
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Tên mục */}
                                <div className="font-bold text-[12.5px] text-slate-900 dark:text-white leading-snug">
                                  {item.label}
                                </div>

                                {/* Thông báo chờ xử lý nếu có */}
                                {hasCount && (
                                  <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-white/[0.08] flex items-center justify-between gap-2">
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Chờ xử lý:</span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 tabular-nums">
                                      {count}
                                    </span>
                                  </div>
                                )}
                              </div>
                            }
                          >
                            {buttonElement}
                          </Tooltip>
                        );
                      }

                      return buttonElement;
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};
