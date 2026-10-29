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
  Trash2,
  Monitor,
  Bell,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

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
  | string;

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
  const currentTab = activeTab || activeId || 'overview';

  const handleSelect = (id: string) => {
    onTabChange?.(id);
    onSelect?.(id);
    onClose?.();
  };

  const navItems: Array<{ id: string; label: string; icon: any; permission?: string }> = [
    { id: 'overview',    label: 'Tổng quan',    icon: LayoutDashboard, permission: 'SYSTEM_STATS_VIEW' },
    { id: 'approvals',   label: 'Phê duyệt yêu cầu', icon: Bell, permission: 'APPROVAL_VALIDATE' },
    { id: 'users',       label: 'Người dùng',   icon: Users,           permission: 'USER_VIEW' },
    { id: 'roles',       label: 'Vai trò',      icon: KeyRound,        permission: 'ROLE_VIEW' },
    { id: 'permissions', label: 'Quyền',        icon: ShieldAlert,     permission: 'PERMISSION_VIEW' },
    { id: 'units',       label: 'Đơn vị',       icon: Building,        permission: 'UNIT_VIEW' },
    { id: 'doctypes',    label: 'Loại văn bản', icon: FileText,        permission: 'DOCTYPE_VIEW' },
    { id: 'levels',      label: 'Mức bảo mật',  icon: Shield,          permission: 'SECLEVEL_VIEW' },
    { id: 'ranks',       label: 'Cấp bậc',      icon: Award,           permission: 'RANK_VIEW' },
    { id: 'positions',   label: 'Chức vụ',      icon: Briefcase,       permission: 'POSITION_VIEW' },
    { id: 'logs',        label: 'Nhật ký',      icon: Activity,        permission: 'AUDIT_VIEW' },
    { id: 'sessions',    label: 'Phiên online', icon: Monitor,         permission: 'SESSION_VIEW' },
    { id: 'trash',       label: 'Thùng rác',    icon: Trash2,          permission: 'DOC_TRASH_VIEW' },
  ];

  // Lọc các item mà user có quyền xem
  const visibleItems = navItems.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );

  // ✅ FIX TẠI ĐÂY: Nếu không có bất kỳ mục nào được phép hiển thị, ẩn toàn bộ Sidebar
  // Bao gồm cả tiêu đề "DANH MỤC QUẢN TRỊ" và nút thu gọn
  if (visibleItems.length === 0) {
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
              title={collapsed ? 'Mở rộng danh mục quản trị' : undefined}
              placement="right"
              mouseEnterDelay={0.2}
            >
              <button
                onClick={onToggleCollapse}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
                title={!collapsed ? 'Thu gọn danh mục quản trị' : undefined}
                aria-label={collapsed ? 'Mở rộng danh mục quản trị' : 'Thu gọn danh mục quản trị'}
              >
                {collapsed ? (
                  <ChevronRight className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </button>
            </Tooltip>
          )}
        </div>

        {/* Nav Items */}
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          const buttonElement = (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className={`w-full flex items-center ${
                collapsed ? 'justify-center p-2.5' : 'justify-start space-x-3 px-3 py-2.5'
              } rounded-xl text-xs transition cursor-pointer ${
                isActive
                  ? 'bg-emerald-500/15 border-l-4 border-emerald-500 text-emerald-700 dark:text-emerald-400 border-t border-b border-r border-emerald-500/25 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80 font-medium border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {counts?.[item.id] ? (
                <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold shrink-0">
                  {counts[item.id]! > 99 ? '99+' : counts[item.id]}
                </span>
              ) : null}
            </button>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.id} title={
                counts?.[item.id]
                  ? `${item.label} (${counts[item.id]} chờ duyệt)`
                  : item.label
              } placement="right" mouseEnterDelay={0.15}>
                {buttonElement}
              </Tooltip>
            );
          }

          return buttonElement;
        })}
      </div>
    </div>
  );
};