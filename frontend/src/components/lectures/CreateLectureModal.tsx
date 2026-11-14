import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Save, Loader2, FileText, BookOpen, Shield,
  Layers, Sparkles, Check, Info, AlertCircle, Hash
} from 'lucide-react';
import { lectureService } from '../../services/lectureService';
import { toast } from '../common/Toast';
import { Subject, ContentType, Lecture } from '../../types/lecture';
import { LecturePackageDropzone } from './LecturePackageDropzone';

// ─── Cấu hình Cấp bảo mật bài giảng ───
const SECURITY_LEVELS: Array<{ value: number; label: string; desc: string; badge: string }> = [
  {
    value: 1,
    label: 'Cấp 1 — Công khai',
    desc: 'Học viên và cán bộ toàn trường đều xem được',
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
  {
    value: 2,
    label: 'Cấp 2 — Nội bộ',
    desc: 'Chỉ lưu hành nội bộ trong đơn vị, khoa đào tạo',
    badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
  },
  {
    value: 3,
    label: 'Cấp 3 — Mật',
    desc: 'Yêu cầu xác thực sinh trắc học vân tay khi truy cập',
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
];

// ─── Cấu hình 3 Định dạng bài giảng số hóa ───
const CONTENT_TYPE_OPTIONS: Array<{
  value: ContentType;
  title: string;
  badge: string;
  desc: string;
  icon: any;
}> = [
  {
    value: 'PDF',
    title: 'Tệp PDF',
    badge: 'Văn bản tĩnh',
    desc: 'Giáo trình, tài liệu bài giảng dạng số tĩnh hoặc liên kết từ kho tài liệu',
    icon: FileText,
  },
  {
    value: 'HTML5',
    title: 'Tương tác HTML5',
    badge: 'Sa bàn số',
    desc: 'Mô phỏng chiến thuật, bài tập đa phương tiện tương tác cao',
    icon: Sparkles,
  },
  {
    value: 'SCORM',
    title: 'Chuẩn SCORM',
    badge: 'e-Learning LMS',
    desc: 'Gói ActivePresenter / Storyline theo dõi tiến trình và điểm số học viên',
    icon: Layers,
  },
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

  // State cho file upload gói .zip
  const [file, setFile] = useState<File | null>(null);

  // Build dropdown level động
  const effectiveSecurityLevels = useMemo(() => {
    const base = SECURITY_LEVELS.map((x) => ({ ...x }));
    const currentLevel = editLecture?.security_level_id;
    if (
      typeof currentLevel === 'number' &&
      currentLevel > 3 &&
      !base.some((x) => x.value === currentLevel)
    ) {
      const extraLabel =
        currentLevel === 4
          ? 'Cấp 4 — Tối mật (giữ nguyên)'
          : 'Cấp 5 — Tuyệt mật (giữ nguyên)';
      base.push({
        value: currentLevel,
        label: extraLabel,
        desc: 'Hồ sơ mật đặc biệt',
        badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
      });
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
    setFile(null);
    setError('');
  }, [open, editLecture]);

  if (!open) return null;

  const reset = () => {
    setTitle('');
    setLectureCode('');
    setSubjectId('');
    setContentType('PDF');
    setSecurityLevel(2);
    setError('');
    setFile(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) return setError('Vui lòng nhập tiêu đề bài giảng');
    if (!subjectId) return setError('Vui lòng chọn môn học');

    if (!editLecture && securityLevel > 3) {
      return setError('Cấp bảo mật tối đa cho bài giảng mới là Cấp 3 — Mật');
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
        toast.success('Đã tạo bài giảng mới thành công');
      }

      // BƯỚC 2: Upload file bài giảng (PDF / HTML5 / SCORM) nếu có
      if (file && targetLectureId) {
        toast.info(
          contentType === 'PDF'
            ? 'Đang nạp tệp giáo án PDF lên máy chủ...'
            : 'Đang nạp gói bài giảng lên máy chủ...',
          { duration: 4000 }
        );
        await lectureService.uploadPackage(
          targetLectureId,
          file,
          contentType
        );
        toast.success(
          contentType === 'PDF'
            ? 'Đã lưu tệp giáo án PDF cho bài giảng thành công'
            : 'Đã giải nén và lưu gói bài giảng thành công'
        );
      }

      reset();
      onCreated();
    } catch (err: any) {
      setError(err?.message || 'Thao tác không thành công');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header Modal phong cách Chỉ huy Quân sự */}
        <div className="p-4 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-2xs">
              <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {editLecture ? 'Chỉnh sửa hồ sơ bài giảng' : 'Soạn bài giảng số mới'}
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  {editLecture ? 'Cập nhật' : 'Khởi tạo'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Trường Quân Sự Quân Khu 7 — Khung chuẩn hóa giáo án & bài giảng điện tử
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 min-h-[38px] min-w-[38px] flex items-center justify-center"
            title="Đóng (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5 text-xs overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300 flex items-start gap-2.5 shadow-2xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* ── BƯỚC 1: Chọn định dạng bài giảng (Card Selector) ── */}
          <div>
            <label className="block font-bold text-slate-800 dark:text-slate-200 mb-2">
              1. Định dạng bài giảng số hóa <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {CONTENT_TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = contentType === opt.value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => setContentType(opt.value)}
                    className={`relative p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs'
                        : 'border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 bg-white dark:bg-slate-950/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-0.5">
                        {opt.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        {opt.desc}
                      </p>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-white/[0.04]">
                      <span className="font-mono text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-500">
                        {opt.badge}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── BƯỚC 2: Thông tin định danh ── */}
          <div className="space-y-3.5 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
            <label className="block font-bold text-slate-800 dark:text-slate-200">
              2. Thông tin định danh bài giảng
            </label>

            <div>
              <span className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tiêu đề bài giảng <span className="text-rose-500">*</span>
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Bài 1 — Chiến thuật tiến công Đại đội Bộ binh"
                autoFocus
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-slate-900 dark:text-slate-100 text-xs font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Hash className="w-3 h-3 text-slate-400" />
                  Mã bài giảng
                </span>
                <input
                  type="text"
                  value={lectureCode}
                  onChange={(e) => setLectureCode(e.target.value)}
                  placeholder="VD: BG-CTBB-01"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-600 font-mono text-slate-900 dark:text-slate-100 text-xs"
                />
              </div>

              <div>
                <span className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-slate-400" />
                  Môn học <span className="text-rose-500">*</span>
                </span>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-emerald-600 cursor-pointer text-slate-900 dark:text-slate-100 text-xs"
                >
                  <option value="">Chọn môn học</option>
                  {subjects.map((s) => (
                    <option key={s.subject_id} value={s.subject_id}>
                      {s.name} {s.faculty_name ? `(${s.faculty_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── BƯỚC 3: Cấp độ bảo mật ── */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
            <label className="block font-bold text-slate-800 dark:text-slate-200">
              3. Cấp độ bảo mật & Kiểm soát truy cập
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {effectiveSecurityLevels.map((lv) => {
                const isSelected = securityLevel === lv.value;
                return (
                  <div
                    key={lv.value}
                    onClick={() => setSecurityLevel(lv.value)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20'
                        : 'border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20'
                    }`}
                  >
                    <Shield
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        lv.value === 1
                          ? 'text-emerald-600'
                          : lv.value === 2
                          ? 'text-blue-600'
                          : 'text-amber-600'
                      }`}
                    />
                    <div className="min-w-0">
                      <span className="font-bold text-slate-900 dark:text-white block text-xs">
                        {lv.label}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block leading-tight mt-0.5">
                        {lv.desc}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── BƯỚC 4: Tải lên gói tệp bài giảng số hóa ── */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-slate-800 dark:text-slate-200">
                4. Tệp dữ liệu bài giảng số hóa
              </label>
              {contentType === 'PDF' && editLecture?.document_id && !file && (
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Đã có tệp PDF đính kèm
                </span>
              )}
            </div>

            <LecturePackageDropzone
              selectedFile={file}
              onFileSelect={setFile}
              contentType={contentType}
            />
          </div>

          {/* Bottom Action Bar */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition disabled:opacity-40 min-h-[44px]"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-gradient-to-r from-[#166534] via-[#15803d] to-[#16a34a] hover:from-[#15803d] hover:to-[#22c55e] border border-emerald-400/30 text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-40 shadow-sm transition active:scale-[0.98] min-h-[44px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xử lý hồ sơ...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{editLecture ? 'Lưu thay đổi' : 'Tạo bài giảng'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateLectureModal;
