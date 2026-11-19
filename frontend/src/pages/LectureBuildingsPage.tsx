import React from 'react';
import { Landmark } from 'lucide-react';
import { BuildingManagerPanel } from '../components/lectures/BuildingManagerPanel';
import { useAuth } from '../hooks/useAuth';

/**
 * Danh mục Khu giảng đường (Quản trị > Bài giảng số > Khu giảng đường).
 * Khu hiện trên sơ đồ giám sát; mỗi phòng học ở mục "Giảng đường" được gán vào một khu.
 */
export const LectureBuildingsPage: React.FC = () => {
  const { hasPermission } = useAuth();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-1 border-b border-slate-200 dark:border-slate-800/80">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 dark:from-emerald-500/30 dark:to-teal-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-xs">
          <Landmark className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Quản Lý Khu Giảng Đường
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Danh mục khu hiển thị trên sơ đồ giám sát; phòng học được gán vào từng khu
          </p>
        </div>
      </div>

      <BuildingManagerPanel canManage={Boolean(hasPermission('CLASSROOM_MANAGE'))} />
    </div>
  );
};

export default LectureBuildingsPage;
