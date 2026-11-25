import React, { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { TacticalEmptyState } from './TacticalEmptyState';
import { PaginationBar } from './PaginationBar';
import { usePageTransition } from './PageTransitionStage';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (item: T, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string | number;
  loading?: boolean;
  emptyMessage?: string;
  emptySubtext?: string;
  onClearFilters?: () => void;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
  };
  rowClassName?: (item: T, index: number) => string;
  onRowClick?: (item: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  emptyMessage = 'Không có dữ liệu',
  emptySubtext = 'Không tìm thấy bản ghi nào phù hợp với bộ lọc hiện tại',
  onClearFilters,
  pagination,
  rowClassName,
  onRowClick
}: DataTableProps<T>) {
  const tbodyRef = usePageTransition<HTMLTableSectionElement>(pagination?.currentPage ?? 1, {
    mode: 'row',
  });

  return (
    <div className="w-full flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
          <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 uppercase text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-4 py-3.5 ${col.headerClassName || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody ref={tbodyRef} className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">Đang tải dữ liệu...</p>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center">
                  <TacticalEmptyState
                    title={emptyMessage}
                    description={emptySubtext}
                    onClearFilters={onClearFilters}
                    compact
                  />
                </td>
              </tr>
            ) : (
              data.map((item, index) => {
                const customClass = rowClassName ? rowClassName(item, index) : '';
                return (
                  <tr
                    key={keyExtractor(item, index)}
                    onClick={() => onRowClick && onRowClick(item)}
                    className={`transition-colors duration-150 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                      onRowClick ? 'cursor-pointer' : ''
                    } ${customClass}`}
                  >
                    {columns.map((col) => (
                      <td
                        key={`${keyExtractor(item, index)}-${col.key}`}
                        className={`px-4 py-3.5 align-middle ${col.className || ''}`}
                      >
                        {col.render
                          ? col.render(item, index)
                          : (item as Record<string, any>)[col.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            Hiển thị trang <span className="font-semibold text-slate-800 dark:text-slate-200">{pagination.currentPage}</span> /{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{pagination.totalPages}</span> (Tổng{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{pagination.totalItems}</span> bản ghi)
          </div>
          <PaginationBar
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            onPageChange={pagination.onPageChange}
          />
        </div>
      )}
    </div>
  );
}
