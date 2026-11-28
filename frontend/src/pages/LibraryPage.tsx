import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Select, TreeSelect } from 'antd';
import { BookOpenCheck, Clock, Library, Plus, RotateCw, Search, Tags, Trash2 } from 'lucide-react';
import { Header } from '../components/common/Header';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { PaginationBar } from '../components/common/PaginationBar';
import { SegmentedTabs } from '../components/common/SegmentedTabs';
import { toast } from '../components/common/Toast';
import { DocumentPreviewModal } from '../components/document-desk/DocumentPreviewModal';
import { PendingProposalsModal, PendingProposalItem } from '../components/document-desk/PendingProposalsModal';
import { LibraryTable } from '../components/library/LibraryTable';
import { LibraryFormModal } from '../components/library/LibraryFormModal';
import { LibraryCategoryModal } from '../components/library/LibraryCategoryModal';
import { LibraryOverview } from '../components/library/LibraryOverview';
import { READING_SAVED_EVENT } from '../hooks/useLibraryReading';
import { toPreviewDocument } from '../utils/libraryPreview';
import { ROUTE_PATHS } from '../routes/routePaths';
import { libraryService } from '../services/libraryService';
import { documentsApi } from '../services/documentsApi';
import { dashboardApi } from '../services/dashboardApi';
import { approvalService } from '../services/approvalService';
import { useAuth } from '../hooks/useAuth';
import { useDeviceMode } from '../hooks/useDeviceMode';
import { useDebounce } from '../hooks/useDebounce';
import { isUserAdmin } from '../contexts/AuthContext';
import { buildUnitTree } from '../utils/unitTree';
import { isApprovalRequired } from '../utils/approvalUtils';
import type { DocumentItem, MetaData } from '../types';
import type { LibraryCategory, LibraryItem, LibrarySaveResponse, LibraryStats } from '../types/library';

const PAGE_SIZE = 20;
const isLibraryProposal = (p: { file_id?: string }) => /^LIB-/i.test(p.file_id || '');

type View = 'items' | 'trash';
type Confirm =
  | { kind: 'delete' | 'purge'; item: LibraryItem }
  | { kind: 'empty' }
  | null;

export const LibraryPage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const { deviceMode } = useDeviceMode();
  const touch = deviceMode === 'ipad';
  const isGuest = !user || user.user_id === 'GUEST';
  const roles = user?.roles || [];
  const isAdmin = !isGuest && (isUserAdmin(user) || roles.includes('ROL-01'));
  const isCommander = !isGuest && roles.includes('ROL-02');
  const direct = isAdmin || isCommander;
  const can = (code: string) => !isGuest && (isAdmin || hasPermission(code));

  const [view, setView] = useState<View>('items');
  const [meta, setMeta] = useState<MetaData>({ types: [], units: [], levels: [] });
  const [categories, setCategories] = useState<LibraryCategory[]>([]);

  const [search, setSearch] = useState('');
  const q = useDebounce(search, 400);
  const [category, setCategory] = useState<string>();
  const [unit, setUnit] = useState<string>();
  const [year, setYear] = useState<number>();
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<LibraryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [trashItems, setTrashItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryItem | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [preview, setPreview] = useState<DocumentItem | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [proposalsOpen, setProposalsOpen] = useState(false);
  const [proposals, setProposals] = useState<PendingProposalItem[]>([]);
  const [ownerWaiting, setOwnerWaiting] = useState(0);

  const unitTree = useMemo(() => buildUnitTree(meta.units), [meta.units]);
  const canApprove = !isGuest && (direct || hasPermission('APPROVAL_VALIDATE'));

  const loadCategories = useCallback(async () => {
    try {
      const res = await libraryService.categories();
      setCategories(res.items || []);
    } catch (err: any) {
      setLoadError(err.message);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      setStats(await libraryService.stats());
    } catch (err) {
      console.error('[library stats]', err);
    }
  }, []);

  const loadProposals = useCallback(async () => {
    if (isGuest) return;
    try {
      const res = await documentsApi.getPendingProposals();
      setProposals((res.items || []).filter(isLibraryProposal));
    } catch (err) {
      console.error('[library proposals]', err);
    }
    try {
      const owner = await approvalService.awaitingOwner();
      setOwnerWaiting((owner.items || []).filter(isLibraryProposal).length);
    } catch {
      setOwnerWaiting(0);
    }
  }, [isGuest]);

  const loadItems = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      if (view === 'trash') {
        const res = await libraryService.trash();
        if (request !== requestRef.current) return;
        setTrashItems(res.items || []);
      } else {
        const res = await libraryService.list({
          q: q.trim() || undefined, category, unit, include_children: unit ? 1 : undefined, year, page, page_size: PAGE_SIZE,
        });
        if (request !== requestRef.current) return;
        // Vừa xóa dòng cuối của trang cuối → lùi về trang trước
        if (!res.items.length && res.total > 0 && page > 1) {
          setPage(Math.ceil(res.total / PAGE_SIZE));
          return;
        }
        setItems(res.items || []);
        setTotal(res.total || 0);
      }
    } catch (err: any) {
      if (request !== requestRef.current) return;
      setItems([]);
      setTotal(0);
      setTrashItems([]);
      setLoadError(err.message);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [view, q, category, unit, year, page]);

  useEffect(() => {
    dashboardApi.getMeta().then(setMeta).catch((err) => console.error('[library meta]', err));
    loadCategories();
    loadProposals();
    loadStats();
    window.addEventListener(READING_SAVED_EVENT, loadStats);
    return () => window.removeEventListener(READING_SAVED_EVENT, loadStats);
  }, [user?.user_id, loadCategories, loadProposals, loadStats]);

  useEffect(() => {
    loadItems();
  }, [loadItems, user?.user_id]);

  const refresh = async () => {
    await Promise.all([loadItems(), loadCategories(), loadProposals(), loadStats()]);
  };

  const hasFilters = Boolean(search || category || unit || year);
  const clearFilters = () => {
    setSearch('');
    setCategory(undefined);
    setUnit(undefined);
    setYear(undefined);
    setPage(1);
  };

  const onSaved = async (res: LibrarySaveResponse) => {
    setFormOpen(false);
    setEditing(null);
    if (res.pending_approval) toast.info(res.message || 'Đã gửi chờ duyệt.', { title: 'CHỜ PHÊ DUYỆT', duration: 6000 });
    else if (!isApprovalRequired(res)) toast.success('Đã lưu tài liệu thư viện.');
    await refresh();
  };

  const download = async (item: LibraryItem, signal?: AbortSignal) => {
    const name = (item.original_name || `${item.document_code || item.file_id}.pdf`).replace(/[\/\\?%*:|"<>]/g, '_');
    try {
      return await documentsApi.prepareDownload(item.file_id, name, undefined, signal);
    } catch (err: any) {
      if (err?.name !== 'AbortError') toast.error(`Không tải được: ${err.message}`);
      throw err;
    }
  };

  const runAction = async (action: () => Promise<unknown>, done: string) => {
    try {
      const res = await action();
      // Quyền bị khóa bảo vệ: yêu cầu đã chuyển đi chờ duyệt, ApprovalListener tự thông báo
      if (!isApprovalRequired(res)) toast.success(done);
      await refresh();
    } catch (err: any) {
      toast.error(err.message || 'Không thực hiện được');
    }
  };

  const confirmAction = async () => {
    const current = confirm;
    setConfirm(null);
    if (!current) return;
    if (current.kind === 'empty') await runAction(() => libraryService.emptyTrash(), 'Đã dọn thùng rác thư viện.');
    else if (current.kind === 'delete') await runAction(() => libraryService.remove(current.item.file_id), 'Đã đưa tài liệu vào thùng rác.');
    else await runAction(() => libraryService.purge(current.item.file_id), 'Đã xóa vĩnh viễn tài liệu.');
  };

  const openPreview = (item: LibraryItem) => {
    try {
      if (!window.document.fullscreenElement) window.document.documentElement.requestFullscreen().catch(() => {});
    } catch { /* trình duyệt không cho toàn màn hình */ }
    setPreview(toPreviewDocument(item));
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pendingCount = proposals.length + ownerWaiting;
  const toolbarButton = touch ? '!min-h-[44px]' : '!h-[38px]';

  return (
    <div className="min-h-screen bg-slate-200 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      <Header activeNav="library" title="Trường Quân Sự Quân Khu 7" subtitle="Trung tâm dữ liệu số" />

      <main className="flex-1 min-w-0 p-3.5 sm:p-5 lg:p-6 xl:p-8 max-w-7xl w-full mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <Library className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
              Thư viện số
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Giáo trình, sách, tạp chí và công trình nghiên cứu của Nhà trường
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!isGuest && (
              <Button className={toolbarButton} icon={<BookOpenCheck className="w-4 h-4" />} onClick={() => navigate(ROUTE_PATHS.LIBRARY_READING)}>
                Sách đã đọc
              </Button>
            )}
            {!isGuest && (can('LIB_UPLOAD') || can('LIB_EDIT') || canApprove || pendingCount > 0) && (
              <Button className={toolbarButton} icon={<Clock className="w-4 h-4" />} onClick={() => { loadProposals(); setProposalsOpen(true); }}>
                Đề xuất chờ duyệt
                {pendingCount > 0 && <span className="px-1.5 rounded-full bg-amber-600 text-white text-xs font-bold tabular-nums">{pendingCount}</span>}
              </Button>
            )}
            {can('LIB_CATEGORY_MANAGE') && (
              <Button className={toolbarButton} icon={<Tags className="w-4 h-4" />} onClick={() => setCategoryOpen(true)}>Thể loại</Button>
            )}
            {can('LIB_UPLOAD') && (
              <Button type="primary" className={toolbarButton} icon={<Plus className="w-4 h-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>
                Đăng tải tài liệu
              </Button>
            )}
          </div>
        </div>

        {view === 'items' && (
          <LibraryOverview
            stats={stats}
            units={meta.units}
            isGuest={isGuest}
            selectedUnit={unit}
            selectedCategory={category}
            selectedYear={year}
            onSelectUnit={(v) => { setUnit(v); setPage(1); }}
            onSelectCategory={(v) => { setCategory(v); setPage(1); }}
            onSelectYear={(v) => { setYear(v); setPage(1); }}
            onReset={clearFilters}
            onOpenHistory={() => navigate(ROUTE_PATHS.LIBRARY_READING)}
          />
        )}

        {can('LIB_TRASH_VIEW') && (
          <SegmentedTabs<View>
            ariaLabel="Chuyển giữa kho thư viện và thùng rác"
            surface="card"
            size={touch ? 'md' : 'sm'}
            value={view}
            onChange={(v) => { setLoading(true); setView(v); }}
            items={[
              { value: 'items', label: 'Kho thư viện', icon: <Library className="w-4 h-4" />, activeTone: 'emerald' },
              { value: 'trash', label: 'Thùng rác', icon: <Trash2 className="w-4 h-4" />, activeTone: 'danger' },
            ]}
          />
        )}

        <section className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-white/[0.08] overflow-hidden">
          {view === 'items' ? (
            <div className="p-3 flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-white/[0.08]">
              <Input
                allowClear
                className={`!flex-1 !min-w-[220px] ${touch ? '!min-h-[44px]' : ''}`}
                prefix={<Search className="w-4 h-4 text-slate-400" />}
                placeholder="Tìm tên tài liệu, tác giả, mã, nhà xuất bản"
                aria-label="Tìm trong thư viện"
                maxLength={200}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
              <Select
                allowClear
                className={`w-full sm:!w-[220px] ${touch ? '!min-h-[44px]' : ''}`}
                placeholder="Tất cả thể loại"
                aria-label="Lọc theo thể loại"
                value={category}
                onChange={(v) => { setCategory(v); setPage(1); }}
                options={categories.map((c) => ({ value: c.category_id, label: `${c.name} (${c.item_count})` }))}
              />
              <TreeSelect
                allowClear
                showSearch={{ treeNodeFilterProp: 'name' }}
                className={`w-full sm:!w-[220px] ${touch ? '!min-h-[44px]' : ''}`}
                placeholder="Tất cả đơn vị"
                aria-label="Lọc theo đơn vị quản lý"
                value={unit}
                onChange={(v) => { setUnit(v); setPage(1); }}
                treeData={unitTree as any}
                popupMatchSelectWidth={360}
              />
              <Select
                allowClear
                className={`w-full sm:!w-[170px] ${touch ? '!min-h-[44px]' : ''}`}
                placeholder="Tất cả năm"
                aria-label="Lọc theo năm xuất bản"
                value={year}
                onChange={(v) => { setYear(v); setPage(1); }}
                options={(stats?.by_year || []).filter((y) => y.year !== null).map((y) => ({ value: y.year as number, label: `Năm ${y.year} (${y.count})` }))}
              />
              <Button className={toolbarButton} icon={<RotateCw className="w-4 h-4" />} onClick={refresh}>Tải lại</Button>
            </div>
          ) : (
            <div className="p-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-white/[0.08]">
              <span className="text-sm text-slate-600 dark:text-slate-300 tabular-nums">{trashItems.length} tài liệu trong thùng rác</span>
              {can('LIB_PURGE') && (
                <Button danger className={toolbarButton} disabled={!trashItems.length} icon={<Trash2 className="w-4 h-4" />} onClick={() => setConfirm({ kind: 'empty' })}>
                  Dọn thùng rác
                </Button>
              )}
            </div>
          )}

          {loadError && (
            <div role="alert" className="mx-3 mt-3 rounded-lg border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-sm text-rose-800 dark:text-rose-300 flex items-center justify-between gap-3">
              <span>{loadError}</span>
              <button type="button" onClick={refresh} className="text-xs font-bold underline cursor-pointer shrink-0 min-h-[32px]">Thử lại</button>
            </div>
          )}

          <LibraryTable
            items={view === 'trash' ? trashItems : items}
            loading={loading}
            trashMode={view === 'trash'}
            touch={touch}
            emptyTitle={view === 'trash' ? 'Thùng rác trống' : hasFilters ? 'Không có tài liệu khớp bộ lọc' : 'Thư viện chưa có tài liệu'}
            emptyDescription={
              view === 'trash' ? 'Tài liệu bị xóa hoặc bị từ chối duyệt sẽ nằm ở đây.'
                : hasFilters ? 'Thử đổi từ khóa hoặc xóa bớt tiêu chí lọc.'
                  : can('LIB_UPLOAD') ? 'Bấm "Đăng tải tài liệu" để thêm tài liệu đầu tiên.'
                    : 'Chưa có tài liệu nào được đưa vào thư viện.'
            }
            onClearFilters={view === 'items' && hasFilters ? clearFilters : undefined}
            onPreview={openPreview}
            onDownload={download}
            onEdit={can('LIB_EDIT') ? (item) => { setEditing(item); setFormOpen(true); } : undefined}
            onDelete={can('LIB_DELETE') ? (item) => setConfirm({ kind: 'delete', item }) : undefined}
            onRestore={can('LIB_RESTORE') ? (item) => runAction(() => libraryService.restore(item.file_id), 'Đã khôi phục tài liệu.') : undefined}
            onPurge={can('LIB_PURGE') ? (item) => setConfirm({ kind: 'purge', item }) : undefined}
          />

          {view === 'items' && total > 0 && (
            <div className="p-3 border-t border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="tabular-nums">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} trong {total} tài liệu
              </span>
              {totalPages > 1 && <PaginationBar currentPage={page} totalPages={totalPages} onPageChange={setPage} />}
            </div>
          )}
        </section>
      </main>

      <LibraryFormModal
        open={formOpen}
        item={editing}
        categories={categories}
        units={meta.units}
        direct={direct}
        canParse={can('LIB_PARSE')}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSaved={onSaved}
      />

      <LibraryCategoryModal
        open={categoryOpen}
        categories={categories}
        onClose={() => setCategoryOpen(false)}
        onChanged={async () => { await Promise.all([loadCategories(), loadItems(), loadStats()]); }}
      />

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

      <PendingProposalsModal
        open={proposalsOpen}
        proposals={proposals}
        canApprove={canApprove}
        onClose={() => setProposalsOpen(false)}
        onRefresh={refresh}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.kind === 'delete' ? 'Đưa tài liệu vào thùng rác' : confirm?.kind === 'purge' ? 'Xóa vĩnh viễn tài liệu' : 'Dọn sạch thùng rác thư viện'}
        message={
          confirm?.kind === 'delete' ? `"${confirm.item.title}" sẽ rời khỏi kho thư viện. Đề xuất sửa đang chờ (nếu có) bị hủy. Có thể khôi phục từ thùng rác.`
            : confirm?.kind === 'purge' ? `"${confirm.item.title}" (${confirm.item.file_id}) và tệp PDF sẽ bị xóa hẳn. Không thể khôi phục.`
              : `Xóa hẳn ${trashItems.length} tài liệu cùng tệp PDF. Không thể khôi phục.`
        }
        confirmText={confirm?.kind === 'delete' ? 'Đưa vào thùng rác' : confirm?.kind === 'purge' ? 'Xóa vĩnh viễn' : 'Dọn thùng rác'}
        confirmVariant="danger"
        onConfirm={confirmAction}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
};

export default LibraryPage;
