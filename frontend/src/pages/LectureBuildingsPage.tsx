import React from 'react';
import { Landmark, ShieldCheck } from 'lucide-react';
import { BuildingManagerPanel } from '../components/lectures/BuildingManagerPanel';
import { useAuth } from '../hooks/useAuth';

/**
 * Danh mục Khu giảng đường (Quản trị > Bài giảng số > Khu giảng đường).
 * Khu hiện trên sơ đồ giám sát; mỗi phòng học ở mục "Giảng đường" được gán vào một khu.
 */
export const LectureBuildingsPage: React.FC = () => {
  const { hasPermission } = useAuth();

  return (
    <div className="space-y-5">
      {/* ── HEADER KHU GIẢNG ĐƯỜNG CHUẨN QUÂN SỰ ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-300 dark:border-slate-800">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600/20 via-emerald-500/10 to-teal-500/20 dark:from-emerald-500/25 dark:to-teal-500/15 border-2 border-emerald-500/40 flex items-center justify-center shrink-0 shadow-xs">
            <Landmark className="w-6 h-6 text-emerald-800 dark:text-emerald-400 stroke-[2.3]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white tracking-tight">
                Quản Lý Khu Giảng Đường
              </h2>
              <span className="hidden sm:inline-flex text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-400 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700/60 shadow-2xs">
                CƠ SỞ ĐÀO TẠO
              </span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-1">
              Danh mục các khu nhà giảng đường, hội trường quân sự hiển thị trên Sơ đồ Radar Giám sát đào tạo theo thời gian thực
            </p>
          </div>
        </div>
      </div>

      <BuildingManagerPanel canManage={Boolean(hasPermission('CLASSROOM_MANAGE'))} />
    </div>
  );
};

export default LectureBuildingsPage;
