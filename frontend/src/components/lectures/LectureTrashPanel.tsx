import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, RotateCcw, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from '../common/Toast';
import { lectureService } from '../../services/lectureService';
import { Lecture } from '../../types/lecture';

/**
 * Thùng rác BÀI GIẢNG (trang Quản trị) — bài giảng bị giáo viên/chỉ huy xóa mềm nằm ở đây.
 * Chỉ Admin (ROL-01) khôi phục hoặc xóa vĩnh viễn (backend cũng chặn lại).
 */
export const LectureTrashPanel: React.FC = () => {
  const [items, setItems] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ lec: Lecture; kind: 'restore' | 'purge' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lectureService.list({ status: 'DELETED' });
      setItems(res.items || []);
    } catch (err: any) {
      toast.error('Lỗi tải thùng rác bài giảng: ' + (err?.message || 'Lỗi không xác định'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runConfirmed = async () => {
    if (!confirm) return;
    const { lec, kind } = confirm;
    setBusyId(lec.lecture_id);
    try {
      if (kind === 'restore') {
        await lectureService.restore(lec.lecture_id);
        toast.success(`Đã khôi phục "${lec.title}" về Bản nháp`);
      } else {
        await lectureService.purge(lec.lecture_id);
        toast.success(`Đã xóa vĩnh viễn "${lec.title}" khỏi hệ thống`);
      }
      setConfirm(null);
      await load();
    } catch (err: any) {
      toast.error(err?.message || (kind === 'restore' ? 'Khôi phục thất bại' : 'Xóa vĩnh viễn thất bại'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-500" />
            Thùng Rác Bài Giảng
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {items.length} bài giảng đã xóa mềm. Chỉ Quản trị viên mới được khôi phục hoặc xóa vĩnh viễn.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-white/[0.08] overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="text-[11px] uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/[0.08]">
            <tr>
              <th className="py-3 px-3">Mã</th>
              <th className="py-3 px-3">Tên bài giảng</th>
              <th className="py-3 px-3">Giảng viên</th>
              <th className="py-3 px-3">Khoa / Bộ môn</th>
              <th className="py-3 px-3">Xóa lúc</th>
              <th className="py-3 px-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-500 dark:text-slate-400">
                  {loading ? 'Đang tải...' : 'Thùng rác bài giảng trống'}
                </td>
              </tr>
            ) : items.map((lec) => (
              <tr key={lec.lecture_id} className="border-b border-slate-100 dark:border-white/[0.05]">
                <td className="py-3 px-3 font-mono tabular-nums text-amber-700 dark:text-amber-400 max-w-[130px] truncate" title={lec.lecture_code}>{lec.lecture_code}</td>
                <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-100 max-w-[200px] truncate" title={lec.title}>{lec.title}</td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-300 max-w-[170px] truncate" title={`${lec.author_rank || ''} ${lec.author_name || ''}`.trim()}>{lec.author_rank ? `${lec.author_rank} ` : ''}{lec.author_name}</td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-300 max-w-[140px] truncate" title={lec.faculty_name}>{lec.faculty_name}</td>
                <td className="py-3 px-3 font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  {lec.updated_at ? new Date(lec.updated_at).toLocaleString('vi-VN') : '—'}
                </td>
                <td className="py-3 px-3">
                  <div className="flex justify-end gap-2 flex-nowrap">
                    <button
                      type="button"
                      disabled={busyId === lec.lecture_id}
                      onClick={() => setConfirm({ lec, kind: 'restore' })}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30 flex items-center gap-1 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Khôi phục
                    </button>
                    <button
                      type="button"
                      disabled={busyId === lec.lecture_id}
                      onClick={() => setConfirm({ lec, kind: 'purge' })}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white border border-rose-700 flex items-center gap-1 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" /> Xóa vĩnh viễn
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-[#0c1420] border border-slate-300 dark:border-white/10 rounded-2xl p-6 shadow-2xl text-left">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3">
              {confirm.kind === 'restore' ? 'Khôi phục bài giảng' : 'CẢNH BÁO: XÓA VĨNH VIỄN'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
              {confirm.kind === 'restore'
                ? `Khôi phục bài giảng "${confirm.lec.title}" về trạng thái Bản nháp để giảng viên tiếp tục hiệu chỉnh?`
                : `Xóa vĩnh viễn bài giảng "${confirm.lec.title}", toàn bộ gói học liệu SCORM/HTML5 và câu hỏi Quiz khỏi ổ cứng máy chủ. Thao tác này KHÔNG THỂ HOÀN TÁC.`}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={busyId !== null}
                onClick={runConfirmed}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50 ${
                  confirm.kind === 'restore' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {confirm.kind === 'restore' ? 'Khôi phục' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LectureTrashPanel;
