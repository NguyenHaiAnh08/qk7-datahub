import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Building2, CloudUpload } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ROUTE_PATHS } from '../../routes/routePaths';

export type DataHubSubTab = 'portal' | 'myunit' | 'desk';

export interface DataHubSubNavProps {
  activeTab: DataHubSubTab;
}

export const DataHubSubNav: React.FC<DataHubSubNavProps> = ({ activeTab }) => {
  const { user, hasPermission } = useAuth();

  const isGuest = !user || user.user_id === 'GUEST';
  const rawUnitName = user?.unit_name?.trim();
  const userUnitName = rawUnitName || 'Đơn vị của tôi';
  const hasUnit = !isGuest && Boolean(user?.unit_id || rawUnitName);

  const canAccessDesk =
    hasPermission('DOC_UPLOAD') ||
    hasPermission('DOC_EDIT') ||
    hasPermission('DOC_PARSE');

  const tabs = [
    {
      key: 'portal' as const,
      label: 'Kho dữ liệu chung',
      to: ROUTE_PATHS.PORTAL,
      icon: BookOpen,
      visible: true,
      description: 'Tra cứu toàn bộ tài liệu số công khai & nghiệp vụ Nhà trường',
    },
    {
      key: 'myunit' as const,
      label: `Đơn vị: ${userUnitName}`,
      to: ROUTE_PATHS.MY_UNIT,
      icon: Building2,
      visible: hasUnit,
      description: 'Khai thác tài liệu và chỉ số KPI phân cấp của đơn vị trực thuộc',
    },
    {
      key: 'desk' as const,
      label: 'Đăng tải & Tiếp nhận',
      to: ROUTE_PATHS.DESK,
      icon: CloudUpload,
      visible: Boolean(canAccessDesk),
      description: 'Trung tâm văn bản, số hóa và biên mục văn bản quân sự mới',
    },
  ];

  const visibleTabs = tabs.filter((t) => t.visible);

  return (
    <div className="w-full flex items-center justify-start overflow-x-auto pb-1 scrollbar-none select-none">
      <nav
        aria-label="Thanh điều hướng phân hệ Dữ liệu số"
        className="bg-slate-100/90 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 backdrop-blur-md rounded-xl p-1 inline-flex items-center gap-1 mb-4 shadow-xs max-w-full"
      >
        {visibleTabs.map((tab) => {
          const isSelected = activeTab === tab.key;
          const IconComponent = tab.icon;

          return (
            <Link
              key={tab.key}
              to={tab.to}
              aria-current={isSelected ? 'page' : undefined}
              title={tab.description}
              className={`relative px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm flex items-center gap-2 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                isSelected
                  ? 'bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 border border-transparent font-medium'
              }`}
            >
              <IconComponent
                className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                  isSelected
                    ? 'text-emerald-600 dark:text-emerald-400 scale-105'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              />
              <span>{tab.label}</span>
              {isSelected && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)] ml-0.5 shrink-0"
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default DataHubSubNav;

