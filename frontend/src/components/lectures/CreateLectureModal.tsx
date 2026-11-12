import React, { useState, useEffect } from 'react';
import { X, UploadCloud, FileArchive, Loader2 } from 'lucide-react';
import { lectureService } from '../../services/lectureService';
import { Subject, ContentType } from '../../types/lecture';
import { toast } from '../common/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateLectureModal: React.FC<Props> = ({ open, onClose, onSuccess }) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    lecture_code: '',
    subject_id: '',
    content_type: 'HTML5' as ContentType,
    security_level_id: 1,
  });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      lectureService.getSubjects().then(res => setSubjects(res.items)).catch(console.error);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.subject_id || !file) {
      toast.error('Vui lòng điền đủ thông tin và chọn file .zip');
      return;
    }

    setLoading(true);
    try {
      // 1. Tạo bài giảng (DRAFT)
      const createRes = await lectureService.createLecture(formData);
      const lectureId = createRes.lecture_id;

      // 2. Upload file ZIP
      await lectureService.uploadPackage(lectureId, file, formData.content_type === 'SCORM' ? 'SCORM' : 'HTML5');
      
      toast.success('Tạo bài giảng và tải gói học liệu thành công!');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Có lỗi xảy ra khi tạo bài giảng');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <FileArchive className="w-5 h-5 text-cyan-500" />
            Soạn bài giảng mới
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-sm">
          <div>
            <label className="block font-medium mb-1">Tiêu đề bài giảng *</label>
            <input
              type="text" required
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-950"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1">Mã bài giảng</label>
              <input
                type="text"
                value={formData.lecture_code}
                onChange={e => setFormData({ ...formData, lecture_code: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Môn học *</label>
              <select
                required
                value={formData.subject_id}
                onChange={e => setFormData({ ...formData, subject_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-950"
              >
                <option value="">Chọn môn học</option>
                {subjects.map(s => <option key={s.subject_id} value={s.subject_id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1">Loại nội dung</label>
              <select
                value={formData.content_type}
                onChange={e => setFormData({ ...formData, content_type: e.target.value as ContentType })}
                className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-950"
              >
                <option value="HTML5">Gói HTML5 (Tương tác)</option>
                <option value="SCORM">Gói SCORM 1.2</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Cấp bảo mật</label>
              <select
                value={formData.security_level_id}
                onChange={e => setFormData({ ...formData, security_level_id: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-950"
              >
                <option value={1}>Cấp 1 - Công khai</option>
                <option value={2}>Cấp 2 - Nội bộ</option>
                <option value={3}>Cấp 3 - Mật</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium mb-1">Tệp gói bài giảng (.zip) *</label>
            <div className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:bg-slate-50 relative">
              <input
                type="file" accept=".zip" required
                onChange={e => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium">{file ? file.name : 'Nhấn hoặc kéo thả file .zip vào đây'}</p>
              {file && <p className="text-xs text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-100 font-medium">Hủy</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-cyan-600 text-white font-medium flex items-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Đang xử lý...' : 'Tạo bài giảng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};