import React, { useState, useEffect } from 'react';
import { X, Play, Loader2 } from 'lucide-react';
import { lectureService } from '../../services/lectureService';
import { toast } from '../common/Toast';
import { useAuth } from '../../hooks/useAuth';
import { Lecture, TrainingClass, SessionType, TeachingSchedule, LectureRoomOption } from '../../types/lecture';

interface Props {
  open: boolean;
  lecture: Lecture | null;
  onClose: () => void;
  onStarted: (session: TeachingSchedule, lecture: Lecture) => void;
}

export const StartSessionModal: React.FC<Props> = ({ open, lecture, onClose, onStarted }) => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<TrainingClass[]>([]);
  const [rooms, setRooms] = useState<LectureRoomOption[]>([]);
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [classId, setClassId] = useState('');
  const [buildingCode, setBuildingCode] = useState('');
  const [roomId, setRoomId] = useState('');
  const [studentCount, setStudentCount] = useState<string>('');
  const [sessionType, setSessionType] = useState<SessionType>('TEACHER_LED');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

<<<<<<< HEAD
=======
  // ⭐ Lấy lớp đang chọn ở cấp component — dùng chung cho render + submit
  const selectedClass = useMemo(
    () => classes.find(c => c.class_id === classId) || null,
    [classes, classId]
  );

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.room_id === roomId) || null,
    [rooms, roomId]
  );

  // Danh sách khu (giữ thứ tự backend trả về) kèm số phòng còn dùng được
  const buildingOptions = useMemo(() => {
    const map = new Map<string, { code: string; name: string; total: number; free: number }>();
    for (const r of rooms) {
      if (!map.has(r.building_code)) {
        map.set(r.building_code, { code: r.building_code, name: r.building_name, total: 0, free: 0 });
      }
      const b = map.get(r.building_code)!;
      b.total += 1;
      if (!r.is_busy && !r.is_maintenance) b.free += 1;
    }
    return Array.from(map.values());
  }, [rooms]);

  // Chỉ phòng thuộc khu đã chọn (tên phòng có thể trùng giữa các khu nên phải chọn khu trước)
  const roomsOfBuilding = useMemo(
    () => rooms.filter((r) => r.building_code === buildingCode),
    [rooms, buildingCode]
  );

  // Chỉ có đúng 1 khu → tự chọn sẵn
  useEffect(() => {
    if (buildingOptions.length === 1 && !buildingCode) setBuildingCode(buildingOptions[0].code);
  }, [buildingOptions, buildingCode]);

  // Load catalogs (classes + rooms) khi modal mở
>>>>>>> 4e3a8e94bb31ee5981cca67eabd4a8bf681e9423
  useEffect(() => {
    if (!open) return;
    setRoomsLoaded(false);
    Promise.all([lectureService.getClasses(), lectureService.getRooms()])
      .then(([cls, rms]) => {
        setClasses(Array.isArray(cls) ? cls : []);
        setRooms(Array.isArray(rms) ? rms : []);
        setRoomsLoaded(true);
      })
      .catch((err: any) => {
        console.error('[StartSessionModal catalogs]', err);
        toast.error('Không thể tải danh sách lớp / giảng đường');
        setClasses([]);
        setRooms([]);
        setRoomsLoaded(true);
      });
    setClassId('');
    setBuildingCode('');
    setRoomId('');
    setStudentCount('');
    setSessionType('TEACHER_LED');
    setNote('');
    setError('');
  }, [open]);

  if (!open || !lecture) return null;

<<<<<<< HEAD
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  if (!classId) return setError('Vui lòng chọn lớp học');
  if (!venue.trim()) return setError('Vui lòng nhập giảng đường');
=======
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!classId) return setError('Vui lòng chọn lớp học');
    if (!buildingCode) return setError('Vui lòng chọn khu giảng đường');
    if (!selectedRoom) return setError('Vui lòng chọn giảng đường từ danh sách');
>>>>>>> 4e3a8e94bb31ee5981cca67eabd4a8bf681e9423

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
      setError('Phiên xác thực vân tay đã hết hạn hoặc chưa có. Vui lòng đóng hộp thoại này và bấm "Mở ca dạy" lại để quét vân tay.');
      setSubmitting(false);
      return;
    }

<<<<<<< HEAD
    const { schedule_id } = await lectureService.startSchedule(
      {
=======
      const { schedule_id } = await lectureService.startSchedule(
        {
          lecture_id: lecture.lecture_id,
          class_id: classId,
          room_id: selectedRoom!.room_id,
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
>>>>>>> 4e3a8e94bb31ee5981cca67eabd4a8bf681e9423
        lecture_id: lecture.lecture_id,
        class_id: classId,
<<<<<<< HEAD
        venue_name: venue.trim(),
=======
        class_name: selectedClass?.class_name,
        class_student_total: selectedClass?.student_total,   // ⭐ Đính kèm sĩ số chính thức

        venue_name: selectedRoom!.room_name,
>>>>>>> 4e3a8e94bb31ee5981cca67eabd4a8bf681e9423
        student_count: count,
        session_type: sessionType,
        note: note.trim() || undefined,
      },
      fpToken || undefined
    );

    // Xóa token sau khi mở ca thành công
    if (fpToken) sessionStorage.removeItem(tokenKey);

    const selectedClass = classes.find(c => c.class_id === classId);

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
            <div className="p-2.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 rounded-lg text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Lớp học <span className="text-rose-500">*</span>
            </label>
            <select
              value={classId}
              onChange={e => setClassId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            >
              <option value="">Chọn lớp</option>
              {classes.map(c => (
                <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Khu giảng đường <span className="text-rose-500">*</span>
              </label>
              <select
                value={buildingCode}
                onChange={(e) => { setBuildingCode(e.target.value); setRoomId(''); }}
                required
                disabled={roomsLoaded && rooms.length === 0}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:opacity-60"
              >
                <option value="">{roomsLoaded ? '— Chọn khu —' : 'Đang tải danh sách...'}</option>
                {buildingOptions.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name} ({b.free}/{b.total} phòng trống)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Giảng đường <span className="text-rose-500">*</span>
              </label>
              <select
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                required
                disabled={!buildingCode}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:opacity-60"
              >
                <option value="">{buildingCode ? '— Chọn phòng —' : 'Chọn khu trước'}</option>
                {roomsOfBuilding.map((r) => {
                  const blocked = r.is_maintenance || r.is_busy;
                  const tag = r.is_maintenance ? ' — đang bảo trì' : r.is_busy ? ' — đang có ca' : '';
                  return (
                    <option key={r.room_id} value={r.room_id} disabled={blocked}>
                      {r.room_name}{r.capacity ? ` (${r.capacity} chỗ)` : ''}{tag}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          <div className="-mt-2">
            {roomsLoaded && rooms.length === 0 && (
              <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
                Chưa có giảng đường nào được cấu hình. Liên hệ quản trị viên để thêm trong mục Giảng đường.
              </p>
            )}
            {selectedRoom?.capacity != null && Number(studentCount) > selectedRoom.capacity && (
              <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                Sĩ số vượt sức chứa của phòng ({selectedRoom.capacity} chỗ).
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Sĩ số học viên</label>
              <input
                type="number"
                min={0}
                value={studentCount}
                onChange={e => setStudentCount(e.target.value)}
                placeholder="VD: 100"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
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