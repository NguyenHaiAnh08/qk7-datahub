import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Loader2, FileText, Sparkles, AlertCircle } from 'lucide-react';
import { Dropzone } from './Dropzone';
import { DocumentItem, DocumentType, Unit, SecurityLevel } from '../../types';
import { documentService, ParseDocumentResult } from '../../services/documentService';

export interface DocumentUploadModalProps {
  open: boolean;
  document?: DocumentItem | null;
  types: DocumentType[];
  units: Unit[];
  levels: SecurityLevel[];
  onClose: () => void;
  onSave: (formData: FormData, isEdit: boolean) => Promise<void> | void;
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  open,
  document,
  types,
  units,
  levels,
  onClose,
  onSave,
  onToast,
}) => {
  const isEdit = Boolean(document);

  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [typeId, setTypeId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [securityLevel, setSecurityLevel] = useState<number>(1);
  const [signer, setSigner] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [summary, setSummary] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // ── Auto-parse PDF ──
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseDocumentResult | null>(null);
  const [parseError, setParseError] = useState('');
  const parsedFileRef = React.useRef<File | null>(null);

  // Prefill on edit
  useEffect(() => {
    if (document) {
      setCode(document.document_code || '');
      setTitle(document.title || '');
      setTypeId(document.doc_type_id || document.type_id || (types[0]?.type_id ?? ''));
      setUnitId(document.issuing_unit_id || document.unit_id || (units[0]?.unit_id ?? ''));
      setSecurityLevel(document.security_level_id || 1);
      setSigner(document.signer || '');
      const rawDate = document.issued_date || document.issue_date;
      setIssueDate(rawDate ? rawDate.split('T')[0] : '');
      setSummary(document.summary || '');
      setSelectedFile(null);
    } else {
      setCode('');
      setTitle('');
      setTypeId(types[0]?.type_id || '');
      setUnitId(units[0]?.unit_id || '');
      setSecurityLevel(1);
      setSigner('');
      setIssueDate(new Date().toISOString().split('T')[0]);
      setSummary('');
      setSelectedFile(null);
    }
    setError('');
    // Reset parse state khi modal đóng/mở
    setParseResult(null);
    setParseError('');
    parsedFileRef.current = null;
  }, [document, open, types, units]);

  // ── Auto-parse PDF khi user chọn file mới ──
  useEffect(() => {
    // Khi xóa file → reset
    if (!selectedFile) {
      parsedFileRef.current = null;
      setParseResult(null);
      setParseError('');
      return;
    }

    // Không parse khi đang edit
    if (isEdit) return;

    // Chỉ parse 1 lần cho mỗi file
    if (parsedFileRef.current === selectedFile) return;
    parsedFileRef.current = selectedFile;

    setParsing(true);
    setParseError('');

    documentService.parseDocument(selectedFile)
      .then((res) => {
        if (!res.success || !res.parsed) {
          setParseError(res.error || 'Không đọc được PDF');
          return;
        }

        const p = res.parsed;

        // Override các trường (workflow: chọn file trước → điền form sau)
        if (p.document_code) setCode(p.document_code);
        if (p.title) setTitle(p.title);
        if (p.issued_date) setIssueDate(p.issued_date);

        // Loại văn bản — chỉ set nếu có trong dropdown
        if (p.doc_type_code && types.some(t => t.type_id === p.doc_type_code)) {
          setTypeId(p.doc_type_code);
        }

        // Người ký — gộp cấp bậc + tên + chức danh
        const signerParts = [p.signer, p.signer_position].filter(Boolean);
        if (signerParts.length > 0) {
          setSigner(signerParts.join(' — '));
        }

        setParseResult(res);
      })
      .catch((err) => {
        console.warn('[parse PDF]', err);
        setParseError(err.message || 'Không đọc được PDF');
      })
      .finally(() => setParsing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, isEdit, types]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isEdit && !selectedFile) {
      setError('Vui lòng chọn tệp văn bản đính kèm!');
      return;
    }

    if (!code.trim() || !title.trim()) {
      setError('Vui lòng nhập đầy đủ Số hiệu và Trích yếu văn bản!');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('document_code', code.trim());
      formData.append('title', title.trim());
      if (typeId) {
        formData.append('doc_type_id', typeId);
        formData.append('type_id', typeId);
      }
      if (unitId) {
        formData.append('issuing_unit_id', unitId);
        formData.append('unit_id', unitId);
      }
      formData.append('security_level_id', String(securityLevel));
      if (signer) formData.append('signer', signer.trim());
      if (issueDate) {
        formData.append('issued_date', issueDate);
        formData.append('issue_date', issueDate);
      }
      if (summary) formData.append('summary', summary.trim());

      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      await onSave(formData, isEdit);
      if (onToast) {
        onToast(isEdit ? `Đã cập nhật văn bản ${code} thành công!` : `Đã tiếp nhận văn bản ${code} thành công!`, 'success');
      }
      onClose();
    } catch (err: any) {
      console.error('[DocumentUploadModal]', err);
      setError(err.message || 'Thao tác không thành công, vui lòng thử lại!');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] transition-colors duration-200"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {isEdit ? 'Hiệu Chỉnh Văn Bản' : 'Tiếp Nhận & Lưu Trữ Văn Bản Mới'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isEdit
                    ? `Mã tệp: ${document?.file_id}`
                    : 'Điền đầy đủ thông tin định danh và bảo mật'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 font-medium">
                {error}
              </div>
            )}

            {/* Dropzone */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
                Tệp văn bản {isEdit ? '(Chọn tệp mới nếu muốn thay thế tệp cũ)' : '*'}
              </label>
              <Dropzone selectedFile={selectedFile} onFileSelect={setSelectedFile} />
            </div>

            {!parsing && parseError && (
              <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Không tự động đọc được PDF: {parseError}. Vui lòng nhập thông tin thủ công.</span>
              </div>
            )}

            {!parsing && parseError && (
              <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Không tự động đọc được PDF: {parseError}. Vui lòng nhập thông tin thủ công.</span>
              </div>
            )}

            {!parsing && parseResult && !parseError && (() => {
              const filled = Object.values(parseResult.parsed).filter(
                (v) => v !== null && v !== undefined && String(v).trim() !== ''
              ).length;
              return (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-semibold">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>
                      Đã tự động điền {filled} trường
                      {parseResult.usedOcr && ' (đã dùng OCR cho số ẩn)'}
                    </span>
                  </div>
                  <div className="text-[11px] opacity-80">
                    Vui lòng kiểm tra lại trước khi lưu. Bạn có thể sửa bất kỳ trường nào.
                  </div>
                </div>
              );
            })()}

            {/* Trạng thái auto-parse PDF */}
            {parsing && (
              <div className="flex items-center gap-2 p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-700 dark:text-blue-300 text-xs">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Đang đọc nội dung PDF và điền form...</span>
              </div>
            )}

            {!parsing && parseError && (
              <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Không tự động đọc được PDF: {parseError}. Vui lòng nhập thông tin thủ công.</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Số hiệu / Ký hiệu văn bản *
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ví dụ: 125/QĐ-QK7"
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Người ký ban hành
                </label>
                <input
                  type="text"
                  value={signer}
                  onChange={(e) => setSigner(e.target.value)}
                  placeholder="Họ tên, chức danh người ký..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Trích yếu nội dung văn bản *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Về việc chỉ đạo triển khai kế hoạch bảo đảm an toàn..."
                required
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Loại văn bản
                </label>
                <select
                  value={typeId}
                  onChange={(e) => setTypeId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {types.map((t) => (
                    <option key={t.type_id} value={t.type_id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Đơn vị ban hành
                </label>
                <select
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {units.map((u) => (
                    <option key={u.unit_id} value={u.unit_id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Độ mật bảo quản *
                </label>
                <select
                  value={securityLevel}
                  onChange={(e) => setSecurityLevel(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {levels.map((lvl) => (
                    <option key={lvl.level_id} value={lvl.level_id}>
                      {lvl.name} (Cấp {lvl.level_id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Ngày ban hành
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Tóm tắt ghi chú
                </label>
                <input
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Ghi chú thêm về văn bản..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-600/30"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>{isEdit ? 'Cập nhật văn bản' : 'Lưu trữ văn bản'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
