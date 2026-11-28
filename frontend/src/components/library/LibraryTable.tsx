import React from 'react';
import { Skeleton, Tooltip } from 'antd';
import { BookOpen, Eye, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { CompactDownloadButton } from '../common/CompactDownloadButton';
import { TacticalEmptyState } from '../common/TacticalEmptyState';
import { formatDate } from '../../utils/dateUtils';
import { formatFileSize } from '../../utils/formatFileSize';
import { LibraryCover } from './LibraryCover';
import { libraryService } from '../../services/libraryService';
import type { LibraryItem } from '../../types/library';

export interface LibraryTableProps {
  items: LibraryItem[];
  loading: boolean;
  trashMode?: boolean;
  touch?: boolean;
  emptyTitle: string;
  emptyDescription: string;
  onClearFilters?: () => void;
  onPreview?: (item: LibraryItem) => void;
  onDownload?: (item: LibraryItem, signal?: AbortSignal) => Promise<(() => void) | void>;
  onEdit?: (item: LibraryItem) => void;
  onDelete?: (item: LibraryItem) => void;
  onRestore?: (item: LibraryItem) => void;
  onPurge?: (item: LibraryItem) => void;
}

export const LibraryTable: React.FC<LibraryTableProps> = ({
  items, loading, trashMode = false, touch = false, emptyTitle, emptyDescription, onClearFilters,
  onPreview, onDownload, onEdit, onDelete, onRestore, onPurge,
}) => {
  const action = `inline-flex items-center justify-center rounded-lg border transition-colors cursor-pointer active:scale-95 ${touch ? 'w-11 h-11' : 'w-8 h-8'}`;
  const neutral = 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-transparent';
  const danger = 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 dark:text-rose-400 dark:border-transparent';
  const columns = 6;

  const iconButton = (label: string, icon: React.ReactNode, onClick: () => void, tone: string) => (
    <Tooltip title={label}>
      <button type="button" aria-label={label} onClick={onClick} className={`${action} ${tone}`}>{icon}</button>
    </Tooltip>
  );

  return (
    <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300 min-w-[560px]">
        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs font-semibold border-b border-slate-200 dark:border-white/[0.08]">
          <tr>
            <th className="py-3 px-3 lg:px-4">Tài liệu</th>
            <th className="py-3 px-3 lg:px-4">Thể loại</th>
            <th className="py-3 px-3 lg:px-4">Xuất bản</th>
            <th className={`py-3 px-3 lg:px-4 ${trashMode ? '' : 'hidden lg:table-cell'}`}>{trashMode ? 'Đã xóa' : 'Đơn vị quản lý'}</th>
            <th className="py-3 px-3 lg:px-4 text-right hidden lg:table-cell">Dung lượng</th>
            <th className="py-3 px-3 lg:px-4 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
          {loading ? (
            Array.from({ length: 5 }).map((_, row) => (
              <tr key={row}>
                {Array.from({ length: columns }).map((__, col) => (
                  <td key={col} className="py-3.5 px-4">
                    <Skeleton.Input active size="small" style={{ width: col === 0 ? 240 : 72, minWidth: 0, height: 18 }} />
                  </td>
                ))}
              </tr>
            ))
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={columns}>
                <TacticalEmptyState
                  title={emptyTitle}
                  description={emptyDescription}
                  onClearFilters={onClearFilters}
                  icon={<BookOpen className="w-8 h-8 text-emerald-700 dark:text-emerald-400" />}
                  compact
                />
              </td>
            </tr>
          ) : items.map((item) => {
            return (
              <tr key={item.file_id} className="hover:bg-emerald-800/[0.04] dark:hover:bg-emerald-400/[0.08] transition-colors">
                <td className="py-3 px-3 lg:px-4 max-w-[420px]">
                  <div className="flex items-center gap-3">
                    <LibraryCover
                      url={libraryService.coverUrl(item.file_id, item.cover_version)}
                      authenticated={trashMode}
                      alt={`Bìa ${item.title}`}
                    />
                    <div className="min-w-0">
                      <Tooltip title={item.title} mouseEnterDelay={0.5}>
                        <div className="font-semibold text-slate-900 dark:text-white line-clamp-2">{item.title}</div>
                      </Tooltip>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                        {[item.author, item.document_code].filter(Boolean).join(' · ') || 'Chưa ghi tác giả'}
                      </div>
                      {Boolean(item.page_count) && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{item.page_count} trang</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3 lg:px-4">{item.category_name}</td>
                <td className="py-3 px-3 lg:px-4">
                  <div className="tabular-nums">{item.publish_year || '—'}</div>
                  {item.publisher && <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 max-w-[180px]">{item.publisher}</div>}
                </td>
                <td className={`py-3 px-3 lg:px-4 ${trashMode ? '' : 'hidden lg:table-cell'}`}>
                  {trashMode ? (
                    <>
                      <div className="tabular-nums">{formatDate(item.deleted_at || undefined)}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 max-w-[200px]">
                        {item.deleted_reason === 'REJECTED_BY_COMMANDER' ? 'Bị từ chối duyệt' : (item.deleted_reason || item.deleted_by_name || '—')}
                      </div>
                    </>
                  ) : (item.unit_name || '—')}
                </td>
                <td className="py-3 px-3 lg:px-4 text-right whitespace-nowrap tabular-nums text-slate-500 dark:text-slate-400 hidden lg:table-cell">
                  {formatFileSize(item.file_size)}
                </td>
                <td className="py-3 px-3 lg:px-4 text-right whitespace-nowrap">
                  {trashMode ? (
                    <div className="inline-flex gap-1.5">
                      {onRestore && iconButton('Khôi phục tài liệu', <RotateCcw className="w-4 h-4" />, () => onRestore(item), neutral)}
                      {onPurge && iconButton('Xóa vĩnh viễn', <Trash2 className="w-4 h-4" />, () => onPurge(item), danger)}
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5">
                      {onPreview && iconButton('Đọc tài liệu', <Eye className="w-4 h-4" />, () => onPreview(item), neutral)}
                      {onDownload && (
                        <CompactDownloadButton
                          size="icon"
                          onDownload={(signal) => onDownload(item, signal)}
                        />
                      )}
                      {onEdit && iconButton('Chỉnh sửa', <Pencil className="w-4 h-4" />, () => onEdit(item), neutral)}
                      {onDelete && iconButton('Đưa vào thùng rác', <Trash2 className="w-4 h-4" />, () => onDelete(item), danger)}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default LibraryTable;
