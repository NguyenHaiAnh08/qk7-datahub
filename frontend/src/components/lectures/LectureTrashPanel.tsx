import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, RotateCcw, Trash2, AlertTriangle, Search, X, CheckCircle2 } from 'lucide-react';
import { toast } from '../common/Toast';
import { TacticalEmptyState } from '../common/TacticalEmptyState';
import { PaginationBar } from '../common/PaginationBar';
import { lectureService } from '../../services/lectureService';
import { Lecture } from '../../types/lecture';

const PAGE_SIZE = 30;

/**
 * Thùng rác BÀI GIẢNG (trang Quản trị) — bài giảng bị giáo viên/chỉ huy xóa mềm nằm ở đây.
 * Chỉ Admin (ROL-01) khôi phục hoặc xóa vĩnh viễn (backend cũng chặn lại).
 */
export const LectureTrashPanel: React.FC = () => {
  const [items, setItems] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
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

  useEffect(() => {
    if (!confirm) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirm(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirm]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (lec) =>
        (lec.lecture_code || '').toLowerCase().includes(q) ||
        (lec.title || '').toLowerCase().includes(q) ||
        (lec.author_name || '').toLowerCase().includes(q) ||
        (lec.faculty_name || '').toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  useEffect(() => { setPage(1); }, [searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  );

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
      {/* Command Header Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 border-l-4 border-l-[#b91c1c] dark:border-l-rose-500 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200/80 dark:border-rose-500/30 flex items-center justify-center shrink-0 text-[#b91c1c] dark:text-rose-400">
              <Trash2 className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Thùng Rác Bài Giảng
                </h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold font-mono tabular-nums bg-rose-50 dark:bg-rose-500/15 text-[#b91c1c] dark:text-rose-300 border border-rose-200/80 dark:border-rose-500/30">
                  {items.length} bài giảng
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Lưu giữ các bài giảng đã xóa mềm. Chỉ Quản trị viên mới được khôi phục về Bản nháp hoặc xóa vĩnh viễn.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="min-h-[38px] px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 self-start sm:self-center disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#166534] dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo mã bài giảng, tên bài giảng, giảng viên hoặc khoa/bộ môn..."
            className="w-full min-h-[38px] pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#166534] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#166534]/15 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[820px]">
            <thead className="bg-slate-50 dark:bg-slate-900/90 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4 w-36">Mã</th>
                <th className="py-3.5 px-4">Tên bài giảng</th>
                <th className="py-3.5 px-4 w-44">Giảng viên</th>
                <th className="py-3.5 px-4 w-40">Khoa / Bộ môn</th>
                <th className="py-3.5 px-4 w-40">Xóa lúc</th>
                <th className="py-3.5 px-4 text-right w-52">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-[#166534] dark:text-emerald-400" />
                      <span className="text-xs font-semibold">Đang tải thùng rác bài giảng...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 px-4">
                    <TacticalEmptyState
                      title={searchQuery ? 'Không tìm thấy bài giảng phù hợp' : 'Thùng rác bài giảng đang trống'}
                      description={
                        searchQuery
                          ? 'Thử nhập từ khóa khác hoặc xóa bộ lọc để xem toàn bộ.'
                          : 'Không có bài giảng nào đang bị xóa mềm.'
                      }
                      icon={<CheckCircle2 className="w-7 h-7 text-[#166534] dark:text-emerald-400" />}
                      onClearFilters={searchQuery ? () => setSearchQuery('') : undefined}
                      compact
                    />
                  </td>
                </tr>
              ) : pagedItems.map((lec) => (
                <tr key={lec.lecture_id} className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <span className="inline-flex px-2 py-0.5 rounded-md font-mono tabular-nums text-xs font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/30 max-w-[130px] truncate" title={lec.lecture_code}>
                      {lec.lecture_code}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-[13px] text-slate-900 dark:text-white max-w-[260px]">
                    <span className="line-clamp-2" title={lec.title}>{lec.title}</span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-[170px] truncate" title={`${lec.author_rank || ''} ${lec.author_name || ''}`.trim()}>
                    {lec.author_rank ? `${lec.author_rank} ` : ''}{lec.author_name}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-[150px] truncate" title={lec.faculty_name}>
                    {lec.faculty_name || '—'}
                  </td>
                  <td className="py-3.5 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {lec.updated_at ? new Date(lec.updated_at).toLocaleString('vi-VN') : '—'}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex justify-end gap-1.5 flex-nowrap">
                      <button
                        type="button"
                        disabled={busyId === lec.lecture_id}
                        onClick={() => setConfirm({ lec, kind: 'restore' })}
                        className="min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-emerald-200 dark:border-emerald-500/30 text-[#166534] bg-emerald-50/70 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 flex items-center gap-1 cursor-pointer disabled:opacity-50 whitespace-nowrap transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Khôi phục
                      </button>
                      <button
                        type="button"
                        disabled={busyId === lec.lecture_id}
                        onClick={() => setConfirm({ lec, kind: 'purge' })}
                        className="min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#b91c1c] hover:bg-[#991b1b] dark:bg-rose-600 dark:hover:bg-rose-500 text-white flex items-center gap-1 cursor-pointer disabled:opacity-50 whitespace-nowrap transition-colors"
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

        {filtered.length > 0 && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span>
              Tổng <strong className="font-mono tabular-nums text-slate-900 dark:text-white">{filtered.length}</strong> bài giảng (Trang {safePage}/{totalPages})
            </span>
            <PaginationBar currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>

      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
          onClick={() => setConfirm(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-[#0c1420] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl text-left"
          >
            <h3 className={`font-bold text-base mb-3 ${confirm.kind === 'purge' ? 'text-[#b91c1c] dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
              {confirm.kind === 'restore' ? 'Khôi phục bài giảng' : 'Xác nhận xóa vĩnh viễn bài giảng'}
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
                className="min-h-[36px] px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={busyId !== null}
                onClick={runConfirmed}
                className={`min-h-[36px] px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer disabled:opacity-50 ${
                  confirm.kind === 'restore' ? 'bg-[#166534] hover:bg-[#14532d] dark:bg-emerald-600 dark:hover:bg-emerald-500' : 'bg-[#b91c1c] hover:bg-[#991b1b] dark:bg-rose-600 dark:hover:bg-rose-500'
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
