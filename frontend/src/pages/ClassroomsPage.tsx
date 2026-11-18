import React, { useState } from 'react';
import { School, RotateCw } from 'lucide-react';
import { Header } from '../components/common/Header';
import { LiveMonitorPanel } from '../components/lectures/LiveMonitorPanel';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../components/common/Toast';

export const ClassroomsPage: React.FC = () => {
  const { user, hasPermission, isAdmin } = useAuth();
  const canForceEnd = Boolean(hasPermission('SCHEDULE_FORCE_END') || isAdmin);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-slate-200 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Header activeNav="classrooms" title="Trường Quân Sự Quân Khu 7" subtitle="Trung tâm dữ liệu số" />

      <main className="flex-1 min-w-0 p-3.5 sm:p-5 lg:p-6 xl:p-8 w-full max-w-[1780px] mx-auto space-y-6">
        {/* Hero Header chuẩn Quân sự */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-[#111827] p-5 sm:p-6 rounded-2xl border border-slate-300/80 dark:border-white/[0.08] shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#166534]/15 border border-[#166534]/30 dark:bg-emerald-500/15 dark:border-emerald-500/30 flex items-center justify-center shrink-0 shadow-xs">
              <School className="w-6 h-6 text-[#166534] dark:text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Phân Hệ Giảng Đường
                </h1>
                <span className="inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Mặt Bằng & Giám Sát Live
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Sơ đồ mặt bằng giảng đường, kiểm soát trạng thái phòng học và điều hành ca dạy trực tiếp — Trường Quân Sự Quân Khu 7
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={() => {
                setRefreshKey(prev => prev + 1);
                toast.success('Đang đồng bộ dữ liệu giảng đường...');
              }}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
              title="Làm mới trạng thái giảng đường"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Bảng Giám Sát Giảng Đường Trực Tiếp (Live Monitor & Radar) */}
        <LiveMonitorPanel
          key={refreshKey}
          currentUserId={user?.user_id}
          canForceEnd={canForceEnd}
          isAdmin={isAdmin}
        />
      </main>
    </div>
  );
};

export default ClassroomsPage;
