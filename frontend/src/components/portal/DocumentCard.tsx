import React from 'react';
import { FileText, Eye, Download, Lock, Calendar, Building, HardDrive } from 'lucide-react';
import { DocumentItem } from '../../types';
import { formatDate } from '../../utils/dateUtils';
import { formatFileSize } from '../../utils/formatFileSize';
import { CompactDownloadButton } from '../common/CompactDownloadButton';

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

  const docLevel = document.security_level_id || 1;
  // Cấp 1, 2: được tải về nếu clearance >= docLevel. Từ cấp 3 trở đi (Cấp 3, 4, 5): CHỈ ĐƯỢC XEM, KHÔNG ĐƯỢC TẢI VỀ
  const canDownload = docLevel <= 2 && docLevel <= userClearanceLevel;
  const isSecretLevel = docLevel >= 3;

  return (
    <div className="bg-white dark:bg-[#111827] p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-white/[0.08] flex flex-col justify-between hover:border-emerald-600/40 dark:hover:border-emerald-500/40 transition-colors duration-150 group">
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded text-amber-800 bg-amber-500/10 border border-amber-600/25 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/25 tracking-wide truncate">
            {document.document_code}
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${getLevelBadgeClass(
              document.security_level_id || 1
            )}`}
          >
            {document.security_name || document.security_level_name || `Cấp ${document.security_level_id}`}
          </span>
        </div>

        {/* Title */}
        <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors line-clamp-2 mb-2">
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
          <div className="flex items-start justify-between gap-2.5">
            <span className="text-slate-400 dark:text-slate-500 shrink-0">Thể loại:</span>
            <span
              className="text-slate-700 dark:text-slate-300 font-medium text-right flex-1 break-normal leading-snug"
              title={document.doc_type_name || document.type_name}
            >
              {document.doc_type_name || document.type_name || '—'}
            </span>
          </div>
          <div className="flex items-start justify-between gap-2.5">
            <span className="text-slate-400 dark:text-slate-500 shrink-0">Đơn vị:</span>
            <span
              className="text-slate-700 dark:text-slate-300 font-medium text-right flex-1 break-normal leading-snug"
              title={document.unit_name}
            >
              {document.unit_name || '—'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2.5">
            <span className="text-slate-400 dark:text-slate-500 shrink-0">Ngày BH:</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium text-right">
              {formatDate(document.issued_date || document.issue_date)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2.5">
            <span className="text-slate-400 dark:text-slate-500 shrink-0">Dung lượng:</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium text-right">
              {formatFileSize(document.file_size ?? document.file_size_bytes)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
        {isRestricted ? (
          <div className="w-full min-h-[40px] py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>Giới hạn quyền truy cập</span>
          </div>
        ) : (
          <>
            <button
              onClick={() => onPreview(document)}
              className="flex-1 min-h-[40px] py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Xem văn bản PDF</span>
            </button>
            <CompactDownloadButton
              onDownload={() => onDownload(document)}
              disabled={!canDownload}
              disabledTitle={
                isSecretLevel
                  ? 'Tài liệu từ Cấp 3 trở lên chỉ duy nhất cho phép xem trực tiếp, không được phép tải về máy'
                  : `Cấp độ bảo mật (Cấp ${userClearanceLevel}) không đủ để tải văn bản Cấp ${docLevel}`
              }
              fileSize={formatFileSize(document.file_size ?? document.file_size_bytes)}
              size="normal"
            />
          </>
        )}
      </div>
    </div>
  );
};
