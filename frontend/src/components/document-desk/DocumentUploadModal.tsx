import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Loader2, FileText, Sparkles, AlertCircle, Plus, Minus, CheckCircle2, ArrowLeft, ShieldCheck } from 'lucide-react';
import { TreeSelect } from 'antd';
import { Dropzone } from './Dropzone';
import { DocumentItem, DocumentType, Unit, SecurityLevel } from '../../types';
import { documentService, ParseDocumentResult, CheckDuplicateResult } from '../../services/documentService';
import { buildUnitTree } from '../../utils/unitTree';

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
  const [securityLevel, setSecurityLevel] = useState<number | ''>('');
  const [signer, setSigner] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [summary, setSummary] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // ── Cây đơn vị cho TreeSelect ──
  const unitTree = React.useMemo(() => buildUnitTree(units), [units]);
  const rootUnitKeys = React.useMemo(() => unitTree.map((node) => String(node.key)), [unitTree]);
  const [treeExpandedKeys, setTreeExpandedKeys] = useState<string[]>([]);

  useEffect(() => {
    if (rootUnitKeys.length > 0) {
      setTreeExpandedKeys(rootUnitKeys);
    }
  }, [rootUnitKeys]);


  // ── Auto-parse PDF ──
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseDocumentResult | null>(null);
  const [parseError, setParseError] = useState('');
  const parsedFileRef = React.useRef<File | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<CheckDuplicateResult | null>(null);
  const [allowOverride, setAllowOverride] = useState(false);  

  // Prefill on edit
  useEffect(() => {
    if (document) {
      setCode(document.document_code || '');
      setTitle(document.title || '');
      setTypeId(document.doc_type_id || document.type_id || '');
      setUnitId(document.issuing_unit_id || document.unit_id || '');
      setSecurityLevel(document.security_level_id || '');
      setSigner(document.signer || '');
      const rawDate = document.issued_date || document.issue_date;
      setIssueDate(rawDate ? rawDate.split('T')[0] : '');
      setSummary(document.summary || '');
      setSelectedFile(null);
    } else {
      setCode('');
      setTitle('');
      setTypeId('');
      setUnitId('');
      setSecurityLevel('');
      setSigner('');
      setIssueDate('');
      setSummary('');
      setSelectedFile(null);
    }
    setError('');
    setShowConfirmModal(false);
    // Reset parse state khi modal đóng/mở
    setParseResult(null);
    setParseError('');
    parsedFileRef.current = null;
  }, [document, open, types, units]);

  // ── Auto-parse PDF khi user chọn file mới ──
  useEffect(() => {
  if (!selectedFile) {
    parsedFileRef.current = null;
    setParseResult(null);
    setParseError('');
    setDuplicateInfo(null);
    setAllowOverride(false);
    return;
  }
  if (isEdit) return;
  if (parsedFileRef.current === selectedFile) return;
  parsedFileRef.current = selectedFile;

  setParsing(true);
  setParseError('');
  setDuplicateInfo(null);
  setAllowOverride(false);

  Promise.all([
    documentService.parseDocument(selectedFile).catch((err) => {
      console.warn('[parse PDF]', err);
      return { success: false, error: err.message } as ParseDocumentResult;
    }),
    documentService.checkDuplicate(selectedFile).catch(() => null),
  ])
    .then(([parseRes, dupRes]) => {
      if (parseRes.success && parseRes.parsed) {
        const p = parseRes.parsed;
        if (p.document_code) setCode(p.document_code);
        if (p.title) setTitle(p.title);
        if (p.issued_date) setIssueDate(p.issued_date);
        if (p.doc_type_code && types.some(t => t.type_id === p.doc_type_code)) {
          setTypeId(p.doc_type_code);
        }
        const signerParts = [p.signer, p.signer_position].filter(Boolean);
        if (signerParts.length > 0) setSigner(signerParts.join(' — '));
        const parsedUnitId = p.issuer_unit_id || p.issuer_parent_unit_id;
        if (parsedUnitId && units.some(u => u.unit_id === parsedUnitId)) {
          setUnitId(parsedUnitId);
        }
        setParseResult(parseRes);
      } else if (parseRes.error) {
        setParseError(parseRes.error);
      }
      if (dupRes) setDuplicateInfo(dupRes);
    })
    .finally(() => setParsing(false));
  // eslint-disable-next-line
}, [selectedFile, isEdit, types, units]);

  if (!open) return null;

  // ── Kiểm tra điền đủ các trường bắt buộc ──
  // Bắt buộc: Tệp (khi tạo mới), Số hiệu, Người ký, Trích yếu, Loại VB, Đơn vị, Độ mật, Ngày ban hành
  const isFormValid = Boolean(
    (isEdit || selectedFile) &&
    code.trim() &&
    signer.trim() &&
    title.trim() &&
    typeId &&
    unitId &&
    securityLevel !== '' &&
    issueDate
  );

  // Tên hiển thị phục vụ bước xác nhận
  const selectedType = types.find((t) => t.type_id === typeId);
  const selectedTypeName = selectedType ? selectedType.name : typeId;

  const selectedUnit = units.find((u) => u.unit_id === unitId);
  const selectedUnitName = selectedUnit ? selectedUnit.name : unitId;

  const selectedLevel = levels.find((l) => l.level_id === Number(securityLevel));
  const selectedSecurityLevelName = selectedLevel ? selectedLevel.name : '';

  const formatDateDisplay = (dStr: string) => {
    if (!dStr) return '—';
    try {
      const [y, m, d] = dStr.split('-');
      if (y && m && d) return `${d}/${m}/${y}`;
      return dStr;
    } catch {
      return dStr;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getSecurityBadgeClass = (name: string) => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('tuyệt mật')) {
      return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
    }
    if (lower.includes('tối mật')) {
      return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30';
    }
    if (lower.includes('mật')) {
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
    }
    return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
  };

  // ── Mở modal xác nhận ──
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isFormValid) {
      setError('Vui lòng điền đầy đủ tất cả các trường dữ liệu bắt buộc (*)!');
      return;
    }

    setShowConfirmModal(true);
  };

  // ── Thực hiện lưu sau khi xác nhận ──
  const executeSave = async () => {
    setError('');
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
      if (securityLevel !== '') {
        formData.append('security_level_id', String(securityLevel));
      }
      if (signer) formData.append('signer', signer.trim());
      if (issueDate) {
        formData.append('issued_date', issueDate);
        formData.append('issue_date', issueDate);
      }
      if (summary) formData.append('summary', summary.trim());

      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      if (allowOverride) {
        formData.append('force_upload', '1');
      }

      await onSave(formData, isEdit);
      if (onToast) {
        onToast(isEdit ? `Đã cập nhật văn bản ${code} thành công!` : `Đã tiếp nhận văn bản ${code} thành công!`, 'success');
      }
      setShowConfirmModal(false);
      onClose();
    } catch (err: any) {
      console.error('[DocumentUploadModal]', err);
      setError(err.message || 'Thao tác không thành công, vui lòng thử lại!');
      setShowConfirmModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div key="upload-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
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
                Tệp văn bản {isEdit ? '(Chọn tệp mới nếu muốn thay thế tệp cũ)' : <span className="text-rose-500 font-bold">*</span>}
              </label>
              <Dropzone selectedFile={selectedFile} onFileSelect={setSelectedFile} />
            </div>

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

            {!parsing && duplicateInfo?.sha_duplicate && (
  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2">
    <div className="flex items-center gap-2 font-semibold text-rose-700 dark:text-rose-400 text-xs">
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span>File này đã tồn tại trong hệ thống (SHA-256 trùng)</span>
    </div>
    <div className="text-[11px] text-rose-600 dark:text-rose-400 space-y-1 pl-6">
      {duplicateInfo.matches.by_sha256.slice(0, 3).map((d) => (
        <div key={d.file_id}>
          • <span className="font-mono">{d.document_code || d.file_id}</span> — {d.title}
        </div>
      ))}
    </div>
    <label className="flex items-center gap-2 text-[11px] text-rose-700 dark:text-rose-300 cursor-pointer pt-1 pl-6">
      <input
        type="checkbox"
        checked={allowOverride}
        onChange={(e) => setAllowOverride(e.target.checked)}
        className="cursor-pointer"
      />
      <span>Tôi muốn ghi đè — vẫn lưu file này (tạo bản ghi mới)</span>
    </label>
  </div>
)}

        {!parsing && !duplicateInfo?.sha_duplicate && duplicateInfo?.code_duplicate && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Cảnh báo: Số hiệu văn bản đã tồn tại</span>
            </div>
            <div className="text-[11px] text-amber-700 dark:text-amber-400 space-y-1 pl-6">
              {duplicateInfo.matches.by_code.slice(0, 3).map((d) => (
                <div key={d.file_id}>
                  • <span className="font-mono">{d.document_code}</span> — {d.title}
                </div>
              ))}
            </div>
            <div className="text-[11px] text-amber-600 dark:text-amber-400 pl-6">
              Vẫn có thể lưu nếu đây là văn bản sửa đổi / đính chính.
            </div>
          </div>
        )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Số hiệu / Ký hiệu văn bản <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ví dụ: 125/QĐ-QK7"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Người ký ban hành <span className="text-rose-500 font-bold">*</span>
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
                Trích yếu nội dung văn bản <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Về việc chỉ đạo triển khai kế hoạch bảo đảm an toàn..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Loại văn bản <span className="text-rose-500 font-bold">*</span>
                </label>
                <select
                  value={typeId}
                  onChange={(e) => setTypeId(e.target.value)}
                  className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors ${
                    typeId ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <option value="" className="text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900">
                     Chọn loại văn bản
                  </option>
                  {types.map((t) => (
                    <option key={t.type_id} value={t.type_id} className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900">
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Đơn vị ban hành <span className="text-rose-500 font-bold">*</span>
                </label>
                <div
                  className="unit-treeselect-wrapper"
                  style={{ position: 'relative', width: '100%' }}
                >
                  <TreeSelect
                    value={unitId || undefined}
                    onChange={(val) => setUnitId(val || '')}
                    treeData={unitTree}
                    placeholder="Chọn đơn vị ban hành"
                    allowClear
                    treeExpandedKeys={treeExpandedKeys}
                    onTreeExpand={(keys) => setTreeExpandedKeys(keys as string[])}
                    onOpenChange={(visible) => {
                      if (visible && rootUnitKeys.length > 0) {
                        setTreeExpandedKeys(rootUnitKeys);
                      }
                    }}
                    treeLine={{ showLeafIcon: false }}
                    switcherIcon={(nodeProps: any) => {
                      if (nodeProps.isLeaf) return null;
                      const isExpanded = Boolean(nodeProps.expanded);
                      return (
                        <span
                          className={`qk7-tree-switcher-btn ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}
                          title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                        >
                          {isExpanded ? (
                            <Minus className="w-3 h-3 stroke-[2.5]" />
                          ) : (
                            <Plus className="w-3 h-3 stroke-[2.5]" />
                          )}
                        </span>
                      );
                    }}
                    treeNodeLabelProp="name"
                    treeNodeFilterProp="name"
                    filterTreeNode={(input: string, node: any) =>
                      String(node.name || '').toLowerCase().includes(input.toLowerCase().trim())
                    }
                    getPopupContainer={(trigger) => (trigger.parentElement as HTMLElement) || window.document.body}
                    className="qk7-treeselect w-full"
                    popupClassName="qk7-unit-treeselect-popup"
                    style={{ width: '100%', height: 38 }}
                    popupMatchSelectWidth={false}
                    popupStyle={{
                      minWidth: 280,
                      maxWidth: 'min(520px, 90vw)',
                      maxHeight: 380,
                      overflowX: 'hidden',
                      overflowY: 'auto',
                    }}
                    dropdownStyle={{
                      minWidth: 280,
                      maxWidth: 'min(520px, 90vw)',
                      maxHeight: 380,
                      overflowX: 'hidden',
                      overflowY: 'auto',
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Độ mật bảo quản <span className="text-rose-500 font-bold">*</span>
                </label>
                <select
                  value={securityLevel}
                  onChange={(e) => setSecurityLevel(e.target.value ? Number(e.target.value) : '')}
                  className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors ${
                    securityLevel !== '' ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <option value="" className="text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900">
                     Chọn độ mật
                  </option>
                  {levels.map((lvl) => (
                    <option key={lvl.level_id} value={lvl.level_id} className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900">
                      {lvl.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Ngày ban hành <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors ${
                    issueDate ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Tóm tắt ghi chú <span className="text-slate-400 font-normal text-[11px]">(tùy chọn)</span>
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

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                {!isFormValid && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Chưa điền đủ thông tin bắt buộc (*)</span>
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={!isFormValid || submitting || (duplicateInfo?.sha_duplicate && !allowOverride)}
                  className={`px-4 py-2 font-bold rounded-xl flex items-center gap-1.5 transition ${
                    isFormValid
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-md shadow-emerald-600/30'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700/60 cursor-not-allowed shadow-none'
                  }`}
                  title={!isFormValid ? 'Vui lòng điền đầy đủ các thông tin bắt buộc (*)' : undefined}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang xử lý...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>{isEdit ? 'Cập nhật văn bản' : 'Lưu trữ văn bản'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>

      {/* ── Bước xác nhận lại thông tin trước khi lưu chính thức ── */}
      {showConfirmModal && (
        <div key="confirm-modal" className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] transition-colors duration-200"
          >
            {/* Header xác nhận */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/70">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Xác Nhận Dữ Liệu Văn Bản
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Vui lòng rà soát kỹ các trường dữ liệu trước khi lưu trữ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nội dung đối soát dữ liệu */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              {/* Card tệp đính kèm */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Tệp văn bản đính kèm</div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {selectedFile ? selectedFile.name : (document?.original_name || 'Tệp hiện tại')}
                  </div>
                  {selectedFile && (
                    <div className="text-[10px] text-slate-500 mt-0.5">Dung lượng: {formatFileSize(selectedFile.size)}</div>
                  )}
                </div>
              </div>

              {/* Bảng chi tiết thông tin */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950/40">
                <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Số hiệu / Ký hiệu:</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                    {code.trim()}
                  </span>
                </div>

                <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Người ký ban hành:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {signer.trim()}
                  </span>
                </div>

                <div className="p-3 sm:px-4 flex flex-col gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Trích yếu nội dung:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs leading-relaxed">
                    {title.trim()}
                  </span>
                </div>

                <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Loại văn bản:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedTypeName || '—'}
                  </span>
                </div>

                <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Đơn vị ban hành:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-right sm:max-w-[65%]">
                    {selectedUnitName || '—'}
                  </span>
                </div>

                <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Độ mật bảo quản:</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getSecurityBadgeClass(selectedSecurityLevelName)}`}>
                    {selectedSecurityLevelName || '—'}
                  </span>
                </div>

                <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Ngày ban hành:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatDateDisplay(issueDate)}
                  </span>
                </div>

                {summary.trim() && (
                  <div className="p-3 sm:px-4 flex flex-col gap-1">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Ghi chú:</span>
                    <span className="text-slate-700 dark:text-slate-300 italic">
                      {summary.trim()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer hành động xác nhận */}
            <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Quay lại chỉnh sửa</span>
              </button>
              <button
                type="button"
                onClick={executeSave}
                disabled={submitting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-600/30 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang lưu trữ...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isEdit ? 'Xác nhận & Cập nhật' : 'Xác nhận & Lưu trữ'}</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
