import React from 'react';
import { Skeleton } from 'antd';
import { DocumentItem } from '../../types';
import { DocumentCard } from './DocumentCard';
import { TacticalEmptyState } from '../common/TacticalEmptyState';
import { PaginationBar } from '../common/PaginationBar';
import { usePageTransition } from '../common/PageTransitionStage';

export interface PortalDocumentListProps {
  documents: DocumentItem[];
  userClearanceLevel: number;
  loading?: boolean;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  searchQuery?: string;
  onClearFilters?: () => void;
  onPageChange: (page: number) => void;
  onPreview: (doc: DocumentItem) => void;
  onDownload: (doc: DocumentItem, signal?: AbortSignal) => Promise<(() => void) | void> | (() => void) | void;
  onCancelDownload?: (doc: DocumentItem) => void;
}

export const PortalDocumentList: React.FC<PortalDocumentListProps> = ({
  documents,
  userClearanceLevel,
  loading = false,
  currentPage,
  totalPages,
  totalItems,
  searchQuery,
  onClearFilters,
  onPageChange,
  onPreview,
  onDownload,
  onCancelDownload,
}) => {
  const gridRef = usePageTransition<HTMLDivElement>(currentPage, { cols: 3, mode: 'grid' });

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={`portal-doc-skeleton-${idx}`}
            className="bg-white/90 dark:bg-[#111827] rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-white/[0.08] shadow-sm flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex justify-between items-center gap-2">
                <Skeleton.Button active size="small" style={{ width: 85, height: 22, borderRadius: 6 }} />
                <Skeleton.Button active size="small" style={{ width: 70, height: 22, borderRadius: 6 }} />
              </div>
              <Skeleton active paragraph={{ rows: 2, width: ['100%', '75%'] }} title={{ width: '85%' }} />
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
              <Skeleton.Input active size="small" style={{ width: 110, height: 18, borderRadius: 4 }} />
              <Skeleton.Button active size="small" style={{ width: 75, height: 28, borderRadius: 8 }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="bg-white/90 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-md overflow-hidden">
        <TacticalEmptyState
          title="Không tìm thấy văn bản phù hợp"
          description="Không có tài liệu nào khớp với từ khóa tìm kiếm hoặc bộ lọc hiện tại. Đồng chí vui lòng kiểm tra lại từ khóa hoặc xóa bộ lọc."
          searchQuery={searchQuery}
          onClearFilters={onClearFilters}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div ref={gridRef} className="u043 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc, idx) => (
          <div
            key={doc.file_id}
            id={idx === 0 ? 'tour-document-card' : undefined}
            data-tour={idx === 0 ? 'document-card' : undefined}
            className="h-full"
          >
            <DocumentCard
              document={doc}
              userClearanceLevel={userClearanceLevel}
              onPreview={onPreview}
              onDownload={onDownload}
              onCancelDownload={onCancelDownload}
            />
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400 shadow-sm">
          <div>
            Đang hiển thị tài liệu{' '}
            <strong className="font-bold text-slate-900 dark:text-white">{(currentPage - 1) * 30 + 1} - {Math.min(currentPage * 30, totalItems)}</strong> /{' '}
            <strong className="font-bold text-emerald-700 dark:text-emerald-400">{totalItems}</strong> tài liệu
            {' '}(Trang <strong className="font-bold text-slate-900 dark:text-white">{currentPage}</strong>/{totalPages})
          </div>
          <PaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
};
