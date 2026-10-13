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
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 4:
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 3:
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 2:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl overflow-hidden border border-slate-800 shadow-sm flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/90 text-slate-400 text-[11px] uppercase border-b border-slate-800 tracking-wider">
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
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  Đang tải danh sách tài liệu...
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500">
                  Không tìm thấy tài liệu nào phù hợp với bộ lọc
                </td>
              </tr>
            ) : (
              documents.map((doc) => {
                const isRestricted = (doc.security_level_id || 1) > userClearanceLevel;

                return (
                  <tr
                    key={doc.file_id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-emerald-400 whitespace-nowrap">
                      {doc.document_code || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white max-w-xs sm:max-w-md line-clamp-2">
                        {doc.title}
                      </div>
                      {doc.summary && (
                        <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                          {doc.summary}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                      {doc.type_name || '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                      {doc.unit_name || '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                      {formatDate(doc.issue_date)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getLevelBadgeClass(
                          doc.security_level_id || 1
                        )}`}
                      >
                        {doc.security_level_name || `Cấp ${doc.security_level_id}`}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-[11px]">
                          {formatFileSize(doc.file_size_bytes)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {isRestricted ? (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] text-rose-400 bg-rose-500/10 px-2 py-1 rounded"
                          title="Vượt cấp độ mật cho phép"
                        >
                          <Lock className="w-3 h-3" /> Giới hạn
                        </span>
                      ) : (
                        <div className="inline-flex items-center space-x-1">
                          <button
                            onClick={() => onPreview(doc)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition cursor-pointer"
                            title="Xem trước tài liệu"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDownload(doc)}
                            className="p-1.5 bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-400 rounded transition cursor-pointer"
                            title="Tải về tệp gốc"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          {onEdit && (
                            <button
                              onClick={() => onEdit(doc)}
                              className="p-1.5 bg-blue-950/50 hover:bg-blue-900/60 text-blue-400 rounded transition cursor-pointer"
                              title="Chỉnh sửa văn bản"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => onDelete(doc)}
                              className="p-1.5 bg-rose-950/50 hover:bg-rose-900/60 text-rose-400 rounded transition cursor-pointer"
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
        <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-900/60">
          <div>
            Hiển thị trang <span className="font-semibold text-white">{currentPage}</span> /{' '}
            <span className="font-semibold text-white">{totalPages}</span> (Tổng{' '}
            <span className="font-semibold text-white">{totalItems}</span> tài liệu)
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="px-2.5 py-1 rounded bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition"
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
                    {showEllipsis && <span className="px-1 text-slate-600">...</span>}
                    <button
                      onClick={() => onPageChange(p)}
                      className={`px-2.5 py-1 rounded transition text-xs ${
                        currentPage === p
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
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
              className="px-2.5 py-1 rounded bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
