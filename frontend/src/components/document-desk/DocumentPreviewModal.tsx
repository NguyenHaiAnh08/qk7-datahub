import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, ExternalLink, FileText, Calendar, Building, Shield } from 'lucide-react';
import { DocumentItem } from '../../types';
import { documentsApi } from '../../services/documentsApi';
import { formatDate } from '../../utils/dateUtils';
import { formatFileSize } from '../../utils/formatFileSize';

export interface DocumentPreviewModalProps {
  open: boolean;
  document: DocumentItem | null;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  open,
  document,
  onClose,
}) => {
  if (!open || !document) return null;

  const viewUrl = documentsApi.getViewUrl(document.file_id, false);
  const downloadUrl = documentsApi.getViewUrl(document.file_id, true);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[92vh] overflow-hidden shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-emerald-400 text-xs font-semibold">
                    {document.document_code}
                  </span>
                  <span className="text-slate-500 text-xs">•</span>
                  <span className="text-xs text-slate-300 font-bold truncate">
                    {document.title}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Building className="w-3 h-3 text-slate-500" />
                    {document.unit_name || '—'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    {formatDate(document.issue_date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3 text-amber-500" />
                    {document.security_level_name || `Cấp ${document.security_level_id}`}
                  </span>
                  <span>{formatFileSize(document.file_size_bytes)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <a
                href={viewUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                title="Mở trong tab mới"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <a
                href={downloadUrl}
                download
                className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 transition"
                title="Tải về máy"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Tải về</span>
              </a>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* PDF Viewer Body */}
          <div className="flex-1 bg-slate-950 overflow-hidden relative">
            <iframe
              src={viewUrl}
              title={document.title}
              className="w-full h-full border-0"
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
