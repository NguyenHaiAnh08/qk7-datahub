import React, { useState, useEffect } from 'react';
import { X, Play } from 'lucide-react';
import { lectureService } from '../../services/lectureService';
import { Lecture, TrainingClass } from '../../types/lecture';
import { toast } from '../common/Toast';

interface Props {
  open: boolean;
  lecture: Lecture;
  onClose: () => void;
  onSuccess: () => void;
}

export const StartSessionModal: React.FC<Props> = ({ open, lecture, onClose, onSuccess }) => {
  const [classes, setClasses] = useState<TrainingClass[]>([]);
  const [venues, setVenues] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    class_id: '',
    venue_name: '',
    student_count: 40,
    session_type: 'TEACHER_LED'
  });

  useEffect(() => {
    if (open) {
      lectureService.getClasses().then(r => setClasses(r.items)).catch(console.error);
      lectureService.getVenues().then(r => setVenues(r.items.map(v => v.venue_name))).catch(console.error);
    }
  }, [open]);

  const handleStart = async () => {
    if (!formData.class_id || !formData.venue_name) {
      toast.error('Vui lòng chọn lớp và giảng đường');
      return;
    }
    setLoading(true);
    try {
      await lectureService.startSession({
        lecture_id: lecture.lecture_id,
        ...formData
      });
      toast.success('Đã bắt đầu ca giảng dạy!');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl p-5">
        <h3 className="font-bold text-lg mb-4 text-cyan-600 flex items-center gap-2">
          <Play className="w-5 h-5" /> Bắt đầu ca giảng dạy
        </h3>
        
        <div className="space-y-4 text-sm">
          <div>
            <label className="block font-medium mb-1">Bài giảng</label>
            <input type="text" disabled value={lecture.title} className="w-full px-3 py-2 bg-slate-100 border rounded-lg text-slate-500" />
          </div>
          
          <div>
            <label className="block font-medium mb-1">Lớp học *</label>
            <select
              value={formData.class_id}
              onChange={e => setFormData({ ...formData, class_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg bg-slate-50"
            >
              <option value="">Chọn lớp</option>
              {classes.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
            </select>
          </div>
          
          <div>
            <label className="block font-medium mb-1">Giảng đường *</label>
            <input
              type="text" list="venues"
              value={formData.venue_name}
              onChange={e => setFormData({ ...formData, venue_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg bg-slate-50"
              placeholder="Nhập tên giảng đường..."
            />
            <datalist id="venues">
              {venues.map(v => <option key={v} value={v} />)}
            </datalist>
          </div>
          
          <div>
            <label className="block font-medium mb-1">Sĩ số</label>
            <input
              type="number"
              value={formData.student_count}
              onChange={e => setFormData({ ...formData, student_count: Number(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg bg-slate-50"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-100">Hủy</button>
          <button onClick={handleStart} disabled={loading} className="px-4 py-2 rounded-lg bg-cyan-600 text-white font-medium">
            {loading ? 'Đang mở...' : 'Bắt đầu ngay'}
          </button>
        </div>
      </div>
    </div>
  );
};