import React from 'react';
import {
  FileText,
  Eye,
  Download,
  Pencil,
  Trash2,
  Lock,
  ChevronLeft,
  ChevronRight,
  HardDrive
} from 'lucide-react';
import { DocumentItem } from '../../types';
import { formatDate } from '../../utils/dateUtils';
import { formatFileSize } from '../../utils/formatFileSize';

export interface DocumentTableProps {
  documents: DocumentItem[];
  userClearanceLevel: number;
  loading?: boolean;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPreview: (doc: DocumentItem) => void;
  onDownload: (doc: DocumentItem) => void;
  onEdit?: (doc: DocumentItem) => void;
  onDelete?: (doc: DocumentItem) => void;
}

export const DocumentTable: React.FC<DocumentTableProps> = ({
  documents,
  userClearanceLevel,
  loading = false,
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  onPreview,
  onDownload,
  onEdit,
  onDelete,
}) => {
  const getLevelBadgeClass = (lv: number) => {
    switch (lv) {
      case 5:
        return 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30';
      case 4:
        return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30';
      case 3:
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
      case 2:
        return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30';
      default:
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    }
  };

  return (
    <div className="bg-white dark:bg-[#111827] rounded-xl overflow-hidden border border-slate-200 dark:border-white/[0.08] flex flex-col transition-colors duration-200">
      <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 min-w-[800px]">
          <thead className="bg-slate-50/80 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 text-xs font-semibold border-b border-slate-200 dark:border-white/[0.06]">
            <tr>
              <th className="py-3 px-4">Số hiệu</th>
              <th className="py-3 px-4">Trích yếu nội dung</th>
              <th className="py-3 px-4">Thể loại</th>
              <th className="py-3 px-4">Đơn vị ban hành</th>
              <th className="py-3 px-4">Ngày BH</th>
              <th className="py-3 px-4">Độ mật</th>
              <th className="py-3 px-4">Tệp đính kèm</th>
              <th className="py-3 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-slate-400">
                  Đang tải danh sách tài liệu...
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                  Không tìm thấy tài liệu nào phù hợp với bộ lọc
                </td>
              </tr>
            ) : (
              documents.map((doc) => {
                const isRestricted = (doc.security_level_id || 1) > userClearanceLevel;

                return (
                  <tr
                    key={doc.file_id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded text-amber-800 bg-amber-500/10 border border-amber-600/25 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/25">
                        {doc.document_code || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white max-w-xs sm:max-w-md line-clamp-2">
                        {doc.title}
                      </div>
                      {doc.summary && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                          {doc.summary}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {doc.doc_type_name || doc.type_name || '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {doc.unit_name || '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400">
                      {formatDate(doc.issued_date || doc.issue_date)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getLevelBadgeClass(
                          doc.security_level_id || 1
                        )}`}
                      >
                        {doc.security_name || doc.security_level_name || `Cấp ${doc.security_level_id}`}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        <span className="text-[11px]">
                          {formatFileSize(doc.file_size ?? doc.file_size_bytes)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {isRestricted ? (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-1 rounded"
                          title="Vượt cấp độ mật cho phép"
                        >
                          <Lock className="w-3 h-3" /> Giới hạn
                        </span>
                      ) : (
                        <div className="inline-flex items-center space-x-1">
                          <button
                            onClick={() => onPreview(doc)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-transparent rounded-lg transition cursor-pointer"
                            title="Xem trước tài liệu"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {(() => {
                            const docLevel = doc.security_level_id || 1;
                            const canDownload = docLevel <= 2 && docLevel <= userClearanceLevel;
                            const isSecretLevel = docLevel >= 3;

                            if (canDownload) {
                              return (
                                <button
                                  onClick={() => onDownload(doc)}
                                  className="p-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 rounded-lg transition cursor-pointer"
                                  title="Tải về tệp gốc"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              );
                            }

                            return (
                              <button
                                disabled
                                className="p-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 rounded-lg cursor-not-allowed opacity-60"
                                title={
                                  isSecretLevel
                                    ? 'Tài liệu từ Cấp 3 trở lên chỉ duy nhất cho phép xem trực tiếp, không được phép tải về máy'
                                    : `Cấp độ bảo mật (Cấp ${userClearanceLevel}) không đủ để tải văn bản Cấp ${docLevel}`
                                }
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            );
                          })()}
                          {onEdit && (
                            <button
                              onClick={() => onEdit(doc)}
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 dark:text-blue-400 dark:border-transparent rounded-lg transition cursor-pointer"
                              title="Chỉnh sửa văn bản"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => onDelete(doc)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 dark:text-rose-400 dark:border-transparent rounded-lg transition cursor-pointer"
                              title="Xóa văn bản"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50/80 dark:bg-slate-900/60">
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
                          ? 'bg-[#166534] dark:bg-emerald-600 text-white font-bold shadow-xs'
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
