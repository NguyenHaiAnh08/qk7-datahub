import React from 'react';
import { Loader2, Inbox, ChevronLeft, ChevronRight } from 'lucide-react';
import { DocumentItem } from '../../types';
import { DocumentCard } from './DocumentCard';
import { TacticalEmptyState } from '../common/TacticalEmptyState';

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
  onDownload: (doc: DocumentItem) => void;
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
}) => {
  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-3 bg-white/60 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800">
        <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          Đang tìm kiếm tài liệu...
        </p>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            />
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 shadow-sm">
          <div>
            Hiển thị trang{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{currentPage}</span> /{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{totalPages}</span> (Tổng{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{totalItems}</span> tài liệu)
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && p - prev > 1;
                return (
                  <React.Fragment key={p}>
                    {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                    <button
                      onClick={() => onPageChange(p)}
                      className={`px-2.5 py-1 rounded transition text-xs ${
                        currentPage === p
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                );
              })}
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
