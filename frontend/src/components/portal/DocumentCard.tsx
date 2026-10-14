import React from 'react';
import { FileText, Eye, Download, Lock, Calendar, Building, HardDrive } from 'lucide-react';
import { DocumentItem } from '../../types';
import { formatDate } from '../../utils/dateUtils';
import { formatFileSize } from '../../utils/formatFileSize';

export interface DocumentCardProps {
  document: DocumentItem;
  userClearanceLevel: number;
  onPreview: (doc: DocumentItem) => void;
  onDownload: (doc: DocumentItem) => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  userClearanceLevel,
  onPreview,
  onDownload,
}) => {
  const isRestricted = (document.security_level_id || 1) > userClearanceLevel;

  const getLevelBadgeClass = (lv: number) => {
    switch (lv) {
      case 5:
        return 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30';
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
    <div className="bg-white dark:bg-slate-900/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all duration-200 group">
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold text-xs tracking-wide truncate">
            {document.document_code}
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${getLevelBadgeClass(
              document.security_level_id || 1
            )}`}
          >
            {document.security_level_name || `Cấp ${document.security_level_id}`}
          </span>
        </div>

        {/* Title */}
        <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-2 mb-2">
          {document.title}
        </h4>

        {/* Summary */}
        {document.summary && (
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
            {document.summary}
          </p>
        )}

        {/* Metadata Details */}
        <div className="space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 dark:text-slate-500">Thể loại:</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[140px]">
              {document.type_name || '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 dark:text-slate-500">Đơn vị:</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[140px]">
              {document.unit_name || '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 dark:text-slate-500">Ngày BH:</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              {formatDate(document.issue_date)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 dark:text-slate-500">Dung lượng:</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              {formatFileSize(document.file_size_bytes)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
        {isRestricted ? (
          <div className="w-full py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>Giới hạn quyền truy cập</span>
          </div>
        ) : (
          <>
            <button
              onClick={() => onPreview(document)}
              className="flex-1 py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Xem trước</span>
            </button>
            <button
              onClick={() => onDownload(document)}
              className="py-1.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 dark:bg-emerald-600/20 dark:hover:bg-emerald-600/30 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
              title="Tải về máy"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
