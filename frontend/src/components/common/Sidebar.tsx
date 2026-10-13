import React from 'react';
import {
  LayoutDashboard,
  Users,
  KeyRound,
  ShieldAlert,
  Building,
  FileText,
  Shield,
  Activity
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
  backendStatus?: 'OK' | 'ERROR' | 'LOADING' | string;
  counts?: {
    users?: number;
    roles?: number;
    permissions?: number;
    units?: number;
    doctypes?: number;
    levels?: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  activeId,
  onTabChange,
  onSelect,
  open = true,
  onClose,
  backendStatus = 'OK',
  counts
}) => {
  const currentTab = activeTab || activeId || 'overview';
  const handleSelect = (id: string) => {
    if (onTabChange) onTabChange(id);
    if (onSelect) onSelect(id);
    if (onClose) onClose();
  };

  const navItems: Array<{ id: string; label: string; icon: any; count?: number }> = [
    { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'users', label: 'Người dùng', icon: Users, count: counts?.users },
    { id: 'roles', label: 'Vai trò', icon: KeyRound, count: counts?.roles },
    { id: 'permissions', label: 'Quyền', icon: ShieldAlert, count: counts?.permissions },
    { id: 'units', label: 'Đơn vị', icon: Building, count: counts?.units },
    { id: 'doctypes', label: 'Loại văn bản', icon: FileText, count: counts?.doctypes },
    { id: 'levels', label: 'Mức bảo mật', icon: Shield, count: counts?.levels },
    { id: 'logs', label: 'Nhật ký', icon: Activity },
  ];

  return (
    <div className="h-full flex flex-col justify-between">
      <div className="p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Danh mục Quản trị
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition cursor-pointer ${
                isActive
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 font-medium'
              }`}
            >
              <span className="flex items-center space-x-3">
                <Icon className="w-4 h-4 text-center" />
                <span>{item.label}</span>
              </span>
              {item.count !== undefined && (
                <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Backend Status Widget */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60">
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px]">
          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5 font-medium">
              <span
                className={`w-2 h-2 rounded-full ${
                  backendStatus === 'OK' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                }`}
              />
              Hệ thống Backend
            </span>
            <span
              className={`font-bold ${
                backendStatus === 'OK' ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {backendStatus}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
