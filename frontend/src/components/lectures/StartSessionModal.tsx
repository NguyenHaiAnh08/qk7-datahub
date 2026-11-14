import React, { useState, useEffect, useMemo } from 'react';
import { X, Play, Loader2 } from 'lucide-react';
import { lectureService } from '../../services/lectureService';
import { toast } from '../common/Toast';
import { useAuth } from '../../hooks/useAuth';
import { Lecture, TrainingClass, SessionType, TeachingSchedule } from '../../types/lecture';

interface Props {
  open: boolean;
  lecture: Lecture | null;
  onClose: () => void;
  onStarted: (session: TeachingSchedule, lecture: Lecture) => void;
}

export const StartSessionModal: React.FC<Props> = ({ open, lecture, onClose, onStarted }) => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<TrainingClass[]>([]);
  const [venues, setVenues] = useState<{ venue_name: string; usage_count: number }[]>([]);
  const [classId, setClassId] = useState('');
  const [venue, setVenue] = useState('');
  const [studentCount, setStudentCount] = useState<string>('');
  const [sessionType, setSessionType] = useState<SessionType>('TEACHER_LED');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // ⭐ Lấy lớp đang chọn ở cấp component — dùng chung cho render + submit
  const selectedClass = useMemo(
    () => classes.find(c => c.class_id === classId) || null,
    [classes, classId]
  );

  // Load catalogs (classes + venues) khi modal mở
  useEffect(() => {
    if (!open) return;
    Promise.all([lectureService.getClasses(), lectureService.getVenues()])
      .then(([cls, vns]) => {
        setClasses(Array.isArray(cls) ? cls : []);
        setVenues(Array.isArray(vns) ? vns : []);
      })
      .catch((err: any) => {
        console.error('[StartSessionModal catalogs]', err);
        toast.error('Không thể tải danh sách lớp / giảng đường');
        setClasses([]);
        setVenues([]);
      });
    setClassId('');
    setVenue('');
    setStudentCount('');
    setSessionType('TEACHER_LED');
    setNote('');
    setError('');
  }, [open]);

  // ⭐ Auto-select lớp đầu tiên + tự điền sĩ số khi classes load xong
  useEffect(() => {
    if (classes.length > 0 && !classId) {
      const first = classes[0];
      setClassId(first.class_id);
      if (first.student_total != null) {
        setStudentCount(String(first.student_total));
      }
    }
  }, [classes, classId]);

  if (!open || !lecture) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!classId) return setError('Vui lòng chọn lớp học');
    if (!venue.trim()) return setError('Vui lòng nhập giảng đường');

    setSubmitting(true);
    const tokenKey = `qk7_fp_lecture_${lecture.lecture_id}`;

    try {
      const parsedCount = parseInt(studentCount, 10);
      const count = Number.isFinite(parsedCount) && parsedCount >= 0 ? parsedCount : 0;

      // ⚠️ Chỉ yêu cầu token nếu bài giảng Cấp 3+
      const fpToken =
        lecture.security_level_id >= 3 && typeof window !== 'undefined'
          ? sessionStorage.getItem(tokenKey)
          : null;

      if (lecture.security_level_id >= 3 && !fpToken) {
        setError(
          'Phiên xác thực vân tay đã hết hạn hoặc chưa có. Vui lòng đóng hộp thoại này và bấm "Mở ca dạy" lại để quét vân tay.'
        );
        setSubmitting(false);
        return;
      }

      const { schedule_id } = await lectureService.startSchedule(
        {
          lecture_id: lecture.lecture_id,
          class_id: classId,
          venue_name: venue.trim(),
          student_count: count,
          session_type: sessionType,
          note: note.trim() || undefined,
        },
        fpToken || undefined
      );

      // Xóa token sau khi mở ca thành công
      if (fpToken) sessionStorage.removeItem(tokenKey);

      // Construct đầy đủ TeachingSchedule để LiveSessionRoom render được ngay
      const session: TeachingSchedule = {
        schedule_id,
        lecture_id: lecture.lecture_id,
        lecture_title: lecture.title,
        subject_name: lecture.subject_name,

        presenter_id: user?.user_id ?? lecture.author_id,
        presenter_name: user?.full_name ?? lecture.author_name,
        presenter_rank: user?.rank_name ?? lecture.author_rank,
        presenter_position: user?.position,

        class_id: classId,
        class_name: selectedClass?.class_name,
        class_student_total: selectedClass?.student_total,   // ⭐ Đính kèm sĩ số chính thức

        venue_name: venue.trim(),
        student_count: count,
        session_type: sessionType,
        note: note.trim() || undefined,
        start_time: new Date().toISOString(),
        status: 'ONGOING',
        is_hanging: false,
        quiz_activated_count: 0,
        quiz_total_count: 0,
      };

      toast.success(`Đã mở ca giảng dạy cho "${lecture.title}"`);
      onStarted(session, lecture);
    } catch (err: any) {
      const msg = err?.message || 'Mở ca thất bại';

      // 🧹 Token hỏng/hết hạn → PHẢI xóa để user quét lại từ đầu
      if (
        msg.includes('vân tay') ||
        msg.includes('quét lại') ||
        msg.includes('hết hạn') ||
        err?.status === 403
      ) {
        sessionStorage.removeItem(tokenKey);
        setError(
          `${msg}\n\nVui lòng đóng hộp thoại này, bấm "Mở ca dạy" trên bài giảng để quét vân tay lại.`
        );
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Play className="w-4 h-4 text-emerald-600 dark:text-emerald-400 fill-emerald-600/30" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Mở ca giảng dạy</h3>
              <p
                className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[260px]"
                title={lecture.title}
              >
                {lecture.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          {error && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 rounded-lg text-rose-700 dark:text-rose-300 whitespace-pre-line">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Lớp học <span className="text-rose-500">*</span>
            </label>
            <select
              value={classId}
              onChange={e => {
                const newId = e.target.value;
                setClassId(newId);
                const cls = classes.find(c => c.class_id === newId);
                if (cls?.student_total != null) {
                  setStudentCount(String(cls.student_total));   // ⭐ Auto-fill sĩ số
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            >
              <option value="">Chọn lớp</option>
              {classes.map(c => (
                <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Giảng đường <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              list="venues-list"
              value={venue}
              onChange={e => setVenue(e.target.value)}
              placeholder="VD: Giảng đường A1"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:opacity-0"
            />
            <datalist id="venues-list">
              {venues.map(v => (
                <option key={v.venue_name} value={v.venue_name} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Sĩ số học viên
                {selectedClass?.student_total != null && (
                  <span className="ml-1 text-[10px] font-normal text-slate-400">
                    (Cố định: {selectedClass.student_total})
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  value={studentCount}
                  onChange={e => setStudentCount(e.target.value)}
                  placeholder="VD: 100"
                  className="w-full px-3 py-2 pr-12 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                {selectedClass?.student_total != null && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-amber-600 dark:text-amber-400 pointer-events-none">
                    / {selectedClass.student_total}
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Loại ca</label>
              <select
                value={sessionType}
                onChange={e => setSessionType(e.target.value as SessionType)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              >
                <option value="TEACHER_LED">GV giảng dạy</option>
                <option value="SELF_STUDY">Tự học</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Ghi chú</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="VD: Ôn tập kiến thức"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg resize-none text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold disabled:opacity-40"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-gradient-to-r from-[#166534] via-[#15803d] to-[#16a34a] hover:from-[#15803d] hover:to-[#22c55e] border border-emerald-400/30 text-white rounded-lg font-bold flex items-center gap-1.5 disabled:opacity-40 shadow-sm transition active:scale-[0.98]"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang mở...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white/20" />
                  <span>Mở ca dạy</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StartSessionModal;