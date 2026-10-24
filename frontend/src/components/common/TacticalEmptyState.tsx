/* <!-- Tactical Command Empty State & Search Reset --> */
import React from 'react';
import { SearchX, FilterX, RotateCcw, FileQuestion } from 'lucide-react';

export interface TacticalEmptyStateProps {
  title?: string;
  description?: string;
  searchQuery?: string;
  onClearFilters?: () => void;
  onRefresh?: () => void;
  icon?: React.ReactNode;
  compact?: boolean;
}

export const TacticalEmptyState: React.FC<TacticalEmptyStateProps> = ({
  title = 'Không tìm thấy dữ liệu hoặc văn bản phù hợp',
  description = 'Không có bản ghi nào khớp với từ khóa tìm kiếm hoặc bộ lọc hiện tại. Đồng chí vui lòng kiểm tra lại từ khóa hoặc xóa bớt tiêu chí lọc.',
  searchQuery,
  onClearFilters,
  onRefresh,
  icon,
  compact = false,
}) => {
  return (
    <div
      className={`w-full ${
        compact ? 'py-8 px-4' : 'py-14 sm:py-16 px-6'
      } flex flex-col items-center justify-center text-center select-none`}
    >
      {/* Khung Biểu Tượng Nghệ Thuật với Thước Đo & Crosshairs Quân Sự */}
      <div className="relative mb-4 sm:mb-5">
        {/* Góc ngắm quang học (Reticle Brackets) */}
        <span className="absolute -top-2 -left-2 w-3 h-3 border-t-2 border-l-2 border-amber-500/50" />
        <span className="absolute -top-2 -right-2 w-3 h-3 border-t-2 border-r-2 border-amber-500/50" />
        <span className="absolute -bottom-2 -left-2 w-3 h-3 border-b-2 border-l-2 border-amber-500/50" />
        <span className="absolute -bottom-2 -right-2 w-3 h-3 border-b-2 border-r-2 border-amber-500/50" />

        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950 border border-slate-300/80 dark:border-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 shadow-inner">
          {icon || <SearchX className="w-8 h-8 sm:w-10 sm:h-10 text-amber-600 dark:text-amber-500" />}
        </div>

        {/* Chấm trạng thái rỗng */}
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-white dark:border-slate-900" />
        </span>
      </div>

      {/* Tiêu đề & Thông điệp quân sự */}
      <div className="space-y-1.5 max-w-md mx-auto">
        <h4 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200 tracking-tight">
          {title}
        </h4>

        {searchQuery && (
          <div className="inline-flex items-center gap-1.5 font-mono text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20 my-1">
            <span>Từ khóa:</span>
            <span className="font-semibold underline">"{searchQuery}"</span>
          </div>
        )}

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {description}
        </p>
      </div>

      {/* Cụm Nút Hành Động Xóa Bộ Lọc / Làm Mới */}
      {(onClearFilters || onRefresh) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          {onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="px-4 py-2 rounded-xl bg-[#166534] hover:bg-[#14532d] text-white text-xs font-semibold border border-emerald-600/40 shadow-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <FilterX className="w-3.5 h-3.5" />
              <span>Xóa bộ lọc</span>
            </button>
          )}

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Làm mới danh sách</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TacticalEmptyState;
