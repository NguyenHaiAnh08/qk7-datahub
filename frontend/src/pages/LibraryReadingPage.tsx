import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Popconfirm, Skeleton } from 'antd';
import { ArrowLeft, BookOpen, BookOpenCheck, Trash2 } from 'lucide-react';
import { Header } from '../components/common/Header';
import { SegmentedTabs } from '../components/common/SegmentedTabs';
import { TacticalEmptyState } from '../components/common/TacticalEmptyState';
import { toast } from '../components/common/Toast';
import { DocumentPreviewModal } from '../components/document-desk/DocumentPreviewModal';
import { libraryService } from '../services/libraryService';
import { LibraryCover } from '../components/library/LibraryCover';
import { READING_SAVED_EVENT } from '../hooks/useLibraryReading';
import { useAuth } from '../hooks/useAuth';
import { useDeviceMode } from '../hooks/useDeviceMode';
import { ROUTE_PATHS } from '../routes/routePaths';
import { toPreviewDocument } from '../utils/libraryPreview';
import type { DocumentItem } from '../types';
import type { LibraryReadingItem } from '../types/library';

type Filter = 'reading' | 'done' | 'all';

const formatDateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const LibraryReadingPage: React.FC = () => {
  const { user } = useAuth();
  const { deviceMode } = useDeviceMode();
  const touch = deviceMode === 'ipad';
  const [items, setItems] = useState<LibraryReadingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('reading');
  const [preview, setPreview] = useState<DocumentItem | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await libraryService.readingList();
      setItems(res.items || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Không tải được lịch sử đọc.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(READING_SAVED_EVENT, load);
    return () => window.removeEventListener(READING_SAVED_EVENT, load);
  }, [load, user?.user_id]);

  const reading = items.filter((i) => !i.completed);
  const done = items.filter((i) => i.completed);
  const visible = filter === 'reading' ? reading : filter === 'done' ? done : items;

  const open = (item: LibraryReadingItem) => {
    try {
      if (!window.document.fullscreenElement) window.document.documentElement.requestFullscreen().catch(() => {});
    } catch { /* trình duyệt không cho toàn màn hình */ }
    setPreview(toPreviewDocument(item));
  };

  const remove = async (item: LibraryReadingItem) => {
    try {
      await libraryService.removeReading(item.file_id);
      toast.success('Đã xóa khỏi lịch sử đọc. Tài liệu vẫn còn trong thư viện.');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Không xóa được');
    }
  };

  const buttonSize = touch ? '!min-h-[44px]' : '';

  return (
    <div className="min-h-screen bg-slate-200 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      <Header activeNav="library" title="Trường Quân Sự Quân Khu 7" subtitle="Trung tâm dữ liệu số" />

      <main className="flex-1 min-w-0 p-3.5 sm:p-5 lg:p-6 xl:p-8 max-w-5xl w-full mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
              <BookOpenCheck className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
              Sách đã đọc
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Trang đang đọc được lưu trên máy chủ theo tài khoản của đồng chí
            </p>
          </div>
          <Link
            to={ROUTE_PATHS.LIBRARY}
            className={`inline-flex items-center gap-2 px-3.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#111827] text-sm font-semibold ${touch ? 'min-h-[44px]' : 'h-[38px]'}`}
          >
            <ArrowLeft className="w-4 h-4" /> Về kho thư viện
          </Link>
        </div>

        <SegmentedTabs<Filter>
          ariaLabel="Lọc lịch sử đọc"
          surface="card"
          size={touch ? 'md' : 'sm'}
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'reading', label: 'Đang đọc', count: reading.length, activeTone: 'emerald' },
            { value: 'done', label: 'Đã đọc xong', count: done.length, activeTone: 'emerald' },
            { value: 'all', label: 'Tất cả', count: items.length, activeTone: 'emerald' },
          ]}
        />

        {error && (
          <div role="alert" className="rounded-lg border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-sm text-rose-800 dark:text-rose-300 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button type="button" onClick={load} className="text-xs font-bold underline cursor-pointer shrink-0 min-h-[32px]">Thử lại</button>
          </div>
        )}

        {loading ? (
          <div className="bg-white dark:bg-[#111827] rounded-xl p-4"><Skeleton active paragraph={{ rows: 4 }} /></div>
        ) : !visible.length ? (
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-white/[0.08]">
            <TacticalEmptyState
              title={items.length ? 'Không có tài liệu ở mục này' : 'Đồng chí chưa đọc tài liệu nào'}
              description={items.length ? 'Chọn mục khác để xem.' : 'Mở một tài liệu trong kho thư viện, hệ thống sẽ tự ghi lại trang đang đọc.'}
              icon={<BookOpen className="w-8 h-8 text-emerald-700 dark:text-emerald-400" />}
              compact
            />
          </div>
        ) : (
          <ul className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-white/[0.08] divide-y divide-slate-100 dark:divide-white/[0.06]">
            {visible.map((item) => {
              const done100 = item.completed;
              const value = done100 ? 100 : Math.round((item.last_page / item.total_pages) * 100);
              return (
                <li key={item.file_id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                  <LibraryCover
                    url={libraryService.coverUrl(item.file_id, item.cover_version)}
                    alt={`Bìa ${item.title}`}
                    className="w-16 h-[90px]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 dark:text-white line-clamp-2">{item.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {[item.category_name, item.author].filter(Boolean).join(' · ')}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <div
                        role="progressbar"
                        aria-valuenow={value}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Tiến độ đọc ${item.title}`}
                        className="flex-1 max-w-sm h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
                      >
                        <div className="h-full bg-emerald-600 dark:bg-emerald-500" style={{ width: `${value}%` }} />
                      </div>
                      <span className="text-xs tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        Trang <strong>{item.last_page}</strong>/{item.total_pages}
                        {done100 && <span className="ml-2 font-semibold text-emerald-700 dark:text-emerald-400">Đã đọc xong</span>}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                      Đọc lần cuối {formatDateTime(item.last_read_at)}
                      {!done100 && item.max_page > item.last_page && ` · xa nhất tới trang ${item.max_page}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button type="primary" className={buttonSize} icon={<BookOpen className="w-4 h-4" />} onClick={() => open(item)}>
                      {done100 ? 'Mở lại' : `Đọc tiếp trang ${item.last_page}`}
                    </Button>
                    <Popconfirm
                      title="Xóa khỏi lịch sử đọc?"
                      description="Trang đã lưu của tài liệu này sẽ mất."
                      okText="Xóa"
                      cancelText="Hủy"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => remove(item)}
                    >
                      <Button className={buttonSize} aria-label={`Xóa ${item.title} khỏi lịch sử đọc`} icon={<Trash2 className="w-4 h-4" />} />
                    </Popconfirm>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <DocumentPreviewModal
        open={Boolean(preview)}
        document={preview}
        userClearanceLevel={user?.clearance_level_id || 1}
        onClose={() => {
          setPreview(null);
          try {
            if (window.document.fullscreenElement) window.document.exitFullscreen().catch(() => {});
          } catch { /* bỏ qua */ }
        }}
      />
    </div>
  );
};

export default LibraryReadingPage;
