import React from 'react';
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
} from 'lucide-react';

export type AdminTab =
  | 'overview'
  | 'users'
  | 'roles'
  | 'permissions'
  | 'units'
  | 'doctypes'
  | 'levels'
  | 'logs'
  | string;

export interface SidebarProps {
  activeTab?: AdminTab;
  activeId?: string;
  onTabChange?: (tab: any) => void;
  onSelect?: (id: any) => void;
  open?: boolean;
  onClose?: () => void;
  counts?: {
    users?: number;
    roles?: number;
    permissions?: number;
    units?: number;
    doctypes?: number;
    levels?: number;
    ranks?: number;
    positions?: number;
  };
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  activeId,
  onTabChange,
  onSelect,
  open = true,
  onClose,
  counts,
  collapsed = false,
  onToggleCollapse,
}) => {
  const currentTab = activeTab || activeId || 'overview';
  const handleSelect = (id: string) => {
    if (onTabChange) onTabChange(id);
    if (onSelect) onSelect(id);
    if (onClose) onClose();
  };

  const navItems: Array<{ id: string; label: string; icon: any }> = [
    { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'users', label: 'Người dùng', icon: Users },
    { id: 'roles', label: 'Vai trò', icon: KeyRound },
    { id: 'permissions', label: 'Quyền', icon: ShieldAlert },
    { id: 'units', label: 'Đơn vị', icon: Building },
    { id: 'doctypes', label: 'Loại văn bản', icon: FileText },
    { id: 'levels', label: 'Mức bảo mật', icon: Shield },
    { id: 'ranks', label: 'Cấp bậc', icon: Award },
    { id: 'positions', label: 'Chức vụ', icon: Briefcase },
    { id: 'logs', label: 'Nhật ký', icon: Activity },
  ];

  return (
    <div className="h-full flex flex-col justify-between bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 select-none">
      <div className="p-2 sm:p-3 space-y-1 overflow-y-auto">
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
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
              title={collapsed ? 'Mở rộng danh mục quản trị' : 'Thu gọn danh mục quản trị'}
              aria-label={collapsed ? 'Mở rộng danh mục quản trị' : 'Thu gọn danh mục quản trị'}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Nav Items */}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              title={item.label}
              className={`w-full flex items-center ${
                collapsed ? 'justify-center p-2.5' : 'justify-start space-x-3 px-3 py-2.5'
              } rounded-xl text-xs transition cursor-pointer relative group ${
                isActive
                  ? 'bg-purple-600/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 font-semibold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80 font-medium'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {collapsed && (
                <span className="hidden md:block absolute left-full ml-2 px-2.5 py-1 bg-slate-900 dark:bg-slate-800 text-white text-[11px] font-medium rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 border border-slate-700/60">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
