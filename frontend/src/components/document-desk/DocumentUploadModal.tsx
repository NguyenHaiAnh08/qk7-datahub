import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UploadCloud, Save, Loader2, FileText } from 'lucide-react';
import { DocumentItem, DocumentType, Unit, SecurityLevel } from '../../types';
import { Dropzone } from './Dropzone';

export interface DocumentUploadModalProps {
  open: boolean;
  document: DocumentItem | null; // null => Create new, object => Edit
  types: DocumentType[];
  units: Unit[];
  levels: SecurityLevel[];
  onClose: () => void;
  onSave: (formData: FormData, isEdit: boolean) => Promise<void>;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
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
  const isEdit = Boolean(document && document.file_id);

  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [typeId, setTypeId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [securityLevel, setSecurityLevel] = useState<number>(1);
  const [signer, setSigner] = useState('');
  const [summary, setSummary] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (document) {
        setCode(document.document_code || '');
        setTitle(document.title || '');
        setTypeId(document.type_id || '');
        setUnitId(document.unit_id || '');
        setIssueDate(document.issue_date ? document.issue_date.split('T')[0] : '');
        setSecurityLevel(document.security_level_id || 1);
        setSigner(document.signer || '');
        setSummary(document.summary || '');
        setSelectedFile(null);
      } else {
        setCode('');
        setTitle('');
        setTypeId(types[0]?.type_id || '');
        setUnitId(units[0]?.unit_id || '');
        setIssueDate(new Date().toISOString().split('T')[0]);
        setSecurityLevel(1);
        setSigner('');
        setSummary('');
        setSelectedFile(null);
      }
      setError('');
    }
  }, [open, document, types, units]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim() || !title.trim()) {
      setError('Vui lòng nhập đầy đủ Số hiệu và Trích yếu văn bản!');
      return;
    }

    if (!isEdit && !selectedFile) {
      setError('Vui lòng chọn hoặc tải lên tệp văn bản đính kèm!');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const fd = new FormData();
      fd.append('document_code', code.trim());
      fd.append('title', title.trim());
      fd.append('type_id', typeId || '');
      fd.append('unit_id', unitId || '');
      fd.append('issue_date', issueDate || '');
      fd.append('security_level_id', String(securityLevel));
      fd.append('signer', signer.trim());
      fd.append('summary', summary.trim());

      if (selectedFile) {
        fd.append('file', selectedFile);
      }

      await onSave(fd, isEdit);
      onToast(isEdit ? 'Cập nhật văn bản thành công!' : 'Tải lên văn bản thành công!', 'success');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu văn bản');
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
          className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">
                  {isEdit ? 'Hiệu Chỉnh Văn Bản' : 'Tiếp Nhận & Lưu Trữ Văn Bản Mới'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {isEdit ? `Mã tệp: ${document?.file_id}` : 'Điền đầy đủ thông tin định danh và bảo mật'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 font-medium">
                {error}
              </div>
            )}

            {/* Dropzone */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Tệp văn bản {isEdit ? '(Chọn tệp mới nếu muốn thay thế tệp cũ)' : '*'}
              </label>
              <Dropzone
                selectedFile={selectedFile}
                onFileSelect={setSelectedFile}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Số hiệu / Ký hiệu văn bản *
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ví dụ: 125/QĐ-QK7"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Người ký ban hành
                </label>
                <input
                  type="text"
                  value={signer}
                  onChange={(e) => setSigner(e.target.value)}
                  placeholder="Họ tên, chức danh người ký..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Trích yếu nội dung văn bản *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Về việc chỉ đạo triển khai kế hoạch bảo đảm an toàn..."
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Loại văn bản
                </label>
                <select
                  value={typeId}
                  onChange={(e) => setTypeId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {types.map((t) => (
                    <option key={t.type_id} value={t.type_id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Đơn vị ban hành
                </label>
                <select
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {units.map((u) => (
                    <option key={u.unit_id} value={u.unit_id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Độ mật bảo quản *
                </label>
                <select
                  value={securityLevel}
                  onChange={(e) => setSecurityLevel(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
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
                <label className="block text-slate-300 font-semibold mb-1">
                  Ngày ban hành
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Tóm tắt ghi chú
                </label>
                <input
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Ghi chú thêm về văn bản..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-1.5 transition disabled:opacity-50"
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
