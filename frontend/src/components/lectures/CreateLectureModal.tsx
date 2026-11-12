import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Save, Loader2, FileText, Info, UploadCloud } from 'lucide-react';
import { lectureService } from '../../services/lectureService';
import { toast } from '../common/Toast';
import { Subject, ContentType, Lecture } from '../../types/lecture';

// ─── Cấu hình tĩnh cho 2 dropdown ───
const SECURITY_LEVELS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Cấp 1 — Công khai' },
  { value: 2, label: 'Cấp 2 — Nội bộ' },
  { value: 3, label: 'Cấp 3 — Mật' },
];

const CONTENT_TYPES: Array<{ value: ContentType; label: string }> = [
  { value: 'PDF',   label: 'Tệp PDF (Tài liệu tĩnh)' },
  { value: 'HTML5', label: 'Gói HTML5 (Tương tác)' },
  { value: 'SCORM', label: 'Gói SCORM (ActivePresenter .zip)' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  subjects: Subject[];
  editLecture?: Lecture | null;
}

export const CreateLectureModal: React.FC<Props> = ({
  open,
  onClose,
  onCreated,
  subjects,
  editLecture,
}) => {
  const [title, setTitle] = useState('');
  const [lectureCode, setLectureCode] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [contentType, setContentType] = useState<ContentType>('PDF');
  const [securityLevel, setSecurityLevel] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // State cho file upload
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─────────────────────────────────────────────────────────────────
  // Build dropdown level động
  // ─────────────────────────────────────────────────────────────────
  const effectiveSecurityLevels = useMemo(() => {
    const base = SECURITY_LEVELS.map((x) => ({ ...x }));
    const currentLevel = editLecture?.security_level_id;
    if (
      typeof currentLevel === 'number' &&
      currentLevel > 3 &&
      !base.some((x) => x.value === currentLevel)
    ) {
      const extraLabel = currentLevel === 4 ? 'Cấp 4 — Tối mật (giữ nguyên)' : 'Cấp 5 — Tuyệt mật (giữ nguyên)';
      base.push({ value: currentLevel, label: extraLabel });
    }
    return base;
  }, [editLecture]);

  useEffect(() => {
    if (!open) return;
    if (editLecture) {
      setTitle(editLecture.title || '');
      setLectureCode(editLecture.lecture_code || '');
      setSubjectId(editLecture.subject_id || '');
      setContentType(editLecture.content_type || 'PDF');
      setSecurityLevel(editLecture.security_level_id || 2);
    } else {
      setTitle('');
      setLectureCode('');
      setSubjectId('');
      setContentType('PDF');
      setSecurityLevel(2);
    }
    setFile(null); // Reset file khi mở modal
    setError('');
  }, [open, editLecture]);

  if (!open) return null;

  const reset = () => {
    setTitle(''); setLectureCode(''); setSubjectId('');
    setContentType('PDF'); setSecurityLevel(2); setError(''); setFile(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.name.toLowerCase().endsWith('.zip')) {
        toast.error('Chỉ chấp nhận file .zip (Gói HTML5/SCORM)');
        return;
      }
      setFile(selected);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) return setError('Vui lòng nhập tiêu đề bài giảng');
    if (!subjectId)    return setError('Vui lòng chọn môn học');

    if (!editLecture && securityLevel > 3) {
      return setError('Cấp bảo mật tối đa cho bài giảng là Cấp 3 — Mật');
    }

    // Nếu tạo mới và là HTML5/SCORM, bắt buộc phải có file
    if (!editLecture && contentType !== 'PDF' && !file) {
      return setError('Vui lòng chọn tệp .zip chứa gói bài giảng');
    }

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        subject_id: subjectId,
        lecture_code: lectureCode.trim() || undefined,
        security_level_id: securityLevel,
        content_type: contentType,
        scorm_entry_point: undefined, // BE tự lấy từ imsmanifest.xml khi giải nén
      };

      let targetLectureId = editLecture?.lecture_id;

      // BƯỚC 1: Tạo hoặc cập nhật bài giảng
      if (editLecture) {
        await lectureService.update(editLecture.lecture_id, payload);
        toast.success('Đã cập nhật bài giảng thành công');
      } else {
        const res = await lectureService.create(payload);
        targetLectureId = res.lecture_id;
        toast.success('Đã tạo bài giảng mới');
      }

      // BƯỚC 2: Upload file .zip (nếu có)
      if (file && targetLectureId && contentType !== 'PDF') {
        toast.info('Đang tải lên gói bài giảng, vui lòng đợi...', { duration: 5000 });
        await lectureService.uploadPackage(targetLectureId, file, contentType as 'HTML5' | 'SCORM');
        toast.success('Đã tải lên gói bài giảng thành công');
      }

      reset();
      onCreated();
    } catch (err: any) {
      setError(err?.message || 'Thao tác thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <FileText className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              {editLecture ? 'Chỉnh sửa bài giảng' : 'Soạn bài giảng mới'}
            </h3>
          </div>
          <button onClick={handleClose} disabled={submitting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 rounded-lg text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tiêu đề bài giảng <span className="text-rose-500">*</span>
            </label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="VD: Bài 1 — Chiến thuật tiến công" autoFocus
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 text-slate-900 dark:text-slate-100" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Mã bài giảng</label>
              <input type="text" value={lectureCode} onChange={e => setLectureCode(e.target.value)}
                placeholder="BG-CTBB-01"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-cyan-600 font-mono text-slate-900 dark:text-slate-100" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Môn học <span className="text-rose-500">*</span></label>
              <select value={subjectId} onChange={e => setSubjectId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-cyan-600 cursor-pointer text-slate-900 dark:text-slate-100">
                <option value="">— Chọn môn —</option>
                {subjects.map(s => <option key={s.subject_id} value={s.subject_id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Loại nội dung</label>
              <select value={contentType} onChange={e => setContentType(e.target.value as ContentType)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer text-slate-900 dark:text-slate-100">
                {CONTENT_TYPES.map(ct => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Cấp bảo mật</label>
              <select value={securityLevel} onChange={e => setSecurityLevel(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer text-slate-900 dark:text-slate-100">
                {effectiveSecurityLevels.map(lv => (
                  <option key={lv.value} value={lv.value}>{lv.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ✅ INPUT UPLOAD FILE DÀNH CHO HTML5 / SCORM */}
          {contentType !== 'PDF' && (
            <div className="pt-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tệp gói bài giảng (.zip) <span className="text-rose-500">*</span>
              </label>
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
              >
                <UploadCloud className="w-8 h-8 text-cyan-500" />
                <span className="font-semibold text-slate-700 dark:text-slate-300 text-center break-all px-2">
                  {file ? file.name : 'Nhấn để chọn file .zip'}
                </span>
                <span className="text-[10px] text-slate-500">
                  {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Chứa file index.html và các thư mục con'}
                </span>
              </div>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".zip" 
                className="hidden" 
              />
              
              <div className="flex items-start gap-1.5 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                <Info className="w-3 h-3 shrink-0 mt-0.5" />
                <span>
                  Hệ thống sẽ tự động giải nén và lấy entry point từ gói khi <strong>duyệt xuất bản</strong>.
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={handleClose} disabled={submitting}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold disabled:opacity-40">
              Hủy
            </button>
            <button type="submit" disabled={submitting}
              className="px-4 py-2 bg-gradient-to-r from-[#0e7490] via-[#0891b2] to-[#06b6d4] hover:from-[#0891b2] hover:to-[#22d3ee] text-white rounded-lg font-bold flex items-center gap-1.5 disabled:opacity-40">
              {submitting ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Đang xử lý...</span></>
              ) : (
                <><Save className="w-3.5 h-3.5" /><span>{editLecture ? 'Lưu thay đổi' : 'Tạo bài giảng'}</span></>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateLectureModal;
